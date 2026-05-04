# Phase 1: Payments Webhook Integrity — Research

**Date:** 2026-05-03
**Mode:** Orchestrator-as-researcher (no Task() subagent harness available — gsd-sdk lacks `query` sub-commands; researcher work performed inline against the codebase)
**Source decisions:** see `01-CONTEXT.md` (D-01 to D-14)

---

## R-01 Resolution: Fail-Closed Guard Insertion Site

**Question (from CONTEXT.md):** Should the redundant fail-closed guard live in `getStorePlanName()` or `canGenerateCampaign()`?

### Call-site inventory

`getStorePlanName(storeId)` (`campanha-ia/src/lib/db/index.ts:248-259`)
- `app/api/store/usage/route.ts:27` — UI quota panel ("X/Y campanhas usadas this month")
- `app/api/store/onboarding/route.ts:93` — initial onboarding plan readout
- `app/api/campaigns/route.ts:26` — drives `historyDays` for `listCampaigns()`
- `app/api/model/list/route.ts:27` — drives `getModelLimitForPlan()` for the model picker
- `app/api/model/create/route.ts:39` — gate for "can create another model" before consuming a model credit

`canGenerateCampaign(storeId)` (`campanha-ia/src/lib/db/index.ts:581-600`)
- `app/api/campaign/generate/route.ts:164` — **the only call site**, gates the entire generation pipeline

### Behavioural difference

- `getStorePlanName()` returns a string used for **UI display** and to derive **per-plan limits** (model count, history days). Demoting a stale-cancelled store here changes how its UI looks and how many *models* it can keep — but does **not** stop a generation directly (it indirectly tightens limits, but the generate route uses `canGenerateCampaign` for the actual gate).
- `canGenerateCampaign()` returns the **boolean gate** the generate route reads. Demoting here directly stops the only money-burning call (Gemini VTO ~R$2.85/call, Sonnet, judge) when cron is broken AND the user is past `period_end`.

### Recommendation: insert the fail-closed guard in **`canGenerateCampaign()`**

**Rationale:**

1. **Money-axis blast radius matches the bug we are protecting against.** CONCERNS §3 frames the risk as "if `cron/downgrade-expired` is broken, cancelled users keep premium access indefinitely." "Premium access" in this app means "the ability to call `/api/campaign/generate` against premium quota." Putting the guard at the generate gate hits the exact failure mode at its money-burn surface.
2. **One call site, one decision, zero UI churn.** `canGenerateCampaign` has exactly one caller (`generate/route.ts:164`). The guard ships with one read and one decision — no risk of the model picker UI flipping mid-cycle when a sub expires at midnight.
3. **`getStorePlanName` is read on every dashboard render** (`store/usage/route.ts`, `model/list/route.ts`). Demoting there means the UI can flicker between "Pro" and "Free" if the cron runs mid-session, which produces support tickets ("my plan changed without me cancelling"). The UI's plan label should follow `stores.plan_id` directly — that's the lojista's contracted state. The *quota gate* is what should fail closed.
4. **`canGenerateCampaign` already does the work needed.** It already calls `getOrCreateCurrentUsage()` (which returns `period_end`) and reads the store row implicitly. We add one column to its store-row read (`subscription_status` + `mercadopago_subscription_id`) and one short-circuit before computing `planAllowed`.

### Implementation shape (for the planner)

In `canGenerateCampaign(storeId)`:

```ts
// Fail-closed guard: cancelled subscription past period_end → free tier only
const { data: store } = await supabase
  .from("stores")
  .select("subscription_status, mercadopago_subscription_id, plan_id")
  .eq("id", storeId)
  .single();
const usage = await getOrCreateCurrentUsage(storeId);
const today = new Date().toISOString().split("T")[0];
const periodExpired = usage?.period_end ? usage.period_end < today : true;
const subCancelled =
  store?.subscription_status === "cancelled" ||
  store?.subscription_status === "expired" ||
  store?.mercadopago_subscription_id == null; // belt+suspenders during D-04 transition

if (subCancelled && periodExpired) {
  // Treat as free-plan quota only — ignore the (premium) campaigns_limit on store_usage.
  // Avulso credits remain valid (lojista paid for them, separate from sub).
  // ... fall through to free-plan limit calculation
}
```

