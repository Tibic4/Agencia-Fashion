# CriaLook — Play Store Final-Review Readiness Audit

**Scope:** `d:/Nova pasta/Agencia-Fashion/crialook-app/` — Expo SDK 54 (~54.0.34), React Native 0.81.5, **Android-only target**.
**Date:** 2026-05-03.
**Auditor mode:** GSD bootstrap — fresh codebase audit with no prior planning artifacts loaded.
**Verdict (TL;DR):** Ship-ready *with* one **Critical** fix (Jest config typo silently disables release-test mocks) and three **High** items that should be cleared before promoting from Internal Testing to Production track. The Clerk Client Trust compensating controls are sufficient *only if* the server-side checks listed in §11 are confirmed live on the backend.

Severity scale: **Critical** (block release), **High** (fix before prod track), **Medium** (fix before promotion to closed/open testing), **Low** (post-launch follow-up).

---

## Executive summary

| # | Finding | Severity | Area |
|---|---------|----------|------|
| F-01 | `jest.config.js` uses non-existent key `setupFilesAfterEach` → `jest.setup.ts` mocks never load | **Critical** | Tests / release confidence |
| F-02 | `assetlinks.json` SHA-256 fingerprint is the placeholder `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` | **High** | Deep links / Play integrity |
| F-03 | Sentry DSN (`EXPO_PUBLIC_SENTRY_DSN`) is **not** set in any `eas.json` build env → production builds ship with Sentry effectively disabled | **High** | Crash visibility |
| F-04 | Clerk publishable key is duplicated across 3 build profiles in `eas.json` (incl. `development`) — risk that dev/preview builds emit live billing events into production Clerk instance | **High** | Auth hygiene |
| F-05 | iOS section still wired in `app.config.ts` despite Android-only mandate (associated domains, NSUsageDescription, supportsTablet, deploymentTarget); 4 dependencies are iOS-only or web-only and bloat the bundle/build | **Medium** | Bundle hygiene / cross-platform debt |
| F-06 | `lib/legal/content.ts` (single source of truth for in-app legal screens) has `LAST_UPDATED = '27 de abril de 2026'` — must mirror site at submission time; no CI drift check exists | **Medium** | Privacy policy alignment |
| F-07 | `expo-notifications` is registered without declaring `POST_NOTIFICATIONS` permission in `app.config.ts` android.permissions; relies on Expo plugin defaults — verify against AAB before submitting | **Medium** | Permissions / SDK 33+ runtime prompt |
| F-08 | `react-native-iap` declares billing intent transitively but `com.android.vending.BILLING` is not visible in `app.config.ts` — confirm autolinking adds it (Play Console rejects subscriptions otherwise) | **Medium** | Billing manifest |
| F-09 | Splash screen safety net hides splash after 12s unconditionally — could mask init errors in release where `__DEV__ === false` and the user lands on a blank fade-in if AuthGate stays unready | **Medium** | Runtime stability |
| F-10 | `TabErrorBoundary.tsx:69` deliberately leaks `error.message` in release ("until SENTRY_DSN entra no eas.json"). With Sentry off in prod (F-03), users see raw error messages on tab crashes | **Medium** | Stability + UX + info disclosure |
| F-11 | Long-press delete UX gap (TASKS.md item, confirmed): `onDelete` wired through `ModeloScreen → ModelGridCard` (modelo.tsx:467, 749) with no UI trigger; `ModelBottomSheet` has no delete button either | **Medium** | UX completeness |
| F-12 | Storybook × Vite peer-dep conflict (TASKS.md): `vite@^6.4.2` (devDep) vs `@storybook/react-vite@8.6.18` peer (vite 4–6); installed via `--legacy-peer-deps`. Does NOT affect AAB build but blocks any visual regression workflow | **Low** | Dev tooling |
| F-13 | `play-store-key.json` and `credentials.json` (with plaintext keystore passwords) are present on disk and **correctly gitignored**, never committed to history — flagged as informational, not a finding | Info | Secrets posture |
| F-14 | `app.config.ts` `runtimeVersion: { policy: 'appVersion' }` + `updates: { enabled: false }` — OTA off is intentional; no concern | Info | OTA |
| F-15 | `appVersionSource: "remote"` in `eas.json` + `autoIncrement: true` in production profile — version code managed by EAS server-side. Solid | Info | Build reproducibility |

---

## 1. Play Store policy compliance

### Privacy policy URL
- `app.config.ts:255` — `privacyPolicyUrl: 'https://crialook.com.br/privacidade'` ✓
- `store-assets/PLAY_STORE_LISTING.md:57` — same URL, post-typo-fix per TASKS.md ✓
- In-app legal pages (`app/(legal)/privacidade.tsx`, `termos.tsx`, `dpo.tsx`, `subprocessadores.tsx`, `consentimento-biometrico.tsx`) all render from `lib/legal/content.ts` (284 lines, last updated 2026-04-27 per `LAST_UPDATED` constant on line 11).

**F-06 (Medium):** The in-app legal content is a copy of the public site; the comment block at the top of `lib/legal/content.ts:5-7` admits drift risk and mentions a "quarterly review or hook a CI check that flags drift" — **neither exists**. Before submission, manually diff against `https://crialook.com.br/privacidade` and `…/termos` to confirm parity. Required by Google Play Developer Program Policies (User Data — disclosure must match in-app and policy URL).

**Remediation:** Either (a) add a build-time `scripts/check-legal-drift.js` that fetches the public URLs and diffs against `lib/legal/content.ts` (fail CI on diff), or (b) refactor to pull legal text from `https://crialook.com.br/api/legal` at runtime with offline cache. Option (a) is faster.

