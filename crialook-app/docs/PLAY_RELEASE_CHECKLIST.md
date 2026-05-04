# Play Release Checklist — `crialook-app`

> Phase 5 deliverable. Single owner-action sequence from "repo prepared by Phase 5"
> through "AAB live on Play Internal Testing track". Eleven ordered steps; every
> one is OWNER-ACTION (Claude does not have EAS credentials).
>
> **Pre-flight assumption:** Phase 5 plans 05-01 through 05-04 are merged. That
> means: `app.config.ts` declares `POST_NOTIFICATIONS` + `com.android.vending.BILLING`,
> `eas.json` carries 3 distinct PLACEHOLDER Clerk keys + 3 PLACEHOLDER Sentry DSNs +
> `SENTRY_DISABLE_AUTO_UPLOAD: "false"` in production, `assetlinks.json` exists in
> both authoritative + deploy locations with the standard SHA placeholder, and
> `CLERK_KEYS.md` documents the Clerk per-profile setup.

---

## Pre-flight: confirm phase prep is in place

```bash
# All of these must succeed before starting step 1.
cd crialook-app
node -e "JSON.parse(require('fs').readFileSync('./eas.json','utf8'))"   # eas.json valid JSON
grep -q 'POST_NOTIFICATIONS' app.config.ts                              # F-07 fix in place
grep -q 'com.android.vending.BILLING' app.config.ts                     # F-08 fix in place
npm run assetlinks:check                                                # assetlinks files in sync
test -f docs/CLERK_KEYS.md                                              # Clerk doc shipped
```

If any of those fail, stop — Phase 5 prep is incomplete.

---

## 1. Provision Sentry secrets in EAS (owner-action)

Sentry needs three values at build time. ALL THREE are EAS server-side secrets,
NOT inline in `eas.json`:

```bash
# In Sentry: Settings -> Developer Settings -> Auth Tokens
#   New token, scope: project:releases (minimum)
#   Org slug: <your sentry org>
#   Project slug: crialook-app (or whatever the Sentry project is named)
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value '<token>' --type string
eas secret:create --scope project --name SENTRY_ORG --value '<org slug>' --type string
eas secret:create --scope project --name SENTRY_PROJECT --value '<project slug>' --type string

# Verify
eas secret:list
```

> R-A safeguard: easy to forget `SENTRY_ORG` and `SENTRY_PROJECT` and provision
> only `SENTRY_AUTH_TOKEN`. Without all three, the `@sentry/react-native/expo`
> plugin's source-map upload step silently no-ops at the end of the build, and
> production crashes report with minified stacks. ALL THREE are required for
> source maps to upload.

Without these, Sentry still REPORTS crashes (DSN-only path) — only stack
de-minification fails. So this step is not strictly build-blocking, but the
release is degraded without it.

---

## 2. Provision three Clerk applications (owner-action)

Follow `crialook-app/docs/CLERK_KEYS.md` §"Provisioning (Initial Setup)" — six
sub-steps. Capture the three publishable keys (`pk_test_…`, `pk_test_…`,
`pk_live_…`) for use in step 3.

---

## 3. Replace `eas.json` placeholders (owner-action)

Edit `crialook-app/eas.json`. Replace each placeholder string with the real
value:

| Placeholder string                                       | Replace with                              |
| -------------------------------------------------------- | ----------------------------------------- |
| `pk_test_PLACEHOLDER_DEV_REPLACE_BEFORE_BUILD`           | dev Clerk publishable key from step 2     |
| `pk_test_PLACEHOLDER_PREVIEW_REPLACE_BEFORE_BUILD`       | preview Clerk publishable key from step 2 |
| `pk_live_PLACEHOLDER_PROD_REPLACE_BEFORE_BUILD`          | prod Clerk publishable key from step 2    |
| `PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD` (production env)  | prod Sentry DSN (`https://…@…sentry.io/…`)|
| `PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD` (preview env)     | preview Sentry DSN (or same as prod, your call) |
| `PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD` (development env) | dev Sentry DSN (or same as prod)          |

**Pre-build assertion** — run BEFORE moving to step 4:

