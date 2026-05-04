---
plan_id: 03-04
phase: 3
title: CI ratchet + husky lint-staged wire + README count fix
wave: 2
depends_on: [03-01, 03-02, 03-03]
files_modified:
  - .github/workflows/ci.yml
  - campanha-ia/.husky/pre-commit
  - campanha-ia/package.json
  - README.md
autonomous: true
requirements: [D-01, D-02, D-10, D-11, D-12]
must_haves:
  truths:
    - "CI mobile job runs `npm run lint` and fails the job on lint errors (D-11)"
    - "CI test jobs invoke vitest with `--coverage` so existing 30/35 thresholds become a CI ratchet (D-10) — campanha-ia at 30% lib coverage, crialook-app at 35% lib+hooks coverage"
    - "campanha-ia/.husky/pre-commit invokes lint-staged on top of the existing tsc --noEmit so the dead lint-staged config in campanha-ia/package.json is finally activated (D-01)"
    - "Husky is NOT newly installed at repo root (D-02 N/A — campanha-ia/.husky/ already exists per R-01); we extend the existing pre-commit hook, no `husky install` command needed"
    - "README.md test count line is corrected from 33 to the live count, OR the bare number is replaced with a CI badge — single source of truth (D-12)"
  acceptance:
    - "`.github/workflows/ci.yml` `mobile-typecheck-test` job has a `Lint` step running `npm run lint`"
    - "`.github/workflows/ci.yml` `test` job (campanha-ia) invokes vitest with `--coverage` flag"
    - "`.github/workflows/ci.yml` `mobile-typecheck-test` job invokes vitest with `--coverage` flag"
    - "`grep -c lint-staged campanha-ia/.husky/pre-commit` returns at least 1"
    - "Local commit-time test: making a deliberately-broken commit triggers tsc + lint-staged and is rejected"
    - "README.md no longer contains the literal string `33 testes` (or it contains the new accurate count, e.g. 148)"
---

# Plan 03-04: CI Ratchet + Husky Wire + README

## Objective

Land the four small ratchet/cleanup changes that turn Phase 3's local fixes (plans 03-01..03-03) into CI-enforced contracts:

1. **D-10 — Coverage in CI** for both vitest invocations so the existing thresholds (web: 30/30/25/30 on `src/lib/**` + `src/app/api/**`; mobile: 35/35/30/35 on `lib/**` + `hooks/**`) actually fail CI when regressed.
2. **D-11 — Mobile lint job** in `mobile-typecheck-test` so 03-03's eslint config gates merge.
3. **D-01 — Wire lint-staged** into `campanha-ia/.husky/pre-commit`. The lint-staged config in `campanha-ia/package.json:15-19` exists today but is never invoked (the hook only runs `tsc --noEmit`). Per D-01: activate it. **R-01 update:** husky is already installed under `campanha-ia/.husky/` (and `husky 9` is in the `prepare` script per `campanha-ia/package.json:13`) — D-02 is therefore N/A; no root-level install needed.
4. **D-12 — README fix** at line 169 (`33 testes unitários web (Vitest)`) to either the real count (148 vitest tests in campanha-ia + 45 in crialook-app vitest = 193 total, OR just 148 if the README scopes only to web) or strip the number entirely.

**Wave dependency:** This plan depends on 03-01 / 03-02 / 03-03 because:
- The CI lint job (D-11) requires 03-03's `npm run lint` script to exist.
- The mobile coverage ratchet requires 03-02's vitest fixes (otherwise CI fails on the 1 timing-out test BEFORE we can prove the threshold works).
- The web coverage ratchet requires 03-02's judge.test.ts fix (same reason — 2 timing-out tests would fail CI before threshold check).

## Truths the executor must respect

