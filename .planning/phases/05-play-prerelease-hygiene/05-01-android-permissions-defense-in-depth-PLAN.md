---
plan_id: 05-01
phase: 5
title: Add POST_NOTIFICATIONS + com.android.vending.BILLING to app.config.ts (defense-in-depth before first build)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/app.config.ts
autonomous: true
requirements: ["F-07", "F-08", "D-15", "D-16"]
must_haves:
  truths:
    - "android.permissions array in app.config.ts contains 'android.permission.POST_NOTIFICATIONS'"
    - "android.permissions array in app.config.ts contains 'com.android.vending.BILLING'"
    - "VIBRATE and CAMERA entries are preserved (not replaced)"
    - "blockedPermissions array is unchanged"
    - "iOS section, plugins array, intentFilters, and all other config blocks are unchanged"
  acceptance:
    - "grep -E \"android.permission.POST_NOTIFICATIONS|com.android.vending.BILLING\" crialook-app/app.config.ts returns 2 lines"
    - "grep -c 'android.permission.VIBRATE' crialook-app/app.config.ts returns 1"
    - "grep -c 'android.permission.CAMERA' crialook-app/app.config.ts returns 1"
    - "cd crialook-app && npx tsc --noEmit exits 0"
---

# Plan 05-01: Android Permissions — Defense-in-Depth Before First Build

## Objective

Add `POST_NOTIFICATIONS` (Android 13+ runtime permission for `expo-notifications`) and `com.android.vending.BILLING` (required by `react-native-iap` and Play Console subscription validation) to the `android.permissions` array in `crialook-app/app.config.ts` BEFORE the first production AAB build, so the manifest is correct on attempt #1 and the owner does NOT have to rebuild.

