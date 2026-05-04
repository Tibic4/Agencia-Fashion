# M1 + M2 — Milestone Summary (for posterity)

**Window:** 2026-05-03 → 2026-05-04
**Status:** Both milestones executed and closed.
**Audience:** New devs / auditors who need to understand what landed and what's still owner-action.

---

## Executive summary

Two consecutive milestones consolidated the `crialook` monorepo (Next.js web app `campanha-ia` + Expo Android-only RN app `crialook-app`) from "post-feature scramble" to "Play Store final-review ready + post-Play security gates closed". Across **191 commits** touching **371 distinct files**, the work fixed payment-webhook integrity bugs, hardened the AI generation pipeline, closed defense-in-depth gaps, restored the test/lint/typecheck/build invariants under a real `pre-commit` hook, and produced an owner-action backlog of items that require human credentials (Clerk Dashboard, Play Console, SSH, EAS).

**Current repo state:** 597 tests pass (web 428 / mobile 169), `tsc --noEmit` clean both sides, `npm run lint` 0 errors both sides (warnings remain, acceptable), `npm audit --audit-level=high` returns 0 high+ both sides, `npm run build` (web) succeeds, `expo-doctor` 18/18, vitest coverage thresholds ratcheted to measured floor (no aspirational lies). Husky `pre-commit` is ACTIVE and gates every commit on `tsc + lint-staged`. Expo SDK is at 55 (upgraded from 54 in M2 P5 with no rollback needed).

**What the owner needs to do next:** (a) push 191 commits to `origin/main` (use `npm run deploy:check` for pre-flight), (b) revoke 2 leaked Clerk loadtest sessions via Dashboard (helper: `npm run clerk:revoke-loadtest`), (c) walk the 11-step Play release checklist when ready to ship the AAB (helper: `npm run play:prep`), (d) run the Clerk Client Trust re-enable runbook *post-Play approval* (now unblocked because backend controls 2+3 are LIVE). All 11 SQL migrations were applied via MCP during M1+M2 — zero migration work pending. Full enumerated backlog in `.planning/STATE.md`.

---

## M1 highlights — "Hardening + Play Readiness"

8 phases, two parallel trilhas (A: web/ops bug-bash, B: crialook Play readiness). Sequential 01→08 in roadmap order with cross-phase dependencies respected.

### Phase 1 — Payments Webhook Integrity
- Subscription_status ENUM + backfill migration; `webhook_events` dedup table with helper module + tests
- MP webhook rejects empty `x-request-id`; preserves `mercadopago_subscription_id` on renewal (regression fixed)
- Idempotent `incrementCampaignsUsed` via DB UPSERT; cancel-then-resubscribe race fixed; `failCampaign` writes error_message once

### Phase 2 — Pipeline Resilience & Observability + Quality Loop
- `judgeCampaignJob` Inngest handler + judge.ts with `score_campaign_quality` Zod tool boundary
- `dryRun` param across pipeline + cost-log consolidation (`logModelCost` replaces 3 helpers)
- Reason picker (Gorhom Bottom Sheet) wired on historico regenerate; admin/quality dashboard + correlation matrix view
- Promptfoo evals scaffolded as observability-only (per project memory: never blocks PR)
- Quality alerts daily cron + Sentry synthetic-issue helper

### Phase 3 — Test Infra & Flake Fix
- Jest config repaired (RN mocks now load); 3 flaky vitest cases stabilized
- `crialook-app` CI runs eslint and fails on errors
- Coverage ratchet activated in CI via `--coverage`; thresholds set to measured-floor ratchet

### Phase 4 — Security Hardening & Rate Limit
- `webhook_events` dedup gates MP replay attacks within 5min skew
- SSRF allowlist on `/api/campaign/format` (rejects 169.254 / 127.x / private ranges)
- MIME forgery gate (uploads validated against magic-bytes, not declared content-type)
- 14 SECURITY DEFINER RPCs audited; all have explicit `GRANT EXECUTE TO service_role`
- Postgres-backed rate limiter (`rate_limit_buckets` + `consume_rate_limit_token` RPC) survives `pm2 restart`
- `loadtests/.env.loadtest` confirmed gitignored (never committed)

