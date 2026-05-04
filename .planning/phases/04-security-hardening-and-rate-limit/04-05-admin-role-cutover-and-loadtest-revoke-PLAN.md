---
plan_id: 04-05
phase: 4
title: Admin role cutover (publicMetadata canonical) + .env.loadtest revoke + Sentry deny logging
wave: 3
depends_on: [04-01, 04-02, 04-03, 04-04]
owner_action: true
files_modified:
  - campanha-ia/src/lib/admin/guard.ts
  - campanha-ia/src/middleware.ts
  - campanha-ia/docs/admin-role-migration.md
  - campanha-ia/src/lib/admin/guard.test.ts
autonomous: false
requirements: [M-16, "D-09", "D-10", "D-11", "D-12", "D-13", "D-14"]
must_haves:
  truths:
    - "publicMetadata.role === 'admin' is the canonical admin check (D-09)"
    - "ADMIN_USER_IDS path remains as break-glass; emits Sentry warn `admin.breakglass_used` in production when used (D-10)"
    - "Every 403 from /api/admin/* emits Sentry warn `admin.deny` with route + userId_hash + reason (D-12)"
    - "loadtests/.env.loadtest revoke: Clerk session(s) revoked in Clerk Dashboard (owner-action, manual)"
    - "docs/admin-role-migration.md documents the Clerk Dashboard publicMetadata.role population step (D-11)"
  acceptance:
    - "guard.ts unit test: publicMetadata.role accepted; metadata.role accepted (back-compat); ADMIN_USER_IDS accepted with breakglass warn"
    - "tsc --noEmit exits 0"
    - "owner has confirmed (by signing off this plan after running the manual checkpoints) that .env.loadtest sessions are revoked AND publicMetadata.role is set on existing admins"
---

# Plan 04-05: Admin Role Canonicalization + Loadtest Cleanup + Sentry Deny Logging

## Objective

Three intertwined changes that close the remaining Phase 4 gaps:

1. **D-09/D-10/D-11 admin role cutover** — `publicMetadata.role === 'admin'` becomes canonical. `ADMIN_USER_IDS` env stays as break-glass with Sentry warn on use in production. Owner adds `publicMetadata.role` to existing admin users via Clerk Dashboard (manual, post-deploy).
2. **D-12 Sentry deny logging** — every 403 from `/api/admin/*` emits a Sentry warn (currently no audit trail).
3. **D-13/D-14 .env.loadtest cleanup** — file is NOT in git history (already gitignored, never committed — confirmed via `git ls-files`). The remaining work is owner-action: revoke the live Clerk session(s) the file references in Clerk Dashboard. NO `git filter-repo` needed.

## Context surprise vs CONTEXT.md

CONTEXT D-13 step 4 said "git filter-repo to remove from full history". Research R-01 confirmed: **the file was never committed** (only `loadtests/.env.loadtest.example` is tracked; `.env.loadtest` is in `.gitignore` and absent from `git log --all`). So step 4 is unnecessary. Step 2 (revoke session) is still required because the on-disk file contains LIVE production Clerk session JWTs (issuer `clerk.crialook.com.br`, multiple `__session` cookies, user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3 etc) that may have been pasted into other artifacts (chat history, screen-shares) outside the repo.

## Truths the executor must respect

- Tasks marked `owner-action: true` MUST be flagged to the user and STOP execution rather than performing them. The executor cannot revoke a Clerk session or set publicMetadata in Clerk Dashboard.
- D-09 says publicMetadata is canonical — but D-10 says ADMIN_USER_IDS stays as break-glass. So the guard checks BOTH; the difference is which path triggers a Sentry signal.
- Sentry warn key naming follows existing convention: `admin.deny`, `admin.breakglass_used` (no underscores between words within the dot — already used in Sentry tags).
- `userId_hash` for Sentry tag = first 12 chars of SHA-256(userId). Don't ship raw userId to Sentry tags (PII reduction).
- The Phase 4 admin/settings test (Plan 04-03 Task 4) already covers the basic 403 path. This plan extends `requireAdmin` to emit Sentry on deny — the existing test should still pass (Sentry is mocked), and a new test asserts the Sentry call.

