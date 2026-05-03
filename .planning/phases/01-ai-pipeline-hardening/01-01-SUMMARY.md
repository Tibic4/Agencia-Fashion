---
phase: 01-ai-pipeline-hardening
plan: 01
subsystem: ai-pipeline
tags: [d-15, prompt-version, supabase-migration, observability, cost-logging]
requires:
  - api_cost_logs table (baseline.sql lines 15-35)
  - buildSystemPrompt(locale) in sonnet-copywriter.ts
  - buildSystemPrompt(input) in gemini-analyzer.ts
  - buildVTOPrompt(...) in gemini-vto-generator.ts
provides:
  - api_cost_logs.metadata jsonb column (after migration applies)
  - computePromptVersion(prompt) helper
  - SONNET_PROMPT_VERSION_PT, SONNET_PROMPT_VERSION_EN exports
  - sonnetPromptVersionFor(locale) selector export
  - ANALYZER_PROMPT_VERSION export
  - VTO_PROMPT_VERSION export
  - metadata.prompt_version on every analyzer/sonnet/VTO cost-log row
affects:
  - api_cost_logs writes from logAnalyzerCost (pipeline.ts)
  - api_cost_logs writes from logSonnetCost (pipeline.ts)
  - api_cost_logs writes from logGeminiVTOCosts (gemini-vto-generator.ts)
  - api_cost_logs writes from generate/route.ts:834 (silent-drop bug — fixed by migration)
tech-stack:
  added: ["node:crypto SHA-256"]
  patterns: ["module-load constant caching for SHA prefixes", "canonical sentinel hashing for dynamic prompt templates"]
key-files:
  created:
    - campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql
    - campanha-ia/src/lib/ai/prompt-version.ts
    - campanha-ia/src/lib/ai/prompt-version.test.ts
  modified:
    - campanha-ia/src/lib/ai/sonnet-copywriter.ts
    - campanha-ia/src/lib/ai/gemini-analyzer.ts
    - campanha-ia/src/lib/ai/gemini-vto-generator.ts
    - campanha-ia/src/lib/ai/pipeline.ts
decisions:
  - "Hash dynamic prompts via canonical sentinel inputs (no modelInfo / no blockedPose for analyzer; '__SCENE__' / normal / no modelInfo for VTO) so SHA stays stable across calls and flips only on template edits."
  - "Locale-split Sonnet versions (PT vs EN) instead of single hash — branching templates would otherwise produce non-deterministic SHA based on traffic mix."
  - "Out-of-scope api_cost_logs writers (model-preview, inngest/functions, nano-banana, db/index, tips/route, backdrop-generator) NOT modified — they belong to D-18 / Plan 04 consolidation."
  - "Corrected planner's documented 'hello world' SHA prefix from 94d18b8636aa to canonical b94d27b9934d (verified via node:crypto reference output)."
metrics:
  duration_min: 9
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 4
  completed: 2026-05-03
status: blocked-on-checkpoint
---

# Phase 01 Plan 01: prompt-version + api_cost_logs.metadata Summary

D-15 infrastructure landed: every analyzer / Sonnet / VTO cost-log row now writes `metadata.prompt_version` (12-char SHA-256 prefix of the system prompt), unblocking "did Tuesday's prompt edit cause Friday's quality dip?" debugging — pending the `metadata jsonb` column migration apply, which is the open checkpoint.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create migration adding `api_cost_logs.metadata jsonb` column | `fa58f34` | `campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql` |
| 2 | Create `prompt-version.ts` module + Vitest cases (TDD) | `9b0c4bb` | `campanha-ia/src/lib/ai/prompt-version.ts`, `prompt-version.test.ts` |
| 3 | Wire `prompt_version` into all 3 cost loggers + cache `*_PROMPT_VERSION` constants | `7304961` (see Deviations) | `sonnet-copywriter.ts`, `gemini-analyzer.ts`, `gemini-vto-generator.ts`, `pipeline.ts` |

## Cached Prompt-Version Constants (boot-time SHA snapshot, 2026-05-03)

