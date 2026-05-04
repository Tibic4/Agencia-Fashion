# Clerk Client Trust — Server-Side Compensating Controls

**Last verified:** 2026-05-03
**Audit owner:** Phase 06 (Mobile Auth Stability & Tests) → M2 Phase 1 closed gaps 2 + 3
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
- **Last verified:** 2026-05-03

### Control 2 — Per-user rate limiting on /billing/verify and /billing/restore

- **What:** Prevent replay of leaked purchase tokens. Critical because the app trusts the server to verify (see `crialook-app/lib/billing.ts:128-131`).
- **Backend ref:**
  - `/billing/verify`: `campanha-ia/src/app/api/billing/verify/route.ts:62-79` — calls `consumeTokenBucket("billing.verify:${userId}", 30, 30, 300)` immediately after `auth()`, returns 429 + `Retry-After` header when bucket is empty. Bucket key is namespaced by route + scoped per Clerk userId.
  - `/billing/restore`: `campanha-ia/src/app/api/billing/restore/route.ts:48-65` — same shape: `consumeTokenBucket("billing.restore:${userId}", 30, 30, 300)`, 429 + `Retry-After` on empty.
  - Underlying RPC: `consume_rate_limit_token` (Postgres token bucket from M1 P4 D-04 / D-05). Helper at `campanha-ia/src/lib/rate-limit-pg.ts`. Capacity = 30 / refill 30 every 300s — generous for legitimate Play Store re-tries while capping brute-force on stolen tokens.
- **Tests:** `campanha-ia/src/app/api/billing/verify/route.test.ts` (M2 Phase 1: rate limit) and `campanha-ia/src/app/api/billing/restore/route.test.ts` cover the 429 path with mocked bucket empty and assert the `Retry-After` header value.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-03 (M2 Phase 1)

### Control 3 — Hash-bound purchase verification (obfuscatedAccountIdAndroid)