### Phase 5 — Play Pre-release Hygiene
- Sentry DSN live in production AAB pathway; deliberate throw test landed
- Different EAS profiles emit auth events to different Clerk instances (dev/preview/prod isolated)
- Deep links auto-verify (`https://crialook.com.br/campaign/<uuid>` opens app, no picker)
- `bundletool dump manifest` shows `POST_NOTIFICATIONS` + `com.android.vending.BILLING`

### Phase 6 — Mobile Auth Stability & Tests
- `@clerk/clerk-expo` ≥ 2.19.36 (auth-bypass advisory patched)
- ErrorBoundary + TabErrorBoundary; cold-start font/network failure recovery
- `lib/__tests__/billing.test.ts` + `lib/__tests__/auth.test.ts` green via Jest with mocks loaded
- `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` runbook produced (NOT executed — post-Play)

### Phase 7 — Play Compliance & UX Completeness
- Trash icon + danger ConfirmSheet in `ModelBottomSheet` wired to existing handleDelete
- `crialook-app/docs/PLAY_DATA_SAFETY.md` owner-action mapping
- `crialook-app/docs/PLAY_IARC.md` (Classificação 12 + AI-apparel advisory)
- `PLAY_STORE_LISTING.md` polish checklist
- Initial legal-content reconciliation surfaced REAL drift (deferred resolution to M2 P2)
- `scripts/check-legal-drift.js` + CI workflow

### Phase 8 — Ops & Deploy Hardening
- `bash deploy-crialook.sh --rollback` restores previous artifact in <60s
- nginx Brotli graceful fallback; SSE `proxy_request_buffering off`; CSP report-uri to `/api/csp-report`
- `degraded` health contract documented; Discord webhook helper
- PM2 logs rotate at 50MB / 14 days; `scripts/check-deploy-user.sh` enforces non-root
- DB latency timer moved adjacent to Supabase call

### M1 audit outcome (end of M1)
- 35/45 success criteria PASS, 2 real residual gaps (controls 2+3 missing on `/billing/verify`)
- Bonus findings → M2 P1 scope
- Cumulative owner-action backlog captured in STATE.md

---

## M2 highlights — "Consertar tudo"

8 phases, 39 atomic commits, all under husky `pre-commit` gate. Three irreducible decisions taken inline by owner: **1=B** (legal: in-app summary + "Versão completa" link), **2=A** (Expo SDK 55 full upgrade with breaking changes accepted — landed in 35min, no rollback needed), **3=A** (apply DROP `increment_regen_count(uuid)` migration immediately via MCP — no DB issues observed).

### Phase 1 — Backend security gaps (Clerk Trust unblockers)
- Control 3: `/api/billing/verify` now extracts `obfuscatedExternalAccountId` from Google Play API response and rejects 403 if `!= SHA256(getCurrentUserId).slice(0,64)` — kills subscription substitution attacks
- Control 2: `consume_rate_limit_token` RPC wired on both `/billing/verify` + `/billing/restore` (per-user low-budget bucket → 429 on overage)
- Tests cover 403 + 429 paths; `CLERK_TRUST_COMPENSATING_CONTROLS.md` flipped from MISSING to LIVE with refs

### Phase 2 — Legal drift reconciliation (Option B)
- Per Decision 1=B: in-app `lib/legal/content.ts` keeps friendly summary + new "Versão completa em crialook.com.br/X" link
- `scripts/check-legal-drift.js` switched from byte-for-byte to essence-semantics validation
- `LEGAL_DRIFT_RECONCILIATION.md` rewritten; CI green

