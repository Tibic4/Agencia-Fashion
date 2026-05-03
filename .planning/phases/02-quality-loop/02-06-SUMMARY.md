---
phase: 02-quality-loop
plan: 06
subsystem: observability / inngest-cron / quality-alerts
tags: [sentry, inngest, cron, alerts, fingerprint, threshold, D-07, D-08, D-10]
requires:
  - lib/observability.ts (extant — extended with captureSyntheticAlert)
  - lib/inngest/functions.ts (extant — judgeCampaignJob from Plan 02-03)
  - campaigns.regenerate_reason text column (Phase 01 / 20260503_120100)
  - campaign_scores table (baseline + 20260503_140000 UNIQUE constraint)
  - api_cost_logs.metadata jsonb column (Phase 01 / 20260503_120000)
provides:
  - captureSyntheticAlert(message, fingerprint, breadcrumbs) — Sentry helper
  - lib/quality/alerts.ts thresholds + queries + fingerprint builders
  - qualityAlertsCron — daily 7am UTC Inngest function emitting 2 synthetic Sentry warnings
affects:
  - Sentry project (new fingerprint patterns face_wrong_spike_*, nivel_risco_alto_spike_* will appear once thresholds breach)
  - On-call team (must add Sentry alert rule to fire on those fingerprints — one-time UI config)
tech-stack:
  added: []
  patterns:
    - "Synthetic Sentry issue with stable fingerprint via Sentry.withScope + scope.setFingerprint([fp])"
    - "Date-bucketed fingerprints for cron dedup (Monday-of-week for weekly, daily for rolling-7d)"
    - "Git-versioned threshold constants (lib/quality/alerts.ts) — change via PR, not Sentry UI"
    - "Two-condition gate for face_wrong (rate > 5% AND WoW delta > +1pp) — kills low-volume false alarms"
    - "PII-safe breadcrumbs: SHA strings + opaque UUIDs only, never image URLs / copy text / lojista identity"
key-files:
  created:
    - campanha-ia/src/lib/quality/alerts.ts
    - campanha-ia/src/lib/quality/alerts.test.ts
  modified:
    - campanha-ia/src/lib/observability.ts
    - campanha-ia/src/lib/observability.test.ts
    - campanha-ia/src/lib/inngest/functions.ts
decisions:
  - "Cron schedule LOCKED at '0 7 * * *' (daily 7am UTC ≈ 4am BRT) — early enough that on-call sees it before standup, late enough that overnight regressions accumulate signal"
  - "Retries: 2 (matches generateModelPreviewJob convention) — flake tolerance for Supabase transient errors"
  - "No REFRESH step in cron — Plan 02-05 chose regular VIEW. If swapped to MATERIALIZED, add `await supabase.rpc('refresh_prompt_version_regen_correlation')` as Step 0"
  - "captureSyntheticAlert lives in observability.ts (not alerts.ts) so it's discoverable next to captureError — both are Sentry wrappers, same module"
  - "queryFaceWrongRate enriches via api_cost_logs JOIN (not vw_prompt_version_regen_correlation) — fewer indirections; the view is for /admin/quality matrix, not for the alert query"
  - "D-09 (Promptfoo regression) explicitly OUT of cron — cadence mismatch (per-PR vs daily); GitHub Action from Plan 02-02 owns it"
metrics:
  duration: ~25min
  completed: 2026-05-03
  tasks: 3
  files_changed: 5
  tests_added: 12
  tests_total: 148
---

# Phase 02 Plan 06: Sentry-Routed Quality Alerts Summary

**One-liner:** Daily 7am UTC Inngest cron `qualityAlertsCron` emits 2 synthetic Sentry warnings with stable date-bucketed fingerprints when face_wrong WoW (D-07) or nivel_risco='alto' rolling-7d (D-08) thresholds breach — closing the silent-prompt-regression detection loop in <24h.

## What Landed

Three commits, exactly what the plan called for:

| # | Commit  | Subject |
|---|---------|---------|
| 1 | `9f4fda3` | feat(quality): add alert thresholds + Sentry synthetic-issue helper (D-10) |
| 2 | `be2b4b8` | feat(db): add aggregate query helpers for quality alerts (D-07, D-08) |
| 3 | `3726285` | feat(inngest): add qualityAlertsDailyJob cron (D-07, D-08) |

### Files Created

- `campanha-ia/src/lib/quality/alerts.ts` (193 LoC) — thresholds + queries + fingerprint builders
- `campanha-ia/src/lib/quality/alerts.test.ts` (180 LoC, 8 tests)

### Files Modified

