---
plan_id: 06-01
phase: 6
title: Bump @clerk/clerk-expo to ~2.19.36 to patch GHSA-w24r-5266-9c3c (auth-bypass advisory) + regen lockfile via npm run lock:fix
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/package.json
  - crialook-app/package-lock.json
autonomous: true
requirements: ["D-07", "D-08", "D-09", "F-CVE-Clerk"]
must_haves:
  truths:
    - "package.json @clerk/clerk-expo entry uses range that resolves to 2.19.36 or higher"
    - "package-lock.json lockfileVersion is 3 (npm 10 produced)"
    - "package-lock.json @clerk/clerk-expo resolved version is >= 2.19.36 in every nested location"
    - "no plain npm install was used (lockfile regen via npm run lock:fix only — preserves preinstall guard contract)"
    - "no other package.json dependency line is reordered or modified beyond this single bump"
  acceptance:
    - "node -e \"const p=require('./crialook-app/package.json'); const r=p.dependencies['@clerk/clerk-expo']; const m=r.match(/(\\\\d+)\\\\.(\\\\d+)\\\\.(\\\\d+)/); const ok=m&&(Number(m[1])>2||(Number(m[1])===2&&Number(m[2])>19)||(Number(m[1])===2&&Number(m[2])===19&&Number(m[3])>=36)); process.exit(ok?0:1)\" exits 0"
    - "node -e \"const l=require('./crialook-app/package-lock.json'); process.exit(l.lockfileVersion===3?0:1)\" exits 0"
    - "node -e \"const l=require('./crialook-app/package-lock.json'); const e=l.packages['node_modules/@clerk/clerk-expo']; const m=e.version.match(/(\\\\d+)\\\\.(\\\\d+)\\\\.(\\\\d+)/); const ok=m&&(Number(m[1])>2||(Number(m[1])===2&&Number(m[2])>19)||(Number(m[1])===2&&Number(m[2])===19&&Number(m[3])>=36)); process.exit(ok?0:1)\" exits 0"
    - "cd crialook-app && npm test exits 0 (vitest still green; SDK bump didn't break lib/__tests__)"
    - "cd crialook-app && npm run lint exits 0 (no new TypeScript or eslint regressions from API surface drift in the bumped SDK)"
---

# Plan 06-01: Bump @clerk/clerk-expo to patch GHSA-w24r-5266-9c3c

## Objective

Patch the known Clerk Expo SDK auth-bypass advisory (GHSA-w24r-5266-9c3c) by bumping `@clerk/clerk-expo` from the current `^2.19.31` to `~2.19.36+`. Lockfile MUST be regenerated via `npm run lock:fix` per the `project_eas_npm_lock` memory — plain `npm install` is blocked by `scripts/preinstall-guard.js` and would corrupt the lockfile to `lockfileVersion: 4` which breaks EAS builds.

This is a defensive bump within the same minor version (2.19.x → 2.19.x), so API surface drift should be zero. If `npm test` or `npm run lint` regresses, that signals an unexpected breaking change in a supposed-patch release — treat as a blocker, do not paper over.

## Truths the executor must respect

- The current dependency line in `crialook-app/package.json` reads `"@clerk/clerk-expo": "^2.19.31"`. After this plan, the same line reads `"@clerk/clerk-expo": "~2.19.36"` — switch from caret (`^`) to tilde (`~`) so the lockfile pins to the 2.19.x train and any further `npm install` surfaces don't silently float to 2.20+.
- DO NOT touch any other dependency line, devDependency, script, or top-level field in `package.json`. The `_lock_warning` block (`package.json` line ~5) and the `lock:fix` script must be preserved character-for-character.
- After editing `package.json`, run `npm run lock:fix` from `crialook-app/`. This invokes `npx --yes npm@10 install --legacy-peer-deps` per the script in `package.json:14`, which regenerates `package-lock.json` with `lockfileVersion: 3` (npm 10 format). NEVER run `npm install` — `scripts/preinstall-guard.js` will exit with a helpful message and abort.
- `npm run lock:fix` may take 60-120s. Allow the network round-trip to npm registry. Do not retry on first transient failure unless `npm-debug.log` shows a real registry error.
- After `lock:fix` completes, run `npm test` (vitest) and `npm run lint`. Both must pass. If either regresses, gather the exact error and STOP — do not commit. The advisory may have introduced a breaking export rename or eslint plugin upgrade.
- This plan does NOT modify `app.config.ts`, `eas.json`, or any source file under `app/`, `lib/`, `components/`, `hooks/`. The SDK bump is purely transitive.

