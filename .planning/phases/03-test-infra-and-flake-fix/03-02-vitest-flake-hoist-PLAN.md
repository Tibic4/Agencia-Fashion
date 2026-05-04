---
plan_id: 03-02
phase: 3
title: Vitest flake fix — hoist dynamic imports for judge.test.ts and api.regenerateCampaign.test.ts
wave: 1
depends_on: []
files_modified:
  - campanha-ia/src/lib/inngest/judge.test.ts
  - crialook-app/lib/__tests__/api.regenerateCampaign.test.ts
autonomous: true
requirements: [D-03, D-04, D-05]
must_haves:
  truths:
    - "Dynamic `await import(...)` calls inside it() blocks are hoisted to a top-level beforeAll() in both flaky test files"
    - "Default vitest testTimeout (5000ms) is NOT raised — the fix targets the cause (slow first import) not the symptom (timeout)"
    - "The 7+ tests already passing in judge.test.ts continue to pass; the previously-timing-out happy + sentinel tests now pass"
    - "All 4 tests in api.regenerateCampaign.test.ts pass; jsdom cold-boot is amortized via the hoisted module reference"
    - "No production code under src/lib/inngest/functions.ts or crialook-app/lib/api.ts is modified — fix is test-side only"
  acceptance:
    - "`cd campanha-ia && npm test --run -- src/lib/inngest/judge.test.ts` exits 0 with all tests passing in <30s"
    - "`cd crialook-app && npm test -- lib/__tests__/api.regenerateCampaign.test.ts` exits 0 with all 4 tests passing"
    - "`grep -c 'testTimeout' campanha-ia/vitest.config.ts` returns 0 (no global bump)"
    - "`grep -c 'testTimeout' crialook-app/vitest.config.ts` is unchanged from current state (no per-config bump)"
---

# Plan 03-02: Vitest Flake Fix — Cause Over Symptom

## Objective

Stabilize the 3 vitest tests that intermittently time out at 5000ms by hoisting dynamic `await import(...)` calls into `beforeAll()` blocks. Per D-03 / D-04 / D-05: we fix the **cause** (cold-import cost paid inside the timed `it()` block) not the **symptom** (the 5s ceiling). No `testTimeout` raises in this phase.

The two test files in scope:
1. `campanha-ia/src/lib/inngest/judge.test.ts` — 9 tests total, 2 reproducibly time out (the first ones to call `await import("./functions")` per describe block — the import resolves the entire Inngest + Supabase + AI module graph).
2. `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` — 4 tests total, 1 reproducibly times out (jsdom cold boot ~107s on Windows + dynamic `await import('@/lib/api')`).

## Truths the executor must respect

- **D-03 cause-fix only:** Hoist the dynamic import. Do NOT raise `testTimeout`. Do NOT add `vi.setConfig({ testTimeout: 15000 })`. Do NOT change `vitest.config.ts` for either subproject.
- **Preserve the test contract:** The 7 currently-passing tests in `judge.test.ts` and the 3 currently-passing tests in `api.regenerateCampaign.test.ts` MUST continue to pass identically. The diff is test-infrastructure-only.
- **Why hoist works:** `await import("./functions")` triggers Vitest to resolve the module graph — for the Inngest functions file this pulls in storage-gc + supabase-admin + AI module + ~30 transitive deps. The first call inside any `describe` block pays the full compile cost; subsequent calls hit module cache. Moving that cost into `beforeAll()` (which is NOT subject to the per-test 5s timeout) lets the actual test bodies stay fast.
- **Module reuse is safe:** `judgeCampaignJob` from `./functions` is a pure object reference (Inngest function definition). Holding it across tests in a `describe`-scoped `let` is identical in behavior to re-importing each time — the module is already cached after first load.
- **Don't touch the unmock:** `regenerateCampaign.test.ts` does `vi.unmock('@/lib/api')` at module top before any import. The hoist must preserve that ordering (unmock → import — never import → unmock).
- **Mock setup must remain in beforeEach:** The `vi.mock(...)` calls and `mockReset` calls in `beforeEach` stay where they are. We only hoist the `await import(...)` resolution.

## Tasks

### Task 1: Hoist dynamic import in `judge.test.ts`

<read_first>
- campanha-ia/src/lib/inngest/judge.test.ts (full file — understand the 5 describe blocks and where each calls `await import("./functions")`)
- campanha-ia/src/lib/inngest/functions.ts (referenced module — confirm `judgeCampaignJob` and `inngestFunctions` are stable named exports)
- campanha-ia/vitest.config.ts (confirm current testTimeout is unset — fix must not depend on raising it)
- .planning/codebase/QUALITY.md §"Flaky tests" → judge.test.ts entry (root cause analysis)
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-03, D-05)
</read_first>

<action>
Edit `campanha-ia/src/lib/inngest/judge.test.ts`:

