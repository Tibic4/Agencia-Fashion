# Phase 3: Test Infra & Flake Fix - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning (independent of Phase 1)

<domain>
## Phase Boundary

Fix the broken Jest config that silently disables every release-test mock, stabilize the 3 timing-out vitest cases, and add the small CI ratchets (mobile lint, coverage on) that turn "all green" into a truthful signal — so phases 06 and 02 can land tests that actually run.

In scope (from PHASE-DETAILS Phase 3):
- Fix `crialook-app/jest.config.js`: `setupFilesAfterEach` → `setupFilesAfterEnv`. Re-run `npm run test:rn`. Fix any tests that now break.
- Bump `testTimeout` to 15000ms or hoist dynamic `import("./functions")` to `beforeAll` for `inngest/judge.test.ts` happy + sentinel cases.
- Same fix shape for `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` (warm jsdom or hoist import).
- Add `eslint` config + `lint` job for `crialook-app` (parity with web; ~5-line `ci.yml` patch).
- Wire `--coverage` into both vitest CI invocations so the existing 30/35 thresholds become a ratchet.
- Update `README.md:169` test count (33 → 148) or strip the number.
- Remove dead `lint-staged` config from `campanha-ia/package.json` OR wire it into the husky hook.

Out of scope:
- Adding the actual missing tests (auth, billing, error boundaries) — those are in Phase 6
- HTTP-level webhook tests — those are in Phase 2
- e2e (Playwright/Detox/Maestro) — explicit out for M1

</domain>

<decisions>
## Implementation Decisions

### lint-staged disposition
- **D-01:** Wire `lint-staged` to a husky pre-commit hook in `campanha-ia/`. Activates the existing zombie config. Runs lint + typecheck on staged files only (~3s per commit). Avoids the "esqueci de lintar" class entirely.
- **D-02:** If `.husky/` does not exist in the repo root, install husky as part of this task (root-level `husky install` script).

### inngest/judge.test.ts timeout fix
- **D-03:** Hoist the dynamic `import("./functions")` to `beforeAll`. Test bodies stay fast. Resolves the root cause (slow module load), not the symptom (timeout). Cleaner test pattern that scales as the module grows.
- **D-04:** Same hoist pattern for `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` — warm jsdom in `beforeAll` if applicable, hoist any heavy import.
- **D-05:** Default `testTimeout` (5000ms) stays untouched. We're fixing the cause, not raising the ceiling.

### Tests broken-by-jest-fix policy
- **D-06:** **STRICT BAR** — Phase 3 does NOT advance until 100% of tests pass. No `skip-with-comment + backlog` shortcut. If broken-all-along tests surface, fix them in this phase.
- **D-07:** Risk acknowledged: if 10+ tests turn out to be broken, Phase 3 grows large. Owner accepts this as the cost of an honest test signal.
- **D-08:** Each broken test that's actually a real bug (test was right, code was wrong) becomes a code fix in this phase, with a commit message that flags it (`fix(tests): correct <module> behavior surfaced by jest mock fix`).
- **D-09:** Each broken test that's an obsolete assertion (code is right, test is stale) gets corrected with a commit message (`test(<module>): refresh assertion outdated since <reason>`).

### CI ratchet + coverage
- **D-10:** `--coverage` flag enabled in both vitest CI invocations (`campanha-ia` web at 30% threshold for `lib/**`, `crialook-app` mobile at 35% threshold). Below threshold → CI fails.
- **D-11:** Mobile lint job added to `.github/workflows/ci.yml` (~5-line patch). Same eslint config pattern as web. Errors fail the job.

### README test count
- **D-12:** Update `README.md:169` to the actual count (`33` → `148`, or whatever `npm test` reports after Phase 3 stabilizes). Single source of truth: the `npm test` output. If the count moves often, strip the number entirely and replace with link to CI badge.

