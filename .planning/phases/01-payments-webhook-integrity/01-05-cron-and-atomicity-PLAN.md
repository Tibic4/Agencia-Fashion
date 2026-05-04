---
plan_id: 01-05
phase: 1
title: Cron optimistic lock + DB atomicity + fail-closed guard + period reconciliation + failCampaign single-shot
wave: 3
depends_on: [01-01, 01-02, 01-03, 01-04]
files_modified:
  - campanha-ia/src/app/api/cron/downgrade-expired/route.ts
  - campanha-ia/src/lib/db/index.ts
files_modified_optional:
  - campanha-ia/src/app/api/campaign/generate/route.ts
autonomous: true
requirements: [H-7, H-10, H-11, M-11, M-12]
must_haves:
  truths:
    - "cron/downgrade-expired uses optimistic lock via updated_at (D-09) — re-reads row's updated_at inside the loop, UPDATE filters WHERE id = ? AND updated_at = ?, 0 rows affected logs at info level (D-11)"
    - "Cron candidate query filters on subscription_status='cancelled' (NEW) instead of mercadopago_subscription_id IS NULL (OLD) — aligned with C-4 fix in 01-03"
    - "canGenerateCampaign() includes a fail-closed guard: subscription_status='cancelled' AND period_end < today → free-plan limits only (R-01)"
    - "incrementCampaignsUsed, consumeCredit, addCreditsToStore — fallback paths surface RPC errors via captureError + throw (no silent read-modify-write race)"
    - "addCreditsToStore writes period_start = paymentDate, period_end = paymentDate + 30d (rolling-30, D-12) — calendar-month math removed"
    - "failCampaign uses WHERE status = 'processing' single-shot transition (H-10) — second call no-ops + info-logs"
  acceptance:
    - "Concurrent incrementCampaignsUsed (Promise.all of 2 calls) results in count incremented exactly twice (RPC remains atomic; fallback errors loudly)"
    - "Cancel-then-immediate-resubscribe within the same cron window leaves the user on the paid plan (cron observes updated_at change and skips)"
    - "failCampaign called twice writes error_message exactly once (second call updates 0 rows + info-logs)"
    - "Cron skips that observed updated_at-mismatch are logged at info level with reason 'updated_at changed mid-cron' (D-11)"
---

# Plan 01-05: Cron, Atomicity, Fail-Closed Guard, Period Reconciliation, failCampaign

## Objective

The closing wave: harden the read paths (cron + canGenerateCampaign), strip the read-modify-write fallbacks, reconcile period semantics, and make `failCampaign` a single-shot transition.

This plan owns:

- **H-7** — Cron optimistic lock via `updated_at` (D-09 / D-10 / D-11). Now safe because 01-01 wired the trigger.
- **R-01** — Fail-closed guard in `canGenerateCampaign` (NOT `getStorePlanName` — see RESEARCH).
- **H-11 / H-6** — Strip fallback read-modify-write paths from `incrementCampaignsUsed`, `consumeCredit`, `addCreditsToStore`. RPC failure now throws + captureError.
- **M-12** — `addCreditsToStore` switches to rolling-30d period math (D-12 / D-13).
- **H-10** — `failCampaign` becomes a single-shot status transition (R-05).
- **M-11** — Demo mode skips `incrementCampaignsUsed` (small fix in generate route — `files_modified_optional` since this can also live in Phase 2 if scope is contested).

## Truths the executor must respect

- Cron MUST switch its candidate filter from `mercadopago_subscription_id IS NULL` (current) to `subscription_status = 'cancelled'` (new). After 01-03's C-4 fix, sub_id is NOT nulled on cancel — using IS NULL would miss every cancelled store. **The two findings (C-4 and H-7) are coupled.**
- The fail-closed guard in `canGenerateCampaign` is the ONLY redundant guard in this phase. Do NOT add similar guards to `getStorePlanName` (R-01 explicitly rejected).
- Stripping fallback paths means `addCreditsToStore` will throw on RPC failure. The MP webhook path (post-01-03) already wraps `addCreditsToStore` in the outer try/catch that returns 200 + Sentry-captures. So the throw flows correctly. Verify after editing.
- `incrementCampaignsUsed` is called by `/api/campaign/generate` BEFORE the AI pipeline runs (line 197 of `generate/route.ts`). If the RPC throws, the request 5xx's instead of consuming a slot — that's the correct safe behaviour (no cost, no slot consumed).
- `consumeCredit` is called both BEFORE generation (avulso reservation, line 178) AND in refund paths. Throwing means refund failures surface to ops — exactly the behaviour CONTEXT.md prescribes.
- The trigger from 01-01 sets `updated_at = now()` on every UPDATE, so the cron's optimistic lock pattern (`SELECT updated_at`, then `UPDATE WHERE updated_at = ?`) is safe across all writers (including the credit-fallback paths that don't manually set it — they no longer exist after this plan, but the trigger covers any future writers too).

