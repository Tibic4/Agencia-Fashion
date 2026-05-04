---
plan_id: 03-01
phase: 3
title: Jest mock restore — fix setupFilesAfterEnv typo + repair tests surfaced as broken
wave: 1
depends_on: []
files_modified:
  - crialook-app/jest.config.js
  - crialook-app/__tests__/example-pulsing-badge.test.tsx
autonomous: true
requirements: [F-01, D-06, D-07, D-08, D-09]
must_haves:
  truths:
    - "crialook-app/jest.config.js uses setupFilesAfterEnv (the valid Jest key) — not setupFilesAfterEach"
    - "Mocks declared in jest.setup.ts (expo-secure-store, react-native-mmkv, expo-router, @clerk/clerk-expo, react-native-gesture-handler/jestSetup, react-native-reanimated) are confirmed loaded — verified by deliberate assertion against a mocked Clerk return"
    - "STRICT BAR: every Jest test under crialook-app/__tests__/**/*.test.{ts,tsx} passes — no .skip, no .todo, no defer-to-backlog"
    - "Real bugs surfaced by the mock restore are fixed in this plan with commit message prefix `fix(tests): ...` (D-08)"
    - "Stale assertions surfaced by the mock restore are corrected with commit message prefix `test(<module>): refresh assertion ...` (D-09)"
  acceptance:
    - "`cd crialook-app && npm run test:rn` exits 0"
    - "`cd crialook-app && npm run test:rn` output contains `Tests:` line with `0 failing`"
    - "`grep -c setupFilesAfterEach crialook-app/jest.config.js` returns 0"
    - "`grep -c setupFilesAfterEnv crialook-app/jest.config.js` returns 1"
---

# Plan 03-01: Jest Mock Restore + Broken-Test Repair

## Objective

Fix the Critical CRIALOOK-PLAY-READINESS finding F-01: `crialook-app/jest.config.js` uses `setupFilesAfterEach` which is **not a valid Jest key**, so every mock in `jest.setup.ts` is silently never loaded. Today only one Jest test exists (`__tests__/example-pulsing-badge.test.tsx`), so the surface area of breakage is bounded — but per the STRICT BAR (D-06) we MUST fix any test that breaks once the typo is corrected, not skip it.

**Scope clamp:** This plan ONLY restores the Jest mock harness and repairs whatever surfaces as broken. It does NOT add new Jest tests (Phase 6 owns auth/billing/error-boundary tests). It does NOT touch the vitest suite (Plan 03-02 owns that).

## Truths the executor must respect

- **STRICT BAR (D-06):** No `it.skip`, no `it.todo`, no `// TODO Phase 6` shortcuts. If a test breaks, fix it in this plan. If the test was right and the code was wrong, the commit is `fix(tests): correct <module> behavior surfaced by jest mock fix` (D-08). If the test was stale and the code is right, the commit is `test(<module>): refresh assertion outdated since <reason>` (D-09).
- **Bounded surface (R-02 confirmed):** Only **1 Jest test file** exists today: `__tests__/example-pulsing-badge.test.tsx`. The maximum number of newly-failing tests is therefore the test count inside that one file. D-07 risk acknowledgment ("if 10+ tests break, Phase 3 grows") is structurally capped.
- **Don't touch vitest:** The vitest suite (`lib/__tests__/`, `hooks/__tests__/`, `components/historico/__tests__/`) uses its own setup file (`vitest.setup.ts`) and is unrelated to the jest typo. Plan 03-02 owns the 1 vitest timeout in `api.regenerateCampaign.test.ts`.
- **Mock-load verification is part of D-06:** Per ROADMAP success criterion 1 (`npm run test:rn ... exits 0 with mocks confirmed loaded (verify by adding a deliberate expect against a mocked Clerk return)`), the existing test file must include at least one assertion that proves the Clerk mock is active. Add it as part of Task 2 if absent.
- **No other config drift:** Do NOT change `preset`, `testMatch`, `moduleNameMapper`, or `transformIgnorePatterns`. Only the one typo plus, if needed, the assertion in the existing test.