1. **Add a top-level shared module reference** after the existing `vi.mock(...)` block (around line 60, after the storage-gc mock and before the first `beforeEach`). Insert:

   ```ts
   // Phase 3 D-03: hoist dynamic import to beforeAll so the first-load cost
   // of the entire Inngest + Supabase + AI graph is paid ONCE, outside any
   // per-test 5000ms timeout. The 2 timeouts QUALITY.md flagged were both
   // the first describe block to hit `await import("./functions")`.
   let functionsModule: typeof import("./functions");

   beforeAll(async () => {
     functionsModule = await import("./functions");
   });
   ```

2. **Replace every `const { ... } = await import("./functions")` line inside `it()` blocks** with destructuring from the hoisted reference. Example:

   Before (line ~130):
   ```ts
   it("calls scoreCampaignQuality → setCampaignScores → logModelCost in order", async () => {
     const { judgeCampaignJob } = await import("./functions");
     // ... rest of test
   });
   ```

   After:
   ```ts
   it("calls scoreCampaignQuality → setCampaignScores → logModelCost in order", async () => {
     const { judgeCampaignJob } = functionsModule;
     // ... rest of test
   });
   ```

   Apply this transformation to every `await import("./functions")` in the file. Per the grep at lines 130, 190, 223, 239, 256, 279, 285, 291, 303 — there are 9 occurrences.

3. **Add `beforeAll` to the vitest import line** at the top of the file. Current import:
   ```ts
   import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
   ```
   Becomes:
   ```ts
   import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
   ```

4. Do NOT touch the `vi.mock(...)` calls. Do NOT touch `beforeEach`. Do NOT touch any assertion. The diff should be: 1 import line + 1 inserted block (~10 lines) + 9 line-replacements (`await import("./functions")` → `functionsModule`).
</action>

<acceptance_criteria>
- `grep -c "await import(\"./functions\")" campanha-ia/src/lib/inngest/judge.test.ts` returns `0`
- `grep -c "functionsModule" campanha-ia/src/lib/inngest/judge.test.ts` returns at least `10` (1 declaration + 1 assignment + 9+ destructurings)
- `grep -c "beforeAll" campanha-ia/src/lib/inngest/judge.test.ts` returns at least `2` (1 import, 1 invocation)
- `grep -c "testTimeout" campanha-ia/src/lib/inngest/judge.test.ts` returns `0` (no per-file override)
- `grep -c "testTimeout" campanha-ia/vitest.config.ts` returns `0` (no global override)
- `cd campanha-ia && npm test --run -- src/lib/inngest/judge.test.ts` exits 0
- Test output for that file shows `Tests: 9 passed | 0 failed` (exact count may vary if file has been edited since QUALITY.md but must be all-green)
- Total runtime for that single file is < 30s on the test machine (cold-import cost amortized to beforeAll, individual tests now run in <500ms each)
</acceptance_criteria>

---

### Task 2: Hoist dynamic import in `api.regenerateCampaign.test.ts`

<read_first>
- crialook-app/lib/__tests__/api.regenerateCampaign.test.ts (full file — understand the `vi.unmock('@/lib/api')` ordering and the `loadApi()` helper at line 17)
- crialook-app/lib/api.ts (referenced module — confirm `regenerateCampaign` is a stable named export)
- crialook-app/vitest.setup.ts (confirm the global `vi.mock('@/lib/api')` is what `vi.unmock` is reverting)
- crialook-app/vitest.config.ts (confirm jsdom environment and current testTimeout — fix must not depend on raising it)
- .planning/codebase/QUALITY.md §"Flaky tests" → api.regenerateCampaign.test.ts entry
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-04, D-05)
</read_first>

<action>
Edit `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts`:

1. **Replace the existing `loadApi()` async helper** (lines 17-19) with a top-level `beforeAll`-resolved reference. The unmock-then-import ordering MUST be preserved.

   Before (lines 11-19):
   ```ts
   vi.unmock('@/lib/api');

   // Stub EXPO_PUBLIC_API_URL so BASE_URL resolves to a deterministic origin.
   process.env.EXPO_PUBLIC_API_URL = 'https://api.test';

   // Async dynamic import AFTER unmock so the real module loads.
   async function loadApi() {
     return await import('@/lib/api');
   }
   ```

   After:
   ```ts
   vi.unmock('@/lib/api');

   // Stub EXPO_PUBLIC_API_URL so BASE_URL resolves to a deterministic origin.
   process.env.EXPO_PUBLIC_API_URL = 'https://api.test';

   // Phase 3 D-04: hoist dynamic import to beforeAll. The unmock above MUST run
   // first (vitest evaluates vi.unmock at module-eval time, before any beforeAll),
   // so by the time beforeAll runs we get the real api module — same behavior
   // as the previous loadApi() helper, but the jsdom + module-resolve cost is
   // paid once outside any per-test 5000ms timeout.
   let apiModule: typeof import('@/lib/api');

   beforeAll(async () => {
     apiModule = await import('@/lib/api');
   });
   ```

