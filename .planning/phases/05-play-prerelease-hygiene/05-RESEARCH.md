# Phase 5: Play Pre-release Hygiene - Research

**Researched:** 2026-05-03
**Status:** Complete — flagged research items R-01..R-04 from CONTEXT resolved by direct file inspection (harness gap; subagent dispatch unavailable in this run).

## Resolved Research Items (from CONTEXT.md)

### R-01: `crialook-app/eas.json` profile structure
**Confirmed:** Three named profiles — `development`, `preview`, `production` — already exist with `env` blocks ready to extend. Source: `crialook-app/eas.json`.

Current state per profile (relevant fields):

| Profile     | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`             | `EXPO_PUBLIC_SENTRY_DSN` | `SENTRY_DISABLE_AUTO_UPLOAD` |
| ----------- | ----------------------------------------------- | ------------------------ | ---------------------------- |
| development | `pk_live_Y2xlcmsuY3JpYWxvb2suY29tLmJyJA`        | (absent)                 | `"true"`                     |
| preview     | `pk_live_Y2xlcmsuY3JpYWxvb2suY29tLmJyJA`        | (absent)                 | `"true"`                     |
| production  | `pk_live_Y2xlcmsuY3JpYWxvb2suY29tLmJyJA`        | (absent)                 | `"true"`                     |

Both F-03 (no DSN anywhere) and F-04 (same Clerk key across all 3 profiles) are confirmed present.

**Implication for plans:** No new profile creation needed — only env-block additions / replacements per profile. `submit.production.android` already points to `./play-store-key.json` with `track: "internal"` and `releaseStatus: "draft"` — owner Step 11 of checklist (`eas submit --platform android --track internal`) works with existing config.

### R-02: Billing library
**Confirmed:** `react-native-iap@^14.7.20` is the in-use IAP lib, with the Expo plugin entry `["react-native-iap", { "paymentProvider": "Play Store" }]` already in `app.config.ts` plugins array. Source: `crialook-app/package.json` line 76 + `crialook-app/app.config.ts` lines 198-203.

**Implication for plans:** F-08 verification (`com.android.vending.BILLING`) is the right intent — `react-native-iap` autolinking SHOULD inject `BILLING`, but defense-in-depth per D-15 means the plan adds it explicitly to `android.permissions` so the bundle is independent of plugin auto-merge timing.

### R-03: Validation URL pattern
**Confirmed:** `crialook-app/store-assets/README_ASSETLINKS.md` documents:
- Public URL: `https://crialook.com.br/.well-known/assetlinks.json` (HTTP 200, no redirect, content-type `application/json`)
- Validation API: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://crialook.com.br&relation=delegate_permission/common.handle_all_urls`
- SHA-256 source: `eas credentials -p android` → "Show keystore credentials" → "SHA-256 Fingerprint" (App Signing key only, NOT upload key)
- Format: 64 hex chars separated by `:` (`AB:CD:EF:...:12`)

**Implication for plans:** README_ASSETLINKS.md already covers the owner workflow — plan does NOT need to rewrite it. PLAY_RELEASE_CHECKLIST.md should reference it instead of duplicating.

### R-04: Current `app.config.ts` android.permissions
**Confirmed:** Current array is exactly:

```ts
permissions: [
  'android.permission.VIBRATE',
  'android.permission.CAMERA',
],
blockedPermissions: [
  'RECEIVE_BOOT_COMPLETED',
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE',
],
```

Source: `crialook-app/app.config.ts` lines 136-144.

**Implication for plans (D-15):** Plan 05-01 must add EXACTLY these two strings (in this order, preserving alphabetical-by-suffix ordering already in use):

```ts
'android.permission.POST_NOTIFICATIONS',
'com.android.vending.BILLING',
```

The blockedPermissions list does NOT need changes — none of these new perms are in the block list, and `BILLING` is not a runtime permission so the prompt-style block list semantics don't apply.

## Existing assetlinks.json files

Two existing copies in repo (both with placeholder SHA-256):

1. `crialook-app/store-assets/assetlinks.json` — authoritative source per D-11. Multi-line pretty format (14 lines).
2. `campanha-ia/public/.well-known/assetlinks.json` — already deployed copy (compact format, 11 lines).

**Implication:** Both files exist with identical placeholder. Plan 05-03 must establish the AUTHORITATIVE source (D-11 says `crialook-app/store-assets/`) and the sync mechanism (manual copy step in checklist + a small `scripts/sync-assetlinks.js` Node helper to detect drift). Both files can keep their existing placeholder string `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` — owner replaces in source, runs sync script, redeploys web.

## Sentry config — current state of `lib/sentry.ts` and `app.config.ts` plugin

`app.config.ts` already wires the `@sentry/react-native/expo` plugin (lines 230-240) with the comment `org/project/authToken come from SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN during EAS build.` This means the Expo Sentry plugin is ALREADY configured for source-map upload — the only gates are:
1. `SENTRY_AUTH_TOKEN` available as EAS server-side secret (owner-action D-02).
2. `SENTRY_DISABLE_AUTO_UPLOAD` flipped to `"false"` in production env (D-03, plan 05-02).
3. `EXPO_PUBLIC_SENTRY_DSN` populated in production+preview env (D-03, plan 05-02).

The plugin already expects `SENTRY_ORG` and `SENTRY_PROJECT` from env. Owner checklist must include those (typically `SENTRY_ORG=crialook`, `SENTRY_PROJECT=crialook-app` — but those names are owner-known, plan flags as TODO in checklist).

