---
phase: 02-quality-loop
plan: 02
subsystem: testing
tags: [promptfoo, evals, github-actions, dryrun, ci, golden-set, observability]

# Dependency graph
requires:
  - phase: 01-ai-pipeline-hardening
    provides: "runCampaignPipeline interface + logModelCost helper + prompt_version SHAs + sonnet-copywriter test pattern"
provides:
  - "evals/ scaffold with golden-set/, fixtures/, results/ subdirs (D-15)"
  - "Golden-set entry schema-by-example doc (D-16)"
  - "PipelineInput.dryRun flag + 3 guard sites in pipeline.ts (D-18)"
  - "evals/run.ts dry-run driver + 7 safety tests (D-17, C-02)"
  - "evals/promptfoo.config.yaml pass-by-default config (D-19, D-24)"
  - "promptfoo ^0.121.9 as devDep (D-20)"
  - ".github/workflows/eval-on-pr.yml observability-only CI (D-19, D-24)"
  - "Reserved Inngest emit guard slot for Plan 02-03 at pipeline.ts:328"
affects: [02-03-judge-wiring, 02-04-quality-dashboard, 02-05-alerts, phase-2.5-labeling]

# Tech tracking
tech-stack:
  added: ["promptfoo ^0.121.9", "tsx (transient via npx in CI)"]
  patterns: ["dryRun-as-side-effect-gate", "golden-set-skip-prefix (id startsWith _)", "observability-only-CI (continue-on-error belt-and-suspenders)"]

key-files:
  created:
    - "campanha-ia/evals/.gitignore"
    - "campanha-ia/evals/golden-set/SCHEMA.md"
    - "campanha-ia/evals/golden-set/example.json"
    - "campanha-ia/evals/golden-set/.gitkeep"
    - "campanha-ia/evals/fixtures/.gitkeep"
    - "campanha-ia/evals/results/.gitkeep"
    - "campanha-ia/evals/promptfoo.config.yaml"
    - "campanha-ia/evals/run.ts"
    - "campanha-ia/evals/run.test.ts"
    - "campanha-ia/src/lib/ai/pipeline.test.ts"
    - ".github/workflows/eval-on-pr.yml"
  modified:
    - "campanha-ia/src/lib/ai/pipeline.ts"
    - "campanha-ia/package.json"
    - "campanha-ia/package-lock.json"
    - "campanha-ia/vitest.config.ts"

key-decisions:
  - "Promptfoo runs with placeholder is-json assert + echo provider (D-24 pass-by-default) — no live LLM provider until Phase 2.5 wires file://./results/last-run.jsonl"
  - "Pre-VTO pose-history READ runs even under dryRun:true (it's a SELECT, not a mutation — useful for evals to exercise the same pose-blocking logic as production)"
  - "VTO logModelCost in gemini-vto-generator.ts:437 NOT wrapped (out of scope per plan — flagged for Plan 02-03 follow-up)"
  - "Single tsx invocation via npx in CI (no script entry, no devDep — tsx downloads on the fly)"
  - "vitest include glob widened to evals/**/*.test.ts (Rule 2 — test wouldn't run otherwise)"

patterns-established:
  - "dryRun gate: optional boolean param threaded through PipelineInput, every side-effect site wrapped in if (!input.dryRun)"
  - "Golden-set skip-prefix: entries with id starting '_' are loaded but never executed (lets schema example ship without polluting CI runs)"
  - "Observability-only CI: continue-on-error at job + step levels + comment-on-PR via github-script@v7 — flips to gate by removing those flags in Phase 2.5"

requirements-completed: [D-15, D-16, D-17, D-18, D-19, D-20, D-24]

# Metrics
duration: ~25min
completed: 2026-05-03
---

# Phase 02 Plan 02: Eval Scaffold Summary

**Promptfoo-based eval infrastructure with dryRun-instrumented pipeline + observability-only CI — Phase 2.5 onramp is now a 3-line PR (drop continue-on-error, swap placeholder asserts, wire API keys).**

## Performance

