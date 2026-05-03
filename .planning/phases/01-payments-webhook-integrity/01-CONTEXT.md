# Phase 1: Payments Webhook Integrity - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Make every billing event (Mercado Pago + Google Play RTDN + Clerk `user.created` + cancellation cron) correctly mutate plan/credit state without silent no-ops, clobbers, or out-of-order races. Paying users can never be downgraded by a cron tick. Webhook orphans are impossible. New signups always land with a complete plan + usage row.

In scope (from ROADMAP / PHASE-DETAILS Phase 1):
- Schema split fix (`stores.plan` vs `stores.plan_id`) in Play billing paths
- Stop `updateStorePlan` from clobbering `mercadopago_subscription_id` on payment renewal
- New stores via `createStore` (or extracted helper) in Clerk webhook → `plan_id` + `store_usage` populated at signup
- Replace "null sub_id on cancel" with positive-intent `subscription_status` column
- Optimistic-locking guard on `cron/downgrade-expired`
- Convert read-then-write fallbacks to single-statement `UPDATE … RETURNING` arithmetic (`incrementCampaignsUsed`, `consumeCredit`, `addCreditsToStore`)
- `failCampaign` single-shot status transition (`WHERE status = 'processing'`)
- Reconcile period semantics between `addCreditsToStore` and `updateStorePlan`
- Validate event ownership (`external_reference` cross-check) on subscription cancel
- Fail-closed guard in `getStorePlanName`/`canGenerateCampaign` so cancelled+expired never serves premium

Out of scope:
- Pipeline-level changes (Phase 2)
- Webhook signature/replay hardening (Phase 4)
- Generic RPC GRANT cleanup (Phase 4)
- Cron secret query-param fix (Phase 8)

</domain>

<decisions>
## Implementation Decisions

### Schema design — `subscription_status`
- **D-01:** Postgres ENUM with 4 explicit states: `'active' | 'cancelled' | 'grace' | 'expired'`. Type-safe; states explicit; no booleans-with-meaning drift.
- **D-02:** Backfill via single SQL statement using `CASE WHEN ...` deriving from existing `mp_status` + `valid_until`. No application-side backfill code.
- **D-03:** Migration is non-blocking: ENUM type creation + ALTER TABLE ADD COLUMN with default `'active'`, then UPDATE + ALTER COLUMN SET NOT NULL in a second migration after backfill verified. Production has paying users — never run a long-blocking ALTER on `stores`.
- **D-04:** Existing `mp_status` field stays for now (parallel column during transition). Cleanup of old field is out of M1 scope (parking lot).

### Idempotency mechanism — webhooks
- **D-05:** Dedicated `webhook_events` table. Schema: `(provider TEXT, event_id TEXT, received_at TIMESTAMPTZ, payload JSONB, processed_at TIMESTAMPTZ NULL, PRIMARY KEY (provider, event_id))`.
- **D-06:** Pattern: every webhook handler INSERTs into `webhook_events` BEFORE processing. ON CONFLICT DO NOTHING returns 0 → duplicate, return 200 immediately. Returns 1 → first time, process, then UPDATE `processed_at`.
- **D-07:** Same pattern applies to MP, Clerk, Google Play RTDN. Provider name is the dedup namespace.
- **D-08:** Audit trail: `payload JSONB` stored for forensics; retention policy is parking-lot (not M1).

### Concurrency primitive — `cron/downgrade-expired`
- **D-09:** Optimistic lock using existing `updated_at` column on `stores`. Cron pattern: SELECT id, updated_at WHERE conditions; UPDATE WHERE id = ? AND updated_at = ?. 0 rows affected → renewal happened mid-cron, skip silently.
- **D-10:** No new `version` column added (avoids touching every writer). Trust that `updated_at` is reliably set by all `UPDATE stores …` paths — verify during planning that no INSERT/UPDATE bypasses default trigger.
- **D-11:** Cron logs each skipped row at info level with reason `"updated_at changed mid-cron"` for observability.

### Period semantics — credits / billing
- **D-12:** Rolling 30 days from payment date is canonical. Aligns with how Mercado Pago bills subscriptions (charge anniversary).
- **D-13:** `addCreditsToStore` and `updateStorePlan` both use `payment_date + interval '30 days'` for `valid_until`. Reconcile by deleting calendar-month logic from whichever path uses it (planning resolves which path is the offender).
- **D-14:** UX surface: app shows "renews in N days" calculated from `valid_until - now()`. No calendar-month language in user-facing copy.