The existing `addCreditsToStore` and `consumeCredit` paths for avulso credits stay intact — credit packs are a separate purchase from the subscription and must not be invalidated by sub status.

### Out of scope (per CONTEXT deferred)

- Refactoring `getStorePlanName` itself (parking lot per CONTEXT deferred ¶5).
- Demoting `getStorePlanName` based on subscription status — see point 3 above (deliberate non-decision; UI follows contracted plan, gate follows fail-closed).

---

## R-02 (Surfaced): `stores.updated_at` is NOT trigger-driven — D-10 needs a planner action

**Discovery:** `update_updated_at_column()` exists in `00000000000000_baseline.sql:576-586` but **no `CREATE TRIGGER` wires it to the `stores` table.** Searching all migrations: only `20260427_subscriptions.sql:54` wires its own trigger (`set_subscriptions_updated_at`) on `subscriptions`. The `stores.updated_at` column has `DEFAULT now()` for INSERT but is never auto-updated on UPDATE.

**Concrete writers that DO set `updated_at` manually** (grep `from("stores").update`):
- `webhooks/mercadopago/route.ts:236, 286, 303` ✓
- `subscription/cancel/route.ts:58` ✓ (verified: includes `updated_at: new Date().toISOString()`)
- `checkout/route.ts:112` ✓
- `lib/db/index.ts:732` (`updateStorePlan`) ✓
- `cron/downgrade-expired/route.ts:89` ✓

**Concrete writers that do NOT set `updated_at`** (gap):
- `lib/db/index.ts:825-828` (`addCreditsToStore` fallback) — credit increment without `updated_at`
- `lib/db/index.ts:867` (`consumeCredit` fallback) — credit decrement without `updated_at`
- `app/api/campaign/generate/route.ts:809` (refund branch) — credit increment without `updated_at`
- `lib/db/index.ts:230-244` (`setActiveModel`) — touches `store_models`, not `stores`, so OK
- All `models` and `regenerations` credit paths via the same fallback functions — same gap

**Impact on D-09 / D-10:** If we rely on `updated_at` as the optimistic-lock primitive for the cron, *and* a credit-grant path runs between cron's SELECT and UPDATE *without* bumping `updated_at`, the cron's `WHERE updated_at = ?` still matches and clobbers the (possibly fine) row. In practice the affected paths only modify credit columns and do not touch `plan_id`, so the data outcome is mostly safe — but the invariant we promised in CONTEXT.md ("trust that `updated_at` is reliably set by all `UPDATE stores …` paths") does not hold.