- **Duration:** ~25 min (5-min npm install dominated)
- **Started:** 2026-05-03T17:55Z (approx)
- **Completed:** 2026-05-03T18:20Z (approx)
- **Tasks:** 3 (all autonomous, no checkpoints)
- **Files created:** 11
- **Files modified:** 4

## Accomplishments

- **dryRun gate landed** — `PipelineInput.dryRun?: boolean` (pipeline.ts:88) with three guard sites wrapping every cost-log call + the post-VTO pose-history Supabase update. Default behavior preserved (Phase 01 tests remain green).
- **evals/ scaffold + Promptfoo CI** — full directory tree, schema doc, runner, GitHub Action triggering on `lib/ai/**` + `evals/**` PR changes. Workflow runs Promptfoo + posts a comment to the PR but NEVER fails the check (D-24).
- **Reserved Inngest emit slot for Plan 02-03** — comment block at pipeline.ts:328 documents exactly where 02-03's `inngest.send('campaign/judge.requested', ...)` lands inside an existing `if (!input.dryRun)` guard.
- **13 new tests added, 0 regressions** — pipeline.test.ts (6) + run.test.ts (7). Total project test count: 82 → 95.

## Task Commits

Each task was committed atomically:

1. **Task 1a — Install promptfoo as devDep** — `7a46e31` (chore)
2. **Task 1b — Scaffold evals/ + Promptfoo config** — `8b58b8c` (feat)
3. **Task 2 — pipeline.ts dryRun param + guards + tests** — `fa65072` (feat)
4. **Task 3a — evals/run.ts driver + dry-run safety tests** — `ee103c3` (feat)
5. **Task 3b — eval-on-pr.yml GitHub Action** — `20c0808` (ci)

_Note: per the plan's TDD pattern, Task 2 lands test + impl atomically (test alone breaks tsc without the dryRun field). The TDD RED phase was verified locally by running pipeline.test.ts before adding the guards (2 of 6 cases failed as expected) — see commit message for details._

**Plan metadata commit:** _pending — appended after this SUMMARY is written._

## File Tree Created

```
campanha-ia/evals/
├── .gitignore                       # excludes large fixtures + per-PR results
├── golden-set/
│   ├── .gitkeep
│   ├── SCHEMA.md                    # schema-by-example doc per AI-SPEC §5.3
│   └── example.json                 # id="_example_do_not_run" — skipped by run.ts
├── fixtures/
│   └── .gitkeep                     # large image bytes go here, gitignored
├── results/
│   └── .gitkeep                     # JSONL + Promptfoo outputs, gitignored
├── promptfoo.config.yaml            # placeholder config, exits 0 today
├── run.ts                           # D-17 driver
└── run.test.ts                      # 7 dry-run safety tests

.github/workflows/
└── eval-on-pr.yml                   # observability-only CI

campanha-ia/src/lib/ai/
└── pipeline.test.ts                 # 6 cases on the dryRun guard contract
```

## dryRun Guard Locations (pipeline.ts post-modification)

These are the line numbers Plan 02-03's executor needs to find the right insertion point for the Inngest emit:

| Guard | Line | What it guards |
|-------|------|----------------|
| Analyzer logModelCost | 188 | `if (!input.dryRun && input.storeId)` — analyzer cost-log |
| Sonnet logModelCost | 232 | `if (!input.dryRun && input.storeId)` — copywriter cost-log inside copyPromise.then |
| Pose-history Supabase update | 311 | `if (!input.dryRun && input.storeId && imageResult.successCount > 0)` — fire-and-forget IIFE |
| **02-03 Inngest emit slot** | **328** | Comment block reserves the convention; 02-03 adds `inngest.send(...)` here |

## GitHub Action paths filter (confirmed)

```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - 'campanha-ia/src/lib/ai/**'
      - 'campanha-ia/evals/**'
      - 'campanha-ia/promptfoo.config.yaml'
      - '.github/workflows/eval-on-pr.yml'
```

`continue-on-error: true` appears 3 times (1 job-level + 2 step-level) — belt-and-suspenders per D-24.

## Tests Added

