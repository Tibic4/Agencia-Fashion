---
plan_id: 04-05
phase: 4
status: complete
completed_at: 2026-05-03
owner_action: true
owner_action_pending:
  - clerk_session_revoke
  - clerk_publicMetadata_role_population
---

# Plan 04-05 — SUMMARY

## What was built (autonomous tasks 1-4)

1. `src/lib/admin/guard.ts` rewritten — publicMetadata.role canonical (D-09), back-compat metadata.role, ADMIN_USER_IDS as breakglass with `admin.breakglass_used` Sentry warn in production (D-10), every deny emits `admin.deny` with hashed userId (D-12).
2. `src/middleware.ts` mirrors the same precedence + emits `admin.deny` and `admin.breakglass_used` via `console.warn` (Edge runtime).
3. `src/lib/admin/guard.test.ts` — 7 cases covering all paths.
4. `docs/admin-role-migration.md` — runbook for owner D-11 manual step.

## Tasks deferred to owner action (5 + 6 — not executed by agent)

### Task 5: Revoke Clerk session(s) referenced in `loadtests/.env.loadtest` (D-13/D-14)

**Status: PENDING — owner action required.**

**Confirmed via R-01: file was NEVER committed.** `git log --all -- loadtests/.env.loadtest` returns empty; `loadtests/.gitignore` line 4 already covers it. **`git filter-repo` is NOT needed** (D-13 step 4 dropped per CONTEXT plan-checker note).

#### Owner checklist

1. Open `loadtests/.env.loadtest` (still on disk, ~3.2KB) and confirm credentials inventory:
   - Multiple `__session_<instance>` JWTs (issuers `clerk.crialook.com.br` AND `casual-vervet-96.clerk.accounts.dev`)
   - Multiple `__client_uat_<instance>` and `__client_uat` cookies
   - `__refresh_<instance>` refresh token
   - `clerk_active_context` session pointer
   - PostHog `distinct_id: user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3` (PII identifier; not a credential)

2. **Clerk Dashboard → production instance (`clerk.crialook.com.br`):**
   - Users → search `user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3`
   - Sessions tab → **revoke ALL active sessions**
   - Confirm sign-out propagates on next page load

3. **Clerk Dashboard → dev instance (`casual-vervet-96.clerk.accounts.dev`):**
   - Users → search `user_3BuUmVnqcFeMEV72k5Hkqw4kzP1`
   - Sessions tab → **revoke ALL active sessions**

4. After revoke, replace file contents with placeholder OR delete (gitignored):
   ```bash
   cat > loadtests/.env.loadtest <<'EOF'
   # Phase 4 D-13: file purged after live-session revoke. See docs/admin-role-migration.md.
   COOKIE_HEADER=
   EOF
   ```

5. Communicate to anyone the JWTs may have been pasted to (chat scrollback, screenshares, terminal scrollback) — those copies remain hot until revoke completes.

### Task 6: Populate publicMetadata.role on existing admins (D-11)

**Status: PENDING — owner action required.**

#### Owner checklist

1. Read current `ADMIN_USER_IDS` env value in production (`.env.production` on VPS or PM2 process env).
2. For EACH user ID, follow the runbook in `campanha-ia/docs/admin-role-migration.md`:
   - Clerk Dashboard → User → Public metadata → `{ "role": "admin" }`
3. Verify in Sentry over 24-48h: `admin.breakglass_used` events should approach 0.
4. After 7 clean days (no breakglass events), OPTIONALLY shrink `ADMIN_USER_IDS` to a 1-2-user emergency list.

## Key files created
- `campanha-ia/src/lib/admin/guard.test.ts`
- `campanha-ia/docs/admin-role-migration.md`

## Files modified
- `campanha-ia/src/lib/admin/guard.ts` (rewritten)
- `campanha-ia/src/middleware.ts` (admin precedence + logging)

## Deviations
- **D-13 step 4 dropped per CONTEXT plan-checker** (R-01 verified file was never committed). Documented in this SUMMARY and surfaced in owner checklist.

## Self-Check: PASSED (autonomous portion)
- `npx tsc --noEmit` exit 0
- `npx vitest run src/lib/admin/guard.test.ts` 7 cases passing
- Pre-existing admin/settings tests still pass (back-compat preserved)
- Owner-action tasks 5 + 6 surfaced as checklists; NOT executed.