```bash
node -e "
  const j=require('./crialook-app/eas.json');
  const cks=[
    j.build.development.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    j.build.preview.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    j.build.production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  ];
  const dsns=[
    j.build.development.env.EXPO_PUBLIC_SENTRY_DSN,
    j.build.preview.env.EXPO_PUBLIC_SENTRY_DSN,
    j.build.production.env.EXPO_PUBLIC_SENTRY_DSN
  ];
  const allClean = [...cks, ...dsns].every(s => typeof s === 'string' && s.length > 0 && !s.includes('PLACEHOLDER'));
  const clerkDistinct = new Set(cks).size === 3;
  if (!allClean) { console.error('FAIL: a PLACEHOLDER value still present'); process.exit(1); }
  if (!clerkDistinct) { console.error('FAIL: Clerk keys not all distinct'); process.exit(1); }
  console.log('OK: ready to build');
"
```

If the assertion fails, do NOT proceed.

> R-C safeguard: this assertion is the gate. Don't `eas build` without it.

---

## 4. Trigger first production build (owner-action)

```bash
cd crialook-app
eas build --profile production --platform android
```

Wait for the EAS build to finish. Note the build URL.

If the build fails:
- Source-map upload error -> step 1's secrets are wrong / missing.
- Clerk init error -> step 3's pre-build assertion was bypassed.
- Lockfile error -> ran `npm install` somewhere recently. Restore from git, run
  `npm run lock:fix`, retry.

---

## 5. Extract App Signing key SHA-256 (owner-action)

Per `crialook-app/store-assets/README_ASSETLINKS.md` "Como obter o SHA-256":

```bash
eas credentials -p android
# Select: production
# Select: Keystore: Show keystore credentials
# Copy the "SHA-256 Fingerprint" (App Signing key, NOT upload key)
```

Format: 64 hex chars separated by `:` -> `AB:CD:EF:...:12`.

Alternative: Play Console -> Setup -> App integrity -> App signing -> "Copy SHA-256
certificate fingerprint" (use the **App signing key** value, not Upload key).

---

## 6. Update `assetlinks.json` and sync (owner-action)

Edit the AUTHORITATIVE source:

```bash
# crialook-app/store-assets/assetlinks.json -> replace
#   "REPLACE_WITH_PLAY_APP_SIGNING_SHA256"
# with the SHA-256 from step 5.

cd crialook-app
npm run assetlinks:sync   # copies authoritative -> campanha-ia/public/.well-known/
npm run assetlinks:check  # confirm in sync (exits 0)
```

Commit:

```bash
git add crialook-app/store-assets/assetlinks.json campanha-ia/public/.well-known/assetlinks.json
git commit -m "chore(crialook-app): set production app-signing SHA-256 in assetlinks.json"
```

---

## 7. Deploy `campanha-ia` to production (owner-action)

Use the project's standard deploy path (`deploy-crialook.sh` per `PROJECT.md`).
The deploy must result in:

```
GET https://crialook.com.br/.well-known/assetlinks.json
  -> 200 OK
  -> Content-Type: application/json
  -> Body matches the local crialook-app/store-assets/assetlinks.json byte-for-byte
```

Quick smoke test from any machine:

```bash
curl -sSI https://crialook.com.br/.well-known/assetlinks.json | head -5
curl -s   https://crialook.com.br/.well-known/assetlinks.json | diff - crialook-app/store-assets/assetlinks.json
```

The `diff` should produce no output.

---

## 8. Validate via Google digital-asset-links API (owner-action)

```bash
curl -s 'https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://crialook.com.br&relation=delegate_permission/common.handle_all_urls' \
  | python3 -m json.tool
```

Expected: a `statements` array containing an entry with
`target.androidApp.packageName == "com.crialook.app"` and the SHA-256 from step 5.

If empty or missing the package name, deep links will NOT auto-verify and the OS
falls back to the "Open with…" picker. Re-check step 7.

---

## 9. Verify AAB manifest contains required permissions (owner-action)

The `bundletool dump manifest` defense-in-depth check (D-16). The Phase 5 plan
05-01 already adds `POST_NOTIFICATIONS` and `com.android.vending.BILLING` to
`app.config.ts.android.permissions` (D-15), so this verification should pass on
attempt #1 — but verify anyway.

