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
