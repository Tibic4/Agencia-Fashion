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
' 2>&1) || NODE_EXIT=$?

NODE_EXIT="${NODE_EXIT:-0}"

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
