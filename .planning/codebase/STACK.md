# Technology Stack

**Analysis Date:** 2026-05-03
**Scope:** Full monorepo at `d:/Nova pasta/Agencia-Fashion/` (CriaLook — SaaS B2C de geração de campanhas de moda com IA)

## Monorepo Layout

| Subproject | Purpose | Status |
|------------|---------|--------|
| `campanha-ia/` | Next.js 16 web app (production at crialook.com.br) — landing, dashboard, AI pipeline, webhooks, admin | Live in prod |
| `crialook-app/` | Expo SDK 54 React Native app — **Android-only**, distributed via Google Play | In Play Store review (Clerk Client Trust disabled) |
| `loadtests/` | k6 v1.7.1 stress/load scenarios pointing at prod | Active |
| `ops/` | Bash ops scripts (`backup-supabase.sh`, `health-check.sh`) | Active |
| `docs/` | Architecture/audit docs, juridico, legacy notes | Reference only |
| `curriculo/` | Standalone Python script — generates Alton's CV PDF via ReportLab. Unrelated to the SaaS. | Trivial / unrelated |

Root-level scripts: `deploy-crialook.sh` (idempotent VPS bootstrap), `ecosystem.config.js` (PM2), `nginx-crialook.conf`, `Agencia-Fashion.code-workspace`.

There is **no workspace manifest** (no root `package.json`, no `pnpm-workspace.yaml`, no Nx/Turbo config). Each subproject has its own independent `package.json` + `package-lock.json`. The "monorepo" is purely directory-level.

---

## Per-Subproject Stack

### `campanha-ia/` — Next.js 16 web

#### Languages & Runtime

| Item | Version | Source |
|------|---------|--------|
| TypeScript | `^5` (devDep) | `package.json` |
| TS target | `ES2017`, `module: esnext`, `moduleResolution: bundler`, `strict: true`, `noImplicitOverride: true` | `tsconfig.json` |
| Node (CI + prod) | **24.x** (Node 24 LTS) | `.github/workflows/ci.yml`, `deploy-crialook.sh` line 56 |
| Node (Docker) | `20-alpine` (multi-stage) | `Dockerfile` line 7,13,43 — **mismatch with CI/prod (24)**, see Concerns |
| Path alias | `@/* → ./src/*` | `tsconfig.json` |

#### Frameworks & Major Libs

| Library | Version | Use |
|---------|---------|-----|
| `next` | `16.2.4` | App Router, API routes, server actions, ISR |
| `react` / `react-dom` | `19.2.4` | UI runtime |
| `@sentry/nextjs` | `^10.47.0` | Error tracking + tunnel route `/monitoring` |
| `tailwindcss` | `^4` (via `@tailwindcss/postcss`) | Styling — PostCSS plugin model (no `tailwind.config.js`) |
| `framer-motion` | `^12.38.0` | Animations |
| `konva` + `react-konva` | `^10.2.3` + `^19.2.3` | Canvas-based design editor |
| `lucide-react` | `^1.8.0` | Icons (note: 1.x is the new majors, was 0.x — confirm intentional) |
| `html2canvas-pro` | `^2.0.2` | DOM-to-canvas rendering |
| `sharp` | `^0.34.5` | Server-side image processing (declared as `serverExternalPackages` in `next.config.ts`) |
| `tailwind-merge` | `^3.5.0` | Tailwind class merging |

**AI providers (the core business value):**

| Library | Version | Use |
|---------|---------|-----|
| `@anthropic-ai/sdk` | `^0.92.0` | Claude Sonnet — copywriting (`src/lib/ai/sonnet-copywriter.ts`) |
| `@google/genai` | `^1.48.0` | Gemini — image analysis + VTO (`src/lib/ai/gemini-analyzer.ts`, `gemini-vto-generator.ts`) |
| `@fal-ai/client` | `^1.9.5` | Fallback IDM-VTON virtual try-on |
| `fashn` | not in current `package.json` (was in prior STACK doc) | **Removed or never installed** — verify; `src/lib/ai/` no longer references fashn |

**Auth, payments, jobs:**

