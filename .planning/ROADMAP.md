# Roadmap: M1 — Hardening + Play Readiness

## Overview

M1 runs two parallel tracks in the same window. **Trilha A** is a severity-ordered bug-bash + hardening of the `campanha-ia` web app, ops scripts, and infra (Critical billing/webhook bugs first, then pipeline resilience, then security/rate-limit/ops). **Trilha B** closes every Play Store final-review blocker on `crialook-app` (Android-only) and produces — but does not execute — the Clerk Client Trust re-enable plan. Trilhas interleave freely except where called out.

## Phases

- [ ] **Phase 1: Payments Webhook Integrity** - Make every billing event correctly mutate plan/credit state without silent no-ops, clobbers, or out-of-order races.
- [ ] **Phase 2: Pipeline Resilience & Observability** - Make `/api/campaign/generate` survive partial AI failures, abort on client disconnect, and emit structured telemetry.
- [ ] **Phase 3: Test Infra & Flake Fix** - Fix broken Jest config, stabilize timing-out vitest cases, and add CI ratchets so phases 06 and 02 can land tests that actually run.
- [ ] **Phase 4: Security Hardening & Rate Limit** - Close defense-in-depth gaps (webhook replay, SSRF, MIME forgery, RPC GRANT drift, in-memory limiter, committed `.env.loadtest`).
- [ ] **Phase 5: Play Pre-release Hygiene** - Get the AAB submission-clean: Sentry live in prod, Clerk dev/prod isolated, deep links auto-verify, Android 13+ permissions confirmed.
- [ ] **Phase 6: Mobile Auth Stability & Tests** - Patch Clerk Expo auth-bypass advisory, harden cold-start failures, add release-critical tests, produce (don't execute) the Client Trust re-enable plan.
- [ ] **Phase 7: Play Compliance & UX Completeness** - Close the LGPD-adjacent UX gap (model-delete), confirm Data Safety form, re-check IARC rating, align in-app legal copy with site.
- [ ] **Phase 8: Ops & Deploy Hardening** - Make deploy script + nginx + PM2 fail-loud, rollback-able, and observability-correct so a bad deploy reverts in <5 min.

## Phase Details

### Phase 1: Payments Webhook Integrity
**Goal**: Make every billing event (Mercado Pago + Google Play RTDN + Clerk user.created + cancellation cron) correctly mutate plan/credit state without silent no-ops, clobbers, or out-of-order races, so paying users can never be downgraded by a cron tick or have their subscription orphaned by a webhook.
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. Play subscription RTDN events (`notificationType` 12 / 13 / restore) measurably change `stores.plan_id` (integration test asserts before/after)
  2. After a renewal payment webhook, `stores.mercadopago_subscription_id` is unchanged (regression test)
  3. New Clerk sign-up produces a `stores` row with non-null `plan_id` AND a matching `store_usage` row in one transaction
  4. Concurrent `incrementCampaignsUsed` calls (test fires 2 in parallel) result in count incremented exactly twice
  5. Cancel-then-immediate-resubscribe within the same cron window leaves the user on the paid plan
  6. `failCampaign` called twice for the same campaign writes `error_message` only once
**Plans**: TBD

Plans:
- [ ] 01-01: TBD (refined during planning)

### Phase 2: Pipeline Resilience & Observability
**Goal**: Make `/api/campaign/generate` (the headline product flow, 898 LOC, 0 captureError today) survive partial AI failures, abort on client disconnect, account costs honestly, and emit structured telemetry so the next regression is visible in Sentry instead of PM2 stdout.
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. Closing a browser tab mid-generation aborts the IIFE and stops further Gemini calls within ~2s (instrumented via test or manual repro)
  2. A Sonnet failure with VTO success delivers ≥1 photo + fallback caption to the user (no hard error)
  3. Trial-detection failure on a trial-eligible user delivers 1 photo (not 3)
  4. Generate-route catches all emit at least one Sentry event with `route=campaign.generate` tag
  5. Inngest outage simulation results in `judge_pending=true` rows + reconcile cron re-emits them on next tick
  6. Mercado Pago webhook integration test reproduces sig-fail + idempotent-replay + happy-path flows
**Plans**: TBD

Plans:
- [ ] 02-01: TBD (refined during planning)

### Phase 3: Test Infra & Flake Fix
**Goal**: Fix the broken Jest config that silently disables every release-test mock, stabilize the 3 timing-out vitest cases, and add the small CI ratchets (mobile lint, coverage on) that turn "all green" into a truthful signal — so phases 06 and 02 can land tests that actually run.
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. `npm run test:rn` in `crialook-app` exits 0 with mocks confirmed loaded (verify by adding a deliberate `expect` against a mocked Clerk return)
  2. 3 previously-flaky tests pass on 5 consecutive CI runs
  3. `crialook-app` CI job runs eslint and fails on errors
  4. CI fails if `lib/**` coverage drops below 30% (web) or 35% (mobile)
  5. README test count matches reality OR no number is claimed
**Plans**: TBD

Plans:
- [ ] 03-01: TBD (refined during planning)

### Phase 4: Security Hardening & Rate Limit
**Goal**: Close the defense-in-depth gaps that compound with billing/AI risks — webhook replay, SSRF on `/api/campaign/format`, MIME-type forgery, RPC GRANT drift, in-memory limiter under Cloudflare, and the committed `.env.loadtest` — so a single leak doesn't cascade into account compromise or unbounded AI spend.
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. Replay of a captured MP webhook within the 5min skew is rejected as duplicate
  2. Authenticated POST to `/api/campaign/format` with `imageUrl=http://169.254.169.254/...` returns 400
  3. Upload of `evil.exe` renamed to `image/png` is rejected at the route boundary, not at Sharp
  4. All 14 SECURITY DEFINER RPCs have explicit `GRANT EXECUTE TO service_role` (audit query asserts)
  5. Rate-limit state survives `pm2 restart` (test: hammer endpoint, restart, hammer again, second wave is throttled)
  6. `loadtests/.env.loadtest` is gitignored and any real Clerk session it referenced is revoked
  7. Every `/api/admin/*` 403 emits a Sentry event with `route=admin.deny` tag
**Plans**: TBD

Plans:
- [ ] 04-01: TBD (refined during planning)

### Phase 5: Play Pre-release Hygiene
**Goal**: Get the AAB submission-clean — Sentry actually reports crashes in production, Clerk dev/prod are isolated, deep links auto-verify, and the Android 13+ runtime permissions / billing manifest entries are confirmed in the built bundle. **This is the gate to Internal Testing → Closed → Production track promotion.**
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. A deliberate `throw new Error("F-03 verify")` in production AAB lands in Sentry within 60s
  2. Different EAS profiles emit auth events to different Clerk instances (verify in Clerk Dashboard logs)
  3. `https://crialook.com.br/campaign/<uuid>` opens the installed app without the "Open with…" picker (autoVerify success)
  4. `bundletool dump manifest` shows both `POST_NOTIFICATIONS` and `com.android.vending.BILLING`
  5. First AAB lands on Internal Testing track via `eas submit` with no manifest validation errors
**Plans**: TBD

Plans:
- [ ] 05-01: TBD (refined during planning)

### Phase 6: Mobile Auth Stability & Tests
**Goal**: Patch the known Clerk Expo SDK auth-bypass advisory, harden the cold-start failure modes (font hang, error-message leak, deep-link IDOR), add the missing release-critical tests for billing + auth + error boundaries, and produce — but do NOT execute — the Clerk Client Trust re-enable plan for after Play approval.
**Depends on**: Phase 3, Phase 5 (for F-10)
**Success Criteria** (what must be TRUE):
  1. `@clerk/clerk-expo` resolves to ≥ 2.19.36; preview EAS build signs in with Google SSO and produces a valid JWT
  2. Throttling network to "EDGE" + cold-launching the app produces either a successful boot OR a visible recovery affordance (no perma-blank screen)
  3. Tab crash in production AAB shows a generic "Algo deu errado" UI with no `error.message` text leaked
  4. `lib/__tests__/billing.test.ts` and `lib/__tests__/auth.test.ts` run green via Jest with mocks loaded (relies on Phase 03)
  5. A Clerk Client Trust re-enable runbook exists at a documented path; it lists the exact toggle, baseline metrics, monitoring alerts, rollback steps, and memory updates
**Plans**: TBD

Plans:
- [ ] 06-01: TBD (refined during planning)

### Phase 7: Play Compliance & UX Completeness
**Goal**: Close the LGPD-adjacent UX gap (no model-delete affordance), confirm Play Console "Data safety" form alignment, re-check IARC content rating against actual AI image output, and align in-app legal copy with the public site before submission.
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. User can delete a model from inside the app via a discoverable UI affordance (manual repro on device)
  2. `npm run check:legal-drift` exits 0 against current site content; CI runs it
  3. Play Console "Data safety" form section-by-section matches the in-app `lib/legal/content.ts` and the §1 categories list
  4. IARC questionnaire answers are recorded in the planning doc with rationale; rating decision (Todos vs 12) is explicit
**Plans**: 7

Plans:

**Wave 1** *(parallel — independent)*
- [ ] 07-01: Trash icon + danger ConfirmSheet in ModelBottomSheet wired to existing handleDelete (F-11)
- [ ] 07-03: Manual one-time legal-content drift reconciliation; bump LAST_UPDATED (D-08)
- [ ] 07-04: Author crialook-app/docs/PLAY_DATA_SAFETY.md owner-action mapping doc (D-09..D-12)
- [ ] 07-05: Author crialook-app/docs/PLAY_IARC.md (Classificação 12 + AI-apparel advisory) (D-13..D-16)
- [ ] 07-06: Polish PLAY_STORE_LISTING.md — title ≤30, sync rating, screenshot inventory + checklist (D-17, D-18)

**Wave 2** *(blocked on Wave 1: 07-01 + 07-03)*
- [ ] 07-02: Vitest jsdom contract test for ModelBottomSheet trash affordance (depends on 07-01)
- [ ] 07-07: scripts/check-legal-drift.js + CI wire (depends on 07-03 baseline)

Cross-cutting constraints:
- Owner-action plans (07-04, 07-05): the executor writes the markdown; the owner copies into Play Console manually. F-03 (Sentry DSN) status affects PLAY_DATA_SAFETY Category 3 — owner re-validates after Phase 5.
- 07-07 fail-soft on site 5xx outage; hard-fail on 4xx or content drift. CI job runs on push + pull_request.

### Phase 8: Ops & Deploy Hardening
**Goal**: Make the deploy script + nginx + PM2 surface fail-loud, rollback-able, and observability-correct so a bad deploy can be reverted in <5 min and a degraded-but-up app actually pages someone.
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. `bash deploy-crialook.sh --rollback` restores the previous build artifact within 60s on a simulated build failure
  2. A health endpoint returning `{status: "degraded"}` triggers an alert, not a silent restart
  3. `nginx -t` passes on a fresh distro both with and without Brotli module installed
  4. First request to `/api/campaign/generate` after upload starts streaming within ~200ms (no full-body buffering on nginx)
  5. CSP violations land in Sentry; flip-to-enforced criteria documented (e.g., "0 violations for 14 days")
  6. PM2 logs in `/var/log/crialook/` rotate at 50MB and retain 14 days
**Plans**: TBD

Plans:
- [ ] 08-01: TBD (refined during planning)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Payments Webhook Integrity | 0/TBD | Not started | - |
| 2. Pipeline Resilience & Observability | 0/TBD | Not started | - |
| 3. Test Infra & Flake Fix | 0/TBD | Not started | - |
| 4. Security Hardening & Rate Limit | 0/TBD | Not started | - |
| 5. Play Pre-release Hygiene | 0/TBD | Not started | - |
| 6. Mobile Auth Stability & Tests | 0/TBD | Not started | - |
| 7. Play Compliance & UX Completeness | 0/TBD | Not started | - |
| 8. Ops & Deploy Hardening | 0/TBD | Not started | - |

## Decisões do owner (2026-05-03)

- **Parking lot:** todos os itens abaixo BLESSED — autorizados a entrar em fases futuras conforme prioridade, mas FORA do M1 atual. Não bloquear M1 por nenhum deles.
- **Modo de execução:** `/gsd-autonomous --interactive` — discuss inline com perguntas, plan/execute em background.
- **Ordem:** sequencial estrita 01 → 08 (respeita dependências cruzadas).
- **`needs-research` flags:** resolver durante o `discuss` da fase correspondente; não bloqueiam o disparo do autonomous.

## Out-of-milestone (parking lot)

Items surfaced by sweeps but explicitly NOT in M1 scope:

- **Phase 2.5 (Labeling) — judge calibration** — deferred indefinidamente per project memory. Promptfoo stays observability-only; never blocks PR. Do not propose implementation without explicit authorization.
- **Re-enable Clerk Client Trust execution** — only the *plan* is in M1 (Phase 06). Actual toggle happens after Play Store approval; outside this milestone.
- **F-05 — iOS section cleanup in `app.config.ts`** — explicit defer per CRIALOOK-PLAY-READINESS.md Appendix C (non-blocking, well-scoped separate refactor).
- **F-12 — Storybook × Vite peer-dep** — `needs-research`. TASKS.md flags this; vite is now `^6.4.2` which may already satisfy `@storybook/react-vite ^8.6.18` (peer 4–6). Confirm with `npm run storybook:dev` before deciding to drop / bump / leave. Dev-only, doesn't ship.
- **Migrate signing keys to EAS-managed credentials** — Phase 06 documents the path; actual `eas credentials -p android → Migrate to EAS` execution + local-copy delete may slip past M1 if Play submission is on the critical path.
- **Mercado Pago webhook IP allowlist at nginx** — defense-in-depth; MP IP ranges churn so requires maintenance commitment. Defer until ops capacity exists.
- **Editor password → per-user passwords** — acceptable at current scale per CONCERNS §2; re-evaluate when editor user count grows.
- **`process.env.X` → `env.X` migration** — partial today. Cross-cutting cleanup; high churn / low risk. Defer.
- **Logger consolidation** — replace `console.*` in route handlers with `logger.*` everywhere (not just generate route in Phase 02). Cross-cutting; defer.
- **`CrialookError` base class** — design improvement for unified error responses with `code`/`userMessage`/`httpStatus`. Cross-cutting; defer.
- **Finish or drop `FEATURE_REGENERATE_CAMPAIGN`** — half-implemented feature gated off; either ship it or remove the dead branches. Out of M1 scope.
- **Drop `runMockPipeline` from prod bundle** via build-time flag — minor; defer.
- **Audit each SECURITY DEFINER RPC for input validation inside the function body** — Phase 04 hardens GRANTs; deeper code-review pass on every RPC body is a follow-up.
- **TypeScript `as any` sweep (~79 occurrences)** — L-2; cosmetic, defer.
- **Sharp dynamic import in hot path → static top-level import** — L-3; cosmetic, defer.
- **Manifest URL + apple-icon dead weight on Android-only target** — L-9; web app still uses them, dropping is web-side change. Defer.
- **Dependency-vuln housekeeping (postcss/uuid via mercadopago + next bumps)** — CONCERNS §8; bump `next` to latest 16.2.x and add `overrides` for `uuid`. Defer to next ops window.
- **Expo SDK 55+ upgrade** — moves the `crialook-app` 25 vulns down. Major lift; out of M1 scope.
- **e2e test stack** (Playwright web / Detox / Maestro mobile) — explicit defer; no e2e in M1.
- **Storage GC schedule verification** — CONCERNS §11 carry-over; verify `lib/storage/garbage-collector.ts` is actually scheduled. Quick check, but no clear owner; defer or fold into 08 if cheap.
- **`needs-research` — exact placement of fail-closed plan-name guard (Phase 01)** — CONCERNS §3 suggests adding redundant guard in `getStorePlanName()` or `canGenerateCampaign()`. Need to confirm the right insertion site without introducing cron-cycle UI churn. Plan-phase to decide.
- **`needs-research` — F-08 BILLING permission verification** — must wait for first AAB output from Phase 05 before we know whether autolinking already injected `com.android.vending.BILLING`.
