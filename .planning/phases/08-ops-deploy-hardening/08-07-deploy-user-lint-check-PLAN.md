---
plan_id: 08-07
phase: 8
title: scripts/check-deploy-user.sh CI lint — warn if production env runs as root + wire into ci.yml (D-13)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - scripts/check-deploy-user.sh
  - .github/workflows/ci.yml
  - ecosystem.config.js
autonomous: true
requirements: ["D-13"]
must_haves:
  truths:
    - "create scripts/check-deploy-user.sh at repo root (NOT in campanha-ia/scripts — this is an ops/infra check, not a Next.js script). The directory does not exist yet — the script creation must mkdir -p scripts/ first"
    - "script is plain bash (no Node, no TS) — runs in CI on ubuntu-latest with no install step needed"
    - "script reads ecosystem.config.js at repo root, parses out the 'user' field of the crialook app entry, and exits 1 if user === 'root' (or if the env_production block lacks a user override that would override the top-level)"
    - "ecosystem.config.js TODAY has NO user field at all (verified by reading the file: lines 23-69 are the apps[0] entry; no 'user:' key anywhere). This means PM2 inherits the user from the invoking shell (typically root via deploy-crialook.sh). The lint check must distinguish: (a) explicit user='root' (lint fail), (b) explicit user='crialook' (lint pass), (c) NO user field (lint WARN — ambiguous; PM2 inherits, which today is root but the file doesn't say so)"
    - "to make the lint MEANINGFUL, this plan ALSO adds an explicit comment + (initially commented-out) user field to ecosystem.config.js documenting the contract: today the file is implicit-root; future migration (plan 08-08) makes it explicit-crialook. The lint check enforces 'if user is set, it must not be root'"
    - "lint behavior matrix: NO 'user' field → exit 0 with 'WARN: ecosystem.config.js has no explicit user — PM2 inherits from invoking shell (typically root via deploy-crialook.sh). After plan 08-08 DEPLOY_USER cutover, set user: crialook explicitly.' — non-blocking warn"
    - "lint behavior matrix: user: 'root' → exit 1 with 'FAIL: ecosystem.config.js explicitly sets user: root — production must run as a dedicated unprivileged user. See ops/DEPLOY_USER_MIGRATION.md from plan 08-08.'"
    - "lint behavior matrix: user: 'crialook' (or any non-root) → exit 0 with 'OK: ecosystem.config.js user is <name> (non-root)'"
    - "the lint script uses node -e for parsing because ecosystem.config.js is JS module.exports (not JSON). Pattern: 'node -e \"const c=require(\\\"./ecosystem.config.js\\\"); const u=c.apps?.[0]?.user; ...\"'. Or use a regex grep + careful pattern matching — but node is more reliable because ecosystem.config.js can use template literals, computed properties, etc."
    - "wire into .github/workflows/ci.yml as a NEW lightweight job 'deploy-user-lint' that runs on push (main, audit/**) AND pull_request (main). Pattern: ubuntu-latest + actions/checkout@v4 + actions/setup-node@v4 (node 24) + run: bash scripts/check-deploy-user.sh"
    - "the new ci.yml job MUST not depend on the campanha-ia working-directory (this is a repo-root concern). Use defaults: run: working-directory: '.' OR omit defaults entirely (working-directory defaults to repo root)"
    - "the new ci.yml job MUST run alongside (NOT in series with) the existing 4 jobs (lint-typecheck-build, test, mobile-typecheck-test, legal-drift) — they're independent matrix jobs"
    - "ecosystem.config.js modification: add explicit COMMENT block above apps[0] documenting the user contract; add commented-out 'user: \"crialook\",' line so plan 08-08 only needs to uncomment after the SSH user-creation steps. Comment out the line so the lint check passes today (NO explicit user → WARN, not FAIL) — uncommenting is owner-action in 08-08"
    - "the lint script must accept --strict flag: with --strict, the WARN case (no user field) becomes FAIL exit 1. CI runs WITHOUT --strict today (so absent user field is OK warn). After plan 08-08 lands and ecosystem.config.js gets explicit user: 'crialook', a follow-up CI tightening can add --strict — that's NOT in this plan's scope"
    - "make the script executable: 'chmod +x scripts/check-deploy-user.sh' (set executable bit on commit; git tracks the bit)"
    - "script outputs are color-coded for terminal: red FAIL, yellow WARN, green OK. CI logs render the colors via standard ANSI codes — readable in GitHub Actions UI"
  acceptance:
    - "test -d scripts && echo OK (directory created at repo root)"
    - "test -f scripts/check-deploy-user.sh && echo OK"
    - "head -1 scripts/check-deploy-user.sh | grep -q '#!/usr/bin/env bash\\|#!/bin/bash' && echo SHEBANG_OK"
    - "test -x scripts/check-deploy-user.sh OR (head -1 scripts/check-deploy-user.sh | grep -q '#!') (executable bit set OR shebang present)"
    - "wc -l scripts/check-deploy-user.sh returns at least 30 (real impl, not stub)"
    - "grep -c 'ecosystem.config.js' scripts/check-deploy-user.sh returns at least 1"
    - "grep -c 'root\\|user' scripts/check-deploy-user.sh returns at least 3"
    - "grep -c -- '--strict' scripts/check-deploy-user.sh returns at least 1 (flag handler)"
    - "bash scripts/check-deploy-user.sh exits 0 (today: no user field → WARN exit 0)"
    - "bash scripts/check-deploy-user.sh --strict (today: no user field + strict → FAIL exit 1, OR if file is updated per Task 2 to have explicit non-root → exit 0)"
    - "grep -c 'deploy-user-lint\\|check-deploy-user' .github/workflows/ci.yml returns at least 2 (job header + script invocation)"
    - "grep -c 'pull_request' .github/workflows/ci.yml returns at least 1 (PR trigger preserved across all jobs)"
    - "grep -c 'user:.*crialook\\|# user:.*crialook\\|// user:.*crialook' ecosystem.config.js returns at least 1 (commented-out target user documented for plan 08-08 to uncomment)"
    - "node -e 'require(\\\"./ecosystem.config.js\\\")' (loads without error) exits 0 (the comment edits don't break the JS)"
    - "cd campanha-ia && npx tsc --noEmit exits 0 (no Next.js side effect; sanity that root-level ecosystem.config.js change didn't break anything by accident)"
