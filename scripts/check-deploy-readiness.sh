#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# scripts/check-deploy-readiness.sh — owner pre-flight before
# `git push` + `bash deploy-crialook.sh`.
#
# Catches the "build looked fine on my machine but main is dirty / has
# uncommitted / lints fail in CI" class of deploy regressions before
# the auto-rollback path in deploy-crialook.sh has to fire.
#
# Steps (each prints PASS/FAIL/WARN, summary at the end):
#   1. git status --short clean (no uncommitted/untracked).
#   2. git log origin/main..HEAD count → WARN if > 50 commits ahead.
#   3. Web vitest (`cd campanha-ia && npm run test:ci`).
#   4. Web typecheck (`tsc --noEmit`).
#   5. Web lint (`npm run lint`).
#   6. Web build (`npm run build`).
#   7. (Optional) Supabase migration parity if CLI is linked.
#
# Exit code: 0 on all-pass, 1 on any FAIL (WARN does not fail).
#
# Usage:
#   bash scripts/check-deploy-readiness.sh
#   npm run deploy:check  (from campanha-ia/)
#
# Hard constraints honored:
#   - No npm install. Uses already-installed deps only.
#   - No git push, no remote mutation.
#   - Migration parity is best-effort: skipped if `supabase` CLI absent.
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
WEB_DIR="$REPO_ROOT/campanha-ia"

if [ ! -d "$WEB_DIR" ]; then
  echo "${RED}FAIL${RESET}: campanha-ia/ not found at $WEB_DIR"
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0
FAILED_STEPS=()