| Constant | Module | Value |
|----------|--------|-------|
| `SONNET_PROMPT_VERSION_PT` | `lib/ai/sonnet-copywriter.ts` | `368daa52106b` |
| `SONNET_PROMPT_VERSION_EN` | `lib/ai/sonnet-copywriter.ts` | `6fb4023c4732` |
| `ANALYZER_PROMPT_VERSION`  | `lib/ai/gemini-analyzer.ts`   | `5c900fb19472` |
| `VTO_PROMPT_VERSION`       | `lib/ai/gemini-vto-generator.ts` | `9d5c754caf28` |

Downstream plans (notably D-18 / Plan 04 consolidating into `logModelCost`) should import these constants rather than re-hashing.

## Verification

- `cd campanha-ia && npx tsc --noEmit` → 0 errors.
- `cd campanha-ia && npx vitest run src/lib/ai/prompt-version.test.ts` → 4/4 passing (deterministic SHA, case-sensitivity, empty-string regression, hello-world reference vector).
- Plan-required `grep -c "metadata:.*prompt_version" src/lib/ai/pipeline.ts src/lib/ai/gemini-vto-generator.ts` → `pipeline.ts:2`, `gemini-vto-generator.ts:1` (matches expected — analyzer + Sonnet inserts in pipeline.ts, VTO insert in vto-generator).
- `grep -c "computePromptVersion"` across the three prompt-owning modules → present in each, plus the helper module and its test.

## Migration SQL Preview (FOR REVIEW BEFORE APPLY)

File: `campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql`

```sql
-- ── 20260503_120000_add_api_cost_logs_metadata.sql ──
-- D-15: Add metadata jsonb to api_cost_logs so prompt_version, error_code,
-- and other per-call diagnostics are persisted instead of silently dropped
-- by Supabase. Existing write sites in route.ts:834 and the future
-- logModelCost helper (D-18) target this column.

ALTER TABLE public.api_cost_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Backfill is unnecessary — historical rows have no prompt_version and
-- querying NULL metadata is acceptable. No index needed at Phase 1 volume
-- (~hundreds of rows/day); add a GIN index in Phase 2 if/when admin/custos
-- starts filtering by metadata->>'prompt_version'.
```

### Hidden bug fix unlocked by this migration

`campanha-ia/src/app/api/campaign/generate/route.ts:834` already calls `.insert({ ..., metadata: { error_code, message, retryable } })` against the `api_cost_logs` table today. Since the `metadata` column does not exist in baseline, Supabase silently drops the field — the error-classification metadata for failed pipeline runs has been a no-op since the line was written. Once this migration applies, those error-log fields begin persisting alongside the new `prompt_version` writes.

### Lock/blast-radius profile

Per the plan's threat register (T-01-03): `ADD COLUMN ... jsonb` with no `DEFAULT` and no `NOT NULL` is a metadata-only operation in Postgres ≥ 11 — no table rewrite, no row-lock — so apply to a hot table is safe. Service-role-only writes (existing baseline RLS policies + `createAdminClient` pattern) keep the new column behind the same trust boundary as the rest of the row.

## Apply Command (RUN AFTER USER REVIEW)

```bash
cd campanha-ia && npx supabase db push --linked
```

Post-apply verification (run in Supabase SQL Editor or via MCP `execute_sql`):

