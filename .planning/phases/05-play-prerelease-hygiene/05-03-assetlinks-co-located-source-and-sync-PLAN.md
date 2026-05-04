---
plan_id: 05-03
phase: 5
title: Co-locate assetlinks.json authoritative source in crialook-app, mirror to campanha-ia/public/.well-known, add drift-check script
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/store-assets/assetlinks.json
  - campanha-ia/public/.well-known/assetlinks.json
  - crialook-app/scripts/sync-assetlinks.js
  - crialook-app/package.json
autonomous: true
requirements: ["F-02", "D-08", "D-09", "D-10", "D-11"]
must_haves:
  truths:
    - "crialook-app/store-assets/assetlinks.json is the AUTHORITATIVE source per D-11"
    - "campanha-ia/public/.well-known/assetlinks.json content is byte-identical to the authoritative source"
    - "Both files contain placeholder REPLACE_WITH_PLAY_APP_SIGNING_SHA256 (no real SHA shipped)"
    - "Both files declare package_name com.crialook.app (production bundle ID, not the .dev or .preview variants)"
    - "crialook-app/scripts/sync-assetlinks.js exists and exits 0 when files match, exits 1 with diff when they drift"
    - "crialook-app/package.json scripts has assetlinks:sync entry calling the script"
  acceptance:
    - "diff -q crialook-app/store-assets/assetlinks.json campanha-ia/public/.well-known/assetlinks.json prints nothing (files identical)"
    - "node crialook-app/scripts/sync-assetlinks.js --check exits 0 (files in sync)"
    - "node -e \"const a=require('./crialook-app/store-assets/assetlinks.json'); const b=require('./campanha-ia/public/.well-known/assetlinks.json'); process.exit(JSON.stringify(a)===JSON.stringify(b)?0:1)\" exits 0"
    - "node -e \"const j=require('./crialook-app/store-assets/assetlinks.json'); process.exit(j[0].target.package_name==='com.crialook.app' && j[0].target.sha256_cert_fingerprints[0]==='REPLACE_WITH_PLAY_APP_SIGNING_SHA256' ? 0 : 1)\" exits 0"
    - "grep -c 'assetlinks:sync' crialook-app/package.json returns at least 1"
---

# Plan 05-03: Co-located `assetlinks.json` Source-of-Truth + Drift Check

## Objective

Establish a single source-of-truth pattern for the Android App Links `assetlinks.json` file:

- **Authoritative copy:** `crialook-app/store-assets/assetlinks.json` (lives next to the mobile app it describes — audit trail per D-11).
- **Deploy copy:** `campanha-ia/public/.well-known/assetlinks.json` (Next.js serves automatically per D-08).
- **Drift detector:** `crialook-app/scripts/sync-assetlinks.js` — a small Node script with two modes: `--check` (CI-friendly, exits 1 on drift) and (default) `--write` (copies authoritative → deploy and exits 0). Wired as `npm run assetlinks:sync` in `crialook-app/package.json`.

Both files keep the placeholder SHA `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` per D-09 — owner replaces in the authoritative source, runs `npm run assetlinks:sync`, redeploys web (PLAY_RELEASE_CHECKLIST steps 5-8 in plan 05-05).

This plan does NOT modify `crialook-app/store-assets/README_ASSETLINKS.md` (already complete per R-03 in RESEARCH.md). It does add a brief reference to the new script at the end of that file.

## Truths the executor must respect

