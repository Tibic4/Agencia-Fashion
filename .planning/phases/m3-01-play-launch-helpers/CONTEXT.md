# M3-01 Play Launch Helpers — Context

**Status:** in-progress
**Date:** 2026-05-03
**Goal:** Maximize automation around the 11-step PLAY_RELEASE_CHECKLIST so owner has minimum-friction launch workflow.

## Pre-flight (assumed already done — M1, M2)

- M1 + M2 closed; deployed to prod.
- Clerk loadtest sessions revoked.
- Discord webhook provisioned.
- M2 P6 shipped `scripts/play-release-prep.sh` (the in-repo pre-flight) and `crialook-app/scripts/sync-assetlinks.js`.
- Lockfile version 3 confirmed in `crialook-app/package-lock.json` (will re-confirm after every script-block edit).

## Audit (Step 1) — automation status of the 11 steps

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1 | Provision Sentry secrets in EAS | MANUAL-IMPROVABLE | New: `eas-secrets-prefill.sh` prints exact `eas secret:create` commands and probes existing secrets |
| 2 | Provision three Clerk applications | MANUAL | Pure Clerk Dashboard click-ops; no automation possible |
| 3 | Replace `eas.json` placeholders | MANUAL-IMPROVABLE | New: `clerk-keys-mapping.md` + `apply-clerk-keys.js` make this paste-once + idempotent script-apply |
| 4 | Trigger first production build | MANUAL | `eas build` is owner-trigger; new `preflight-eas-build.sh` validates everything is in place first |
| 5 | Extract App Signing key SHA-256 | MANUAL | Pure `eas credentials` interaction; could not be safely automated without EAS CLI session |
| 6 | Update `assetlinks.json` and sync | PARTIALLY AUTOMATED | `npm run assetlinks:sync` + `assetlinks:check` already exist (M2 P5); SHA replacement is owner-paste |
| 7 | Deploy `campanha-ia` to production | PARTIALLY AUTOMATED | `npm run deploy:check` (M2 P6) already pre-flights the deploy |
| 8 | Validate via Google digital-asset-links API | MANUAL-IMPROVABLE | New: `validate-assetlinks-deployed.sh` curls + diffs against local |
| 9 | Verify AAB manifest contains required permissions | MANUAL-IMPROVABLE | New: `validate-aab-manifest.sh` runs `bundletool dump manifest` + greps |
| 10 | Recovery branch (conditional) | MANUAL | Conditional, executes only if step 9 fails |
| 11 | Submit to Play Internal Testing | MANUAL | New: `play-store-finalize.sh` orchestrator validates + prints exact `eas submit` command |

## Helpers built (Step 2)

a. `scripts/eas-secrets-prefill.sh` — prints `eas secret:create` commands; probes `eas secret:list` if EAS CLI logged-in
b. `scripts/clerk-keys-mapping.md` — owner copy-paste table for the 3 Clerk publishable keys
c. `scripts/apply-clerk-keys.js` — reads mapping doc, validates 3 real keys, updates `eas.json` (idempotent)
d. `scripts/validate-assetlinks-deployed.sh` — curls live endpoint, diffs against local file
e. `scripts/validate-aab-manifest.sh` — `bundletool dump manifest` + grep
f. `scripts/play-store-finalize.sh` — orchestrator
g. `scripts/preflight-eas-build.sh` — gate before `eas build`

## Hard constraints

- No git push, no git reset/revert.
- No EAS API calls, Clerk Admin API calls, or Google Play API calls.
- No `crialook-app/android/` edits.
- Atomic commits per deliverable: `feat(m3-01-NN):` / `docs(m3-01-NN):` / `chore(m3-01-NN):`.

## Cross-references

- `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` — owner runbook
- `crialook-app/docs/PLAY_DATA_SAFETY.md` — Data Safety form mapping
- `crialook-app/docs/PLAY_IARC.md` — IARC questionnaire walkthrough
- `crialook-app/docs/CLERK_KEYS.md` — Clerk per-profile setup + rotation
- `scripts/play-release-prep.sh` — M2 P6 pre-flight (composed by `preflight-eas-build.sh`)
- `crialook-app/scripts/sync-assetlinks.js` — M2 P5 sync script