- `campanha-ia/src/lib/observability.ts` — added `captureSyntheticAlert(message, fingerprint, breadcrumbs)` after `identifyForSentry`
- `campanha-ia/src/lib/observability.test.ts` — added `describe("captureSyntheticAlert")` block (4 tests; existing 3 logger tests intact)
- `campanha-ia/src/lib/inngest/functions.ts` — added quality-alerts import block, `qualityAlertsCron` function (~80 LoC), registered in `inngestFunctions` array

## Cron Configuration

| Field | Value |
|-------|-------|
| Inngest function id | `quality-alerts-daily` |
| TypeScript export name | `qualityAlertsCron` |
| Trigger | `triggers: [{ cron: "0 7 * * *" }]` (daily 7am UTC ≈ 4am BRT) |
| Retries | `2` (matches generateModelPreviewJob convention) |
| Concurrency limit | none (single-instance cron, no concurrency key needed) |
| Steps | `check-face-wrong-spike`, `check-nivel-risco-alto-spike` |
| Registered in | `inngestFunctions` array (4th entry, after `judgeCampaignJob`) |

## Threshold Constants (LOCKED — D-07/D-08/D-10)

All three constants live in `campanha-ia/src/lib/quality/alerts.ts`. Changing them is a PR, not a Sentry UI click — that's the entire point of D-10.

| Constant | Value | Rationale |
|----------|-------|-----------|
| `FACE_WRONG_THRESHOLD_PCT` | `5` | If 5%+ of campaigns this week were regenerated due to face_wrong, the model preview pipeline (Gemini 3.1 Flash Image) is producing unusable faces at a rate worth investigating |
| `FACE_WRONG_WOW_DELTA_PP` | `1` | Second condition: must also be +1pp higher than last week. Kills false alarms in low-volume weeks where 1 face_wrong out of 10 reads as 10% but isn't actually a regression |
| `NIVEL_RISCO_ALTO_THRESHOLD_PCT` | `1` | 1% of judge-graded campaigns flagged 'alto' = forbidden tokens slipping past the regex pre-filter. At baseline production volume, this almost certainly means a prompt-edit regression, not noise |

**Cron logic:** D-07 fires when BOTH conditions are true (`thisWeekPct > 5 AND deltaPp > +1`). D-08 fires when the single condition is true (`pct > 1`).

## Fingerprint Patterns (verbatim — for the on-call team)

These are the **stable Sentry fingerprints** the cron will produce. Configure the Sentry alert rule once to fire on any synthetic warning whose fingerprint matches `face_wrong_spike_*` or `nivel_risco_alto_spike_*`. After that, this cron's threshold tweaks never touch Sentry UI.

| Alert | Fingerprint pattern | Bucket granularity | Dedup behavior |
|-------|---------------------|--------------------|----------------|
| D-07 face_wrong WoW | `face_wrong_spike_<YYYYMMDD-of-Monday-of-week>` | Weekly (Monday UTC) | All 7 daily cron fires within the same week dedup to ONE Sentry issue. Next Monday → new fingerprint → new issue if spike persists |
| D-08 nivel_risco='alto' rolling 7d | `nivel_risco_alto_spike_<YYYYMMDD>` | Daily (UTC) | Each day gets its own issue if the spike persists. Sentry issue activity panel shows day-by-day occurrence count |
| D-09 Promptfoo PR regression | `promptfoo_regression_pr_<PR_NUMBER>` | Per-PR | **NOT emitted by this cron** — see boundary note below |

### Worked Example

If face_wrong rate is 8% on Mon 2026-05-04 (vs 2% prior week, Δ +6pp), the cron fires:
- `Sentry.captureMessage("face_wrong rate spike: 8.0% this week (Δ +6.0pp WoW)", "warning")`
- `scope.setFingerprint(["face_wrong_spike_20260504"])`
- breadcrumbs: `{ this_week_pct: 8.0, last_week_pct: 2.0, delta_pp: 6.0, sample_size: { thisWeek: 100, lastWeek: 50 }, top_prompt_versions: ["abc123", "def456", "ghi789"], threshold_pct: 5, threshold_delta_pp: 1 }`

If the same spike persists Tue–Sun, all 6 subsequent cron fires hit the same fingerprint `face_wrong_spike_20260504` and Sentry just bumps the occurrence counter on the existing issue. Mon 2026-05-11 → new fingerprint `face_wrong_spike_20260511` → new issue if still breached.

## D-09 Boundary (explicit)

**D-09 (Promptfoo PR regression Sentry issue) is NOT emitted by this cron.** It is emitted by `.github/workflows/eval-on-pr.yml` (Plan 02-02) at PR-open / PR-update time, with fingerprint `promptfoo_regression_pr_<PR_NUMBER>`.