## Tasks

### Task 1: Optimistic-lock cron with updated_at (H-7, D-09, D-11)

<read_first>
- campanha-ia/src/app/api/cron/downgrade-expired/route.ts (full file)
- campanha-ia/src/lib/db/index.ts (updateStorePlan signature after 01-03)
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-09, D-10, D-11)
- .planning/audits/MONOREPO-BUG-BASH.md (H-7)
</read_first>

<action>
Edit `campanha-ia/src/app/api/cron/downgrade-expired/route.ts`. Change the candidate-fetch filter and the per-row update to use the optimistic lock pattern.

Replace the entire `try { ... }` block in the `POST` handler (lines 40-101) with:

```ts
try {
  const supabase = createAdminClient();

  // 1. Encontra plano "gratis"
  const { data: freePlan } = await supabase
    .from("plans")
    .select("id")
    .eq("name", "gratis")
    .maybeSingle();

  if (!freePlan) {
    return NextResponse.json({ error: "Plano 'gratis' não configurado" }, { status: 500 });
  }

  // 2. Lojas candidatas a downgrade:
  //    - subscription_status='cancelled' (NEW: replaces "subscription_id IS NULL" — see C-4 fix in 01-03)
  //    - plan_id != grátis
  // We capture updated_at here for the optimistic lock per-row check.
  const { data: candidates, error: candErr } = await supabase
    .from("stores")
    .select("id, plan_id, name, updated_at")
    .eq("subscription_status", "cancelled")
    .neq("plan_id", freePlan.id);

  if (candErr) throw candErr;
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, downgraded: 0, message: "Nenhuma loja candidata" });
  }

  const today = new Date().toISOString().split("T")[0];
  let downgraded = 0;
  let skippedRace = 0;
  const errors: Array<{ storeId: string; error: string }> = [];

  for (const store of candidates) {
    // Só rebaixar se o período atual já expirou
    const { data: usage } = await supabase
      .from("store_usage")
      .select("period_end")
      .eq("store_id", store.id)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!usage?.period_end || usage.period_end >= today) continue;

    try {
      // D-09: Optimistic lock — UPDATE only if updated_at hasn't changed since
      // we read the candidate. If a renewal webhook bumped updated_at mid-cron,
      // the WHERE matches 0 rows and we skip (info-log per D-11).
      const { data: updated, error: updErr } = await supabase
        .from("stores")
        .update({
          plan_id: freePlan.id,
          subscription_status: "expired",
        })
        .eq("id", store.id)
        .eq("updated_at", store.updated_at)
        .select("id");

      if (updErr) throw updErr;

      if (!updated || updated.length === 0) {
        // D-11: log skip with positive reason
        skippedRace++;
        logger.info("cron_downgrade_skipped_race", {
          store_id: store.id,
          reason: "updated_at changed mid-cron",
        });
      } else {
        logger.info("store_downgraded_to_free", { store_id: store.id, name: store.name });
        downgraded++;
      }
    } catch (e) {
      errors.push({
        storeId: store.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    downgraded,
    skippedRace,
    errors: errors.length,
    candidates: candidates.length,
  });
} catch (e) {
  captureError(e, { route: "/api/cron/downgrade-expired" });
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}
```

Note: the trigger from 01-01 ensures `updated_at = now()` on the UPDATE, so even successful downgrades bump the timestamp — that's fine, the next cron tick won't re-process (because we just set `subscription_status = 'expired'`, removing it from candidates).
</action>