- **R-01 confirmed:** `campanha-ia/.husky/_/` and `campanha-ia/.husky/pre-commit` already exist. The repo root has NO `.husky/` directory and we are NOT going to add one. Husky lives inside the `campanha-ia/` subproject (per `campanha-ia/package.json:13` `prepare` script: `cd .. && husky campanha-ia/.husky`). D-02's "if .husky/ does not exist, install" clause is therefore satisfied — no new install task needed.
- **R-02 confirmed:** Only 1 Jest test exists today (`__tests__/example-pulsing-badge.test.tsx`). Plan 03-01 owns the typo fix and broken-test repair. This plan inherits "test:rn passes" as a precondition — Wave 2 cannot start until Wave 1 is green.
- **R-03 confirmed:** Existing CI structure has 3 jobs (`lint-typecheck-build`, `test`, `mobile-typecheck-test`), all on `runs-on: ubuntu-latest`, all using `actions/setup-node@v4` with `node-version: 24`. The mobile job uses `npm ci --legacy-peer-deps` per the EAS lock constraint. We patch existing jobs incrementally — no new top-level jobs.
- **Honor the lint-staged-bug comment:** `campanha-ia/.husky/pre-commit` lines 3-7 explicitly document that lint-staged 16 has a Node 24 bug (ENOENT git checkpoint). That comment was written when the choice was "tsc OR lint-staged"; the modern fix is "tsc AND lint-staged with workaround". Two options for D-01 wire:
  - **(A) Use lint-staged with `--no-stash` flag** (which sidesteps the git-checkpoint bug). This is the recommended path.
  - **(B) Pin lint-staged to v15 in `campanha-ia/package.json` devDependencies** if `--no-stash` doesn't fully resolve the bug (lint-staged v15 doesn't have the v16 ENOENT regression).

  The executor verifies which path works on the current Node version and picks one. Update the existing in-hook comment to reflect the new reality.
- **Coverage = ratchet, not new bar:** D-10 says "the existing 30/35 thresholds become a ratchet". Do NOT raise the thresholds in this plan. Only wire `--coverage` and let the existing config-defined thresholds enforce themselves.
- **README test count source-of-truth:** Per D-12, the real number comes from `npm test` output. As of QUALITY.md analysis (2026-05-03): campanha-ia has 148 vitest tests; crialook-app has 45 vitest + 1 jest = 46. Total monorepo = 194. Web-only (the README's framing) = 148. Use 148 OR strip the number per D-12's "if it moves often, replace with link".

## Tasks

### Task 1: Add `--coverage` to both vitest CI invocations

<read_first>
- .github/workflows/ci.yml (full file — lines 45-87 cover the two test jobs)
- campanha-ia/vitest.config.ts (confirm coverage thresholds 30/30/25/30 are configured for `src/lib/**` + `src/app/api/**`)
- crialook-app/vitest.config.ts (confirm coverage thresholds 35/35/30/35 are configured for `lib/**` + `hooks/**`)
- .planning/codebase/QUALITY.md §"Test Inventory" (background on threshold provenance)
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-10)
</read_first>

<action>
Edit `.github/workflows/ci.yml`:

**Job `test` (campanha-ia, lines 45-60).** Change the `Run vitest` step from:

```yaml
      - name: Run vitest
        run: npm test --if-present -- --run
```

to:

```yaml
      - name: Run vitest with coverage
        run: npm test --if-present -- --run --coverage
```

**Job `mobile-typecheck-test` (crialook-app, lines 62-87).** Change the `Run vitest (lib utils)` step from:

```yaml
      - name: Run vitest (lib utils)
        run: npm test
```

to:

```yaml
      - name: Run vitest (lib utils) with coverage
        run: npm test -- --coverage
```

Coverage thresholds defined in each project's `vitest.config.ts` will fail the job if not met. Both configs already set v8 coverage provider — no new dep needed.

**Critical:** The thresholds DO NOT change. We're only flipping the `--coverage` flag on. If 03-02's vitest fixes don't actually result in passing tests (which would prevent coverage from completing), this step also fails — but for the right reason.

Verify the YAML diff: only the two `Run vitest` step blocks should change. Job names, step ordering, environment variables, working-directory blocks all stay identical.
</action>