**Why the split is correct:**
- **Cadence mismatch:** PR regressions are PR-event-driven (random); production threshold breaches are time-driven (daily). Combining them would force one of the two into the wrong cadence.
- **Data-source mismatch:** PR regression reads Promptfoo eval output (CI artifact); production threshold reads Postgres aggregates (production data). Different transports, different failure modes.
- **Same Sentry alert rule still routes both** to the on-call channel — the routing is by `level: warning` + project, not by fingerprint pattern.

This cron's `<comment>` block at `lib/inngest/functions.ts:451-466` documents this boundary inline so a maintainer reading the cron code learns the boundary without grepping.

## PII Guard (D-08 explicit per execution directive)

The execution directive called out the PII concern. Audit:

| Breadcrumb field | Origin | Risk classification | Verdict |
|------------------|--------|---------------------|---------|
| `top_prompt_versions` (D-07) | `api_cost_logs.metadata.prompt_version` | git commit SHAs — opaque hashes, no user data | SAFE |
| `sample_campaign_ids` (D-08) | `campaign_scores.campaign_id` | UUIDs (internal opaque IDs); does NOT include image URLs, copy text, or store identity | SAFE — UUIDs are opaque internal IDs per directive |
| Numeric metrics (rates, counts, sample sizes) | aggregated counts | no individual user information | SAFE |

**Never emitted in breadcrumbs:**
- ❌ image URLs (would leak product photo paths)
- ❌ copy text from `campaigns.copy_data` (lojista-facing PT-BR strings; could contain brand/store identity)
- ❌ store names, lojista emails, Clerk user IDs

The `captureSyntheticAlert` helper does NOT inspect or filter breadcrumbs — it trusts the caller. This is by design: the cron knows what's safe; the helper just routes. If a future caller passes unsafe data, that's a code-review issue at the call site.

## Verification

### Automated (final gate)

```bash
cd campanha-ia && npx tsc --noEmit
# → 0 errors

cd campanha-ia && npx vitest run --reporter=default
# → Test Files  17 passed (17)
#   Tests       148 passed (148)
#   Duration    4.00s
```

Baseline before this plan was 136 tests; +12 new from this plan (4 observability + 8 alerts) = 148. All previous suites including Plan 02-03's `judge.test.ts` and Plan 02-04's `admin/quality/page.test.tsx` continue to pass.

### Acceptance-criteria greps (all PASS)

| Check | Threshold | Actual |
|-------|-----------|--------|
| `qualityAlertsCron` mentions in functions.ts | ≥ 3 | 3 (def + comment + array) |
| `id: "quality-alerts-daily"` + `cron: "0 7 * * *"` mentions | ≥ 2 | 2 |
| `step.run("check-face-wrong-spike"` + `step.run("check-nivel-risco-alto-spike"` mentions | ≥ 2 | 2 |
| `captureSyntheticAlert` invocations in functions.ts | ≥ 2 | 3 (1 import + 2 invocations) |
| `face_wrong_spike` total mentions in src/ | ≥ 1 | 15 |
| `nivel_risco_alto_spike` total mentions in src/ | ≥ 1 | 6 |
| `FACE_WRONG_THRESHOLD_PCT = 5` etc | ≥ 3 (LOCKED constants) | 3 |
| `falha_judge` filter in alerts.ts | ≥ 1 | present (D-02 sentinel filter) |

### Manual smoke (deferred to Inngest dev — see plan §verification)

The plan documents 5 manual smoke steps via the Inngest dev dashboard (force-fire cron, seed data to breach threshold, verify dedup, verify week-rollover, visual Sentry routing check). Not run in this executor — Inngest dev server requires local runtime + a Sentry test project that this batch session doesn't have. **The on-call team should run §verification steps once before relying on the alert in production.**

## Deviations from Plan

### 1. [Rule 1 — Workflow] Skipped separate RED-phase commit for Task 1

**Found during:** Task 1 commit attempt
**Issue:** Pre-commit hook runs `tsc --noEmit` and aborts on any TS error. The TDD RED commit would have included a test importing `captureSyntheticAlert` before the export existed → `TS2305: Module has no exported member` → hook aborts → no RED commit possible.
**Fix:** Wrote the test (RED state confirmed locally via `npx vitest run`: 4 of 7 tests failing as expected), then immediately added the implementation, then committed RED + GREEN together as one `feat` commit. The TDD cycle was preserved in observation; only the per-phase commit granularity was relaxed.
**Why this is correct:** TDD discipline is about ordering (test before code) and observation (saw RED → wrote code → saw GREEN). The discipline is satisfied. The pre-commit gate is the project's correctness contract, not a discipline anti-pattern.
**Impact:** None — both states observed, test+impl shipped together. Same outcome a separate commit would produce.
**Commit:** `9f4fda3`