- **What:** Backend MUST check `obfuscatedAccountIdAndroid` from the Google Play API response === `SHA256(currentClerkUserId).slice(0,64)`. Mobile produces it (`crialook-app/lib/billing.ts:108-110`). Without backend validation, a captured `purchaseToken` can be replayed by another user.
- **Backend ref:**
  - `campanha-ia/src/app/api/billing/verify/route.ts:21-35` defines `expectedObfuscatedAccountId(userId)` — `crypto.createHash('sha256').update(userId).digest('hex').slice(0,64)` (mirrors mobile `hashUserIdForBilling`).
  - `campanha-ia/src/app/api/billing/verify/route.ts:110-141` runs the comparison immediately after `verifySubscription(sku, purchaseToken)` returns; both missing field and mismatch reject with HTTP 403 + body `{ code: "OBFUSCATED_ID_MISMATCH" }`. Sentry breadcrumb fires with tag `billing.obfuscated_mismatch=true` and only hash presence/length is logged (never the actual hash, to avoid correlating to a leaked token's legitimate owner).
  - Play API plumbing: `campanha-ia/src/lib/payments/google-play.ts` — `PlaySubscriptionStatus.obfuscatedExternalAccountId?: string` (interface field) and the `verifySubscription` mapper now propagates it from the v3 SubscriptionPurchase response.
  - `/billing/restore` deliberately does NOT enforce this check — restore replays purchases the user already owns from Google's purchase ledger, and adding the check would brick legitimate restores from accounts that purchased before the obfuscated-id rollout. Documented inline in `campanha-ia/src/app/api/billing/restore/route.test.ts`.
- **Tests:** `campanha-ia/src/app/api/billing/verify/route.test.ts` ("M2 Phase 1: obfuscated hash (control 3)") covers both the mismatched-hash and missing-field paths and asserts no DB writes occur.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-03 (M2 Phase 1)

### Control 4 — Per-user generation quota enforcement server-side

- **What:** Frontend shows quota UI but the source of truth is the backend; the JWT `sub` is the only trustworthy identity claim.
- **Backend ref:** `campanha-ia/src/app/api/campaign/generate/route.ts:235` calls `consumeCredit(store.id, "campaigns")` BEFORE the actual generation runs; `incrementCampaignsUsed(store.id)` at lines 258 and 1087 commits the usage. The store is resolved from `auth().userId` via `getStoreByClerkId`. Frontend `campaignsLeft` UI value is never trusted.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-03

### Control 5 — No client-emittable plan/tier flags

- **What:** The user's plan tier must be derived from `/billing/verify` results stored server-side, never from client-supplied JSON.
- **Backend ref:** `campanha-ia/src/app/api/store/route.ts:7-14` — `StorePatchSchema` (zod) whitelists ONLY `name`, `city`, `state`, `instagram`, `segment`, `brand_colors`. Any `plan` / `tier` / `plan_id` / `subscription_status` field in the request body is silently dropped by zod's strict shape (no `.passthrough()`). The `safeParse` rejects any extra keys via the schema validation. PATCH handler at lines 48-94 only writes the whitelisted fields.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-03

### Control 6 — Push-token replay protection

- **What:** `apiPost('/store/push-token', { token })` MUST be tied to the JWT user ID server-side; never accept tokens without auth.
- **Backend ref:** `campanha-ia/src/app/api/store/push-token/route.ts:31` calls `auth()`; lines 32-34 return 401 if no userId; line 67 upserts with `clerk_user_id: userId` (server-derived from JWT, NOT from request body). The body.token is validated for length and shape (lines 59-61) but the user binding is always server-derived.
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-03

### Control 7 — Webhook signature on Clerk webhooks

- **What:** Backend creates store-shadow on Clerk `user.created` webhook; webhook MUST validate Svix signature, otherwise an attacker can forge "user created" events.
- **Backend ref:** `campanha-ia/src/app/api/webhooks/clerk/route.ts:35-62` defines `verifyClerkSignature` with HMAC-SHA256 over `${svixId}.${svixTimestamp}.${payload}` using the `CLERK_WEBHOOK_SECRET` (base64-decoded after stripping the `whsec_` prefix). Constant-time comparison via `timingSafeEqual` at line 56. Called at line 72 — returns 401 immediately if any of svix-id / svix-timestamp / svix-signature headers is missing OR if HMAC mismatch. Additional ±5min timestamp skew check at lines 80+ (D-24 replay defense).
- **Status:** LIVE
- **Owner:** backend
- **Last verified:** 2026-05-03

## Re-verification protocol

Before re-enabling Clerk Client Trust (per `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md`):

1. Re-walk each control above. Confirm the `path:line` ref still resolves to the same defensive code (refactor drift can move things).
2. For any control marked MISSING or PARTIAL, the gap MUST be closed in backend BEFORE flipping Client Trust on. Reopening Client Trust without these controls re-introduces the (already-mitigated) attack surface.
3. Update the "Last verified" date on each row.
4. Get written sign-off from the backend team on the row deltas.

## Summary (post M2 Phase 1, 2026-05-03)

| # | Control | Status | Owner-action |
|---|---------|--------|--------------|
| 1 | JWT validation | LIVE | — |
| 2 | Rate-limit billing/verify+restore | LIVE | — (closed in M2 Phase 1) |
| 3 | obfuscatedAccountIdAndroid hash binding | LIVE | — (closed in M2 Phase 1) |
| 4 | Server-side generation quota | LIVE | — |
| 5 | No client-emittable plan/tier | LIVE | — |
| 6 | Push-token replay | LIVE | — |
| 7 | Clerk webhook Svix signature | LIVE | — |

All 7 controls now LIVE. The original blockers for the Clerk Client Trust re-enable runbook (controls 2 + 3) closed in M2 Phase 1 — see `.planning/phases/m2-01-backend-security-gaps/` for landed commits and test deltas.

## References

- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §4 (compensating controls source)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §11 (re-enable plan)
- `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` (consumer of this checklist — see plan 06-05)
- `MEMORY.md` `project_clerk_client_trust.md`
- `crialook-app/lib/auth.tsx:38-43` (the inline comment block explaining why Client Trust is off)
- `crialook-app/lib/billing.ts:108-110` (where mobile produces `obfuscatedAccountIdAndroid` for control 3)