| Library | Version | Use |
|---------|---------|-----|
| `@clerk/nextjs` | `^7.0.8` | Auth |
| `@clerk/localizations` | `^4.3.0` | i18n strings for Clerk UI |
| `mercadopago` | `^2.12.0` | Subscription billing (PreApproval), HMAC-validated webhooks |
| `inngest` | `^4.1.2` | Async pipeline orchestration, storage GC, judge runs |
| `jose` | `^6.2.3` | JWT handling (Clerk session, Google PubSub auth) |
| `posthog-js` | `^1.364.7` | Product analytics (consent-gated) |

**Data & validation:**

| Library | Version | Use |
|---------|---------|-----|
| `@supabase/supabase-js` | `^2.101.1` | Postgres client |
| `@supabase/ssr` | `^0.10.0` | SSR cookie/session helpers |
| `zod` | `^4.3.6` | Schema validation (env, API inputs) — **note: zod 4 is recent major; check breaking changes in `src/lib/schemas.ts`** |
| `zod-to-json-schema` | `^3.25.2` | LLM tool-schema generation |
| `uuid` | `^14.0.0` | UUID generation |
| `clsx` | `^2.1.1` | className composition |

**Note:** Google Play Developer API auth (`src/lib/payments/google-play.ts`, `google-pubsub-auth.ts`) uses **`google-auth-library` ^10.x** — but it's **not declared** in `package.json` direct deps. It appears only as a transitive in `package-lock.json`. The current implementation rolls its own JWT signing via `jose` + `fetch` rather than depending on `googleapis`. See the file's docstring — it's a placeholder waiting for service-account config.

#### Build / Test / Lint

| Tool | Version | Config | Notes |
|------|---------|--------|-------|
| Build | `next build` (Turbopack, root pinned to handle space in path) | `next.config.ts` | `compress: false` (Nginx handles brotli/gzip) |
| Test runner | `vitest` `^4.1.5` | `vitest.config.ts` | Node env, coverage v8 reporter, thresholds 25–30% (intentional floor) |
| Test UI | `@vitest/ui` `^4.1.5` | — | |
| Lint | `eslint` `^9` + `eslint-config-next` `16.2.2` | `eslint.config.mjs` (flat config) | React 19/Next 16 hook rules (`purity`, `refs`, `set-state-in-effect`) downgraded to warn during legacy migration |
| Pre-commit | `husky` `^9.1.7` + `lint-staged` `^16.4.0` | `package.json` `lint-staged` block | Runs `eslint --fix` on staged `.ts`/`.tsx` |
| Type-check | `tsc --noEmit` | `tsconfig.json` | Used in CI (separate step from build) |
| Eval harness | `promptfoo` `^0.121.9` (devDep) | `evals/promptfoo.config.yaml` | **Phase 02 placeholder** — `is-json` against `"{}"` so CLI always exits 0; observability-only. Never blocks PR (`continue-on-error: true` in `eval-on-pr.yml`). |

#### Package Manager

- **npm**, lockfileVersion **3** (npm 7+ format).
- Single `package-lock.json` per subproject; no workspaces.
- `npm ci` works fine in CI without flags.

#### Notable runtime config

- `next.config.ts`: explicit Turbopack `root` to handle the Windows path with space (`Nova pasta`). `compress: false`. Image optimization with AVIF/WebP, 30-day cache TTL, `remotePatterns` whitelisting only the Supabase storage CDN (`emybirklqhonqodzyzet.supabase.co`).
- `src/instrumentation.ts` boots zod env validation at server start (fail-fast).
- `serverExternalPackages: ["canvas", "sharp"]` — keeps native modules out of the bundler so they load on the Linux VPS.

---

### `crialook-app/` — Expo SDK 54 React Native (Android-only)

#### Languages & Runtime

| Item | Version | Source |
|------|---------|--------|
| TypeScript | `~5.9.2` (devDep) | `package.json` |
| TS config | extends `expo/tsconfig.base`, `strict: true`, alias `@/* → ./*` | `tsconfig.json` |
| Node (CI) | **24.x** | `.github/workflows/ci.yml` |
| npm | **must be `npm@10`** for lockfile compat with EAS — see Critical Constraints below |
| React Native | `0.81.5` | `package.json` |
| React | `19.1.0` (pinned exact via `overrides`) | `package.json` |

