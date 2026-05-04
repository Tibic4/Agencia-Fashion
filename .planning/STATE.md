# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Lojista envia foto de peça → campanha completa em ~60s. Web em produção, app mobile em review final Play Store.
**Current focus:** M1 + M2 closed (2026-05-04). Owner-action backlog ready to execute.

## Current Position

Phase: M2 done — milestone "Consertar tudo" closed. M3 not yet scoped.
Plan: M1 8/8 + M2 8/8 executed. Both milestones audited inline (M1 audit done at end of M1; M2 verified via Phase 8 gates).
Status: All verification gates green. SDK 55 live. Husky ACTIVE. Owner-action backlog cumulative below.
Last activity: 2026-05-04 — M2 P8 closed: 597 tests pass (web 428 / mobile 169), tsc 0/0, lint 0/0 errors, build OK, expo-doctor 18/18, audit 0 high+.

Progress M1: [██████████] 100% executed (audit done, owner-actions backlogged)
Progress M2: [██████████] 100% executed (8/8 phases done)

**M2 SUMMARY (this milestone):**
- 39 commits, 8 phases, all atomic per task with husky gate
- P1 closed 2 backend security gaps (control 2 rate-limit + control 3 obfuscated-hash on /billing/verify+restore) → flips Clerk Trust re-enable from BLOCKED to GO when owner is ready
- P2 reconciled legal drift via Option B (in-app summary + "Versão completa" link); CI green
- P3 added 95+ tests (web) and 68+ tests (mobile), ratcheted vitest coverage to measured floor (web 30/42/24/30, mobile 37/27/32/35); D-10 spec atingido em lines+funcs (web) e lines (mobile)
- P4 sweep: env.ts typed env, console→logger in api routes, CrialookError contract, dropped FEATURE_REGENERATE_CAMPAIGN, runMockPipeline split out of prod bundle, as-any tightened, sharp hoisted, /billing/restore preserve plan bug
- P5 web `npm audit fix` (uuid+postcss overrides) + Expo SDK 54→55 upgrade SUCCESS (decision 2C win) → mobile vulns dropped
- P6 added 3 owner-helper scripts (play-release-prep, clerk-revoke-loadtest-sessions, check-deploy-readiness) + README "Owner workflows" section
- P7 minor cleanup (iOS section dropped from app.config.ts; storybook×vite peer-deps clean; storage GC inline-doc)
- P8 final verify + close

**OWNER ACTION ITEMS (cumulative across M1 + M2):**

Production deploy & infra:
- ✅ ~~Apply DROP `increment_regen_count(uuid)` 1-arg overload migration~~ — **APPLIED via MCP at M2 start per Decision 3-A**. All 11 unique migrations now live in `varejo-flow` Supabase. No outstanding migration work.
- ⚠️ `git push origin main` — 191 commits ahead since 2026-05-03. Use new `npm run deploy:check` (M2 P6) for pre-flight: tests, no uncommitted, migrations applied, env present.
- Run `bash deploy-crialook.sh` post-push (rollback path safe per 08-01; Discord notify wired)
- Provision `DISCORD_WEBHOOK_URL` at `/etc/crialook/webhook.env` (still pending)

Security (P0 / P1):
- 🚨 **Revoke 2 Clerk sessions** in Clerk Dashboard via new `scripts/clerk-revoke-loadtest-sessions.sh` helper (prints exact URLs):
  - Prod (clerk.crialook.com.br): `user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3`
  - Dev (casual-vervet-96.clerk.accounts.dev): `user_3BuUmVnqcFeMEV72k5Hkqw4kzP1`
  - File `loadtests/.env.loadtest` was NEVER committed (gitignored), so no git-history rewrite needed
- ✅ ~~Backend control 3 obfuscatedAccountIdAndroid validation~~ — **CLOSED in M2 P1-01** (`/api/billing/verify` rejects 403 on hash mismatch). Was a Clerk Trust re-enable blocker.
- ✅ ~~Backend control 2 rate-limit on /billing/verify + /restore~~ — **CLOSED in M2 P1-02** (consume_rate_limit_token wired, 429 on overage).
- ✅ ~~Legal drift P0~~ — **CLOSED in M2 P2** (Option B picked: in-app summary + "Versão completa" link). CI green.

Play Store launch (when ready):
- Run 11-step `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` (provision 3 EAS secrets + 3 Clerk apps + eas build + eas credentials + assetlinks.json + web deploy + bundletool dump + eas submit)
- Use new `scripts/play-release-prep.sh` (M2 P6) to validate placeholders + gen assetlinks template
- Copy `PLAY_DATA_SAFETY.md` into Play Console Data Safety form
- Re-take IARC questionnaire per `PLAY_IARC.md` walkthrough (Classificação 12 + apparel advisory)
- Owner ticks in `PLAY_STORE_LISTING.md` polish checklist