---

# Plan 08-07: scripts/check-deploy-user.sh CI lint + ecosystem.config.js user-field documentation

## Objective

Per D-13: add a CI lint check that enforces production PM2 doesn't run as root. The check parses `ecosystem.config.js` and fails CI if `user: 'root'` is set explicitly. Today the file has NO `user` field at all (PM2 inherits from invoking shell, which is root via `deploy-crialook.sh`); this plan adds:

1. **`scripts/check-deploy-user.sh`** — bash + node-e parsing of ecosystem.config.js with three outcomes: no user → WARN (non-blocking); user: root → FAIL (exit 1); user: non-root → OK
2. **`.github/workflows/ci.yml`** — new lightweight `deploy-user-lint` job alongside existing 4 jobs
3. **`ecosystem.config.js`** — add explicit comment block documenting the user contract + commented-out `user: 'crialook'` line that plan 08-08's owner-action can uncomment after the SSH user-creation steps

The `--strict` flag exists so a future CI tightening (after 08-08 lands and the user is explicit-non-root) can flip the WARN → FAIL — but that flip is NOT in this plan.

## Truths the executor must respect

- **Repo-root scripts/, not campanha-ia/scripts/.** This is an ops/infra check, not a Next.js script. The directory doesn't exist yet (`ls scripts/` errors today). Create it with `mkdir -p scripts`.
- **ecosystem.config.js is JS, not JSON.** Use `node -e 'const c = require("./ecosystem.config.js"); const u = c.apps?.[0]?.user; ...'` for reliable parsing. A regex grep on `user:` could false-positive on commented or template-literal occurrences.
- **Today's expected behavior: WARN (exit 0).** The file has no user field; the check exits 0 with a yellow WARN. CI passes. After plan 08-08 lands and the file has `user: 'crialook'`, the same check exits 0 with green OK. Only `user: 'root'` triggers exit 1.
- **CI job runs at repo root.** The other 4 jobs use `defaults: run: working-directory: campanha-ia` (or `crialook-app`). This new job needs no `defaults` block (working-directory defaults to repo root, where ecosystem.config.js lives).
- **Don't break the existing CI jobs.** Add the new job AFTER the legal-drift job (the most recently-added job, currently at the end of ci.yml). Don't reorder existing jobs.
- **Don't actually set user: 'crialook' in ecosystem.config.js yet.** That's plan 08-08's owner-action. This plan ONLY adds a commented-out line + comment block so plan 08-08 has a clear "uncomment this" instruction.
- **The script must be runnable locally.** `bash scripts/check-deploy-user.sh` from the repo root MUST work without args (default mode = warn-on-absent). With `--strict`, the same script becomes FAIL-on-absent.

