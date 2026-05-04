---
plan_id: 06-12
phase: 6
title: Raise vitest coverage thresholds in crialook-app/vitest.config.ts after Phase 06 tests land (D-19 follow-up to P3 caveat)
wave: 3
depends_on: ["06-08", "06-09", "06-10", "06-11"]
owner_action: false
files_modified:
  - crialook-app/vitest.config.ts
autonomous: true
requirements: ["D-19"]
must_haves:
  truths:
    - "vitest.config.ts coverage.thresholds are raised from current floor (lines 22 / functions 13 / branches 17 / statements 21) to a higher floor based on actual coverage after the new Phase 06 tests"
    - "the comment block in vitest.config.ts explaining the ratchet history is updated to record the Phase 06 raise (date + previous values)"
    - "the new thresholds use the current-coverage + 2pp ratchet pattern OR meet/exceed the ROADMAP D-10 spec target (30 / 35 / ?? / ??) IF the actual measured coverage supports it (whichever applies; do NOT set thresholds above what the test run actually achieves — that would block CI)"
    - "the actual measurement command (npm test -- --coverage) is run before raising thresholds, and the new threshold values are derived from the measured numbers"
    - "no other field in vitest.config.ts is modified (provider, reporter, include, exclude, environment, setupFiles, globals, alias)"
  acceptance:
    - "node -e \"const v=require('fs').readFileSync('crialook-app/vitest.config.ts','utf8'); const ml=v.match(/lines:\\\\s*(\\\\d+)/); const mf=v.match(/functions:\\\\s*(\\\\d+)/); const mb=v.match(/branches:\\\\s*(\\\\d+)/); const ms=v.match(/statements:\\\\s*(\\\\d+)/); process.exit(ml&&mf&&mb&&ms&&Number(ml[1])>22&&Number(mf[1])>13&&Number(mb[1])>17&&Number(ms[1])>21?0:1)\" exits 0"
    - "cd crialook-app && npm test -- --coverage --reporter=basic exits 0 (the new floors are met by the actual coverage after Phase 06 tests)"
    - "grep -c 'Phase 6\\|Phase 06\\|2026' crialook-app/vitest.config.ts returns at least 1 (the ratchet history comment was updated)"
---

# Plan 06-12: Raise vitest coverage thresholds (D-19)

## Objective

Per D-19, after the new Phase 06 tests land (06-08 billing, 06-09 auth, 06-10 error boundaries via jest, 06-11 deep-link UUID), the vitest coverage on `crialook-app/lib/**` and `crialook-app/hooks/**` should rise. Raise the thresholds in `crialook-app/vitest.config.ts` so the coverage floor reflects the new reality and any future regression is caught by CI.

Per Phase 03 D-10 (referenced from roadmap), the aspirational target was lines 30 / functions 35. Current floor (P3 ratchet) is lines 22 / functions 13 / branches 17 / statements 21 — set as `current - 2pp` to be honest about coverage at the time. Phase 06 should:

1. Measure actual coverage after the new tests land.
2. Raise thresholds to match the actual measured numbers (rounded down to nearest integer).
3. If measured numbers reach or exceed the D-10 spec target (30/35/?/?), use those.
4. Otherwise, raise to current measured coverage (the +2pp pattern is reversed here — we're raising from below to actual, not setting a buffer above actual).

## Truths the executor must respect

- This plan runs LAST in the phase (wave 3) — depends on plans 06-08, 06-09, 06-10, 06-11 having all landed and being green.
- DO NOT set thresholds above what the actual test run measures. That would block CI on the very commit that adds the tests.
- DO NOT lower any threshold (except in the very unlikely case the new tests displace untested code into the coverage denominator and net coverage drops — which would itself signal a problem; investigate before lowering).
- Note that plan 06-10 ErrorBoundary tests are JEST (not vitest), so they don't move the vitest coverage needle directly. Plans 06-08, 06-09, 06-11 are vitest and DO contribute. The deep-link extraction in 06-11 also adds a tiny new file (`lib/_layout-deep-link.ts`) to the coverage denominator — its test is comprehensive so net coverage on that file is ~100%.
- The vitest config's `coverage.include` is `['lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}']` and `coverage.exclude` is `['**/*.test.*', '**/__tests__/**', '**/node_modules/**']`. So only lib/ and hooks/ source matter for the threshold.

## Tasks

### Task 1: Confirm prerequisites

<read_first>
- crialook-app/vitest.config.ts (full file — confirm current thresholds at lines ~37-45)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-19 specifics)
- .planning/phases/03-test-infra-and-flake-fix/ — look for any coverage SUMMARY note from P3 to confirm baseline 22/13/17/21 numbers
</read_first>

<action>
Confirm dependencies have shipped:

```bash
test -f crialook-app/lib/__tests__/billing.test.ts && echo "06-08 OK"
test -f crialook-app/lib/__tests__/auth.test.ts && echo "06-09 OK"
test -f crialook-app/__tests__/ErrorBoundary.test.tsx && test -f crialook-app/__tests__/TabErrorBoundary.test.tsx && echo "06-10 OK"
test -f crialook-app/lib/__tests__/deep-link-uuid.test.ts && echo "06-11 OK"
```

If any of the four is missing, STOP — this plan must run AFTER those four ship.
</action>

<verify>
```bash
ls crialook-app/lib/__tests__/billing.test.ts \
   crialook-app/lib/__tests__/auth.test.ts \
   crialook-app/__tests__/ErrorBoundary.test.tsx \
   crialook-app/__tests__/TabErrorBoundary.test.tsx \
   crialook-app/lib/__tests__/deep-link-uuid.test.ts \
   2>&1
# All 5 must exist
```
</verify>

### Task 2: Measure actual coverage

<read_first>
- (Task 1 reads — no new)
</read_first>

<action>
Run the vitest coverage report:

```bash
cd crialook-app
npm test -- --coverage --reporter=basic 2>&1 | tee /tmp/p6_coverage.txt | tail -50
```

Locate the coverage summary table — it will look like:

```
% Coverage report from v8
-----------|---------|----------|---------|---------|
File       | % Stmts | % Branch | % Funcs | % Lines |
-----------|---------|----------|---------|---------|
All files  |   XX.XX |    XX.XX |   XX.XX |   XX.XX |
```

Note the "All files" row's four percentages: Stmts, Branch, Funcs, Lines.

Round each DOWN to the nearest integer to be the new threshold floor. (Floor — never ceiling — to leave a small headroom for non-determinism in coverage measurement edge cases.)

Compare against the D-10 spec target (lines 30 / functions 35). If your measured Lines >= 30 AND Funcs >= 35, use those targets instead. Otherwise use the floored measured numbers.

**If any measured number is BELOW the current threshold (lines 22 / functions 13 / branches 17 / statements 21), STOP** — that means the new tests displaced more uncovered code into the denominator than they added covered code. Investigate before continuing. Don't just lower the threshold.
</action>

### Task 3: Update `vitest.config.ts` thresholds + comment

<read_first>
- crialook-app/vitest.config.ts (full file — confirm exact threshold block lines)
</read_first>

<action>
In `crialook-app/vitest.config.ts`, locate the `thresholds:` block (currently around lines 37-45):

```ts
      thresholds: {
        // Phase 3 D-10: ratchet ativado em CI via --coverage. Os pisos antigos
        // (35/35/30/35) eram aspiracionais — `npm test --coverage` mostrou
        // cobertura real em ~24% lines / ~19% branches / ~15% functions porque
        // muitos hooks de tela ainda não têm teste (camera, biometric, push).
        // Pisos ajustados pra atual - 2pp como ratchet honesto: bloqueia
        // regressão sem mentir sobre cobertura. Phase 6 sobe de volta ao
        // adicionar os testes faltantes.
        lines: 22,
        functions: 13,
        branches: 17,
        statements: 21,
      },
```

Replace it with:

```ts
      thresholds: {
        // Phase 3 D-10: ratchet ativado em CI via --coverage. Os pisos antigos
        // (35/35/30/35) eram aspiracionais — `npm test --coverage` mostrou
        // cobertura real em ~24% lines / ~19% branches / ~15% functions porque
        // muitos hooks de tela ainda não têm teste (camera, biometric, push).
        // Pisos ajustados pra atual - 2pp como ratchet honesto.
        //
        // Phase 6 (2026-05-XX): testes novos (billing, auth, ErrorBoundary,
        // deep-link UUID) subiram cobertura. Pisos elevados pra refletir o
        // novo chão — bloqueia regressão dos novos testes. Valores anteriores
        // 22/13/17/21 (lines/funcs/branches/stmts).
        lines: <NEW_LINES>,
        functions: <NEW_FUNCS>,
        branches: <NEW_BRANCHES>,
        statements: <NEW_STMTS>,
      },
```

Substitute `<NEW_LINES>`, `<NEW_FUNCS>`, `<NEW_BRANCHES>`, `<NEW_STMTS>` with the measured + floored integers from Task 2.

Also fill in the date placeholder `2026-05-XX` with today's actual date.
</action>

<verify>
```bash
cd crialook-app
# Confirm thresholds were raised (each new value > old value):
node -e "const v=require('fs').readFileSync('vitest.config.ts','utf8'); const ml=v.match(/lines:\s*(\d+)/); const mf=v.match(/functions:\s*(\d+)/); const mb=v.match(/branches:\s*(\d+)/); const ms=v.match(/statements:\s*(\d+)/); console.log({lines:Number(ml[1]),functions:Number(mf[1]),branches:Number(mb[1]),statements:Number(ms[1])});"
# Each value must be > old (22/13/17/21)

grep -c 'Phase 6' crialook-app/vitest.config.ts
# Expect: 1+

# Re-run coverage to confirm thresholds are met (CI gate would fail if not):
npm test -- --coverage --reporter=basic 2>&1 | tail -10
# Expect: exits 0 — no "ERROR: Coverage … below threshold"
```
</verify>

## Files modified

- `crialook-app/vitest.config.ts` — raise four threshold values + extend the explanatory comment

## Why this matters (risk if skipped)

If we add new tests but don't raise the thresholds, the floor stays at the old (pre-test) level — meaning a future contributor could delete the new tests and CI wouldn't notice (coverage would drop to the old floor, which is still passing). The threshold raise is what locks in the gain.
