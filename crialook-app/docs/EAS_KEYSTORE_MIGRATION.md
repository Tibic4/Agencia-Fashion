# EAS Keystore Migration Runbook

> **Doc-only per Phase 06 D-15. Execution is owner's responsibility post-Play approval. LOW PRIORITY — NOT on critical path.**

## Why migrate?

Currently:
- `crialook-app/credentials/android/keystore.jks` — Android upload keystore (binary, gitignored).
- `crialook-app/credentials.json` — plaintext keystore passwords (gitignored).
- `crialook-app/play-store-key.json` — Google Play service account JSON (gitignored).

These are all properly gitignored (`crialook-app/.gitignore`) and never committed (verified via `git log --all --full-history` for these paths in `.planning/audits/CRIALOOK-PLAY-READINESS.md` lines 257-263). Posture is currently sound.

EAS-managed credentials remove a category of risk:

1. **Accidental commit:** With local files, a single `git add -f credentials.json` (or a misconfigured editor that ignores `.gitignore`) commits secrets. With EAS-managed, the secrets only ever live in EAS's credential store; nothing to accidentally commit.
2. **Disk leak:** Laptop theft / disk imaging / cloud backup of dev machine no longer exfiltrates the keystore.
3. **Multi-developer:** When a second developer joins, they don't need to be hand-shared the keystore — EAS handles distribution over authenticated channel.

The trade-off: dependence on EAS as the sole source of truth for signing material. Mitigated by EAS's own backup + (optionally) downloading a snapshot to a sealed offline backup.

## Pre-migration checklist

Confirm BEFORE running the migration command:

### Pre-1 — Backup local keystore

Create an offline backup of the current keystore + credentials.json. Suggested:

```bash
cd crialook-app
mkdir -p ../keystore-backups/$(date +%Y%m%d)
cp -r credentials/ ../keystore-backups/$(date +%Y%m%d)/
cp credentials.json ../keystore-backups/$(date +%Y%m%d)/
cp play-store-key.json ../keystore-backups/$(date +%Y%m%d)/
```

Move the backup to a sealed offline location (encrypted USB, password manager attachment, etc.). The backup is your insurance if EAS-managed has any issue during the migration window.

### Pre-2 — EAS project access

Confirm you can authenticate to EAS:

```bash
cd crialook-app
eas whoami
# Expect: your EAS account (matches the project owner per app.config.ts EAS project ID 4a513aba-203b-443d-8602-9b5c0bbad9c9)
```

### Pre-3 — Capture the SHA-256 fingerprint of the current upload key

This is the fingerprint Play uses to identify the upload key. Migration must preserve it (otherwise Play rejects the next upload).

```bash
cd crialook-app
keytool -list -v -keystore credentials/android/keystore.jks -alias <alias-name>
# Read SHA-256 from the "Certificate fingerprints" section. Save it.
```

(`<alias-name>` — check `credentials.json` for the `keyAlias` field.)

Save the SHA-256 value somewhere — you'll re-check it AFTER migration to confirm EAS imported the same key.

## Migration

```bash
cd crialook-app
eas credentials -p android
```

Interactive menu walkthrough:

1. Select build profile: choose **`production`** (then repeat for `preview` and `development` if needed).
2. Select **`Keystore: Manage everything needed to build your project`**.
3. Select **`Migrate keystore from local credentials.json file to EAS`** (label is "Migrate to EAS" or equivalent — Expo CLI text drifts, confirm with current docs).
4. Confirm — EAS uploads the keystore to its credential store and links it to the build profile.
5. Repeat steps 1-4 for the **Google Service Account** (used by `eas submit`):
   - In the same `eas credentials -p android` menu, select **`Google Service Account`** → **`Upload Google Service Account Key`** → point at `play-store-key.json`.

After migration, EAS holds:
- The Android keystore (used by `eas build`).
- The Google service account JSON (used by `eas submit`).

## Post-migration verification

### Post-1 — Confirm SHA-256 fingerprint matches

```bash
cd crialook-app
eas credentials -p android
# Select production profile → "List existing credentials" → confirm the SHA-256
# matches the value captured in Pre-3.
```

If they don't match: **STOP** and roll back. The migrated keystore is wrong; if you ship a build signed with a different key, Play rejects it.

### Post-2 — Run a test build

```bash
cd crialook-app
eas build --profile preview --platform android
```

Wait for the build to complete (no local credential needed — EAS pulls them from its store). Install the APK on a test device and confirm:

- App launches.
- Sign-in works.
- One generation runs end-to-end.

### Post-3 — Update eas.json

In `crialook-app/eas.json`, the `submit.production.android.serviceAccountKeyPath` field currently points to `./play-store-key.json` (local file). After migration, EAS uses the uploaded service account by default; the field can be removed or left (EAS prefers managed credentials when present).

Recommended: leave the field as-is for now — it's a no-op once the managed service account is uploaded, and it keeps the eas.json shape stable for any tooling that diffs against it.

## Cleanup (after Post-1, Post-2 BOTH pass)

Delete the local copies. EAS is now the source of truth.

```bash
cd crialook-app
rm -rf credentials/
rm credentials.json
rm play-store-key.json
```

**DO NOT** remove the corresponding `.gitignore` lines — defense-in-depth (if any of these files reappear via a tooling artifact, gitignore still shields them).

After cleanup:

```bash
ls -la crialook-app/credentials/ 2>/dev/null
ls -la crialook-app/credentials.json 2>/dev/null
ls -la crialook-app/play-store-key.json 2>/dev/null
# All three: "No such file or directory"

grep -E 'credentials\.json|keystore|play-store-key|\.jks' crialook-app/.gitignore
# Expect: gitignore lines still present (defense-in-depth)
```

## Rollback

If anything goes wrong post-migration:

1. Restore the local files from the offline backup created in Pre-1.
2. In `eas credentials -p android`, select **`Remove keystore from EAS`** for each profile.
3. Future builds again use local credentials.

This rollback is non-destructive — EAS removes its copy, your local copy is restored. Play continues to recognize the (same) upload key.

## Owner timeline guidance (per D-16)

- **Not blocking Play submission.** Local-credentials posture is currently sound. Migration is a posture upgrade, not a fix.
- **Suggested timing:** within 30 days post-Play production-track approval. Combine with onboarding a second developer (if/when applicable) since multi-dev is when EAS-managed pays for itself.
- **Required at:** any point a second developer needs to build the app. Don't share keystores by hand.
- **When ready:** owner runs this runbook end-to-end. LOW PRIORITY — not on the critical path.

## References

- `.planning/codebase/CONCERNS.md` §1 (Sensitive Android signing material)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` lines 257-263 (F-13 informational, current posture sound, recommend EAS migration)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` Appendix B step 12 (this step in pre-submission checklist)
- Expo docs: https://docs.expo.dev/app-signing/managed-credentials/
- `crialook-app/eas.json` `submit.production.android.serviceAccountKeyPath` (no-op after migration)
