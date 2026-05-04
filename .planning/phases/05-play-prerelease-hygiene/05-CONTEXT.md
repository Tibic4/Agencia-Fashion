# Phase 5: Play Pre-release Hygiene - Context

**Gathered:** 2026-05-04 (rewritten — original was wiped by parallel git reset)
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the AAB submission-clean — Sentry actually reports crashes in production, Clerk dev/prod are isolated, deep links auto-verify, and Android 13+ runtime permissions / billing manifest entries are confirmed in the built bundle. **This is the gate to Internal Testing → Closed → Production track promotion.**

In scope (PHASE-DETAILS Phase 5):
- `EXPO_PUBLIC_SENTRY_DSN` in `eas.json` production+preview profiles. `SENTRY_DISABLE_AUTO_UPLOAD: "false"` once `SENTRY_AUTH_TOKEN` is configured in EAS server env. Verify via deliberate `throw`. (F-03)
- 3 separate Clerk publishable keys per profile (development/preview/production). Update `eas.json`. Document rotation. (F-04)
- First `eas build --profile production --platform android`. Pull SHA-256 from `eas credentials -p android`. Populate `store-assets/assetlinks.json`. Deploy to web at `/.well-known/`. Validate via Google API. (F-02)
- `bundletool dump manifest` → grep `POST_NOTIFICATIONS` + `com.android.vending.BILLING`; if missing, add to `app.config.ts` and rebuild. (F-07, F-08)

Out of scope: F-10 wrap (P6), Storybook×Vite (parking), iOS cleanup (parking), keystore migration to EAS (P6 doc-only per owner).

</domain>

<decisions>
## Implementation Decisions

### Sentry source-map upload
- **D-01:** Activate full Sentry (DSN + source-map upload). No deferral.
- **D-02:** Owner provisions `SENTRY_AUTH_TOKEN` as EAS server-side secret (manual). Plan task is `owner-action: true` with checklist:
  1. Generate Sentry auth token (`Settings → Developer Settings → Auth Tokens`, scope `project:releases`)
  2. `eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token> --type string`
  3. Verify with `eas secret:list`
- **D-03:** Code change: `crialook-app/eas.json` gets `EXPO_PUBLIC_SENTRY_DSN` in production+preview AND `SENTRY_DISABLE_AUTO_UPLOAD: "false"` in production.
- **D-04:** Without `SENTRY_AUTH_TOKEN`, source-map upload fails silently — crashes still report, only stacks are minified. Acceptable interim if owner step lags.

### Clerk per-profile keys
- **D-05:** 3 publishable keys (dev/preview/prod). Owner provisions in Clerk Dashboard.
- **D-06:** Owner-action checklist:
  1. Create 3 Clerk applications/instances
  2. Capture publishable keys
  3. Update `crialook-app/eas.json` env per profile
  4. Document rotation policy in `crialook-app/docs/CLERK_KEYS.md` (annual + on suspected compromise; provision new → push to EAS → build → verify → revoke old)
- **D-07:** Plan ships `eas.json` with PLACEHOLDER values (e.g., `pk_test_PLACEHOLDER_DEV`); owner replaces with reals before triggering build.

### `assetlinks.json` hosting
- **D-08:** File at `campanha-ia/public/.well-known/assetlinks.json`. Next.js serves automatically via static-file routing. URL: `https://crialook.com.br/.well-known/assetlinks.json`.
- **D-09:** Plan creates file with PLACEHOLDER SHA-256. Owner runs build → extracts via `eas credentials -p android` → updates SHA → redeploys web.
- **D-10:** Validation: `curl https://crialook.com.br/.well-known/assetlinks.json` returns valid JSON; Google digital-asset-links API URL (per `store-assets/README_ASSETLINKS.md`) confirms binding. Plan task is `owner-action: true`.
- **D-11:** Authoritative source stays in `crialook-app/store-assets/assetlinks.json` (audit trail next to mobile app). Build/copy step into `campanha-ia/public/.well-known/`. Single source-of-truth, two-phase publish.

