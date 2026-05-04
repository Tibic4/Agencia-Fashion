# Clerk Client Trust — Server-Side Compensating Controls

**Last verified:** 2026-05-04
**Audit owner:** Phase 06 (Mobile Auth Stability & Tests)
**Re-verification cadence:** before each Clerk Client Trust re-enable attempt (per `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` pre-flight)

## Why this doc exists

Per `MEMORY.md` `project_clerk_client_trust.md`, Clerk Client Trust is intentionally OFF in production to pass Play Store review. This trades ~100-400ms per `getToken()` for an explicit "client claims are not trusted" posture.

The 7 server-side compensating controls below MUST remain LIVE while Client Trust is OFF. They are the security floor — not optional. When Client Trust is eventually re-enabled (post-Play approval, see runbook), these controls stay; they are the security boundary, Client Trust is the perf optimization on top.

This doc is the **pre-flight checklist** for the re-enable runbook. Each control must be re-verified via the listed `path:line` ref before flipping Client Trust on.

## Controls

### Control 1 — Strict JWT validation on every request

- **What:** Verify Clerk JWT signature against JWKS, check `iss`, `aud`, `exp`, `nbf`. Reject on any mismatch with HTTP 401.
- **Backend ref:** `campanha-ia/src/app/api/billing/verify/route.ts:41` (and every other authed route — `store/route.ts:25`, `store/push-token/route.ts:31`, `campaign/generate/route.ts:67`) — `const { userId } = await auth();` from `@clerk/nextjs/server`. The Clerk server SDK validates signature against Clerk JWKS and enforces standard claim checks internally; routes return 401 immediately when `userId` is null.
- **Status:** LIVE
- **Owner:** backend (campanha-ia)
- **Last verified:** 2026-05-04

### Control 2 — Per-user rate limiting on /billing/verify and /billing/restore

- **What:** Prevent replay of leaked purchase tokens. Critical because the app trusts the server to verify (see `crialook-app/lib/billing.ts:128-131`).
- **Backend ref:** Rate-limit infrastructure exists at `campanha-ia/src/lib/rate-limit-pg.ts` and `campanha-ia/src/lib/rate-limit.ts`, but `campanha-ia/src/app/api/billing/verify/route.ts` and `campanha-ia/src/app/api/billing/restore/route.ts` do NOT call into it (no `rateLimit` / `tokenBucket` / `consumeToken` import or invocation found in either route). The routes rely on Clerk auth gating + the underlying Google Play API's own rate limits, but there is no per-user bucket on the verify/restore path itself.
- **Status:** **MISSING**
- **Owner:** backend — **owner-action required**
- **Recommended fix:** Wrap the POST handlers in `verify/route.ts` and `restore/route.ts` with a per-user rate limit (e.g. 10 req/min/user) using the existing `rate-limit-pg.ts` helper. Pattern: after `auth()` succeeds, `await consumeToken({ key: \`billing:verify:\${userId}\`, capacity: 10, refillPerSec: 0.17 })` and return 429 on bucket empty.
- **Last verified:** 2026-05-04

### Control 3 — Hash-bound purchase verification (obfuscatedAccountIdAndroid)