**pipeline.test.ts (6 cases — `src/lib/ai/pipeline.test.ts`)**
1. `dryRun:true → logModelCost not called (analyzer + sonnet sites)`
2. `dryRun:true → createAdminClient invoked once (read), not twice (write)`
3. `dryRun:true → return shape still populated for eval consumers`
4. `dryRun:false → logModelCost called twice (Phase 01 behavior preserved)`
5. `dryRun omitted → defaults to false (backwards-compat)`
6. `dryRun:false → createAdminClient invoked twice (read + write)`

**run.test.ts (7 cases — `evals/run.test.ts`, C-02 dry-run safety mandate)**
1. `loadEntries returns [] on missing dir (ENOENT-safe)`
2. `loadEntries skips id-prefix '_' (reserved skip-prefix)`
3. `loadEntries ignores non-.json files`
4. `runEntries ALWAYS calls runCampaignPipeline with dryRun: true`
5. `runEntries NEVER touches createAdminClient or logModelCost (proxy for "no DB writes")`
6. `runEntries writes one JSONL line per entry to configured path`
7. `runEntries returns entriesProcessed:0 with informational log on empty input (D-24 pass-by-default)`

## Verification

- **`npx tsc --noEmit`:** 0 errors (clean)
- **`npx vitest run`:** 12 test files, 95 tests pass (82 baseline + 13 new)
- **`npx tsx evals/run.ts`:** exits 0 with `no entries to evaluate (Phase 02 — Phase 2.5 will populate golden-set)` — only `_example_do_not_run` present, correctly skipped
- **`npx promptfoo eval --config evals/promptfoo.config.yaml`:** exits 0, 1 placeholder pass, results land at `evals/results/promptfoo-output.json`
- **`npx promptfoo --version`:** 0.121.9

## Decisions Made

- **Promptfoo placeholder = `echo` provider + `is-json` assert on `"{}"`** — chose this over `tests: []` (which Promptfoo treats as "no tests defined" warning) so the CLI exits with a clean PASS for the PR comment to render meaningfully. Phase 2.5 swaps this for the real assertions.
- **Pre-VTO pose-history READ left ungated** — D-18 contract says dryRun gates *side effects*, and a SELECT is not a side effect. Tests assert on `createAdminClient` invocation count (1 under dryRun = read; 2 without = read + write).
- **VTO logModelCost in gemini-vto-generator.ts:437 left unguarded** — out of scope per plan (Task 2 `<read_first>` block names only pipeline.ts call sites). Flagged below as deferred.
- **Single tsx invocation via `npx --yes tsx`** — avoids adding tsx as a devDep just for one CI step. CI cold-start cost is ~3s (negligible vs the 5-min npm install).
- **vitest config widened to include `evals/**/*.test.ts`** — without this, run.test.ts wouldn't execute (only `src/**` and `tests/**` were included). Rule 2 — missing critical functionality (the C-02 mandated test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] promptfoo outputPath wrote to wrong cwd-relative location**
- **Found during:** Task 1 (Promptfoo smoke test after install)
- **Issue:** `outputPath: results/promptfoo-output.json` in promptfoo.config.yaml is interpreted relative to the CLI invocation cwd (`campanha-ia/`), not the config file. So the output landed at `campanha-ia/results/promptfoo-output.json` (a stray top-level dir) instead of `campanha-ia/evals/results/`.
- **Fix:** Changed to `outputPath: evals/results/promptfoo-output.json` and removed the stray dir before staging anything. Added an explanatory comment in the YAML.
- **Files modified:** `campanha-ia/evals/promptfoo.config.yaml`
- **Verification:** Re-ran `npx promptfoo eval --config evals/promptfoo.config.yaml` — output now lands at the gitignored evals/results/ path.
- **Committed in:** `8b58b8c` (Task 1 scaffold commit)

**2. [Rule 1 - Bug] example.json had typo `mediaType_model` instead of `modelMediaType`**
- **Found during:** Task 1 (cross-checking PipelineInput field names)
- **Issue:** The schema example carried `"mediaType_model": "image/png"` which doesn't exist on PipelineInput.
- **Fix:** Renamed to the actual field `modelMediaType`.
- **Files modified:** `campanha-ia/evals/golden-set/example.json`
- **Verification:** node -e check on file parses + `id == "_example_do_not_run"` + `labels == {}`.
- **Committed in:** `8b58b8c`