This closes findings F-07 (notifications silently dropping on Android 13+) and F-08 (Play Console rejecting AAB upload because `BILLING` isn't visible). It implements decision D-15 (proactive injection) so D-16's `bundletool dump manifest` step is a defense-in-depth verification, not a blocking discovery.

## Truths the executor must respect

- The current `android.permissions` array is exactly `['android.permission.VIBRATE', 'android.permission.CAMERA']` (lines 136-139 of `crialook-app/app.config.ts`). DO NOT replace existing entries.
- The order convention in this file is: `android.permission.*` entries first (alphabetical by suffix), then non-`android.permission.*` entries (e.g., `com.android.vending.BILLING`). Final order MUST be: `CAMERA, POST_NOTIFICATIONS, VIBRATE, com.android.vending.BILLING`.
- `blockedPermissions` (lines 140-144) is NOT touched. Neither `POST_NOTIFICATIONS` nor `BILLING` belong there — `BILLING` is install-time-only (no runtime prompt) and `POST_NOTIFICATIONS` IS the runtime permission we want exposed.
- The iOS section (lines 101-122), plugins array (lines 161-242), and intentFilters (lines 145-159) are out of scope for this plan. Do NOT edit them.
- Phase 5 CONTEXT D-15 is explicit: the proactive add must happen BEFORE the first build. This plan ships the code change; owner triggers the build (plan 05-05 checklist).
- `app.config.ts` is a TypeScript source file, not a manifest — editing it does NOT require `npm run lock:fix` (memory rule applies only to `package.json`).

## Tasks

### Task 1: Inject POST_NOTIFICATIONS + BILLING into android.permissions array

<read_first>
- crialook-app/app.config.ts (full file — see current `android` block at lines 123-160 to understand structure and context)
- .planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md (D-15, D-16)
- .planning/audits/CRIALOOK-PLAY-READINESS.md (F-07 at lines 22, 71; F-08 at lines 23, 73)
</read_first>

<action>
Edit `crialook-app/app.config.ts`. Locate the `android.permissions` array at lines 136-139:

```ts
    permissions: [
      'android.permission.VIBRATE',
      'android.permission.CAMERA',
    ],
```

Replace it with:

```ts
    permissions: [
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'com.android.vending.BILLING',
    ],
```

Why this exact order:
- Alphabetical-by-suffix for the three `android.permission.*` entries (`CAMERA` < `POST_NOTIFICATIONS` < `VIBRATE`) so future diffs are minimal.
- `com.android.vending.BILLING` last because it's not in the `android.permission` namespace — visually grouping non-`android.permission.*` entries makes review easier.

Do NOT touch the `blockedPermissions` block immediately below. Do NOT touch any other line in the file.
</action>

<acceptance_criteria>
- `grep -n "android.permission.POST_NOTIFICATIONS" crialook-app/app.config.ts` returns exactly 1 match
- `grep -n "com.android.vending.BILLING" crialook-app/app.config.ts` returns exactly 1 match
- `grep -n "android.permission.VIBRATE" crialook-app/app.config.ts` returns exactly 1 match (preserved)
- `grep -n "android.permission.CAMERA" crialook-app/app.config.ts` returns exactly 1 match in the permissions array (the camera plugin block on line 172 also contains 'cameraPermission' — that is separate; the new permissions array entry on its own line is what counts; verify by also running `grep -n "'android.permission.CAMERA'" crialook-app/app.config.ts` to scope to the quoted form)
- `grep -c "blockedPermissions" crialook-app/app.config.ts` returns 1 (block intact)
- `grep -c "associatedDomains" crialook-app/app.config.ts` returns 1 (iOS block intact)
- `cd crialook-app && npx tsc --noEmit` exits 0 (no TypeScript regression)
- `cd crialook-app && npx eslint app.config.ts` exits 0 (lint clean)
</acceptance_criteria>

---

### Task 2: Inline comment documenting the F-07/F-08 rationale

<read_first>
- crialook-app/app.config.ts (after Task 1 edit — confirm new permissions array in place)
- .planning/audits/CRIALOOK-PLAY-READINESS.md (F-07 lines 22 + 71; F-08 lines 23 + 73 — exact remediation language)
</read_first>

<action>
In `crialook-app/app.config.ts`, immediately above the `permissions:` array key (the line that now starts `permissions: [`), insert this comment block (preserve indentation — use 4 spaces matching the surrounding code):

```ts
    // Phase 5 / 05-01 — F-07 + F-08 + D-15: explicit permissions BEFORE first build.
    //   POST_NOTIFICATIONS — Android 13+ runtime perm for expo-notifications.
    //     Without this, the OS silently drops every push notification on devices
    //     running Android 13+ and pushOptInGate.ts no-ops (lib/pushOptInGate.ts).
    //   com.android.vending.BILLING — required for react-native-iap autolinking
    //     to register, and Play Console rejects the AAB upload otherwise.
    //   Defense-in-depth: D-16's bundletool dump manifest step verifies that the
    //   built AAB actually contains both. If the verify finds either missing,
    //   the answer is to inspect Expo prebuild output, not to revert this list.
```

The result of Task 1 + Task 2 combined should leave the android block looking like:

```ts
  android: {
    adaptiveIcon: {
      foregroundImage: adaptiveIconPath,
      backgroundColor: '#D946EF',
      // TODO: themed icon Material You ...
    },
    edgeToEdgeEnabled: true,
    package: bundleId,
    allowBackup: false,
    // Phase 5 / 05-01 — F-07 + F-08 + D-15: explicit permissions BEFORE first build.
    //   POST_NOTIFICATIONS — Android 13+ runtime perm for expo-notifications.
    //     Without this, the OS silently drops every push notification on devices
    //     running Android 13+ and pushOptInGate.ts no-ops (lib/pushOptInGate.ts).
    //   com.android.vending.BILLING — required for react-native-iap autolinking
    //     to register, and Play Console rejects the AAB upload otherwise.
    //   Defense-in-depth: D-16's bundletool dump manifest step verifies that the
    //   built AAB actually contains both. If the verify finds either missing,
    //   the answer is to inspect Expo prebuild output, not to revert this list.
    permissions: [
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'com.android.vending.BILLING',
    ],
    blockedPermissions: [
      'RECEIVE_BOOT_COMPLETED',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
    ],
    intentFilters: [
      // ... unchanged
```
</action>

<acceptance_criteria>
- `grep -n "Phase 5 / 05-01 — F-07 + F-08 + D-15" crialook-app/app.config.ts` returns exactly 1 match
- `grep -n "pushOptInGate.ts" crialook-app/app.config.ts` returns exactly 1 match (rationale anchor for future grep)
- `cd crialook-app && npx tsc --noEmit` exits 0
- `cd crialook-app && npx eslint app.config.ts` exits 0
</acceptance_criteria>

---

## Verification

After both tasks complete:

1. `cat crialook-app/app.config.ts | sed -n '/Phase 5 \/ 05-01/,/blockedPermissions:/p'` shows the comment + 4-entry permissions array + blockedPermissions header.
2. `cd crialook-app && npx tsc --noEmit` exits 0.
3. `cd crialook-app && npx eslint app.config.ts` exits 0.
4. No changes to `package.json`, `package-lock.json`, or any plugin entries — confirm via `git diff --stat crialook-app/`.

## must_haves

```yaml
truths:
  - app_config_ts_permissions_includes_post_notifications
  - app_config_ts_permissions_includes_com_android_vending_billing
  - existing_camera_and_vibrate_permissions_preserved
  - blocked_permissions_unchanged
  - ios_section_unchanged
  - plugins_array_unchanged
acceptance:
  - tsc_no_emit_exit_zero
  - eslint_clean
  - no_changes_to_package_json_or_lockfile
```