### Data safety form alignment
- The app collects: email (Clerk), photos (camera + photo library), push tokens (Expo), IAP purchase tokens (react-native-iap), error telemetry (Sentry, when configured).
- `app.config.ts:107-114` `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` are iOS-only — for Play Store data safety form you must declare camera and photo access categories independently. No per-permission description is required in Android manifest, but the Play Console form needs:
  - **Photos and videos** → User-provided + processed in cloud + shared with third-party AI providers (Gemini/etc — confirm with backend team)
  - **Personal info → email** → Account management only
  - **App activity → in-app actions** → Sentry telemetry, only if user opts in (currently always-on when DSN present — see F-03)
  - **Financial info → purchase history** → Play Billing handles this; declare under "purchases" not "financial info"

**Action:** Cross-check the Play Console "Data safety" form against the categories above before submission; the in-app `privacidade` text needs to match item-for-item.

### Target SDK level
- `app.config.ts:208-210`: `compileSdkVersion: 35`, `targetSdkVersion: 35`, `minSdkVersion: 24`. Google Play requires targetSdk ≥ 34 by Aug 2024 / ≥ 35 from Aug 2025 for new submissions. ✓ Compliant.
- `minSdkVersion: 24` (Android 7.0 Nougat) is conservative and fine — covers ~97% of active devices.

### Permissions (declared)
`app.config.ts:136-144`:
```
permissions:
  - android.permission.VIBRATE       (haptics)
  - android.permission.CAMERA        (peça photo capture)
blockedPermissions:
  - RECEIVE_BOOT_COMPLETED
  - READ_EXTERNAL_STORAGE
  - WRITE_EXTERNAL_STORAGE
```

**F-07 (Medium):** `expo-notifications` is in plugins (`app.config.ts:189-195`) but `POST_NOTIFICATIONS` (Android 13+ runtime permission) is **not in the explicit `permissions` array**. Expo's plugin should auto-merge it into the generated AndroidManifest.xml during prebuild; **verify by inspecting the AAB manifest** (`bundletool dump manifest --bundle=app.aab | grep POST_NOTIFICATIONS`) before promoting to production. If missing, devices on Android 13+ will silently drop all push notifications — and the app's notification opt-in flow (`lib/pushOptInGate.ts`, called from resultado.tsx per `app/_layout.tsx:160-188`) will silently no-op.

**F-08 (Medium):** `com.android.vending.BILLING` is required for any IAP. `react-native-iap` autolinking should inject this into the manifest; verify the same way as F-07. If missing, Play Console rejects the AAB during upload validation.

**Photos (`expo-media-library`, `expo-image-picker`):** These plugins handle the modern Android 14 partial-photo-access permissions automatically; trust the plugin defaults but verify post-build.

### Content rating
`store-assets/PLAY_STORE_LISTING.md:60` declares "Todos (sem conteúdo restrito)". Given the app generates fashion model imagery via AI:
- **Risk:** If users upload garments and the AI pipeline generates suggestive imagery (lingerie, swimwear), the IARC questionnaire answer for "sexual content" may need revision. Current backend prompt was hardened (commit `258380b` — "fix(ai/prompt): replace body-transformation examples with look-only language") which suggests this was a real concern.
- **Action:** Confirm the IARC questionnaire answers honestly. If swimwear/lingerie is even *possible* output, change rating to "Classificação 12" or add a content advisory. Misrepresenting content rating is a hard policy violation.

---

## 2. Bundle / build hygiene

### eas.json profiles
`eas.json` has `development`, `preview`, `production`. Production targets `app-bundle` (AAB ✓), preview/dev are APK for sideload distribution.
- `appVersionSource: "remote"` ✓ — version code managed server-side, no merge conflicts on `versionCode`.
- `production.autoIncrement: true` ✓ — every prod build gets a fresh version code.
- `production.submit.android.serviceAccountKeyPath: "./play-store-key.json"` — this file exists on disk (2412 bytes, present per `ls`), correctly gitignored (`.gitignore:30`).
- `production.submit.android.releaseStatus: "draft"` ✓ — defensive default; you must manually promote in Play Console.
- `production.submit.android.track: "internal"` ✓ — first push always lands on Internal Testing track.

### Signing keys
- `credentials.json` (`crialook-app/credentials.json`) contains plaintext `keystorePassword`, `keyAlias`, `keyPassword`. **F-13:** correctly gitignored (`.gitignore:32-37`) and **never committed** (verified via `git log --all --full-history -- credentials.json credentials/ play-store-key.json` returns empty; `git ls-tree -r HEAD --name-only | grep -i credential` returns only `store-assets/play-store-icon-*.png`).
- `credentials/android/keystore.jks` (2191 bytes) on disk — also gitignored (`*.jks` in `.gitignore:18`).
- **However** these files sit unencrypted in the working tree. If the dev workstation is shared or backed up to consumer cloud (OneDrive/Google Drive sync), the keystore + password leaks. Recommend storing in a password manager + EAS-managed credentials (run `eas credentials -p android` and let EAS store them server-side; remove local copies).

### ProGuard / R8
`app.config.ts:212-214`:
```
enableProguardInReleaseBuilds: true
enableShrinkResourcesInReleaseBuilds: true
enableMinifyInReleaseBuilds: true
```
All three on. ✓ Bundle size will be appreciably smaller and reverse-engineering harder. No custom `proguard-rules.pro` visible — Expo's default rules cover Hermes + RN reflection. Validate by attempting a release build and watching for missing-class crashes (e.g., Sentry, Reanimated).

