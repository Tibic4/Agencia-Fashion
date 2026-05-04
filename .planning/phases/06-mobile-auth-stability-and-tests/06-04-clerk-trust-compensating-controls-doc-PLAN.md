---
plan_id: 06-04
phase: 6
title: Audit + document the 7 server-side compensating controls (CRIALOOK-PLAY-READINESS §4); confirm each via backend code refs
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md
autonomous: true
requirements: ["D-12", "D-13", "D-14", "F-PLAY-READINESS-§4"]
must_haves:
  truths:
    - "doc enumerates all 7 compensating controls from CRIALOOK-PLAY-READINESS.md §4 (lines 188-194) verbatim or paraphrased"
    - "each control has a status field: LIVE (with backend path:line), PARTIAL (with gap description), or MISSING (with owner-action callout)"
    - "doc confirms control 1 (JWT signature validation) — backend uses @clerk/nextjs/server `auth()` which validates against JWKS implicitly"
    - "doc confirms control 6 (push-token replay) — campanha-ia/src/app/api/store/push-token/route.ts:31 calls auth() and rejects without userId"
    - "doc confirms control 7 (Clerk webhook svix signature) — campanha-ia/src/app/api/webhooks/clerk/route.ts:42-50 verifies svix-id/timestamp/signature"
    - "doc surfaces control 3 (obfuscatedAccountIdAndroid hash binding) as MISSING in backend — lib/billing.ts:108-110 PRODUCES the hash but campanha-ia/src/app/api/billing/verify/route.ts does NOT validate it. owner-action: true callout"
    - "doc lists last-verified date and owner per row (D-13)"
    - "doc is referenced as the pre-flight checklist input in plan 06-05 (re-enable runbook)"
  acceptance:
    - "test -f crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md exits 0"
    - "wc -l crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md returns 60 or more"
    - "grep -c '^### Control [1-7]' crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md returns exactly 7"
    - "grep -ic 'MISSING\\|owner-action' crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md returns at least 1 (control 3 gap surfaced)"
    - "grep -c 'campanha-ia/src/app/api' crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md returns at least 4 (real backend refs)"
---

# Plan 06-04: Server-side compensating controls audit doc

## Objective

Per D-12 / D-13 / D-14, audit the backend code (`campanha-ia/src/app/api/`) for each of the 7 compensating controls listed in `.planning/audits/CRIALOOK-PLAY-READINESS.md` §4 (lines 185-194). For each control:

- Confirm presence with a backend `path:line` reference, OR
- Mark as MISSING and surface as `owner-action: true` callout for backend fix.

The output doc lives at `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md` and becomes the **pre-flight checklist input** for the Clerk Client Trust re-enable runbook (plan 06-05). Per D-14, gaps must be surfaced — NOT silently documented as "live".

**Pre-research finding from plan-phase research:** Control 3 (`obfuscatedAccountIdAndroid` hash binding) is a confirmed gap. The mobile app produces the hash (`crialook-app/lib/billing.ts:108-110`), but the backend route `campanha-ia/src/app/api/billing/verify/route.ts` does NOT validate it against `SHA256(currentClerkUserId)`. This MUST be flagged as MISSING with an owner-action callout for the backend team.

## Truths the executor must respect

- The doc lives at `crialook-app/docs/` because the mobile app is the consumer of these guarantees and the audit lives where the consumer can find it. Backend team gets the same doc as the source-of-truth for what mobile relies on.
- Per D-14: NEVER mark a control as LIVE without a backend `path:line` reference. If you can't find the code, mark MISSING (or PARTIAL with explicit gap description). Silent assumptions are forbidden.
- Per D-13: each row needs `description / code ref / last-verified date / owner`. The "owner" field is `backend` (campanha-ia team) for all 7 — this doc is mobile-side documentation OF backend behavior.
- The 7 controls per CRIALOOK-PLAY-READINESS.md §4:188-194:
  1. Strict JWT validation on every request (signature, iss, aud, exp, nbf)
  2. Per-user rate limiting on `/billing/verify` and `/billing/restore`
  3. Hash-bound purchase verification (`obfuscatedAccountIdAndroid` === SHA256(userId).slice(0,64))
  4. Per-user generation quota enforcement server-side
  5. No client-emittable plan/tier flags
  6. Push-token replay protection (push-token tied to JWT user ID server-side)
  7. Webhook signature on Clerk webhooks (Svix verification)