## Tasks

### Task 1: Refactor `requireAdmin` — publicMetadata canonical + breakglass warn + deny logging

<read_first>
- campanha-ia/src/lib/admin/guard.ts (entire file — current shape)
- campanha-ia/src/lib/observability.ts (logger.warn + captureMessage / captureError convention; verify Sentry severity)
- campanha-ia/src/middleware.ts (lines 121-130 — the parallel admin check inside middleware)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-09, D-10, D-12)
</read_first>

<action>
Rewrite `campanha-ia/src/lib/admin/guard.ts`:

```typescript
/**
 * Admin guard — Phase 4 D-09/D-10/D-12.
 *
 * D-09: publicMetadata.role === 'admin' (or 'super_admin') is CANONICAL.
 *       sessionClaims.metadata.role is also accepted for back-compat with the
 *       Clerk JWT template that emits `metadata` instead of `publicMetadata`.
 * D-10: ADMIN_USER_IDS env stays as BREAK-GLASS. In production, using it emits
 *       a Sentry warn `admin.breakglass_used` so security knows when the safety
 *       net was needed.
 * D-12: every deny emits Sentry warn `admin.deny` (route, userId_hash, reason).
 *
 * The guard does NOT distinguish 'admin' from 'super_admin' — both are admins
 * here. Future RBAC layering can split them in a separate decision.
 */

import { auth } from "@clerk/nextjs/server";
import { createHash } from "crypto";
import { logger } from "@/lib/observability";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const IS_PROD = process.env.NODE_ENV === "production";

function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function emitDeny(reason: string, userId: string | null, route: string): void {
  logger.warn("admin.deny", {
    route,
    userId_hash: userId ? hashUserId(userId) : null,
    reason,
  });
}

function emitBreakglass(userId: string, route: string): void {
  if (!IS_PROD) return; // dev: env var works as today, no signal
  logger.warn("admin.breakglass_used", {
    route,
    userId_hash: hashUserId(userId),
  });
}

export type AdminCheck =
  | { isAdmin: true; userId: string; via: "publicMetadata" | "metadata" | "breakglass" }
  | { isAdmin: false; userId: null };

/**
 * Verifica se o user atual é admin.
 * `route` é o path do handler chamando o guard — usado nos signals Sentry.
 */
export async function requireAdmin(route: string = "unknown"): Promise<AdminCheck> {
  const session = await auth();
  if (!session.userId) {
    emitDeny("no_session", null, route);
    return { isAdmin: false, userId: null };
  }

  // 1. Canonical: publicMetadata.role
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const publicMetadata = claims?.publicMetadata as { role?: string } | undefined;
  const publicRole = publicMetadata?.role;
  if (publicRole === "admin" || publicRole === "super_admin") {
    return { isAdmin: true, userId: session.userId, via: "publicMetadata" };
  }

  // 2. Back-compat: sessionClaims.metadata.role (some Clerk JWT templates use `metadata`)
  const metadata = claims?.metadata as { role?: string } | undefined;
  const metaRole = metadata?.role;
  if (metaRole === "admin" || metaRole === "super_admin") {
    return { isAdmin: true, userId: session.userId, via: "metadata" };
  }

  // 3. Break-glass: ADMIN_USER_IDS env
  if (ADMIN_USER_IDS.includes(session.userId)) {
    emitBreakglass(session.userId, route);
    return { isAdmin: true, userId: session.userId, via: "breakglass" };
  }

  emitDeny("not_admin", session.userId, route);
  return { isAdmin: false, userId: null };
}
```

Existing callers like `/api/admin/settings/route.ts` call `await requireAdmin()` with no argument. Backward-compatible: `route` defaults to `"unknown"`. As a follow-up (NOT in this task), the admin route handlers can pass `requireAdmin("/api/admin/settings")` for richer Sentry data — leaving that as a TODO comment in `guard.ts` is fine.
</action>