### Bundle size
Cannot measure without producing an AAB, but `package.json` carries:
- `@shopify/react-native-skia ^2.2.12` — heavy native (~3-5MB AAR)
- `react-native-iap ^14.7.20`
- `@sentry/react-native 7.13.0`
- `expo-image`, `expo-image-manipulator`, `expo-image-picker`, `expo-media-library`, `expo-camera` (image stack ≈ 2MB)
- `react-native-mmkv ^3.2.0`
- `react-native-reanimated ~4.1.1`

Estimated AAB will be ~25-35MB, well under Play Store's 200MB single-AAB ceiling. App Bundle splits per ABI/density should land sub-25MB per device install.

### Excluded autolinking
`package.json:113-118` excludes `@solana-mobile/mobile-wallet-adapter-protocol` (transitive via `@clerk/clerk-js`). Good call — saves Kotlin compile time and removes an unused permission surface.

---

## 3. Runtime stability

### Sentry init
`lib/sentry.ts:5,16-94` — Sentry is initialized at module-scope from `app/_layout.tsx:42` (`initSentry()`), enabled when `!__DEV__` and DSN present. Session Replay defensively disabled in 3 layers (sample rates 0 + integrations filter + plugin note). Solid posture for a known-bad bug surface (the 51s freeze on AAB boot).

**F-03 (High):** `EXPO_PUBLIC_SENTRY_DSN` is **not declared** in any of the three build profiles in `eas.json` (only `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` appear). `lib/sentry.ts:16-18`:
```
export function initSentry() {
  if (initialized) return;
  if (!DSN) return;     // <-- silently no-ops in production
```
Result: production AAB ships with **zero crash reporting**. The `componentDidCatch` paths in `ErrorBoundary.tsx:34-48` and `TabErrorBoundary.tsx:38-50` swallow errors locally with no telemetry escape. You will be flying blind on the first ~thousand installs.

The `package.json` `_lock_warning` exists for npm 10 but no equivalent guard for "Sentry DSN missing in production build." Add `extra` or build-time validation.

**Remediation:** Add to `eas.json` production profile:
```json
"env": {
  ...
  "EXPO_PUBLIC_SENTRY_DSN": "https://<your-public-key>@o<org>.ingest.sentry.io/<project-id>"
}
```
The DSN is *public* (it's literally in the bundle anyway); the secret is `SENTRY_AUTH_TOKEN` which uploads source maps and is read from the EAS environment, not committed. Confirmed via `app.config.ts:238`.

### Splash screen + cold-start
`app/_layout.tsx:62-73`: SplashScreen prevented from auto-hide; safety-net `setTimeout` forces hide after 12s.
**F-09 (Medium):** The 12s safety hide is unconditional. If `useFonts` hangs (Google Fonts CDN flake), `appReady` stays false, `<AppFadeIn ready={false}>` returns `null`, splash hides at 12s, user sees a blank screen colored fucsia (`backgroundColor: Colors.brand.primary` set on `GestureHandlerRootView` at line 294) with no recovery UI. The `AppErrorBoundary` doesn't catch font load failures because `useEffect(() => { if (error) throw error; }, [error])` (line 278-280) throws into React, which the boundary will catch — but only *after* the font promise rejects. If it never rejects (timeout-less hang), the app is bricked.

**Remediation:** Add a font-load timeout via `Promise.race([useFonts promise, timeout(8000)])` or add an explicit "Recarregar" button in the `AppFadeIn` component when `ready={false}` for >10s.

### AuthGate timeouts
`lib/auth.tsx:43` `INIT_TIMEOUT_MS = 6_000` — well-thought-out fallback for Clerk hydration delays (especially relevant with Client Trust off, see §11). The escape hatch routes to `/sign-in` if `!isSignedIn`. Solid.

### Error boundaries
- `AppErrorBoundary` (root) — full-screen recovery with Sentry capture, "Tentar de novo", and email-to-support deep link with the Sentry event ID. Excellent UX. ✓
- `TabErrorBoundary` — per-tab isolation; one bad tab doesn't black out the app. ✓
- **F-10 (Medium):** `TabErrorBoundary.tsx:67-75` deliberately leaks `error.message` in release builds with the comment "Reverter pra `__DEV__` depois que o EXPO_PUBLIC_SENTRY_DSN entrar no eas.json." This is a stale workaround. Combined with **F-03**, users will see raw exception messages (potentially containing API paths, stack info, internal terminology) on every tab crash. Information disclosure + bad UX.
   - **Remediation:** wrap the `<Text>` in `{__DEV__ && (…)}` once F-03 is fixed.

### Crash-free session expectations
With F-03 unfixed: 0% crash visibility. With F-03 fixed and `tracesSampleRate: 0.2` baseline (overridden to `1.0` for billing/generation, `0.5` for high-value screens via `tracesSampler`), expect ~99.5%+ crash-free sessions to be measurable post-launch. Set up a Slack alert on session crash-free dropping below 99% before launching.

---

## 4. Auth flow with Client Trust OFF — compensating controls

**Pinned context:** Clerk Client Trust is intentionally disabled to pass Play Store review (per `MEMORY.md` and the inline comment block in `lib/auth.tsx:38-43`).

### What Client Trust *is* (background)
Clerk's "Client Trust" (Sessions → Token settings) lets the SDK trust client-claimed session state for fast-path UX (e.g., emit `getToken()` synchronously from cache without round-tripping). With it OFF, every `getToken()` may need to hit Clerk's API to confirm session validity, adding 100-400ms.

### What guarantees still hold
1. **JWT signature validation** — every JWT remains signed by Clerk's JWKS. Backend (`crialook.com.br/api`) MUST validate the JWT signature on every request. This is unaffected by Client Trust.
2. **Token expiry** — Clerk tokens are still ~60s TTL. In-memory `jwtCache` (lib/auth.tsx:117-135) stores them for 30s. Even on stale cache, the backend rejects expired tokens.
3. **Identity claim** — `sub` claim in the JWT is the Clerk user ID. Cannot be forged without Clerk's private key.

### What attack surface OPENS with Client Trust OFF
1. **Slow boot under Clerk API outage** — if Clerk's API is down or slow, `getToken()` in `lib/api.ts:51` blocks every API call until timeout. Mitigated by the 6s init timeout (`auth.tsx:43`) and the 60s default per-request timeout (`api.ts:11`).
2. **More aggressive token refresh on the wire** — increases observable login traffic; not a security issue per se but can mask attack patterns.
3. **No new attack surface for an attacker holding a stolen device** — the threat model is unchanged. Client Trust is fundamentally a UX/perf tradeoff, not a security boundary.

### Smallest set of server-side compensating checks (REQUIRED — confirm these exist in `campanha-ia` backend)
These are NOT in `crialook-app` — they're in the backend `crialook.com.br/api`. Confirm with the API team:

1. **Strict JWT validation on every request** — verify signature against Clerk JWKS, check `iss`, `aud`, `exp`, `nbf`. Reject on any mismatch with HTTP 401.
2. **Per-user rate limiting on `/billing/verify` and `/billing/restore`** — prevents replay of leaked purchase tokens. Critical because the app trusts the server to verify (`lib/billing.ts:128-131`).
3. **Hash-bound purchase verification** — backend MUST check `obfuscatedAccountIdAndroid` from Google Play === SHA256(currentClerkUserId).slice(0,64) (`lib/billing.ts:82-89` produces it; backend must validate). Without this, a captured `purchaseToken` can be replayed by another user. The app does its half; confirm backend does its half.
4. **Per-user generation quota enforcement server-side** — frontend shows quota UI but the source of truth is the backend; the JWT `sub` is the only trustworthy identity claim.
5. **No client-emittable plan/tier flags** — the user's plan tier must be derived from `/billing/verify` results stored server-side, never from client-supplied JSON. (Inspect `apiGet('/store')` response shape in `app/_layout.tsx:140-148` — confirm the backend doesn't accept tier overrides via PATCH from the client.)
6. **Push-token replay protection** — `apiPost('/store/push-token', { token })` (in `_layout.tsx:184` and `auth.tsx:65`) MUST be tied to the JWT user ID server-side; never accept tokens without auth.
7. **Webhook signature on Clerk webhooks** — backend creates store-shadow on Clerk user.created webhook; webhook MUST validate Svix signature, otherwise an attacker can forge "user created" events.