#### Frameworks & Major Libs

| Library | Version | Use |
|---------|---------|-----|
| `expo` | `~54.0.34` | RN framework |
| `expo-router` | `~6.0.23` | File-based routing under `app/` |
| `expo-updates` | `~29.0.17` | Installed but **OTA disabled** (`updates: { enabled: false }` in `app.config.ts`) |
| `react-native-reanimated` | `~4.1.1` | GPU animations |
| `react-native-worklets` | `0.5.1` | Reanimated 4 worklets runtime |
| `react-native-gesture-handler` | `~2.28.0` | Touch gestures |
| `react-native-safe-area-context` | `~5.6.0` | Safe area |
| `react-native-screens` | `~4.16.0` | Native screen primitives |
| `@react-navigation/native` | `^7.1.8` | Navigation primitives (used through expo-router) |
| `@gorhom/bottom-sheet` | `^5.2.10` | Bottom sheet (regenerate-reason picker, model preview) |
| `@shopify/flash-list` | `2.0.2` | High-perf lists |
| `@shopify/react-native-skia` | `2.2.12` | GPU 2D graphics. **Skia 2.x no longer exports `/plugin` — Expo autolinking handles native binding.** |
| `react-native-nitro-modules` | `^0.35.0` | MMKV backbone (Nitro v3) |
| `react-native-mmkv` | `^3.2.0` | Fast persistent KV store |
| `@react-native-async-storage/async-storage` | `2.2.0` | Standard async storage (used by Clerk + tanstack-query persister) |
| `@react-native-community/netinfo` | `11.4.1` | Network state |
| `@react-native-masked-view/masked-view` | `^0.3.2` | Masked views |
| `react-native-iap` | `^14.7.20` | Google Play Billing (subscriptions) |
| `react-native-web` | `~0.21.0` | Present for Storybook/web preview, **not a deployment target** |
| `expo-image` | `~3.0.11` | Cached image rendering |
| `expo-image-manipulator` | `~14.0.8` | Client-side resize/compress |
| `expo-image-picker` | `~17.0.11` | Photo selection |
| `expo-camera` | `~17.0.10` | Camera capture |
| `expo-media-library` | `~18.2.1` | Save campaigns to gallery |
| `expo-notifications` | `~0.32.17` | Push notifications |
| `expo-secure-store` | `~15.0.8` | Secure credential storage (Clerk token) |
| `expo-auth-session` | `~7.0.11` | OAuth flow |
| `expo-localization` | `~17.0.8` + `i18n-js` `^4.5.3` | i18n |
| `expo-blur`, `expo-haptics`, `expo-linear-gradient`, `expo-linking`, `expo-clipboard`, `expo-mail-composer`, `expo-sharing`, `expo-splash-screen`, `expo-status-bar`, `expo-store-review`, `expo-web-browser`, `expo-application`, `expo-constants`, `expo-crypto`, `expo-device`, `expo-file-system` `~19.0.21`, `expo-font` `~14.0.11`, `expo-keep-awake` `~15.0.8` | SDK-pinned ranges | Standard Expo APIs |
| `@expo-google-fonts/inter` | `^0.4.2` | Inter font family |
| `@expo/vector-icons` | `^15.0.3` | Icon set |

**State / queries / auth / observability:**

| Library | Version | Use |
|---------|---------|-----|
| `@tanstack/react-query` | `^5.62.0` | Server state |
| `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister` | `^5.62.0` | Cache persistence (AsyncStorage) |
| `@clerk/clerk-expo` | `^2.19.31` | Auth — **Client Trust currently disabled for Play review (re-enable post-approval per user memory)** |
| `@clerk/types` | `^4.101.23` | Shared auth types |
| `@sentry/react-native` | `7.13.0` (exact pin, not `~`) | Error tracking. **Pinned above SDK 54's `~7.2`** — 7.2 had a native bug (MediaCodec + `registerDefaultNetworkCallback`) that froze the JS thread for 51s on cold start of prod AAB even with `replaysSessionSampleRate: 0`. Documented in `package.json` `_install_exclude_reason`. |
| `zod` | `^3.23.8` | Validation — note this is **zod 3.x** while web is on **zod 4.x** (intentional split: zod 4 had RN/Hermes issues at the time) |