<acceptance_criteria>
- `grep -c -- "--coverage" .github/workflows/ci.yml` returns at least 2
- `yamllint .github/workflows/ci.yml` (or `python -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'`) succeeds — file is still valid YAML
- The `test` job's vitest step contains `--coverage` (verify with `grep -B 1 'Run vitest with coverage' .github/workflows/ci.yml`)
- The `mobile-typecheck-test` job's vitest step contains `--coverage`
- No coverage threshold values changed in either `vitest.config.ts` (verify with `git diff campanha-ia/vitest.config.ts crialook-app/vitest.config.ts` — should show NO changes)
</acceptance_criteria>

---

### Task 2: Add `Lint` step to `mobile-typecheck-test` job

<read_first>
- .github/workflows/ci.yml (lines 62-87 — `mobile-typecheck-test` job)
- crialook-app/package.json (confirm Plan 03-03 added the `lint` script — depends_on: [03-03] guarantees this is true at execution time)
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-11)
</read_first>

<action>
Edit `.github/workflows/ci.yml` `mobile-typecheck-test` job. Insert a `Lint` step BETWEEN the `Type-check` step and the `Run vitest` step.

Current sequence (steps 80-87):
```yaml
      - name: Type-check
        run: npm run typecheck

      - name: Run vitest (lib utils) with coverage
        run: npm test -- --coverage
```

New sequence:
```yaml
      - name: Type-check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Run vitest (lib utils) with coverage
        run: npm test -- --coverage
```

Match the existing job's indentation (6 spaces for step `-`, 8 for properties). The `Lint` step inherits `defaults.run.working-directory: crialook-app` from the job, so no extra `working-directory` property is needed.

This step will fail the CI job if `npm run lint` exits non-zero — i.e., if any error-level lint finding is introduced. Warnings do not fail the build (D-11 + 03-03 honest day-1 lint).
</action>

<acceptance_criteria>
- `.github/workflows/ci.yml` contains a `- name: Lint` step under the `mobile-typecheck-test` job
- That step runs `npm run lint` (exact text)
- Step ordering: `Install dependencies` → `Type-check` → `Lint` → `Run vitest (lib utils) with coverage`
- YAML still parses (`python -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'` succeeds)
- The `Lint` step does NOT have its own `working-directory` (inherited from job-level `defaults.run.working-directory: crialook-app`)
</acceptance_criteria>

---

### Task 3: Wire lint-staged into the husky pre-commit hook (campanha-ia)

<read_first>
- campanha-ia/.husky/pre-commit (current 12-line content — see the comment block explaining why lint-staged was avoided)
- campanha-ia/package.json (lines 15-19 — the existing dead `lint-staged` config: `"*.{ts,tsx}": ["npx --no-install eslint --fix"]`)
- .planning/codebase/QUALITY.md §"Pre-commit Hooks" (current state analysis)
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-01, D-02 — N/A confirmed)
</read_first>

<action>
**Step A: Verify the lint-staged Node 24 bug status.** The existing hook comment claims lint-staged 16 has an ENOENT git-checkpoint bug on Node v24. Check:
1. `cd campanha-ia && npx lint-staged --version` → confirm version
2. Check lint-staged release notes / GitHub issues for v16 + Node 24 status. If a v16.x.y has fixed the bug (likely as of mid-2025), use that. If not, downgrade to v15 in `campanha-ia/package.json` devDependencies and `npm install --legacy-peer-deps`.
3. Alternative path: pass `--no-stash` to lint-staged, which sidesteps the git-checkpoint bug per upstream advice.

Document the chosen path in the commit body.

**Step B: Edit `campanha-ia/.husky/pre-commit`** to add lint-staged invocation AFTER the tsc check. Replace the file with:

```sh
#!/usr/bin/env sh
# Phase 3 D-01: pre-commit gate — typecheck + lint-staged on staged TS/TSX files.
#
# Hist: lint-staged 16 + Node v24 had an ENOENT git-checkpoint bug. As of Phase 3,
# we either (a) use --no-stash to sidestep it, or (b) pinned lint-staged to v15.
# The chosen path is documented in the commit message.
#
# tsc --noEmit varre o projeto inteiro (~3s) — caro mas garante zero risco de
# commit com erro de tipo. lint-staged só toca arquivos em stage (~ms).

cd campanha-ia || exit 1

npx tsc --noEmit || {
  echo "✗ TypeScript errors — commit abortado"
  exit 1
}

npx --no-install lint-staged --no-stash || {
  echo "✗ lint-staged failed — commit abortado"
  exit 1
}
```

(If the executor decided to pin v15 instead of using `--no-stash`, drop the `--no-stash` flag from the lint-staged invocation. Update the comment to match.)

**Step C: Verify the lint-staged config in `campanha-ia/package.json`** (lines 15-19) is still correct:
```json
"lint-staged": {
  "*.{ts,tsx}": [
    "npx --no-install eslint --fix"
  ]
}
```

This is fine as-is. Do NOT change it. The `--fix` flag means lint-staged will re-stage any auto-fixable changes — standard pattern.

**Step D: Local smoke test.** Stage a file with a deliberate lint error (e.g., add `const _x: any = 1` if `no-explicit-any` is even at warn level — pick a rule that's at error to actually trigger), attempt commit, verify the hook rejects it. Then revert the test change.
</action>

<acceptance_criteria>
- `campanha-ia/.husky/pre-commit` contains the literal string `lint-staged`
- `campanha-ia/.husky/pre-commit` still contains the `npx tsc --noEmit` block (typecheck NOT removed)
- `campanha-ia/.husky/pre-commit` contains a comment referencing `Phase 3 D-01`
- File is still executable (`test -x campanha-ia/.husky/pre-commit` succeeds — though some Windows sandboxes report all files as non-executable; in that case verify with `ls -la campanha-ia/.husky/pre-commit | grep -E '^-..x'`)
- `campanha-ia/package.json` `lint-staged` config block is unchanged from current state (verify with `git diff campanha-ia/package.json | grep -A 5 lint-staged` — only changes should be devDeps if pinning v15)
- A deliberate test commit with a lint error fails (executor documents this in the commit body)
- The repo-root `.husky/` directory still does NOT exist (`test ! -d .husky/` succeeds — D-02 N/A confirmed)
</acceptance_criteria>

---

### Task 4: Update README.md test count

<read_first>
- README.md (full file — locate the line ~169 that says `33 testes unitários web (Vitest)`)
- .planning/codebase/QUALITY.md §"TL;DR" — current real test count (campanha-ia: 148 vitest; crialook-app: 45 vitest + 1 jest)
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-12)
</read_first>

<action>
Update README.md line ~169 (the actual line number may have drifted; locate via `grep -n "33 testes" README.md`).

**Choose ONE path per D-12:**

**Path A — Update the number** (preferred if the count is stable post-Phase 3):
- Change `33 testes unitários web (Vitest)` to `148 testes unitários web (Vitest)` (the Wave 1 plans confirm this is the post-fix count).
- If the line also references mobile tests, update those too: 45 vitest + 1 jest in crialook-app = 46.

**Path B — Strip the number, link to CI** (preferred if the count moves often):
- Replace `33 testes unitários web (Vitest)` with `Testes unitários cobertos por Vitest (web) e Jest (mobile) — ver badge de CI / .github/workflows/ci.yml`.
- This eliminates the source-of-truth-drift class of bug.

Pick whichever is shorter / more aligned with the README's existing voice. Do NOT change anything else in the README in this plan.

After the edit, verify by re-running `cd campanha-ia && npm test --run` and checking that the count line in test output matches what the README claims (if Path A) — single source of truth, per D-12.
</action>

<acceptance_criteria>
- README.md no longer contains the literal string `33 testes` anywhere
- README.md either:
  - (Path A) contains `148 testes unitários web (Vitest)` AND the live `npm test --run` output for campanha-ia shows `Tests: 148 passed`
  - OR (Path B) contains a sentence that does NOT include any specific test count number, instead pointing to the CI badge / workflow file