## Tasks

### Task 1: Create scripts/check-deploy-user.sh

<read_first>
- ecosystem.config.js (FULL FILE — to confirm the apps[0] structure and that there's no user field today)
- .github/workflows/ci.yml (FULL FILE — to find the 4 existing jobs and confirm the matrix-style independent-job pattern)
- crialook-app/scripts/check-legal-drift.js (the recently-added repo lint script — same architectural pattern)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-13)
</read_first>

<action>
Create `scripts/check-deploy-user.sh`:

```bash
#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/check-deploy-user.sh — CI lint for ecosystem.config.js user field.
#
# Per D-13 / Phase 8 plan 08-07: production PM2 must NOT run as root.
#
# Behavior matrix:
#   user: 'root'     → FAIL  (exit 1)  — explicitly running as root, prod blast radius
#   user: 'crialook' → OK    (exit 0)  — explicit non-root, the target state
#   user: <other>    → OK    (exit 0)  — any non-root user is acceptable
#   no user field    → WARN  (exit 0)  — PM2 inherits from invoking shell;
#                                         today that's root via deploy-crialook.sh,
#                                         but the file doesn't say so. After plan
#                                         08-08 DEPLOY_USER cutover, the file will
#                                         have explicit user: 'crialook'. Until then,
#                                         WARN is non-blocking.
#
# Flags:
#   --strict   Treat "no user field" as FAIL instead of WARN. Use after plan 08-08
#              lands and ecosystem.config.js gets explicit user: 'crialook'.
#
# Usage:
#   bash scripts/check-deploy-user.sh           # CI default — WARN on absent
#   bash scripts/check-deploy-user.sh --strict  # post-08-08 tightening
# ═══════════════════════════════════════════════════════════

set -euo pipefail

STRICT=false
if [ "${1:-}" = "--strict" ]; then
  STRICT=true
fi

# Color codes (ANSI). Disabled on non-terminal output for clean CI logs that
# still render colors in GitHub Actions UI (which IS a terminal-ish frontend).
if [ -t 1 ] || [ "${CI:-}" = "true" ] || [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  RED=$'\033[0;31m'
  YELLOW=$'\033[0;33m'
  GREEN=$'\033[0;32m'
  RESET=$'\033[0m'
else
  RED='' YELLOW='' GREEN='' RESET=''
fi

CONFIG_FILE="ecosystem.config.js"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "${RED}FAIL${RESET}: $CONFIG_FILE not found at repo root."
  exit 1
fi

# Parse the JS module via node — handles template literals, computed props, etc.
# Output: the literal string of the user field, OR "__ABSENT__" if not set.
USER_VALUE=$(node -e '
  try {
    const c = require("./ecosystem.config.js");
    const apps = c.apps || [];
    const app = apps.find(a => a.name === "crialook") || apps[0];
    if (!app) { console.log("__NOAPP__"); process.exit(0); }
    if (typeof app.user === "string") {
      console.log(app.user);
    } else if (app.user === undefined) {
      console.log("__ABSENT__");
    } else {
      console.log("__INVALID__");
    }
  } catch (err) {
    console.error("PARSE_ERROR: " + err.message);
    process.exit(2);
  }
' 2>&1)

NODE_EXIT=$?

if [ "$NODE_EXIT" -ne 0 ]; then
  echo "${RED}FAIL${RESET}: failed to parse $CONFIG_FILE: $USER_VALUE"
  exit 1
fi

case "$USER_VALUE" in
  __NOAPP__)
    echo "${RED}FAIL${RESET}: $CONFIG_FILE has no apps[] entry — file is empty or malformed."
    exit 1
    ;;
  __INVALID__)
    echo "${RED}FAIL${RESET}: $CONFIG_FILE apps[0].user is set to a non-string value (expected string)."
    exit 1
    ;;
  __ABSENT__)
    if [ "$STRICT" = "true" ]; then
      echo "${RED}FAIL${RESET} (--strict): $CONFIG_FILE has no explicit 'user' field. After plan 08-08 DEPLOY_USER cutover, set user: 'crialook' explicitly. See ops/DEPLOY_USER_MIGRATION.md."
      exit 1
    fi
    echo "${YELLOW}WARN${RESET}: $CONFIG_FILE has no explicit 'user' field. PM2 inherits the user from the invoking shell (today: root via deploy-crialook.sh). After plan 08-08 DEPLOY_USER cutover, set user: 'crialook' explicitly. See ops/DEPLOY_USER_MIGRATION.md."
    echo "${YELLOW}     ${RESET}This is non-blocking today; CI passes. Re-run with --strict after the cutover to enforce."
    exit 0
    ;;
  root)
    echo "${RED}FAIL${RESET}: $CONFIG_FILE explicitly sets user: 'root'. Production PM2 must run as a dedicated unprivileged user. See ops/DEPLOY_USER_MIGRATION.md from plan 08-08."
    exit 1
    ;;
  *)
    echo "${GREEN}OK${RESET}: $CONFIG_FILE user is '$USER_VALUE' (non-root)."
    exit 0
    ;;
esac
```