#### Build / Test / Lint

| Tool | Version | Config | Notes |
|------|---------|--------|-------|
| Build | EAS Build (`eas.json`) | EAS CLI `>= 16.0.0` | Three profiles: `development` (apk + dev client), `preview` (apk, internal distribution), `production` (app-bundle, autoIncrement). All profiles set `SENTRY_DISABLE_AUTO_UPLOAD=true`. |
| Submit | EAS Submit (Android only) | `eas.json` `submit.production` | `serviceAccountKeyPath: ./play-store-key.json`, track `internal`, releaseStatus `draft`. |
| Native build properties | `expo-build-properties` ~1.0.10 | `app.config.ts` | `compileSdkVersion: 35`, `targetSdkVersion: 35`, `minSdkVersion: 24`, `kotlinVersion: 2.1.20`, ProGuard/shrink/minify enabled in release, Predictive Back gesture on. |
| Test (logic) | `vitest` `^4.1.5` + `jsdom` `^29.0.2` | `vitest.config.ts` | Runs against `lib/__tests__/`, `hooks/__tests__/`, `components/historico/__tests__/`. Coverage thresholds 30–35%. |
| Test (RN renderer) | `jest` `^29.7.0` + `jest-expo` `~54.0.0` + `@testing-library/react-native` `^12.8.0` + `react-test-renderer` `19.1.0` | `jest.config.js`, `jest.setup.ts` | Runs against `__tests__/**`. `transformIgnorePatterns` covers ESM-only RN/Expo/Clerk/Gorhom/Skia packages. |
| Test (DOM) | `@testing-library/react` `^16.3.2` + `@testing-library/dom` `^10.4.1` | — | For Storybook component tests |
| Lint | **No project ESLint config detected** — relies on Expo defaults via TS strict mode | — | **Concern**: no `eslint.config.*` at app root; lint not in mobile CI step |
| Type-check | `tsc --noEmit` (CI step) | `tsconfig.json` | |
| Storybook | `storybook` + `@storybook/react-vite` `^8.6.18`, `@storybook/addon-essentials` `^8.6.14`, `@vitejs/plugin-react` `^5.2.0`, `vite` `^6.4.2` | `.storybook/` (per `storybook/` dir) | **PEER-DEP CONFLICT — see below** |
| Babel | `babel-preset-expo` + `transform-remove-console` `^6.9.4` (production only, keeps `error`/`warn`) | `babel.config.js` | Strips `console.log` in prod bundles to keep Hermes JS thread clean |
| Sharp (devDep) | `^0.34.5` | — | Used by `scripts/compress-bg.js` for asset compression at dev time |

#### Critical Constraints (from user memory + repo guards)

