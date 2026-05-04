#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/validate-aab-manifest.sh
#
# M3-01: helper for PLAY_RELEASE_CHECKLIST step 9.
#
# What this DOES:
#   1. Locates `bundletool` (PATH binary, or BUNDLETOOL_JAR env, or fall back
#      to a Maven-Central download hint).
#   2. Runs `bundletool dump manifest --bundle=<aab>` on the owner-supplied
#      AAB path.
#   3. Greps for POST_NOTIFICATIONS + com.android.vending.BILLING.
#   4. Exits 0 if both present, 1 with explicit missing list if not.
#   5. Bonus: prints the full <uses-permission> list for sanity.
#
# Argument:
#   $1 — path to .aab file (downloaded from EAS build dashboard).
#
# Usage:
#   bash scripts/validate-aab-manifest.sh ./app.aab
#   npm run play:validate-aab -- ./path/to/app.aab   (from crialook-app/)
#
# Exit code: 0 if both required permissions present, 1 otherwise.
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

AAB_PATH="${1:-}"
if [ -z "$AAB_PATH" ]; then
  echo "${RED}ERR${RESET}: missing argument."
  echo "Usage: bash scripts/validate-aab-manifest.sh <path-to-app.aab>"
  echo
  echo "Tip: download the AAB from the EAS build dashboard:"
  echo "  https://expo.dev/accounts/<owner>/projects/crialook-app/builds"
  exit 2
fi

if [ ! -f "$AAB_PATH" ]; then
  echo "${RED}ERR${RESET}: file not found: $AAB_PATH"
  exit 2
fi

# ─────────────────────────────────────────────────────────────
# Locate bundletool. Three options, in order:
#   1. `bundletool` on PATH (e.g., brew install bundletool, or apt).
#   2. $BUNDLETOOL_JAR pointing to the .jar (java -jar fallback).
#   3. Print install instructions and exit.
# ─────────────────────────────────────────────────────────────
echo "${BLUE}── Locating bundletool ──${RESET}"
BUNDLETOOL_CMD=""
if command -v bundletool >/dev/null 2>&1; then
  BUNDLETOOL_CMD="bundletool"
  echo "${GREEN}OK${RESET}: found 'bundletool' on PATH"
elif [ -n "${BUNDLETOOL_JAR:-}" ] && [ -f "$BUNDLETOOL_JAR" ]; then
  if ! command -v java >/dev/null 2>&1; then
    echo "${RED}FAIL${RESET}: BUNDLETOOL_JAR set but \`java\` is not on PATH."
    echo "Install Java (e.g., a recent OpenJDK) or use the binary distribution of bundletool."
    exit 2
  fi
  BUNDLETOOL_CMD="java -jar $BUNDLETOOL_JAR"
  echo "${GREEN}OK${RESET}: using java + \$BUNDLETOOL_JAR ($BUNDLETOOL_JAR)"
else
  echo "${RED}FAIL${RESET}: bundletool not found."
  echo
  echo "Install via one of:"
  echo "  macOS:   brew install bundletool"
  echo "  Linux:   sudo apt install bundletool   (or download .jar from GitHub releases)"
  echo "  Windows: download bundletool-all-<ver>.jar from https://github.com/google/bundletool/releases"
  echo "           then: export BUNDLETOOL_JAR=/full/path/to/bundletool-all.jar"
  echo
  echo "Direct .jar: https://github.com/google/bundletool/releases/latest"
  echo
  echo "After install, re-run: bash scripts/validate-aab-manifest.sh $AAB_PATH"
  exit 2
fi

# ─────────────────────────────────────────────────────────────
# Dump manifest
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}── Dumping manifest from $AAB_PATH ──${RESET}"
TMP_MANIFEST=$(mktemp)
if ! $BUNDLETOOL_CMD dump manifest --bundle="$AAB_PATH" >"$TMP_MANIFEST" 2>/tmp/bundletool-err.log; then
  echo "${RED}FAIL${RESET}: bundletool dump manifest exited non-zero."
  echo "Stderr (last 20 lines):"
  tail -20 /tmp/bundletool-err.log 2>/dev/null | sed 's/^/    /'
  rm -f "$TMP_MANIFEST"
  exit 1
fi
echo "${GREEN}OK${RESET}: manifest dumped ($(wc -l <"$TMP_MANIFEST" | tr -d ' ') lines)"

# ─────────────────────────────────────────────────────────────
# Permission grep
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}── Required permission check ──${RESET}"
REQUIRED=("android.permission.POST_NOTIFICATIONS" "com.android.vending.BILLING")
MISSING=()
for perm in "${REQUIRED[@]}"; do
  if grep -qF "$perm" "$TMP_MANIFEST"; then
    echo "${GREEN}PRESENT${RESET}: $perm"
  else
    echo "${RED}MISSING${RESET}: $perm"
    MISSING+=("$perm")
  fi
done

# ─────────────────────────────────────────────────────────────
# Bonus: full uses-permission list
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}── All uses-permission entries in this AAB ──${RESET}"
PERMS=$(grep -oE 'uses-permission[^>]*android:name="[^"]+"' "$TMP_MANIFEST" 2>/dev/null \
  | grep -oE 'android:name="[^"]+"' \
  | sed 's/android:name="//; s/"$//' \
  | sort -u)
if [ -z "$PERMS" ]; then
  echo "${YELLOW}WARN${RESET}: no uses-permission entries found (unusual — manifest dump format may have changed)"
else
  echo "$PERMS" | sed 's/^/  - /'
fi

rm -f "$TMP_MANIFEST"

# ─────────────────────────────────────────────────────────────
# Summary + exit
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
if [ "${#MISSING[@]}" -eq 0 ]; then
  echo "${GREEN}AAB manifest validation: PASS${RESET}"
  echo "Both required permissions are declared. Safe to proceed to step 11 (eas submit)."
  exit 0
fi

echo "${RED}AAB manifest validation: FAIL${RESET}"
echo "Missing permission(s):"
for p in "${MISSING[@]}"; do
  echo "  - $p"
done
echo
echo "Recovery: see PLAY_RELEASE_CHECKLIST step 10."
echo "Most likely cause: app.config.ts \`android.permissions\` was reverted before the build."
exit 1
