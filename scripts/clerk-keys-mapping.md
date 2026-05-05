<!--
  M3-01: Clerk publishable keys mapping doc.

  PURPOSE
    Owner pastes the 3 Clerk publishable keys (one per profile) into the table
    below, then runs `node scripts/apply-clerk-keys.js` to write them into
    `crialook-app/eas.json`. Idempotent: re-running with the same values is a
    no-op.

  PROVENANCE OF KEYS
    Per crialook-app/docs/CLERK_KEYS.md "Provisioning (Initial Setup)":
      - crialook-dev    -> Clerk app of type Development -> pk_test_…
      - crialook-preview -> Clerk app of type Development -> pk_test_…
      - crialook-prod   -> Clerk app of type Production  -> pk_live_…

  THIS DOC IS GIT-IGNORED IN SPIRIT — keys are short-rotation, not secrets,
  but you should still NOT push this populated doc to a public repo. Use a
  branch + revert pattern, or paste into a private secret-management tool.

  SECURITY NOTE
    Clerk publishable keys are bundle-safe (they identify the frontend, not a
    secret) — they ship inside the AAB. So the risk of "this doc is
    populated and committed" is comparable to the AAB itself going public.
    Still: treat the populated doc as a secret-equivalent until rotated.

  HOW TO USE
    1. Edit the three "value" cells below — replace the "<paste-…>" markers.
    2. Run: node scripts/apply-clerk-keys.js
    3. Verify: bash scripts/play-release-prep.sh (Step 1 of 6 should PASS).
    4. Run: node scripts/apply-clerk-keys.js --check (re-validates, no-op).

  HOW TO RESET
    Replace the value cells with the placeholder strings from
    crialook-app/docs/CLERK_KEYS.md "Profiles" table column 5, then re-run
    the apply script. eas.json is restored.
-->

# Clerk publishable keys — per-profile mapping

| Profile        | Bundle ID                    | Expected prefix | Value (paste here)                                                    |
| -------------- | ---------------------------- | --------------- | --------------------------------------------------------------------- |
| `development`  | `com.crialook.app.dev`       | `pk_test_`      | <paste-dev-clerk-publishable-key>              |
| `preview`      | `com.crialook.app.preview`   | `pk_test_`      | <paste-preview-clerk-publishable-key>               |
| `production`   | `com.crialook.app`           | `pk_live_`      | <paste-prod-clerk-publishable-key>                                |

## Validation rules (enforced by `apply-clerk-keys.js`)

1. All three "Value (paste here)" cells must NOT contain the substring `<paste-`.
2. All three "Value (paste here)" cells must NOT contain the substring `PLACEHOLDER`.
3. The dev value MUST start with `pk_test_`.
4. The preview value MUST start with `pk_test_`.
5. The production value MUST start with `pk_live_`.
6. All three values MUST be distinct.
7. All three values MUST be non-empty after trimming whitespace.

If any rule fails, `apply-clerk-keys.js` exits 1 with a specific remediation
message and does NOT touch `eas.json`. Idempotent: when validation passes
and `eas.json` already has these values, the script is a no-op (exits 0).

## Cross-references

- `crialook-app/docs/CLERK_KEYS.md` — Clerk provisioning + rotation policy
- `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md` step 3 — original manual workflow
- `crialook-app/eas.json` — target file edited by `apply-clerk-keys.js`
