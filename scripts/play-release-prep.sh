#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/play-release-prep.sh — owner pre-flight before `eas build`.
#
# Automates the scriptable parts of crialook-app/docs/PLAY_RELEASE_CHECKLIST.md
# so the owner can catch placeholder/lockfile/manifest regressions BEFORE
# spending an EAS build slot.
#
# What this DOES (M2 P6):
#   1. eas.json: assert no PLACEHOLDER_DEV / PLACEHOLDER_PREVIEW / PLACEHOLDER_PROD
#      (all three Clerk pks + the three Sentry DSNs replaced).
#   2. assetlinks.json: assert SHA-256 != "REPLACE_WITH_PLAY_APP_SIGNING_SHA256".
#   3. Mobile vitest (`npm test`).
#   4. Mobile typecheck (`npx tsc --noEmit`).
#   5. expo-doctor.
#   6. expo prebuild --platform android --clean, then grep AndroidManifest.xml
#      for POST_NOTIFICATIONS + com.android.vending.BILLING (D-15/D-16
#      defense-in-depth).
#
# What this DOES NOT do:
#   - Run `eas build`. That is owner-action; this is the gate before it.
#   - Push to git. Output is local-only.
#   - Rotate Clerk / Sentry secrets. See PLAY_RELEASE_CHECKLIST steps 1-3.
#
# Exit code: 0 on all-pass, 1 on any failure. Each step prints PASS/FAIL.
#
# Usage:
#   bash scripts/play-release-prep.sh
#   npm run play:prep  (from crialook-app/)
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

# Resolve repo root (script lives in scripts/ relative to root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/crialook-app"

if [ ! -d "$APP_DIR" ]; then
  echo "${RED}FAIL${RESET}: crialook-app/ not found at $APP_DIR"
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_STEPS=()

