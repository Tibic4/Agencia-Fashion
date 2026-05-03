---
phase: 02-quality-loop
plan: 04
subsystem: admin-dashboard
tags: [admin, quality, dashboard, server-component, supabase, llm-as-judge, empty-state, view-tolerance, sentinel-filter]

# Dependency graph
requires:
  - phase: 02-quality-loop
    plan: 03
    provides: "campaign_scores rows from setCampaignScores; falha_judge sentinel convention; api_cost_logs.metadata.prompt_version with action='judge_quality'"
  - phase: 01-ai-pipeline-hardening
    provides: "/admin/custos visual template; gray-900 palette; requireAdmin → redirect('/gerar') guard; api_cost_logs.metadata schema"
provides:
  - "campanha-ia/src/app/admin/quality/page.tsx — server component rendering 4 sections"
  - "getQualityData() named export — pure-ish data loader, callable from tests without React render"
  - "Admin nav `Qualidade` link wired into layout for discoverability"
  - "Empty-state, missing-view, and sentinel-filter behavior pinned by 3 vitest cases"
affects: [02-05-correlation-view, 02-06-sentry-alerts, phase-2.5-labeling, phase-03-observability]

# Tech tracking
tech-stack:
  added: []  # no new deps; pure additive on existing Next + Tailwind + Supabase admin
  patterns:
    - "Server-component named-export data loader (`getQualityData`) for test-without-render"
    - "Promise.all with .then(ok, fail) catch arm to tolerate missing Postgres views"
    - "D-02 sentinel filter at the data-loader boundary (filter falha_judge BEFORE aggregation)"
    - "Mirroring /admin/custos visual contract (rounded-2xl, bg-gray-900, border-gray-800, emerald/red delta colors)"

key-files:
  created:
    - "campanha-ia/src/app/admin/quality/page.tsx"
    - "campanha-ia/src/app/admin/quality/page.test.tsx"
  modified:
    - "campanha-ia/src/app/admin/layout.tsx"  # added Qualidade nav link

key-decisions:
  - "Mirror /admin/custos exactly — same Tailwind classes, same admin-guard pattern, NO redesign per execution directive §4"
  - "getQualityData() exported as named function so the test can call the loader directly without rendering the React tree (Next.js permits named exports from server-component page.tsx files)"
  - "Correlation Section 4 ships as a plain HTML table (not a heatmap) — heatmap UI deferred until Plan 02-05's view columns are inspected against real data; tracked in deferred-items.md"
  - "Differentiate the two campaign_scores queries (7d vs 14d) in the test mock by detecting whether `.lt()` was called on the chain rather than by call-counter — call-counter pattern is brittle under Promise.all reordering"
  - "Added 'Qualidade' link to admin nav (Rule 2 add — a new admin page that isn't navigable is functionally a stub)"

requirements-completed: [D-21]

# Metrics
duration: ~5min
completed-date: 2026-05-03
tasks-completed: 2/2
files-created: 2
files-modified: 1
commits:
  - "35b13f2 — feat(admin): add /admin/quality dashboard page (D-21)"
  - "fcae39b — test(02-04): empty-state + missing-view + sentinel-filter for /admin/quality"
---

# Phase 02 Plan 04: Admin Quality Dashboard Summary

`/admin/quality` server-component page surfaces LLM-as-judge output (the `campaign_scores` rows written by `judgeCampaignJob` from Plan 02-03) over a 7-day rolling window, with WoW deltas, per-`prompt_version` drift breakdown, worst-rated samples, and the `prompt_version × regenerate_reason` correlation matrix from Plan 02-05.

## What Shipped

### `campanha-ia/src/app/admin/quality/page.tsx` (new)

Four sections, mirroring `/admin/custos` visual contract:

1. **Means tile grid** — 4-card `grid-cols-2 md:grid-cols-4` mirroring the `/admin/custos` budget grid. One tile per dimension (`naturalidade`, `conversao`, `clareza`, `aprovacao_meta`). Each shows the 7-day mean (`text-2xl font-bold text-white`), a WoW delta with directional arrow (emerald-400 up, red-400 down, gray-400 flat), and a "vs semana anterior" subtitle. A bonus full-width `nota_geral` tile sits below the 4-card row, surfaces the failure-count footer ("X válida(s) · Y rejeitada(s)").
2. **Per-prompt_version aggregate table** — top 10 prompt SHAs by row count, columns: SHA / N / 5 dimension means. JOINs `api_cost_logs.metadata.prompt_version` (filtered by `action='judge_quality'`) with `campaign_scores` by `campaign_id` in JS-land (no view needed for this section).
3. **Top 10 worst-rated last 7 days** — sorted asc by `nota_geral`. Columns: campaign id (truncated to 8 chars), nota_geral, nivel_risco, justificativa snippet (first 100 chars from `melhorias.nota_geral`).
4. **Correlation matrix** — reads from `vw_prompt_version_regen_correlation` (Plan 02-05). Wrapped in `.then(ok, fail)` so a missing view does NOT crash `Promise.all`; the catch arm sets `data.correlation = null` and the UI renders a graceful PT-BR placeholder ("Visão de correlação ainda não foi aplicada. Rode a migração do Plan 02-05..."). When the view exists, columns are derived from the first row's keys at render time so the matrix adapts to whatever shape Plan 02-05 lands.

### `campanha-ia/src/app/admin/layout.tsx` (modified)

Added `{ href: "/admin/quality", label: "Qualidade", icon: <span className="text-sm">📊</span> }` to `adminNav` between Custos and Logs. A new admin page that isn't in the nav is a stub — Rule 2 add.

### `campanha-ia/src/app/admin/quality/page.test.tsx` (new)

Three vitest cases pin the dashboard's resilience:

1. **Empty state** — zero rows in every queried table. `means7d.<dim>` is `null` (NOT 0, NOT NaN — the UI relies on null to render `—` instead of `0.00`). `wowDelta` is null. Tables are empty arrays. `correlation` is `[]`. `totalRows = validCount = failureCount = 0`.
2. **Missing correlation view** — when the supabase chain rejects (Postgres `42P01`), the `.then(ok, fail)` catch arm converts to `{ data: null }`. The other 3 sections still resolve cleanly.
3. **D-02 sentinel filter** — one row with `nivel_risco='falha_judge'` increments `totalRows` and `failureCount` but NOT `validCount`; means stay null (no aggregation over the sentinel); worst-rated table is empty (it iterates valid rows only).

Mock strategy: chainable supabase builder that dispatches by table name and differentiates the two `campaign_scores` queries (7d vs 14d) by detecting whether `.lt()` was called on the chain. Avoids the brittle call-counter pattern that would break if `Promise.all` reorders execution.

## Visual Contract — Tailwind Classes Borrowed from `/admin/custos`

(Documented per plan output spec §3 — when `/admin/custos` is restyled, re-sync `/admin/quality` with the same edits.)

