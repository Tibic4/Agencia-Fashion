---
plan_id: 05-02
phase: 5
title: eas.json — add Sentry DSN per profile, flip SENTRY_DISABLE_AUTO_UPLOAD=false in prod, replace shared Clerk key with 3 per-profile placeholders
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/eas.json
autonomous: true
requirements: ["F-03", "F-04", "D-03", "D-04", "D-07"]
must_haves:
  truths:
    - "eas.json development.env contains EXPO_PUBLIC_SENTRY_DSN (placeholder OR real)"
    - "eas.json preview.env contains EXPO_PUBLIC_SENTRY_DSN"
    - "eas.json production.env contains EXPO_PUBLIC_SENTRY_DSN"
    - "eas.json production.env has SENTRY_DISABLE_AUTO_UPLOAD set to \"false\""
    - "eas.json development.env and preview.env keep SENTRY_DISABLE_AUTO_UPLOAD as \"true\" (no source-map upload from non-prod)"
    - "Three EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY values are distinct strings across the three profiles"
    - "All three Clerk values contain the substring 'PLACEHOLDER' (so no real key ships in this commit)"
    - "submit.production.android block is unchanged (track: internal, releaseStatus: draft, serviceAccountKeyPath unchanged)"
  acceptance:
    - "node -e \"const j=require('./crialook-app/eas.json'); process.exit(j.build.production.env.SENTRY_DISABLE_AUTO_UPLOAD === 'false' && j.build.development.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true' && j.build.preview.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true' ? 0 : 1)\" exits 0"
    - "node -e \"const j=require('./crialook-app/eas.json'); const k=[j.build.development.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, j.build.preview.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, j.build.production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY]; process.exit(new Set(k).size === 3 && k.every(s => s.includes('PLACEHOLDER')) ? 0 : 1)\" exits 0"
    - "node -e \"const j=require('./crialook-app/eas.json'); const dsns=[j.build.development.env.EXPO_PUBLIC_SENTRY_DSN, j.build.preview.env.EXPO_PUBLIC_SENTRY_DSN, j.build.production.env.EXPO_PUBLIC_SENTRY_DSN]; process.exit(dsns.every(d => typeof d === 'string' && d.length > 0) ? 0 : 1)\" exits 0"
    - "node -e \"const j=require('./crialook-app/eas.json'); const s=j.submit.production.android; process.exit(s.serviceAccountKeyPath === './play-store-key.json' && s.track === 'internal' && s.releaseStatus === 'draft' ? 0 : 1)\" exits 0"
    - "node -e \"JSON.parse(require('fs').readFileSync('./crialook-app/eas.json','utf8'))\" exits 0 (valid JSON)"
---

# Plan 05-02: `eas.json` — Sentry DSN + Per-Profile Clerk Keys

## Objective

Reshape `crialook-app/eas.json` so that:

1. **F-03 (Sentry):** All three build profiles declare `EXPO_PUBLIC_SENTRY_DSN`. Production additionally flips `SENTRY_DISABLE_AUTO_UPLOAD` from `"true"` to `"false"` so the Expo Sentry plugin uploads source maps when `SENTRY_AUTH_TOKEN` (owner-provisioned EAS server-side secret per D-02) is present. Dev and preview keep auto-upload OFF — non-prod shouldn't pollute the prod Sentry release stream.
2. **F-04 (Clerk):** Replace the single shared `pk_live_Y2xlcmsuY3JpYWxvb2suY29tLmJyJA` value (currently duplicated across all three profiles) with three DISTINCT placeholder strings — one per profile. Owner replaces with real Clerk publishable keys (one per Clerk instance) before triggering the build (PLAY_RELEASE_CHECKLIST step 3 in plan 05-05).

This plan ships `eas.json` ready-to-have-real-keys-pasted-in. It does NOT contain any real Sentry DSN or Clerk publishable key — those are owner-provisioned per D-02, D-06, D-07.

## Truths the executor must respect