```sql
-- (1) column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'api_cost_logs' AND column_name = 'metadata';
-- expect: 1 row, metadata, jsonb

-- (2) after one campaign generation, rows carry prompt_version
SELECT created_at, action, model_used, metadata
FROM api_cost_logs
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC
LIMIT 10;
-- expect: every row's metadata->>'prompt_version' is a 12-char hex string
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Corrected planner's documented SHA reference vector**
- **Found during:** Task 2 (TDD RED).
- **Issue:** Plan stated `computePromptVersion("hello world")` returns `94d18b8636aa`. Actual SHA-256 hex prefix of "hello world" is `b94d27b9934d` (verified via `node -e "..."` reference command embedded in the plan itself — reference and assertion conflicted).
- **Fix:** Test asserts `b94d27b9934d` (canonical). Empty-string vector `e3b0c44298fc` was already correct.
- **Files modified:** `campanha-ia/src/lib/ai/prompt-version.test.ts`.
- **Commit:** `9b0c4bb`.

**2. [Rule 3 — Blocking] TDD RED commit could not be split from GREEN due to pre-commit type gate**
- **Found during:** Task 2.
- **Issue:** `campanha-ia/.husky/pre-commit` runs `npx tsc --noEmit` against the whole project. A standalone RED commit containing only the test file fails the gate (`./prompt-version` module not yet present → TS2307). Cannot bypass without `--no-verify`, which is forbidden.
- **Fix:** Combined RED + GREEN into a single `feat(ai)` commit; the TDD value (driven by failing-test-first evidence in the local run before module write) is preserved in the working flow even though the per-step commit isn't.
- **Files modified:** TDD log only — no extra files.
- **Commit:** `9b0c4bb`.

### Concurrency Collision (Wave 1 sibling-plan interaction)

**3. [Sibling collision] Task 3 changes landed inside an 01-07 commit message instead of an 01-01 one**
- **Found during:** Post-Task-3 staging.
- **Issue:** While I had my 4 AI files staged for Task 3, plan 01-07's commit step ran in a parallel agent and its `git commit` swept up everything in the index. The result: commit `7304961` is titled `feat(admin)(01-07): surface regenerate_reason aggregate in /admin/custos (D-04)` but its diffstat is actually my four AI files (analyzer, vto, pipeline, sonnet — 68 insertions, 8 deletions). Plan 01-06's own SUMMARY (`0fd9796`) describes an identical pattern at its Task 1.
- **Fix attempted:** None possible without rewriting another plan's commit (out of scope; would lose 01-07's actual code). Functional outcome is correct: all D-15 wiring is on `main` HEAD.
- **Audit trail:** This SUMMARY documents the actual provenance of the changes in commit `7304961` so future blame doesn't get misled by the message.
- **Recommendation for orchestrator:** When parallel plans target overlapping working trees, gate `git commit` per-agent with `git commit --only <paths>` to prevent message/diff drift across siblings.

### Threat surface scan
No new auth paths, network endpoints, or trust-boundary surface introduced. The `metadata jsonb` column is service-role-write-only by inheritance of existing `api_cost_logs` RLS posture (baseline). 12-char SHA prefix is a one-way hash — no information disclosure beyond "this row used prompt revision X" (matches the plan's accepted T-01-02 disposition).

### Stub tracking
None — D-15 has zero stub surface.

## Out-of-scope discoveries (logged, NOT fixed)

`grep` for other `api_cost_logs.insert` writers found six additional sites that do NOT yet write `metadata.prompt_version`:

- `campanha-ia/src/lib/model-preview.ts:128`
- `campanha-ia/src/lib/inngest/functions.ts:190`
- `campanha-ia/src/lib/google/nano-banana.ts:79` (D-08 candidate for deletion anyway)
- `campanha-ia/src/lib/db/index.ts:682`
- `campanha-ia/src/app/api/campaign/[id]/tips/route.ts:165`
- `campanha-ia/src/lib/ai/backdrop-generator.ts:206`

These are out-of-scope per plan body ("Do NOT consolidate the loggers in this task — that is D-18 / Plan 04"). The D-18 consolidation will land them all on a single `logModelCost` helper that writes prompt_version uniformly. No action this plan.

## Self-Check: PASSED

- `[FOUND]` `campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql` (Task 1)
- `[FOUND]` `campanha-ia/src/lib/ai/prompt-version.ts` (Task 2)
- `[FOUND]` `campanha-ia/src/lib/ai/prompt-version.test.ts` (Task 2, 4/4 passing)
- `[FOUND]` `metadata: { prompt_version: ... }` in `pipeline.ts` (2 occurrences) and `gemini-vto-generator.ts` (1 occurrence)
- `[FOUND]` commit `fa58f34` (Task 1) on main
- `[FOUND]` commit `9b0c4bb` (Task 2) on main
- `[FOUND]` Task 3 diff present at HEAD; provenance captured under commit `7304961` (see Deviations §3)
- `[FOUND]` `npx tsc --noEmit` returns 0 errors at HEAD
- `[FOUND]` `npx vitest run src/lib/ai/prompt-version.test.ts` returns 4/4 passing at HEAD

## Checkpoint Status

**BLOCKED on `checkpoint:human-verify` (Task 4):** Migration file exists at `campanha-ia/supabase/migrations/20260503_120000_add_api_cost_logs_metadata.sql` but has NOT been applied. Until the migration runs, every new `metadata.prompt_version` write (and the `metadata.error_code` write at `route.ts:834`) silently no-ops because Supabase drops unknown columns. Resume after user reviews the SQL block above and runs the apply command.
