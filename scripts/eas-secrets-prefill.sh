#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/eas-secrets-prefill.sh
#
# M3-01: helper for PLAY_RELEASE_CHECKLIST step 1 (Sentry secrets in EAS).
#
# What this DOES:
#   1. Probes `eas whoami` and `eas secret:list` if the EAS CLI is logged-in.
#      Reports which of the 3 required Sentry secrets are already set so the
#      owner doesn't accidentally clash.
#   2. Prints the EXACT `eas secret:create` commands the owner runs by hand,
#      with placeholder tokens the owner replaces with real values from the
#      Sentry dashboard.
#
# What this DOES NOT do:
#   - Call `eas secret:create`. That's owner-action.
#   - Read or transmit the secrets themselves. Owner copies into clipboard.
#
# Usage:
#   bash scripts/eas-secrets-prefill.sh
#   npm run play:secrets   (from crialook-app/)
#
# Exit code: 0 always (informational helper, never blocks).
# ═══════════════════════════════════════════════════════════

set -uo pipefail

# Color codes (ANSI). Disabled when stdout is not a tty AND not in CI.
if [ -t 1 ] || [ "${CI:-}" = "true" ]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  BLUE=$'\033[0;34m'
  RESET=$'\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' RESET=''
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/crialook-app"

REQUIRED_SECRETS=(SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT)

echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}EAS Sentry secrets pre-fill helper${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo
echo "Per crialook-app/docs/PLAY_RELEASE_CHECKLIST.md step 1, three Sentry"
echo "secrets must exist as EAS server-side secrets BEFORE \`eas build\`."
echo
echo "Required secrets:"
for s in "${REQUIRED_SECRETS[@]}"; do
  echo "  - $s"
done
echo

# ─────────────────────────────────────────────────────────────
# Step 1: probe `eas` CLI presence + login
# ─────────────────────────────────────────────────────────────
echo "${BLUE}── Probing EAS CLI ──${RESET}"
if ! command -v eas >/dev/null 2>&1; then
  echo "${YELLOW}SKIP${RESET}: \`eas\` CLI not on PATH. Install: npm i -g eas-cli"
  echo "       (Without the CLI we cannot probe existing secrets — assume none.)"
  EAS_AVAILABLE=false
elif ! (cd "$APP_DIR" && eas whoami >/tmp/eas-whoami.log 2>&1); then
  echo "${YELLOW}SKIP${RESET}: \`eas\` CLI installed but not logged in. Run: eas login"
  echo "       (Without auth we cannot probe existing secrets — assume none.)"
  EAS_AVAILABLE=false
else
  EAS_USER=$(cat /tmp/eas-whoami.log 2>/dev/null | tr -d '\r\n')
  echo "${GREEN}OK${RESET}: logged in as ${EAS_USER}"
  EAS_AVAILABLE=true
fi
echo

# ─────────────────────────────────────────────────────────────
# Step 2: list existing secrets if possible
# ─────────────────────────────────────────────────────────────
EXISTING=""
if [ "$EAS_AVAILABLE" = "true" ]; then
  echo "${BLUE}── Probing existing EAS secrets ──${RESET}"
  if (cd "$APP_DIR" && eas secret:list >/tmp/eas-secret-list.log 2>&1); then
    EXISTING=$(cat /tmp/eas-secret-list.log)
    for s in "${REQUIRED_SECRETS[@]}"; do
      if echo "$EXISTING" | grep -qE "(^|[^A-Z_])${s}([^A-Z_]|$)"; then
        echo "  ${YELLOW}EXISTS${RESET}: ${s} — already set, will CLASH if you re-create"
        echo "          To replace: eas secret:delete --name ${s} --scope project"
      else
        echo "  ${GREEN}MISSING${RESET}: ${s} — safe to create"
      fi
    done
  else
    echo "${YELLOW}SKIP${RESET}: \`eas secret:list\` failed (probably no project linked here)."
    echo "       See /tmp/eas-secret-list.log"
  fi
  echo
fi

# ─────────────────────────────────────────────────────────────
# Step 3: print exact owner commands
# ─────────────────────────────────────────────────────────────
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Owner copy-paste block — replace <…> tokens with real values${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo
echo "# Get values from Sentry: Settings -> Developer Settings -> Auth Tokens"
echo "# Token scope: project:releases (minimum)"
echo "# Org slug: dashboard URL has it (sentry.io/organizations/<org-slug>/)"
echo "# Project slug: the Sentry project name (e.g., crialook-app)"
echo
echo "cd crialook-app"
echo "eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value '<paste-token-here>' --type string"
echo "eas secret:create --scope project --name SENTRY_ORG        --value '<your-sentry-org-slug>' --type string"
echo "eas secret:create --scope project --name SENTRY_PROJECT    --value '<your-sentry-project-slug>' --type string"
echo
echo "# Verify"
echo "eas secret:list"
echo
echo "${YELLOW}Reminder:${RESET} ALL THREE secrets are required for source-map upload."
echo "Without all three, Sentry receives crashes but stacks are minified."
echo

exit 0