step_pass() { echo "${GREEN}PASS${RESET}: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
step_fail() { echo "${RED}FAIL${RESET}: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); FAILED_STEPS+=("$1"); }
step_warn() { echo "${YELLOW}WARN${RESET}: $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
step_skip() { echo "${YELLOW}SKIP${RESET}: $1"; SKIP_COUNT=$((SKIP_COUNT + 1)); }
step_header() { echo; echo "${BLUE}── $1 ──${RESET}"; }

# ─────────────────────────────────────────────────────────────
# Step 1: git status --short clean
# ─────────────────────────────────────────────────────────────
step_header "Step 1/7: git status clean"
GIT_STATUS=$(git -C "$REPO_ROOT" status --short 2>&1)
if [ -z "$GIT_STATUS" ]; then
  step_pass "no uncommitted or untracked files"
else
  CHANGE_COUNT=$(echo "$GIT_STATUS" | wc -l | tr -d ' ')
  step_fail "$CHANGE_COUNT uncommitted/untracked file(s):"
  echo "$GIT_STATUS" | head -20 | sed 's/^/    /'
fi

# ─────────────────────────────────────────────────────────────
# Step 2: commits ahead of origin/main
# ─────────────────────────────────────────────────────────────
step_header "Step 2/7: commits ahead of origin/main"
if git -C "$REPO_ROOT" rev-parse --verify origin/main >/dev/null 2>&1; then
  AHEAD=$(git -C "$REPO_ROOT" log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
  if [ "$AHEAD" -eq 0 ]; then
    step_pass "branch is even with origin/main (0 commits ahead)"
  elif [ "$AHEAD" -le 50 ]; then
    step_pass "$AHEAD commit(s) ahead of origin/main (within normal threshold)"
  else
    step_warn "$AHEAD commits ahead of origin/main (threshold: 50). Consider pushing in batches or making sure CI capacity is OK."
  fi
else
  step_skip "origin/main not reachable (offline? new repo?) — skipping ahead-count"
fi

# ─────────────────────────────────────────────────────────────
# Step 3: web vitest
# ─────────────────────────────────────────────────────────────
step_header "Step 3/7: web vitest (test:ci)"
if (cd "$WEB_DIR" && npm run test:ci --silent >/tmp/deploy-check-vitest.log 2>&1); then
  step_pass "web vitest green (see /tmp/deploy-check-vitest.log)"
else
  step_fail "web vitest failed — see /tmp/deploy-check-vitest.log (last 20 lines):"
  tail -20 /tmp/deploy-check-vitest.log 2>/dev/null | sed 's/^/    /' || true
fi

# ─────────────────────────────────────────────────────────────
# Step 4: web typecheck
# ─────────────────────────────────────────────────────────────
step_header "Step 4/7: web typecheck (tsc --noEmit)"
if (cd "$WEB_DIR" && npx --no-install tsc --noEmit >/tmp/deploy-check-tsc.log 2>&1); then
  step_pass "tsc clean"
else
  step_fail "tsc errors — see /tmp/deploy-check-tsc.log (last 20 lines):"
  tail -20 /tmp/deploy-check-tsc.log 2>/dev/null | sed 's/^/    /' || true
fi

# ─────────────────────────────────────────────────────────────
# Step 5: web lint
# ─────────────────────────────────────────────────────────────
step_header "Step 5/7: web lint"
if (cd "$WEB_DIR" && npm run lint --silent >/tmp/deploy-check-lint.log 2>&1); then
  step_pass "lint clean"
else
  step_fail "lint errors — see /tmp/deploy-check-lint.log (last 20 lines):"
  tail -20 /tmp/deploy-check-lint.log 2>/dev/null | sed 's/^/    /' || true
fi

# ─────────────────────────────────────────────────────────────
# Step 6: web build
# ─────────────────────────────────────────────────────────────
step_header "Step 6/7: web production build (next build)"
echo "  (next build can take 60-120s — this catches type/build errors before prod)"
if (cd "$WEB_DIR" && npm run build --silent >/tmp/deploy-check-build.log 2>&1); then
  step_pass "next build succeeded"
else
  step_fail "next build failed — see /tmp/deploy-check-build.log (last 30 lines):"
  tail -30 /tmp/deploy-check-build.log 2>/dev/null | sed 's/^/    /' || true
fi

# ─────────────────────────────────────────────────────────────
# Step 7: Supabase migration parity (optional)
# ─────────────────────────────────────────────────────────────
step_header "Step 7/7: Supabase migration parity (best-effort)"
MIGRATIONS_DIR="$WEB_DIR/supabase/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  step_skip "no $MIGRATIONS_DIR/ — nothing to compare"
else
  LOCAL_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')
  if ! command -v supabase >/dev/null 2>&1 && ! (cd "$WEB_DIR" && npx --no-install supabase --version >/dev/null 2>&1); then
    step_skip "supabase CLI not installed — $LOCAL_COUNT local migration(s) found, cannot compare against remote. Apply via MCP or `npx supabase db push` after deploy."
  else
    # Try `supabase migration list` (requires linked project). Don't fail hard
    # if it errors — most likely "not linked" which is fine.
    if (cd "$WEB_DIR" && npx --no-install supabase migration list >/tmp/deploy-check-supabase.log 2>&1); then
      step_pass "supabase migration list ran (review /tmp/deploy-check-supabase.log for any unapplied)"
    else
      step_skip "supabase migration list failed (project not linked? offline?). $LOCAL_COUNT local migration(s) found — verify manually before deploy."
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "${BLUE}Deploy readiness summary${RESET}"
echo "${BLUE}══════════════════════════════════════════════════${RESET}"
echo "  ${GREEN}PASS:${RESET}  $PASS_COUNT"
echo "  ${RED}FAIL:${RESET}  $FAIL_COUNT"
echo "  ${YELLOW}WARN:${RESET}  $WARN_COUNT"
echo "  ${YELLOW}SKIP:${RESET}  $SKIP_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo
  echo "${RED}Failed steps:${RESET}"
  for s in "${FAILED_STEPS[@]}"; do
    echo "  - $s"
  done
  echo
  echo "${RED}DO NOT push or run deploy-crialook.sh until all FAIL items are resolved.${RESET}"
  echo "Owner reference: ops/deploy.md"
  exit 1
fi

echo
echo "${GREEN}All checks passed. Ready to:${RESET}"
echo "  git push origin main"
echo "  ssh root@crialook.com.br 'cd /srv/crialook/Agencia-Fashion && bash deploy-crialook.sh'"
echo "(See ops/deploy.md for normal-deploy + rollback paths)"
exit 0
