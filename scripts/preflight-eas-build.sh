#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/preflight-eas-build.sh
#
# M3-01: master gate BEFORE PLAY_RELEASE_CHECKLIST step 4 (`eas build`).
#
# Composes existing checks into one ordered run:
#   1. play-release-prep.sh (M2 P6) — eas.json + assetlinks + tests + tsc
#                                       + expo-doctor + prebuild manifest grep.
#   2. apply-clerk-keys.js --check  — confirms 0 placeholders in mapping doc
#                                       AND eas.json matches the doc.
#   3. eas-secrets-prefill.sh-style probe — detects whether the 3 Sentry secrets
#       are set. SKIP (with WARN) if `eas` CLI not logged in. FAIL only when
#       CLI is logged in AND a required secret is missing.
#   4. assetlinks endpoint reachable — even with placeholder SHA, /well-known
#       must serve 200. (Covers F-08 / step 6 web deploy not yet done.)
#
# Exits 1 with specific remediation message on any FAIL.
#
# Usage:
#   bash scripts/preflight-eas-build.sh
#   npm run play:preflight   (from crialook-app/)
#
# Override the host (e.g., to validate a staging copy):
#   ASSETLINKS_HOST=staging.crialook.com.br bash scripts/preflight-eas-build.sh
#
# Exit code: 0 on all-pass, 1 on any failure.
# ═══════════════════════════════════════════════════════════

set -uo pipefail

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

HOST="${ASSETLINKS_HOST:-crialook.com.br}"
URL="https://${HOST}/.well-known/assetlinks.json"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
FAILED_STEPS=()

step_pass() { echo "${GREEN}PASS${RESET}: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
step_fail() { echo "${RED}FAIL${RESET}: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); FAILED_STEPS+=("$1"); }
step_warn() { echo "${YELLOW}WARN${RESET}: $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
step_header() { echo; echo "${BLUE}── $1 ──${RESET}"; }

echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Pre-flight gate before \`eas build --profile production\`${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"

# ─────────────────────────────────────────────────────────────
# Stage 1: play-release-prep.sh
# ─────────────────────────────────────────────────────────────
step_header "Stage 1/4: play-release-prep.sh (M2 P6)"
if bash "$SCRIPT_DIR/play-release-prep.sh"; then
  step_pass "play-release-prep.sh exit 0"
else
  step_fail "play-release-prep.sh failed — fix issues above before proceeding"
fi

# ─────────────────────────────────────────────────────────────
# Stage 2: apply-clerk-keys.js --check
# ─────────────────────────────────────────────────────────────
step_header "Stage 2/4: Clerk keys mapping doc <-> eas.json sync"
if node "$SCRIPT_DIR/apply-clerk-keys.js" --check >/tmp/preflight-clerk.log 2>&1; then
  step_pass "scripts/clerk-keys-mapping.md is populated AND eas.json matches"
else
  step_fail "Clerk keys check failed — see /tmp/preflight-clerk.log"
  echo "  Output:"
  cat /tmp/preflight-clerk.log 2>/dev/null | sed 's/^/    /'
  echo "  Remediation: edit scripts/clerk-keys-mapping.md, then run:"
  echo "    node scripts/apply-clerk-keys.js"
fi

# ─────────────────────────────────────────────────────────────
# Stage 3: EAS secrets probe
# ─────────────────────────────────────────────────────────────
step_header "Stage 3/4: EAS Sentry secrets present"
REQUIRED_SECRETS=(SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT)
if ! command -v eas >/dev/null 2>&1; then
  step_warn "\`eas\` CLI not on PATH — cannot verify secrets. Install: npm i -g eas-cli"
elif ! (cd "$APP_DIR" && eas whoami >/tmp/preflight-whoami.log 2>&1); then
  step_warn "\`eas\` CLI installed but not logged in — cannot verify secrets. Run: eas login"
else
  if (cd "$APP_DIR" && eas secret:list >/tmp/preflight-secret-list.log 2>&1); then
    MISSING_SECRETS=()
    for s in "${REQUIRED_SECRETS[@]}"; do
      if ! grep -qE "(^|[^A-Z_])${s}([^A-Z_]|$)" /tmp/preflight-secret-list.log; then
        MISSING_SECRETS+=("$s")
      fi
    done
    if [ "${#MISSING_SECRETS[@]}" -eq 0 ]; then
      step_pass "all 3 EAS secrets present (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)"
    else
      step_fail "missing EAS secret(s): ${MISSING_SECRETS[*]}"
      echo "  Remediation: bash scripts/eas-secrets-prefill.sh"
    fi
  else
    step_warn "\`eas secret:list\` failed (no project linked? see /tmp/preflight-secret-list.log)"
  fi
fi

# ─────────────────────────────────────────────────────────────
# Stage 4: assetlinks endpoint reachable
# ─────────────────────────────────────────────────────────────
step_header "Stage 4/4: assetlinks endpoint reachable"
HTTP_STATUS=$(curl -sS -o /tmp/preflight-assetlinks.json -w '%{http_code}' "$URL" 2>/tmp/preflight-curl.log || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  step_pass "GET $URL returned 200 (web deploy is current)"
else
  step_fail "GET $URL returned $HTTP_STATUS — web has not been deployed (or assetlinks not in /public)"
  echo "  Remediation: run \`bash deploy-crialook.sh\` (campanha-ia) before \`eas build\`."
fi

# Cleanup
rm -f /tmp/preflight-assetlinks.json /tmp/preflight-curl.log /tmp/preflight-whoami.log /tmp/preflight-clerk.log /tmp/preflight-secret-list.log 2>/dev/null

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Pre-flight summary${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "  ${GREEN}PASS:${RESET}  $PASS_COUNT"
echo "  ${RED}FAIL:${RESET}  $FAIL_COUNT"
echo "  ${YELLOW}WARN:${RESET}  $WARN_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo
  echo "${RED}Failed checks:${RESET}"
  for s in "${FAILED_STEPS[@]}"; do
    echo "  - $s"
  done
  echo
  echo "${RED}DO NOT run \`eas build\` until all FAIL items are resolved.${RESET}"
  echo "Reference: crialook-app/docs/PLAY_RELEASE_CHECKLIST.md"
  exit 1
fi

echo
echo "${GREEN}All pre-flight checks green. Ready to run:${RESET}"
echo "  cd crialook-app && eas build --profile production --platform android"
if [ "$WARN_COUNT" -gt 0 ]; then
  echo
  echo "${YELLOW}Note:${RESET} $WARN_COUNT WARN(s) above. EAS secrets could not be probed remotely."
  echo "If you have NOT run \`bash scripts/eas-secrets-prefill.sh\` yet, do so first."
fi
exit 0