```bash
# Download the AAB from EAS (build URL from step 4 -> "Download")
# Save as ./app.aab

bundletool dump manifest --bundle=./app.aab > ./manifest.xml

grep -E 'POST_NOTIFICATIONS|com\.android\.vending\.BILLING' ./manifest.xml
```

Expected: at least 2 lines, one for each permission.

---

## 10. If step 9 found anything missing (owner-action — conditional)

This branch should NOT execute given plan 05-01's defense-in-depth add. If it
DOES, something is unexpected — investigate Expo prebuild output, plugin merge
order, OR a regression of the `app.config.ts` change.

To recover (if needed):
1. Add the missing permission(s) to `crialook-app/app.config.ts` `android.permissions`.
2. Commit + push.
3. Re-run step 4 (`eas build --profile production --platform android`).
4. Re-run step 9.

---

## 11. Submit to Play Internal Testing (owner-action)

```bash
cd crialook-app
eas submit --platform android --track internal
```

The `submit.production.android` block in `eas.json` already targets:
- `serviceAccountKeyPath: ./play-store-key.json`
- `track: internal`
- `releaseStatus: draft`

So the AAB lands as a draft on Internal Testing. Promote to Closed Testing /
Production via Play Console UI when ready (out of scope for this checklist).

Post-submit:
- Sign in to the Play Internal Testing build with each EAS variant (you may need
  to install dev/preview APKs separately — they don't go through `eas submit`).
- Confirm Clerk Dashboard shows the signin event on the matching instance per
  `CLERK_KEYS.md` step 6 of provisioning.
- Trigger a deliberate `throw new Error("F-03 verify")` from a debug-accessible
  code path (or use the existing tab-error-boundary surface) and confirm it lands
  in Sentry within 60s. This satisfies ROADMAP Phase 5 success criterion #1.
- Tap a known `https://crialook.com.br/campaign/<uuid>` link from email or SMS
  on a device with the production AAB installed. Confirm it opens the app
  without the "Open with…" picker. This satisfies success criterion #3.

---

## Rollback

If any step fails irrecoverably, here's the unwinding path.

### Build fails (step 4)

- Check EAS build log first.
- If credential / secret error: re-run step 1 (`eas secret:list` to confirm).
- If lockfile error: `git checkout crialook-app/package-lock.json && cd crialook-app && npm run lock:fix`. Never `npm install` directly (memory rule
  `project_eas_npm_lock`).
- If Clerk init error: re-run step 3's pre-build assertion. The most common
  cause is one Clerk key still containing `PLACEHOLDER`.

### Manifest verification fails (step 9)

- Did plan 05-01's `app.config.ts` change make it into the build? `git log
  -- crialook-app/app.config.ts | head` — confirm the Phase 5 commit is in the
  build's source.
- If yes: inspect `eas build` output for plugin warnings about `expo-notifications`
  or `react-native-iap` autolinking.
- If no: rebase / cherry-pick the missing commit, re-run step 4.

### Google API validation fails (step 8)

- 99% chance: web deploy didn't actually serve the new file.
  `curl -sSI https://crialook.com.br/.well-known/assetlinks.json` — check that
  `Content-Type` is `application/json` and the body matches.
- 1% chance: SHA-256 was copied wrong. Re-run step 5, diff against the file.

### `eas submit` fails (step 11)

- Most common: `play-store-key.json` is missing / wrong / lacks the right
  permissions in Play Console. Verify the service account in Play Console has
  "Release Manager" or higher role.
- Less common: track / releaseStatus mismatch with what Play Console allows for
  this app version. Adjust `submit.production.android.track` in `eas.json`.

---

## Cross-references

- `crialook-app/docs/CLERK_KEYS.md` — Clerk provisioning + rotation policy.
- `crialook-app/store-assets/README_ASSETLINKS.md` — SHA-256 extraction + Google
  API validation URL.
- `crialook-app/eas.json` — build profiles + submit config.
- `crialook-app/app.config.ts` — Android permissions, plugins.
- `.planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md` — D-12, D-13,
  D-14, D-15, D-16.
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §F-02, §F-03, §F-04, §F-07,
  §F-08 — original findings.
- ROADMAP Phase 5 success criteria 1-5 — verified during step 11 post-submit
  smoke tests.
- Project memories: `project_eas_npm_lock`, `project_clerk_client_trust`,
  `project_android_only`.