Make the script executable:
```bash
chmod +x scripts/check-deploy-user.sh
```

Reasoning:
- `node -e` reliably parses the JS module. Sentinel strings (`__ABSENT__`, `__NOAPP__`, `__INVALID__`) make the bash case-statement explicit.
- `app.name === "crialook"` finds the right entry; falls back to `apps[0]` if name doesn't match (defensive).
- Color codes render in GitHub Actions UI (it's a terminal-ish frontend per `GITHUB_ACTIONS` env var).
- `--strict` flag is the future-tightening lever.
- Defensive on parse errors: node exits 2, bash captures and reports.
</action>

<verify>
```bash
test -f scripts/check-deploy-user.sh && echo OK
test -x scripts/check-deploy-user.sh && echo EXECUTABLE_OK
head -1 scripts/check-deploy-user.sh | grep -q '#!/usr/bin/env bash' && echo SHEBANG_OK
wc -l scripts/check-deploy-user.sh    # expect ≥ 30

# Run the lint against the current ecosystem.config.js (no user field today):
bash scripts/check-deploy-user.sh
echo "exit=$?"
# Expected: WARN message + exit=0

# Run with --strict (today: WARN becomes FAIL):
bash scripts/check-deploy-user.sh --strict
echo "exit=$?"
# Expected: FAIL message + exit=1 (current state — file has no user field)
```
</verify>

### Task 2: Update ecosystem.config.js with comment block + commented-out user line

<read_first>
- ecosystem.config.js (FULL FILE — 71 lines; the apps[0] entry is at lines 23-69)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-12, D-13 — to confirm the 'user: crialook' target value matches plan 08-08's user creation step)
</read_first>

<action>
In `ecosystem.config.js`, find the apps[0] entry header (lines 24-27):
```javascript
  apps: [
    {
      name: "crialook",
      cwd: APP_DIR,
```

Replace with:
```javascript
  apps: [
    {
      name: "crialook",
      cwd: APP_DIR,

      // ── User contract (D-12, D-13, plan 08-07 + 08-08) ──
      // Today (pre-08-08): no explicit `user` field. PM2 inherits from the
      // invoking shell, which is root via deploy-crialook.sh's default
      // (DEPLOY_USER=root). scripts/check-deploy-user.sh emits WARN on this
      // state (non-blocking).
      //
      // After plan 08-08 owner-action (SSH user creation + sudoers config),
      // OWNER UNCOMMENTS the line below to make the user explicit. Then
      // scripts/check-deploy-user.sh emits OK (green), and CI can be tightened
      // to --strict mode in a follow-up phase.
      //
      // user: "crialook",
```

Reasoning:
- Comment block documents the contract IN THE FILE so future readers don't have to chase plan docs.
- Commented-out `user: "crialook",` line gives plan 08-08 a single-character edit (remove `// `) to flip to enforced.
- Indentation matches existing lines (10 spaces lead-in matches the surrounding object literal).
- Trailing comma is intentional — when uncommented, the line plays nicely with the rest of the object literal regardless of where it ends up.
</action>

<verify>
```bash
# Comment block + commented line present
grep -c 'user: \"crialook\"' ecosystem.config.js   # expect ≥ 1 (the commented line)
grep -c 'D-12\|D-13\|plan 08-07\|plan 08-08\|08-08' ecosystem.config.js  # expect ≥ 1 (comment block citing decisions)

# File still loads as valid JS
node -e 'require("./ecosystem.config.js"); console.log("LOAD_OK")' && echo OK

# Lint still WARN (the user field is still effectively absent because it's commented out)
bash scripts/check-deploy-user.sh
echo "exit=$?"
# Expected: WARN + exit=0 — the commented line doesn't count as setting the field
```
</verify>

### Task 3: Wire scripts/check-deploy-user.sh into .github/workflows/ci.yml

<read_first>
- .github/workflows/ci.yml (FULL FILE — to confirm trigger block + 4 existing jobs + the legal-drift job at the end as the insertion point)
</read_first>

<action>
Find the end of the `legal-drift` job in `.github/workflows/ci.yml` (the `run: npm run check:legal-drift` line is the last line of file). Append a new job AFTER it:

```yaml

  deploy-user-lint:
    name: Deploy user lint (production must not run as root)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      # Phase 8 D-13: bash + node-e parser for ecosystem.config.js.
      # Today: WARN on absent user field (file has none); FAIL on user: 'root'.
      # After plan 08-08 owner-action, ecosystem.config.js gets user: 'crialook'
      # explicitly and this job becomes a green OK. A follow-up CI tightening
      # can add --strict to enforce-on-absent.
      - name: Check ecosystem.config.js user field
        run: bash scripts/check-deploy-user.sh
```

Notes:
- No `defaults: run: working-directory:` — this job runs at repo root (where ecosystem.config.js lives).
- No `npm ci` — the script is plain bash + node `require`, which works with no node_modules.
- No `cache: npm` on setup-node — there's nothing to cache (no npm install).
- Triggers (push main + audit/**, pull_request main) are inherited from the file-level `on:` block at lines 3-7 — no per-job trigger override needed.
</action>

<verify>
```bash
grep -c 'deploy-user-lint:' .github/workflows/ci.yml          # expect 1
grep -c 'check-deploy-user.sh' .github/workflows/ci.yml       # expect 1
grep -c 'pull_request' .github/workflows/ci.yml               # expect ≥ 1 (file-level trigger preserved)

# Verify YAML structure: count top-level jobs
node -e "
const y = require('fs').readFileSync('.github/workflows/ci.yml', 'utf8');
const jobs = y.match(/^  [a-z-]+:$/gm) || [];
console.log('jobs:', jobs.join(', '));
"
# Expected: lint-typecheck-build, test, mobile-typecheck-test, legal-drift, deploy-user-lint
```
</verify>

## Files modified

- `scripts/check-deploy-user.sh` — NEW; bash + node-e parser of ecosystem.config.js with WARN/OK/FAIL behavior matrix (Task 1)
- `ecosystem.config.js` — comment block documenting the user contract + commented-out `user: "crialook",` line for plan 08-08 to uncomment (Task 2)
- `.github/workflows/ci.yml` — new `deploy-user-lint` job alongside existing 4 jobs (Task 3)

## Why this matters (risk if skipped)

Today, ecosystem.config.js has no user field, deploy-crialook.sh defaults to root, and there's nothing to prevent a future PR from accidentally hardcoding `user: 'root'` in ecosystem.config.js (or a maintainer thinking "PM2 inherits — let's set it explicitly to root for clarity"). The lint check enforces the invariant from now on. The commented-out target line gives plan 08-08 a one-character edit to flip the state. The CI integration ensures every PR is checked.