<acceptance_criteria>
- `campanha-ia/src/lib/admin/guard.ts` contains `function emitDeny`, `function emitBreakglass`, `function hashUserId`
- `requireAdmin` returns shape `{ isAdmin, userId, via }` on success (`via: 'publicMetadata' | 'metadata' | 'breakglass'`)
- `requireAdmin` returns `{ isAdmin: false, userId: null }` on deny AND emits `logger.warn("admin.deny", ...)`
- Break-glass path emits `logger.warn("admin.breakglass_used", ...)` ONLY when `NODE_ENV === 'production'`
- `userId_hash` is exactly first 12 chars of SHA-256
- The previous `metadata.role || publicMetadata.role` precedence is FLIPPED — publicMetadata is now canonical (checked first)
- All 3 existing tests in `src/app/api/admin/settings/route.test.ts` still pass (back-compat for `metadata.role`)
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 2: Mirror the canonical/breakglass logic in `middleware.ts`

<read_first>
- campanha-ia/src/middleware.ts (lines 108-135 — the admin check inside the middleware)
- campanha-ia/src/lib/admin/guard.ts (post-Task-1 state — same logic must mirror)
- campanha-ia/src/lib/observability.ts
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-09, D-12)
</read_first>

<action>
Edit `campanha-ia/src/middleware.ts`. Inside `clerkMiddleware`, in the `if (isAdminRoute(request))` branch (lines 108-135):

1. Reorder the admin precedence to match the new guard.ts:
   - First check `publicMetadata.role` (canonical)
   - Then `metadata.role` (back-compat)
   - Then `ADMIN_USER_IDS` (break-glass) — emit `admin.breakglass_used` if in prod
2. On final deny (the existing `if (!isAdmin) return redirectTo("/", request)`), emit `admin.deny` with route + userId_hash + reason BEFORE redirecting.

Add the helper imports at the top of the file:
```typescript
import { createHash } from "crypto";
```

Add a small helper inside the file (or extract — at developer discretion):
```typescript
function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}
```

The middleware uses `console.warn` today rather than the `logger` module (some Edge runtime constraints). Use `console.warn` with the same shape: `console.warn("admin.deny", { route, userId_hash, reason })` and `console.warn("admin.breakglass_used", { route, userId_hash })`. If `logger` is importable in the middleware bundle, prefer that — otherwise console.warn is acceptable and Sentry's logger integration captures it.
</action>

<acceptance_criteria>
- `grep -n "publicMetadata" campanha-ia/src/middleware.ts` shows `publicMetadata.role` checked BEFORE `metadata.role` and BEFORE `ADMIN_USER_IDS`
- `grep -n "admin.deny" campanha-ia/src/middleware.ts` returns at least 1 match
- `grep -n "admin.breakglass_used" campanha-ia/src/middleware.ts` returns at least 1 match
- `grep -n "hashUserId" campanha-ia/src/middleware.ts` returns at least 2 matches (1 declaration, 1+ usage)
- `tsc --noEmit` exits 0
- Pre-existing middleware behavior preserved: non-admin still redirects to `/`, no-session still redirects to `/sign-in`
</acceptance_criteria>

---

### Task 3: Add tests for the new guard.ts behavior

<read_first>
- campanha-ia/src/app/api/admin/settings/route.test.ts (mocking pattern for @clerk/nextjs/server)
- campanha-ia/src/lib/admin/guard.ts (post-Task-1 state)
- campanha-ia/src/lib/observability.ts (logger shape — for assertion)
</read_first>

