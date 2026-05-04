---
plan_id: 03-03
phase: 3
title: Mobile ESLint config — add lint parity for crialook-app (file + script only; CI wired in 03-04)
wave: 1
depends_on: []
files_modified:
  - crialook-app/eslint.config.mjs
  - crialook-app/package.json
autonomous: true
requirements: [D-11]
must_haves:
  truths:
    - "crialook-app has an eslint.config.mjs (flat config, ESLint 9 format) that mirrors campanha-ia/eslint.config.mjs's relaxed-rule philosophy"
    - "crialook-app/package.json has a `lint` script: `eslint .`"
    - "Running `cd crialook-app && npm run lint` exits 0 against the current codebase (or with only warnings, never errors) — i.e. lint is honest and non-blocking on day one"
    - "Config ignores: node_modules, .expo/, dist/, ios/, android/, coverage/, storybook/, scripts/ (mirroring web's ignore intent for crialook-app's tree)"
    - "Same legacy-friendly rule downgrades to warning that web uses: @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, prefer-const, unused-vars (with ^_ ignore)"
  acceptance:
    - "`cd crialook-app && npm run lint` exits 0"
    - "`test -f crialook-app/eslint.config.mjs` succeeds"
    - "`grep -c '\"lint\"' crialook-app/package.json` returns at least 1 inside the scripts block"
    - "ESLint resolves no errors against the current codebase (warnings allowed)"
---

# Plan 03-03: Mobile ESLint Config

## Objective

Add lint parity for `crialook-app/` so the mobile project has the same code-style ratchet that `campanha-ia/` has had since day one. Today there's no `eslint.config.*` at all under `crialook-app/`, no `lint` npm script, and no lint job in CI (`ci.yml:62-87` runs only typecheck + test for mobile). This plan establishes the **config + script**; Plan 03-04 wires the CI job.

**Scope clamp:** This plan ONLY adds the config file and the npm script. It does NOT touch `.github/workflows/ci.yml` (that's 03-04's job). It does NOT enable strict rules (the web config explicitly downgrades many rules to `warn` during the legacy migration — mobile mirrors that posture for parity).

## Truths the executor must respect

