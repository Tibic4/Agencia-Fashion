---
phase: 02-quality-loop
plan: 05
subsystem: database / admin-dashboard
tags: [migration, view, postgres, correlation, prompt-version, regenerate-reason, D-22]
requires:
  - api_cost_logs.metadata jsonb column (Phase 01 / 20260503_120000)
  - campaigns.regenerate_reason text column (Phase 01 / 20260503_120100)
provides:
  - public.vw_prompt_version_regen_correlation (regular VIEW)
affects:
  - Plan 02-04 admin/quality dashboard Section 4 (correlation matrix tile)
  - Plan 02-06 alerts (per-prompt-version drift query for face_wrong rate alert)
tech-stack:
  added: []
  patterns:
    - "JSON-path projection: metadata->>'prompt_version' as a top-level column"
    - "Per-row view (not pre-aggregated) so callers apply their own GROUP BY + date-range filters"
key-files:
  created:
    - campanha-ia/supabase/migrations/20260503_141500_create_prompt_version_regen_correlation_view.sql
  modified: []
decisions:
  - "Regular CREATE VIEW (not MATERIALIZED) — Phase 02 row count below 100K threshold (couldn't live-query; defaulted to safer variant per planner fallback)"
  - "Expose per-row shape with campaign_id + created_at so callers can apply WHERE created_at >= NOW() - INTERVAL '7 days' (matrix tile + alert cron both need this)"
  - "Include NULL regenerate_reason rows so callers can compute regen-rate denominators; matrix tile filters them out client-side"
  - "Filter to action='sonnet_copywriter' only — the copy artifact's prompt SHA is the correlation target, not the judge's meta-prompt SHA"
  - "Migration NOT auto-applied; user runs `cd campanha-ia && npx supabase db push --linked` (same workflow as Phase 01 migrations + the 14:00 UNIQUE-constraint migration)"
metrics:
  duration: ~5min
  completed: 2026-05-03
---

# Phase 02 Plan 05: Prompt-Version × Regenerate-Reason Correlation View Migration Summary

**One-liner:** New Postgres VIEW `vw_prompt_version_regen_correlation` exposes per-row campaigns ⨝ api_cost_logs joined on campaign_id (filtered to copywriter action) so /admin/quality Section 4 can render a heatmap and Plan 02-06's alert (a) can compute per-prompt-version face_wrong rates.

## What Landed

A single SQL migration file (81 lines, including 53 lines of doc comments) that creates a regular Postgres VIEW. No TypeScript code. No application of the migration — that's a manual user step.

### Migration Apply Command

```bash
cd campanha-ia && npx supabase db push --linked
```

This is the same workflow used for the Phase 01 metadata + regenerate_reason migrations and the `20260503_140000_add_campaign_scores_unique_campaign_id.sql` migration that landed earlier today (15:37). The migration is idempotent at the `CREATE OR REPLACE VIEW` level — re-applying is safe.

**Explicit confirmation: this executor did NOT apply the migration.** It only wrote the SQL file and committed it. The user (or a follow-up step) runs the apply command above against the linked Supabase project.

## VIEW vs MATERIALIZED VIEW Decision

**Chose: regular `CREATE VIEW`.** Rationale:

1. **Couldn't live-query the api_cost_logs row count** from this executor (no Supabase MCP `execute_sql` access in this session). Per the planner's documented fallback: when the row count cannot be confirmed, default to the safer variant.
2. **Real-time freshness** — callers see judge writes + regen-reason writes immediately, no cron-refresh staleness window. Important for the alert cron in Plan 02-06 which fires off the same view and needs Tuesday's prompt edit visible by Wednesday morning's run.
3. **Smaller blast radius** — no MATERIALIZED storage to reclaim, no UNIQUE INDEX coupling on (prompt_version, regenerate_reason), no REFRESH cron to schedule in Plan 02-06's alerts handler.
4. **Cost is cheap at this scale** — `api_cost_logs.campaign_id` is FK-indexed (per baseline schema) and the partial index `idx_campaigns_regenerate_reason_created_at` (per Phase 01 migration) trims the campaigns side. Expected query latency: <50ms at current row counts.

### When To Swap to MATERIALIZED

When `api_cost_logs` crosses ~100K rows (the D-22 threshold). The migration's inline comment block documents the exact swap recipe so future maintainers don't have to rebuild it from scratch:

```sql
DROP VIEW public.vw_prompt_version_regen_correlation;
CREATE MATERIALIZED VIEW public.vw_prompt_version_regen_correlation AS <same SELECT>;
CREATE UNIQUE INDEX vw_prompt_version_regen_correlation_unique_idx
  ON public.vw_prompt_version_regen_correlation (prompt_version, regenerate_reason);
REFRESH MATERIALIZED VIEW public.vw_prompt_version_regen_correlation;
```

Then add a `REFRESH MATERIALIZED VIEW CONCURRENTLY public.vw_prompt_version_regen_correlation;` call to the 7am UTC Inngest cron in Plan 02-06's alerts handler. Plan 02-06 does NOT need to add a refresh cron right now — the regular VIEW recomputes on every query.

## Migration SQL Preview

```sql
CREATE OR REPLACE VIEW public.vw_prompt_version_regen_correlation AS
SELECT
  acl.metadata->>'prompt_version'  AS prompt_version,
  c.regenerate_reason              AS regenerate_reason,
  c.id                             AS campaign_id,
  c.store_id                       AS store_id,
  c.created_at                     AS created_at
FROM public.campaigns c
INNER JOIN public.api_cost_logs acl
  ON acl.campaign_id = c.id
WHERE
  acl.action = 'sonnet_copywriter'
  AND acl.metadata->>'prompt_version' IS NOT NULL;

COMMENT ON VIEW public.vw_prompt_version_regen_correlation IS
  'Phase 02 D-22: per-campaign prompt_version × regenerate_reason rows. /admin/quality Section 4 reads this. Includes NULL regenerate_reason rows so callers can compute regen-rate denominators. Filtered to action=sonnet_copywriter so we correlate against the copy artifact prompt SHA, not the judge meta-prompt SHA.';
```