<action>
Create `campanha-ia/src/lib/admin/guard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const loggerWarnMock = vi.fn();
vi.mock("@/lib/observability", () => ({
  logger: { warn: loggerWarnMock, info: vi.fn(), error: vi.fn() },
}));

import { requireAdmin } from "./guard";

beforeEach(() => {
  authMock.mockReset();
  loggerWarnMock.mockReset();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ADMIN_USER_IDS", "user_breakglass_1,user_breakglass_2");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdmin (D-09/D-10/D-12)", () => {
  it("admits via publicMetadata.role='admin' (canonical)", async () => {
    authMock.mockResolvedValue({
      userId: "u1",
      sessionClaims: { publicMetadata: { role: "admin" }, metadata: {} },
    });
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("publicMetadata");
    expect(loggerWarnMock).not.toHaveBeenCalled(); // no deny, no breakglass
  });

  it("admits via metadata.role='admin' (back-compat)", async () => {
    authMock.mockResolvedValue({
      userId: "u2",
      sessionClaims: { metadata: { role: "admin" }, publicMetadata: {} },
    });
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("metadata");
  });

  it("admits via ADMIN_USER_IDS break-glass + emits admin.breakglass_used in prod (D-10)", async () => {
    authMock.mockResolvedValue({
      userId: "user_breakglass_1",
      sessionClaims: { publicMetadata: {}, metadata: {} },
    });
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("breakglass");
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "admin.breakglass_used",
      expect.objectContaining({ route: "/api/admin/foo" }),
    );
  });

  it("does NOT emit breakglass warn in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    authMock.mockResolvedValue({
      userId: "user_breakglass_1",
      sessionClaims: { publicMetadata: {}, metadata: {} },
    });
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    expect(loggerWarnMock).not.toHaveBeenCalledWith("admin.breakglass_used", expect.anything());
  });

  it("denies + emits admin.deny when no session", async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: null });
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(false);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "admin.deny",
      expect.objectContaining({ route: "/api/admin/foo", reason: "no_session", userId_hash: null }),
    );
  });

  it("denies + emits admin.deny with hashed userId when not admin", async () => {
    authMock.mockResolvedValue({
      userId: "u_outsider",
      sessionClaims: { publicMetadata: { role: "user" }, metadata: {} },
    });
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(false);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "admin.deny",
      expect.objectContaining({
        route: "/api/admin/foo",
        reason: "not_admin",
        userId_hash: expect.stringMatching(/^[a-f0-9]{12}$/),
      }),
    );
  });

  it("publicMetadata wins over conflicting metadata role", async () => {
    authMock.mockResolvedValue({
      userId: "u3",
      sessionClaims: { publicMetadata: { role: "admin" }, metadata: { role: "user" } },
    });
    const r = await requireAdmin();
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("publicMetadata");
  });
});
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/admin/guard.test.ts`
- `cd campanha-ia && npx vitest run src/lib/admin/guard.test.ts` exits 0 with 7 passing cases
- Tests cover: publicMetadata accept, metadata accept, breakglass accept + warn (prod), breakglass accept no-warn (dev), no-session deny + log, non-admin deny + hashed log, publicMetadata wins precedence
</acceptance_criteria>

---

### Task 4: Document admin role migration runbook (D-11)

<read_first>
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-11)
- campanha-ia/docs/supabase-inventory.md (docs convention)
</read_first>

<action>
Create `campanha-ia/docs/admin-role-migration.md`:

```markdown
# Admin Role Migration — Phase 4 D-09/D-11

## What changed

Before Phase 4, admin status was checked in this order:
1. `ADMIN_USER_IDS` env var (CSV of Clerk user IDs)
2. `sessionClaims.metadata.role` or `sessionClaims.publicMetadata.role` === `"admin"` / `"super_admin"`

After Phase 4 (D-09): `publicMetadata.role` is the **canonical** source. `ADMIN_USER_IDS` stays as break-glass.

## Owner action: populate publicMetadata.role on existing admins

Run ONCE post-deploy. For every Clerk user ID currently in `ADMIN_USER_IDS`:

1. Open Clerk Dashboard → Users → search user → Edit user.
2. Under "Public metadata" (NOT "Private metadata"), add JSON:
   ```json
   { "role": "admin" }
   ```
   (Or `"super_admin"` if you want to differentiate later — both are treated equal today.)
3. Save. The user's next session refresh (~1min, or sign-out + sign-in) propagates the claim.

## Verification

After population, in production:
- Hit `/api/admin/settings` while signed in as a migrated admin user → expect 200.
- Sentry filter for `admin.breakglass_used` over the next 7 days. If a user appears there, they are NOT yet migrated (their access went through the env-var fallback).
- After 7 clean days (no breakglass events), `ADMIN_USER_IDS` can be SHRUNK to a 1-2-user emergency list (super-admin owner).

## Rollback

If publicMetadata propagation has issues in production:
- Re-add affected user IDs to `ADMIN_USER_IDS` env var (PM2 reload to pick up).
- The break-glass warn will fire — that's the signal that ops needs to investigate.
- No code rollback required; the guard checks both paths.

## Why publicMetadata over privateMetadata

`publicMetadata` is included in the JWT (`sessionClaims`) the client receives. That's what server middleware reads without a Clerk API roundtrip. `privateMetadata` requires `clerkClient().users.getUser(id)` per request — too expensive for middleware that runs on every protected route hit.

Risk: anything in `publicMetadata` is visible to the client. `role: "admin"` reveals a user is privileged — acceptable for our threat model (privilege is enforced server-side; client visibility is not a leak).

## Related

- D-09 / D-10 / D-12 in `.planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md`
- `src/lib/admin/guard.ts`
- `src/middleware.ts` (parallel admin check)
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/docs/admin-role-migration.md`
- File contains sections "What changed", "Owner action", "Verification", "Rollback", "Why publicMetadata over privateMetadata"
- File references D-09, D-10, D-11, D-12 by ID
- File documents the exact Clerk Dashboard JSON shape: `{ "role": "admin" }` under publicMetadata
</acceptance_criteria>