| Element | Class string |
|---|---|
| Section card | `bg-gray-900 border border-gray-800 rounded-2xl p-5` |
| Card grid | `grid grid-cols-2 md:grid-cols-4 gap-4` |
| Section heading | `text-sm font-semibold text-white mb-1` (with `mb-4` if there's no subtitle) |
| Subtitle | `text-xs text-gray-400 mb-4` |
| Big number | `text-2xl font-bold text-white` (or `text-3xl` for the headline `nota_geral` tile) |
| Caption / hint | `text-xs text-gray-500 mt-1` |
| Table head row | `border-b border-gray-800` + `text-xs font-semibold text-gray-400 uppercase` cells |
| Table body row | `divide-y divide-gray-800` + `hover:bg-gray-800/30 transition` |
| Delta arrow up | `text-emerald-400` |
| Delta arrow down | `text-red-400` |
| Delta arrow flat | `text-gray-400` |
| Empty cell value | `text-sm text-gray-500 text-center py-4` |

Banner colors use the same `bg-{color}-500/10 border border-{color}-500/30 text-{color}-400` pattern as the `alertStyles` map in `/admin/custos`. Specifically: `amber` for "aguardando primeiros scores" (matches `warning` level), `orange` for "judge falhou" (between `warning` and `danger`).

## Deviations from Plan

### Auto-applied additions

**1. [Rule 2 — Missing critical functionality] Added `Qualidade` nav link to admin layout**

- **Found during:** Task 1 review (after writing the page).
- **Issue:** A new admin page that isn't in the `adminNav` array is functionally a stub — admins would have to manually type `/admin/quality` to find it. The plan listed `files_modified` as page.tsx + page.test.tsx only, but discoverability is a correctness requirement for an "admin can navigate to /admin/quality" must-have (line 15 of the plan).
- **Fix:** Added one entry to `adminNav` between Custos and Logs. Used a 📊 emoji icon for now; SVG icon can be drawn later as a polish item.
- **Files modified:** `campanha-ia/src/app/admin/layout.tsx`
- **Commit:** included in `35b13f2`

### Section 4 correlation matrix — table over heatmap (per plan §407 escape hatch)

The plan explicitly offered the choice between shipping the JSON dump now and filing a deferred-items entry, OR iterating after Plan 02-05's SUMMARY lands with the view columns inspected. Shipped a plain HTML table (slight upgrade over the JSON dump in the plan example — it adapts column headers from the first row's keys at render time) and filed a deferred-items.md note for "/admin/quality correlation heatmap UI" polish work.

### Helper extraction (`MeanTile` component) — deferred

Considered extracting a shared `<MeanTile>` component between `/admin/custos` (budget tiles) and `/admin/quality` (dimension tiles). Both have the same shape (label / big-number / delta caption). Held off because (a) the budget tiles each have unique sub-content (progress bar in Budget Mensal, no delta in Custo/Campanha) so the shared component would be 4-of-8 props, (b) Phase 03 dashboard polish is the right home for this. Filed for Phase 03.

## Verification Results

- **`npx tsc --noEmit`** — clean (exit 0).
- **`npx vitest run`** — 16 files, 136 tests passed (3 new in `page.test.tsx`).
- **Empty state behavior verified** — Test #1 confirms zero rows resolve to a fully-null aggregate state without throwing.
- **Missing-view tolerance verified** — Test #2 confirms the rejected supabase query becomes `correlation: null` instead of crashing `Promise.all`.
- **Sentinel filtering verified** — Test #3 confirms `falha_judge` rows are counted as failures but excluded from numeric aggregates.

## Auth Gates

None encountered.

## Threat Flags

None — page is read-only over `campaign_scores` + `api_cost_logs.metadata` + the new view, all behind `requireAdmin → redirect('/gerar')`. No new network endpoints, no new write paths, no new auth surface. The `correlation` query reads a previously-not-existing table name, but that's the new view from Plan 02-05's threat model, not this plan's.

## Self-Check: PASSED

- [x] `campanha-ia/src/app/admin/quality/page.tsx` exists.
- [x] `campanha-ia/src/app/admin/quality/page.test.tsx` exists.
- [x] `campanha-ia/src/app/admin/layout.tsx` modified.
- [x] Commit `35b13f2` (feat) present in git log.
- [x] Commit `fcae39b` (test) present in git log.
- [x] tsc clean (exit 0).
- [x] vitest 136/136 pass.
- [x] All grep-based acceptance criteria for Task 1 satisfied (requireAdmin x2, campaign_scores x6, vw_prompt_version_regen_correlation x3, falha_judge x5, dimension labels x5).
- [x] `getQualityData` is exported from page.tsx (1 occurrence).