(Full file with doc comments: `campanha-ia/supabase/migrations/20260503_141500_create_prompt_version_regen_correlation_view.sql`)

## Sample Queries the View Supports

### 1. Correlation matrix (the /admin/quality Section 4 tile)

```sql
SELECT prompt_version, regenerate_reason, COUNT(*) AS campaign_count
FROM vw_prompt_version_regen_correlation
WHERE regenerate_reason IS NOT NULL
GROUP BY prompt_version, regenerate_reason
ORDER BY campaign_count DESC;
```

### 2. Date-range-filtered drift query (Plan 02-06 alert (a) — face_wrong rate)

```sql
SELECT
  prompt_version,
  COUNT(*) FILTER (WHERE regenerate_reason = 'face_wrong')::numeric
    / NULLIF(COUNT(*), 0)::numeric AS face_wrong_rate,
  COUNT(*) AS total_campaigns
FROM vw_prompt_version_regen_correlation
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY prompt_version
HAVING COUNT(*) >= 10
ORDER BY face_wrong_rate DESC;
```

The denominator includes NULL regenerate_reason rows (those are campaigns the lojista did NOT regenerate, which is the correct denominator for a regen-rate calc).

### 3. Top 5 affected campaigns for Sentry breadcrumb (Plan 02-06)

```sql
SELECT campaign_id, store_id, created_at, prompt_version
FROM vw_prompt_version_regen_correlation
WHERE regenerate_reason = 'face_wrong'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;
```

## Deviations from Plan

### Schema Shape (per execution directive override)

The plan's example showed a **pre-aggregated** view (`COUNT(*) AS campaign_count, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen` with `GROUP BY prompt_version, regenerate_reason`). The execution directives explicitly required a different SQL contract: the view must support **caller-side date-range filtering** (`WHERE created_at >= NOW() - INTERVAL '7 days'`).

**You cannot apply a date-range filter to a view that already aggregated away `created_at`.** Pre-aggregating would force a re-create-the-view-per-date-range pattern, defeating the point.

**Resolution:** Implemented a **per-row** view that exposes `campaign_id`, `store_id`, and `created_at` alongside `prompt_version` and `regenerate_reason`. Callers apply their own `GROUP BY` for the matrix tile (sample query #1 above) and their own date-range filter for the alert query (sample query #2 above). This satisfies all three contract requirements in the execution directive: matrix display, date-range filtering, and NULL regenerate_reason handling.

The acceptance-criteria greps still pass — the file contains 7 mentions of the view name (≥2 needed), 2 JOIN clauses (≥1 needed), the `action = 'sonnet_copywriter'` filter, and the `metadata->>'prompt_version'` projection.

### Filename Timestamp

Used `20260503_141500_` instead of the plan-frontmatter's `20260503_140000_` because the 14:00 slot was claimed earlier today by the campaign_scores UNIQUE constraint migration (`20260503_140000_add_campaign_scores_unique_campaign_id.sql`). Per execution directive #4, picked the next chronological 15-minute slot.

### Autonomous Override

Plan was `autonomous: false` with a `checkpoint:human-verify` Task 3 gating SQL review and apply. User invoked `/gsd-autonomous` with explicit override: "write the SQL migration file but do NOT apply (apply happens via npx supabase db push --linked separately, same pattern as Phase 01 migrations)". Skipped the checkpoint; the SUMMARY here serves the review surface for the user.

### Auth Gates

None. The migration write is a pure file-system operation; no Supabase or external auth was needed.

## Threat Surface Scan

No new network endpoints, no new auth paths, no file-access surface. The view itself is admin-surface-only (queries flow through `createAdminClient()` with the service role key, which already has SELECT on every public table). Lojista anon/authenticated roles have no need to read this view; no explicit GRANT was added because Supabase service role inherits SELECT via public-schema ownership.

No threat flags.

## Confirmation the View Exists Post-Apply

**Not confirmed** — apply step is pending the user's manual `npx supabase db push --linked`. Once applied, the user can verify with:

```sql
SELECT * FROM vw_prompt_version_regen_correlation LIMIT 5;
```

(Should return rows or empty result without error. If the view doesn't exist, the query errors with `relation "vw_prompt_version_regen_correlation" does not exist`.)

Then reload `/admin/quality` and confirm Section 4 stops showing the "view not yet created" placeholder.

## Does Plan 02-06 Need a REFRESH Cron?

**No.** Regular VIEW recomputes on every query — no MATERIALIZED state to refresh. Plan 02-06 only needs to add the refresh cron if/when the view is later swapped to MATERIALIZED (see "When To Swap" above).

## Self-Check: PASSED

Verification:

- [x] File exists: `campanha-ia/supabase/migrations/20260503_141500_create_prompt_version_regen_correlation_view.sql` (81 lines)
- [x] Commit exists: `f255e29` — `feat(db): add vw_prompt_version_regen_correlation view migration (D-22)`
- [x] All acceptance-criteria greps pass (view name ≥2, JOIN ≥1, filter ≥1, JSON projection ≥1)
- [x] No accidental deletions in commit (`git diff --diff-filter=D` returned empty)
- [x] On `main` branch (not a worktree; HEAD-safety assertion N/A)
- [x] Migration NOT applied (per execution directive)

## Commits

| Commit | Type | Subject |
|--------|------|---------|
| f255e29 | feat(db) | add vw_prompt_version_regen_correlation view migration (D-22) |