<acceptance_criteria>
- Cron candidate query filters on `.eq("subscription_status", "cancelled")` and `.neq("plan_id", freePlan.id)` (NOT `.is("mercadopago_subscription_id", null)`)
- Cron candidate query SELECTs `updated_at` along with id/plan_id/name
- Per-store UPDATE includes `.eq("updated_at", store.updated_at)` (the optimistic-lock predicate)
- Per-store UPDATE returns 0 rows on race → `skippedRace++` and `logger.info("cron_downgrade_skipped_race", ...)`
- Per-store UPDATE on success sets BOTH `plan_id = freePlan.id` AND `subscription_status: 'expired'`
- Response payload includes `downgraded`, `skippedRace`, `errors`, `candidates`
- Vitest: simulate a candidate where `updated_at` returned by the SELECT differs from what's in DB at UPDATE time → assert `downgraded: 0, skippedRace: 1`
- Vitest: simulate a clean candidate → assert `downgraded: 1` and the UPDATE call includes `subscription_status: 'expired'`
</acceptance_criteria>

---

### Task 2: Fail-closed guard in `canGenerateCampaign` (R-01)

<read_first>
- campanha-ia/src/lib/db/index.ts (lines 580-600 — current canGenerateCampaign)
- campanha-ia/src/lib/db/index.ts (lines 484-557 — getOrCreateCurrentUsage, especially the campaignsLimit derivation logic which we mirror here)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-01 — explains why canGenerateCampaign is the chosen site)
- .planning/codebase/CONCERNS.md §3 (the original "redundant guard" suggestion)
</read_first>

<action>
Edit `campanha-ia/src/lib/db/index.ts`, function `canGenerateCampaign` (lines 580-600). Add a pre-check that reads `subscription_status` + `period_end` and overrides `planLimit` to the free-plan limit if the store is cancelled+expired.

```ts
export async function canGenerateCampaign(storeId: string): Promise<{ allowed: boolean; used: number; limit: number; hasAvulso: boolean }> {
  const supabase = createAdminClient();

  // R-01 fail-closed guard: even if cron is broken, never serve premium quota
  // to a store whose subscription is cancelled AND past period_end. Avulso
  // credits remain valid (lojista paid for them, separate from sub).
  const { data: store } = await supabase
    .from("stores")
    .select("subscription_status, plan_id")
    .eq("id", storeId)
    .single();

  const usage = await getOrCreateCurrentUsage(storeId);
  const credits = await getStoreCredits(storeId);
  const avulso = credits.campaigns || 0;

  const today = new Date().toISOString().split("T")[0];
  const periodExpired = !usage?.period_end || usage.period_end < today;
  const subCancelled = store?.subscription_status === "cancelled" || store?.subscription_status === "expired";

  const used = usage?.campaigns_generated ?? 0;
  let planLimit = usage?.campaigns_limit ?? 0;

  if (subCancelled && periodExpired) {
    // Demote to free-plan limit. Look up "gratis" once to avoid trusting a
    // potentially-stale store_usage.campaigns_limit (which may still reflect
    // the premium plan if cron didn't run yet).
    const { data: freePlan } = await supabase
      .from("plans")
      .select("campaigns_per_month")
      .eq("name", "gratis")
      .single();
    planLimit = freePlan?.campaigns_per_month ?? 0;
    logger.info("can_generate_fail_closed_demote", { storeId, reason: "cancelled_and_expired" });
  }

  const planAllowed = used < planLimit;
  const hasAvulso = avulso > 0;

  return {
    allowed: planAllowed || hasAvulso,
    used,
    limit: planLimit + avulso,
    hasAvulso: !planAllowed && hasAvulso,
  };
}
```

Note: the new function imports `logger` if not already imported. Verify the import exists at the top of `lib/db/index.ts` (likely from `@/lib/observability` — if not, add it).
</action>

<acceptance_criteria>
- `canGenerateCampaign` reads `stores.subscription_status` and `stores.plan_id` once
- Computes `periodExpired = !usage?.period_end || usage.period_end < today`
- Computes `subCancelled = subscription_status in ('cancelled', 'expired')`
- When both `subCancelled && periodExpired`: overrides `planLimit` with the `gratis` plan's `campaigns_per_month`
- When demoting: emits `logger.info("can_generate_fail_closed_demote", ...)` for ops visibility
- Avulso (`hasAvulso`) logic is UNCHANGED — credit packs survive subscription cancel
- `getStorePlanName` is NOT modified in this plan (R-01 — wrong site)
- Vitest: a store with `subscription_status='cancelled'` and `usage.period_end='2025-01-01'` (past) and `usage.campaigns_limit=100` (premium) and `usage.campaigns_generated=10` → `canGenerateCampaign` returns `allowed: based-on-free-plan-limit`, `limit: <free + avulso>`. The premium 100 is overridden.
- Vitest: a store with `subscription_status='active'` and same usage → `canGenerateCampaign` uses the premium limit (100).
- Vitest: a cancelled+expired store with avulso credits → `allowed: true` (avulso path still works)
</acceptance_criteria>