- `git diff README.md` shows changes ONLY on the test-count line (and possibly its immediate neighbors if the wording flowed) — no unrelated edits
</acceptance_criteria>

---

### Task 5: End-to-end verification — push to a throwaway branch / dry-run CI locally

<read_first>
- .github/workflows/ci.yml (final state after Tasks 1-2)
- All commits from Tasks 1-4 (verify they're staged correctly per task)
</read_first>

<action>
This task validates that the four CI/husky/README changes work together. Two paths:

**Path A — Push to a CI-test branch:**
```bash
git checkout -b ci-test/phase-3-ratchet
git push origin ci-test/phase-3-ratchet
```
Wait for CI run. Confirm:
- `lint-typecheck-build` job: PASS (unchanged)
- `test` job: PASS with coverage report
- `mobile-typecheck-test` job: PASS with `Lint` step + coverage report

If any job fails, return to that task. After verification, delete the throwaway branch (`git push origin --delete ci-test/phase-3-ratchet`).

**Path B — Local act-style dry-run (if `act` is installed):**
```bash
act -W .github/workflows/ci.yml -j mobile-typecheck-test --dryrun
```
Lower fidelity but doesn't pollute remote. Use Path A if at all possible.

**Husky hook verification (independent of CI):**
```bash
cd campanha-ia
echo "const x: any = 1" >> /tmp/lint-test.ts
git add /tmp/lint-test.ts || git add ../campanha-ia/scratch/lint-test.ts
git commit -m "test: should fail" --no-verify  # bypass to clean up
# Now actually try without --no-verify and confirm the hook fires:
git commit -m "test: should fail"  # expected: hook rejects via tsc OR lint-staged
```
(The exact reproduction depends on what triggers an error in the current rule config — adjust as needed. The point is to prove the hook does what it's supposed to.)

Document outcomes in the commit body.
</action>

<acceptance_criteria>
- CI run on a throwaway branch (or local act-style dry-run) shows all 3 jobs green with the new steps active
- Coverage report appears in the CI logs for both vitest jobs (the `--coverage` flag emits a summary table)
- The `Lint` step appears in the mobile job log and exits 0
- A deliberate-error local commit gets rejected by the husky hook (tsc OR lint-staged blocks it)
- The throwaway CI branch is deleted after verification (no lingering test branches in the repo)
</acceptance_criteria>

---

## Verification

After all 5 tasks complete:

1. CI YAML integrity: `python -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'` succeeds.
2. Coverage flags wired: `grep -c -- "--coverage" .github/workflows/ci.yml` returns ≥ 2.
3. Mobile lint job present: `grep -B 1 -A 1 "name: Lint" .github/workflows/ci.yml` shows the lint step inside the mobile job block.
4. Husky lint-staged wired: `grep -c lint-staged campanha-ia/.husky/pre-commit` returns ≥ 1.
5. Husky still typechecks: `grep -c "tsc --noEmit" campanha-ia/.husky/pre-commit` returns ≥ 1.
6. README count fixed: `grep -c "33 testes" README.md` returns 0.
7. R-01 / D-02 truth: `test ! -d .husky/` succeeds (no root husky created).
8. Cross-plan integration: All Phase 3 success criteria from ROADMAP §"Phase 3" are now reachable — Wave 1 fixed the local breakages, Wave 2 makes them CI-enforced.

## must_haves

```yaml
truths:
  - both_vitest_ci_invocations_have_coverage_flag
  - mobile_ci_job_has_lint_step
  - husky_pre_commit_invokes_lint_staged_AND_tsc
  - readme_test_count_is_accurate_or_stripped
  - no_new_husky_install_at_repo_root
  - all_3_existing_ci_jobs_remain_green_post_change
acceptance:
  - github_ci_yml_valid_yaml
  - grep_coverage_count_at_least_2
  - grep_lint_step_in_mobile_job
  - grep_lint_staged_in_husky_hook
  - grep_33_testes_in_readme_returns_0
  - throwaway_ci_branch_run_all_jobs_green
```