### Claude's Discretion (planner / executor decides)
- Husky install command + version pinning (use latest stable unless Phase 3 research finds project preference)
- Exact file paths for new `crialook-app/.eslintrc.*` (mirror web's structure)
- CI job ordering (lint before test, parallel, etc.)
- `.husky/pre-commit` script content (lint-staged invocation pattern)
- Whether to add a `prepare` script (`"prepare": "husky install"`) in package.json

### Flagged for plan-phase research
- **R-01:** Confirm `.husky/` state — exists or needs install? (Run `ls .husky/` before deciding D-02 install path.)
- **R-02:** Run `npm run test:rn` AFTER fixing `setupFilesAfterEach` typo locally and capture the actual count of newly-failing tests. The number guides whether D-07's risk materializes (10+ broken).
- **R-03:** Audit `.github/workflows/` for the existing test job structure before adding mobile lint job (avoid duplicating patterns).

</decisions>

<specifics>
## Specific Ideas

- "Tests broken all along must be fixed, not skipped" — D-06 enforces strict bar. No technical debt tag for half-effort fixes.
- "Cause-fix over symptom-fix" — D-03/D-05 hoist instead of timeout bump.
- "Coverage threshold is a ratchet, not a ceiling" — D-10 enforces 30/35 minimums; future PRs cannot regress below.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope sources
- `.planning/PROJECT.md` — non-negotiable constraints
- `.planning/ROADMAP.md` §"Phase 3"
- `.planning/PHASE-DETAILS.md` §"Phase 3"
- `.planning/STATE.md`

### Findings to address
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` — F-01 (Critical, jest config typo)
- `.planning/codebase/QUALITY.md` §"Flaky tests" + §"Where to focus next" #1, #4, #5, #6 + §"Coverage Gaps" #12, #13, #14

### Codebase intel
- `.planning/codebase/QUALITY.md` — full test inventory, current pass/fail state, ratchet thresholds
- `.planning/codebase/STACK.md` §"crialook-app" — Jest version, vitest version, ESLint setup state per subproject

### Files this phase touches (researcher confirms exact paths)
- `crialook-app/jest.config.js` — D-01 typo fix
- `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` — D-04 hoist
- `campanha-ia/inngest/judge.test.ts` — D-03 hoist
- `campanha-ia/package.json` — D-01 lint-staged wire (or removal)
- `crialook-app/.eslintrc.*` (new file) — D-11
- `.github/workflows/ci.yml` — D-10 + D-11 patches
- `.husky/pre-commit` (possibly new) — D-01/D-02
- `README.md:169` — D-12

### Out-of-M1 (DO NOT broaden)
- `.planning/ROADMAP.md` §"Out-of-milestone (parking lot)" — e2e stack deferred, Storybook×Vite parking, etc.
- Phase 6 owns billing/auth tests — DO NOT add them in Phase 3

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Web ESLint config (`campanha-ia/eslint.config.mjs`) — mirror its shape for mobile
- Web Husky setup if exists — D-01 reuses pattern
- Existing CI test job structure — D-11 patches incrementally

### Established Patterns
- Vitest for web (`vitest.config.ts`), Jest for mobile (`jest.config.js`) — DO NOT cross-pollinate
- TypeScript strict in both subprojects — new ESLint config must align
- `--coverage` produces `coverage/` directory — gitignore already covers it (verify)

### Integration Points
- CI workflow at `.github/workflows/ci.yml` — two job patches (mobile lint + dual coverage flags)
- README badges (line 21 mentions "33 tests passing") — D-12 updates or strips
- `crialook-app/package.json` scripts: `test:rn`, `lint` (new) — wire lint into CI

</code_context>

<deferred>
## Deferred Ideas

- **Adding the actual missing release-critical tests** (billing, auth, error boundaries) — Phase 6 owns this. Phase 3 only fixes the harness so Phase 6's tests can land cleanly.
- **HTTP-level webhook tests** — Phase 2 owns. Phase 3 doesn't add them.
- **Playwright / Detox / Maestro e2e stack** — explicit defer per ROADMAP. Out of M1.
- **Storage GC schedule verification** — parking lot (could fold into Phase 8 if cheap, but not Phase 3 concern).
- **Higher coverage thresholds** — D-10 sets the floor at 30/35. Raising the bar over time is a future ratchet decision.

</deferred>

---

*Phase: 03-test-infra-and-flake-fix*
*Context gathered: 2026-05-03*