---

### Task 3: Strip read-modify-write fallbacks (H-11, H-6) — `incrementCampaignsUsed`, `consumeCredit`, `addCreditsToStore`

<read_first>
- campanha-ia/src/lib/db/index.ts (lines 559-578 incrementCampaignsUsed, 838-877 consumeCredit, 779-832 addCreditsToStore)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-09 — Option A chosen)
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (verify outer try/catch swallows the new throws → returns 200 + Sentry)
- campanha-ia/src/app/api/campaign/generate/route.ts (verify caller of incrementCampaignsUsed handles 5xx correctly — line 197)
</read_first>

<action>
Three edits in `campanha-ia/src/lib/db/index.ts`. Each strips the fallback read-modify-write block and replaces with `captureError` + `throw`.

**3a — `incrementCampaignsUsed` (lines 560-578):**

```ts
export async function incrementCampaignsUsed(storeId: string) {
  const usage = await getOrCreateCurrentUsage(storeId);
  if (!usage) return;

  const supabase = createAdminClient();

  const { error } = await supabase.rpc("increment_campaigns_used", {
    p_usage_id: usage.id,
  });

  if (error) {
    // H-11 fix: no more read-modify-write fallback (race-condition source).
    // RPC failure is a real ops issue — surface it.
    captureError(new Error(`increment_campaigns_used RPC failed: ${error.message}`), {
      function: "incrementCampaignsUsed",
      storeId,
      usageId: usage.id,
    });
    throw new Error(`increment_campaigns_used failed: ${error.message}`);
  }
}
```

**3b — `consumeCredit` (lines 838-877):**

```ts
export async function consumeCredit(
  storeId: string,
  type: "campaigns" | "models" | "regenerations"
): Promise<boolean> {
  const supabase = createAdminClient();

  const columnMap = {
    campaigns: "credit_campaigns",
    models: "credit_models",
    regenerations: "credit_regenerations",
  };

  const column = columnMap[type];

  const { data, error } = await supabase.rpc("consume_credit_atomic", {
    p_store_id: storeId,
    p_column: column,
  });

  if (error) {
    // H-11 fix: no more read-modify-write fallback. RPC errors are ops-visible.
    captureError(new Error(`consume_credit_atomic RPC failed: ${error.message}`), {
      function: "consumeCredit",
      storeId,
      type,
    });
    throw new Error(`consume_credit_atomic failed: ${error.message}`);
  }

  // RPC returns -1 when there were no credits to consume; >= 0 is the new count.
  if (typeof data === "number" && data === -1) return false;
  console.log(`[Credits] 🔻 -1 ${type} consumido da loja ${storeId} (restam: ${data})`);
  return true;
}
```

**3c — `addCreditsToStore` (lines 779-832):**

```ts
export async function addCreditsToStore(
  storeId: string,
  type: "campaigns" | "models" | "regenerations",
  quantity: number,
  priceBrl: number,
  mpPaymentId: string
) {
  const supabase = createAdminClient();

  // M-12 / D-12: rolling 30 days from payment date (matches MP charge anniversary).
  // OLD: calendar-month math (period_start = first of current month) — caused
  // reconcile join mismatches with store_usage.period_start (rolling-30).
  const paymentDate = new Date();
  const periodStart = paymentDate.toISOString().split("T")[0];
  const periodEnd = new Date(paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // 1. Registrar a compra
  await supabase.from("credit_purchases").insert({
    store_id: storeId,
    type,
    quantity,
    price_brl: priceBrl,
    mercadopago_payment_id: mpPaymentId,
    period_start: periodStart,
    period_end: periodEnd,
    consumed: 0,
  });

  // 2. Incrementar créditos na loja (atômico via RPC)
  const columnMap = {
    campaigns: "credit_campaigns",
    models: "credit_models",
    regenerations: "credit_regenerations",
  };
  const column = columnMap[type];

  const { error: rpcError } = await supabase.rpc("add_credits_atomic", {
    p_store_id: storeId,
    p_column: column,
    p_quantity: quantity,
  });

  if (rpcError) {
    // H-6/H-11 fix: no more read-modify-write fallback. RPC errors are ops-visible.
    // Note: the credit_purchases row is already inserted at this point — that's the
    // historical "purchase log without credits granted" failure mode. Reconcile
    // cron is parking-lot per CONTEXT.md (parking-lot, not blocking M1).
    captureError(new Error(`add_credits_atomic RPC failed: ${rpcError.message}`), {
      function: "addCreditsToStore",
      storeId,
      type,
      quantity,
      mpPaymentId,
    });
    throw new Error(`add_credits_atomic failed: ${rpcError.message}`);
  }

  console.log(`[Credits] ✅ +${quantity} ${type} adicionados à loja ${storeId}`);
}
```

