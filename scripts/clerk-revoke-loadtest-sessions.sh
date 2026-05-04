#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/clerk-revoke-loadtest-sessions.sh — owner helper.
#
# Print the exact Clerk Dashboard URLs (and, if @clerk/backend is installed
# and CLERK_SECRET_KEY is set, the Admin API curl commands) needed to revoke
# the two Clerk sessions that were captured in `loadtests/.env.loadtest`
# during M1 P4. Those JWTs are expired by now but the *sessions* and
# refresh tokens may still be live in the Clerk Dashboard until revoked.
#
# Why this script:
#   - M1 P4 surfaced two distinct user_… IDs in `loadtests/.env.loadtest` —
#     one production (sub: user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3, iss
#     clerk.crialook.com.br) and one development (sub:
#     user_3BuUmVnqcFeMEV72k5Hkqw4kzP1, iss casual-vervet-96.clerk.accounts.dev).
#   - The owner needs to revoke their active sessions in each respective
#     Clerk app to fully cut off the captured-cookie attack surface.
#   - This script does NOT auto-revoke; it prints the dashboard URLs +
#     (when SDK is available) the exact `curl` template for the owner
#     to run with their own CLERK_SECRET_KEY.
#
# Usage:
#   bash scripts/clerk-revoke-loadtest-sessions.sh
#   npm run clerk:revoke-loadtest  (from repo root or campanha-ia/)
#
# Hard constraints honored:
#   - Does NOT call Clerk Admin API directly. Prints curl templates only.
#   - Does NOT install @clerk/backend. Detects whether it's already present.
#   - Does NOT export CLERK_SECRET_KEY. Owner provides it inline.
# ═══════════════════════════════════════════════════════════

set -uo pipefail