---

### Task 5: [OWNER-ACTION] Revoke Clerk session(s) referenced in `loadtests/.env.loadtest` (D-13/D-14)

<read_first>
- loadtests/.env.loadtest (the on-disk file — DO NOT commit, NOT in git history)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-13, D-14)
- campanha-ia/docs/admin-role-migration.md (post-Task-4 state — ops checklist)
</read_first>

<action>
**THIS TASK IS OWNER-ACTION. The executor MUST flag this and STOP rather than perform.**

Manual steps for the owner:

1. **DO NOT** run `git filter-repo` — confirmed via `git log --all -- loadtests/.env.loadtest`: file was NEVER committed (only `loadtests/.env.loadtest.example` is tracked). The file is already covered by `loadtests/.gitignore` line 4 (`.env.loadtest`).

2. Open `loadtests/.env.loadtest` and identify every Clerk session JWT and refresh cookie. Audit findings (per R-01):
   - Multiple `__session_<instance>` JWTs (issuers `clerk.crialook.com.br` AND `casual-vervet-96.clerk.accounts.dev`)
   - Multiple `__client_uat_<instance>` and `__client_uat` cookies
   - `__refresh_<instance>` refresh token
   - `clerk_active_context` session pointer
   - PostHog distinct_id cookie (`distinct_id: user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3`) — NOT a credential, but identifies the live user whose session was captured

3. **Open Clerk Dashboard for the production instance** (`clerk.crialook.com.br`):
   - Users → search `user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3` (subject of the prod __session JWT)
   - Sessions tab → revoke ALL active sessions for that user
   - Confirm the user receives a sign-out on next page load

4. **Open Clerk Dashboard for the dev instance** (`casual-vervet-96.clerk.accounts.dev`):
   - Same drill for `user_3BuUmVnqcFeMEV72k5Hkqw4kzP1` (subject of the dev __session JWT)