1. **EAS lockfile must be npm@10 format.** npm 11+ regenerates `package-lock.json` with new overrides/workspaces syntax that breaks EAS Build. Enforced by `scripts/preinstall-guard.js` (runs as `preinstall` hook). Allowed: `npm ci`, `npm run lock:fix`. Blocked: `npm install` with npm ≥11. **Recovery:** `npm run lock:fix` (rm lockfile + `npx npm@10 install --legacy-peer-deps`).
2. **`.npmrc`** at app root sets `legacy-peer-deps=true` globally — required because `react-native-iap`, Storybook, and Skia ship floating peer ranges that don't all align cleanly.
3. **Android-only.** No iOS distribution; iOS sections in `app.config.ts` are kept defensively (so `expo prebuild` doesn't break) but never reach a build. Drop iOS-specific code paths/props in new work.
4. **React 19.1.0 pinned exactly via `overrides`.** RN 0.81.5 ships a renderer that requires exactly 19.1.0; Storybook/vitest peers occasionally pull newer 19.x and break the renderer at runtime. Also in `expo.install.exclude` so `expo install --fix` won't realign.
5. **`@solana-mobile/mobile-wallet-adapter-protocol` excluded from autolinking** (`expo.autolinking.exclude`). Comes in transitively via `@clerk/clerk-js` (Solana wallet auth feature). Solana not enabled in Clerk Dashboard, so excluding saves Gradle compile time.
6. **Clerk Client Trust disabled** for Play Store review per user memory. Re-enable when app is approved.
7. **OTA updates disabled** (`expo-updates` installed but `updates.enabled: false`) — previous `enabled: true` without `url` was throwing `InitializationError` in boot logs.
8. **Sentry Session Replay disabled** at JS init (sample rates = 0) because the Expo Sentry plugin doesn't expose a build-time flag.

#### Peer-Dependency Conflict (from `TASKS.md` 🔴 Critical)

**Storybook × Vite mismatch in `crialook-app/`:**

- `vite` `^6.4.2` (devDep)
- `@storybook/react-vite` `8.6.18` only declares peer-dep range `vite 4-6` (minor version arithmetic — accepts up to 6.x)
- Listed in `TASKS.md` as a 🔴 Critical issue based on an older state where Vite was `^8.0.10`. **As of current `package.json`, Vite is back at `^6.4.2`, so the conflict may already be resolved** — but the `legacy-peer-deps=true` flag is still masking any residual mismatch. Verify by attempting `storybook dev` without `--legacy-peer-deps` after a clean install.
- Resolution paths from `TASKS.md`: (a) keep Vite at 6.x (current state — appears done), (b) upgrade `@storybook/react-vite` to 9.x, (c) drop Storybook if unused.

#### Package Manager

- **npm**, lockfileVersion **3**, but **MUST be generated by npm 10** (not 11+).
- `.npmrc` → `legacy-peer-deps=true`.
- **CI uses `npm ci --legacy-peer-deps`** (`.github/workflows/ci.yml` line 80).

---

### `loadtests/` — k6 stress/load suite

| Item | Version | Source |
|------|---------|--------|
| Runner | `k6` `1.7.1` (Grafana) | `loadtests/README.md` |
| Language | JavaScript (k6 runtime, not Node) | `scenarios/*.js` |
| Manifest | None — no `package.json` | — |
| Aux | PowerShell helper `set-cookie.ps1` for capturing Clerk session cookies | `loadtests/set-cookie.ps1` |

Scenarios (`loadtests/scenarios/`):

- `01-smoke-public.js`, `01b-smoke-per-endpoint.js` — sanity checks
- `02-load-landing.js` — ramp 1→100 VUs on landing
- `03-smoke-authenticated.js`, `04-load-authenticated.js` — authenticated flows (require Clerk cookie)
- `05-stress-to-break.js` — 50→500 VUs over 12min
- `06-spike-test.js` — 0→200 VUs in 5s
- `07-webhook-bombardment.js` — 174 req/s POST with HMAC-invalid payloads against MP webhook handler

`reports/` is gitignored.

---

### `ops/` — Bash ops scripts

- `backup-supabase.sh` — Supabase DB backup runner (cron-driven on VPS)
- `health-check.sh` — endpoint health probe

No package manifest. Bash + `psql`/`curl`. Targets the same Ubuntu 24.04 VPS managed by `deploy-crialook.sh`.

---

### `curriculo/` — standalone Python CV generator (low priority)

| Item | Version | Source |
|------|---------|--------|
| Language | Python 3.x | `gerar.py` |
| Dependencies | `reportlab` (A4 PDF generation) | `gerar.py` imports — **no `requirements.txt` present** |
| Output | `alton-vieira-cv.pdf` (committed) | `curriculo/alton-vieira-cv.pdf` |

**Unrelated to the CriaLook product** — generates Alton's personal CV PDF. No CI, no tests, no integration with the rest of the monorepo. Mentioned for completeness; safe to ignore in product planning.

---

## External Services (cross-subproject)

| Service | Used by | SDK / Version | Auth env var | Notes |
|---------|---------|---------------|--------------|-------|
| Supabase (Postgres + Storage) | `campanha-ia`, `crialook-app` (via API only) | `@supabase/supabase-js` `^2.101.1`, `@supabase/ssr` `^0.10.0` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Storage CDN whitelisted in `next.config.ts` `images.remotePatterns`. RLS enforced. Migrations in `campanha-ia/supabase/migrations/`. |
| Clerk | `campanha-ia` (`@clerk/nextjs` `^7.0.8`), `crialook-app` (`@clerk/clerk-expo` `^2.19.31`) | Same major across web/mobile | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLERK_JWT_KEY` | Mobile build embeds `pk_live_...` directly in `eas.json` env (acceptable — publishable keys are public-by-design). |
| Mercado Pago | `campanha-ia` only | `mercadopago` `^2.12.0` | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | PreApproval (subscriptions) + Bricks. HMAC verification in `src/lib/mp-signature.ts`. |
| Google Play Billing | `crialook-app` | `react-native-iap` `^14.7.20` | (in-app, no env) | Requires Play Console setup. |
| Google Play Developer API | `campanha-ia` (subscription verification webhook) | Hand-rolled JWT via `jose` + `fetch` (NOT the `googleapis` SDK) | `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (or `_PATH`) | `src/lib/payments/google-play.ts` is a **placeholder**: returns 503 until service account is wired up. Intentional — a permissive stub would approve fake purchases. |
| Anthropic Claude | `campanha-ia` (Sonnet for copywriting) | `@anthropic-ai/sdk` `^0.92.0` | `ANTHROPIC_API_KEY` | `src/lib/ai/sonnet-copywriter.ts` |
| Google Gemini | `campanha-ia` (analysis + VTO image gen) | `@google/genai` `^1.48.0` | `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` / `GOOGLE_GENAI_API_KEY` (3-name fallback chain in `src/lib/env.ts`) | `src/lib/ai/gemini-analyzer.ts`, `gemini-vto-generator.ts` |
| Fal.ai | `campanha-ia` (fallback IDM-VTON) | `@fal-ai/client` `^1.9.5` | `FAL_KEY` | Optional fallback when Gemini VTO fails |
| Sentry | `campanha-ia` (`@sentry/nextjs` `^10.47.0`), `crialook-app` (`@sentry/react-native` `7.13.0` exact) | Different majors per platform | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Web uses tunnel route `/monitoring` to bypass ad-blockers. Mobile suppresses source-map upload in EAS via `SENTRY_DISABLE_AUTO_UPLOAD=true`. |
| PostHog | `campanha-ia` only | `posthog-js` `^1.364.7` | `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Consent-gated (LGPD). |
| Inngest | `campanha-ia` only | `inngest` `^4.1.2` | (Inngest cloud + signing key) | Functions in `src/lib/inngest/functions.ts` (storage GC, judge runs). |

---

## Dev Environment Requirements

### Common (both projects)

- **Node.js 24.x** (matches CI and prod). Node 20 still works for builds (Dockerfile uses 20-alpine), but CI/prod target 24.
- **Git** + ability to read `.env` examples and create local `.env`.

### `campanha-ia` specific

- npm 7+ (lockfileVersion 3) — any modern npm works.
- No global tooling required — `next`, `vitest`, `eslint`, `tsc` all run via `npx`/`npm scripts`.
- For Promptfoo CLI: invoked via `npx promptfoo` (devDep, no global install).

### `crialook-app` specific

- **npm 10 ONLY** — never run plain `npm install` with npm 11+; the `preinstall-guard.js` will abort. Use `npm run lock:fix` to regenerate, or `npm ci --legacy-peer-deps` in CI.
- **Expo CLI** — invoked via `npx expo` (no global install needed; `start`/`android`/`ios`/`web` scripts wrap it).
- **EAS CLI** `>= 16.0.0` — for builds and submits. Install globally (`npm i -g eas-cli`) or `npx eas-cli`.
- **Java + Android SDK** — only if running `expo prebuild` + local Gradle build. EAS Build handles this in the cloud for normal flow.
- **`play-store-key.json`** at app root for `eas submit production` (gitignored — must be obtained from Play Console).
- **Sentry auth token** in EAS secrets if you want source-map upload (currently disabled in all profiles via `SENTRY_DISABLE_AUTO_UPLOAD=true`).

### Production VPS (campanha-ia)

- Ubuntu 24.04 (script tested on KingHost 2 vCPU / 4 GB RAM).
- Node 24 LTS (script auto-installs from NodeSource).
- PM2 (single fork instance — see `ecosystem.config.js`; **do NOT switch to cluster mode** without migrating in-memory rate limiter to shared storage).
- Nginx with brotli module (`libnginx-mod-http-brotli-filter`) + `proxy_cache` for static landing routes.
- Let's Encrypt SSL via certbot (script handles).
- UFW firewall (OpenSSH + Nginx Full).
- `/var/log/crialook/` for PM2 logs (rotated via `pm2-logrotate`, 50 MB / 14 retain).

### CI (`.github/workflows/`)

- `ci.yml` — three jobs: `lint-typecheck-build` (campanha-ia), `test` (campanha-ia vitest), `mobile-typecheck-test` (crialook-app typecheck + vitest). Runs on push to `main` / `audit/**` and on PR to `main`. Uses Node 24 + npm cache keyed per-subproject lockfile.
- `eval-on-pr.yml` — runs Promptfoo + the Vitest-based eval driver on PRs touching `campanha-ia/src/lib/ai/**` or `evals/**`. **Never blocks PR** (`continue-on-error: true` everywhere) — observability-only per Phase 02 D-24. Per user memory: **Promptfoo never blocks PR**, and Phase 2.5 (which would activate the gate) is deferred indefinitely.

---

## Outdated / Notable Versions

- **Lucide React `^1.8.0`** — recently jumped from 0.x to 1.x majors; verify nothing broke (the prior STACK doc didn't flag this version).
- **Zod split: web on `^4.3.6`, mobile on `^3.23.8`** — intentional. Don't try to align without first validating zod 4 on Hermes.
- **Sentry React Native `7.13.0` (exact pin)** — ahead of SDK 54's `~7.2`. Documented reason in `package.json` `_install_exclude_reason`. Don't bump or downgrade casually.
- **React `19.1.0` (mobile, exact pin)** vs **React `19.2.4` (web)** — intentional split, RN renderer needs exact 19.1.0.
- **Dockerfile uses `node:20-alpine`** while CI/VPS uses Node 24 — minor drift; image is functional but not exercising the same runtime as prod. Either bump to `node:24-alpine` or document why 20 is preferred for the container path.
- **Curriculo `gerar.py` has no `requirements.txt`** — install ReportLab manually if regenerating. Low priority (unrelated to product).

---

## Files of Interest (quick-lookup)

| Concern | File |
|---------|------|
| Web env validation | `campanha-ia/src/lib/env.ts` |
| Web Next.js config | `campanha-ia/next.config.ts` |
| Web Sentry config | `campanha-ia/sentry.{client,server,edge}.config.ts` |
| Web ESLint config | `campanha-ia/eslint.config.mjs` |
| Web Vitest config | `campanha-ia/vitest.config.ts` |
| Web Dockerfile | `campanha-ia/Dockerfile` |
| Web Promptfoo config | `campanha-ia/evals/promptfoo.config.yaml` |
| Mobile Expo config | `crialook-app/app.config.ts` |
| Mobile EAS config | `crialook-app/eas.json` |
| Mobile npm guard | `crialook-app/scripts/preinstall-guard.js` |
| Mobile Vitest config | `crialook-app/vitest.config.ts` |
| Mobile Jest config | `crialook-app/jest.config.js` |
| Mobile Babel config | `crialook-app/babel.config.js` |
| Mobile npmrc | `crialook-app/.npmrc` |
| VPS deploy | `deploy-crialook.sh` |
| PM2 config | `ecosystem.config.js` |
| Nginx config | `nginx-crialook.conf` |
| CI | `.github/workflows/ci.yml`, `.github/workflows/eval-on-pr.yml` |
| Loadtest README | `loadtests/README.md` |

---

*Stack analysis: 2026-05-03*
