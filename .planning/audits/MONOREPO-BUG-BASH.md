# CriaLook Monorepo — Bug-Bash Sweep

**Scope:** `campanha-ia/` (Next.js 16 web app), `ops/`, `loadtests/`, root scripts
(`deploy-crialook.sh`, `ecosystem.config.js`, `nginx-crialook.conf`).
**Out of scope:** `crialook-app/`, `curriculo/` (covered by other agents).
**Date:** 2026-05-03
**Methodology:** Static read of route handlers, lib code, ops scripts, infra
config, and migrations. No runtime probing — findings derived from code
inspection. Reproduction steps included where the failure mode isn't obvious
from the code alone.

> Notation: severity tags use the convention **Critical** (data loss / money
> loss / auth bypass / production outage), **High** (silent corruption,
> guaranteed UX failure under realistic conditions, security weakness), **Medium**
> (degraded UX / observability gap / fragility), **Low** (style, drift, future-trap).

---

## Severity Summary

| Severity | Count |
|---|---|
| Critical | 4 |
| High     | 14 |
| Medium   | 18 |
| Low      | 11 |

Critical & High are listed first by area; Medium / Low follow grouped.

---

## CRITICAL

### C-1 — `stores.plan` vs `stores.plan_id` schema split (Google Play billing path is inert)
**Severity:** Critical
**Files:**
- `campanha-ia/src/app/api/billing/restore/route.ts:128-131`
- `campanha-ia/src/app/api/billing/rtdn/route.ts:230-239`
- `campanha-ia/src/lib/db/index.ts:706-770` (`updateStorePlan` writes `plan_id`)

