#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/play-store-finalize.sh
#
# M3-01: orchestrator for PLAY_RELEASE_CHECKLIST steps 8 -> 11.
#
# Run this AFTER:
#   - step 4 (eas build --profile production --platform android) succeeded
#   - step 5 (you've extracted the App Signing SHA-256)
#   - step 6 (assetlinks.json updated + npm run assetlinks:sync)
#   - step 7 (campanha-ia deployed; assetlinks endpoint live)
#
# What this DOES:
#   1. validate-assetlinks-deployed.sh — confirms step 7 worked.
#   2. Prompts owner for AAB path (downloaded from EAS dashboard).
#   3. validate-aab-manifest.sh on that AAB — defense-in-depth for step 9.
#   4. Prints the EXACT `eas submit` command for step 11. Does NOT execute.
#
# What this DOES NOT do:
#   - Run `eas build` or `eas submit`. Owner-trigger only.
#   - Mutate any file.
#
# Usage:
#   bash scripts/play-store-finalize.sh
#   AAB_PATH=./app.aab bash scripts/play-store-finalize.sh   (skip prompt)
#   npm run play:finalize   (from crialook-app/)
#
# Exit code: 0 if everything ready to submit, 1 otherwise.
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

echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Play Store finalize orchestrator (steps 8 -> 11)${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"

# ─────────────────────────────────────────────────────────────
# Stage 1: assetlinks deployed validation
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}── Stage 1/3: validate assetlinks deployed ──${RESET}"
if ! bash "$SCRIPT_DIR/validate-assetlinks-deployed.sh"; then
  echo
  echo "${RED}STOP${RESET}: assetlinks validation failed. Re-do steps 6-7 before continuing."
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# Stage 2: AAB path + manifest validation
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}── Stage 2/3: AAB manifest validation ──${RESET}"

if [ -z "${AAB_PATH:-}" ]; then
  echo
  echo "Enter path to the .aab file you downloaded from EAS (e.g., ./app.aab):"
  echo "  Find it via: https://expo.dev/accounts/<owner>/projects/crialook-app/builds"
  echo -n "AAB path: "
  read -r AAB_PATH
fi

if [ -z "${AAB_PATH:-}" ]; then
  echo "${RED}STOP${RESET}: no AAB path provided."
  exit 1
fi

if [ ! -f "$AAB_PATH" ]; then
  echo "${RED}STOP${RESET}: AAB not found at: $AAB_PATH"
  exit 1
fi

if ! bash "$SCRIPT_DIR/validate-aab-manifest.sh" "$AAB_PATH"; then
  echo
  echo "${RED}STOP${RESET}: AAB manifest missing required permissions. See step 10 for recovery."
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# Stage 3: print exact eas submit command
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}── Stage 3/3: ready to submit ──${RESET}"
echo
echo "${GREEN}All pre-submit gates green.${RESET}"
echo
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Owner — copy/paste to submit (PLAY_RELEASE_CHECKLIST step 11):${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo
echo "  cd crialook-app"
echo "  eas submit --platform android --track internal"
echo
echo "Notes per crialook-app/eas.json submit.production.android block:"
echo "  - serviceAccountKeyPath: ./play-store-key.json (must exist locally)"
echo "  - track: internal (lands as draft on Internal Testing)"
echo "  - releaseStatus: draft (promote via Play Console UI)"
echo
echo "${YELLOW}Reminder:${RESET} after the AAB lands on Internal Testing, run the"
echo "post-submit smoke tests in PLAY_RELEASE_CHECKLIST step 11 (Sentry"
echo "error round-trip, Clerk dashboard event, deep-link auto-open)."
echo

exit 0
