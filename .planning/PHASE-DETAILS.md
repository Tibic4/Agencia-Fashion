# Phase Details — M1: Hardening + Play Readiness

Captures the per-phase Trilha / Severity / Release-critical / Scope / Findings / Risk metadata that lives outside the gsd-tools parser-clean ROADMAP.md template. Source-of-truth for planning context; ROADMAP.md is source-of-truth for phase progress.

## Phase 1 — Payments Webhook Integrity
- **Trilha:** A
- **Severity gate:** Critical
- **Release-critical:** no
- **Scope (in):**
  - Fix the `stores.plan` vs `stores.plan_id` schema split in Play billing paths
  - Stop `updateStorePlan` from clobbering `mercadopago_subscription_id` on payment renewals
  - Initialize new stores via `createStore` (or extracted helper) in the Clerk webhook so `plan_id` and `store_usage` are populated at signup
  - Replace "null sub_id on cancel" with a `subscription_status` column (or equivalent) so the downgrade cron has positive intent
  - Add optimistic-locking guard to `cron/downgrade-expired` so a renewal mid-cron can't be overwritten
  - Convert remaining read-then-write fallbacks (`incrementCampaignsUsed`, `consumeCredit`, `addCreditsToStore`) to single-statement `UPDATE … RETURNING` arithmetic
  - Make `failCampaign` a single-shot status transition (`WHERE status = 'processing'`)
  - Reconcile period semantics between `addCreditsToStore` and `updateStorePlan` (calendar month vs rolling 30 days)
  - Validate event ownership (`external_reference` cross-check) on subscription cancel; log non-active MP statuses at warn
  - Add fail-closed guard in `getStorePlanName`/`canGenerateCampaign` so cancelled+expired never serves premium even if cron is broken
- **Scope (out):**
  - Pipeline-level changes (handled in 02)
  - Webhook signature/replay hardening (handled in 04)
  - Generic RPC GRANT cleanup (handled in 04)
  - Cron secret query-param fix (handled in 04 / 08 cross-cut, lives in 08)
- **Findings addressed:** MONOREPO-BUG-BASH.md C-1, C-2, C-3, C-4, H-7, H-10, H-11, M-11, M-12, M-18, L-11; CONCERNS.md §2 "/api/billing/restore writes non-existent column", §3 "Subscription cancellation flow is intentionally lossy on cancel"
- **Risk if skipped:** Active paying customers get silently downgraded to free; refunds/cancels/restores leave plan state inconsistent; new signups land in a broken plan-less state. Direct revenue + support cost.