- **What:** Backend MUST check `obfuscatedAccountIdAndroid` from the Google Play API response === `SHA256(currentClerkUserId).slice(0,64)`. Mobile produces it (`crialook-app/lib/billing.ts:108-110`). Without backend validation, a captured `purchaseToken` can be replayed by another user.
- **Backend ref:** `campanha-ia/src/app/api/billing/verify/route.ts:39-153` reads `body.purchaseToken` and `body.sku`, calls `verifySubscription(sku, purchaseToken)` at line 73, but does NOT extract the `obfuscatedExternalAccountId` field from the Google Play API response and does NOT compare it to `SHA256(userId)`. The userId from `auth()` is stored in `subscriptions.clerk_user_id` (line 99) but the binding is "trust the request was authed", not "the purchaseToken was bound to this userId at purchase time".
- **Status:** **MISSING**
- **Owner:** backend — **owner-action required**
- **Recommended fix:** In `campanha-ia/src/app/api/billing/verify/route.ts`, after `const status = await verifySubscription(sku, purchaseToken);` (line 73), extract `status.obfuscatedExternalAccountId` (Google Play's field name) and verify it matches `crypto.createHash('sha256').update(userId).digest('hex').slice(0,64)`. Reject with 403 on mismatch. Also requires that `verifySubscription` in `lib/payments/google-play.ts` return the `obfuscatedExternalAccountId` field from the SubscriptionPurchase response.
- **Last verified:** 2026-05-04

### Control 4 — Per-user generation quota enforcement server-side

- **What:** Frontend shows quota UI but the source of truth is the backend; the JWT `sub` is the only trustworthy identity claim.
- **Backend ref:** `campanha-ia/src/app/api/campaign/generate/route.ts:235` calls `consumeCredit(store.id, "campaigns")` BEFORE the actual generation runs; `incrementCampaignsUsed(store.id)` at lines 258 and 1087 commits the usage. The store is resolved from `auth().userId` via `getStoreByClerkId`. Frontend `campaignsLeft` UI value is never trusted.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-04

### Control 5 — No client-emittable plan/tier flags

- **What:** The user's plan tier must be derived from `/billing/verify` results stored server-side, never from client-supplied JSON.
- **Backend ref:** `campanha-ia/src/app/api/store/route.ts:7-14` — `StorePatchSchema` (zod) whitelists ONLY `name`, `city`, `state`, `instagram`, `segment`, `brand_colors`. Any `plan` / `tier` / `plan_id` / `subscription_status` field in the request body is silently dropped by zod's strict shape (no `.passthrough()`). The `safeParse` rejects any extra keys via the schema validation. PATCH handler at lines 48-94 only writes the whitelisted fields.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-04

### Control 6 — Push-token replay protection

- **What:** `apiPost('/store/push-token', { token })` MUST be tied to the JWT user ID server-side; never accept tokens without auth.
- **Backend ref:** `campanha-ia/src/app/api/store/push-token/route.ts:31` calls `auth()`; lines 32-34 return 401 if no userId; line 67 upserts with `clerk_user_id: userId` (server-derived from JWT, NOT from request body). The body.token is validated for length and shape (lines 59-61) but the user binding is always server-derived.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-04

### Control 7 — Webhook signature on Clerk webhooks

- **What:** Backend creates store-shadow on Clerk `user.created` webhook; webhook MUST validate Svix signature, otherwise an attacker can forge "user created" events.
- **Backend ref:** `campanha-ia/src/app/api/webhooks/clerk/route.ts:35-62` defines `verifyClerkSignature` with HMAC-SHA256 over `${svixId}.${svixTimestamp}.${payload}` using the `CLERK_WEBHOOK_SECRET` (base64-decoded after stripping the `whsec_` prefix). Constant-time comparison via `timingSafeEqual` at line 56. Called at line 72 — returns 401 immediately if any of svix-id / svix-timestamp / svix-signature headers is missing OR if HMAC mismatch. Additional ±5min timestamp skew check at lines 80+ (D-24 replay defense).
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-04

## Re-verification protocol

Before re-enabling Clerk Client Trust (per `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md`):

1. Re-walk each control above. Confirm the `path:line` ref still resolves to the same defensive code (refactor drift can move things).
2. For any control marked MISSING or PARTIAL, the gap MUST be closed in backend BEFORE flipping Client Trust on. Reopening Client Trust without these controls re-introduces the (already-mitigated) attack surface.
3. Update the "Last verified" date on each row.
4. Get written sign-off from the backend team on the row deltas.

## Summary of gaps surfaced 2026-05-04

| # | Control | Status | Owner-action |
|---|---------|--------|--------------|
| 1 | JWT validation | LIVE | — |
| 2 | Rate-limit billing/verify+restore | **MISSING** | backend ticket: wrap POST handlers with per-user token bucket (10 req/min suggested) |
| 3 | obfuscatedAccountIdAndroid hash binding | **MISSING** | backend ticket: extract field from Google Play response + compare with SHA256(userId) |
| 4 | Server-side generation quota | LIVE | — |
| 5 | No client-emittable plan/tier | LIVE | — |
| 6 | Push-token replay | LIVE | — |
| 7 | Clerk webhook Svix signature | LIVE | — |

Both gaps are blockers for the Clerk Client Trust re-enable runbook. They are NOT blockers for Phase 06 completion (mobile-side audit doc) or Play Store submission (current "Client Trust off" posture masks the gaps in practice).

## References

- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §4 (compensating controls source)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §11 (re-enable plan)
- `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` (consumer of this checklist — see plan 06-05)
- `MEMORY.md` `project_clerk_client_trust.md`
- `crialook-app/lib/auth.tsx:38-43` (the inline comment block explaining why Client Trust is off)
- `crialook-app/lib/billing.ts:108-110` (where mobile produces `obfuscatedAccountIdAndroid` for control 3)
