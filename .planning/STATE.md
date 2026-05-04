# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Lojista envia foto de peça → campanha completa em ~60s. Web em produção, app mobile em review final Play Store.
**Current focus:** Phase 1 — Payments Webhook Integrity

## Current Position

Phase: M2 P1 (Backend security gaps) — starting; M1 phases complete
Plan: M1 8/8 done; M2 has 8 phases per .planning/M2-NOTES.md
Status: M1 audit done (35/45 success criteria PASS, 2 real gaps targeted by M2). M2 starting per "consertar absolutamente tudo" + 3 owner decisions: 1=B (legal link), 2=A (Expo SDK 55 full), 3=A (DROP applied via MCP).
Last activity: 2026-05-04 — DROP `increment_regen_count(uuid)` migration applied via MCP (8 schema_migrations rows added by M1+M2 so far).

Progress M1: [██████████] 100% executed (audit done, owner-actions backlogged)
Progress M2: [░░░░░░░░░░] 0% (8 phases ahead)

**OWNER ACTION ITEMS (cumulative across M1 — none blocked autonomous execute, all are post-execute):**

Production deploy & infra:
- ⚠️ Apply 6 of 7 migrations via `supabase db push` (or already done via MCP): 4 P1 + 3 P2 = APPLIED VIA MCP. P4: 3/4 applied, **DROP increment_regen_count(uuid) DEFERRED** until P4 code deployed (run after `git push` + prod deploy)
- Deploy P4-P8 code to production server when ready
- Run `bash deploy-crialook.sh` post-push (rollback path now safe per 08-01)

Security (P0 / P1):
- 🚨 **Revoke 2 Clerk sessions** in Clerk Dashboard:
  - Prod (clerk.crialook.com.br): `user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3`
  - Dev (casual-vervet-96.clerk.accounts.dev): `user_3BuUmVnqcFeMEV72k5Hkqw4kzP1`
  - File `loadtests/.env.loadtest` was NEVER committed (gitignored), so no git-history rewrite needed
- 🚨 **Backend ticket: control 3 (`obfuscatedAccountIdAndroid` validation) MISSING** in `/api/billing/verify` — subscription substitution attack possible. Blocker for Clerk Client Trust re-enable.
- 🚨 **Backend ticket: control 2 (rate-limit on `/billing/verify` + `/restore`)** infra exists at `lib/rate-limit-pg.ts` but billing routes don't call it
- ⚠️ **Legal drift P0**: site vs in-app `lib/legal/content.ts` diverged. Pick Option A (rewrite content.ts verbatim site) or Option B (keep summary + link). Doc at `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md`. **CI red** until reconciled.

Play Store launch (when ready):
- Run 11-step `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` (provision 3 EAS secrets + 3 Clerk apps + eas build + eas credentials + assetlinks.json + web deploy + bundletool dump + eas submit)
- Copy `PLAY_DATA_SAFETY.md` into Play Console Data Safety form
- Re-take IARC questionnaire per `PLAY_IARC.md` walkthrough (Classificação 12 + apparel advisory)
- Owner ticks in `PLAY_STORE_LISTING.md` polish checklist

Post-Play approval:
- Run `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` runbook (only after backend control 3 fix)
- Optionally migrate keystore per `EAS_KEYSTORE_MIGRATION.md`

Ops (low-traffic window):
- Run `ops/DEPLOY_USER_MIGRATION.md` 7-step SSH/sudo cutover (deploy as `crialook` user, not root)
- Run nginx zones split per `ops/deploy.md` first-time setup
- Provision `DISCORD_WEBHOOK_URL` at `/etc/crialook/webhook.env`
- After 14 days zero CSP violations: flip Report-Only → enforced per `ops/csp-rollout.md`

Original migrations applied via MCP (2026-05-04):
  - 4 P1: subscription_status ENUM + backfill + stores_updated_at_trigger + webhook_events
  - 3 P2: judge_pending columns + judge_payload column + judge_dead_letter table
  - 3/4 P4: rate_limit_buckets + consume_rate_limit_token RPC + harden_rpc_grants
  - DEFERRED: drop_legacy_increment_regen_count (waits for code deploy)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| —     | —     | —     | —        |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md and ROADMAP.md "Decisões do owner" section.

Recent decisions affecting current work:
- 2026-05-03: Milestone M1 (Hardening + Play Readiness) opened with two parallel trilhas (A: monorepo bug-bash, B: crialook Play readiness)
- 2026-05-03: Old `.planning/` archived to `.planning-old/` — fresh start authorized
- 2026-05-03: Parking lot items all blessed (out-of-M1 but not killed)
- 2026-05-03: Execution mode = `--interactive` (discuss inline, plan/execute in background)
- 2026-05-03: Order = sequential strict 01 → 08

### Pending Todos

None yet (no `/gsd-add-todo` capture during M1 so far).

### Blockers/Concerns

None yet.

## Deferred Items

| Category       | Item                                              | Status     | Deferred At |
|----------------|---------------------------------------------------|------------|-------------|
| AI / Eval      | Phase 2.5 Labeling (judge calibration)            | Indefinite | per memory  |
| Mobile         | iOS section cleanup in `app.config.ts` (F-05)     | Out of M1  | 2026-05-03  |
| Dev infra      | Storybook×Vite peer-dep (F-12 / TASKS.md)         | Out of M1  | 2026-05-03  |
| Mobile sec     | Clerk Client Trust re-enable execution            | Post-Play  | 2026-05-03  |
| Cleanup        | See ROADMAP "Out-of-milestone (parking lot)"      | All blessed | 2026-05-03  |

## Session Continuity

Last session: 2026-05-03 — fresh GSD bootstrap session
Stopped at: STATE.md initialized; Phase 1 discuss not yet started
Resume file: None