**Recommendation:** Add a `BEFORE UPDATE` trigger on `stores` that calls `update_updated_at_column()`. Migration is non-blocking (`CREATE TRIGGER` is fast on Postgres; doesn't lock data). This makes D-09 robust without auditing every future writer. CONTEXT.md D-10 explicitly chose `updated_at` over a `version` column "to avoid touching every writer" — adding the trigger is the cheap path that fulfills that promise.

This is **not a deviation from CONTEXT** — it's the missing implementation step that D-10 implicitly requires. The planner must include this trigger migration in the schema plan.

---

## R-03: `webhook_events` Dedup Pattern (D-05 / D-06 / D-07)

### Schema (locked by D-05)

```sql
CREATE TABLE public.webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB,
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, event_id)
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role bypass-RLS can read/write
COMMENT ON TABLE public.webhook_events IS 'Provider+event_id dedup for MP / Clerk / Google Play RTDN. Service-role-only writes.';
```

RLS choice matches the `push_tokens` / `subscriptions` pattern in `20260427_*.sql`: enable RLS, write *no* policies, document service-role-only access.

### Helper vs. inline (Claude's discretion per CONTEXT)

**Recommendation: extract a `dedupWebhook(provider, eventId, payload)` helper.** Three handlers (MP, Clerk, Google Play RTDN) all need the same pattern; inlining triples the surface area for bugs. The helper returns `{ duplicate: boolean, processed: boolean }`:

```ts
// lib/webhooks/dedup.ts
export async function dedupWebhook(provider: 'mp' | 'clerk' | 'rtdn', eventId: string, payload: unknown): Promise<{ duplicate: boolean }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("webhook_events")
    .insert({ provider, event_id: eventId, payload });
  if (error?.code === "23505") return { duplicate: true }; // unique violation
  if (error) throw error;
  return { duplicate: false };
}

export async function markWebhookProcessed(provider: string, eventId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_id", eventId);
}
```

### Per-handler event_id sourcing

| Provider  | event_id source                                    | Notes |
|-----------|----------------------------------------------------|-------|
| MP        | `x-request-id` header (verified before signature)  | Already used in HMAC; rejecting empty per H-14 fix is in this phase |
| Clerk     | `svix-id` header                                   | Already required by signature verifier |
| Google Play RTDN | Pub/Sub `messageId` from JWT envelope       | Pub/Sub guarantees per-subscription uniqueness |

### Insertion ordering (per CONTEXT D-06)

`webhook_events` INSERT goes **after** signature/JWT verification, **before** any business logic. Pattern:

```ts
// 1. Signature verify → 401 if bad
// 2. dedupWebhook() → 200 immediately if duplicate
// 3. Business logic
// 4. markWebhookProcessed() in finally
```

Storing payload BEFORE processing protects against "we lost the event because the handler crashed." Marking `processed_at` after gives us a "ghost transactions" reconcile signal for ops.

---

## R-04: `subscription_status` ENUM Migration Strategy (D-01, D-02, D-03)

Per D-03, migration is two-step non-blocking. Concrete migrations:

### Migration A: type creation + add column (defaultable, no rewrite)

```sql
-- 20260503_180000_add_subscription_status_enum.sql
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'grace', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS subscription_status public.subscription_status NOT NULL DEFAULT 'active';
```

`ADD COLUMN ... DEFAULT 'active'` on Postgres 11+ is metadata-only (no table rewrite). Safe under prod load.

### Migration B: backfill (single SQL, per D-02)

```sql
-- 20260503_180100_backfill_subscription_status.sql
UPDATE public.stores SET subscription_status = CASE
  -- Free plan or never subscribed → 'expired' (no premium to lose)
  WHEN plan_id = (SELECT id FROM public.plans WHERE name = 'gratis') THEN 'expired'
  -- Has active sub_id → 'active'
  WHEN mercadopago_subscription_id IS NOT NULL THEN 'active'
  -- No sub_id but premium plan → look at usage period_end
  WHEN EXISTS (
    SELECT 1 FROM public.store_usage u
    WHERE u.store_id = stores.id
      AND u.period_end >= CURRENT_DATE
  ) THEN 'cancelled'
  ELSE 'expired'
END
WHERE TRUE; -- explicit: backfill every row
```

Backfill criteria match the existing cron downgrade logic (`cron/downgrade-expired/route.ts:55-82`): `subscription_id NULL + period_end past = downgrade candidate`.

### Migration C: tighten the contract (deferred — out of M1 per D-04)

No `DROP COLUMN mp_status` migration in this phase. Parking-lot.

### Trigger for D-10 (R-02 above)

```sql
-- 20260503_180200_add_stores_updated_at_trigger.sql
DROP TRIGGER IF EXISTS stores_set_updated_at ON public.stores;
CREATE TRIGGER stores_set_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

Cheap, idempotent, makes D-09 robust without touching every writer.

---

## R-05: `failCampaign` Single-Shot — RPC vs Inline UPDATE (Claude's Discretion)

**Recommendation: inline UPDATE with `WHERE status = 'processing'` filter.** No new RPC needed. Pattern:

```ts
// lib/db/index.ts:441
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
    .eq("status", "processing")
    .select("id");
  if (error) throw error;
  // data.length === 0 means another path already terminated this campaign — that's OK.
  if (!data || data.length === 0) {
    logger.info("fail_campaign_noop", { campaign_id: campaignId, reason: "status not processing" });
  }
}
```

**Why inline, not RPC:**
- The `WHERE status = 'processing'` filter is the entire concurrency primitive — it's a one-line guard. RPC overhead (round-trip + GRANT plumbing) buys nothing.
- The existing 14 SECURITY DEFINER RPCs (per `harden_rpcs_and_constraints`) are for *atomic arithmetic* under concurrency; this is a CAS-style status transition where Supabase's REST UPDATE-WHERE is already atomic at the row level.
- Easier to verify in tests (no migration round-trip).

The first path that calls `failCampaign` wins; subsequent calls observe `data.length === 0` and log info-level "noop". `error_message` reflects the *first* terminal failure, not LIFO chaos (H-10 fix).

---

## R-06: Period Semantics Reconciliation (D-12, D-13)

**Offender identified:** `addCreditsToStore` (`lib/db/index.ts:790-799`) uses calendar-month math (`new Date(now.getFullYear(), now.getMonth(), 1)` and `getMonth() + 1, 0`). `updateStorePlan` (`lib/db/index.ts:756-758`) uses rolling-30 math (`now + 30 days`).

**Fix per D-12:** Replace `addCreditsToStore`'s period_start/period_end with rolling-30 anchored on payment date:

```ts
const paymentDate = new Date();
const periodStart = paymentDate.toISOString().split("T")[0];
const periodEnd = new Date(paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
```

This matches MP's billing anniversary cycle and aligns reconciliation joins between `credit_purchases.period_start` and `store_usage.period_start`.

**UX impact (D-14 confirms):** App copy already says "renova em N dias" (computed as `valid_until - now`). No copy changes needed. The semantic shift only affects internal reconciliation reports.

**Reconcile step:** No backfill of historical `credit_purchases.period_*` rows needed — those are immutable purchase records. Only future inserts use the new semantics.

---

## R-07: MP `external_reference` Cross-Check on Cancel (M-18)

In `handleSubscriptionEvent`, after `getSubscriptionStatus(subscriptionId)` returns:

```ts
const mpRef = subscription.externalReference || "";
const [storeId, planId] = mpRef.split("|");
if (!storeId || !planId) {
  logger.warn("mp_subscription_invalid_ref", { subscription_id: subscriptionId, ref: mpRef });
  return;
}

// Cross-check: the storeId in the event MUST match what MP returned for this subscriptionId
// (defense in depth — signature already covered data.id, but external_reference is a separate field on the resource)
if (subscription.id !== subscriptionId) {
  logger.warn("mp_subscription_id_mismatch", { received: subscriptionId, returned: subscription.id });
  return;
}
```

For non-active statuses (`pending`, `expired`, `failed`) per L-11, log at `warn` not `info` so they show up in ops dashboards.

---

## R-08: New Stores via `createStore` from Clerk webhook (C-3)

`createStore` already exists at `lib/db/index.ts:47-89` and does the right thing (resolves free plan, inserts store, inserts `store_usage`). The Clerk webhook (`webhooks/clerk/route.ts:92-97`) bypasses it and inserts a bare row (no `plan_id`, no `store_usage`).

**Recommendation:** Extract a `createPlaceholderStore({ clerkUserId, primaryEmail })` helper that wraps `createStore` with the placeholder-specific defaults (`segmentPrimary: 'outro'`, `name = email-prefix`, `onboarding_completed: false`). Have both the Clerk webhook and `createStore` itself call this. Consider passing `onboarding_completed` as an option to the existing `createStore` to avoid a near-duplicate.

**Alternative (simpler):** Add `onboarding_completed?: boolean` to `CreateStoreInput` and have the Clerk webhook call `createStore({ ..., onboarding_completed: false })` directly. This is the minimum-deviation path.

Both leave the success criterion satisfied: "New Clerk sign-up produces a `stores` row with non-null `plan_id` AND a matching `store_usage` row in one transaction."

---

## R-09: Credit-Pack Atomicity Fallback Removal (H-11, H-6)

The fallback paths in `consumeCredit` (line 859-869), `addCreditsToStore` (line 818-829), and `incrementCampaignsUsed` (line 570-577) are read-then-write under concurrency.

**Recommendation:** Convert the fallbacks to single-statement `UPDATE … RETURNING` arithmetic (D-11 alternative: SQL is atomic without RPC). Pattern:

```ts
// incrementCampaignsUsed fallback
const { data, error } = await supabase
  .from("store_usage")
  .update({ campaigns_generated: 'campaigns_generated + 1' })
  // ... but Supabase REST doesn't support raw SQL expressions in update().
```

Supabase JS REST doesn't support raw SQL expressions in `.update()`. Two options:

- **Option A (recommended):** When the RPC fails, surface the error (don't fallback). The RPCs are properly hardened (`20260424_harden_rpcs_and_constraints.sql`) and migrated; if they're missing in prod, that's an operational issue worth surfacing.
- **Option B:** Make the fallback do its own `.rpc('add_credits_atomic', ...)` retry with exponential backoff — but this adds complexity for a path that should never fire.

Plan picks **Option A** — strip the fallbacks, log error + Sentry-capture, throw. Matches CONTEXT-style positive intent (no silent degradation) and the bug-bash recommendation (H-11 final paragraph: "use UPDATE ... RETURNING with arithmetic in SQL ... that single statement is atomic without RPC").

If we ever need a true SQL fallback, expose a new RPC `increment_campaigns_used_by_store(store_id, qty)` that does the SELECT+lookup+UPDATE in one SECURITY DEFINER function — but that's a parking-lot improvement; not blocking M1.

---

## R-10: Schema files this phase touches (Schema Push Detection per workflow §5.7)

| Migration file | Purpose |
|---|---|
| `supabase/migrations/20260503_180000_add_subscription_status_enum.sql` | D-01/D-03 step 1 |
| `supabase/migrations/20260503_180100_backfill_subscription_status.sql` | D-02 backfill |
| `supabase/migrations/20260503_180200_add_stores_updated_at_trigger.sql` | R-02 (trigger for D-10) |
| `supabase/migrations/20260503_180300_create_webhook_events.sql` | D-05/D-06 dedup table |

Per `gsd-plan-phase.md` §5.7 (Schema Push Detection): Supabase ORM detected. Push command: `supabase db push` (non-TTY: requires `SUPABASE_ACCESS_TOKEN`). The planner MUST include a `[BLOCKING]` schema-push task before any code that depends on the new `subscription_status` column or `webhook_events` table.

---

## Validation Strategy (Nyquist gate — per workflow §5.5)

Each plan must include verifiable acceptance criteria that prove the phase goal. Suggested test mapping (planner to assign per-plan):

| Phase Success Criterion (ROADMAP) | Validation method |
|---|---|
| 1. RTDN events change `stores.plan_id` | Integration test: POST signed RTDN payload → SELECT plan_id, asserts changed |
| 2. Renewal payment leaves `mercadopago_subscription_id` unchanged | Integration test: pre-set sub_id, fire payment webhook, assert unchanged |
| 3. Clerk sign-up populates plan_id + store_usage atomically | Integration test: POST signed Clerk `user.created`, query both tables |
| 4. Concurrent `incrementCampaignsUsed` increments exactly twice | Promise.all of 2 RPC calls, assert final = +2 |
| 5. Cancel-then-resub mid-cron preserves paid plan | Integration test of optimistic lock semantics |
| 6. `failCampaign` writes `error_message` only once | Test: call twice, assert WHERE-status filter no-ops the second |

---

## Pitfalls / Things the planner must NOT do

1. **Don't drop `mp_status`** — D-04 explicitly keeps it during transition.
2. **Don't add a `version` column** — D-10 forbids it.
3. **Don't change UI plan-name labels based on subscription_status** — see R-01 point 3 (`getStorePlanName` is UI source, `canGenerateCampaign` is gate).
4. **Don't run a long ALTER TABLE on `stores`** — D-03 mandates non-blocking. Stick to ADD COLUMN with default and CREATE TRIGGER (both metadata-only).
5. **Don't change webhook responses to non-200 on processing errors** — MP / Clerk retry on non-2xx. Use `webhook_events` to dedup retries; surface errors via Sentry, return 200.
6. **Don't add Promptfoo/eval gating to webhook tests** — per project memory.
7. **Don't broaden into Phase 2.5 (Labeling) territory** — judge stays uncalibrated.
8. **Don't touch RPC GRANTs broadly** — Phase 4 owns that. Only the new RPC (if any) needs its own GRANT.

---

## RESEARCH COMPLETE
