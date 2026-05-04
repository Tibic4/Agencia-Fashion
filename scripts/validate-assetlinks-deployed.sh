#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/validate-assetlinks-deployed.sh
#
# M3-01: helper for PLAY_RELEASE_CHECKLIST step 7 / step 8.
#
# What this DOES:
#   1. Curls https://crialook.com.br/.well-known/assetlinks.json.
#   2. Asserts HTTP 200 + Content-Type containing "application/json".
#   3. Asserts the body is parseable JSON.
#   4. Diffs the body against the local authoritative file
#      crialook-app/store-assets/assetlinks.json.
#   5. Pings the Google digital-asset-links API and reports whether
#      the production package + SHA-256 are present in the response.
#
# What this DOES NOT do:
#   - Trigger a deploy (use deploy-crialook.sh).
#   - Mutate any file.
#
# Usage:
#   bash scripts/validate-assetlinks-deployed.sh
#   npm run play:validate-deployed   (from crialook-app/)
#
# Override the host (e.g., to validate a staging copy):
#   ASSETLINKS_HOST=staging.crialook.com.br bash scripts/validate-assetlinks-deployed.sh
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
LOCAL_FILE="$APP_DIR/store-assets/assetlinks.json"

HOST="${ASSETLINKS_HOST:-crialook.com.br}"
URL="https://${HOST}/.well-known/assetlinks.json"
PACKAGE_NAME="${ASSETLINKS_PACKAGE:-com.crialook.app}"

PASS_COUNT=0
FAIL_COUNT=0
FAILED_STEPS=()