Verify the import at the top of `lib/db/index.ts` includes `captureError` from `@/lib/observability`. If absent, add it.
</action>

<acceptance_criteria>
- `incrementCampaignsUsed`, `consumeCredit`, `addCreditsToStore`: each function NO LONGER contains a `.from("stores").update({ [column]: currentValue +/- 1 })` or `.from("store_usage").update({ campaigns_generated: ... })` fallback path
- Each function calls `captureError(...)` + `throw new Error(...)` on RPC error
- `addCreditsToStore` period math is `payment + 30d` (rolling), NOT `getMonth(), 1` / `getMonth() + 1, 0` (calendar)
- `consumeCredit` correctly interprets RPC return value `-1` as "no credits to consume" → returns `false`
- Static check: `grep -n "currentValue" campanha-ia/src/lib/db/index.ts` returns 0 matches
- Static check: `grep -n "new Date(now.getFullYear(), now.getMonth()" campanha-ia/src/lib/db/index.ts` returns 0 matches in `addCreditsToStore` (the `createStore` line 76-78 still uses calendar — that's the FREE plan onboarding path, M-12 only impacts `addCreditsToStore`'s purchase records per CONTEXT D-13)
- Vitest: mock `supabase.rpc("add_credits_atomic")` to return `{ error: ... }` → assert `addCreditsToStore` throws + Sentry-captures
- Vitest: parallel `incrementCampaignsUsed` calls (Promise.all of 2) — when RPC succeeds for both, count goes from N → N+2 (RPC is atomic; no race)
</acceptance_criteria>

---

### Task 4: `failCampaign` single-shot status transition (H-10)

<read_first>
- campanha-ia/src/lib/db/index.ts (lines 440-451 — current failCampaign)
- campanha-ia/src/app/api/campaign/generate/route.ts (lines 531-571, 631-671, 787-790 — three callers)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-05)
</read_first>

<action>
Edit `campanha-ia/src/lib/db/index.ts`, function `failCampaign` (lines 441-451). Add the `.eq("status", "processing")` filter and check the returned row count to detect no-op.

```ts
export async function failCampaign(campaignId: string, errorMessage: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({
      status: "failed",
      error_message: errorMessage,
      pipeline_completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("status", "processing") // H-10: single-shot — first caller wins, subsequent no-op
    .select("id");

  if (error) {
    captureError(error, { function: "failCampaign", campaignId, errorMessage });
    throw error;
  }

  if (!data || data.length === 0) {
    // Another path already terminated the campaign — that's OK and expected.
    logger.info("fail_campaign_noop", {
      campaign_id: campaignId,
      reason: "status not processing (already terminated)",
    });
  }
}
```

No changes needed at the three call sites in `generate/route.ts` — they keep calling `await failCampaign(...)`. The single-shot guarantee is now enforced inside the function.
</action>

<acceptance_criteria>
- `failCampaign` UPDATE includes `.eq("status", "processing")`
- `failCampaign` UPDATE includes `.select("id")` to detect no-op (zero rows affected)
- On no-op: `logger.info("fail_campaign_noop", ...)` is emitted; the function returns normally (does NOT throw)
- On DB error: `captureError` + throw
- Vitest: call `failCampaign(id, "first")` then `failCampaign(id, "second")` against a campaign that goes from `processing → failed` after the first call. Mock supabase: first UPDATE returns `data: [{id}]`, second UPDATE returns `data: []`. Assert `error_message` was set to "first" only (the second call no-ops at the DB layer).
- Vitest: confirm `logger.info("fail_campaign_noop", ...)` was called once (after the second `failCampaign`)
</acceptance_criteria>

