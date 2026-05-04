---
plan_id: 06-06
phase: 6
title: Document keystore migration to EAS-managed credentials path (eas credentials -p android → Migrate to EAS); doc-only per D-15
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/docs/EAS_KEYSTORE_MIGRATION.md
autonomous: true
requirements: ["D-15", "D-16", "F-CONCERNS-1", "F-13"]
must_haves:
  truths:
    - "doc captures the eas credentials -p android command + Migrate to EAS option flow"
    - "doc lists pre-migration confirmations: backup local keystore, confirm EAS project access, confirm Play upload key fingerprint matches before+after"
    - "doc lists post-migration cleanup: delete local crialook-app/credentials/, delete crialook-app/credentials.json, ensure .gitignore lines stay (defense-in-depth even though local files are gone)"
    - "doc lists verification: eas build --profile preview --platform android still produces a valid signed APK after migration"
    - "doc explicitly states owner executes when ready, low priority, NOT on critical path (D-16)"
    - "doc lives at crialook-app/docs/ — production runbook, not phase artifact"
    - "doc does NOT execute the migration (D-15 — doc-only in M1)"
  acceptance:
    - "test -f crialook-app/docs/EAS_KEYSTORE_MIGRATION.md exits 0"
    - "wc -l crialook-app/docs/EAS_KEYSTORE_MIGRATION.md returns 50 or more"
    - "grep -c 'eas credentials' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md returns at least 1"
    - "grep -c 'Migrate to EAS' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md returns at least 1"
    - "grep -ic 'low priority\\|not.*critical path\\|when ready' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md returns at least 1"
    - "grep -c 'credentials.json\\|keystore.jks\\|play-store-key.json' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md returns at least 3"
---

# Plan 06-06: EAS keystore migration runbook (doc-only)

## Objective

Per D-15 / D-16, write a runbook the owner follows when migrating from local-managed Android signing keystore + Google service account JSON to EAS-managed credentials. This is a posture upgrade (CONCERNS §1, F-13 informational): local files are currently gitignored and never committed (verified — see `CRIALOOK-PLAY-READINESS.md` lines 257-263), but offloading them to EAS removes a category of accidental-commit risk entirely.

Per D-15: **doc-only in M1**. The migration EXECUTION is owner's responsibility post-Play approval (low priority, not on critical path per D-16). This plan writes the doc so the migration is one `eas credentials` command away when the owner is ready.

## Truths the executor must respect

- Doc lives at `crialook-app/docs/EAS_KEYSTORE_MIGRATION.md` (production runbook path).
- DO NOT execute `eas credentials` or any other EAS CLI command. The doc-only constraint per D-15 is hard.
- DO NOT delete `crialook-app/credentials/`, `crialook-app/credentials.json`, or `crialook-app/play-store-key.json`. The doc instructs the owner to delete them AFTER successful EAS migration; the executor only writes the doc.
- DO NOT modify `.gitignore` — current gitignore correctly shields these files; doc just confirms the entries stay even after local files are gone (defense-in-depth).
- The doc must be self-contained — owner reads it standalone weeks/months from now without needing to context-switch to `.planning/`.

## Tasks

### Task 1: Confirm current credentials posture

<read_first>
- crialook-app/.gitignore (focus on the entries shielding keystore + credentials.json + play-store-key.json — confirm exact line numbers)
- crialook-app/credentials.json (existence only — do NOT print contents to logs; this contains plaintext keystore passwords)
- .planning/codebase/CONCERNS.md §1 (signing material section)
- .planning/audits/CRIALOOK-PLAY-READINESS.md lines 257-263 (current secrets posture: gitignored, never committed) and lines 262-263 (F-13 — recommend EAS migration)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-15, D-16)
</read_first>

<action>
Confirm via `ls` that the following local credentials exist (do NOT cat them):

```bash
ls -la crialook-app/credentials/ 2>/dev/null
ls -la crialook-app/credentials.json 2>/dev/null
ls -la crialook-app/play-store-key.json 2>/dev/null
```

These are the files the doc instructs the owner to delete post-migration.
</action>

### Task 2: Write `crialook-app/docs/EAS_KEYSTORE_MIGRATION.md`

<read_first>
- (re-uses Task 1 reads)
</read_first>

<action>
Create `crialook-app/docs/EAS_KEYSTORE_MIGRATION.md` with EXACTLY this structure:

```markdown
# EAS Keystore Migration Runbook

> **Doc-only per Phase 06 D-15. Execution is owner's responsibility post-Play approval. LOW PRIORITY — NOT on critical path.**

## Why migrate?

Currently:
- `crialook-app/credentials/android/keystore.jks` — Android upload keystore (binary, gitignored).
- `crialook-app/credentials.json` — plaintext keystore passwords (gitignored).
- `crialook-app/play-store-key.json` — Google Play service account JSON (gitignored).

These are all properly gitignored (`crialook-app/.gitignore` lines 18, 25-26, 30, 33) and never committed (verified via `git log --all --full-history` for these paths in `.planning/audits/CRIALOOK-PLAY-READINESS.md` lines 257-263). Posture is currently sound.

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
3. Select **`Migrate keystore from local credentials.json file to EAS`** (or equivalent label — Expo CLI text drifts).
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

grep -E 'credentials\.json|keystore|play-store-key|\\.jks' crialook-app/.gitignore
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

## References

- `.planning/codebase/CONCERNS.md` §1 (Sensitive Android signing material)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` lines 257-263 (F-13 informational, current posture sound, recommend EAS migration)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` Appendix B step 12 (this step in pre-submission checklist)
- Expo docs: https://docs.expo.dev/app-signing/managed-credentials/
- `crialook-app/eas.json` `submit.production.android.serviceAccountKeyPath` (no-op after migration)
```

That's the entire doc. No other file changes.
</action>

<verify>
```bash
test -f crialook-app/docs/EAS_KEYSTORE_MIGRATION.md && echo "OK"
wc -l crialook-app/docs/EAS_KEYSTORE_MIGRATION.md
# Expect: 50+

grep -c 'eas credentials' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md
# Expect: 1+

grep -c 'Migrate to EAS\|Migrate keystore' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md
# Expect: 1+

grep -c 'credentials.json\|keystore.jks\|play-store-key.json' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md
# Expect: 3+

grep -ic 'low priority\|not.*critical path\|when ready\|NOT on critical' crialook-app/docs/EAS_KEYSTORE_MIGRATION.md
# Expect: 1+

# Confirm we did NOT execute migration (files still present locally)
ls -la crialook-app/credentials/ 2>&1 | head -3
ls -la crialook-app/credentials.json 2>&1 | head -3
# Both: should still exist (we didn't touch them)
```
</verify>

## Files modified

- `crialook-app/docs/EAS_KEYSTORE_MIGRATION.md` (NEW)

## Files NOT modified (deliberate per D-15)

- `crialook-app/credentials/` — owner deletes post-migration, not now
- `crialook-app/credentials.json` — owner deletes post-migration, not now
- `crialook-app/play-store-key.json` — owner deletes post-migration, not now
- `crialook-app/eas.json` `serviceAccountKeyPath` — left as-is, doc explains it becomes a no-op
- `crialook-app/.gitignore` — left as-is, defense-in-depth even after local files gone

## Why this matters (risk if skipped)

Without the doc, the migration becomes "a thing the owner vaguely remembers we should do" and either never happens (sustained risk-of-accidental-commit) or happens under pressure when the second developer joins (rushed migration, no rollback plan written, possible Play upload-key mismatch). Writing the runbook now is the difference between a 20-min owner-paced posture upgrade and a midnight panic.