## Tasks

### Task 1: Fix the `setupFilesAfterEach` → `setupFilesAfterEnv` typo

<read_first>
- crialook-app/jest.config.js (current state — confirm typo at line 18)
- crialook-app/jest.setup.ts (the file that should be loaded — to understand what mocks come back online)
- .planning/audits/CRIALOOK-PLAY-READINESS.md §F-01 (the finding text + remediation)
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-06 strict bar)
</read_first>

<action>
Edit `crialook-app/jest.config.js` line 18: replace the key `setupFilesAfterEach` with `setupFilesAfterEnv`. The value array `['<rootDir>/jest.setup.ts']` stays exactly the same.

Before:
```js
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
```

After:
```js
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
```

Do NOT add comments, do NOT touch any other line, do NOT reformat the file. The diff must be exactly one character-range change on line 18.
</action>

<acceptance_criteria>
- `grep -c "setupFilesAfterEach" crialook-app/jest.config.js` returns `0`
- `grep -c "setupFilesAfterEnv: \['<rootDir>/jest.setup.ts'\]" crialook-app/jest.config.js` returns `1`
- `git diff crialook-app/jest.config.js` shows exactly one line changed (the typo correction)
- `node -e "const c = require('./crialook-app/jest.config.js'); console.log(Object.keys(c).join(','))"` lists `setupFilesAfterEnv` and does NOT list `setupFilesAfterEach`
</acceptance_criteria>

---

### Task 2: Run `npm run test:rn` and verify mocks load — add the canary assertion if missing

<read_first>
- crialook-app/__tests__/example-pulsing-badge.test.tsx (the only Jest test today — see what it asserts)
- crialook-app/jest.setup.ts (lines 44-50 — confirm `useUser()` mock returns `user.id = 'test-user'`)
- .planning/ROADMAP.md §"Phase 3" Success Criteria #1 (mock-load canary requirement)
</read_first>

<action>
1. Run `cd crialook-app && npm run test:rn` and capture output.

2. **Decision tree:**
   - **If exit 0 AND `example-pulsing-badge.test.tsx` already contains an assertion that exercises a mocked surface from `jest.setup.ts` (e.g., `expect(useUser().user.id).toBe('test-user')` or similar):** Mock load is already proven by an active assertion. Document the exact line in the commit body. Skip to acceptance check.
   - **If exit 0 BUT the test does NOT exercise any `jest.setup.ts` mock:** Add a canary assertion to the existing test file. Inside `__tests__/example-pulsing-badge.test.tsx`, add a new `it()` block at the end of the existing `describe`:

     ```tsx
     it('canary: jest.setup.ts mocks are loaded (Phase 3 F-01)', () => {
       // Proves setupFilesAfterEnv is wired correctly.
       // The Clerk mock from jest.setup.ts:44-50 returns user.id = 'test-user'.
       const { useUser } = require('@clerk/clerk-expo');
       expect(useUser().user.id).toBe('test-user');
     });
     ```

     This canary will turn red if anyone reverts the typo fix or breaks the Clerk mock — the cheapest possible regression detector.

   - **If exit non-zero:** Proceed to Task 3 to triage.

3. Re-run `cd crialook-app && npm run test:rn` after any edit. Confirm exit 0 and the canary assertion (if added) passes.
</action>

<acceptance_criteria>
- `cd crialook-app && npm run test:rn` exits with code 0
- `crialook-app/__tests__/example-pulsing-badge.test.tsx` contains at least one assertion that calls a function from `@clerk/clerk-expo`, `expo-secure-store`, `react-native-mmkv`, or `expo-router` and asserts on the mocked return value (proves the setup file loaded)
- The canary `it()` description (if added) contains the literal string `Phase 3 F-01` so the audit trail survives in test output
- Test output line shows `Tests:` with all tests passing (zero `failing`, zero `pending`)
</acceptance_criteria>