Post-Play approval:
- Run `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` runbook — now UNBLOCKED (controls 2+3 LIVE per M2 P1-05)
- Optionally migrate keystore per `EAS_KEYSTORE_MIGRATION.md`

Ops (low-traffic window):
- Run `ops/DEPLOY_USER_MIGRATION.md` 7-step SSH/sudo cutover (deploy as `crialook` user, not root)
- Run nginx zones split per `ops/deploy.md` first-time setup
- After 14 days zero CSP violations: flip Report-Only → enforced per `ops/csp-rollout.md`

Migrations applied via MCP (M1 + M2 = 11 unique cumulative):
  - 4 P1 (M1): subscription_status ENUM + backfill + stores_updated_at_trigger + webhook_events
  - 3 P2 (M1): judge_pending columns + judge_payload column + judge_dead_letter table
  - 3 P4 initial (M1): rate_limit_buckets + consume_rate_limit_token RPC + harden_rpc_grants
  - 1 P4 deferred → applied at M2 start per Decision 3-A: drop_legacy_increment_regen_count(uuid)
  - **Status: ZERO migrations pending.** Owner does NOT need to run `supabase db push` for any M1/M2 schema work.

## Optional next step

A formal milestone audit is available via `Skill(gsd-audit-milestone)` if owner wants an external signoff before archiving. Not auto-spawned to conserve agent runs (inline P8 verification + `M1+M2-SUMMARY.md` already provide posterity record).

## Performance Metrics

**Velocity:**
- Total milestones completed: 2 (M1 + M2)
- Session commits: 39 (M2 only) / 191 cumulative since 2026-05-03 (M1+M2)
- Distinct files touched M1+M2: 371
- Schema migrations applied: 11 unique via MCP (zero pending)

**By Milestone:**

| Milestone | Phases | Plans | Commits |
|-----------|--------|-------|---------|
| M1        | 8      | many  | ~152    |
| M2        | 8      | 30+   | 39      |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md, ROADMAP.md, M2-NOTES.md "Decisões do owner" sections.

Recent decisions affecting current work:
- 2026-05-03: Milestone M1 (Hardening + Play Readiness) opened with two parallel trilhas
- 2026-05-03: Old `.planning/` archived to `.planning-old/` — fresh start authorized
- 2026-05-04: M2 opened with 3 owner decisions: 1=B (legal link), 2=A (Expo SDK 55 full upgrade, breaking changes accepted), 3=A (apply DROP migration now via MCP)
- 2026-05-04: All 3 M2 decisions executed clean: legal Option B landed CI-green; SDK 55 upgrade succeeded in 35min with no rollback; DROP migration applied via MCP at M2 open (no DB issues)
- 2026-05-04: M2 closed cleanly via P8 verification

### Pending Todos

None tracked in /gsd-add-todo. All open items live in OWNER ACTION ITEMS above.

### Blockers/Concerns

None for next milestone start. Pending owner-actions are post-execute (deploy, dashboard clicks, Play Console).

## Deferred Items

| Category       | Item                                              | Status     | Deferred At |
|----------------|---------------------------------------------------|------------|-------------|
| AI / Eval      | Phase 2.5 Labeling (judge calibration)            | Indefinite | per memory  |
| Mobile sec     | Clerk Client Trust re-enable execution            | Post-Play  | 2026-05-03  |
| Test infra     | Maestro/Detox e2e (blocks D-10 funcs in mobile)   | Out of M2  | 2026-05-04  |
| Backend infra  | Multi-instance rate-limit migration to Redis       | Parking lot| 2026-05-03  |
| Ops infra      | GPG-signed commit verification                     | Parking lot| 2026-05-03  |
| Ops infra      | Mercado Pago webhook IP allowlist at nginx         | Parking lot| 2026-05-03  |
| Backend        | Editor password → per-user passwords              | Parking lot| 2026-05-03  |
| Cleanup        | Audit each SECURITY DEFINER RPC body for input val | Parking lot| 2026-05-03  |

## Session Continuity

Last session: 2026-05-04 — M2 P8 closed. M1+M2 milestone window complete.
Stopped at: Single docs commit `docs(m2-08): close M2 — final verify, STATE update, M1+M2 summary`. Owner ready to push + execute backlog.
Resume file: None — next session starts fresh M3 scoping (or deploy/Play release execution).