### Re-enable Clerk Client Trust plan

(See dedicated section at the bottom of this document.)

---

## 5. Network security

### Cleartext traffic
- No `usesCleartextTraffic` flag in `app.config.ts`. Expo SDK 54 default for Android is **`android:usesCleartextTraffic="false"`** in the generated manifest. ✓
- Grep for `http://` in `lib/`, `app/`, `hooks/`, `components/`: zero hits in source. ✓
- `BASE_URL` from `EXPO_PUBLIC_API_URL` env, set to `https://crialook.com.br/api` in all 3 EAS profiles (`eas.json:16,29,42`). ✓

### Certificate pinning
- **None implemented.** `lib/api.ts:81` uses bare `fetch` with no pin. For a fashion-marketing app this is acceptable — pinning adds operational risk (cert rotation breaking the app) without commensurate threat reduction. Document this decision; revisit if you handle bank-grade financial data later. (Play Billing handles its own cert pinning natively.)

### Deep link validation
- `app.config.ts:145-159`: intent filter for `https://crialook.com.br/campaign/*` with `autoVerify: true`, plus the custom scheme.
- `_layout.tsx:75-79` validates incoming `campaignId` against a strict UUID regex before routing — prevents arbitrary route injection via crafted deep link. ✓
- **F-02 (High):** `store-assets/assetlinks.json` contains literal `"REPLACE_WITH_PLAY_APP_SIGNING_SHA256"`. Until the real fingerprint is populated AND the file is served from `https://crialook.com.br/.well-known/assetlinks.json`, `autoVerify` will fail and the app will fall back to the "Open with…" picker. This is also a Play Console verification check — fix before promoting from internal testing.
   - **Remediation:** follow `store-assets/README_ASSETLINKS.md`. Run `eas credentials -p android` after the first production build, copy SHA-256 from "App signing key" (NOT upload key), populate `assetlinks.json`, deploy to the website's `.well-known` path, validate via the `digitalassetlinks.googleapis.com` URL in the README.

### API base URL hardening
- Single source of truth: `EXPO_PUBLIC_API_URL` env. Values consistent across all 3 build profiles in `eas.json`. ✓
- Bang assertion (`process.env.EXPO_PUBLIC_API_URL!` in `lib/api.ts:9`) means a missing env crashes at module load — fail-fast behavior. ✓
- No runtime override mechanism — good (otherwise an attacker could pivot the app to a malicious API via deep link).

---

## 6. Permissions and exported activities

### Declared permissions (re-state from §1)
`app.config.ts:136-144`:
- `VIBRATE` — justified by `lib/haptics.ts`.
- `CAMERA` — justified by `expo-camera` plugin and `components/CameraCaptureModal.tsx`.