---

### Task 3: Triage and repair any tests that broke from the mock restore

<read_first>
- The full output of `npm run test:rn` from Task 2
- crialook-app/__tests__/example-pulsing-badge.test.tsx (current implementation)
- crialook-app/jest.setup.ts (mocks now active — what shapes do they impose)
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-06, D-07, D-08, D-09 — strict bar policy)
- For each broken test, the source-of-truth file under test (linked from the test file's import statements)
</read_first>

<action>
**SKIP this task entirely if Task 2 already passed with exit 0 and no broken tests.** The R-02 research established that only one Jest test file exists, so this task is conditional.

**If any test failed in Task 2:**

For each failing test, classify:

1. **Real bug surfaced (test was right, production code was wrong):**
   - Fix the production code (NOT the test).
   - Commit with message: `fix(tests): correct <module> behavior surfaced by jest mock fix`
   - Where `<module>` is the production file path (e.g., `lib/auth`, `components/PulsingBadge`).

2. **Stale assertion (test was wrong, production code is right):**
   - Update the test assertion to match current behavior.
   - Commit with message: `test(<module>): refresh assertion outdated since <reason>`
   - Where `<reason>` is one of: `clerk-mock-shape-changed`, `expo-router-api-changed`, `mmkv-storage-shape-changed`, etc.

3. **Mock-shape mismatch (the mock in `jest.setup.ts` doesn't match the real module's API):**
   - Update the mock in `jest.setup.ts` to match the real module's current shape.
   - Commit with message: `test(jest-setup): align <module> mock with real API`

**Forbidden under STRICT BAR (D-06):**
- `it.skip(...)` — not allowed in this plan
- `it.todo(...)` — not allowed
- `// TODO: Phase 6 will fix this` — not allowed
- `xit(...)` / `xdescribe(...)` — not allowed
- Adding the test to a backlog file instead of fixing it — not allowed

After all repairs, re-run `cd crialook-app && npm run test:rn` and confirm exit 0 with zero failures.
</action>

<acceptance_criteria>
- After all repairs: `cd crialook-app && npm run test:rn` exits 0
- `grep -rE "\.skip\(|\.todo\(|xit\(|xdescribe\(" crialook-app/__tests__/` returns nothing
- `grep -rE "TODO.*Phase 6|TODO.*backlog|TODO.*defer" crialook-app/__tests__/` returns nothing
- Each repair commit follows the D-08 / D-09 / mock-shape naming convention (verify with `git log --oneline crialook-app/__tests__/ crialook-app/jest.setup.ts`)
- Test output shows `Test Suites: <N> passed, <N> total` and `Tests: <M> passed, <M> total` — no failures, no pending
</acceptance_criteria>

---

## Verification

After all 3 tasks complete (Task 3 may be a no-op):

1. Single command end-to-end: `cd crialook-app && npm run test:rn` → exit 0.
2. Mock load proof: `grep -c "useUser\|expo-secure-store\|expo-router" crialook-app/__tests__/example-pulsing-badge.test.tsx` returns ≥ 1.
3. Strict bar audit: `grep -rE "\.skip\(|\.todo\(|xit\(|xdescribe\(" crialook-app/__tests__/` returns nothing.
4. Config integrity: `node -e "console.log(JSON.stringify(Object.keys(require('./crialook-app/jest.config.js'))))"` includes `setupFilesAfterEnv`, excludes `setupFilesAfterEach`.

## must_haves

```yaml
truths:
  - jest_config_uses_setupFilesAfterEnv
  - jest_setup_mocks_proven_loaded_via_canary
  - npm_run_test_rn_exits_0
  - strict_bar_no_skip_no_todo_no_defer
  - any_repair_commits_follow_D08_D09_naming
acceptance:
  - npm_run_test_rn_exit_0
  - canary_assertion_present_in_existing_test
  - zero_skip_or_todo_in_jest_tests
  - jest_config_diff_is_exactly_one_line
```
