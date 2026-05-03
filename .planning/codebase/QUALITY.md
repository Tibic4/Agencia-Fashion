# Quality, Testing, CI & Observability

**Analysis Date:** 2026-05-03
**Scope:** Whole monorepo at `d:/Nova pasta/Agencia-Fashion/`
**Subprojects covered:** `campanha-ia/` (Next.js 16 web), `crialook-app/` (Expo Android-only). `curriculo/` skipped per orchestrator instructions.

---

## TL;DR

| Subproject | Test framework(s) | Test files | Tests counted | Last run result |
|------------|-------------------|------------|---------------|-----------------|
| `campanha-ia` | Vitest 4.1.5 (only) | 17 (16 src + 1 evals) | **148** | **146 pass / 2 fail** (2 timeouts in `judge.test.ts`) |
| `crialook-app` | Vitest 4.1.5 (lib/hooks/components) **+ Jest 29 / jest-expo** (RN renderer) | 9 vitest + 1 jest | **45** vitest + 1 jest | Vitest: **44 pass / 1 fail** (1 timeout in `api.regenerateCampaign.test.ts`); Jest not run here (very slow boot) |

**README is stale.** `README.md:169` claims *"33 testes unitários web (Vitest)"*. Real count is **148** vitest tests in `campanha-ia` (4× higher) — the README undersells coverage massively. Update or strip the number.

