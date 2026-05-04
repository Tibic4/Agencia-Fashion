---
plan_id: 05-04
phase: 5
title: Create crialook-app/docs/CLERK_KEYS.md — per-profile keys + rotation policy + provisioning runbook
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/docs/CLERK_KEYS.md
autonomous: true
requirements: ["F-04", "D-05", "D-06"]
must_haves:
  truths:
    - "crialook-app/docs/CLERK_KEYS.md exists"
    - "Doc has a '## Profiles' (or equivalent) section listing development / preview / production with their bundle IDs and Clerk-key-prefix conventions"
    - "Doc has a '## Rotation' section covering trigger, steps, and verification"
    - "Doc has a '## Provisioning (Initial Setup)' section listing the owner steps to create the 3 Clerk instances and capture publishable keys"
    - "Doc cross-references PLAY_RELEASE_CHECKLIST.md (plan 05-05 forward reference is OK; the checklist will land in the same wave's commit window)"
    - "Doc explicitly notes that this rotation policy is the answer to F-04"
  acceptance:
    - "test -f crialook-app/docs/CLERK_KEYS.md (file exists)"
    - "grep -c '^## Rotation' crialook-app/docs/CLERK_KEYS.md returns 1 (rotation section present at H2)"
    - "grep -c '^## Profiles' crialook-app/docs/CLERK_KEYS.md returns 1"
    - "grep -c '^## Provisioning' crialook-app/docs/CLERK_KEYS.md returns 1"
    - "grep -c 'F-04' crialook-app/docs/CLERK_KEYS.md returns at least 1"
    - "grep -c 'pk_test_' crialook-app/docs/CLERK_KEYS.md returns at least 1 (placeholder format documented)"
    - "grep -c 'pk_live_' crialook-app/docs/CLERK_KEYS.md returns at least 1"
---

# Plan 05-04: Clerk Keys — Profiles, Provisioning, Rotation Policy

## Objective

Create `crialook-app/docs/CLERK_KEYS.md` documenting:

1. The three Clerk publishable keys, one per EAS profile (D-05).
2. The owner-action provisioning runbook for initial setup (D-06 step list).
3. The rotation policy: when, how, verification (D-06 + CONTEXT decision: annual + on suspected compromise; provision new → push to EAS → build → verify → revoke old).

This doc is the long-form reference that `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` (plan 05-05) will cite via "see CLERK_KEYS.md §Provisioning". Keeping rotation in a dedicated doc instead of inline in the checklist makes the checklist scannable for one-shot release flow while letting CLERK_KEYS.md grow over time as Clerk's API or our process evolves.

This plan creates the `crialook-app/docs/` directory implicitly (file write creates parent dirs).

## Truths the executor must respect