- The **production** bundle ID is `com.crialook.app` (verified in `app.config.ts` — line 31, `isPreview` and `isDev` flags fall back to `com.crialook.app`). Both assetlinks.json files MUST list ONLY `com.crialook.app` (NOT `com.crialook.app.dev` or `com.crialook.app.preview`). Dev / preview variants don't need App Links — they're internal-distribution APKs that won't open from web links.
- The placeholder MUST stay literally `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` so README_ASSETLINKS.md (which references this exact string at line 22) stays accurate.
- The deploy copy currently uses compact one-line-per-array formatting; the authoritative source uses pretty multi-line formatting. **This plan normalizes BOTH to the same pretty multi-line format** (2-space indent, JSON spec compliant, EOF newline) so byte-identical diff is the trivial check. Don't try to preserve the old compact form on the deploy side — drift detection is more valuable than backward formatting compat.
- `crialook-app/package.json` change requires `npm run lock:fix` per the `project_eas_npm_lock` memory rule. **Adding a script entry to `scripts:` does NOT change dependencies** — but the memory rule applies to ANY edit to `package.json`. Confirm the memory in CLAUDE.md / project docs: the rule is specifically about `npm install` regenerating the lock with new syntax. Adding a `scripts` entry doesn't trigger that, so `npm run lock:fix` is NOT needed. The acceptance check confirms the lockfile is byte-unchanged.
- The script is plain Node — no new dependencies, no package install. It uses only `node:fs` and `node:path` (built-ins).
- DO NOT touch `crialook-app/store-assets/PLAY_STORE_LISTING.md`, screenshots, icons, or `README_ASSETLINKS.md` body content. The only README update permitted is appending a single new "Sync" subsection at the end (Task 4).

## Tasks

### Task 1: Normalize the authoritative `crialook-app/store-assets/assetlinks.json`

<read_first>
- crialook-app/store-assets/assetlinks.json (current content — already pretty-formatted, mostly compliant)
- crialook-app/store-assets/README_ASSETLINKS.md (full file — confirms placeholder string and validation flow)
- .planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md (D-09, D-11)
</read_first>

<action>
Overwrite `crialook-app/store-assets/assetlinks.json` with EXACTLY this content (2-space indent, single trailing newline at EOF):

```json
[
  {
    "relation": [
      "delegate_permission/common.handle_all_urls"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "com.crialook.app",
      "sha256_cert_fingerprints": [
        "REPLACE_WITH_PLAY_APP_SIGNING_SHA256"
      ]
    }
  }
]
```

This file is the AUTHORITATIVE source per D-11. Owner replaces the placeholder fingerprint AFTER the first `eas build --profile production --platform android` (PLAY_RELEASE_CHECKLIST step 5 in plan 05-05).

The current file is already in this format — only verify it matches byte-for-byte. If it already does, no rewrite needed; otherwise overwrite.
</action>

<acceptance_criteria>
- `node -e "JSON.parse(require('fs').readFileSync('./crialook-app/store-assets/assetlinks.json','utf8'))"` exits 0
- `node -e "const j=require('./crialook-app/store-assets/assetlinks.json'); process.exit(Array.isArray(j) && j.length===1 && j[0].target.package_name==='com.crialook.app' ? 0 : 1)"` exits 0
- `grep -c "REPLACE_WITH_PLAY_APP_SIGNING_SHA256" crialook-app/store-assets/assetlinks.json` returns 1
- `grep -c "delegate_permission/common.handle_all_urls" crialook-app/store-assets/assetlinks.json` returns 1
- File ends with exactly one newline byte
</acceptance_criteria>

---

### Task 2: Sync `campanha-ia/public/.well-known/assetlinks.json` from authoritative source

<read_first>
- crialook-app/store-assets/assetlinks.json (post-Task-1 content — the source)
- campanha-ia/public/.well-known/assetlinks.json (current compact content — being replaced)
- .planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md (D-08)
</read_first>

<action>
Overwrite `campanha-ia/public/.well-known/assetlinks.json` with content BYTE-IDENTICAL to `crialook-app/store-assets/assetlinks.json` (the file from Task 1). Do not reformat, do not "improve" — exact copy.

You can do this by reading the Task 1 file and writing the same content, or by running:

```bash
cp crialook-app/store-assets/assetlinks.json campanha-ia/public/.well-known/assetlinks.json
```

