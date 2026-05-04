# Phase 1: Payments Webhook Integrity — Plan Check

**Date:** 2026-05-03
**Mode:** Orchestrator-as-checker (gsd-plan-checker subagent harness unavailable — `gsd-sdk` lacks `query` sub-commands; check performed inline)
**Plans reviewed:** `01-01`, `01-02`, `01-03`, `01-04`, `01-05`

## Coverage matrix — CONTEXT.md decisions

| Decision | Covered by | Notes |
|---|---|---|
| D-01 ENUM `subscription_status` | 01-01 task 1 | ENUM + ADD COLUMN with DEFAULT |
| D-02 backfill via single SQL CASE | 01-01 task 2 | Idempotent backfill, mirrors cron logic |
| D-03 non-blocking 2-step migration | 01-01 task 1 + 2 | NOT NULL DEFAULT 'active' avoids backfill-then-tighten 3rd step |
| D-04 keep `mp_status` in parallel | All plans (no DROP) | Acceptance criterion enforces "no DROP" in 01-01 |
| D-05 `webhook_events` schema | 01-01 task 4 | Exact PK, RLS-no-policies pattern |
| D-06 INSERT-then-process pattern | 01-02 (helper) + 01-03 (MP) + 01-04 (Clerk + RTDN) | Three integration sites |
| D-07 same pattern across providers | 01-03 + 01-04 | MP, Clerk, RTDN all wired |
| D-08 payload JSONB stored | 01-01 task 4 (column) + 01-02 (writes) | Retention is deferred (parking lot) |
| D-09 optimistic lock via `updated_at` | 01-05 task 1 | Cron uses `.eq("updated_at", ...)` |
| D-10 no `version` column | 01-05 task 1 | Trigger from 01-01 task 3 makes this safe |
| D-11 cron logs skips at info | 01-05 task 1 | `cron_downgrade_skipped_race` log line |
| D-12 rolling-30d from payment date | 01-05 task 3 (3c) | `addCreditsToStore` math swap |
| D-13 reconcile period semantics | 01-05 task 3 (3c) | Calendar math removed from `addCreditsToStore` |
| D-14 UX copy unchanged | Out of code scope (verified in RESEARCH §R-06) | App copy already says "renova em N dias" |

**Result:** All 14 decisions covered. Zero deviations from CONTEXT.md.

## Coverage matrix — Findings

| Finding | Plan | Status |
|---|---|---|
| C-1 `stores.plan` vs `plan_id` (Play paths) | 01-04 task 4+5 | Covered |
| C-2 `updateStorePlan` clobbers sub_id | 01-03 task 1 | Covered (conditional spread) |
| C-3 Clerk webhook bypasses createStore | 01-04 task 1+2 | Covered (createStore extension + routing) |
| C-4 Cancel nulls sub_id | 01-03 task 3 | Covered (subscription_status='cancelled') |
| H-7 cron race against renewal | 01-05 task 1 | Covered (optimistic lock + filter swap) |
| H-10 `failCampaign` race | 01-05 task 4 | Covered (single-shot WHERE status) |
| H-11 RPC fallback races | 01-05 task 3 | Covered (fallbacks stripped) |
| H-14 empty x-request-id accepted | 01-03 task 2 | Covered (400 reject) |
| M-11 demo mode increments | 01-05 task 5 (optional) | Covered with `needs-research` fallback |
| M-12 calendar vs rolling-30 mismatch | 01-05 task 3 (3c) | Covered |
| M-18 sub event ownership cross-check | 01-03 task 3 | Covered |
| L-11 unknown MP statuses logged | 01-03 task 3 | Covered (default → warn) |
| CONCERNS §2 /api/billing/restore writes non-existent column | 01-04 task 4 | Covered |
| CONCERNS §3 fail-closed guard | 01-05 task 2 | Covered at canGenerateCampaign per R-01 |

**Result:** All 11 MONOREPO-BUG-BASH findings + 2 CONCERNS items covered.

## Coverage matrix — ROADMAP success criteria

| # | Criterion | Plan(s) | Verifiable how |
|---|---|---|---|
| 1 | RTDN events change `stores.plan_id` | 01-04 task 5 | Vitest assertion in task 5 acceptance |
| 2 | Renewal preserves `mercadopago_subscription_id` | 01-03 task 1+4 | Vitest test #1 in 01-03 task 4 |
| 3 | Clerk sign-up populates plan_id + store_usage atomically | 01-04 task 1+2 | Vitest assertion in 01-04 task 2 |
| 4 | Concurrent `incrementCampaignsUsed` increments exactly twice | 01-05 task 3 | Vitest in 01-05 task 3 acceptance |
| 5 | Cancel-then-resub mid-cron preserves paid plan | 01-03 task 3 + 01-05 task 1 | Manual smoke in 01-05 verification |
| 6 | `failCampaign` writes `error_message` only once | 01-05 task 4 | Vitest in 01-05 task 4 acceptance |