- The doc is markdown, lives at `crialook-app/docs/CLERK_KEYS.md`, ASCII-safe (Portuguese-language inline comments are fine; the project codebase already uses Portuguese in comments — see `app.config.ts`).
- Do NOT hard-code real Clerk publishable keys. Use placeholder strings matching what plan 05-02 ships in `eas.json`: `pk_test_PLACEHOLDER_DEV_REPLACE_BEFORE_BUILD`, `pk_test_PLACEHOLDER_PREVIEW_REPLACE_BEFORE_BUILD`, `pk_live_PLACEHOLDER_PROD_REPLACE_BEFORE_BUILD`.
- Do NOT mention Clerk Client Trust on/off detail (that's P6 territory per CONTEXT.md `<deferred>`). One sentence acknowledging "Client Trust is currently disabled — see project memory" is OK; deeper treatment belongs in P6's CLERK_CLIENT_TRUST_REENABLE.md.
- The doc references `crialook-app/eas.json` env block (which plan 05-02 ships). It also forward-references `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` (plan 05-05). Both are in the same Wave 1 commit window — by execution end the cross-references resolve.
- Bundle IDs come from `app.config.ts`: `com.crialook.app.dev` (development), `com.crialook.app.preview` (preview), `com.crialook.app` (production). Document these so owner can confirm the right Clerk instance is wired to each variant when checking dashboard logs.

## Tasks

### Task 1: Write `crialook-app/docs/CLERK_KEYS.md`

<read_first>
- crialook-app/eas.json (current state OR post-plan-05-02 state — both fine; doc references the post-05-02 placeholder format)
- crialook-app/app.config.ts (lines 23-41 for variant → bundle ID mapping)
- .planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md (D-05, D-06)
- .planning/audits/CRIALOOK-PLAY-READINESS.md (F-04 lines 19 + line 251 for Clerk-key-as-public-bundle context)
- .planning/PROJECT.md (lines 38-46 for Constraints — Clerk Client Trust off mention)
</read_first>

<action>
Create `crialook-app/docs/CLERK_KEYS.md` (parent dir does not exist; create it).

Write EXACTLY this content:

```md
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
```

The doc ends with a trailing newline.
</action>

<acceptance_criteria>
- File exists at exact path `crialook-app/docs/CLERK_KEYS.md`
- `grep -c "^## Profiles" crialook-app/docs/CLERK_KEYS.md` returns 1
- `grep -c "^## Provisioning" crialook-app/docs/CLERK_KEYS.md` returns 1
- `grep -c "^## Rotation" crialook-app/docs/CLERK_KEYS.md` returns 1
- `grep -c "F-04" crialook-app/docs/CLERK_KEYS.md` returns at least 1
- `grep -c "pk_test_PLACEHOLDER_DEV_REPLACE_BEFORE_BUILD" crialook-app/docs/CLERK_KEYS.md` returns 1
- `grep -c "pk_test_PLACEHOLDER_PREVIEW_REPLACE_BEFORE_BUILD" crialook-app/docs/CLERK_KEYS.md` returns 1
- `grep -c "pk_live_PLACEHOLDER_PROD_REPLACE_BEFORE_BUILD" crialook-app/docs/CLERK_KEYS.md` returns 1
- `grep -c "com.crialook.app.dev" crialook-app/docs/CLERK_KEYS.md` returns at least 1
- `grep -c "com.crialook.app.preview" crialook-app/docs/CLERK_KEYS.md` returns at least 1
- `grep -c "PLAY_RELEASE_CHECKLIST.md" crialook-app/docs/CLERK_KEYS.md` returns at least 1
- `grep -c "Annually" crialook-app/docs/CLERK_KEYS.md` returns at least 1
- File ends with a trailing newline
</acceptance_criteria>

---

## Verification

After Task 1:

1. `cat crialook-app/docs/CLERK_KEYS.md | head -20` shows the H1 + intro paragraph mentioning F-04.
2. `cat crialook-app/docs/CLERK_KEYS.md | grep -E "^##" | sort -u` shows at least: `## Cross-references`, `## Profiles`, `## Provisioning (Initial Setup)`, `## Rotation`, `## Why three keys`.
3. Markdown lint (if `markdownlint` is installed and configured): no errors. Optional — not enforced.
4. No file other than `crialook-app/docs/CLERK_KEYS.md` is created or modified by this plan: `git diff --stat` shows only this one file under `crialook-app/docs/`.

## must_haves

```yaml
truths:
  - clerk_keys_md_exists_at_crialook_app_docs
  - profiles_section_lists_three_profiles_with_bundle_ids_and_key_prefix_convention
  - provisioning_section_lists_six_owner_steps
  - rotation_section_covers_when_steps_and_revocation_timing
  - placeholders_match_those_shipped_in_05_02_eas_json
  - cross_references_to_eas_json_play_release_checklist_audit_and_context
  - explicit_F_04_anchor_for_grep
acceptance:
  - all_grep_counts_match_specified_minimums
  - h2_section_anchors_present
  - file_ends_with_trailing_newline
```