step_pass() {
  echo "${GREEN}PASS${RESET}: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}
step_fail() {
  echo "${RED}FAIL${RESET}: $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_STEPS+=("$1")
}
step_skip() {
  echo "${YELLOW}SKIP${RESET}: $1"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}
step_header() {
  echo
  echo "${BLUE}── $1 ──${RESET}"
}

# ─────────────────────────────────────────────────────────────
# Step 1: eas.json placeholder check
# ─────────────────────────────────────────────────────────────
step_header "Step 1/6: eas.json placeholders"
EAS_JSON="$APP_DIR/eas.json"
if [ ! -f "$EAS_JSON" ]; then
  step_fail "eas.json not found at $EAS_JSON"
else
  # Use node so we get the same parsing as the EAS toolchain.
  PLACEHOLDER_RESULT=$(node -e "
    try {
      const fs = require('fs');
      const j = JSON.parse(fs.readFileSync('$EAS_JSON', 'utf8'));
      const cks = [
        j.build?.development?.env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
        j.build?.preview?.env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
        j.build?.production?.env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      ];
      const dsns = [
        j.build?.development?.env?.EXPO_PUBLIC_SENTRY_DSN,
        j.build?.preview?.env?.EXPO_PUBLIC_SENTRY_DSN,
        j.build?.production?.env?.EXPO_PUBLIC_SENTRY_DSN,
      ];
      const all = [...cks, ...dsns];
      const missing = all.filter(s => typeof s !== 'string' || s.length === 0);
      const placeheld = all.filter(s => typeof s === 'string' && s.includes('PLACEHOLDER'));
      const distinctClerk = new Set(cks.filter(Boolean)).size;
      if (missing.length) { console.log('FAIL: ' + missing.length + ' env value(s) missing/empty'); process.exit(1); }
      if (placeheld.length) { console.log('FAIL: ' + placeheld.length + ' value(s) still contain PLACEHOLDER'); process.exit(1); }
      if (distinctClerk !== 3) { console.log('FAIL: Clerk keys not all distinct (got ' + distinctClerk + '/3)'); process.exit(1); }
      console.log('OK: 3 distinct Clerk keys, 3 Sentry DSNs, no placeholders');
    } catch (err) {
      console.log('FAIL: parse error — ' + err.message);
      process.exit(1);
    }
  " 2>&1) && PLACEHOLDER_OK=true || PLACEHOLDER_OK=false
  if [ "$PLACEHOLDER_OK" = "true" ]; then
    step_pass "$PLACEHOLDER_RESULT"
  else
    step_fail "eas.json: $PLACEHOLDER_RESULT"
  fi
fi

# ─────────────────────────────────────────────────────────────
# Step 2: assetlinks.json SHA-256 check
# ─────────────────────────────────────────────────────────────
step_header "Step 2/6: assetlinks.json SHA-256"
ASSETLINKS="$APP_DIR/store-assets/assetlinks.json"
if [ ! -f "$ASSETLINKS" ]; then
  step_fail "assetlinks.json not found at $ASSETLINKS"
elif grep -q "REPLACE_WITH_PLAY_APP_SIGNING_SHA256" "$ASSETLINKS"; then
  step_fail "assetlinks.json still contains 'REPLACE_WITH_PLAY_APP_SIGNING_SHA256' placeholder. See PLAY_RELEASE_CHECKLIST step 5."
else
  step_pass "assetlinks.json SHA-256 placeholder replaced"
fi

# ─────────────────────────────────────────────────────────────
# Step 3: Mobile vitest
# ─────────────────────────────────────────────────────────────
step_header "Step 3/6: mobile vitest (npm test)"
if (cd "$APP_DIR" && npm test --silent >/tmp/play-prep-vitest.log 2>&1); then
  step_pass "vitest green (see /tmp/play-prep-vitest.log)"
else
  step_fail "vitest failed — see /tmp/play-prep-vitest.log (last 20 lines below):"
  tail -20 /tmp/play-prep-vitest.log 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────
# Step 4: Mobile typecheck
# ─────────────────────────────────────────────────────────────
step_header "Step 4/6: mobile typecheck (tsc --noEmit)"
if (cd "$APP_DIR" && npx --no-install tsc --noEmit >/tmp/play-prep-tsc.log 2>&1); then
  step_pass "tsc clean"
else
  step_fail "tsc errors — see /tmp/play-prep-tsc.log (last 20 lines below):"
  tail -20 /tmp/play-prep-tsc.log 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────
# Step 5: expo-doctor
# ─────────────────────────────────────────────────────────────
step_header "Step 5/6: expo-doctor"
if (cd "$APP_DIR" && npx --yes expo-doctor >/tmp/play-prep-doctor.log 2>&1); then
  step_pass "expo-doctor clean"
else
  step_fail "expo-doctor reported issues — see /tmp/play-prep-doctor.log (last 30 lines):"
  tail -30 /tmp/play-prep-doctor.log 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────
# Step 6: expo prebuild + AndroidManifest.xml permission grep
# ─────────────────────────────────────────────────────────────
step_header "Step 6/6: expo prebuild + AndroidManifest permissions"
echo "  (running expo prebuild --platform android --clean — may take ~60-120s)"
if (cd "$APP_DIR" && npx --yes expo prebuild --platform android --clean --non-interactive >/tmp/play-prep-prebuild.log 2>&1); then
  MANIFEST="$APP_DIR/android/app/src/main/AndroidManifest.xml"
  if [ ! -f "$MANIFEST" ]; then
    step_fail "expo prebuild succeeded but AndroidManifest.xml not found at $MANIFEST"
  else
    HAS_NOTIF=$(grep -c "POST_NOTIFICATIONS" "$MANIFEST" || true)
    HAS_BILLING=$(grep -c "com.android.vending.BILLING" "$MANIFEST" || true)
    if [ "$HAS_NOTIF" -ge 1 ] && [ "$HAS_BILLING" -ge 1 ]; then
      step_pass "AndroidManifest.xml contains POST_NOTIFICATIONS ($HAS_NOTIF) + com.android.vending.BILLING ($HAS_BILLING)"
    else
      step_fail "AndroidManifest missing required permissions (POST_NOTIFICATIONS=$HAS_NOTIF, BILLING=$HAS_BILLING). See PLAY_RELEASE_CHECKLIST step 9."
    fi
  fi
else
  step_fail "expo prebuild failed — see /tmp/play-prep-prebuild.log (last 30 lines):"
  tail -30 /tmp/play-prep-prebuild.log 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Play release pre-flight summary${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "  ${GREEN}PASS:${RESET}  $PASS_COUNT"
echo "  ${RED}FAIL:${RESET}  $FAIL_COUNT"
echo "  ${YELLOW}SKIP:${RESET}  $SKIP_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo
  echo "${RED}Failed steps:${RESET}"
  for s in "${FAILED_STEPS[@]}"; do
    echo "  - $s"
  done
  echo
  echo "${RED}DO NOT run \`eas build\` until all FAIL items are resolved.${RESET}"
  echo "Owner reference: crialook-app/docs/PLAY_RELEASE_CHECKLIST.md"
  exit 1
fi

echo
echo "${GREEN}All checks passed. Ready to run:${RESET}"
echo "  cd crialook-app && eas build --profile production --platform android"
echo "(See crialook-app/docs/PLAY_RELEASE_CHECKLIST.md step 4)"
exit 0