### Claude's Discretion (planner / executor decides)
- Migration file naming and ordering (follow existing `supabase/migrations/` convention)
- Exact placement of `webhook_events` insertion in each handler (top of body vs after sig verify — researcher decides based on current handler shape)
- Whether to extract a `dedupWebhook(provider, eventId)` helper or inline ON CONFLICT pattern per handler
- Test fixture strategy (synthetic payloads vs captured real ones)
- Whether `failCampaign` single-shot uses RPC or inline UPDATE

### Flagged for plan-phase research (per ROADMAP `needs-research`)
- **R-01:** Exact insertion site for fail-closed guard — `getStorePlanName()` vs `canGenerateCampaign()`. Need to confirm the right site without introducing cron-cycle UI churn. Researcher must read both call sites + their callers, propose site with rationale before planner commits.

</decisions>

<specifics>
## Specific Ideas

- "Paying users can never be silently downgraded" — D-09 + D-11 implements positive-intent semantics; cron logs every skip
- "New signups must land complete" — `createStore` helper extracted, called atomically in Clerk webhook (D-04 in PHASE-DETAILS scope)
- "MP billing dictates billing period" — D-12 anchors on payment date, not calendar (matches MP charge cycle)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope sources
- `.planning/PROJECT.md` — vision, milestone goal, constraints (Android-only, paying users, EAS lock)
- `.planning/ROADMAP.md` §"Phase 1" — phase goal + success criteria
- `.planning/PHASE-DETAILS.md` §"Phase 1" — full scope (in/out), findings cross-ref, risk if skipped
- `.planning/STATE.md` — current position + deferred items list

### Findings to address (severity-tagged)
- `.planning/audits/MONOREPO-BUG-BASH.md` — findings C-1, C-2, C-3, C-4, H-7, H-10, H-11, M-11, M-12, M-18, L-11
- `.planning/codebase/CONCERNS.md` §2 "/api/billing/restore writes non-existent column"
- `.planning/codebase/CONCERNS.md` §3 "Subscription cancellation flow is intentionally lossy on cancel"

### Codebase intel
- `.planning/codebase/ARCHITECTURE.md` §"MP webhook → credit grant flow" + §"Database schema overview"
- `.planning/codebase/STACK.md` §"campanha-ia" — Supabase migration tooling, RPC conventions
- `.planning/codebase/QUALITY.md` — current test coverage of billing routes (gap inventory)

### Out-of-M1 (do NOT broaden)
- `.planning/ROADMAP.md` §"Decisões do owner" — parking lot rules
- `.planning/ROADMAP.md` §"Out-of-milestone (parking lot)" — items blessed but explicitly out of M1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createStore` (or its inline equivalent) — extract into a single helper called by both Clerk webhook and any other signup path; ensures `plan_id` + `store_usage` are populated atomically
- Existing `supabase/migrations/` directory and naming convention — new ENUM + ALTER TABLE migrations follow pattern
- Existing RPC layer (~14 SECURITY DEFINER) — `failCampaign` single-shot likely fits as new RPC `fail_campaign_once`

### Established Patterns
- RLS on all tables — new `webhook_events` table needs RLS policy (service-role-only writes; no client access)
- SECURITY DEFINER RPCs for privileged ops — atomic `UPDATE … RETURNING` arithmetic for credits should be RPC, not inline SQL
- Existing `updated_at` triggers — verify all writers go through them before relying on D-09

### Integration Points
- Clerk webhook handler → `createStore` helper (new connection point)
- MP webhook handler → `webhook_events` dedup → existing `updateStorePlan` (with the clobber-fix)
- `cron/downgrade-expired` route → optimistic lock pattern (D-09)
- `getStorePlanName` / `canGenerateCampaign` — fail-closed guard (R-01 decides exact site)

</code_context>

<deferred>
## Deferred Ideas

- **Cleanup of old `mp_status` column** — D-04 keeps it during transition; full removal after `subscription_status` proves stable in prod. Out of M1, parking lot.
- **`webhook_events` retention policy** — D-08 stores payloads forever; retention/archival decision deferred (not blocking M1).
- **Extract `dedupWebhook(provider, eventId)` helper vs inline pattern** — Claude's discretion in plan; revisit only if 3+ handlers grow.
- **Fail-closed guard placement (R-01)** — research item, not a deferral; blocks Phase 1 plan write.
- **Refactor of `getStorePlanName` / `canGenerateCampaign` callers** — only the guard insertion is in scope; broader refactor of these functions is out (parking lot).

</deferred>

---

*Phase: 01-payments-webhook-integrity*
*Context gathered: 2026-05-03*