2. **Replace every `const { ... } = await loadApi()` call inside `it()` blocks** with destructuring from `apiModule`. Example:

   Before (line ~52):
   ```ts
   it('Test 1 — no reason → POSTs without body, resolves to legacy paid payload', async () => {
     const { regenerateCampaign } = await loadApi();
     // ... rest of test
   });
   ```

   After:
   ```ts
   it('Test 1 — no reason → POSTs without body, resolves to legacy paid payload', async () => {
     const { regenerateCampaign } = apiModule;
     // ... rest of test
   });
   ```

   Apply to every occurrence of `await loadApi()` in `it()` blocks. Run `grep -c "await loadApi" <file>` before editing to confirm count, then verify it's 0 after.

3. **Add `beforeAll` to the vitest import line.** Current:
   ```ts
   import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
   ```
   Becomes:
   ```ts
   import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
   ```

4. Delete the `loadApi()` helper function declaration (it's no longer referenced).

5. Do NOT change the `vi.unmock('@/lib/api')` call or its position. Do NOT change `beforeEach`/`afterEach`. Do NOT modify any assertion or any `stubFetchOk`/`stubFetchError` helper.
</action>

<acceptance_criteria>
- `grep -c "await loadApi" crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` returns `0`
- `grep -c "function loadApi" crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` returns `0` (helper deleted)
- `grep -c "apiModule" crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` returns at least `5` (1 declaration + 1 assignment + 3+ destructurings since the file has 4 `it()` blocks)
- `grep -c "beforeAll" crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` returns at least `2` (1 import, 1 invocation)
- `grep -c "vi.unmock('@/lib/api')" crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` returns `1` (preserved unchanged)
- `grep -c "testTimeout" crialook-app/vitest.config.ts` matches the count BEFORE this plan ran (no change)
- `cd crialook-app && npm test -- lib/__tests__/api.regenerateCampaign.test.ts` exits 0
- Test output shows `Tests: 4 passed | 0 failed` for that file
</acceptance_criteria>

---

### Task 3: Full vitest re-run on both subprojects to confirm no regression

<read_first>
- campanha-ia/package.json (confirm `npm test --run` script exists)
- crialook-app/package.json (confirm `npm test` script exists and runs vitest)
- .planning/codebase/QUALITY.md §"TL;DR" — current pass counts (146/148 web, 44/45 mobile) are the regression baseline
</read_first>

<action>
Run both vitest suites end-to-end to confirm the hoist didn't regress any previously-passing test:

```bash
cd campanha-ia && npm test --run
```

Expected: `Tests: 148 passed | 0 failed` (was `146 passed | 2 failed` before this plan — net +2 from the judge.test.ts hoist).

```bash
cd crialook-app && npm test
```

Expected: `Tests: 45 passed | 0 failed` (was `44 passed | 1 failed` before — net +1 from the regenerateCampaign hoist).

If any previously-passing test regressed: investigate immediately. The hoist should be transparent — if it isn't, the test was relying on per-test module re-evaluation (e.g., resetting module-level state). In that case, switch from `let module = ...` in beforeAll to `let module; beforeEach(async () => { vi.resetModules(); module = await import(...); })` for that specific file ONLY — but flag the deviation in a code comment referencing this plan.

Capture the final pass counts in the executor's commit body for the verification record.
</action>

<acceptance_criteria>
- `cd campanha-ia && npm test --run` exits 0
- Output line `Tests:` shows total pass count ≥ 148 (the previous `146 passed + 2 failed` becomes `148 passed`)
- `cd crialook-app && npm test` exits 0
- Output line `Tests:` shows total pass count ≥ 45 (the previous `44 passed + 1 failed` becomes `45 passed`)
- No previously-passing test name appears in either failure log (if it does — a regression was introduced and must be fixed before this plan can land)
</acceptance_criteria>

---

## Verification

After all 3 tasks complete:

1. End-to-end: `cd campanha-ia && npm test --run` → exit 0, all 148 vitest tests pass.
2. End-to-end: `cd crialook-app && npm test` → exit 0, all 45 vitest tests pass.
3. No timeout raises: `grep -rE "testTimeout|setConfig.*timeout" campanha-ia/vitest.config.ts crialook-app/vitest.config.ts campanha-ia/src/lib/inngest/judge.test.ts crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` returns nothing.
4. Hoist pattern visible: both files have `beforeAll(async () => { ... = await import(...); })` and zero `await import(...)` inside `it()` bodies.
5. Total runtime for `judge.test.ts` is < 30s (was timing out at 5s × 2 = 10s wasted before, now amortizes import cost into beforeAll).

## must_haves

```yaml
truths:
  - judge_test_uses_beforeAll_hoisted_import
  - regenerateCampaign_test_uses_beforeAll_hoisted_import
  - no_testTimeout_raises_anywhere_in_phase_3
  - all_148_campanha_ia_vitest_tests_pass
  - all_45_crialook_app_vitest_tests_pass
  - production_code_under_test_is_unmodified
acceptance:
  - npm_test_run_campanha_ia_exit_0
  - npm_test_crialook_app_exit_0
  - zero_await_import_inside_it_blocks_for_both_files
  - zero_testTimeout_overrides_in_either_vitest_config
```