### EAS build trigger (owner workflow)
- **D-12:** Phase 5 prepares the repo. Owner triggers all builds. Plan deliverable = code state ready-to-build.
- **D-13:** Single ordered owner-action checklist at `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md`:
  1. Provision `SENTRY_AUTH_TOKEN` (D-02)
  2. Provision 3 Clerk publishable keys (D-06)
  3. Replace placeholders in `eas.json` with real keys
  4. `eas build --profile production --platform android`
  5. `eas credentials -p android` → extract App Signing key SHA-256
  6. Update `store-assets/assetlinks.json` SHA + copy to `campanha-ia/public/.well-known/`
  7. Deploy web (`crialook.com.br`)
  8. Validate assetlinks via Google API
  9. `bundletool dump manifest --bundle=app.aab > manifest.xml` and grep
  10. If missing — add to `app.config.ts.android.permissions` and rebuild
  11. `eas submit --platform android --track internal`
- **D-14:** I do NOT execute owner-action tasks. Plan flags each clearly.

### Manifest defense-in-depth (F-07, F-08)
- **D-15:** Plan adds `POST_NOTIFICATIONS` and `com.android.vending.BILLING` proactively to `app.config.ts.android.permissions` BEFORE first build.
- **D-16:** Plan still includes `bundletool dump manifest` task as owner-action verification (defense in depth).

### Claude's Discretion
- Format of `PLAY_RELEASE_CHECKLIST.md` (numbered with verify steps)
- Format of `CLERK_KEYS.md` (rotation policy doc)
- Whether `eas.json` placeholders use real format strings (`pk_test_xxxxxxxx`) vs explicit `PLACEHOLDER_DEV`

### Flagged for plan-phase research
- **R-01:** Confirm current `eas.json` profile structure (development/preview/production already exist?)
- **R-02:** Confirm billing lib in `crialook-app/package.json` (likely `react-native-iap`)
- **R-03:** Read `crialook-app/store-assets/README_ASSETLINKS.md` for validation URL pattern
- **R-04:** Confirm current `app.config.ts` `android.permissions` array

</decisions>

<specifics>
## Specific Ideas

- "Eu preparo TUDO no repo, depois você roda o build" — D-12, D-13
- "Sentry source-map upload ON desde já — você provisiona SENTRY_AUTH_TOKEN" — D-01, D-02
- "Single source-of-truth pra assetlinks.json" — D-11
- Coverage threshold caveat from P3: P5 doesn't touch web/mobile coverage thresholds; P6 may raise back to 30+/35+ when missing tests land

</specifics>

<canonical_refs>
## Canonical References

### Phase scope sources
- `.planning/PROJECT.md` — Android-only, Clerk Client Trust off, EAS npm 10 lock
- `.planning/ROADMAP.md` §"Phase 5"
- `.planning/PHASE-DETAILS.md` §"Phase 5"
- `.planning/STATE.md`

### Findings (release-critical)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` — F-02, F-03, F-04, F-07, F-08
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §11 (Re-enable plan referenced by P6)

### Codebase intel
- `.planning/codebase/STACK.md` §"crialook-app"
- `.planning/codebase/ARCHITECTURE.md` §"Mobile↔Web boundary"

### Phase 3 dependency (already done)
- `.planning/phases/03-test-infra-and-flake-fix/` — test infra stable; commits `1537733`..`88b661a`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `crialook-app/eas.json` profile structure
- `crialook-app/store-assets/` directory + `README_ASSETLINKS.md`
- Existing mobile Sentry setup

### Established Patterns
- Owner-action checkpoints (introduced in P4 D-13/D-14, reused throughout M1)
- Co-located static assets in Next.js `public/`
- Per-profile env in `eas.json`

### Integration Points
- `crialook-app/eas.json` (D-03, D-07)
- `crialook-app/store-assets/assetlinks.json` (D-09 placeholder)
- `campanha-ia/public/.well-known/assetlinks.json` (D-08 deploy target)
- `crialook-app/app.config.ts` (D-15)
- `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` (new, D-13)
- `crialook-app/docs/CLERK_KEYS.md` (new, D-06)

</code_context>

<deferred>
## Deferred Ideas

- F-10 TabErrorBoundary `__DEV__` wrap → P6
- Re-enable Clerk Client Trust execution → post-Play
- Migrate keystore to EAS-managed → P6 doc-only (per owner decision)
- iOS section cleanup → parking lot
- Storybook×Vite → parking lot

</deferred>

---

*Phase: 05-play-prerelease-hygiene*
*Context gathered: 2026-05-04 (rewrite)*