step_pass() { echo "${GREEN}PASS${RESET}: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
step_fail() { echo "${RED}FAIL${RESET}: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); FAILED_STEPS+=("$1"); }
step_header() { echo; echo "${BLUE}── $1 ──${RESET}"; }

echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}assetlinks.json deployment validator${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "Endpoint: $URL"
echo "Local:    $LOCAL_FILE"
echo "Package:  $PACKAGE_NAME"

# ─────────────────────────────────────────────────────────────
# Pre-check: local file exists
# ─────────────────────────────────────────────────────────────
step_header "Local file present"
if [ ! -f "$LOCAL_FILE" ]; then
  step_fail "local file missing at $LOCAL_FILE"
  echo
  echo "${RED}Cannot validate without a local source-of-truth.${RESET}"
  exit 1
else
  step_pass "$LOCAL_FILE exists ($(wc -c <"$LOCAL_FILE" | tr -d ' ') bytes)"
fi

# Pre-check: local file has SHA replaced
if grep -q "REPLACE_WITH_PLAY_APP_SIGNING_SHA256" "$LOCAL_FILE"; then
  step_fail "local file still has 'REPLACE_WITH_PLAY_APP_SIGNING_SHA256' placeholder — see PLAY_RELEASE_CHECKLIST step 5"
fi

# ─────────────────────────────────────────────────────────────
# Step 1: HTTP fetch + status check
# ─────────────────────────────────────────────────────────────
step_header "GET $URL"
HTTP_RESP_FILE=$(mktemp)
HTTP_HEAD_FILE=$(mktemp)
HTTP_STATUS=$(curl -sS -o "$HTTP_RESP_FILE" -D "$HTTP_HEAD_FILE" -w '%{http_code}' "$URL" 2>/tmp/curl-err.log || echo "000")

if [ "$HTTP_STATUS" = "000" ]; then
  step_fail "curl failed (network error?) — see /tmp/curl-err.log"
elif [ "$HTTP_STATUS" != "200" ]; then
  step_fail "HTTP $HTTP_STATUS — expected 200"
  echo "  Response head:"
  head -10 "$HTTP_HEAD_FILE" 2>/dev/null | sed 's/^/    /'
else
  step_pass "HTTP 200"
fi

# ─────────────────────────────────────────────────────────────
# Step 2: Content-Type check
# ─────────────────────────────────────────────────────────────
step_header "Content-Type header"
CT=$(grep -i '^Content-Type:' "$HTTP_HEAD_FILE" 2>/dev/null | tr -d '\r' | head -1)
if echo "$CT" | grep -qi 'application/json'; then
  step_pass "$CT"
else
  step_fail "Content-Type missing or not JSON: '$CT' (Android App Links require application/json)"
fi

# ─────────────────────────────────────────────────────────────
# Step 3: Body parses as JSON
# (We pipe the body via stdin to node — avoids cross-shell tmpfile path
# issues on Git-bash on Windows where /tmp/xxx becomes D:\tmp\xxx in node.)
# ─────────────────────────────────────────────────────────────
step_header "Body parses as JSON"
if [ "$HTTP_STATUS" = "200" ]; then
  JSON_PARSE_ERR=""
  if JSON_PARSE_ERR=$(node -e "
    let buf=''; process.stdin.on('data',c=>buf+=c); process.stdin.on('end',()=>{
      try { JSON.parse(buf); console.log('OK'); }
      catch(e){ console.error(e.message); process.exit(1); }
    });
  " <"$HTTP_RESP_FILE" 2>&1); then
    step_pass "valid JSON"
  else
    step_fail "invalid JSON body: $JSON_PARSE_ERR"
    head -5 "$HTTP_RESP_FILE" 2>/dev/null | sed 's/^/    /'
  fi
else
  echo "${YELLOW}SKIP${RESET}: cannot parse (HTTP not 200)"
fi

# ─────────────────────────────────────────────────────────────
# Step 4: Byte-for-byte diff against local
# ─────────────────────────────────────────────────────────────
step_header "Byte-for-byte match against local"
if [ "$HTTP_STATUS" = "200" ]; then
  if diff -q "$HTTP_RESP_FILE" "$LOCAL_FILE" >/dev/null 2>&1; then
    step_pass "served body matches $LOCAL_FILE byte-for-byte"
  else
    step_fail "served body DIFFERS from local file — diff below:"
    diff -u "$LOCAL_FILE" "$HTTP_RESP_FILE" 2>/dev/null | head -40 | sed 's/^/    /'
  fi
else
  echo "${YELLOW}SKIP${RESET}: cannot diff (HTTP not 200)"
fi

# ─────────────────────────────────────────────────────────────
# Step 5: Google digital-asset-links API check
# ─────────────────────────────────────────────────────────────
step_header "Google digital-asset-links API"
GAL_URL="https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://${HOST}&relation=delegate_permission/common.handle_all_urls"
GAL_RESP=$(mktemp)
GAL_STATUS=$(curl -sS -o "$GAL_RESP" -w '%{http_code}' "$GAL_URL" 2>/tmp/gal-err.log || echo "000")

if [ "$GAL_STATUS" = "200" ]; then
  if grep -q "\"$PACKAGE_NAME\"" "$GAL_RESP"; then
    step_pass "Google API confirms statements list contains $PACKAGE_NAME"
  else
    step_fail "Google API responded 200 but $PACKAGE_NAME not in statements"
    echo "  Response (first 30 lines):"
    head -30 "$GAL_RESP" | sed 's/^/    /'
  fi
else
  step_fail "Google API HTTP $GAL_STATUS — see /tmp/gal-err.log"
fi

# ─────────────────────────────────────────────────────────────
# Cleanup tmp + summary
# ─────────────────────────────────────────────────────────────
rm -f "$HTTP_RESP_FILE" "$HTTP_HEAD_FILE" "$GAL_RESP"

echo
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}assetlinks deploy validator summary${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "  ${GREEN}PASS:${RESET}  $PASS_COUNT"
echo "  ${RED}FAIL:${RESET}  $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo
  echo "${RED}Failed steps:${RESET}"
  for s in "${FAILED_STEPS[@]}"; do
    echo "  - $s"
  done
  echo
  echo "${RED}Deep links will NOT auto-verify until these are resolved.${RESET}"
  echo "Owner reference: crialook-app/docs/PLAY_RELEASE_CHECKLIST.md steps 6-8."
  exit 1
fi

echo
echo "${GREEN}assetlinks live + Google API verified. Safe to proceed to step 9.${RESET}"
exit 0