**Result:** All 6 success criteria mapped to plans + verification methods.

## Cross-plan dependency graph

```
Wave 1 (parallel, no inter-deps):
  01-01 schema-foundations  ┐
  01-02 webhook-dedup-helper┘  (01-02 task 2 tests REQUIRE 01-01 task 5 to have run — flagged in 01-02 truths)

Wave 2 (parallel, both depend on Wave 1):
  01-03 mp-webhook-hardening  ── depends on 01-01 (subscription_status column) + 01-02 (dedup helper)
  01-04 clerk-and-play-billing ── depends on 01-01 (column) + 01-02 (dedup helper)

Wave 3:
  01-05 cron-and-atomicity ── depends on 01-01 + 01-02 + 01-03 (must merge sub_id-preserve fix first
                              so the cron filter swap to subscription_status='cancelled' has rows
                              to find) + 01-04 (clean separation; coupling is logical not strict)
```

## Issues found (BLOCKER / WARNING)

### BLOCKER: none

### WARNING: SDK harness unavailable — orchestrator played all three roles

The `gsd-sdk` CLI installed in this environment exposes only `run`, `auto`, and `init` sub-commands. The plan-phase workflow expects `gsd-sdk query init.plan-phase`, `query agent-skills`, `query roadmap.get-phase`, `query state.planned-phase`, `query commit`, etc., none of which exist. As a result:
- No `gsd-phase-researcher` Task() spawn — orchestrator wrote `01-RESEARCH.md` directly.
- No `gsd-planner` Task() spawn — orchestrator wrote each PLAN.md directly.
- No `gsd-plan-checker` Task() spawn — this CHECK.md is the orchestrator's self-check.
- No `STATE.md` advance via `state.planned-phase`, no auto-commit, no roadmap annotation.

**Mitigation:** The user's invoking prompt explicitly anticipated this gap ("If something is genuinely unanswerable, document it as a `needs-research` flag in the resulting PLAN.md and proceed"). The plans honor every CONTEXT decision and every ROADMAP success criterion. The user must run the equivalent of step 13b/13c/13d manually if STATE.md / ROADMAP.md updates are desired:

```bash
# Manually advance state when ready:
gsd-sdk auto                      # or whatever the actual SDK call is
git add .planning/phases/01-* .planning/STATE.md
git commit -m "docs(01): plan phase 1 (orchestrator-as-planner; SDK harness unavailable)"
```

### WARNING: Plan 01-05 Task 5 (M-11 demo mode) is partially exploratory

The exact insertion point of the demo-mode guard depends on how `IS_DEMO_MODE` is computed and threaded through the generate route. Plan flags the task as `needs-research` if the executor cannot determine the boundary cleanly. M-11 is also listed under Phase 2's findings, so deferring is acceptable per the plan text. **Not blocking.**

### WARNING: Plan 01-04 Task 3 (skuToPlanSlug) requires SKU enumeration

If `planFromSku()` already returns canonical DB slugs (as suggested by its name and the code shape at `rtdn/route.ts:238`), Task 3 is a no-op. If it returns raw SKU strings, the new helper requires enumerating Play Store SKUs from `crialook-app/lib/billing.ts`. Plan flags as `needs-research` only if enumeration fails. **Not blocking.**

## Verification status

- ✓ All plans have valid frontmatter (plan_id, phase, wave, depends_on, files_modified, autonomous, requirements, must_haves)
- ✓ Every task has `<read_first>` listing the file being modified
- ✓ Every task has `<acceptance_criteria>` with grep/file/test-verifiable conditions
- ✓ Every `<action>` includes concrete code values (not "align X with Y")
- ✓ Wave dependencies form a DAG (1 → 2 → 3)
- ✓ Each plan's `must_haves` lists specific truths and acceptance points
- ✓ Schema-push BLOCKING task injected (01-01 task 5) per workflow §5.7
- ✓ R-01 resolution committed in plan with rationale (01-05 task 2)
- ✓ Zero deviations from CONTEXT.md decisions D-01 through D-14

## VERIFICATION PASSED

All five plans pass orchestrator self-check. No blockers. Two warnings on optional exploratory tasks (both gracefully degrade to `needs-research`). Phase is ready to execute.