## Validation Architecture

Phase 5 has no live-app validation — every assertion is either a static file check (string present/absent) or an owner-action verification (build artifact + external service).

| Check                                                  | Type            | Owner | Tool                                                                    |
| ------------------------------------------------------ | --------------- | ----- | ----------------------------------------------------------------------- |
| `eas.json` has `EXPO_PUBLIC_SENTRY_DSN` in prod+preview | static (grep)   | no    | `grep EXPO_PUBLIC_SENTRY_DSN crialook-app/eas.json`                     |
| `eas.json` has `SENTRY_DISABLE_AUTO_UPLOAD: "false"` in prod | static (grep) | no    | `grep -A1 production.env crialook-app/eas.json | grep DISABLE_AUTO`     |
| 3 distinct `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` values  | static (grep)   | no    | `grep EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY crialook-app/eas.json | sort -u | wc -l` ≥ 3 |
| `app.config.ts` permissions include POST_NOTIFICATIONS + BILLING | static (grep) | no    | `grep -E 'POST_NOTIFICATIONS|com.android.vending.BILLING' crialook-app/app.config.ts` |
| Both assetlinks.json files identical                   | static (diff)   | no    | `diff crialook-app/store-assets/assetlinks.json campanha-ia/public/.well-known/assetlinks.json` |
| `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` covers all 11 owner steps | static (grep) | no    | `grep -c '^[0-9]\+\.' crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` ≥ 11 |
| `crialook-app/docs/CLERK_KEYS.md` exists with rotation section | static (grep) | no    | `grep -c '## Rotation' crialook-app/docs/CLERK_KEYS.md` ≥ 1            |
| Sentry actually reports a thrown error                 | runtime         | YES   | Owner step (post-build): deliberate `throw` in production AAB → Sentry  |
| `bundletool dump manifest` shows POST_NOTIFICATIONS    | build artifact  | YES   | Owner step (post-build): `bundletool dump manifest | grep POST_NOTIFICATIONS` |
| `bundletool dump manifest` shows com.android.vending.BILLING | build artifact | YES | Owner step                                                              |
| Google digital-asset-links API confirms binding        | external        | YES   | Owner step: `curl https://digitalassetlinks.googleapis.com/...`         |
| `eas submit --platform android --track internal` succeeds | external     | YES   | Owner step (final)                                                      |

## Dependencies & Constraints

- **Memory rule:** ANY change to `crialook-app/package.json` requires `npm run lock:fix`. Phase 5 plans do NOT change `package.json` (no new deps), so lock regen is NOT required. Plan 05-01 modifies `app.config.ts` only — that is a TS source file, not a manifest, so no lock impact.
- **EAS npm 10 lock:** Lock format constraint applies to lockfile regen, not config edits. Confirmed no plan triggers it.
- **Clerk Client Trust off:** Out of scope for P5 per CONTEXT.md `<deferred>`. Re-enable plan lives in P6 doc-only.
- **iOS:** Out of scope per android-only rule. Plan 05-01 does NOT touch the iOS section of `app.config.ts`.

## Risks identified during research

1. **R-A:** Owner may forget to provision `SENTRY_ORG` / `SENTRY_PROJECT` env (only `SENTRY_AUTH_TOKEN` is in CONTEXT D-02). Mitigation: PLAY_RELEASE_CHECKLIST step 1 must list ALL THREE.
2. **R-B:** EAS build env in `eas.json` `production` block does NOT auto-include EAS server-side secrets — those need explicit env propagation OR the secret must be referenced via `eas-build-pre-install` hook. Sentry plugin reads `SENTRY_AUTH_TOKEN` from process env at build time — owner-secret-via-`eas secret:create` is automatically injected into the build environment, no action needed in `eas.json`. Confirm in checklist verification step 3 (`eas secret:list`).
3. **R-C:** When Clerk dev/preview keys are placeholders that LOOK real (`pk_test_PLACEHOLDER_DEV`), accidentally building before owner replaces them produces a build that fails Clerk auth at runtime — but build itself succeeds. Mitigation: PLAY_RELEASE_CHECKLIST step 3 mandates "verify all 3 keys differ AND none contain `PLACEHOLDER` substring before triggering build".
4. **R-D:** `assetlinks.json` is served by Next.js from `public/.well-known/`. Next.js 16 serves `public/` files directly with no special routing needed — verified by inspecting existing `campanha-ia/public/.well-known/assetlinks.json` (already in place, no API route).

## Files plans will create or modify

| File                                                       | Plan  | Action     |
| ---------------------------------------------------------- | ----- | ---------- |
| `crialook-app/app.config.ts`                               | 05-01 | edit       |
| `crialook-app/eas.json`                                    | 05-02 | edit       |
| `crialook-app/store-assets/assetlinks.json`                | 05-03 | overwrite (formatting normalize, keep placeholder) |
| `campanha-ia/public/.well-known/assetlinks.json`           | 05-03 | overwrite (sync from authoritative) |
| `crialook-app/scripts/sync-assetlinks.js`                  | 05-03 | create     |
| `crialook-app/docs/CLERK_KEYS.md`                          | 05-04 | create     |
| `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md`              | 05-05 | create     |

`crialook-app/docs/` directory does NOT exist yet — plan 05-04 (which lands first in Wave 1 alongside 05-01..05-03) creates it implicitly via the file write.

## RESEARCH COMPLETE