### Phase 3 — Coverage ratchet to D-10 spec
- +95 web tests (utilities, AI clients, storage signed-url, supabase client, identity translations, pubsub auth, pricing engine, model-prompts, haptics)
- +68 mobile tests (plans, modelGender, schemas, clerkErrors, toast, legal content, images, notifications, preferences via vi.hoisted pattern)
- Web vitest thresholds: lines 30 / functions 42 / branches 24 / statements 30 — D-10 spec atingido em lines+functions
- Mobile vitest thresholds: lines 37 / functions 27 / branches 32 / statements 35 — D-10 spec atingido em lines; functions gap honest (RN screen hooks need Maestro/Detox)

### Phase 4 — Code cleanup parking lot (low-risk sweep, 9 plans)
- `process.env.X` → typed `env.X` import via @t3-oss/env-nextjs (web)
- `console.*` → `logger.*` across all api routes (not just /generate)
- New `CrialookError` base class with unified `code` / `userMessage` / `httpStatus` contract
- Dropped `FEATURE_REGENERATE_CAMPAIGN` flag + dead branches
- `runMockPipeline` split into demo-only chunk (excluded from prod bundle)
- `as any` sweep across web + mobile
- `sharp` import hoisted from dynamic to top-level (perf)
- Apple-touch-icon metadata removed (Android-only product)
- Bug fix: `/billing/restore` was downgrading users to `gratis` instead of preserving their plan

### Phase 5 — Dependency vuln housekeeping + SDK 55 upgrade
- Web `npm audit fix`: `uuid` + `postcss` overrides
- Per Decision 2=C: tried Expo SDK 54→55 with rollback safety net → SUCCESS, no rollback needed
- Dropped 3 deprecated SDK 55 config flags
- Mobile vulns dropped substantially (ecosystem drag remains in transitive deps)

### Phase 6 — Owner-helper scripts
- `scripts/play-release-prep.sh` — validates EAS placeholders, gens assetlinks template
- `scripts/clerk-revoke-loadtest-sessions.sh` — prints exact Dashboard URLs for the 2 leaked sessions
- `scripts/check-deploy-readiness.sh` — pre-flight: tests green, no uncommitted, migrations applied, env present
- `npm run play:prep` (mobile) + `npm run deploy:check` (web) wrappers
- README "Owner workflows" section

### Phase 7 — Minor cleanup
- iOS section dropped from `crialook-app/app.config.ts` (Android-only product)
- Storybook×Vite peer-deps verified clean (vite ^6.4.2 satisfies storybook ^8.6.18 — dropped --legacy-peer-deps)
- Storage GC inngest cron schedule documented inline

### Phase 8 — Final verification + STATE close
- Re-ran all gates (web + mobile tests, tsc, lint, build, expo-doctor, npm audit) — all green
- `STATE.md` updated to 100% / 100%
- This summary written
- Single docs commit closes the milestone

---

## Final repo state (2026-05-04 close)

| Gate | Web (`campanha-ia`) | Mobile (`crialook-app`) |
|------|---------------------|--------------------------|
| Tests | **428 / 428** (51 files, 12.10s) | **169 / 169** (23 files, 20.68s) |
| `tsc --noEmit` | **0 errors** | **0 errors** |
| `npm run lint` | **0 errors** / 88 warnings | **0 errors** / 124 warnings |
| `npm run build` | **PASS** (Next App Router) | n/a (use `eas build`) |
| `npx expo-doctor` | n/a | **18/18** |
| `npm audit --audit-level=high` | **0 high+** (3 moderate transitive: dev-only) | **0 high+** (19 transitive moderate/low: ecosystem drag) |
| Vitest coverage thresholds | lines 30 / fn 42 / br 24 / st 30 | lines 37 / fn 27 / br 32 / st 35 |
| Husky `pre-commit` | ACTIVE (`tsc --noEmit` + `lint-staged --no-stash`) | (uses web hook from monorepo root) |