(Whichever is available in the executor's tool kit. The `cp` is simpler; the read+write is more portable.)
</action>

<acceptance_criteria>
- `diff -q crialook-app/store-assets/assetlinks.json campanha-ia/public/.well-known/assetlinks.json` prints nothing (zero output, exit 0)
- `node -e "const a=require('fs').readFileSync('./crialook-app/store-assets/assetlinks.json'); const b=require('fs').readFileSync('./campanha-ia/public/.well-known/assetlinks.json'); process.exit(a.equals(b)?0:1)"` exits 0 (byte-identical)
- `node -e "JSON.parse(require('fs').readFileSync('./campanha-ia/public/.well-known/assetlinks.json','utf8'))"` exits 0
</acceptance_criteria>

---

### Task 3: Create `crialook-app/scripts/sync-assetlinks.js` drift detector

<read_first>
- crialook-app/scripts/preinstall-guard.js (existing scripts/ entry — pattern reference for shebang, exit codes, module style)
- crialook-app/store-assets/assetlinks.json (the source)
- campanha-ia/public/.well-known/assetlinks.json (the deploy target)
- .planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md (D-11)
</read_first>

<action>
Check whether `crialook-app/scripts/preinstall-guard.js` uses CommonJS (`require`/`module.exports`) or ESM (`import`/`export`). Mirror that style. Most likely CommonJS given the broader codebase pattern.

Create `crialook-app/scripts/sync-assetlinks.js` with EXACTLY this content (assume CommonJS; if `preinstall-guard.js` is ESM, convert imports/exports accordingly):

```js
#!/usr/bin/env node
/**
 * Phase 5 / 05-03 — D-11: assetlinks.json drift detector + sync.
 *
 * Authoritative source: crialook-app/store-assets/assetlinks.json
 * Deploy target:        campanha-ia/public/.well-known/assetlinks.json
 *
 * Modes:
 *   node sync-assetlinks.js          -> sync source -> target, exit 0
 *   node sync-assetlinks.js --check  -> exit 0 if identical, exit 1 if drift (CI-friendly)
 *   node sync-assetlinks.js --help   -> usage
 *
 * Run from crialook-app/ (directory of package.json) — paths are relative to repo root,
 * so the script climbs one level (..) before resolving the campanha-ia copy.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '..', 'store-assets', 'assetlinks.json');
const TARGET = path.resolve(__dirname, '..', '..', 'campanha-ia', 'public', '.well-known', 'assetlinks.json');

function usage() {
  process.stdout.write(
    [
      'Usage: node scripts/sync-assetlinks.js [--check | --help]',
      '',
      '  (no flag) Copy authoritative source -> deploy target. Exit 0.',
      '  --check   Compare. Exit 0 if identical, exit 1 if drift detected.',
      '  --help    Show this message.',
      '',
      `Source: ${SOURCE}`,
      `Target: ${TARGET}`,
      '',
    ].join('\n'),
  );
}

function readBytes(p) {
  if (!fs.existsSync(p)) {
    process.stderr.write(`ERR: missing file ${p}\n`);
    process.exit(2);
  }
  return fs.readFileSync(p);
}

const arg = process.argv[2] || '';

if (arg === '--help' || arg === '-h') {
  usage();
  process.exit(0);
}

const sourceBytes = readBytes(SOURCE);

if (arg === '--check') {
  const targetBytes = readBytes(TARGET);
  if (sourceBytes.equals(targetBytes)) {
    process.stdout.write('assetlinks.json: in sync\n');
    process.exit(0);
  }
  process.stderr.write('DRIFT: source and target differ.\n');
  process.stderr.write(`  source: ${SOURCE}\n`);
  process.stderr.write(`  target: ${TARGET}\n`);
  process.stderr.write('Run `npm run assetlinks:sync` (without --check) to overwrite target with source.\n');
  process.exit(1);
}

if (arg === '' || arg === '--write') {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, sourceBytes);
  process.stdout.write(`wrote ${TARGET} (${sourceBytes.length} bytes)\n`);
  process.exit(0);
}

process.stderr.write(`unknown argument: ${arg}\n\n`);
usage();
process.exit(2);
```

After creating the file, make it executable on POSIX (best-effort, not required because `npm` invokes `node script` directly):

```bash
chmod +x crialook-app/scripts/sync-assetlinks.js 2>/dev/null || true
```

If `preinstall-guard.js` actually uses ESM (`import` syntax with `"type": "module"` somewhere), convert accordingly: replace `'use strict';` + `require(...)` with `import` statements; export nothing (it's a CLI entrypoint).
</action>

<acceptance_criteria>
- File exists at exact path `crialook-app/scripts/sync-assetlinks.js`
- File starts with `#!/usr/bin/env node` shebang
- File contains the strings `--check`, `--help`, and `--write` (the three CLI modes)
- File contains `path.resolve(__dirname, '..', '..', 'campanha-ia', 'public', '.well-known', 'assetlinks.json')` (correct relative path resolution)
- `cd crialook-app && node scripts/sync-assetlinks.js --check` exits 0 (files in sync after Task 2)
- `cd crialook-app && node scripts/sync-assetlinks.js --help` exits 0
- `cd crialook-app && node scripts/sync-assetlinks.js --bogus-flag` exits 2 with usage on stderr
- `node -e "require('./crialook-app/scripts/sync-assetlinks.js')"` does NOT throw a syntax error (parses)
</acceptance_criteria>

---

### Task 4: Wire `assetlinks:sync` and `assetlinks:check` into `crialook-app/package.json` scripts

<read_first>
- crialook-app/package.json (full file — locate the `scripts` block at lines 6-23)
- crialook-app/scripts/sync-assetlinks.js (post-Task-3 — confirms CLI flags)
- .planning/PROJECT.md (line 42 — `EAS build expects npm 10 lock` constraint, confirms why we must NOT regen lockfile inadvertently)
</read_first>

<action>
Edit `crialook-app/package.json`. Inside the `scripts` object (currently 13 entries, lines 7-22), add these two new entries in alphabetical-ish position (after `android` line, before `compress:bg` — mirrors existing ordering convention):

```json
"assetlinks:check": "node scripts/sync-assetlinks.js --check",
"assetlinks:sync": "node scripts/sync-assetlinks.js",
```

So the relevant region of `scripts` becomes:

```json
"scripts": {
    "preinstall": "node scripts/preinstall-guard.js",
    "start": "expo start",
    "android": "expo start --android",
    "assetlinks:check": "node scripts/sync-assetlinks.js --check",
    "assetlinks:sync": "node scripts/sync-assetlinks.js",
    "ios": "expo start --ios",
    "web": "expo start --web",
    ...
```

Do NOT change anything else in `package.json` — not `dependencies`, not `devDependencies`, not `expo`, not `overrides`, not `_lock_warning`. The two new lines are the ONLY diff.

After the edit, verify the lockfile was NOT touched: `git diff --stat crialook-app/package-lock.json` must show zero lines changed. The `project_eas_npm_lock` memory rule means an accidental `npm install` here would corrupt the lockfile — so do NOT run `npm install` to "validate". The check is a static parse + lockfile-untouched verification.
</action>

<acceptance_criteria>
- `node -e "JSON.parse(require('fs').readFileSync('./crialook-app/package.json','utf8'))"` exits 0
- `node -e "const j=require('./crialook-app/package.json'); process.exit(j.scripts['assetlinks:sync']==='node scripts/sync-assetlinks.js' && j.scripts['assetlinks:check']==='node scripts/sync-assetlinks.js --check' ? 0 : 1)"` exits 0
- `node -e "const j=require('./crialook-app/package.json'); process.exit(j.scripts['preinstall']==='node scripts/preinstall-guard.js' && j.scripts['lock:fix'] && j.scripts['typecheck']==='tsc --noEmit' ? 0 : 1)"` exits 0 (existing scripts untouched)
- `node -e "const j=require('./crialook-app/package.json'); process.exit(j.dependencies['expo'] && j.devDependencies['vitest'] && j.overrides['react']==='19.1.0' ? 0 : 1)"` exits 0 (deps untouched)
- `git diff --stat crialook-app/package-lock.json` reports 0 changed lines (lockfile untouched — memory rule preserved)
- `cd crialook-app && npm run assetlinks:check` exits 0 (script wiring works end-to-end)
</acceptance_criteria>

---

### Task 5: Append a "Sync" section to `crialook-app/store-assets/README_ASSETLINKS.md`

<read_first>
- crialook-app/store-assets/README_ASSETLINKS.md (full current content — 41 lines, ends with "Sem isso..." paragraph)
- crialook-app/scripts/sync-assetlinks.js (post-Task-3 — for command names)
- .planning/phases/05-play-prerelease-hygiene/05-CONTEXT.md (D-11)
</read_first>

<action>
Append (do NOT overwrite — preserve existing lines 1-41) the following block at the end of `crialook-app/store-assets/README_ASSETLINKS.md`. Add ONE blank line between the existing final paragraph and the new `## Sync` heading.

```md

## Sync (source-of-truth)

Authoritative copy: `crialook-app/store-assets/assetlinks.json` (this directory).
Deploy copy:        `campanha-ia/public/.well-known/assetlinks.json` (served by Next.js).

Workflow after replacing `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`:

```bash
cd crialook-app
npm run assetlinks:sync   # copy authoritative -> deploy target
npm run assetlinks:check  # CI-friendly drift check, exits 1 on diff
```

Then deploy `campanha-ia/` so the file is served at
`https://crialook.com.br/.well-known/assetlinks.json` and validate with the
Google API URL above.
```

Note: the inner triple-backtick fenced code block above MUST be preserved literally in the README (use the exact characters shown — outer fence is THIS plan's example, inner fence is the README content). If your editor escapes triple-backticks awkwardly, write the file via a heredoc-style write so the backticks land verbatim.
</action>

<acceptance_criteria>
- `grep -c "## Sync (source-of-truth)" crialook-app/store-assets/README_ASSETLINKS.md` returns 1
- `grep -c "npm run assetlinks:sync" crialook-app/store-assets/README_ASSETLINKS.md` returns at least 1
- `grep -c "npm run assetlinks:check" crialook-app/store-assets/README_ASSETLINKS.md` returns at least 1
- The original "Sem isso, `autoVerify: true` em `app.json:33`" sentence is still present: `grep -c "autoVerify: true" crialook-app/store-assets/README_ASSETLINKS.md` returns 1
- The original "Como obter o SHA-256" section is still present: `grep -c "## Como obter o SHA-256" crialook-app/store-assets/README_ASSETLINKS.md` returns 1
- File ends with exactly one trailing newline
</acceptance_criteria>

---

## Verification

After all 5 tasks complete:

1. `diff -q crialook-app/store-assets/assetlinks.json campanha-ia/public/.well-known/assetlinks.json` produces no output.
2. `cd crialook-app && npm run assetlinks:check` exits 0.
3. Simulate drift: edit the deploy copy by hand (e.g., add a space), run `npm run assetlinks:check` — exit code 1 with stderr message. Restore via `npm run assetlinks:sync`. (This is a manual smoke test, not a CI gate.)
4. `git diff --stat crialook-app/package-lock.json` shows 0 changes.
5. `cd crialook-app && npx tsc --noEmit` exits 0 (script is plain JS but the project's tsc shouldn't choke on it given `tsconfig.json` excludes `scripts/` by default — confirm by checking `tsconfig.json` `exclude` array; if not excluded, the JS file should still be ignored unless `allowJs: true`).
6. README change is additive only: `git diff crialook-app/store-assets/README_ASSETLINKS.md` shows no removed lines, only added lines.

## must_haves

```yaml
truths:
  - authoritative_assetlinks_in_crialook_app_store_assets_unchanged_in_format
  - deploy_assetlinks_in_campanha_ia_public_well_known_byte_identical_to_authoritative
  - both_files_keep_placeholder_REPLACE_WITH_PLAY_APP_SIGNING_SHA256
  - both_files_declare_only_com_crialook_app_production_bundle_id
  - sync_script_exists_and_supports_check_and_write_modes
  - package_json_has_assetlinks_sync_and_assetlinks_check_scripts
  - package_lock_json_byte_unchanged
  - readme_assetlinks_extended_with_sync_section_no_existing_content_removed
acceptance:
  - diff_q_returns_zero_output
  - npm_run_assetlinks_check_exits_zero
  - all_node_e_assertions_exit_zero
  - lockfile_unchanged_per_memory_rule
```