- **Mirror the web posture:** `campanha-ia/eslint.config.mjs` is the established pattern (read it before writing the mobile config). Same rule downgrades, same ignore-intent, same ESLint 9 flat-config format.
- **Honest day-one lint:** The config MUST result in `npm run lint` exit 0 on the current codebase. Adding a config that surfaces 200 pre-existing errors would be a "broken-window" pattern — equivalent to a `lint-staged` config that nobody runs. If the current codebase has real errors, downgrade those rules to `warn` in this config; do NOT fix the underlying code in this plan (that's not Phase 3 scope).
- **No new dependencies if possible:** crialook-app already declares `eslint` somewhere (since EAS / Expo includes it transitively, AND the web `eslint-config-next/typescript` is a peer of `@typescript-eslint/eslint-plugin`). Verify what's available in `crialook-app/package.json` and `node_modules/` BEFORE adding deps. If ESLint or `typescript-eslint` is missing, add as `devDependency` via `npm install --save-dev --legacy-peer-deps` (per project memory: never plain `npm install` in crialook-app — use `--legacy-peer-deps` flag, lockfile maintained via `npm run lock:fix` if regen needed).
- **Expo-aware ignores:** `.expo/`, `ios/`, `android/`, `dist/`, `storybook-static/` are generated/native and should never be linted.
- **Don't lint scratch areas:** `scripts/` (Expo / build helpers), `e2e/` if it exists, and any `*.generated.*` files.
- **Config format:** Flat config (`.mjs`), matches web. Do NOT use legacy `.eslintrc.*` formats.

## Tasks

### Task 1: Audit current lint dependencies in crialook-app

<read_first>
- crialook-app/package.json (full file — list every devDep that starts with `eslint` or contains `typescript-eslint`)
- campanha-ia/eslint.config.mjs (full file — the mirror target; understand what it imports)
- campanha-ia/package.json (devDependencies block — which eslint-related deps are installed there, for comparison)
- .planning/codebase/STACK.md §"crialook-app" (if exists — pre-existing constraints)
- crialook-app/package-lock.json (top-level devDependencies — what's actually resolved)
</read_first>

<action>
1. Run `cd crialook-app && cat package.json | grep -E "eslint|typescript-eslint" -A 0 -B 0` to enumerate currently-declared eslint deps.

2. Compare against campanha-ia's deps. The web config imports:
   - `eslint` (the runner)
   - `eslint-config-next/core-web-vitals`
   - `eslint-config-next/typescript`

   These are Next.js-specific and should NOT come along to mobile. Mobile equivalents:
   - `eslint` (the runner — required)
   - `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` (TS support — required for any TS lint)
   - `eslint-plugin-react` + `eslint-plugin-react-hooks` (React support — required for RN code)
   - Optionally: `eslint-config-expo` IF Expo provides it (check `expo` package version — SDK 54 may bundle a shareable config under `expo/eslint-config` or as `eslint-config-expo`).

3. **Decision tree:**
   - If `eslint-config-expo` is available (verify with `cd crialook-app && npm ls eslint-config-expo` or check `node_modules/eslint-config-expo`): use it as the base. It already wraps RN + TS + react-hooks rules.
   - If NOT available: hand-roll a minimal config from `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks` — install whichever are missing (`npm install --save-dev --legacy-peer-deps <pkg>`).

4. Document the decision in the commit body. Do NOT add a `lint-staged` block to mobile's package.json (out of scope for this plan; campanha-ia owns that pattern in 03-04).
</action>

<acceptance_criteria>
- A note in the commit body lists exactly which devDependencies were already present vs. newly added
- If new packages were installed, `crialook-app/package-lock.json` was regenerated via `npm install --save-dev --legacy-peer-deps <pkg>` (NOT plain `npm install` — per project memory) and committed in the same commit
- `cd crialook-app && node -e "require('eslint')"` succeeds (the lint runner is resolvable)
</acceptance_criteria>

---

### Task 2: Write `crialook-app/eslint.config.mjs`

<read_first>
- campanha-ia/eslint.config.mjs (the mirror target — copy the rule-downgrade philosophy verbatim where applicable)
- crialook-app/tsconfig.json (confirm `"@/*": ["./*"]` path alias and strict mode)
- crialook-app/package.json (confirm presence of resolved eslint deps from Task 1)
- crialook-app/app/ (top-level structure — confirm Expo Router file layout)
</read_first>

<action>
Create `crialook-app/eslint.config.mjs` with content that depends on the Task 1 outcome:

**Variant A — `eslint-config-expo` is available:**

```js
import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

const eslintConfig = defineConfig([
  ...expoConfig,
  globalIgnores([
    "node_modules/**",
    ".expo/**",
    "dist/**",
    "ios/**",
    "android/**",
    "coverage/**",
    "storybook/**",
    "storybook-static/**",
    "scripts/**",
    "*.config.js",
  ]),
  {
    rules: {
      // Mirror campanha-ia/eslint.config.mjs posture: relax legacy-prone rules to warn.
      // Phase 3 D-11: lint must be honest on day 1 (zero errors, warnings OK).
      // Future hardening can flip these to "error" — explicit migration decision.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
```

**Variant B — `eslint-config-expo` is NOT available (hand-roll):**

```js
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  globalIgnores([
    "node_modules/**",
    ".expo/**",
    "dist/**",
    "ios/**",
    "android/**",
    "coverage/**",
    "storybook/**",
    "storybook-static/**",
    "scripts/**",
    "*.config.js",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // Same posture as campanha-ia/eslint.config.mjs — relax legacy rules to warn.
      // Phase 3 D-11: honest day-1 lint, zero errors.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
    settings: { react: { version: "detect" } },
  },
]);

export default eslintConfig;
```

**Common to both variants:**
- File path: `crialook-app/eslint.config.mjs` (NOT `.eslintrc.*` — flat config only)
- ESM (`.mjs`) extension — matches web
- Comment block at top documenting Phase 3 D-11 origin and the "honest day-1 lint" policy
</action>

<acceptance_criteria>
- File `crialook-app/eslint.config.mjs` exists
- File contains `defineConfig` import from `eslint/config`
- File contains `globalIgnores` block listing at minimum: `node_modules/**`, `.expo/**`, `ios/**`, `android/**`, `dist/**`, `coverage/**`
- File contains the 4 relaxed rules: `@typescript-eslint/no-explicit-any: warn`, `react-hooks/exhaustive-deps: warn`, `prefer-const: warn`, `@typescript-eslint/no-unused-vars: warn` (with `^_` ignore pattern)
- File contains a comment referencing `Phase 3 D-11`
- `cd crialook-app && npx eslint --print-config app/_layout.tsx 2>&1 | head -5` shows the config resolves without parser errors (file path may need adjusting if `app/_layout.tsx` doesn't exist — substitute any TS file)
</acceptance_criteria>

---

### Task 3: Add `lint` script to `crialook-app/package.json`

<read_first>
- crialook-app/package.json (current scripts block — confirm `lint` is absent)
- campanha-ia/package.json (the `"lint"` script value — copy that pattern)
</read_first>

<action>
Edit `crialook-app/package.json` `scripts` block. Add a `lint` entry. Mirror web's pattern (`"lint": "next lint"` becomes generic for mobile):

Before (excerpt — your `scripts` block today probably looks like this):
```json
  "scripts": {
    "android": "expo run:android",
    "start": "expo start",
    "test": "vitest run",
    ...
    "typecheck": "tsc --noEmit"
  },
```

After (insert `lint` adjacent to `typecheck`):
```json
  "scripts": {
    "android": "expo run:android",
    "start": "expo start",
    "test": "vitest run",
    ...
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
```

The exact JSON ordering doesn't matter — what matters is that `npm run lint` becomes a working invocation. Do NOT add `--max-warnings 0` (would convert warnings to errors and violate the "honest day-1 lint" goal). Do NOT add `--fix` to the default script (devs run `--fix` ad-hoc; CI runs the dry version).

Also add a `lint:fix` companion if desired (optional, low cost):
```json
    "lint:fix": "eslint . --fix"
```
</action>

<acceptance_criteria>
- `node -e "console.log(require('./crialook-app/package.json').scripts.lint)"` outputs a string containing `eslint`
- `cd crialook-app && npm run lint --silent` exits 0
- The `lint` script does NOT contain `--max-warnings 0` (verify: `grep -c '"lint"' crialook-app/package.json | xargs -I {} sh -c '[ {} -ge 1 ] && grep "lint.*max-warnings" crialook-app/package.json | wc -l' ` returns `0`)
- `cd crialook-app && npm run lint 2>&1 | grep -E "^\s*[0-9]+ problems? \([0-9]+ errors?, [0-9]+ warnings?\)" || npm run lint 2>&1 | grep -q "0 problems"` — ESLint output shows either "0 problems" or "X problems (0 errors, Y warnings)" (zero errors required, warnings permitted)
</acceptance_criteria>

---

### Task 4: Verify lint runs cleanly + capture warning count baseline

<read_first>
- The output of Task 3's lint run
- .planning/phases/03-test-infra-and-flake-fix/03-CONTEXT.md (D-11 — "errors fail the job")
</read_first>

<action>
Run `cd crialook-app && npm run lint 2>&1 | tee /tmp/mobile-lint.log` and inspect:

1. **Required:** Exit 0. Zero errors.
2. **Acceptable:** Any number of warnings. Capture the count for the executor's commit body (format: `Phase 3 D-11 baseline: N warnings, 0 errors`).
3. **If exit non-zero (errors present):** The current codebase has lint errors that the relaxed-rule config doesn't catch. Two responses:
   - **Preferred:** Add the offending rule to the warn-downgrade list in `eslint.config.mjs`. The Phase 3 contract is "honest day-one lint", not "fix every legacy issue". Future phases can ratchet rules from `warn` to `error` as the codebase migrates.
   - **Forbidden:** Adding the offending file to `globalIgnores` to mask the error. That defeats the purpose.

After resolving any errors via rule downgrades, re-run lint. Confirm exit 0. Commit with message: `feat(crialook-app): add eslint flat config + lint script (Phase 3 D-11)`.

If the lint introduces a noticeable warning population (>50), flag it in the commit body so future contributors know the baseline isn't "no warnings" but rather "no errors, controlled warning surface".
</action>

<acceptance_criteria>
- `cd crialook-app && npm run lint` exits 0
- ESLint summary line shows `0 errors`
- The commit message body includes a baseline-warnings count (e.g., "baseline: 42 warnings, 0 errors")
- `globalIgnores` in `eslint.config.mjs` contains ONLY directory-style patterns (`node_modules/**`, `.expo/**`, etc.) — no individual `.ts/.tsx` source files masked to dodge errors
</acceptance_criteria>

---

## Verification

After all 4 tasks complete:

1. `test -f crialook-app/eslint.config.mjs` succeeds.
2. `cd crialook-app && npm run lint` exits 0 with zero errors.
3. `node -e "console.log(JSON.stringify(require('./crialook-app/package.json').scripts))" | grep -o '"lint"'` returns at least 1 match.
4. `grep -c "Phase 3 D-11" crialook-app/eslint.config.mjs` returns at least 1.
5. CI integration deferred to Plan 03-04. This plan does not modify `.github/workflows/ci.yml`.

## must_haves

```yaml
truths:
  - eslint_config_mjs_exists_in_crialook_app
  - lint_script_added_to_package_json
  - lint_runs_clean_zero_errors_warnings_ok
  - config_mirrors_campanha_ia_relaxed_rules_posture
  - no_changes_to_github_workflows_in_this_plan
acceptance:
  - npm_run_lint_exit_0
  - eslint_config_file_present
  - package_json_has_lint_script
  - zero_eslint_errors_warnings_permitted
```