**3. [Rule 2 - Missing Critical] vitest.config.ts include glob didn't cover evals/**
- **Found during:** Task 3 (writing run.test.ts)
- **Issue:** vitest `include` was `["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"]` — `evals/run.test.ts` would never be picked up by the test runner. The C-02 dry-run safety tests (mandatory per CONTEXT.md) would have been dead code.
- **Fix:** Added `evals/**/*.test.ts` to the include array.
- **Files modified:** `campanha-ia/vitest.config.ts`
- **Verification:** `npx vitest run` now picks up run.test.ts (visible in the 12-file output).
- **Committed in:** `ee103c3` (Task 3a)

**4. [Rule 3 - Blocking] tsc rejected `targetLocale: "pt-BR"` literal in test fixture**
- **Found during:** Task 3 (post-test tsc check)
- **Issue:** `validEntry.form_input.targetLocale = "pt-BR"` was widened to `string` (not the literal `"pt-BR"`), failing `Type 'string' is not assignable to type '"pt-BR" | "en" | undefined'`.
- **Fix:** Added `as const` to the literal.
- **Files modified:** `campanha-ia/evals/run.test.ts`
- **Verification:** `npx tsc --noEmit` → exit 0.
- **Committed in:** `ee103c3`

**5. [Rule 1 - Bug] First Task 1 commit attempt accidentally swept in parallel agent's crialook-app changes**
- **Found during:** Task 1 commit (`git status` showed `M  crialook-app/...` already staged by parallel Plan 02-01 agent)
- **Issue:** Initial `git reset HEAD <files>` did NOT unstage them (status still showed col-1 `M`). When I then `git add` for my package files, the existing staged crialook-app files rode along. Commit `cb7f4ab` landed with crialook-app/historico.tsx + lib/i18n/strings.ts attached to a `chore(deps): install promptfoo` message — wrong attribution + scope violation.
- **Fix:** `git reset --soft HEAD~1` (preserves all files staged) → `git restore --staged crialook-app/...` (correctly unstages without touching working tree) → re-commit with only campanha-ia package files. Verified the redo: commit `7a46e31` shows only 2 files changed.
- **Files modified:** N/A (git history surgery, working tree untouched)
- **Verification:** `git show --stat 7a46e31` lists only `campanha-ia/package.json` + `campanha-ia/package-lock.json`. Parallel agent's crialook-app work was preserved in working tree and they committed it themselves in `58bddb2` + `fde951f` + `7124a77`.
- **Committed in:** N/A (history surgery — soft reset is permitted per destructive_git_prohibition since it's not `--hard`)

---

**Total deviations:** 5 auto-fixed (2 bugs + 1 missing critical + 1 blocking type error + 1 git-state recovery)
**Impact on plan:** All 5 fixes were necessary for correctness. No scope creep — every fix was directly caused by Task work. The git-state recovery surfaced a real coordination risk in parallel-execution mode that future executors should watch for (running with already-staged files from a parallel agent).

## Issues Encountered

- **5-min npm install dominated wall time** — promptfoo pulls 686 transitive packages (it bundles its own LLM SDK adapters). Future PRs touching package-lock.json will pay this CI cost too. Phase 2.5 may want to evaluate whether `promptfoo` can be run via `npx --yes promptfoo@^0.121` in CI to avoid lockfile bloat (trade: cold-start vs. lockfile size). Logged for later — not blocking.
- **promptfoo deprecation warnings** — `prebuild-install@7.1.3` and `boolean@3.2.0` are flagged "no longer maintained" in its dep tree. 8 moderate-severity audit findings. Not blocking; promptfoo is a dev tool, not production runtime. Phase 2.5 can `npm audit fix` if any rise to high.
- **CRLF warnings on Windows** — every Write tool call surfaced `LF will be replaced by CRLF` warnings. Cosmetic; the files commit cleanly with `\n` thanks to git's autocrlf normalization. Not changed.

## Deferred Issues (out of scope, logged for follow-up)

**1. VTO logModelCost in gemini-vto-generator.ts:437 not gated by dryRun**
- The plan's Task 2 `<read_first>` block scoped the wrap to pipeline.ts only. The VTO cost-log lives inside `generateWithGeminiVTO` which doesn't currently receive a dryRun param.
- **Impact:** When evals/run.ts processes a real golden-set entry in Phase 2.5, the VTO cost-log row WILL still be written.
- **Fix path:** Plan 02-03 (or a tiny follow-up plan) threads `dryRun?: boolean` into `GeminiVTOInput`, wraps the line-437 logModelCost call. Pipeline.ts:259 already passes the input — just add `dryRun: input.dryRun` there.
- **Documented in:** `pipeline.ts` Task 2 commit message (`fa65072`).

## User Setup Required

None — eval scaffold is observability-only; no env vars or external service config needed. Phase 2.5 will require `ANTHROPIC_API_KEY` + `GOOGLE_API_KEY` in CI secrets when run.ts starts hitting live APIs against labeled fixtures.

## TDD Gate Compliance

Task 2 was `tdd="true"` per the plan. Strict TDD would be RED commit → GREEN commit, but the test file (`pipeline.test.ts`) breaks `tsc --noEmit` without the `dryRun` field on PipelineInput, so the RED commit would carry a broken type-check. I consolidated test + impl into a single `feat` commit (`fa65072`) and verified the RED phase locally before adding the implementation:

```
RED phase verification (before pipeline.ts edits):
  Tests  2 failed | 4 passed (6)
   FAIL  src/lib/ai/pipeline.test.ts > does NOT call logModelCost
   FAIL  src/lib/ai/pipeline.test.ts > does NOT update pose-history

GREEN phase verification (after pipeline.ts edits):
  Test Files  1 passed (1)
        Tests  6 passed (6)
```

The two side-effect-gating assertions failed first; once the guards landed, all 6 passed. The plan's TDD intent (test-first design pressure) was honored even though the commits weren't split.

## Next Phase Readiness

**Plan 02-03 (judge wiring, Wave 2)** can land cleanly:
- Inngest emit insertion point pre-installed at `pipeline.ts:328` inside the `if (!input.dryRun)` convention
- The dryRun param is already part of PipelineInput — judge job receives it via the event payload (or implicitly by checking the gate)
- 02-03 should also wrap the VTO cost-log (deferred issue above) — 5-line follow-up

**Phase 2.5 onramp (3-line PR flips the gate):**
1. Drop `continue-on-error: true` from `.github/workflows/eval-on-pr.yml` (job-level + 2 step-level lines)
2. Replace the `tests: [...]` placeholder in `evals/promptfoo.config.yaml` with per-dimension assertions sourced from `DOMAIN-RUBRIC.md`
3. Add `ANTHROPIC_API_KEY` + `GOOGLE_API_KEY` env to the `npx tsx evals/run.ts` step in the workflow
4. Drop labeled JSON entries into `evals/golden-set/` (the actual labeling work)

## Self-Check: PASSED

Files verified:
- `campanha-ia/evals/.gitignore` FOUND
- `campanha-ia/evals/golden-set/SCHEMA.md` FOUND
- `campanha-ia/evals/golden-set/example.json` FOUND
- `campanha-ia/evals/promptfoo.config.yaml` FOUND
- `campanha-ia/evals/run.ts` FOUND
- `campanha-ia/evals/run.test.ts` FOUND
- `campanha-ia/src/lib/ai/pipeline.test.ts` FOUND
- `.github/workflows/eval-on-pr.yml` FOUND

Commits verified:
- `7a46e31` FOUND (chore: install promptfoo)
- `8b58b8c` FOUND (feat: scaffold)
- `fa65072` FOUND (feat: dryRun guards)
- `ee103c3` FOUND (feat: run.ts + tests)
- `20c0808` FOUND (ci: GH Action)

---
*Phase: 02-quality-loop*
*Completed: 2026-05-03*