5. After revoking, replace the contents of `loadtests/.env.loadtest` with empty placeholders (or delete the file entirely — it's gitignored, no risk):
   ```bash
   cat > loadtests/.env.loadtest <<'EOF'
   # Phase 4 D-13: file purged after live-session revoke. See docs/admin-role-migration.md.
   # Re-populate with FRESH session cookies via the loadtests/README.md capture flow if running tests.
   COOKIE_HEADER=
   EOF
   ```

6. **Communicate any other place those JWTs may have been pasted** (chat scrollback, video recordings, screenshare, terminal scrollback). If the JWTs were ever shared outside the local repo, those copies are still hot until the session revoke completes.

The executor MUST surface these steps in the task output and STOP. Do NOT attempt to use `mcp__supabase` or any Clerk-related MCP tool to revoke; the Clerk MCP is not wired and the action requires Clerk Dashboard auth.

After the owner confirms completion (verbal sign-off or commit message acknowledging), this task is "done" for verification purposes.
</action>

<acceptance_criteria>
- This task is marked `owner-action: true` in YAML frontmatter (parent plan)
- Executor produces a structured output that:
  - Lists each credential found in `.env.loadtest` (per the R-01 audit)
  - Identifies the two Clerk user IDs (prod + dev) whose sessions need revoke
  - Provides the exact Clerk Dashboard navigation path
  - Confirms `git filter-repo` is NOT needed (file never committed)
- Executor STOPS and returns control to owner before proceeding to verification
- After owner sign-off, `loadtests/.env.loadtest` either does not exist OR contains only the placeholder header above (no JWT bodies)
</acceptance_criteria>

---

### Task 6: [OWNER-ACTION] Populate publicMetadata.role on existing admins (D-11)

<read_first>
- campanha-ia/docs/admin-role-migration.md (post-Task-4 state — has the runbook)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-11)
</read_first>

<action>
**THIS TASK IS OWNER-ACTION. The executor MUST flag this and STOP rather than perform.**

Manual steps for the owner (one-time, post-deploy of plans 04-01..04-04):

1. Read the current value of `ADMIN_USER_IDS` env var in production (`.env.production` on the VPS, or PM2 process env).
2. For each user ID in that list, follow the runbook in `campanha-ia/docs/admin-role-migration.md` — Clerk Dashboard → User → Public metadata → `{ "role": "admin" }`.
3. Verify in Sentry over the following 24-48h: `admin.breakglass_used` events should approach 0 once propagation completes (sessions take up to 1min for sessionClaims to refresh).
4. Once `admin.breakglass_used` is 0 for 7 days AND every admin has confirmed access still works via the publicMetadata path, OPTIONALLY shrink `ADMIN_USER_IDS` to a 1-2 user emergency list (owner only).

The executor MUST surface this as a checklist and STOP. Do NOT attempt to call Clerk APIs from the executor — the operation requires Dashboard interactive auth.
</action>

<acceptance_criteria>
- Task is marked `owner-action: true` in YAML frontmatter (parent plan)
- Executor produces a checklist that:
  - References `campanha-ia/docs/admin-role-migration.md`
  - Lists the steps in order
  - Notes the Sentry follow-up window
- Executor STOPS and returns control to owner before claiming completion
- Owner sign-off (verbal or commit-message) marks this task done
</acceptance_criteria>

---

## Verification

After all 6 tasks complete (including owner sign-off on Tasks 5 + 6):

1. `cd campanha-ia && npx tsc --noEmit` exits 0.
2. `cd campanha-ia && npx vitest run src/lib/admin/ src/app/api/admin/` — all guard + admin route tests pass (10+ cases total: 7 from Task 3 + 3 from Plan 04-03 Task 4).
3. Static check: `grep -n "publicMetadata" campanha-ia/src/lib/admin/guard.ts | head -1` shows publicMetadata read BEFORE metadata.
4. Static check: `grep -rn "admin.deny\|admin.breakglass_used" campanha-ia/src/` returns matches in BOTH `guard.ts` AND `middleware.ts`.
5. File state: `loadtests/.env.loadtest` either is absent OR contains only the placeholder header (no JWT bodies, no `__session=eyJ...`). Verify with `head -3 loadtests/.env.loadtest` if present.
6. Owner-action log: a markdown bullet in the verification output records owner sign-off date for both manual steps.

## must_haves

```yaml
truths:
  - guard_publicMetadata_canonical_d09
  - guard_admin_user_ids_breakglass_with_prod_warn_d10
  - guard_emits_admin_deny_on_403_d12
  - middleware_admin_check_mirrors_guard_precedence
  - admin_role_migration_runbook_documented
  - loadtest_env_clerk_session_revoked_owner_action_d13
  - admin_publicMetadata_populated_owner_action_d11
acceptance:
  - tsc_no_emit_exit_zero
  - guard_test_7_passing
  - all_admin_route_tests_pass
  - no_filter_repo_needed_file_never_committed
  - owner_signoff_recorded_for_both_owner_action_tasks
```
