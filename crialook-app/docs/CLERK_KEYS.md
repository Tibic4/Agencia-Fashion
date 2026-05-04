# Clerk Publishable Keys — Per-Profile Setup & Rotation

> Phase 5 — closes F-04 (single shared `pk_live_…` Clerk key duplicated across all 3 EAS
> profiles, risking dev/preview events polluting the production Clerk instance).
> Rotation policy lives here so PLAY_RELEASE_CHECKLIST.md stays scannable.

## Why three keys

`crialook-app` ships in three flavors via the `APP_VARIANT` env, each with a distinct
Android bundle ID. A single Clerk publishable key would let dev / preview signins
emit events into the production Clerk instance dashboard — polluting analytics,
breaking impersonation testing, and (worst case) letting a developer's test session
appear in real customer audit logs.

Three Clerk applications (one per variant) gives clean isolation. The publishable
key is bundle-safe (it identifies the frontend, not a secret), so shipping it in
`eas.json` is fine — same posture as `EXPO_PUBLIC_API_URL`.

## Profiles

| EAS Profile   | `APP_VARIANT` | Bundle ID                  | Clerk key prefix | Placeholder in `eas.json`                            |
| ------------- | ------------- | -------------------------- | ---------------- | ---------------------------------------------------- |
| `development` | `development` | `com.crialook.app.dev`     | `pk_test_`       | `pk_test_PLACEHOLDER_DEV_REPLACE_BEFORE_BUILD`       |
| `preview`     | `preview`     | `com.crialook.app.preview` | `pk_test_`       | `pk_test_PLACEHOLDER_PREVIEW_REPLACE_BEFORE_BUILD`   |
| `production`  | `production`  | `com.crialook.app`         | `pk_live_`       | `pk_live_PLACEHOLDER_PROD_REPLACE_BEFORE_BUILD`      |

Mapping is enforced by `crialook-app/eas.json` `build.<profile>.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

`pk_test_` vs `pk_live_` — Clerk publishable keys carry the env in the prefix.
Owner replacement step (provisioning) MUST preserve the prefix convention so a
mis-paste between dev and prod is visually obvious.

> Note: Clerk Client Trust is currently OFF for Play Store review (see project
> memory `project_clerk_client_trust`). Re-enable runbook lives in Phase 6
> (`crialook-app/.planning/CLERK_CLIENT_TRUST_REENABLE.md`, planned, not shipped).
> Per-profile keys here are independent of the Trust toggle.

## Provisioning (Initial Setup)

One-time owner workflow before the first production AAB build.

1. **Create three Clerk applications** in the [Clerk Dashboard](https://dashboard.clerk.com/):
   - `crialook-dev` (instance type: Development) — for `com.crialook.app.dev`
   - `crialook-preview` (instance type: Development) — for `com.crialook.app.preview`
   - `crialook-prod` (instance type: Production) — for `com.crialook.app`
2. **Configure each application's allowed origins / OAuth redirects** to match the
   variant's deep-link scheme:
   - Dev: scheme `crialook-dev://`
   - Preview: scheme `crialook-preview://`
   - Prod: scheme `crialook://` and host `crialook.com.br`
3. **Capture each publishable key** from `Developers → API Keys → Publishable Key` —
   it's the `pk_test_…` (or `pk_live_…` for the production instance) starting string.
4. **Replace placeholders in `crialook-app/eas.json`** (one per profile env block):
   - `build.development.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `build.preview.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `build.production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
5. **Pre-build assertion** — confirm three distinct keys with no `PLACEHOLDER`
   substring before triggering `eas build`:

   ```bash
   node -e "
     const j=require('./crialook-app/eas.json');
     const k=[
       j.build.development.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
       j.build.preview.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
       j.build.production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
     ];
     const ok = new Set(k).size===3 && k.every(s => !s.includes('PLACEHOLDER'));
     process.exit(ok ? 0 : 1);
   "
   ```

6. **Verify post-build** — see PLAY_RELEASE_CHECKLIST.md owner step where you sign
   in with each variant on a device and confirm Clerk Dashboard shows the event
   on the matching instance (dev event in `crialook-dev`, prod event in
   `crialook-prod`, etc.).

## Rotation

When and how to rotate publishable keys.

### When to rotate

- **Annually** — first business day of January (calendar reminder; not enforced
  by code).
- **On suspected compromise** — any of:
  - Publishable key appears in a public commit (search GitHub mirrors for the
    key string).
  - Anomalous signin volume on Clerk Dashboard (flag: > 2× rolling 7-day median
    over a 24h window).
  - Departing developer with EAS access (defense in depth — Clerk publishable
    keys aren't a credential, but rotating limits dashboard cross-correlation).
- **On Clerk-side incident** — if Clerk publishes a security bulletin requiring
  key rotation.

### Steps (per profile rotated)

1. Create the new Clerk application slot OR rotate the publishable key on the
   existing instance (Clerk Dashboard → Developers → API Keys → "Rotate" or
   create a new instance if the existing one is being retired).
2. Capture the new `pk_test_…` or `pk_live_…` value.
3. Update `crialook-app/eas.json` `build.<profile>.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   in a single commit:

   ```bash
   git checkout -b clerk-rotate-$(date +%Y%m%d)
   # edit crialook-app/eas.json
   git commit -am "chore(crialook-app): rotate Clerk <profile> publishable key"
   ```

4. Push the change to the EAS server is automatic — `eas build` re-reads `eas.json`
   per build. No `eas secret` push needed (publishable keys aren't EAS secrets;
   they live in the bundled JS).
5. **Build** the affected profile with the new key:

   ```bash
   cd crialook-app
   eas build --profile <profile> --platform android
   ```

6. **Verify** the new key in the build:
   - Install the resulting APK / AAB on a device.
   - Sign in.
   - Confirm Clerk Dashboard logs the event on the NEW instance / with the new
     key fingerprint (Dashboard → Logs → Events).
7. **Revoke the old key** in Clerk Dashboard ONLY after the new build is live in
   the relevant track (internal / closed / production) AND verification step 6
   succeeded. Premature revocation kills sessions for users still on the old
   build.

### Revocation timing

- **Development / preview** profiles: revoke immediately after step 6 — these
  builds are internal-distribution APKs, replaced by the new install.
- **Production** profile: wait at least 7 days after the new AAB reaches the
  production track on Play Store. Active customer sessions need time to refresh.
  Set a calendar reminder for day 8.

## Cross-references

- `crialook-app/eas.json` — env block per profile (read-only; rotated via this
  runbook).
- `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` — first-build owner workflow.
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §F-04 — original finding.
- `.planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md` D-05, D-06, D-07 —
  decisions captured during phase planning.
- Project memory `project_clerk_client_trust` — Trust toggle gating, separate
  concern.