**Two flaky-by-timeout tests block "all green":** both fail with `Test timed out in 5000ms` even though the assertions look correct. Looks like environment slowness on Windows + dynamic `import()` paths, not real regressions. Detail in [Flaky tests](#flaky-tests).

**CI is split into two workflows** (`ci.yml` + `eval-on-pr.yml`). `ci.yml` has 3 jobs and gates merge. `eval-on-pr.yml` is a pinned **observability-only** PR comment that NEVER blocks (per Phase 02 D-24 + Phase 2.5 deferred indefinidamente — see project memory).

**Sentry is wired in 3 surfaces** (web client/server/edge + mobile RN) with thoughtful PII redaction lists and per-flow `tracesSampler`. **Coverage gap:** the biggest API route in the project, `src/app/api/campaign/generate/route.ts` (898 lines), has **0 captureError + 0 logger** calls — only 42 raw `console.*`. That's the AI pipeline entry point and it's blind in Sentry.

---

## Test Inventory

### `campanha-ia/` — Vitest only

**Config:** `campanha-ia/vitest.config.ts:1`
- `globals: true`, `environment: "node"`
- Includes: `src/**/*.test.ts(x)`, `tests/**/*.test.ts`, `evals/**/*.test.ts`
- Excludes: `node_modules`, `.next`, `scripts`
- Coverage thresholds (lines/functions/branches/statements): **30 / 30 / 25 / 30** — provider `v8`, scoped to `src/lib/**` + `src/app/api/**`.
- Coverage is NOT enforced in CI (no `--coverage` flag in `package.json` scripts). Pisos só disparam se devs rodarem manualmente.

**Test files (17 total):**

| File | Area | Notes |
|------|------|-------|
| `src/app/admin/quality/page.test.tsx` | Admin UI (quality dashboard) | Only `.tsx` test in suite |
| `src/lib/ai/judge.test.ts` | AI judge (Sonnet scorer) | |
| `src/lib/ai/log-model-cost.test.ts` | API cost telemetry | |
| `src/lib/ai/pipeline.test.ts` | Top-level pipeline orchestration | |
| `src/lib/ai/prompt-version.test.ts` | Prompt version hashing | |
| `src/lib/ai/sonnet-copywriter.test.ts` | Sonnet copy gen | |
| `src/lib/ai/with-timeout.test.ts` | Timeout wrapper | |
| `src/lib/db/set-campaign-scores.test.ts` | DB UPSERT (judge sentinel + happy) | |
| `src/lib/editor-session.test.ts` | Editor auth session | |
| `src/lib/inngest/judge.test.ts` | Inngest function (judgeCampaignJob) | **2 timeouts here** |
| `src/lib/mp-signature.test.ts` | Mercado Pago HMAC validator | Mentioned in README |
| `src/lib/observability.test.ts` | Logger + Sentry wrapper | |
| `src/lib/payments/google-play.test.ts` | Google Play RTDN handling | |
| `src/lib/quality/alerts.test.ts` | Threshold alerts (Sentry warn fingerprint) | |
| `src/lib/rate-limit.test.ts` | Rate limiter | Mentioned in README |
| `src/lib/validation.test.ts` | Validation helpers | Mentioned in README |
| `evals/run.test.ts` | Eval driver smoke | Phase 02 D-17 |

**Run commands** (from `campanha-ia/package.json:5-13`):
- `npm test` → `vitest` (watch mode)
- `npm run test:ci` → `vitest run` (one-shot, used by humans)
- CI invokes `npm test --if-present -- --run` (`.github/workflows/ci.yml:60`)

**Live run result** (`npm run test:ci`, ran 2026-05-03 from this analysis):
```
Test Files  1 failed | 16 passed (17)
Tests       2 failed | 146 passed (148)
Duration    26.15s
```

### `crialook-app/` — Vitest + Jest (dual)

Two non-overlapping configs by design — explicitly documented in `crialook-app/jest.config.js:3-9`:
- **Vitest** runs pure-logic tests for `lib/`, `hooks/`, `components/historico/` in `jsdom` (fast, no Metro/Flow). Mocks the entire RN universe in `vitest.setup.ts`.
- **Jest + jest-expo** runs anything in `__tests__/` at repo root that needs the real RN renderer + Reanimated mock + Expo module mocks (`jest.setup.ts`).

**Vitest config:** `crialook-app/vitest.config.ts:10-46`
- `environment: 'jsdom'`, `setupFiles: ['./vitest.setup.ts']`
- Includes: `lib/__tests__/**`, `hooks/__tests__/**`, `components/historico/__tests__/**`
- Coverage thresholds: **35 / 35 / 30 / 35** for `lib/**` + `hooks/**`. Higher than web — but also not enforced in CI.

**Jest config:** `crialook-app/jest.config.js:15-25`
- `preset: 'jest-expo'`, `testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}']`
- Long `transformIgnorePatterns` allow-list for ESM RN deps.

**Vitest test files (9):**

| File | Area |
|------|------|
| `lib/__tests__/api.classify.test.ts` | API client — classify endpoint |
| `lib/__tests__/api.regenerateCampaign.test.ts` | API client — regenerate (with reason) | **1 timeout here** |
| `lib/__tests__/i18n.lookup.test.ts` | i18n string lookup |
| `lib/__tests__/logger.test.ts` | Logger / sanitize |
| `lib/__tests__/reviewGate.spec.ts` | Play Store review prompt gate |
| `hooks/__tests__/useCampaignPolling.test.ts` | Polling hook (state machine) |
| `hooks/__tests__/useImagePickerSlot.test.ts` | Image picker slot hook |
| `hooks/__tests__/useModelSelector.test.tsx` | Model selector hook |
| `components/historico/__tests__/RegenerateReasonPicker.test.tsx` | Bottom sheet UI (Phase 02 D-11) |

**Jest test files (1):**

| File | Area |
|------|------|
| `__tests__/example-pulsing-badge.test.tsx` | Pulsing badge (only Jest test that exists today — see Coverage Gaps) |

**Run commands** (from `crialook-app/package.json:14-18`):
- `npm test` → `vitest run` (one-shot)
- `npm run test:watch` → `vitest`
- `npm run test:rn` → `jest`
- `npm run test:rn:watch` → `jest --watch`
- CI invokes `npm test` only — Jest **is not in CI**.

**Live run result** (`npm test`, ran 2026-05-03):
```
Test Files  1 failed | 8 passed (9)
Tests       1 failed | 44 passed (45)
Duration    46.42s (environment 107.42s — slow jsdom boot on Windows)
```

`npm run test:rn` was not executed in this analysis (jest-expo cold start exceeds 60s threshold).

---

## Lint / Typecheck / Format

### `campanha-ia`

**ESLint:** `campanha-ia/eslint.config.mjs:1-43` — flat config, extends `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`. Custom ignores: `scripts/**`, `scratch/**` (prototype playground TS files with deliberate `any`).
- Many strict rules **downgraded to warning** explicitly to keep CI green during legacy migration: `@typescript-eslint/no-explicit-any`, `@next/next/no-img-element`, `react-hooks/exhaustive-deps`, `react-hooks/purity`, `react-hooks/refs`, `react-hooks/set-state-in-effect`, `prefer-const`, unused-vars (with `^_` ignore). Comments in the config flag this as "migração gradual".

**TypeScript:** `campanha-ia/tsconfig.json:1-38`
- `strict: true`, `noFallthroughCasesInSwitch: true`, `noImplicitOverride: true`
- `noUnusedLocals: false`, `noUnusedParameters: false` (relaxed)
- `module: "esnext"`, `moduleResolution: "bundler"`, `paths: { "@/*": ["./src/*"] }`
- `exclude: ["node_modules", "scripts"]` (tracks ESLint ignore)

**Scripts:** `npm run lint` (`eslint`), `npm run typecheck` (`tsc --noEmit`)

**Format:** No Prettier config detected at root or in `campanha-ia/`. Formatting relies on ESLint `--fix` via lint-staged.

### `crialook-app`

**ESLint:** No `eslint.config.*` or `.eslintrc*` in `crialook-app/`. Lint **not part of CI** for the mobile project (`ci.yml:62-87` runs only typecheck + tests). Documented gap.

**TypeScript:** `crialook-app/tsconfig.json:1-17`
- Extends `expo/tsconfig.base`
- `strict: true`
- `paths: { "@/*": ["./*"] }` (root-relative, NOT `src/`)

**Scripts:** `npm run typecheck` (`tsc --noEmit`)

---

## Pre-commit Hooks

**Active hook:** `campanha-ia/.husky/pre-commit:1-12`

```sh
cd campanha-ia || exit 1
npx tsc --noEmit || {
  echo "✗ TypeScript errors — commit abortado"
  exit 1
}
```

**Notes:**
- Husky 9 installed via `prepare` script: `cd .. && husky campanha-ia/.husky` (`campanha-ia/package.json:13`).
- The hook **only runs typecheck** — no lint-staged, no test, no mobile typecheck. Justification in the hook itself: "lint-staged 16 tem um bug com Node v24 (ENOENT git checkpoint)". Trade-off: full-project tsc takes ~3s but covers everything.
- `lint-staged` config exists in `campanha-ia/package.json:15-19` but is NOT actually wired (the husky hook doesn't call `lint-staged`; lint-staged in package.json is dead config).
- No husky in `crialook-app/`. Mobile changes can be committed with type errors locally.
- The repo-root `.husky/_/` directory is the husky-installed shim folder, not a separate setup.

---

## CI / CD

### `.github/workflows/ci.yml` — gating CI

**Triggers:** `push` to `main` or `audit/**`; `pull_request` to `main`.

**Jobs (3, all `runs-on: ubuntu-latest`, Node 24):**

| Job | Working dir | Steps | Notes |
|-----|-------------|-------|-------|
| `lint-typecheck-build` | `campanha-ia` | `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build` (with placeholder env vars for Supabase/Clerk) | Build runs without prod secrets (placeholders inline at `ci.yml:36-43`) |
| `test` | `campanha-ia` | `npm ci` → `npm test --if-present -- --run` | Vitest only |
| `mobile-typecheck-test` | `crialook-app` | `npm ci --legacy-peer-deps` → `npm run typecheck` → `npm test` | Uses `--legacy-peer-deps` per the EAS npm 10 lock constraint (project memory). **No lint job** for mobile. **Jest is not run.** |

All jobs cache `node_modules` per subproject `package-lock.json`.

**Risks:**
- The 2 timeouts in `judge.test.ts` (campanha-ia) and 1 in `api.regenerateCampaign.test.ts` (crialook-app) reproducibly fail locally on this machine. If they're Windows-only, CI on Linux may be green. If not, **`main` may be red** intermittently.
- Build job inlines env placeholders. If a feature starts requiring a real env var at build time (say a `process.env.X` reached during static gen), the placeholder strategy silently breaks build but produces a misleading green if `.env` happens to leak in.

### `.github/workflows/eval-on-pr.yml` — observability-only Promptfoo

**Triggers:** `pull_request` to `main`, only on path changes to `campanha-ia/src/lib/ai/**`, `campanha-ia/evals/**`, `campanha-ia/promptfoo.config.yaml`, or itself.

**Concurrency:** `eval-on-pr-${{ pr_number }}` with `cancel-in-progress: true` — saves CI minutes on rapid pushes.

**Permissions:** `contents: read`, `pull-requests: write`, `issues: write`. No `contents: write`, no secrets exposure.

**Job:** `eval` (single)
1. Install deps, run `npx --yes tsx evals/run.ts` (driver, dryRun:true, no live API calls today)
2. Run `npx promptfoo eval --config evals/promptfoo.config.yaml --output evals/results/promptfoo-${{ pr_number }}.json`
3. Comment results JSON on the PR via `actions/github-script@v7`

**The whole job is `continue-on-error: true` (`eval-on-pr.yml:41`)** AND every step also has `continue-on-error: true`. **NEVER blocks merge.** This is intentional and locked in per project memory: *"Phase 2.5 deferred indefinidamente — Promptfoo nunca block PR"*. The header comment at `eval-on-pr.yml:1-7` and the in-job comment at lines 38-41 both spell this out, anchoring the contract.

**No other workflows** in `.github/workflows/`. No CodeQL, no Dependabot config detected, no security scanning, no release workflow, no deploy.

**Deploy is shell-based and out-of-band:** `deploy-crialook.sh` at repo root + `ecosystem.config.js` (PM2) at root. No automated deploy on merge.

---

## Observability

### Sentry — web (`@sentry/nextjs ^10.47.0`)

Three init files at `campanha-ia/` root, all with PII-redaction `beforeSend` + `beforeBreadcrumb`:

| File | Purpose | Key behavior |
|------|---------|--------------|
| `campanha-ia/sentry.client.config.ts:1-85` | Browser | `enabled: isProd` (off in dev), `tracesSampleRate: 0.2`, replay only on error in prod (`maskAllText/Inputs`, `blockAllMedia`), 12-key sensitive header redact, denyUrl `/api/health` |
| `campanha-ia/sentry.server.config.ts:1-59` | Node runtime | Same redactor with **expanded** sensitive list (15 keys including all provider API keys: `anthropic_api_key`, `google_ai_api_key`, `gemini_api_key`, `fashn_api_key`, `fal_key`, `supabase_service_role_key`, `mercadopago_*`, `editor_*`). Ignores `Pipeline:Scorer` errors — possibly silencing real judge failures, audit later. |
| `campanha-ia/sentry.edge.config.ts:1-25` | Edge middleware | Minimal, lower `tracesSampleRate: 0.1`, header-only regex redact (no recursion to keep edge cheap) |

Wrapper utilities in `campanha-ia/src/lib/observability.ts:1-80`:
- `logger.{debug,info,warn,error}` — timestamped console with optional context object
- `captureError(err, ctx)` — `Sentry.withScope` + `setExtra` + console fallback, never throws
- `identifyForSentry(userId, storeId)` — sets Sentry user (id-only, no email)
- `emitWarning(...)` — synthetic Sentry warnings with stable fingerprints for cron alerts (Phase 02 D-10)

### Sentry — mobile (`@sentry/react-native 7.13.0`)

Init at `crialook-app/lib/sentry.ts:1-80+`:
- DSN from `EXPO_PUBLIC_SENTRY_DSN`, `enabled: !__DEV__`
- **Session Replay defensively disabled in 2 layers** — both sample rates = 0 AND `MobileReplay`/`ReplayIntegration` filtered from `defaults`. Comments at lines 25-37 document the 51s boot freeze on AAB caused by Sentry RN 7.2.0 (MediaCodec + `registerDefaultNetworkCallback`); 7.13+ fixes it but the defense-in-depth stays as a tripwire.
- `tracesSampler` overrides: 100% on `campaign.generate`, `billing.purchase`, `billing.restore`; 50% on `gerar` / `plano` / `gerar/resultado` screens; 10% default
- `release` from `Application.nativeApplicationVersion`, `dist` from `nativeBuildVersion` — gives Sentry per-build attribution
- `beforeSend` strips sensitive headers + reduces `event.user` to `{ id }` only
- `beforeBreadcrumb` drops console.log breadcrumbs and likely fetch/xhr noise

The mobile Sentry config is the most defensive piece of observability code in the repo — it should stay frozen unless a real problem appears.

### Logger usage (web)

API routes are inconsistent:
- 11 routes import `captureError` or `Sentry`. Highest-instrumented: `webhooks/clerk` (2), `webhooks/mercadopago` (3 captureError calls + 26 console.\*), `billing/verify` (5), `billing/restore` (4), `billing/rtdn` (4), `me/route.ts` (6).
- **41 routes do NOT import Sentry at all.** (52 total - 11 with Sentry).
- The most important blind spot is `src/app/api/campaign/generate/route.ts` — **898 lines**, **0 captureError**, **0 logger.\*** calls, **42 raw `console.*`** statements. This is the AI campaign-generation entry point (the headline product feature). Errors here vanish into PM2 stdout logs only.

### Logs (operational)

- README:179 says *"Logs estruturados em `/var/log/crialook/`"* — that's PM2-managed structured stdout, not in-repo.
- No log-aggregation client (no Datadog, no Logtail, no Loki SDK in deps).

### Eval / Promptfoo state

**Files in `campanha-ia/evals/`:**
- `promptfoo.config.yaml:1-44` — minimal pass-by-default config. Provider is `echo`, single test asserts `is-json` on the literal `"{}"`. Phase 2.5 will replace tests with real DOMAIN-RUBRIC.md asserts and switch provider to `file://./results/last-run.jsonl` produced by `run.ts`.
- `run.ts:1-137` — Phase 02 D-17/D-18 driver. Reads `evals/golden-set/*.json`, skips `_*` IDs, runs `runCampaignPipeline({ ...input, dryRun: true })` per entry, writes JSONL to `evals/results/last-run.jsonl`. Currently the golden-set is empty except `example.json` (skipped by `_` prefix) → driver exits 0 with "no entries to evaluate".
- `run.test.ts` — smoke for the driver itself.
- `golden-set/` — `SCHEMA.md` (canonical schema doc), `example.json` (skipped sample, `_example_do_not_run`).
- `results/` — `promptfoo-output.json` from a prior local run. No `last-run.jsonl` yet.

**Per project memory:** Phase 2.5 (labeling) is **deferred indefinidamente**. Judge captures uncalibrated. Do not propose Phase 2.5 implementation without authorization. Promptfoo never blocks PR.

---

## Test data and fixtures

| Location | Contents | Use |
|----------|----------|-----|
| `campanha-ia/test-images/model-bank/` | 19 PNGs of model banks (`normal_*`, `plus_*` skin/hair combos) + 2 generation result JSONs | Manual model-bank generation scripts (`scripts/generate-model-bank*.ts`) — NOT consumed by automated tests |
| `campanha-ia/evals/golden-set/` | `SCHEMA.md` + `example.json` (skipped) | Future golden set; empty in practice today |
| `campanha-ia/evals/fixtures/` | Empty directory | Reserved |
| `campanha-ia/evals/results/` | `promptfoo-output.json` (prior run artifact) | Local + CI output target |
| `campanha-ia/scripts/test-*.ts` | 14 manual pipeline test scripts (`test-pipeline-*`, `test-fashn-*`, `test-nano-banana.ts`, `test-foto2.ts`, etc.) | Hand-driven smoke tests against live AI providers; ignored by ESLint and tsc; **not in CI** |
| `loadtests/scenarios/` | 8 k6 scenarios (`01-smoke-public.js` through `07-webhook-bombardment.js`) targeting prod `crialook.com.br` | Manual perf testing; not in CI |
| `crialook-app/storybook/` | Storybook setup (deps in `devDependencies` but no test integration) | Visual dev only |

---

## Coverage Gaps (critical paths without tests)

This is what the planner/executor needs to know before touching these areas — they have **no safety net**.

### High-severity (revenue-impacting, security-impacting, AI-pipeline)

1. **`campanha-ia/src/app/api/campaign/generate/route.ts` (898 lines)** — AI campaign generation, the headline product flow.
   - **No route-level test.** `pipeline.test.ts` covers the orchestrator function but the HTTP route handler (auth, idempotency-key handling, RLS scoping, rate-limit invocation, request validation, response shape) is fully untested.
   - **No Sentry instrumentation.** 42 `console.*`, 0 `captureError`, 0 `logger.*`. Errors are invisible to ops.
   - Risk: payment-eligibility checks, free-credit decrement, idempotency, plan-tier gating all live here uninstrumented and untested at the HTTP boundary.

2. **`src/app/api/webhooks/mercadopago/route.ts` (318 lines)** — Mercado Pago payment webhook.
   - Has 3 `captureError` calls (good) but **no integration test for the route handler itself**. `mp-signature.test.ts` validates the HMAC validator in isolation; the actual signature-check + idempotency + plan-update flow has no end-to-end assertion.
   - Risk: signature-validation regression silently drops real payments OR accepts spoofed ones.

3. **`src/app/api/billing/verify/route.ts` (153 lines)** — Google Play purchase verification.
   - Has 5 captureError calls. `payments/google-play.test.ts` covers the verifier helper. **Route handler untested.**
   - Risk: handing out subscription credits on bad input.

4. **`src/app/api/billing/rtdn/route.ts`** — Google Play Real-Time Developer Notifications.
   - Has 4 captureError calls. **No test.** Cancellation/grace-period logic runs blind.

5. **`src/app/api/cron/downgrade-expired/route.ts`** — Cron that downgrades expired subscriptions.
   - 2 captureError calls. **No test.** A bug here silently keeps paying users on free tier or vice versa.

6. **Inngest `judgeCampaignJob`** — `src/lib/inngest/functions.ts` (tested via `judge.test.ts`, but **2 of those tests are timing out**, see Flaky tests). When green, it covers happy path + sentinel + idempotency + event name + retries. Solid intent, brittle execution.

### Medium-severity

7. **41 of 52 API routes have no Sentry import.** Listed as a class — most of the `admin/*`, `model/*`, `models/*`, `store/*`, `showcase/*`, `campaigns/*`, `credits/*` routes lean on global Sentry tracing only.
8. **RLS-protected RPCs / server actions:** No tests verify that admin/service-role boundaries can't be crossed from a non-admin caller. RLS is enforced at the DB and trust is implicit.
9. **`src/app/api/store/push-token/route.ts`** — push notification token registration, no test, 4 captureError calls only.
10. **`crialook-app/__tests__/`** — only **1 jest test file** (`example-pulsing-badge.test.tsx`). The directory is essentially empty. The mobile app ships with virtually zero RN-renderer test coverage. Vitest does cover lib/hooks well, but no screens, no navigation flows, no IAP UI.

### Low-severity but worth flagging

11. No e2e tests anywhere. No Playwright, no Cypress, no Detox, no Maestro.
12. No `crialook-app` lint config → no lint job → mobile code style drifts.
13. `lint-staged` config in `campanha-ia/package.json:15-19` is dead (not invoked by the husky hook).
14. Coverage thresholds defined in both vitest configs but not enforced in CI — easy to regress without noticing.

---

## Flaky tests

Reproduced locally during this analysis. Both look like environment-induced timeouts on Windows (slow dynamic `import()` resolution under `defaults.run`) rather than logic regressions.

### `campanha-ia/src/lib/inngest/judge.test.ts`

```
× judgeCampaignJob — happy path > calls scoreCampaignQuality → setCampaignScores → logModelCost in order   (timed out 5000ms)
× judgeCampaignJob — onFailure handler writes falha_judge sentinel > nivel_risco='falha_judge' + numerics=1 (timed out 5000ms)
```

Both tests do `await import("./functions")` (lines 130, 190) inside the `it()`. First load triggers the entire `lib/inngest/functions.ts` graph to compile (Inngest client + storage-gc deps + supabase + AI module pulls). On Windows this regularly exceeds 5s. **Fix candidates:**
- Bump `testTimeout` to 15000ms in this test file (or globally in vitest config)
- Hoist the `import("./functions")` to a top-level `beforeAll` and reuse the resolved module
- Add the import as a static `import` at file top instead of dynamic

7 other tests in the same file pass quickly — the timeout is purely the cold-import cost on the first 2.

### `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts`

```
× Test 1 — no reason → POSTs without body, resolves to legacy paid payload  (timed out 5000ms)
```

Vitest reports `environment 107.42s` for this run — jsdom cold-boot dominates. Same fix shape: bump `testTimeout` or warm jsdom in a setup hook. The other 3 tests in the same file pass.

---

## Where to focus next (quality-wise)

If a future phase wants to harden quality, prioritize in this order:

1. **Stabilize the 3 timing-out tests** (15-min job — bump `testTimeout` or hoist dynamic imports). Without this, "all green" is a lie.
2. **Add Sentry + structured logging to `api/campaign/generate/route.ts`** — the biggest blind spot in the product. Replace 42 `console.*` with `logger.*` + add `captureError` at every catch.
3. **Add HTTP-level tests for the 3 payment routes** (`webhooks/mercadopago`, `billing/verify`, `billing/rtdn`). Pattern: stub Supabase admin client + IAP verifier, drive the route handler with `Request` objects, assert response + side effects.
4. **Update README:169** — replace `33 testes unitários` with the live count or strip the number.
5. **Add `eslint` to `crialook-app`** so the mobile project has lint parity with web. CI job is a 5-line patch to `ci.yml`.
6. **Wire coverage into CI** — `npm test -- --coverage` and let the existing thresholds (30/35) act as a ratchet.

---

*Quality audit: 2026-05-03. All file paths verified against repo state at this date.*