- `eas.json` is JSON (no comments allowed). Do NOT add `//` comments — that breaks `eas-cli`'s parser.
- The current production env (lines 40-46) has `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `SENTRY_DISABLE_AUTO_UPLOAD`. Plan adds `EXPO_PUBLIC_SENTRY_DSN` and flips `SENTRY_DISABLE_AUTO_UPLOAD`. Order within env objects is JSON-irrelevant but keep alphabetical for diff hygiene: `APP_VARIANT, EXPO_PUBLIC_API_URL, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_SENTRY_DSN, SENTRY_DISABLE_AUTO_UPLOAD`.
- The placeholder DSN must be a STRING (not null) so `eas-cli` doesn't trip env-validation. Use the literal string `"PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD"` for dev+preview and `"PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD"` for production. Real DSN format is `https://<key>@<org>.ingest.us.sentry.io/<project>` — owner replaces in production at minimum, optionally in preview, before triggering the build (checklist step 3).
- The placeholder Clerk values must satisfy: (a) all three distinct, (b) all three contain `PLACEHOLDER` substring (acceptance regex). Use:
  - `development`: `"pk_test_PLACEHOLDER_DEV_REPLACE_BEFORE_BUILD"`
  - `preview`:     `"pk_test_PLACEHOLDER_PREVIEW_REPLACE_BEFORE_BUILD"`
  - `production`:  `"pk_live_PLACEHOLDER_PROD_REPLACE_BEFORE_BUILD"`
  Note the `pk_test_` vs `pk_live_` prefix — Clerk publishable keys use these prefixes by convention; matching the prefix to the env makes accidental cross-pasting visually obvious during owner replace.
- The `cli` block (top of file), the build-level `developmentClient`/`distribution`/`channel`/`android` sub-blocks, the `autoIncrement: true` on production, and the entire `submit` block are NOT touched.
- This plan ships PLACEHOLDERS only. Owner is responsible for replacing them per D-07 + checklist step 3 in plan 05-05.

## Tasks

### Task 1: Rewrite `crialook-app/eas.json` with per-profile Sentry DSN + per-profile Clerk placeholder keys + production source-map upload enabled

<read_first>
- crialook-app/eas.json (full file — current state)
- .planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md (D-01..D-07)
- .planning/phases/05-play-prerelease-hygiene/05-RESEARCH.md (R-01 confirmation: 3 named profiles, "Sentry config — current state" section)
- .planning/audits/CRIALOOK-PLAY-READINESS.md (F-03 lines 18 + 129; F-04 lines 19; lines 263-268 confirm current SENTRY_DISABLE_AUTO_UPLOAD: true posture)
</read_first>