## Tasks

### Task 1: Edit `package.json` to update @clerk/clerk-expo version range

<read_first>
- crialook-app/package.json (full file — confirm current `^2.19.31` value)
- crialook-app/scripts/preinstall-guard.js (confirm guard logic — informational only, do not modify)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-07, D-08, D-09)
- .planning/audits/CRIALOOK-PLAY-READINESS.md §"Clerk Expo SDK CVE" or grep for GHSA-w24r-5266-9c3c
</read_first>

<action>
In `crialook-app/package.json`, locate the line `"@clerk/clerk-expo": "^2.19.31",` and replace it with:

```
"@clerk/clerk-expo": "~2.19.36",
```

That is the ONLY change to this file. Preserve trailing comma, surrounding whitespace, and order in the dependencies block.
</action>

<verify>
```bash
grep -n '"@clerk/clerk-expo"' crialook-app/package.json
# Expect exactly one match: "@clerk/clerk-expo": "~2.19.36",
```
</verify>

### Task 2: Regenerate `package-lock.json` via `npm run lock:fix`

<read_first>
- crialook-app/package.json (the `lock:fix` script line — confirm it invokes `npx --yes npm@10 install --legacy-peer-deps`)
- C:\Users\bicag\.claude\projects\d--Nova-pasta-Agencia-Fashion\memory\project_eas_npm_lock.md (canonical: regenerate lock with npm run lock:fix, never plain npm install)
</read_first>

<action>
From `crialook-app/`, run `npm run lock:fix`. Wait for completion (60-120s). On success, `package-lock.json` will be regenerated with `lockfileVersion: 3` and `@clerk/clerk-expo` resolved to the latest 2.19.36+ patch.
</action>

<verify>
```bash
cd crialook-app
node -e "const l=require('./package-lock.json'); console.log('lockfileVersion=', l.lockfileVersion)"
# Expect: lockfileVersion= 3

node -e "const l=require('./package-lock.json'); console.log('clerk version=', l.packages['node_modules/@clerk/clerk-expo'].version)"
# Expect: clerk version= 2.19.36 (or higher 2.19.x patch)
```

If `lockfileVersion` is NOT 3, STOP — the regen used the wrong npm. Check that `npx npm@10` was actually downloaded (look for `~/.npm/_npx/` cache) and that `node --version` is in the supported range.
</verify>

### Task 3: Run vitest + lint to confirm no API surface drift

<read_first>
- crialook-app/package.json (test + lint scripts — confirm they exist)
</read_first>

<action>
From `crialook-app/`:

```bash
npm test
npm run lint
```

Both must exit 0. If either fails:
1. Capture the exact error.
2. Do NOT roll back the bump — the SDK lockfile is now correct.
3. Surface the failure as a blocker in the plan's verification report. The downstream test plans (06-08, 06-09) and the owner-action F-10 dependency assume the SDK bump is in place.
</action>

<verify>
```bash
cd crialook-app
npm test 2>&1 | tail -20
# Expect: green test summary, no FAIL lines

npm run lint 2>&1 | tail -10
# Expect: no errors, only warnings (warnings allowed per current eslint config)
```
</verify>

## Owner-action callout (D-09)

After this plan commits, the owner MUST verify EAS preview builds still authenticate end-to-end:

1. Trigger `eas build --profile preview --platform android` from `crialook-app/`.
2. Install the resulting APK on a test device.
3. Sign in with Google SSO.
4. Confirm `getToken()` returns a valid JWT (visible if you do `apiGet('/store')` from the home screen — should return store data, not 401).

This step is OUT OF SCOPE for the autonomous executor (no EAS credentials in CI; plan-checker cannot run a real build). Owner runs it as part of `PLAY_RELEASE_CHECKLIST` when promoting the next preview build.

## Files modified

- `crialook-app/package.json` — bump version range
- `crialook-app/package-lock.json` — regenerated by `npm run lock:fix`

## Why this matters (risk if skipped)

GHSA-w24r-5266-9c3c is a published auth-bypass advisory in `@clerk/clerk-expo` versions before 2.19.36. Shipping the production AAB with a known-vulnerable SDK is a Play Store policy risk and a real-user attack surface (CWE-863 — incorrect authorization). Patch is a single-line bump; cost-of-fix is 5 minutes, cost-of-skip is a security-incident blast radius across the whole user base.