### Blocked permissions (good defensive choice)
- `RECEIVE_BOOT_COMPLETED` — explicitly blocked. Required if you plan to schedule notifications surviving reboot via `expo-notifications`. **Currently `lib/notifications.ts` only schedules `TIME_INTERVAL` triggers (line 95) which are *not* persisted across reboot anyway**, so blocking is correct. If you ever add `Notifications.scheduleNotificationAsync` with `DATE` triggers more than 24h out, this will silently drop on reboot.
- `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` — correctly blocked. Modern Android (13+) uses scoped storage and the photo picker doesn't need these. Removing them is good Play Store hygiene (avoids "sensitive permission" review prompts).

### Exported activities
- Generated by Expo prebuild — no custom `<activity android:exported="true">` overrides visible. Expo's defaults declare the main launcher activity exported (required) and nothing else.
- The intent filter at `app.config.ts:145-159` for `crialook.com.br/campaign` and the custom scheme implies an exported activity (deep link target). This is necessary; the deep link handler validates UUID before routing (see §5).

### Notification permission (Android 13+)
Already covered in **F-07**. `POST_NOTIFICATIONS` not in explicit permissions list; depends on `expo-notifications` plugin auto-injection.

---

## 7. Secrets and key material

### Bundled in the APK/AAB
What's compiled into the JS bundle (anything readable via `apktool` + `hermes-decompiler`):
- `EXPO_PUBLIC_API_URL` = `https://crialook.com.br/api` — public ✓
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_Y2xlcmsuY3JpYWxvb2suY29tLmJyJA` — **publishable, designed to be public** ✓
- `EXPO_PUBLIC_SENTRY_DSN` — would be public if set (DSN is bundle-safe by design); currently unset in eas.json (F-03)
- EAS project ID `4a513aba-203b-443d-8602-9b5c0bbad9c9` (`app.config.ts:254`) — public, used for push token registration ✓

### Confirmed NOT in the bundle (good)
Grep for `SUPABASE`, `SERVICE_ROLE`, `service_role`, `supabase_service`, `GEMINI_API`, `ANTHROPIC`, `OPENAI_API`, `REPLICATE` across `crialook-app/`: **zero hits in source** (only matches in `package-lock.json` for Expo's `code-signing-certificates` package and `assetlinks.json` README). ✓ The app is a pure thin client; all AI provider keys live server-side.

### Local secrets (not bundled, not committed)
- `crialook-app/.env` (169 bytes, present, gitignored via `.gitignore:25-26`)
- `crialook-app/credentials.json` (plaintext keystore passwords, gitignored `.gitignore:33`)
- `crialook-app/credentials/android/keystore.jks` (2191 bytes, gitignored `*.jks` line 18)
- `crialook-app/play-store-key.json` (Google service account, gitignored line 30)
- Verified via `git log --all --full-history -- credentials.json credentials/ play-store-key.json` (no commits) and `git ls-tree -r HEAD --name-only | grep -i 'credential\|keystore\|play-store-key\|\.jks\|\.p12'` (only PNG icons match).
- **F-13 (Info, not a finding):** Posture is good. Recommend offloading to EAS-managed credentials (`eas credentials -p android` → "Migrate to EAS"); after migration, delete local copies.

### Secrets ALWAYS missing from eas.json (correct posture)
- `SENTRY_AUTH_TOKEN` is read from EAS environment at build time (per `app.config.ts:238` note), not committed. ✓
- `SENTRY_ORG`, `SENTRY_PROJECT` likewise. ✓
- `SENTRY_DISABLE_AUTO_UPLOAD: "true"` set in all 3 profiles in `eas.json:18,31,44` — this means the source-map upload step is OFF for now. Combined with F-03 (no DSN), Sentry is fully non-operational in production. Both of these need to be addressed together.

---

## 8. Build reproducibility

### npm 10 lock state
- `package.json:5` — `_lock_warning` documents npm 10 requirement.
- `scripts/preinstall-guard.js` — actively blocks `npm install` from npm 11+ (`process.exit(1)` with helpful message). Solid defensive hook. ✓
- `package.json:14` — `lock:fix` regenerates lockfile via `npx --yes npm@10 install --legacy-peer-deps`. ✓
- `package-lock.json` last modified 2026-04-30 — recent and presumably in npm 10 format.

### EAS channels
- 3 channels: `development`, `preview`, `production`. Aligned 1:1 with the `APP_VARIANT` env values in `app.config.ts:23`. ✓
- `runtimeVersion: { policy: 'appVersion' }` — runtime version === app version. OTA disabled (`updates.enabled: false`), so this is a no-op until OTA is wired (`app.config.ts:243-250` documents the religar plan).

### Version codes
- `appVersionSource: "remote"` — managed by EAS server (no merge conflicts).
- `production.autoIncrement: true` — increments per build. ✓
- `app.config.ts:80` — `version: '1.0.0'` (versionName). For Play Store, you can leave this manual; bump on user-visible feature releases.

### Can a clean checkout build green?
Required steps:
1. Install npm 10: `npm install -g npm@10` (or rely on `lock:fix`).
2. `cd crialook-app && npm ci --legacy-peer-deps` (uses existing lockfile, no regeneration).
3. Place `.env` with the 3 `EXPO_PUBLIC_*` vars (or rely on EAS env).
4. `eas build --profile production --platform android` — requires EAS credentials (keystore, service account) configured server-side OR locally via `credentials.json` + `play-store-key.json`.

**Assumption to verify:** Without running it, I can't promise a green build. Risks:
- React 19.1.0 + RN 0.81.5 + Skia 2.x + Reanimated 4.x + Sentry 7.13 is a *recent* combo. The `package.json` `_install_exclude_reason` documents real prior pain (Sentry 7.2 freeze, Storybook peers pulling React 19.x mismatches). The `--legacy-peer-deps` flag papers over remaining peer warnings.
- `peer-deps` could escape if any sub-dep has a hard runtime React mismatch — the `overrides` block (`package.json:120-123`) pins `react`/`react-dom` to 19.1.0, mitigating most cases.
- Native module gotchas (Skia, MMKV, Reanimated) are usually fine on Expo SDK 54 with `newArchEnabled: true`.

**Recommendation:** Before submission, do a clean-room build: fresh clone → `npm ci --legacy-peer-deps` → `eas build --profile production --platform android` → install AAB on a test device and run smoke tests for: launch, sign-in (Google SSO), create model, generate, view result, open paywall, attempt purchase (test track).

---

## 9. Test coverage of release-critical paths

### Test infrastructure
Two parallel test runners:
- **Vitest** (`vitest.config.ts`, `vitest.setup.ts`) — for pure logic in `lib/__tests__/`, `hooks/__tests__/`. jsdom-based, fast.
- **Jest** (`jest.config.js`, `jest.setup.ts`) — for RN component tests in `__tests__/`. Uses `jest-expo` preset.

### F-01 — CRITICAL: Jest config typo
`jest.config.js:18`:
```js
setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
```
**This is not a valid Jest config key.** Verified against `node_modules/jest-config/build/Descriptions.js:170-171` — the valid keys are `setupFiles` and `setupFilesAfterEnv`. There is no `setupFilesAfterEach`.

**Consequence:** The mocks defined in `jest.setup.ts` for `expo-secure-store`, `react-native-mmkv`, `expo-router`, `@clerk/clerk-expo`, plus the `react-native-gesture-handler/jestSetup` import and `react-native-reanimated` mock, are **never loaded**. Jest will silently:
- Try to resolve `expo-secure-store` → real module → fail to load native module → test silently passes or crashes incomprehensibly.
- Skip the Clerk mock → `useUser()` returns undefined → tests using Clerk fail.

The single Jest test file `__tests__/example-pulsing-badge.test.tsx` likely either:
(a) Doesn't exercise the un-mocked surfaces, so it accidentally passes.
(b) Was failing all along and nobody noticed.

Either way, **the test suite provides false safety**. Run `npm run test:rn` and observe:
- Either green (false positive — change the typo and watch it explode).
- Or red since who-knows-when (and CI was probably ignoring it).

**Remediation:**
```js
// jest.config.js
setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
```
Then re-run `npm run test:rn` and fix any tests that break.

### Test coverage by release-critical flow

| Flow | Covered? | Where |
|------|---------|-------|
| Auth: Clerk sign-in / sign-out | **No** | No tests for `lib/auth.tsx` |
| API client: error classification | Yes | `lib/__tests__/api.classify.test.ts` |
| API client: regenerate campaign | Yes | `lib/__tests__/api.regenerateCampaign.test.ts` |
| API client: 401 retry / token refresh | **No** | Path exists in `lib/api.ts:178-183`, untested |
| Billing: purchase flow | **No** | `lib/billing.ts` has zero tests |
| Billing: purchase token verification (server side) | N/A | Backend concern |
| Push notifications: registration + token sync | **No** | No tests |
| Deep links: campaignId UUID validation | **No** | `_layout.tsx:75-79`, untested |
| Splash + AuthGate routing | **No** | `_layout.tsx`, untested |
| Camera capture modal | **No** | `CameraCaptureModal.tsx`, untested |
| Image picker slot | Yes | `hooks/__tests__/useImagePickerSlot.test.ts` |
| Model selector | Yes | `hooks/__tests__/useModelSelector.test.tsx` |
| Campaign polling | Yes | `hooks/__tests__/useCampaignPolling.test.ts` |
| Logger | Yes | `lib/__tests__/logger.test.ts` |
| i18n lookups | Yes | `lib/__tests__/i18n.lookup.test.ts` |
| Review gate | Yes | `lib/__tests__/reviewGate.spec.ts` |
| Error boundaries | **No** | `ErrorBoundary.tsx`, `TabErrorBoundary.tsx`, untested |

**Gap analysis:** Auth, billing, push, deep-link safety, error boundaries — all release-critical, all uncovered. **Billing** is the highest-value gap (revenue-on-the-line + replay-attack surface). Add at minimum:
- `lib/__tests__/billing.test.ts` — verify `obfuscatedAccountIdAndroid` is computed correctly from `getCurrentUserId()` (mocked) and is included in `requestPurchase`.
- `lib/__tests__/auth.test.ts` — verify the JWT cache TTL (30s), the 401-retry path, `clearAuthTokenCache()` on signOut.

---

## 10. Open TASKS.md items that are release-blocking

### F-12 — Storybook × Vite peer-dep conflict (Low for release; High for dev tooling)
`crialook-app/package.json:101` declares `vite ^6.4.2`. `@storybook/react-vite ^8.6.18` (line 86) requires Vite 4–6 per the conflict described in TASKS.md (note: peer is satisfied by Vite 6, so the conflict may have been *resolved* by the upgrade to vite 6.4.2 — the original TASKS.md note mentioned `vite@^8.0.10` which is now `^6.4.2`). **This may already be fixed.** Confirm by running `npm run storybook:dev` on a fresh checkout and seeing if it boots. If broken: option (a) downgrade Vite to ≤6.x (already done?), (b) bump `@storybook/react-vite` to 9.x, (c) drop Storybook from the AAB project entirely (it's dev-only, doesn't ship). Option (c) is cleanest if you have a separate design-system package planned.

### F-11 — Long-press delete UX gap (Medium)
Confirmed via grep:
- `app/(tabs)/modelo.tsx:467,749` — `onDelete` is wired through but the comment block at 745-749 explicitly says "Delete é exposto via prop, mas não está cabeado a um gesto neste card — long-press fica reservado pro peek preview (paridade com /gerar). O delete vive na ModelBottomSheet (botão dedicado quando aplicável)."
- Grep `delete|trash|excluir|onDelete` in `components/ModelBottomSheet.tsx` returns zero hits. **The delete button is not in the bottom sheet either.**

**Consequence:** Users can create models but **cannot delete them** through the UI. The `handleDelete` function exists, the API endpoint presumably works, but no surface invokes it. This is not a Play Store rejection criterion (Play doesn't require delete UX for ML model artifacts) but is a **GDPR/LGPD risk** if the model represents user-uploaded face data — the user must have a way to delete derived data on demand. Combined with the photo upload flow, this could push you into "User Data" violation territory if a reviewer checks the consent flow carefully.

**Remediation (per TASKS.md suggestion):** Add a small trash icon button to `ModelBottomSheet` peek view, OR add a "..." context menu on `ModelGridCard` (separate from long-press). The latter is more Android-native (matches Material 3 patterns).

---

## 11. Re-enable Clerk Client Trust plan

Triggered when: app is approved on Play Store production track.

### Pre-flight (before re-enabling)
1. **Confirm backend compensating controls (§4) are in place and tested.** If Client Trust is re-enabled while the backend still trusts client claims naively, you re-introduce both the perf gain AND the (already-mitigated) attack surface — but the change creates a window where regressions are easy to miss. Run a security regression suite first.
2. **Take a baseline metric** of average sign-in latency, average API call latency (P50, P95, P99), Clerk `getToken()` round-trip count per session. Use Sentry transactions or backend logs.
3. **Snapshot prod traffic patterns** — Clerk dashboard → Sessions → Hourly graph for the past 7 days. You'll need this to compare post-change.

### Enable
1. Clerk Dashboard → Sessions → Token settings → enable "Client Trust" (exact UI label may differ; confirm with Clerk docs at the time).
2. **No app code change required** — `lib/auth.tsx` and `getAuthToken()` remain identical; the Clerk SDK adapts to the dashboard setting transparently.
3. The 30s `jwtCache` in `auth.tsx:117-135` continues to provide additional client-side caching on top of Clerk's now-trusted client state.

### Post-enable monitoring (first 72h)
1. **Sentry alert: spike in 401 responses** — if Client Trust mis-aligns client and server views of session validity, you'll see 401s. Threshold: > 0.5% of authed requests.
2. **Sentry alert: spike in `signOut` events** — bad token state can trigger forced sign-outs.
3. **Performance:** confirm avg `getToken()` round-trips per session drops by ~60-80% (the whole point).
4. **Cold start: confirm auth init time drops by 1-2s.** If Clerk hydration was previously round-tripping on each cold start, this should be visible.
5. **Compare crash-free rate**: should be unchanged. If it drops, roll back immediately.

### Knobs to consider after re-enable
1. **Reduce `INIT_TIMEOUT_MS` in `lib/auth.tsx:43` from 6000 → 3000ms** — with Client Trust on, hydration is fast enough that a 6s tolerance is excessive. Faster timeout = faster recovery on flake.
2. **Reduce `TOKEN_TTL_MS` in `lib/auth.tsx:118` from 30s → 15s** — Clerk's trusted client refresh is cheap, so caching aggressively is less valuable. Reduces stale-token risk.

### Rollback plan
If anything goes wrong:
1. Clerk Dashboard → toggle Client Trust OFF.
2. **No app deploy needed.** App reads dashboard state.
3. Update `MEMORY.md` `project_clerk_client_trust.md` with rollback rationale.

### Memory updates
1. Update `project_clerk_client_trust.md` to record:
   - Date of re-enable.
   - Observed metric deltas (latency, 401 rate).
   - Outcome (kept on / rolled back).
2. Remove the inline comment block in `lib/auth.tsx:38-43` (or shorten it to a one-liner pointing to the memory file).
3. Optionally remove the comment in `_layout.tsx:25-31` about Sentry session replay — independent of Client Trust but the codebase has accumulated these "why this defensive setup exists" comments that read as noise once the underlying issue is gone.

### What does NOT need to change
- The 401-retry-once path in `lib/api.ts:178-183` stays useful regardless — it handles any short-lived token desync.
- The in-memory `jwtCache` stays — it's an orthogonal optimization (in-process only) and continues to reduce SDK calls inside a single render cycle.
- Backend JWT signature validation, `obfuscatedAccountIdAndroid` enforcement, and rate limits stay (they were never optional).

---

## Appendix A — Files referenced

### Configuration
- `crialook-app/app.config.ts` (full)
- `crialook-app/eas.json` (full)
- `crialook-app/package.json` (full)
- `crialook-app/babel.config.js`
- `crialook-app/jest.config.js` (F-01)
- `crialook-app/jest.setup.ts`
- `crialook-app/.gitignore`
- `crialook-app/.env.example`
- `crialook-app/scripts/preinstall-guard.js`

### Core runtime
- `crialook-app/app/_layout.tsx` (Sentry init, AuthGate, splash, push handler)
- `crialook-app/lib/auth.tsx` (Clerk wrapper, token cache)
- `crialook-app/lib/api.ts` (HTTP client, 401-retry, dedup)
- `crialook-app/lib/sentry.ts` (Sentry init, PII redaction, sampler)
- `crialook-app/lib/billing.ts` (IAP flow, hash binding)
- `crialook-app/lib/notifications.ts` (push registration, channels)
- `crialook-app/components/ErrorBoundary.tsx` (root boundary)
- `crialook-app/components/TabErrorBoundary.tsx` (tab boundary, F-10)

### Permissions / store
- `crialook-app/store-assets/PLAY_STORE_LISTING.md`
- `crialook-app/store-assets/assetlinks.json` (F-02)
- `crialook-app/store-assets/README_ASSETLINKS.md`

### UX gap evidence (F-11)
- `crialook-app/app/(tabs)/modelo.tsx:440-815` (ModeloScreen + ModelGridCard, comment block at 745-749 confirms missing UI)
- `crialook-app/components/ModelBottomSheet.tsx` (no delete button)

### Tests
- `crialook-app/__tests__/example-pulsing-badge.test.tsx` (only RN test)
- `crialook-app/lib/__tests__/*.test.ts` (5 files, vitest)
- `crialook-app/hooks/__tests__/*.test.{ts,tsx}` (3 files, vitest)

### Secrets posture (F-13)
- `crialook-app/credentials.json` (gitignored, plaintext keystore passwords)
- `crialook-app/credentials/android/keystore.jks` (gitignored)
- `crialook-app/play-store-key.json` (gitignored)
- `crialook-app/.env` (gitignored)
- `git log --all --full-history` for these paths returns empty — never committed.

---

## Appendix B — Pre-submission checklist (in order)

1. [ ] **F-01** Fix `jest.config.js` `setupFilesAfterEach` → `setupFilesAfterEnv`. Re-run `npm run test:rn`. Fix any tests that now fail (they were silently broken).
2. [ ] **F-02** Run first `eas build --profile production --platform android`. Pull SHA-256 from `eas credentials -p android`. Populate `store-assets/assetlinks.json`. Deploy to `https://crialook.com.br/.well-known/assetlinks.json`. Validate via Google's digital-asset-links API URL in the README.
3. [ ] **F-03** Add `EXPO_PUBLIC_SENTRY_DSN` to `eas.json` production (and ideally preview) profile env. Set `SENTRY_DISABLE_AUTO_UPLOAD: "false"` once `SENTRY_AUTH_TOKEN` is configured in EAS server env. Verify a deliberate `throw` in DEV captures in Sentry.
4. [ ] **F-04** Provision separate Clerk instances or at minimum separate publishable keys for development / preview / production. Update `eas.json` accordingly. Document rotation policy.
5. [ ] **F-07 / F-08** After running step 2's first AAB, dump manifest with `bundletool dump manifest --bundle=app.aab > manifest.xml` and grep for `POST_NOTIFICATIONS` and `com.android.vending.BILLING`. If missing, add to `app.config.ts.android.permissions`.
6. [ ] **F-10** Wrap `TabErrorBoundary.tsx:67-75` `error.message` display in `{__DEV__ && (…)}` once F-03 is confirmed working.
7. [ ] **F-11** Add a delete button to `ModelBottomSheet` peek view OR a "..." context menu on `ModelGridCard`. Required for LGPD-clean flow with face-derived data.
8. [ ] **F-06** Manually diff `lib/legal/content.ts` against `https://crialook.com.br/{privacidade,termos,dpo}` before submission. Open a TODO to add a CI drift-check.
9. [ ] **F-09** Add a font-load timeout (8s) with explicit retry UI, OR confirm via instrumentation that `useFonts` reliably resolves on slow networks (test on a throttled-to-EDGE device).
10. [ ] **§4 / §11** Confirm with backend team that the 7 server-side compensating controls in §4 are live in `crialook.com.br/api`. Get written confirmation; ideally automated test coverage.
11. [ ] **§1** Cross-check Play Console "Data safety" form against the categories enumerated in §1. Verify content rating answer for "sexual content" given AI-generated fashion imagery.
12. [ ] **§2** Migrate keystore + service-account-JSON to EAS-managed credentials (`eas credentials -p android` → "Migrate to EAS"). Delete local copies.
13. [ ] **§8** Run a clean-room build from fresh clone to confirm reproducibility before submission.
14. [ ] Promote AAB to Internal Testing track (default per `eas.json`). Smoke test sign-in + 1 generation + 1 paywall + 1 IAP attempt (test card). Promote to Closed → Open → Production over a week.

---

## Appendix C — Deferred / informational

- **F-14 (Info):** OTA disabled — intentional, well-documented in `app.config.ts:243-250`. No action.
- **F-15 (Info):** Build version management is correct. No action.
- **iOS section in `app.config.ts` (F-05):** Android-only mandate per `MEMORY.md` `project_android_only`. The iOS block (lines 101-122) and iOS-only deps (`react-native-web`, `react-dom`, etc.) don't bloat the Android AAB significantly (tree-shaken by Metro for the Android target) but they bloat dev-time `npm ci` and add ambient cognitive load. **Defer the cleanup** until after Play Store launch — non-blocking, and removing them is a separate well-scoped refactor.

---

**End of audit.** Total findings: 11 actionable + 4 informational. **One Critical (F-01)**, three High (F-02, F-03, F-04), seven Medium, one Low.