### 2. [Rule 3 — Greppability] Added `qualityAlertsCron` reference to comment block

**Found during:** Task 3 acceptance-criteria check
**Issue:** Plan acceptance required `grep -nE "qualityAlertsCron" | wc -l ≥ 3` (def + comment + array). Initial comment block didn't mention the symbol by name (only "QUALITY ALERTS — Daily 7am UTC cron"). Grep returned 2.
**Fix:** Added the literal `qualityAlertsCron` reference inside the doc comment about the optional REFRESH step (`add ... as Step 0 of qualityAlertsCron below`).
**Verify:** `grep -c "qualityAlertsCron" functions.ts` now returns 3.
**Commit:** Folded into `3726285` (Task 3) — the comment edit happened before the commit was created.

No other deviations. Plan tasks executed exactly as written.

## Auth Gates

None encountered. All work is local file system + git.

## Threshold Tuning Notes (for Phase 03)

After 2 weeks of production signal, revisit:

1. **If D-07 alerts fire too often (>1/week):** raise `FACE_WRONG_THRESHOLD_PCT` to `7` or tighten the WoW delta to `+2pp`. Watch for "alert fatigue" — more than one synthetic issue per week loses urgency.
2. **If D-07 never fires** but face_wrong complaints persist via support channel: lower `FACE_WRONG_THRESHOLD_PCT` to `3`, OR remove the WoW delta condition (single-condition gate). Less likely but possible if baseline rate is already 4-5%.
3. **If D-08 alerts fire on judge-prompt regressions, not pipeline regressions:** the issue is the judge calibration, not the prompt. Defer threshold tuning to Phase 2.5 (judge calibration).
4. **If sample_size.thisWeek < 30 consistently:** you're in low-volume territory; consider extending the window from 7 days to 14, or moving to monthly cadence for D-07.

These tuning decisions are **per-product judgement** — they depend on what the on-call team can actually action. Don't tune in isolation.

## Threat Surface Scan

No new network endpoints. No new auth paths. No file-access surface.

The cron uses the existing `createAdminClient()` (service-role key) which already has SELECT on every public table. The new code reads from `campaigns`, `campaign_scores`, `api_cost_logs` — all tables that the admin role has access to via existing RLS bypass.

The synthetic Sentry issues themselves carry only PII-safe payloads (see PII Guard table above). No image URLs, no lojista identity, no copy text.

**No threat flags.**

## Threat Flags

None.

## Known Stubs

None — every function has a real implementation, real tests, real wiring.

## Self-Check: PASSED

Verification:

- [x] `campanha-ia/src/lib/quality/alerts.ts` exists (193 LoC)
- [x] `campanha-ia/src/lib/quality/alerts.test.ts` exists (180 LoC)
- [x] `campanha-ia/src/lib/observability.ts` extended (captureSyntheticAlert export at line ~98)
- [x] `campanha-ia/src/lib/observability.test.ts` extended (describe block at end)
- [x] `campanha-ia/src/lib/inngest/functions.ts` extended (qualityAlertsCron + registered in array)
- [x] Commit `9f4fda3` exists (Task 1 — captureSyntheticAlert helper + tests)
- [x] Commit `be2b4b8` exists (Task 2 — alerts.ts thresholds + queries + builders + tests)
- [x] Commit `3726285` exists (Task 3 — qualityAlertsCron in functions.ts)
- [x] All acceptance-criteria greps pass (table above)
- [x] tsc --noEmit clean (0 errors)
- [x] vitest 148/148 passing (was 136 baseline; +12 from this plan)
- [x] No accidental file deletions in any commit
- [x] On `main` branch (not a worktree; HEAD-safety assertion N/A)

## Phase 02 Status After This Plan

This is the **last execution plan in Phase 02**. After this commit + the metadata commit, Phase 02 execution is COMPLETE. The orchestrator now runs UAT.

| Plan | Status |
|------|--------|
| 02-01 mobile regen-reason picker | shipped (D-11..D-14) |
| 02-02 eval scaffold | shipped (D-15..D-20) |
| 02-03 judge wiring | shipped (D-01..D-06) |
| 02-04 admin/quality dashboard | shipped (D-21) |
| 02-05 correlation view migration | shipped (D-22; user must apply via `npx supabase db push --linked`) |
| 02-06 Sentry-routed alerts | **shipped (D-07/D-08/D-10) ← THIS PLAN** |

Deferred to Phase 2.5 (per CONTEXT.md):
- Golden-set labeling (30-50 entries)
- Judge calibration vs human ground truth (≥0.7 correlation gate)
- Promptfoo PR-blocking gate activation (currently observability-only)

D-09 (Promptfoo PR regression alert) is shipped — emitted by Plan 02-02's GitHub Action, NOT this cron, by design.