<action>
Overwrite `crialook-app/eas.json` with EXACTLY this content (mind whitespace — 2-space indent, no trailing newlines beyond a single one at EOF):

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "APP_VARIANT": "development",
        "EXPO_PUBLIC_API_URL": "https://crialook.com.br/api",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_PLACEHOLDER_DEV_REPLACE_BEFORE_BUILD",
        "EXPO_PUBLIC_SENTRY_DSN": "PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD",
        "SENTRY_DISABLE_AUTO_UPLOAD": "true"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "APP_VARIANT": "preview",
        "EXPO_PUBLIC_API_URL": "https://crialook.com.br/api",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_PLACEHOLDER_PREVIEW_REPLACE_BEFORE_BUILD",
        "EXPO_PUBLIC_SENTRY_DSN": "PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD",
        "SENTRY_DISABLE_AUTO_UPLOAD": "true"
      }
    },
    "production": {
      "channel": "production",
      "android": {
        "buildType": "app-bundle"
      },
      "autoIncrement": true,
      "env": {
        "APP_VARIANT": "production",
        "EXPO_PUBLIC_API_URL": "https://crialook.com.br/api",
        "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_live_PLACEHOLDER_PROD_REPLACE_BEFORE_BUILD",
        "EXPO_PUBLIC_SENTRY_DSN": "PLACEHOLDER_DSN_REPLACE_BEFORE_BUILD",
        "SENTRY_DISABLE_AUTO_UPLOAD": "false"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./play-store-key.json",
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}
```

Notes the executor MUST respect:
- File MUST end with exactly one newline (POSIX convention).
- No trailing commas anywhere (JSON spec).
- The `submit.production.android` block is UNCHANGED character-for-character vs current state (lines 49-55 of original).
- The placeholder strings are literal — do NOT substitute real keys.
</action>

<acceptance_criteria>
- `node -e "JSON.parse(require('fs').readFileSync('./crialook-app/eas.json','utf8'))"` exits 0 (parses cleanly)
- `node -e "const j=require('./crialook-app/eas.json'); process.exit(j.build.production.env.SENTRY_DISABLE_AUTO_UPLOAD === 'false' ? 0 : 1)"` exits 0
- `node -e "const j=require('./crialook-app/eas.json'); process.exit(j.build.development.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true' && j.build.preview.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true' ? 0 : 1)"` exits 0
- `node -e "const j=require('./crialook-app/eas.json'); const dsns=[j.build.development.env.EXPO_PUBLIC_SENTRY_DSN, j.build.preview.env.EXPO_PUBLIC_SENTRY_DSN, j.build.production.env.EXPO_PUBLIC_SENTRY_DSN]; process.exit(dsns.every(d => typeof d === 'string' && d.length > 0) ? 0 : 1)"` exits 0
- `node -e "const j=require('./crialook-app/eas.json'); const k=new Set([j.build.development.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, j.build.preview.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, j.build.production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY]); process.exit(k.size === 3 ? 0 : 1)"` exits 0
- `node -e "const j=require('./crialook-app/eas.json'); const k=[j.build.development.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, j.build.preview.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, j.build.production.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY]; process.exit(k.every(s => s.includes('PLACEHOLDER')) ? 0 : 1)"` exits 0
- `node -e "const j=require('./crialook-app/eas.json'); const s=j.submit.production.android; process.exit(s.serviceAccountKeyPath === './play-store-key.json' && s.track === 'internal' && s.releaseStatus === 'draft' ? 0 : 1)"` exits 0
- `node -e "const j=require('./crialook-app/eas.json'); process.exit(j.build.development.developmentClient === true && j.build.preview.distribution === 'internal' && j.build.production.autoIncrement === true ? 0 : 1)"` exits 0 (other knobs preserved)
- File ends with exactly one newline byte: `python3 -c "data=open('crialook-app/eas.json','rb').read(); import sys; sys.exit(0 if data[-1:]==b'\\n' and data[-2:-1]!=b'\\n' else 1)"` exits 0 (or equivalent shell check)
</acceptance_criteria>

---

## Verification

After Task 1:

1. `cat crialook-app/eas.json | python3 -m json.tool >/dev/null && echo OK` prints OK.
2. `grep -c "PLACEHOLDER" crialook-app/eas.json` returns 6 (2 occurrences per profile × 3 profiles — Clerk PLACEHOLDER + DSN PLACEHOLDER each).
3. `git diff crialook-app/eas.json` shows ONLY env-block changes — no diff in `cli`, `submit`, or any other top-level key.

## must_haves

```yaml
truths:
  - eas_json_parses_as_valid_json
  - production_sentry_disable_auto_upload_is_false_string
  - dev_and_preview_sentry_disable_auto_upload_remain_true_string
  - all_three_profiles_have_expo_public_sentry_dsn_set_to_a_non_empty_string
  - three_distinct_clerk_placeholder_keys_one_per_profile
  - all_three_clerk_keys_contain_substring_PLACEHOLDER
  - submit_production_android_block_unchanged
  - cli_block_unchanged
  - build_type_apk_for_dev_preview_app_bundle_for_prod
acceptance:
  - all_node_e_assertions_exit_zero
  - file_ends_with_single_newline
  - placeholder_count_equals_six
```