**Total tests pre/post:** baseline pre-M2 was ~264 → post-M2 is **597** (+333 in this window).

---

## Owner action backlog (prioritized)

### P0 — must do before next deploy
- 🚨 `git push origin main` — 191 commits ahead of remote (use `npm run deploy:check` first)
- ✅ ~~Apply final SQL migration~~ — DONE at M2 open per Decision 3-A. All 11 migrations live in `varejo-flow`. Zero migration backlog.
- 🚨 Revoke 2 Clerk loadtest sessions via Dashboard (`scripts/clerk-revoke-loadtest-sessions.sh` prints exact URLs)

### P1 — must do before Play release
- Run 11-step `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md`; validate with `scripts/play-release-prep.sh`
- Provision 3 EAS secrets + 3 Clerk apps + assetlinks.json + bundletool dump + `eas submit`
- Copy `PLAY_DATA_SAFETY.md` into Play Console form
- Re-take IARC questionnaire per `PLAY_IARC.md`
- Polish `PLAY_STORE_LISTING.md` checklist

### P2 — post-Play approval
- Run `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` (now UNBLOCKED — controls 2+3 LIVE)
- Optionally migrate signing keys per `EAS_KEYSTORE_MIGRATION.md`

### Nice-to-have / ops capacity
- Run `ops/DEPLOY_USER_MIGRATION.md` 7-step SSH/sudo cutover (deploy as `crialook` user, not root)
- Run nginx zones split per `ops/deploy.md`
- Provision `DISCORD_WEBHOOK_URL` at `/etc/crialook/webhook.env`
- After 14 days zero CSP violations: flip Report-Only → enforced

---

## What was NOT done (parking lot)

Items intentionally out of M1+M2 scope, kept blessed but deferred:

- **Phase 2.5 (Labeling) — judge calibration** — INDEFINITELY deferred per project memory. Judge captures uncalibrated; Promptfoo stays observability-only and never blocks PR. Do NOT propose implementation without explicit owner authorization.
- **Maestro/Detox e2e stack** — explicit defer; blocks the mobile vitest functions threshold from reaching D-10's 35 (currently 27, gap is RN screen hooks: camera/biometric/push/navigation/notifications side-effects)
- **Multi-instance rate-limit migration to Redis** — parking lot per ROADMAP M1 (current PG-backed limiter works for single-instance pm2)
- **GPG-signed commit verification** — parking lot
- **Mercado Pago webhook IP allowlist at nginx** — IP ranges churn, requires maintenance commitment
- **Editor password → per-user passwords** — acceptable at current scale per CONCERNS §2
- **Deep audit of SECURITY DEFINER RPC bodies for input validation** — M1 P4 hardened GRANTs; deeper code review of every RPC body is follow-up
- **iOS-related anything** — `crialook-app` is Android-only (Play Store only); no iOS target

---

## Appendix

| Metric | Value |
|--------|-------|
| Window | 2026-05-03 → 2026-05-04 |
| M1 commits | ~152 |
| M2 commits | 39 |
| Total commits since session start | **191** |
| Distinct files touched | **371** |
| Schema migrations applied via MCP | **11 unique** (4 P1 + 3 P2 + 3 P4 initial + 1 P4 deferred-then-applied at M2 open per Decision 3-A) |
| Tests added M1+M2 | ~333 (264 → 597) |
| Husky pre-commit | ACTIVE since M1 P3 |
| Expo SDK | 54 → **55** (M2 P5) |
| Owner-helper scripts added M2 | 3 (play-release-prep, clerk-revoke, deploy-readiness) |

**Skills available for follow-up audit:** `Skill(gsd-audit-milestone)` for formal milestone signoff; `Skill(gsd-secure-phase)` for phase-level threat-model verification; `Skill(gsd-validate-phase)` for retroactive Nyquist gap fill. None auto-spawned at M2 close (inline P8 verification was the gate).