if [ -t 1 ] || [ "${CI:-}" = "true" ]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  BLUE=$'\033[0;34m'
  CYAN=$'\033[0;36m'
  RESET=$'\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' RESET=''
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Two users to action (constants — these IDs are baked because they came from
# the captured .env.loadtest; they are not secrets, just identifiers).
PROD_USER_ID="user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3"
PROD_INSTANCE_HOST="clerk.crialook.com.br"
DEV_USER_ID="user_3BuUmVnqcFeMEV72k5Hkqw4kzP1"
DEV_INSTANCE_HOST="casual-vervet-96.clerk.accounts.dev"

# Detect whether @clerk/backend is installed (anywhere in the workspace).
SDK_AVAILABLE=false
SDK_LOCATION=""
for pkg_dir in "$REPO_ROOT/campanha-ia" "$REPO_ROOT/crialook-app" "$REPO_ROOT"; do
  if [ -d "$pkg_dir/node_modules/@clerk/backend" ]; then
    SDK_AVAILABLE=true
    SDK_LOCATION="$pkg_dir/node_modules/@clerk/backend"
    break
  fi
done

# campanha-ia uses @clerk/nextjs which re-exports clerkClient from @clerk/backend
# under the hood. Also detect that as a fallback.
if [ "$SDK_AVAILABLE" = "false" ] && [ -d "$REPO_ROOT/campanha-ia/node_modules/@clerk/nextjs" ]; then
  SDK_AVAILABLE=true
  SDK_LOCATION="$REPO_ROOT/campanha-ia/node_modules/@clerk/nextjs (transitively re-exports clerkClient)"
fi

echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Clerk loadtest session revocation helper${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo
echo "Two user accounts had active Clerk sessions captured in"
echo "${CYAN}loadtests/.env.loadtest${RESET} during M1 P4 load-test scenarios."
echo "JWTs are time-bound (expired ~1h after capture) but the underlying"
echo "session + refresh tokens may still be alive in Clerk until revoked."
echo
echo "Action required: the owner revokes both sessions in the matching Clerk app."
echo

if [ "$SDK_AVAILABLE" = "true" ]; then
  echo "${GREEN}@clerk/backend detected${RESET} (via $SDK_LOCATION)."
  echo "You CAN script the revocation via Clerk Admin API."
  echo "You can ALSO use the Dashboard UI — both paths printed below."
else
  echo "${YELLOW}@clerk/backend NOT installed${RESET} — printing Dashboard URLs only."
  echo "(That is fine — Dashboard UI is the recommended path for one-off revocations.)"
fi
echo

# ─────────────────────────────────────────────────────────────
# Production user
# ─────────────────────────────────────────────────────────────
echo "${BLUE}── User 1/2: PRODUCTION ──${RESET}"
echo "  user_id:        ${CYAN}$PROD_USER_ID${RESET}"
echo "  Clerk instance: $PROD_INSTANCE_HOST"
echo "  Clerk app:      crialook-prod (per crialook-app/docs/CLERK_KEYS.md)"
echo
echo "  ${GREEN}Dashboard path:${RESET}"
echo "    1. Open https://dashboard.clerk.com/"
echo "    2. Switch to the 'crialook-prod' application (top-left selector)."
echo "    3. Users → search '$PROD_USER_ID' → click the user."
echo "    4. Sessions tab → Revoke each active session → Confirm."
echo
if [ "$SDK_AVAILABLE" = "true" ]; then
  echo "  ${GREEN}API path (after exporting CLERK_SECRET_KEY for prod app):${RESET}"
  echo "    # 1. List active sessions:"
  echo "    curl -sS https://api.clerk.com/v1/sessions?user_id=$PROD_USER_ID \\"
  echo "      -H \"Authorization: Bearer \$CLERK_SECRET_KEY\" | jq '.[] | {id, status, expire_at}'"
  echo
  echo "    # 2. For each session_id returned (status='active'):"
  echo "    curl -sS -X POST https://api.clerk.com/v1/sessions/<session_id>/revoke \\"
  echo "      -H \"Authorization: Bearer \$CLERK_SECRET_KEY\""
  echo
  echo "  ${YELLOW}NOTE:${RESET} CLERK_SECRET_KEY MUST be the production Clerk secret."
  echo "  Do NOT commit it. Source from /etc/crialook/clerk.env or paste inline."
fi
echo

# ─────────────────────────────────────────────────────────────
# Development user
# ─────────────────────────────────────────────────────────────
echo "${BLUE}── User 2/2: DEVELOPMENT ──${RESET}"
echo "  user_id:        ${CYAN}$DEV_USER_ID${RESET}"
echo "  Clerk instance: $DEV_INSTANCE_HOST"
echo "  Clerk app:      crialook-dev (per crialook-app/docs/CLERK_KEYS.md)"
echo
echo "  ${GREEN}Dashboard path:${RESET}"
echo "    1. Open https://dashboard.clerk.com/"
echo "    2. Switch to the 'crialook-dev' application (top-left selector)."
echo "    3. Users → search '$DEV_USER_ID' → click the user."
echo "    4. Sessions tab → Revoke each active session → Confirm."
echo
if [ "$SDK_AVAILABLE" = "true" ]; then
  echo "  ${GREEN}API path (after exporting CLERK_SECRET_KEY for DEV app):${RESET}"
  echo "    curl -sS https://api.clerk.com/v1/sessions?user_id=$DEV_USER_ID \\"
  echo "      -H \"Authorization: Bearer \$CLERK_SECRET_KEY\" | jq '.[] | {id, status, expire_at}'"
  echo
  echo "    curl -sS -X POST https://api.clerk.com/v1/sessions/<session_id>/revoke \\"
  echo "      -H \"Authorization: Bearer \$CLERK_SECRET_KEY\""
  echo
  echo "  ${YELLOW}NOTE:${RESET} CLERK_SECRET_KEY here MUST be the DEV Clerk secret"
  echo "  (different value from prod). Confirm in Clerk Dashboard → API Keys."
fi
echo

# ─────────────────────────────────────────────────────────────
# Post-revocation cleanup checklist
# ─────────────────────────────────────────────────────────────
echo "${BLUE}── After revocation ──${RESET}"
echo "  [ ] Both sessions show 'revoked' in Clerk Dashboard."
echo "  [ ] (Optional) Re-test by hitting https://crialook.com.br/api/health"
echo "      with the captured COOKIE_HEADER from loadtests/.env.loadtest;"
echo "      should NOT return 200 with a hydrated session anymore."
echo "  [ ] Consider rotating loadtests/.env.loadtest contents — the file is"
echo "      .gitignore'd but exists locally. Replace with fresh dev tokens"
echo "      next time you run loadtests."
echo

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Summary${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "  Users to action: 2"
echo "    - $PROD_USER_ID (prod, $PROD_INSTANCE_HOST)"
echo "    - $DEV_USER_ID (dev, $DEV_INSTANCE_HOST)"
echo "  Reason: JWTs were captured in loadtests/.env.loadtest during M1 P4."
echo "  Clerk Admin SDK available: $SDK_AVAILABLE"
echo
echo "${GREEN}This script is informational only. No remote calls were made.${RESET}"
exit 0