The Mercado Pago path (`updateStorePlan`) writes the FK column `stores.plan_id`
(UUID resolved by `name`). The Google Play paths (`/api/billing/restore`,
`/api/billing/rtdn`) write a **`stores.plan` text column** that does not exist
in the baseline schema (`campanha-ia/supabase/migrations/00000000000000_baseline.sql`).
Even `verify/route.ts` had this exact bug fixed once (see comment lines 118-122
"A versão antiga tentava setar uma coluna `plan` que não existe — update silencioso
não falhava mas também não fazia nada"), but `restore` and `rtdn` were never
updated.

**Impact:** Every Google Play subscription event (renewal, refund, expiry) and
every restore call silently no-ops on the plan. `stores.plan_id` stays at
whatever it was before. Refunds (`notificationType=12 REVOKED`) leave paying
features active; expiries (`13`) leave plan untouched; restores promote nothing.

**Repro:** Apply a Play sub, trigger an RTDN with `notificationType=12`. Query
`stores` row — `plan_id` unchanged, no error in logs.

**Fix:** Replace the bare `.update({ plan: ... })` calls with `updateStorePlan(storeId, plan)`
(same helper `verify/route.ts` already uses) and `updateStorePlan(storeId, "gratis")`
on revoke/expire. Add an integration test that asserts `plan_id` actually changes.

---

### C-2 — Plan `updateStorePlan` doesn't pass `mpSubscriptionId` from Mercado Pago payment webhook
**Severity:** Critical
**Files:** `campanha-ia/src/app/api/webhooks/mercadopago/route.ts:223-224`, `campanha-ia/src/lib/db/index.ts:706-735`

The MP payment webhook (`storeId|planId` ref) calls `updateStorePlan(storeId, planId)`
with **no** subscription ID. `updateStorePlan` then writes `mercadopago_subscription_id: null`
(line 731 — `mpSubscriptionId || null`). Comment at line 222-223 says "Não passar
paymentId como 3º argumento — esse campo é mpSubscriptionId, já salvo corretamente
pelo evento subscription_preapproval". But `handleSubscriptionEvent` writes the
ID with no idempotency check; if events arrive in the order `payment → subscription_preapproval`,
the payment handler clobbers the sub ID it should preserve. Worse, if the payment
handler fires for a renewal **after** the user later cancels (`subscription_preapproval`
sets it to null per line 305), there's no rebind.

**Impact:** Stores end up with `mercadopago_subscription_id = null` even with an
active sub. The downgrade cron (`/api/cron/downgrade-expired/route.ts:60-62`)
explicitly looks for `mercadopago_subscription_id IS NULL` to decide which stores
to downgrade. Active paying customers with a recent renewal can be downgraded
to free at the next cron tick if events arrive out of order.

**Repro:**
1. User subscribes (sub_preapproval first → writes ID).
2. MP renewal fires (payment event → `updateStorePlan(storeId, planId)`).
3. Inside `updateStorePlan`, line 730: `.update({ plan_id, mercadopago_subscription_id: null, updated_at })`.
   The sub ID is **destroyed** on every renewal payment.
4. Daily cron runs, sees `subscription_id IS NULL` and `plan_id != gratis`,
   waits for period_end, then downgrades.

**Fix:** In `updateStorePlan`, only set `mercadopago_subscription_id` when the
caller explicitly passes a non-null value. Replace `mercadopago_subscription_id: mpSubscriptionId || null`
with conditional spread: `...(mpSubscriptionId !== undefined ? { mercadopago_subscription_id: mpSubscriptionId } : {})`.

---

### C-3 — Clerk webhook creates store with `segment_primary: "outro"` but never invokes `createStore` initialization
**Severity:** Critical
**Files:** `campanha-ia/src/app/api/webhooks/clerk/route.ts:92-97`, `campanha-ia/src/lib/db/index.ts:47-89` (`createStore`)

The Clerk `user.created` webhook inserts a stores row directly via the admin
client. It does **not** create the matching `store_usage` row, set `plan_id`
to the free plan, or call `createStore`. The store has `plan_id: NULL`.

Downstream: `canGenerateCampaign` calls `getOrCreateCurrentUsage` (line 484),
which now self-heals (good — see comment at lines 478-482), but only with
`campaigns_limit = freePlan.campaigns_per_month`. **However** `addCreditsToStore`
and quota lookups assume `plan_id` is set; `getStorePlanName` returns "free"
when `plan_id` is null (line 256), but downstream logic that reads via
`stores.plans(name)` join can show the user as plan-less in the UI.

**Impact:** New users created post-Clerk-webhook have no `plan_id` set, so any
query that joins `plans` returns null (free plan rendering may differ from a
properly initialized free plan). It also means the `model_limit` from
`getModelLimitForPlan` returns the default for "unknown plan" instead of "free".

**Fix:** Either call `createStore({ ... })` from the Clerk webhook (it does the
full init: plan_id resolution, store_usage row, brand defaults), or extract
the init-only path into a helper and call it from both places. Test:
new sign-up → query `stores` → `plan_id IS NOT NULL` and `store_usage` row exists.

---

### C-4 — `sub_preapproval` "cancelled" event nukes `mercadopago_subscription_id` even mid-period — orphans renewals
**Severity:** Critical
**Files:** `campanha-ia/src/app/api/webhooks/mercadopago/route.ts:296-308`

When the user cancels via MP (sub goes to `cancelled`), the handler nulls
`mercadopago_subscription_id` immediately. Comment says "MANTER o plano ativo
até o fim do período já pago" — and that's correct intent — but the cron
(C-2) looks for `subscription_id IS NULL` to decide downgrade candidacy,
and `period_end < today` to actually downgrade.

The bug: between cancel and period_end, **if a refund is later posted as a payment
event**, the credit/plan branch doesn't recognize the user has a cancelled sub
(it just writes plan again without context). Worse — the period preserved is
whatever `getCurrentUsage` returned at cancel time. If that period_end is wrong
(C-3 self-heal sets `period_end = last day of current month`, not "30 days
from MP's actual billing cycle"), the user could lose access early or late.

**Fix:** Don't null `mercadopago_subscription_id` on cancel. Instead, set a
new `subscription_cancel_pending_at` timestamp or `subscription_status = 'cancelled'`
column. Cron then evaluates `subscription_status = 'cancelled' AND period_end < today`
instead of relying on the absence of the ID. This keeps history and enables
recovery if user resubscribes.

---

## HIGH

### H-1 — SSE pipeline awaits `Promise.all([copyPromise, imagePromise])` — Sonnet failure aborts whole pipeline despite VTO success
**Severity:** High
**Files:** `campanha-ia/src/lib/ai/pipeline.ts:308`

`Promise.all` is fail-fast: if `copyPromise` rejects, the whole pipeline rejects
and the user sees the error path (refund branch). The Sonnet promise has a
`.catch` fallback (line 251-274) that returns a default `dicas_postagem`, so in
practice this does NOT abort... **unless** the catch handler itself throws
(e.g., `isMale` undefined access — see line 217 — when modelInfo is undefined,
`gender` is undefined, and the optional chaining returns `false`, so `isMale` is
boolean — that part is OK). But:

- The `copyPromise.then(...)` chain at lines 229-250 calls `logModelCost` and
  returns `copyResult`. If `copyResult.dicas_postagem` is undefined (e.g.
  Sonnet returned a different shape), the optional chaining inside .then
  doesn't throw, but downstream `await sendSSE("done", { ..., dicas_postagem })`
  would emit `undefined` causing the mobile client to break parsing.

**Recommendation:** Use `Promise.allSettled` for the parallel arms, then map
each result with explicit success/fallback handling. Make the contract: image
success → user gets ≥1 photo; copy failure → user gets fallback caption (already
implemented but should be hard-tested).

---

### H-2 — `request.signal` threaded into pipeline but never honored downstream
**Severity:** High
**Files:**
- `campanha-ia/src/app/api/campaign/generate/route.ts:513` (passes signal)
- `campanha-ia/src/lib/ai/pipeline.ts:39-99` (declares `signal` but never reads)
- `campanha-ia/src/lib/ai/with-timeout.ts:23` (acknowledges no AbortController hardening)

`/gerar` page sets a 180s `AbortController` (line 270-271). Route handler
threads `signal: request.signal` into `runCampaignPipeline`. But the pipeline
**never reads `input.signal`** — it's declared, never used. Gemini SDK calls
have no `signal` argument; `withTimeout` is timer-only with no cancel.

**Impact:** When user navigates away, refreshes, or the mobile app times out,
the server keeps spending API credits (Gemini Pro VTO ~R$2.85/call) for ~60s
until natural completion. At scale this is real money. Also, the SSE writer
catches `try { await writer.close() } catch {}` but the `(async () => { ... })()`
IIFE keeps running with no observer.

**Fix:** Honor `signal` in the IIFE. On `signal.aborted`, set a flag, skip
remaining steps, and return early. For Gemini API itself, no native cancel
exists in the SDK — but at minimum, abort the upload retries (lines 594-622)
and the teaser generation (lines 681-741) when signal fires.

---

### H-3 — `Promise.all` of `[trialCount, purchaseCount]` queries swallows failures via outer catch but still consumes credit
**Severity:** High
**Files:** `campanha-ia/src/app/api/campaign/generate/route.ts:212-235`

When trial detection runs, the `consumeCredit` already happened (line 178).
If the `Promise.all` of `mini_trial_uses` + `credit_purchases` queries throws
(e.g. Supabase outage 5xx mid-flight), we hit `catch (trialErr)` → `isTrialOnly`
defaults to `false` → user gets 3 photos when they should have gotten 1.

But more critically: the comment says "fail-safe pro usuário recebe a foto",
which is fine **for the user**, but it's an exploit vector. A user can
intentionally trigger DB failure via abuse (rapid retries) to get 3 photos
on each trial credit instead of 1, paying nothing.

**Fix:** If detection fails on a trial-eligible user, default `isTrialOnly = true`
(fail-secure to lower cost) instead of `false`.

---

### H-4 — Image upload retry path corrupts cost accounting on partial failure
**Severity:** High
**Files:** `campanha-ia/src/app/api/campaign/generate/route.ts:574-672`

The route distinguishes "all uploads failed → refund" from "≥1 succeeded →
charge". But the **cost was already incurred** at the Gemini VTO call upstream.
The Gemini cost log (gemini-vto-generator.ts:453-466) writes regardless of
upload success. Result: `api_cost_logs` shows cost for the call, but no campaign
row, no credit deduction. This makes per-campaign profitability metrics off.

Also, `successCount` from VTO is "Gemini returned image bytes". Upload failures
later don't update the metric. The dashboard sees 100% VTO success but users
see ALL_UPLOADS_FAILED errors.

**Fix:** Either (a) add an `upload_failed` flag on the cost log row when refunding,
or (b) move the cost-log write to AFTER successful upload — but that creates a
"dropped row" risk if the route crashes between upload and log. (a) is safer.

---

### H-5 — Webhook signature validation timing — `validateMpSignature` returns false on missing header parts but doesn't constant-time compare unrelated paths
**Severity:** High
**Files:** `campanha-ia/src/lib/mp-signature.ts:25-50`

`validateMpSignature` returns `false` early on `!ts || !v1` and on length
mismatch — these are not timing-safe (attacker can distinguish "missing field"
from "wrong HMAC" via response timing). Less critical because the secret is
on the server, not user-supplied; the practical attack surface is forging a
webhook by guessing the secret, where this leak provides no usable info.

But **more importantly:** there's no replay protection beyond the `skewSec=300`
window. An attacker who captures a valid webhook (shoulder-surf, MITM on a
misconfigured proxy) can replay it within 5 min. The idempotency check
on `payment_id` (line 145-153) prevents double-credit, but for events like
`subscription_preapproval` cancellation, a replay could re-cancel a recently
re-activated sub with no idempotency guard.

**Fix:** Add a `mp_webhook_seen` table keyed by `(x-request-id)` with TTL,
short-circuit on duplicate. Defense in depth on top of HMAC + skew window.

---

### H-6 — `addCreditsToStore` non-atomic between `credit_purchases.insert` and credit increment
**Severity:** High
**Files:** `campanha-ia/src/lib/db/index.ts:779-832`

The function inserts a `credit_purchases` row, then increments via RPC. If the
RPC fails (network blip mid-call), the insert succeeded → user has a "purchase
record" but no credits. The fallback path (line 818-829) does read-modify-write,
which has its own race (two concurrent webhooks for the same payment ID — though
the outer idempotency check guards against that for the same payment).

**Repro:** Network glitch between the two writes; user paid but has no credits;
support has to manually grant.

**Fix:** Wrap both operations in a single Postgres function (`SECURITY DEFINER`).
Either both happen or neither. The idempotency check at the webhook level is
already there — adding a "credit_purchase exists for this payment but credits
not granted" reconciliation cron would catch the rare survivors.

---

### H-7 — `cron/downgrade-expired` race against active subscription event
**Severity:** High
**Files:** `campanha-ia/src/app/api/cron/downgrade-expired/route.ts:72-101`

The cron loops over candidates, fetches `period_end`, downgrades. Between the
candidate fetch (line 57-62) and the `update`, a webhook can arrive (renewal)
and re-set `mercadopago_subscription_id`. The cron then writes `plan_id =
free_plan_id` over the now-active sub. No optimistic locking.

**Repro:**
1. User cancels sub, period_end = today (last day).
2. Cron starts at 00:01 — loads candidate.
3. User resubscribes at 00:02 — webhook writes plan_id, sub_id.
4. Cron at 00:03 writes `plan_id = free` blindly.
5. User pays for premium but has free plan.

**Fix:** In the cron's update, add a guard `.is("mercadopago_subscription_id", null)`
on the WHERE so the update is no-op if the sub got rebound. Alternatively,
re-read the row inside the loop with `FOR UPDATE` semantics (Postgres only,
not Supabase REST) or use the timestamp-based optimistic lock.

---

### H-8 — Rate limiter is in-memory `Map` — bypassed by cluster restart and multi-instance
**Severity:** High
**Files:** `campanha-ia/src/lib/rate-limit.ts:23-92`

Comment at top is clear about this limitation. `ecosystem.config.js` enforces
`exec_mode: "fork"`, `instances: 1` to prevent cluster bypass — but a PM2
restart (max_memory_restart, crashes, deploys) wipes the map. Determined
attackers can detect restart cadence and time abuse.

Plus: rate-limit key is the IP forwarded from Nginx via `x-forwarded-for`. The
nginx config does correctly **overwrite** `X-Forwarded-For` (line 197 of
`nginx-crialook.conf` and lines 119-120, 153, 168 etc — all use `$remote_addr`,
not `$proxy_add_x_forwarded_for`), so spoofing client-side IP isn't possible.
But behind Cloudflare, `$remote_addr` is Cloudflare's IP, not the user's →
all CF-fronted users share one bucket, anti-abuse becomes anti-CF-region.

**Fix:** Move to Postgres-backed limiter (`store_id`-keyed token bucket) or
Redis. At minimum, document the CF-specific risk and add `cf-connecting-ip`
header preference if behind CF.

---

### H-9 — `incrementRegenCount` fallback path drops the `storeId` filter
**Severity:** High
**Files:** `campanha-ia/src/lib/db/index.ts:336-348`

When the new RPC `increment_regen_count(p_campaign_id, p_store_id)` fails AND
the legacy RPC also fails, the fallback path constructs an update without the
`store_id` filter (line 344) UNLESS storeId is passed. But even when it IS
passed, the update happens UNCONDITIONALLY based on the current count (line 343
re-reads via single() with no store filter — IDOR leak).

**Repro:** Knowing only a campaignId from leaked log/URL, an attacker who can
reach `/api/campaign/[id]/regenerate` and trigger the fallback path could
increment another store's regen count. Today the feature is gated off
(`FEATURE_REGENERATE_CAMPAIGN`), but turning it on without fixing this exposes
cross-store mutation.

**Fix:** Always require storeId in the read query: `.eq("store_id", storeId)`
on the SELECT at line 339-341.

---

### H-10 — `failCampaign` writes `pipeline_completed_at` but the SSE error path also calls it from inside the IIFE; both can race
**Severity:** High
**Files:** `campanha-ia/src/app/api/campaign/generate/route.ts:531-571, 631-671, 787-790`

Three different error paths call `failCampaign(campaignRecord.id, ...)`. None
check current status. If two SSE error events fire (e.g., upload-fail and then
pipeline-error), `failCampaign` runs twice and overwrites `error_message` in
LIFO order. Sentry sees one error reason but DB shows another.

**Fix:** `failCampaign` should be conditional: `WHERE status = 'processing'`
to make it a single-shot transition. Even better — model status transitions
explicitly with a CHECK constraint.

---

### H-11 — `incrementCampaignsUsed` race — fallback path is read-then-write under concurrent calls
**Severity:** High
**Files:** `campanha-ia/src/lib/db/index.ts:560-578`

When the RPC fails and we hit the read-modify-write fallback (line 573-577),
two concurrent generations can both read `campaigns_generated = 5`, both write
6 → user gets 2 generations charged as 1. Same risk in `consumeCredit` fallback
(line 859-869) and `addCreditsToStore` fallback (line 818-829). The RPCs are
correctly atomic — but every fallback is a race.

**Fix:** Make the fallback either (a) error out hard (force surface to ops),
(b) use UPDATE ... RETURNING with arithmetic in SQL: `UPDATE store_usage SET
campaigns_generated = campaigns_generated + 1 WHERE id = $1 RETURNING ...` — that
single statement is atomic without RPC.

---

### H-12 — Trial teaser generation runs Sharp on potentially-1x1-pixel fallback image
**Severity:** High
**Files:** `campanha-ia/src/app/api/campaign/generate/route.ts:476-480 + 681-741`

When no model image is available, the route falls back to a 1×1 transparent PNG
(line 478). For trial users, the teaser branch (line 682) tries to extract a
70%-tall window from this 1×1 image and resize to 400×600. Sharp errors out;
the catch swallows it (line 738) and the user gets no teaser. Acceptable
fail-safe but a confusing log line every trial run with no model.

**Fix:** Skip the teaser branch entirely when `modelImageBase64` is the fallback
(track via a boolean flag set at the fallback site).

---

### H-13 — Inngest `judgeCampaignJob` is fire-and-forget from pipeline; loss of judge job means no quality signal
**Severity:** High
**Files:** `campanha-ia/src/lib/ai/pipeline.ts:345-374`, `campanha-ia/src/lib/inngest/functions.ts:337-449`

`inngest.send({...}).catch(...)` swallows the failure. If Inngest is down or
the event key is wrong (env), every successful campaign silently fails to be
judged. There's no DLQ table or retry visibility from the producer side. Per
user memory: "Phase 2.5 deferred indefinitely — judge captures uncalibrated".
Even if uncalibrated, losing the data point means we can't validate calibration
later.

**Fix:** Persist a `judge_pending` flag on the campaign row when emit succeeds,
clear on judge persistence. A reconcile cron can re-emit for old `judge_pending=true`
rows. Cheap insurance.

---

### H-14 — `validateMpSignature` accepts `xRequestId = ""` (line 36 in webhook) — manifest becomes guessable
**Severity:** High
**Files:** `campanha-ia/src/app/api/webhooks/mercadopago/route.ts:36`, `campanha-ia/src/lib/mp-signature.ts:39`

`request.headers.get("x-request-id") || ""` — if MP omits the header, manifest
becomes `id:<dataId>;request-id:;ts:<ts>;`. Combined with a known/guessable
`dataId` (sequential payment IDs are not crypto-random), the HMAC space narrows.
Probably not exploitable (still need the secret) but a defense-in-depth gap.

**Fix:** Reject `if (!xRequestId)` outright. MP's docs require it; treat absence
as an invalid event.

---

## MEDIUM

### M-1 — `health-check.sh` (root deploy script) uses `curl -s` (silent) and only checks HTTP 200; misses degraded state
**Severity:** Medium
**Files:** `deploy-crialook.sh:243-251`, `ops/health-check.sh:14`

Generated health check at `/root/health-check.sh` only restarts on non-200.
The deep-check endpoint returns `503` on `error` but `200` on `degraded` (e.g.,
storage warning). A degraded-but-up app keeps running indefinitely. The ops
version is similar but at least uses the public endpoint correctly.

**Fix:** Inspect response body for `status: "unhealthy"` (or rely on 503 only).
Add Discord/Slack notification to deploy-script-generated health check.

---

### M-2 — `deploy-crialook.sh` has no rollback path
**Severity:** Medium
**Files:** `deploy-crialook.sh` (entire file)

`git pull` → `npm ci` → `npm run build` → `pm2 reload`. If build fails after
git pull, the working tree is on the new commit but no built artifacts. The
PM2 process keeps running on stale `.next/` until a manual fix. No `git tag`
of the previous deployable commit before pulling.

**Fix:** Save current commit before pull (`PREV=$(git rev-parse HEAD)`), on
build failure `git reset --hard "$PREV"` then `npm ci && npm run build` to
restore. Document `bash deploy-crialook.sh --rollback` flow.

---

### M-3 — Health-check cron generates a NEW `/root/health-check.sh` on every deploy run
**Severity:** Medium
**Files:** `deploy-crialook.sh:240-254`

The deploy script writes `/root/health-check.sh` with a HEREDOC and adds a
crontab entry. Re-running deploy (e.g., to re-apply config) re-adds the
crontab line — `(crontab -l ... | grep -v health-check; echo "...")` does
strip prior entries, so this is OK. But the script body is ALSO regenerated
unconditionally, breaking any local edits. Also, `/root/health-check.sh`
duplicates `ops/health-check.sh` — split-brain.

**Fix:** Make deploy script use `ops/health-check.sh` directly via cron; remove
the inline HEREDOC.

---

### M-4 — `pm2 startup systemd ... | tail -1 | bash 2>/dev/null || true` can silently fail
**Severity:** Medium
**Files:** `deploy-crialook.sh:138, 146`

If `pm2 startup` doesn't print the install command on the last line (different
PM2 version, locale, error message), `bash` runs the wrong command silently.
After reboot, PM2 doesn't auto-start.

**Fix:** Capture full output, grep for `^sudo`, validate before piping to bash.

---

### M-5 — `nginx-crialook.conf` Brotli stanza fails hard if module unavailable; deploy claims to handle but only via comment
**Severity:** Medium
**Files:** `nginx-crialook.conf:59-72`, `deploy-crialook.sh:163-164`

Deploy script attempts to install Brotli modules and warns on failure but
doesn't strip the `brotli on;` lines from the canonical config. `nginx -t`
will fail; the script doesn't gate the next steps on that. On a fresh distro
without the brotli package, deploy runs to "complete" but Nginx is broken.

**Fix:** Either always install Brotli (require it), or generate the brotli
block conditionally via templating in the deploy script.

---

### M-6 — `nginx-crialook.conf` CSP is `Content-Security-Policy-Report-Only` with no `report-uri` directive
**Severity:** Medium
**Files:** `nginx-crialook.conf:39`

CSP-RO with no report endpoint = silent no-op. You're paying for the header
parse cost with zero observability. When you flip from RO to enforced, you'll
discover violations the hard way.

**Fix:** Add `report-uri https://o<id>.ingest.sentry.io/api/<id>/security/?sentry_key=...`
or `/api/csp-report`. Sentry has a Browser SDK CSP integration.

---

### M-7 — `/api/health` deep check returns DB latency from `start` of request, not from DB call
**Severity:** Medium
**Files:** `campanha-ia/src/app/api/health/route.ts:48-58`

`checks.database.ms = Date.now() - start` (line 58) — but `start` was set at
the top of the function (line 36) BEFORE the auth check, JSON parsing, etc.
So "db latency" includes route overhead. Not a bug, but the metric lies.

**Fix:** `const dbStart = Date.now()` immediately before `await supabase.from(...)`.

---

### M-8 — Editor route bypasses Clerk middleware (correct) but rate-limit shares loginAttempts map with no key namespace at the call site
**Severity:** Medium
**Files:** `campanha-ia/src/lib/rate-limit.ts:108-146`, `campanha-ia/src/app/api/credits/route.ts:50`

`/api/credits` POST uses `key: "credits:${session.userId}"`. Editor uses
`editor-auth:<ip>`. As long as callers prefix their key, no collision. But
nothing enforces this — a future caller could pass `userId` raw and collide
with `credits:userId` if userId was the literal string "credits:abc". Bug-prone.

**Fix:** Add a `namespace` parameter to `checkLoginRateLimit`, prefix internally.

---

### M-9 — `instrumentation.ts` env load — failure aborts boot, but no env loading status logged in production
**Severity:** Medium
**Files:** `campanha-ia/src/instrumentation.ts` (referenced), `campanha-ia/src/lib/env.ts:116-133`

`loadEnv()` throws on missing required envs. Good. But on success, no log line
saying "env loaded, X vars present". Operations team can't quickly verify a
deploy actually had the right env. Add a single log line at boot.

---

### M-10 — `getCurrentUsage` returns the most recent usage row but uses `.single()` which throws if multiple rows match
**Severity:** Medium
**Files:** `campanha-ia/src/lib/db/index.ts:458-473`

`.single()` throws PGRST116 (multi-row) if duplicate. The query orders by
`period_start desc` and limits to 1 — but `single()` on an `lte/gte` filter
that overlaps could in theory match multiple billing periods. With the upsert
in `getOrCreateCurrentUsage`, this should be unique, but the constraint is
required for safety: the code comment at line 528 says "Requer unique constraint
em (store_id, period_start) na tabela" — verify the migration applied this.

**Fix:** Switch to `.maybeSingle()` and explicitly handle multi-row by picking
the latest.

---

### M-11 — Fallback "demo mode" return path skips creating a `campaign` row but DOES try to increment quota
**Severity:** Medium
**Files:** `campanha-ia/src/app/api/campaign/generate/route.ts:350-372`

The demo branch returns mock data with no cost. But the `if (campaignRecord)`
block (line 354-360) calls `incrementCampaignsUsed` if quota wasn't reserved
upfront. Since demo mode runs only when no API key is set (truly demo), this
is harmless in prod. But if a key is removed temporarily for ops, real users
could exhaust their quota on mock data.

**Fix:** Demo mode should NOT increment; it's not a real generation.

---

### M-12 — `addCreditsToStore` derives `period_start/end` from `new Date()` mid-month — credit_purchases periods can mismatch store_usage periods
**Severity:** Medium
**Files:** `campanha-ia/src/lib/db/index.ts:790-799`

Calendar-month period for purchase records, but `updateStorePlan` (line 757)
creates 30-day periods from "now". Mixed semantics → reconciliation queries
that join purchases to usage by period_start will mismatch.

**Fix:** Use one definition of "period" everywhere — either calendar months
or rolling 30 days. Calendar months is simpler for billing reports.

---

### M-13 — `nginx-crialook.conf` — missing `proxy_request_buffering off` for SSE upload
**Severity:** Medium
**Files:** `nginx-crialook.conf:127-144`

The SSE location (`/api/campaign/generate`) sets `proxy_buffering off` for the
RESPONSE side (good — SSE needs that). But the request itself is a multipart
FormData upload (image). Without `proxy_request_buffering off`, Nginx buffers
the full upload to disk before passing to upstream → big latency on the
generation start. Comment in the file says `chunked_transfer_encoding on`,
which is for response.

**Fix:** Add `proxy_request_buffering off;` to the `/api/campaign/generate` block.

---

### M-14 — Sentry `widenClientFileUpload: true` in `next.config.ts` increases bundle/upload time
**Severity:** Medium
**Files:** `campanha-ia/next.config.ts:62`

This setting uploads more chunks (vendor, framework) to Sentry source maps.
Useful for stack-trace fidelity, but inflates CI time. If CI pipeline doesn't
already condition on `silent: !CI`, you end up uploading on every PR.

**Fix:** Verify Sentry config in CI; ensure auth_token is only set on main-branch
deploys, not PR builds.

---

### M-15 — Pipeline `dryRun` flag pattern threaded through 4 sites — easy to miss in future writes
**Severity:** Medium
**Files:** `campanha-ia/src/lib/ai/pipeline.ts:189, 233, 316, 345`, `campanha-ia/src/lib/ai/gemini-vto-generator.ts:69, 453`

Manual gating across 5+ sites. A new fire-and-forget side effect added later
will leak under dryRun. No central policy enforcement (e.g., a "side effect
manager" guarded by dryRun).

**Fix:** Wrap side effects in a helper: `await sideEffect(input, () => ...)`
that no-ops under dryRun. Reduces drift surface.

---

### M-16 — `loadtests/.env.loadtest` is checked in (with content)
**Severity:** Medium
**Files:** `loadtests/.env.loadtest` (file size 3277 bytes)

The `.gitignore` of loadtests is `*.env*` (typical) but the listing shows a
real `.env.loadtest` (3277 bytes) tracked alongside `.env.loadtest.example`
(1210 bytes). If this file contains real Clerk session cookies (per README
"capture cookie Clerk"), it's an account credential leak.

**Repro:** `cat d:/Nova pasta/Agencia-Fashion/loadtests/.env.loadtest` and
inspect for `cookie: __session=...` content. If present, **revoke session
in Clerk Dashboard immediately** and add `.env.loadtest` to `.gitignore`.

---

### M-17 — `nginx-crialook.conf` cache zone in `server` scope vs `http` scope — comment notes "idealmente em http"
**Severity:** Medium
**Files:** `nginx-crialook.conf:7-8`

`limit_req_zone` directives must be in `http` context per Nginx docs. The
comment acknowledges "em http context idealmente, mas funciona em server
scope" — but actually if Nginx ever rejects this layout (config validator
strictness varies by version), the deploy breaks. Plus, the zone is
re-defined per server block; with two server blocks (line 15 and 22), only
the first definition wins and the second is silently ignored. Confusion bait.

**Fix:** Move `limit_req_zone` and `proxy_cache_path` to `/etc/nginx/conf.d/crialook-zones.conf`.

---

### M-18 — `subscription_preapproval` cancel handler doesn't validate event ownership before mutating store
**Severity:** Medium
**Files:** `campanha-ia/src/app/api/webhooks/mercadopago/route.ts:303-307`

The cancel branch updates `stores` with `mercadopago_subscription_id: null`
filtered by `id = storeId` parsed from `external_reference`. If MP ever
sends an event with a tampered `external_reference` that passed signature
(unlikely without secret leak, but defense in depth), this could null another
store's sub ID. The signature already covers `data.id`, but `external_reference`
is a separate field on the resource being looked up.

**Fix:** Cross-check that the subscription's `external_reference` matches the
storeId derived from the event before mutating. If MP rejects the cross-check,
log loudly.

---

## LOW

### L-1 — Comment about photoCount mismatch with task brief
**Severity:** Low
**Files:** `campanha-ia/src/lib/ai/pipeline.ts:96-99`

Pipeline header claims "Gemini 3.1 Pro Analyzer + Gemini VTO ×3" (and the
project README likely says the same), but the actual code generates **1
image** universally (`generateWithGeminiVTO` returns array of size 1, line
408-468). `photoCount` parameter is documented as `@deprecated` with comment
"Param mantido só por compat". This is a doc/code drift — README and architecture
docs should be updated to "1 image, 3 prompts collapsed".

---

### L-2 — Heavy use of `as any` (79 occurrences) concentrates in pipeline + Gemini wrappers
**Severity:** Low
**Files:** Files with most `as any`: `gemini-vto-generator.ts (13)`, `route.ts (12)`, `gemini-error-handler.ts (6)`, etc.

Most are around third-party SDK boundaries (Gemini SDK quirks, Sharp Buffer
casts, `inlineData.mimeType as any`). Acceptable when wrapping unstable APIs,
but several read like "TS complained, I shut it up": e.g.,
`gemini-vto-generator.ts:508, 515` — `mimeType: modelMime as any`. Worth a
sweep with proper unions.

---

### L-3 — Sharp dynamic import inside per-request hot path
**Severity:** Low
**Files:** `campanha-ia/src/app/api/campaign/generate/route.ts:254, 286, 314, 416, 537, 552, 636, 650, 684, 710`

`await import("sharp")` repeatedly per request. Module cache makes subsequent
imports cheap (~ns), but it's noisy and harder to reason about. Same for
`createAdminClient` (imported 8+ times in this one file).

**Fix:** Top-of-file `import sharp from "sharp"` and `import { createAdminClient }
from "@/lib/supabase/admin"`. Bundle size argument doesn't apply server-side.

---

### L-4 — TODO comment with no tracker reference
**Severity:** Low
**Files:** `campanha-ia/src/lib/db/index.ts:380`

`// TODO(regenerate-launch): substituir por lookup real de plano antes de habilitar em prod.`
No issue/ticket linked. Will be lost when feature is enabled. Add link to
`.planning/` doc or close-the-loop in the FEATURE_REGENERATE_CAMPAIGN check.

---

### L-5 — `loadtests/README.md` references metrics from a single point in time as canonical
**Severity:** Low
**Files:** `loadtests/README.md:81-138`

Capacity numbers (693 req/s, p95 2009ms, etc.) will go stale fast. Either
add a "last measured: <date>" note, or move the table into a per-run report
referenced from README.

---

### L-6 — `console.log` chatter inside route handlers (50+ lines per generate request)
**Severity:** Low
**Files:** `campanha-ia/src/app/api/campaign/generate/route.ts` (many sites)

PM2 log rotation handles this, but production logs have lots of `[Generate] 📐`,
`[Pipeline] 🚀` etc. Consider switching to `logger.debug` from `lib/observability.ts`
to allow level filtering in prod.

---

### L-7 — `incrementRegenCount` always tries new RPC then falls back — no feature-detection memoization
**Severity:** Low
**Files:** `campanha-ia/src/lib/db/index.ts:318-351`

Every call attempts the new RPC. If the new RPC isn't deployed (legacy DB),
every regen pays an extra RPC roundtrip + a warn log. Cache the "this DB
doesn't have the new RPC" decision for the process lifetime.

---

### L-8 — Inngest `client.ts` doesn't set `signingKey`
**Severity:** Low
**Files:** `campanha-ia/src/lib/inngest/client.ts:11-14`

Only `eventKey` is set. Production needs both for `serve` to verify incoming
webhook calls from Inngest cloud. The serve handler may pull `INNGEST_SIGNING_KEY`
from env automatically, but explicit is safer.

---

### L-9 — Manifest URL references `crialook.com.br` in apple-icon paths but Android-only per user memory
**Severity:** Low
**Files:** `campanha-ia/src/app/apple-icon.png`, `manifest.ts`

Per memory: "crialook-app é Android-only". Apple icon files (~58KB each: apple-icon.png,
favicon.png, icon.png — all 59334 bytes, suggesting same file copy-pasted)
are dead weight on mobile and serve no purpose. Web app still uses them
in `<head>` for Safari, so keep them in web; just note they're not needed
in the mobile app.

---

### L-10 — `next.config.ts` images config — `qualities: [50, 75, 90]` but no usage of quality prop in components is verified
**Severity:** Low
**Files:** `campanha-ia/next.config.ts:38`

Cosmetic — list these only if `<Image quality={X}>` actually uses them.

---

### L-11 — `subscription_preapproval` switch has `default` that just logs
**Severity:** Low
**Files:** `campanha-ia/src/app/api/webhooks/mercadopago/route.ts:311-313`

Other MP statuses (`pending`, `expired`, `failed`) silently fall through. At
minimum, log them at `warn` level; right now they're at `log` (info) and
indistinguishable from normal traffic.

---

## Cross-cutting findings

### Inconsistent env access patterns
`process.env.X` is still used in many files even though `lib/env.ts` provides
a typed `env.X`. The env.ts file itself acknowledges "Os arquivos legados que
ainda fazem `process.env.X` continuam funcionando; migramos pra `env.X`
gradualmente." Migration is partial — finish it on a sweep.

### Logging conventions are mixed
- Some routes use `logger.info(..., {...})` (good — structured).
- Many use `console.log("[Generate] 🚀 ...")` (unstructured + emojis).
- Some use both in the same file.

Pick one. The `lib/observability.ts` `logger` is the right primary; `console.*`
should be reserved for ops-side scripts.

### Error class conventions
`AITimeoutError` (`with-timeout.ts`) is a real class with `code` and `userMessage`.
But many route handlers throw plain `Error("...")` and rely on `instanceof Error`
checks. The `friendly-error.ts` helper exists but isn't always used. A
`CrialookError` base class with code/userMessage/httpStatus would unify this.

### RLS/SECURITY DEFINER risk
Several RPCs (per migrations: `add_credits_atomic`, `consume_credit_atomic`,
`increment_campaigns_used`, `increment_regen_count`, `decrement_campaigns_used`,
`claim_mini_trial`) are likely `SECURITY DEFINER` (they're called via the
admin client which bypasses RLS anyway, but the RPC itself runs with elevated
privileges). I didn't open every migration, but spot-check `20260424_harden_rpcs_and_constraints.sql`
to verify each enforces ownership inside the function body, not just relies
on caller's `WHERE`. If a future code path calls these from an authenticated
client (anon/auth role), missing input validation in the function bypasses RLS.

### N+1 query smells
- `cron/downgrade-expired/route.ts:72-100` — for each candidate, separate
  `store_usage` query. With N stores, N+1 queries. Fine at small scale (<100
  cancellations/day), bad at growth.
- `listCampaigns` (db/index.ts:607-644) — joins `campaign_scores` and
  `campaign_outputs` in one shot (good), but downstream `getCampaignById`
  reads `*` instead of slim columns.
- `/api/campaign/generate` — multiple `getActiveModel` calls (line 240, 442)
  for the same store within one request. Cache the lookup.

### Missing indexes (inferred)
Heavy queries with no obvious supporting index:
- `credit_purchases.mercadopago_payment_id` — used for idempotency check on
  every webhook. Should be UNIQUE index. Verify migration.
- `plan_payments_applied.payment_id` — same; idempotency check on every plan-payment
  webhook. Should be UNIQUE.
- `mini_trial_uses.clerk_user_id` — counted on every trial-detection branch.
- `subscriptions.purchase_token` — looked up on every RTDN; should be UNIQUE
  index per the comment "UNIQUE, foi gravado no /verify".

### Dead/abandoned code
- `runMockPipeline` (`mock-data.ts`) — only used in demo mode. Consider gating
  via a build-time flag to exclude from prod bundle.
- `FEATURE_REGENERATE_CAMPAIGN` — half-implemented feature gated off; either
  finish it or remove the dead branches.
- v2 legacy fallback in `/api/campaigns/[id]/route.ts` (line 139-166) —
  "v2" pipeline is gone (current is v3/v6/v7); fallback path is dead code
  unless old campaigns still exist with `output.version != 'v3'`.

### Type safety holes
- `errObj.status === 429` after `as Record<string, unknown>` cast (route.ts
  line 865, 885) — `errObj.status` is typed `unknown`, comparison to number
  works but is type-unsafe.
- Many `as Record<string, unknown>` casts on Clerk session claims — wrap once
  in `lib/auth/claims.ts` with a Zod parse.

---

## Reproduction shortcuts (for the high-impact items)

| Finding | Repro |
|---|---|
| C-1 | Trigger Play subscription event, query `stores.plan_id` post-event — should change but doesn't |
| C-2 | Subscribe → wait for first renewal → check `stores.mercadopago_subscription_id` — null after renewal |
| C-3 | Sign up via Clerk → query `stores` row created by webhook — `plan_id IS NULL` |
| C-4 | Cancel sub mid-period → check sub_id is gone → re-subscribe → state inconsistent |
| H-1 | Mock Sonnet to throw inside `.then` chain — pipeline fails despite VTO success |
| H-2 | Start generation, close browser tab, check Sentry/PM2 logs — VTO completes silently |
| H-7 | Race window: cancel + cron + resubscribe within 1 min — observe plan downgrade despite active sub |
| M-16 | `cat loadtests/.env.loadtest` — check for committed Clerk session cookie |

---

## Recommended immediate actions

1. **C-1, C-2, C-4** — hot fix payments path before next high-traffic event.
2. **M-16** — purge committed `.env.loadtest` from git history if it contains
   real Clerk cookies; rotate.
3. **C-3** — add migration / backfill for stores with `plan_id IS NULL`.
4. **H-2** — implement signal honoring in pipeline; this directly cuts API
   spend on user-aborted generations.
5. **H-13** — add judge_pending tracking + reconcile cron; cheap, big win for
   data quality going into Phase 03.

## Recommended next-quarter actions

- Migrate rate-limit storage (Postgres or Redis) for both safety and
  multi-instance future.
- Centralize side-effect gating for `dryRun` (M-15).
- Finish `process.env.X` → `env.X` migration.
- Consolidate logger usage (replace `console.*` in route handlers).
- Add explicit `CrialookError` base class for API error responses.
- Audit each `SECURITY DEFINER` RPC for input validation; document ownership
  enforcement strategy.
- Drop or finish the `FEATURE_REGENERATE_CAMPAIGN` feature.