---

### Task 5 (optional, scoped against M-11): Demo mode skips `incrementCampaignsUsed` in generate route

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts (lines 350-372 — demo branch)
- .planning/audits/MONOREPO-BUG-BASH.md (M-11)
- .planning/PHASE-DETAILS.md §"Phase 2" — confirm M-11 is listed under Phase 2's findings (it IS — but Phase 1 also lists M-11 in its findings_addressed). Resolution: this fix is small (~3 lines), keep it here for cohesion since CONTEXT.md scope-in line includes "Make `failCampaign` a single-shot status transition" alongside.
</read_first>

<action>
Edit `campanha-ia/src/app/api/campaign/generate/route.ts` around line 354-360 (the demo-mode branch). Confirm the `incrementCampaignsUsed` call inside `if (campaignRecord)` is gated on "not demo mode." If the route's `IS_DEMO_MODE` check happens earlier, skip that branch entirely in demo mode.

The minimum-deviation fix:

```ts
// Around the existing demo-mode block — find the early-return that emits mock data.
// Right BEFORE that early-return, ensure NO incrementCampaignsUsed has been called
// for the demo path. The reservation logic at lines 195-200 (planSlotReserved) needs
// to be guarded by `!isDemoMode`.

// Locate the existing isDemoMode flag (likely `IS_DEMO_MODE` env or `!process.env.GEMINI_API_KEY`).
// Add the guard:

if (store && !isDemoMode) {
  const quota = await canGenerateCampaign(store.id);
  // ... existing reservation logic ...
} else if (store && isDemoMode) {
  console.log("[Generate] 🧪 demo mode — skipping quota reservation");
}
```

Verify by tracing: in demo mode, no `incrementCampaignsUsed`, no `consumeCredit`, no `failCampaign` is called.

If the demo-mode boundary is unclear, mark the task `needs-research` with the question "Where exactly is the demo-mode early-return in generate/route.ts and how does it interact with the upstream quota reservation?"
</action>

<acceptance_criteria>
- In demo mode (`IS_DEMO_MODE === true` OR no Gemini key), the route does NOT call `incrementCampaignsUsed` or `consumeCredit` for the demo response
- Production mode (real keys) is UNCHANGED — quota reservation runs as before
- Vitest (or manual smoke): set `IS_DEMO_MODE = true`, fire generate request, query `store_usage.campaigns_generated` → unchanged
- If executor cannot determine the demo-mode boundary cleanly, this task is marked `needs-research` and the rest of the plan ships without it (M-11 is Medium and listed under Phase 2 — acceptable to defer)
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` in `campanha-ia/` passes.
2. `npx vitest run src/lib/db src/app/api/cron src/app/api/webhooks` exits 0.
3. Static check: `grep -n "currentValue" campanha-ia/src/lib/db/index.ts` returns 0 matches.
4. Static check: `grep -n "is(\"mercadopago_subscription_id\", null)" campanha-ia/src/app/api/cron/downgrade-expired/route.ts` returns 0 matches.
5. Static check: `grep -n "subscription_status.*cancelled" campanha-ia/src/app/api/cron/downgrade-expired/route.ts` returns ≥ 1 match.
6. Integration test (manual or scripted in staging): cancel a sub via MP webhook → wait for next cron tick → query store, assert `subscription_status='expired'` and `plan_id = (free)`. Mid-test, fire a renewal webhook AFTER the cron's SELECT but BEFORE its UPDATE → assert cron logs `cron_downgrade_skipped_race` and store retains the renewal's plan.

## Cross-cutting must_haves (this plan + entire phase)

```yaml
truths:
  - cron_uses_optimistic_lock_via_updated_at
  - cron_filters_subscription_status_cancelled_not_sub_id_null
  - cangenerate_fail_closed_when_cancelled_and_expired
  - rpc_fallbacks_throw_with_capture_no_silent_race
  - addcreditstostore_uses_rolling_30d_period_math
  - failcampaign_single_shot_via_where_status_processing
  - all_phase_1_changes_compose_with_01_01_through_01_04
acceptance:
  - tsc_noemit_passes
  - vitest_db_cron_tests_pass
  - manual_smoke_cancel_resub_window_safe
  - phase_success_criteria_4_5_6_demonstrably_met
```