## Phase 2 — Pipeline Resilience & Observability
- **Trilha:** A
- **Severity gate:** Critical / High
- **Release-critical:** no
- **Scope (in):**
  - Replace `Promise.all([copy, image])` with `Promise.allSettled` and explicit success/fallback contracts; harden `dicas_postagem` shape on Sonnet failure
  - Honor `request.signal` end-to-end inside the SSE IIFE (skip remaining steps, abort upload retries, abort teaser branch); document Gemini SDK has no native cancel
  - Default trial-eligibility to `isTrialOnly = true` on detection-query failure (fail-secure)
  - Mark `api_cost_logs` with `upload_failed` flag when refund branch fires; reconcile per-campaign cost metric
  - Skip teaser when `modelImageBase64` is the 1×1 fallback
  - Add `judge_pending` flag on campaign rows + reconcile cron that re-emits Inngest events for orphaned rows (preserves data quality without re-opening Phase 2.5 scope)
  - Force `storeId` filter on `incrementRegenCount` SELECT path (close IDOR even though feature flag is off)
  - Demo mode must NOT increment `campaigns_generated`
  - Centralize `dryRun` gating via a `sideEffect(input, fn)` helper across pipeline + gemini-vto-generator
  - Convert refund race in `app/api/campaign/generate/route.ts:805-812` to use `add_credits_atomic`
  - Replace 42 raw `console.*` in the generate route with `logger.*` + `captureError` at every catch (QUALITY priority #2)
  - Add HTTP-level tests for `webhooks/mercadopago`, `billing/verify`, `billing/rtdn` route handlers (drive with `Request`, stub admin client + verifier, assert side effects) (QUALITY priority #3)
- **Scope (out):**
  - Anything that re-opens Phase 2.5 (Labeling) — judge stays uncalibrated; we only persist the signal
  - Promptfoo blocking (stays observability-only per project memory)
  - Re-architecting SSE protocol
- **Findings addressed:** MONOREPO-BUG-BASH.md H-1, H-2, H-3, H-4, H-9, H-10 (cross-cut with 01), H-12, H-13, M-11, M-15; CONCERNS.md §11 "Race conditions in fallback read-modify-write paths" (refund branch); QUALITY.md §"Coverage Gaps" #1, #2, #3
- **Risk if skipped:** Real money burned on aborted generations, free 3-photo trials handed out on Supabase blips, failures invisible to ops, judge data lost forever.

## Phase 3 — Test Infra & Flake Fix
- **Trilha:** B (mostly) + A (timeouts)
- **Severity gate:** Critical (F-01)
- **Release-critical:** no (unblocker)
- **Scope (in):**
  - Fix `jest.config.js`: `setupFilesAfterEach` → `setupFilesAfterEnv`. Re-run `npm run test:rn`. Fix any tests that now break (they were broken all along)
  - Bump `testTimeout` to 15000ms (or hoist dynamic `import("./functions")` to `beforeAll`) for `inngest/judge.test.ts` happy + sentinel cases
  - Same fix shape for `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` (warm jsdom or hoist import)
  - Add `eslint` config + `lint` job for `crialook-app` (parity with web; 5-line `ci.yml` patch)
  - Wire `--coverage` into both vitest CI invocations so the existing 30/35 thresholds become a ratchet
  - Update `README.md:169` test count (33 → 148) or strip the number
  - Remove dead `lint-staged` config from `campanha-ia/package.json` OR wire it into the husky hook
- **Scope (out):**
  - Adding the actual missing tests (auth, billing, error boundaries) — those are in 06
  - HTTP-level webhook tests — those are in 02
  - e2e (Playwright/Detox/Maestro) — explicit out for M1
- **Findings addressed:** CRIALOOK-PLAY-READINESS.md F-01 (Critical); QUALITY.md §"Flaky tests", §"Where to focus next" #1, #4, #5, #6, §"Coverage Gaps" #12, #13, #14
- **Risk if skipped:** Phase 06's billing/auth tests will be added against a silently-broken Jest setup; CI keeps lying; mobile code style drifts. F-01 is officially Critical per the readiness audit.

## Phase 4 — Security Hardening & Rate Limit
- **Trilha:** A
- **Severity gate:** High
- **Release-critical:** no
- **Scope (in):**
  - MP webhook: reject empty `x-request-id`, add `mp_webhook_seen` table keyed by `x-request-id` for replay defense beyond HMAC + 5min skew
  - Pin `/api/campaign/format` `imageUrl` host to Supabase Storage origin allowlist; mirror the pattern as defense-in-depth on `/api/campaign/generate`'s `modelImageUrl` fetch
  - Run Sharp `.metadata()` on uploaded buffers to verify magic bytes match claimed MIME (generate, logo, model/create routes)
  - Audit `loadtests/.env.loadtest` (3277 bytes, tracked) — if it contains a real Clerk session cookie, revoke session in Clerk Dashboard and remove from git history
  - Replace top-level service-role `createClient` in `app/api/fashion-facts/route.ts` with `createAdminClient()` inside handler; same audit pass on `middleware.ts:hasStore` (move to Clerk JWT + anon, or to `publicMetadata` flag)
  - Add `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role` to `acquire_checkout_lock`, `release_checkout_lock`, `can_generate_campaign`, `increment_campaign_usage` (match hardening pattern of other RPCs)
  - Drop legacy single-arg `increment_regen_count(uuid)` overload (no IDOR check)
  - Migrate rate-limit storage to Postgres-backed token bucket (or document Redis migration); add `cf-connecting-ip` preference behind Cloudflare; lower nginx burst on `/api/campaign/generate` to 1-2
  - Persist anon-abuse counter in Postgres (PM2 restart no longer resets attacker quota); gate `/api/campaign/generate` behind `auth().userId` (since `IS_DEMO_MODE` never fires in prod)
  - Add throttle to `/api/credits/claim-mini-trial` and require email verification before granting trial
  - Drop `?secret=` query-string path on `/api/cron/exchange-rate`; require `Authorization: Bearer` only
  - Add log-on-deny + Sentry warn on every 403 from `/api/admin/*` (no audit trail today)
  - Pick ONE source of truth for admin role (`publicMetadata.role`), keep `ADMIN_USER_IDS` as break-glass
  - Add Clerk webhook timestamp-skew check (Svix) + tests for clerk webhook + admin route 403
- **Scope (out):**
  - Mercado Pago IP allowlist at nginx (defer — IP ranges churn; covered as parking-lot or 08)
  - Full prompt-injection eval suite (Promptfoo never blocks per memory; tests can be added but not gating)
  - Editor password → per-user passwords (acceptable at current scale)
- **Findings addressed:** MONOREPO-BUG-BASH.md H-5, H-8, H-14, M-8, M-16; CONCERNS.md §1 "Service-role key handling" + "Sensitive Android signing material" (signing-keys part deferred to 06), §2 "Admin guard relies on `ADMIN_USER_IDS`" + "Editor password" (editor part deferred), §3 "Mercado Pago webhook does not verify request originated from MP IPs" (deferred), "Clerk webhook svix-timestamp" + "Idempotency on credit grant" (validation only), §4 "RPC GRANT" + "drop legacy overload", §5 "/api/campaign/format SSRF" + "Image MIME validation", §6 "/api/campaign/generate anonymous abuse" + "claim-mini-trial throttle", §10 "cron/exchange-rate query secret", §12 test coverage gaps for clerk webhook + admin auth
- **Risk if skipped:** Webhook replay can re-cancel reactivated subs; SSRF lets any authed user probe localhost / cloud metadata; MIME forgery poisons storage buckets; PM2 restart is an attacker reset button; admin probes leave no trace.

## Phase 5 — Play Pre-release Hygiene
- **Trilha:** B
- **Severity gate:** High
- **Release-critical:** yes
- **Scope (in):**
  - Add `EXPO_PUBLIC_SENTRY_DSN` to `eas.json` production (and ideally preview) profile env. Set `SENTRY_DISABLE_AUTO_UPLOAD: "false"` once `SENTRY_AUTH_TOKEN` is configured in EAS server env. Verify a deliberate `throw` in DEV captures in Sentry (F-03)
  - Provision separate Clerk publishable keys per profile (`development`, `preview`, `production`); update `eas.json`; document rotation policy (F-04)
  - Run first `eas build --profile production --platform android`; pull SHA-256 from `eas credentials -p android` (App Signing key, not upload key); populate `store-assets/assetlinks.json`; deploy to `https://crialook.com.br/.well-known/assetlinks.json`; validate via the Google digital-asset-links API URL in `store-assets/README_ASSETLINKS.md` (F-02)
  - Dump produced AAB manifest with `bundletool dump manifest --bundle=app.aab > manifest.xml`; grep for `POST_NOTIFICATIONS` and `com.android.vending.BILLING`; if missing, add to `app.config.ts.android.permissions` and rebuild (F-07, F-08)
- **Scope (out):**
  - F-10 TabErrorBoundary `__DEV__` wrap (lives in 06; depends on F-03 being live first)
  - Storybook×Vite peer-dep resolution (parking lot; dev-only, doesn't ship in AAB)
  - iOS section cleanup in `app.config.ts` (parking lot — explicit defer per CRIALOOK-PLAY-READINESS.md Appendix C)
  - Migrating keystore to EAS-managed credentials (parking lot or follow-up — non-blocking for submission)
- **Findings addressed:** CRIALOOK-PLAY-READINESS.md F-02 (High), F-03 (High), F-04 (High), F-07 (Medium), F-08 (Medium); enables F-10 fix in 06
- **Risk if skipped:** Production ships with zero crash reporting (F-03), dev events pollute prod Clerk (F-04), deep links fall back to disambiguation chooser (F-02), Play Console rejects subscription AAB upload (F-08), or push notifications silently drop on Android 13+ (F-07).

## Phase 6 — Mobile Auth Stability & Tests
- **Trilha:** B
- **Severity gate:** High
- **Release-critical:** yes
- **Scope (in):**
  - Bump `@clerk/clerk-expo` from `^2.19.31` to `~2.19.36+` (GHSA-w24r-5266-9c3c). MUST regen lockfile via `npm run lock:fix` (per `project_eas_npm_lock` memory — never `npm install`). Verify EAS preview build still authenticates
  - Add font-load timeout via `Promise.race([useFonts, timeout(8000)])` OR explicit "Recarregar" UI in `AppFadeIn` when `ready={false}` for >10s (F-09)
  - Wrap `TabErrorBoundary.tsx:67-75` `error.message` in `{__DEV__ && (…)}` (F-10) — **gated on Phase 05's F-03 being live**
  - Audit all `useLocalSearchParams()` usages in `crialook-app/app/(tabs)/gerar/resultado.tsx` and `historico.tsx`; confirm no client-side rendering from URL params without an API re-fetch (CONCERNS §7 deep-link IDOR)
  - Add `lib/__tests__/billing.test.ts` — verify `obfuscatedAccountIdAndroid` is computed correctly from `getCurrentUserId()` and is included in `requestPurchase`
  - Add `lib/__tests__/auth.test.ts` — verify JWT cache TTL (30s), 401-retry path, `clearAuthTokenCache()` on signOut
  - Add tests for `ErrorBoundary.tsx` and `TabErrorBoundary.tsx` (renders fallback, captures to Sentry when configured)
  - Add deep-link UUID validation test for `_layout.tsx:75-79`
  - **Write** `crialook-app/.planning/CLERK_CLIENT_TRUST_REENABLE.md` (or equivalent doc) with the full pre-flight + enable + monitoring + rollback + memory-update plan from CRIALOOK-PLAY-READINESS.md §11. **Do not execute** — execution is post-Play-approval, out of M1
  - Document the 7 server-side compensating controls (CRIALOOK-PLAY-READINESS.md §4) and confirm with backend they are live; add to ongoing checklist
  - Document keystore migration to EAS-managed credentials path (`eas credentials -p android` → "Migrate to EAS"); execute migration + delete local copies if time permits
- **Scope (out):**
  - Actually re-enabling Clerk Client Trust (post-Play-approval, out of M1)
  - Adding Maestro/Detox e2e (parking lot)
  - F-11 delete-UX (in 07 — UX completeness)
  - iOS section cleanup (parking lot)
- **Findings addressed:** CRIALOOK-PLAY-READINESS.md F-09 (Medium), F-10 (Medium), §4 server-side controls, §9 test coverage gaps (auth, billing, deep-links, error boundaries), §11 re-enable plan; CONCERNS.md §1 "Sensitive Android signing material" (signing-key migration), §2 "Clerk Expo SDK has known auth-bypass advisory" (High), §2 "Clerk Client Trust disabled for Play Store review" (plan only), §7 "Deep links accept arbitrary URLs"
- **Risk if skipped:** Known Clerk auth-bypass advisory ships in production AAB (CWE-863). Cold-start hang on font CDN flake bricks first-launch users. Tab crashes leak internal error text + API paths to end users. Billing replay-protection and JWT cache regressions ship without test coverage. Client Trust gets re-enabled in a panic post-approval with no runbook.

## Phase 7 — Play Compliance & UX Completeness
- **Trilha:** B
- **Severity gate:** Medium
- **Release-critical:** yes
- **Scope (in):**
  - Add a delete affordance to model management — small trash icon in `ModelBottomSheet` peek view, OR "..." context menu on `ModelGridCard` (Material 3 pattern); wire to existing `handleDelete` (F-11). Required for LGPD/GDPR clean flow given face-derived model data
  - Manually diff `lib/legal/content.ts` against `https://crialook.com.br/{privacidade,termos,dpo}`; reconcile drift; add `scripts/check-legal-drift.js` that fetches public URLs and diffs against bundled content (fail CI on diff) (F-06)
  - Cross-check Play Console "Data safety" form against the categories enumerated in CRIALOOK-PLAY-READINESS.md §1 ("Photos and videos", "Personal info → email", "App activity → in-app actions", "Financial info → purchase history" via Play Billing)
  - Re-evaluate IARC content-rating answers given AI-generated fashion imagery surface (commit `258380b` already hardened the prompt against body-transformation; confirm "sexual content" answer is honest given swimwear/lingerie possibility); change to "Classificação 12" or add advisory if needed
  - Final pass on `store-assets/PLAY_STORE_LISTING.md` + screenshots
- **Scope (out):**
  - Backend prompt-injection eval suite (parking lot — not Play-blocking)
  - F-12 Storybook fix (parking lot)
- **Findings addressed:** CRIALOOK-PLAY-READINESS.md F-06 (Medium), F-11 (Medium), §1 "Privacy policy URL" + "Data safety form alignment" + "Content rating"
- **Risk if skipped:** LGPD violation pathway (no way to delete face-derived data on demand). Privacy policy drift between in-app and site → Play Developer Program Policy violation. Misrepresented content rating → hard policy strike if a reviewer flags AI-generated swimwear/lingerie.

## Phase 8 — Ops & Deploy Hardening
- **Trilha:** A
- **Severity gate:** Medium
- **Release-critical:** no
- **Scope (in):**
  - Add rollback path to `deploy-crialook.sh`: `PREV=$(git rev-parse HEAD)` before pull; on build failure `git reset --hard "$PREV" && npm ci && npm run build`; document `bash deploy-crialook.sh --rollback` flow (M-2)
  - Health check: inspect response body for `status: "unhealthy"` or rely on 503 only (degraded vs healthy distinction); add Discord/Slack notification on cron-detected restart (M-1)
  - Stop regenerating `/root/health-check.sh` on every deploy run; have cron call `ops/health-check.sh` directly (M-3)
  - Validate `pm2 startup systemd` output before piping to bash (capture, grep `^sudo`, validate) (M-4)
  - Generate Brotli nginx block conditionally OR require Brotli install before continuing (currently silently breaks nginx -t if module missing) (M-5)
  - Move `limit_req_zone` and `proxy_cache_path` from server scope to `/etc/nginx/conf.d/crialook-zones.conf` (http context) (M-17)
  - Add `proxy_request_buffering off;` to `/api/campaign/generate` location for SSE multipart upload latency (M-13)
  - Add CSP `report-uri` (Sentry CSP integration or `/api/csp-report`); plan to flip from Report-Only to enforced after 2 clean weeks (M-6)
  - Move `start = Date.now()` for DB latency metric in `/api/health` to immediately before the Supabase call (M-7)
  - Wire `pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 50M && pm2 set pm2-logrotate:retain 14` into `deploy-crialook.sh` (CONCERNS §10 ops)
  - Document migration path for `DEPLOY_USER` from root → dedicated user; add CI/lint warn if production env runs as root (CONCERNS §10 ops)
  - Pin health-check cron `curl` to `-m 5` timeout; document `/api/health` shallow path must remain DB-free (CONCERNS §10 ops)
  - Add a single boot log line summarizing env load status (M-9)
  - Switch `getCurrentUsage` from `.single()` to `.maybeSingle()` with explicit multi-row handling; verify `(store_id, period_start)` UNIQUE constraint applied (M-10)
  - Verify `loadtests/README.md` capacity numbers carry a "last measured: <date>" note OR move into per-run reports (L-5)
  - Verify CI Sentry source-map upload only fires on main-branch deploys, not PR builds (M-14)
  - Add explicit `signingKey` to `inngest/client.ts` (L-8)
  - Verify Sentry `Pipeline:Scorer` ignore filter (`sentry.server.config.ts`) is intentional and not silencing real judge failures
- **Scope (out):**
  - Multi-instance rate-limit migration (planned in 04)
  - GPG-signed commit verification (parking lot)
  - Mercado Pago IP allowlist (parking lot)
- **Findings addressed:** MONOREPO-BUG-BASH.md M-1, M-2, M-3, M-4, M-5, M-6, M-7, M-9, M-10, M-13, M-14, M-17, L-5, L-8; CONCERNS.md §10 "deploy as root", "pm2-logrotate", "health-check cron", "cron/exchange-rate" (Authorization-only path lives in 04); inferred missing indexes from cross-cutting findings
- **Risk if skipped:** Bad deploys leave the app on stale `.next/` with no automated rollback. Degraded states stay invisible. Nginx rejects deploy on a fresh distro silently. SSE upload latency degrades user-perceived generation start time. CSP can never safely move from Report-Only to enforced.