- This plan does NOT modify any backend code. If a control is MISSING, the doc surfaces it for owner-action; the actual backend fix is owner's responsibility (out-of-scope for the mobile-track plan).

## Tasks

### Task 1: Enumerate the 7 controls verbatim from the audit

<read_first>
- .planning/audits/CRIALOOK-PLAY-READINESS.md (focus lines 185-194 — the numbered list of compensating controls)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-12, D-13, D-14)
</read_first>

<action>
Note for yourself the exact wording of each of the 7 controls. The doc you write next must paraphrase them faithfully (don't drop "iss/aud/exp/nbf" from control 1 etc.).
</action>

### Task 2: Audit each control against backend code

<read_first>
For each control, grep / read the relevant backend file:

- **Control 1 (JWT validation):**
  `campanha-ia/src/app/api/billing/verify/route.ts:41` (and many others) — `const { userId } = await auth();` from `@clerk/nextjs/server`. The Clerk server SDK validates JWT signature against JWKS, checks iss/aud/exp/nbf internally — that's literally what `auth()` does. Confirms LIVE.

- **Control 2 (Per-user rate limit on /billing/verify, /billing/restore):**
  ```bash
  grep -rn 'rateLimit\|tokenBucket\|@upstash\|consumeToken' campanha-ia/src/app/api/billing/ campanha-ia/src/lib/rate-limit*.ts 2>/dev/null
  ```
  Pre-research found: `campanha-ia/src/lib/rate-limit-pg.ts` and `campanha-ia/src/lib/rate-limit.ts` exist. Check whether `/billing/verify` and `/billing/restore` route handlers actually CALL the rate limiter. Read both route.ts files to confirm. Mark LIVE / PARTIAL / MISSING with refs.

- **Control 3 (obfuscatedAccountIdAndroid hash binding):**
  Pre-research confirmed: mobile-side is `crialook-app/lib/billing.ts:108-110`. Backend `campanha-ia/src/app/api/billing/verify/route.ts:39-100` reads `body.purchaseToken` and `body.sku` but does NOT extract `obfuscatedAccountIdAndroid` from the Google Play API response and compare it to `SHA256(userId)`. **MISSING — owner-action.**

- **Control 4 (Per-user generation quota server-side):**
  ```bash
  grep -rn 'campaigns_generated\|consumeCredit\|incrementCampaignsUsed' campanha-ia/src/app/api/campaign/ campanha-ia/src/lib/db.ts 2>/dev/null | head -20
  ```
  Confirm the campaign generate route enforces quota server-side (does NOT trust client's `campaignsLeft` UI value).

- **Control 5 (No client-emittable plan/tier flags):**
  ```bash
  grep -rn 'plan_id\|plan:\|tier:' campanha-ia/src/app/api/store/ 2>/dev/null | head -20
  ```
  Confirm store routes (PATCH, PUT) do NOT accept `plan` or `tier` from request body. If they do, MISSING.

- **Control 6 (Push-token replay):**
  Pre-research confirmed: `campanha-ia/src/app/api/store/push-token/route.ts:31` calls `auth()` and at line 32-34 returns 401 if no userId. The token is then upserted with `clerk_user_id: userId` (line 67) — server-derived, not client-supplied. Confirms LIVE.

- **Control 7 (Clerk webhook Svix signature):**
  Pre-research confirmed: `campanha-ia/src/app/api/webhooks/clerk/route.ts:42-50` verifies the svix-id, svix-timestamp, svix-signature headers against the webhook secret. Returns false (=> 401 upstream) if any header missing or signature mismatch. Confirms LIVE.
</read_first>

<action>
For each control, gather the exact `path:line` reference (re-grep if your pre-research lines drifted) and the LIVE / PARTIAL / MISSING verdict.
</action>

### Task 3: Write `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md`

<read_first>
- (re-uses files from Tasks 1 + 2)
</read_first>

<action>
Create `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md` with EXACTLY this structure:

```markdown
# Clerk Client Trust — Server-Side Compensating Controls

**Last verified:** [today's date]
**Audit owner:** Phase 06 (Mobile Auth Stability & Tests)
**Re-verification cadence:** before each Clerk Client Trust re-enable attempt (per `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` pre-flight)

## Why this doc exists

Per `MEMORY.md` `project_clerk_client_trust.md`, Clerk Client Trust is intentionally OFF in production to pass Play Store review. This trades ~100-400ms per `getToken()` for an explicit "client claims are not trusted" posture.

The 7 server-side compensating controls below MUST remain LIVE while Client Trust is OFF. They are the security floor — not optional. When Client Trust is eventually re-enabled (post-Play approval, see runbook), these controls stay; they are the security boundary, Client Trust is the perf optimization on top.

This doc is the **pre-flight checklist** for the re-enable runbook. Each control must be re-verified via the listed `path:line` ref before flipping Client Trust on.

## Controls

### Control 1 — Strict JWT validation on every request

- **What:** Verify Clerk JWT signature against JWKS, check `iss`, `aud`, `exp`, `nbf`. Reject on any mismatch with HTTP 401.
- **Backend ref:** `campanha-ia/src/app/api/billing/verify/route.ts:41` (and every other authed route) — `const { userId } = await auth();` from `@clerk/nextjs/server`. The Clerk server SDK validates signature against Clerk JWKS and enforces standard claim checks internally.
- **Status:** LIVE
- **Owner:** backend (campanha-ia)
- **Last verified:** [today's date]

### Control 2 — Per-user rate limiting on /billing/verify and /billing/restore

- **What:** Prevent replay of leaked purchase tokens. Critical because the app trusts the server to verify (see `crialook-app/lib/billing.ts:128-131`).
- **Backend ref:** [fill in based on Task 2 grep — e.g. `campanha-ia/src/lib/rate-limit-pg.ts` infra exists; confirm `/billing/verify/route.ts` and `/billing/restore/route.ts` actually call into it. If they don't, mark PARTIAL or MISSING.]
- **Status:** [LIVE | PARTIAL | MISSING — based on Task 2]
- **Owner:** backend
- **Last verified:** [today's date]

### Control 3 — Hash-bound purchase verification (obfuscatedAccountIdAndroid)

- **What:** Backend MUST check `obfuscatedAccountIdAndroid` from the Google Play API response === `SHA256(currentClerkUserId).slice(0,64)`. Mobile produces it (`crialook-app/lib/billing.ts:108-110`). Without backend validation, a captured `purchaseToken` can be replayed by another user.
- **Backend ref:** `campanha-ia/src/app/api/billing/verify/route.ts:39-100` reads `body.purchaseToken` and `body.sku`, calls `verifySubscription`, but does NOT extract the `obfuscatedAccountIdAndroid` field from the Google Play API response and does NOT compare it to `SHA256(userId)`.
- **Status:** **MISSING**
- **Owner:** backend — **owner-action required**
- **Recommended fix:** In `campanha-ia/src/app/api/billing/verify/route.ts`, after `const status = await verifySubscription(sku, purchaseToken);` (line ~73), extract `status.obfuscatedExternalAccountId` (Google Play's field name) and verify it matches `crypto.createHash('sha256').update(userId).digest('hex').slice(0,64)`. Reject with 403 on mismatch.
- **Last verified:** [today's date]

### Control 4 — Per-user generation quota enforcement server-side

- **What:** Frontend shows quota UI but the source of truth is the backend; the JWT `sub` is the only trustworthy identity claim.
- **Backend ref:** [fill in from Task 2 grep — confirm `campaign/generate` route checks server-side quota; if only the client checks, mark MISSING]
- **Status:** [LIVE | MISSING — based on Task 2]
- **Owner:** backend
- **Last verified:** [today's date]

### Control 5 — No client-emittable plan/tier flags

- **What:** The user's plan tier must be derived from `/billing/verify` results stored server-side, never from client-supplied JSON.
- **Backend ref:** [fill in from Task 2 grep — confirm `/store` PATCH/PUT routes do NOT accept `plan` or `tier` from request body]
- **Status:** [LIVE | MISSING — based on Task 2]
- **Owner:** backend
- **Last verified:** [today's date]

### Control 6 — Push-token replay protection

- **What:** `apiPost('/store/push-token', { token })` MUST be tied to the JWT user ID server-side; never accept tokens without auth.
- **Backend ref:** `campanha-ia/src/app/api/store/push-token/route.ts:31` calls `auth()`; line 32-34 returns 401 if no userId; line 67 upserts with `clerk_user_id: userId` (server-derived, not from request body).
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** [today's date]

### Control 7 — Webhook signature on Clerk webhooks

- **What:** Backend creates store-shadow on Clerk `user.created` webhook; webhook MUST validate Svix signature, otherwise an attacker can forge "user created" events.
- **Backend ref:** `campanha-ia/src/app/api/webhooks/clerk/route.ts:42-50` verifies `svix-id`, `svix-timestamp`, `svix-signature` headers against the webhook secret. Returns false (=> 401 upstream) if any header missing or HMAC mismatch.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** [today's date]

## Re-verification protocol

Before re-enabling Clerk Client Trust (per `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md`):

1. Re-walk each control above. Confirm the `path:line` ref still resolves to the same defensive code (refactor drift can move things).
2. For any control marked MISSING or PARTIAL, the gap MUST be closed in backend BEFORE flipping Client Trust on. Reopening Client Trust without these controls re-introduces the (already-mitigated) attack surface.
3. Update the "Last verified" date on each row.
4. Get written sign-off from the backend team on the row deltas.

## References

- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §4 (compensating controls source)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §11 (re-enable plan)
- `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` (consumer of this checklist — see plan 06-05)
- `MEMORY.md` `project_clerk_client_trust.md`
- `crialook-app/lib/auth.tsx:38-43` (the inline comment block explaining why Client Trust is off)
- `crialook-app/lib/billing.ts:108-110` (where mobile produces `obfuscatedAccountIdAndroid` for control 3)
```

Fill in the `[…]` placeholders with the actual verdicts and refs gathered in Task 2. Date is today (2026-05-04 or current).
</action>

<verify>
```bash
test -f crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md && echo "OK"
wc -l crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md
# Expect: 60+

grep -c '^### Control ' crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md
# Expect: 7

grep -i 'MISSING\|owner-action' crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md
# Expect: at least 1 hit (control 3 — obfuscatedAccountIdAndroid)

grep -c 'campanha-ia/src/app/api' crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md
# Expect: at least 4 backend refs
```
</verify>

## Owner-action callouts surfaced by this plan

Per D-14, the following gaps were found and require backend (campanha-ia) fixes BEFORE the Clerk Client Trust re-enable runbook can be executed:

1. **Control 3 (obfuscatedAccountIdAndroid validation):** Backend `/billing/verify/route.ts` does NOT validate the hash. Owner files a backend ticket; fix is ~10 lines in route handler.
2. **Any other gaps surfaced by Task 2 grep.** Document all of them.

These are NOT blockers for Phase 06 completion (this plan is doc-only). They are blockers for the eventual Client Trust re-enable, which is out of M1.

## Files modified

- `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md` (NEW)

## Why this matters (risk if skipped)

If this audit is skipped and Client Trust is later re-enabled (post-Play) with control 3 still missing, the system reverts to a state where a captured Google Play purchaseToken can be replayed by any user — the OAuth identity is no longer cryptographically bound to the purchase. This is exactly the attack surface that "Client Trust off" was masking. The doc + the gap callout is the difference between a knowable-risk production state and a silently-broken one.
