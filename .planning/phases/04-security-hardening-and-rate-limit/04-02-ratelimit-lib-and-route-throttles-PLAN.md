---
plan_id: 04-02
phase: 4
title: Postgres rate-limit helper + claim-mini-trial throttle + cron secret hardening
wave: 2
depends_on: [04-01]
owner_action: false
files_modified:
  - campanha-ia/src/lib/rate-limit-pg.ts
  - campanha-ia/src/lib/rate-limit-pg.test.ts
  - campanha-ia/src/lib/cf-ip.ts
  - campanha-ia/src/lib/cf-ip.test.ts
  - campanha-ia/src/app/api/campaign/generate/route.ts
  - campanha-ia/src/app/api/credits/claim-mini-trial/route.ts
  - campanha-ia/src/app/api/cron/exchange-rate/route.ts
  - campanha-ia/docs/ratelimit.md
autonomous: true
requirements: [H-8, "D-04", "D-05", "D-06", "D-07", "D-08", "D-20", "D-21", "D-22", "D-23"]
must_haves:
  truths:
    - "rate-limit-pg.ts exports `consumeTokenBucket(key, capacity, refillRate, refillIntervalSec)` returning `{ allowed, remaining, retryAfterMs }`"
    - "/api/campaign/generate uses Postgres bucket (not the in-memory Map) and prefers cf-connecting-ip"
    - "/api/campaign/generate rejects unauthenticated requests in production (IS_DEMO_MODE no longer the only gate)"
    - "/api/credits/claim-mini-trial is throttled and requires email_verified === true"
    - "/api/cron/exchange-rate accepts only Authorization: Bearer (no ?secret=)"
    - "docs/ratelimit.md documents the Postgres → Redis migration path"
  acceptance:
    - "vitest covers cf-ip parsing (cf-connecting-ip preferred over x-forwarded-for)"
    - "vitest covers consumeTokenBucket happy/blocked path"
    - "tsc --noEmit exits 0"
    - "grep `?secret=` in cron/exchange-rate returns 0 matches"
---

# Plan 04-02: Postgres Rate-Limit Helper + Route-Level Throttles + Cron Secret

## Objective

Replace the in-memory rate-limit Map with a Postgres-backed token bucket helper, gate `/api/campaign/generate` behind `auth().userId` (D-21), throttle `/api/credits/claim-mini-trial` + require email verification (D-22), and remove the `?secret=` query-param path on `/api/cron/exchange-rate` (D-23). Document the future Redis migration path (D-08).

## Truths the executor must respect

- The in-memory limiter at `src/lib/rate-limit.ts` STAYS as the brute-force `checkLoginRateLimit` for editor-auth (M-8 — out of scope here). Only `checkRateLimit` (the IP-based campaign anti-abuse counter) migrates.
- Cloudflare-aware: read `cf-connecting-ip` first, fall back to `x-forwarded-for` first hop, then `x-real-ip`, then `unknown` (D-06).
- The Postgres helper MUST short-circuit if the RPC errors — fail OPEN for paying users (avoid false 429 on DB blip), but log via Sentry. For anon abuse we fail CLOSED (the bucket is the only gate).
- D-22 email verification: read `session.sessionClaims.email_verified` (Clerk JWT claim shape) — NOT `session.user.emailAddresses[].verification.status`, which requires a server fetch.
- NO supabase migration in this plan (04-01 created the RPC + table).

## Tasks

### Task 1: Create `cf-ip.ts` IP extraction helper

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts (lines 56-60 — current x-forwarded-for parsing)
- campanha-ia/src/lib/observability.ts (logger usage convention)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-06)
</read_first>

<action>
Create `campanha-ia/src/lib/cf-ip.ts` with:

```typescript
/**
 * Phase 4 D-06: Cloudflare-aware client-IP extraction.
 *
 * Order of preference (most trustworthy first):
 *   1. cf-connecting-ip — set by Cloudflare proxy. Single IP, always real client.
 *   2. x-forwarded-for first hop — nginx-forwarded chain. Comma-separated; take left-most.
 *   3. x-real-ip — fallback for non-CF non-nginx setups.
 *   4. "unknown" — last-resort sentinel (DO NOT use as a rate-limit key in prod;
 *      callers should treat "unknown" as a single shared bucket and fail-closed).
 *
 * Why cf-connecting-ip is preferred: behind Cloudflare, $remote_addr at nginx is
 * Cloudflare's edge IP, NOT the user. All CF-fronted users would share one bucket
 * (H-8 / CONCERNS §6) without this header preference.
 */

import type { NextRequest } from "next/server";

export function getClientIp(req: Request | NextRequest): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim().length > 0) return cfIp.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && first.length > 0) return first;
  }

  const xreal = req.headers.get("x-real-ip");
  if (xreal && xreal.trim().length > 0) return xreal.trim();

  return "unknown";
}
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/cf-ip.ts`
- File exports `getClientIp(req: Request | NextRequest): string`
- Function returns `cf-connecting-ip` when present (first preference)
- Function returns first comma-segment of `x-forwarded-for` when CF header absent
- Function returns `"unknown"` as last-resort sentinel
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 2: Test `getClientIp` precedence

<read_first>
- campanha-ia/src/lib/mp-signature.test.ts (vitest pattern with header mocking)
- campanha-ia/src/lib/cf-ip.ts (the helper — confirm shape before testing)
</read_first>

<action>
Create `campanha-ia/src/lib/cf-ip.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getClientIp } from "./cf-ip";

function mkReq(headers: Record<string, string>): Request {
  return new Request("http://x.test", { headers });
}

describe("getClientIp (D-06 CF-aware)", () => {
  it("prefers cf-connecting-ip", () => {
    const req = mkReq({
      "cf-connecting-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2, 3.3.3.3",
      "x-real-ip": "4.4.4.4",
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to first hop of x-forwarded-for", () => {
    const req = mkReq({ "x-forwarded-for": "9.9.9.9, 10.10.10.10" });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    const req = mkReq({ "x-real-ip": "5.5.5.5" });
    expect(getClientIp(req)).toBe("5.5.5.5");
  });

  it("returns 'unknown' when all headers absent", () => {
    const req = mkReq({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace in x-forwarded-for first hop", () => {
    const req = mkReq({ "x-forwarded-for": "  7.7.7.7  , 8.8.8.8" });
    expect(getClientIp(req)).toBe("7.7.7.7");
  });
});
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/cf-ip.test.ts`
- `cd campanha-ia && npx vitest run src/lib/cf-ip.test.ts` exits 0 with 5 passing cases
</acceptance_criteria>

---

### Task 3: Create `rate-limit-pg.ts` Postgres token-bucket helper

<read_first>
- campanha-ia/src/lib/webhooks/dedup.ts (createAdminClient + RPC call pattern)
- campanha-ia/src/lib/observability.ts (captureError + logger.warn)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-04, D-05)
- campanha-ia/supabase/migrations/20260504_180100_create_consume_rate_limit_token_rpc.sql (RPC return shape — TABLE(allowed, remaining, retry_after_ms))
</read_first>

<action>
Create `campanha-ia/src/lib/rate-limit-pg.ts`:

```typescript
/**
 * Phase 4 D-04 / D-05: Postgres-backed token bucket via consume_rate_limit_token RPC.
 *
 * Why: in-memory Map (src/lib/rate-limit.ts) loses state on PM2 restart (H-8).
 * Cloudflare also collapses every CF-fronted user to one bucket without
 * cf-connecting-ip preference (D-06).
 *
 * Failure mode: RPC errors → fail OPEN (return allowed=true) BUT capture via Sentry.
 * For anon-abuse the bucket is the gate of last resort, but a DB blip should NOT
 * 429 paying users. Caller decides on stricter behavior if the use case is more
 * sensitive (e.g., login brute-force should fail closed).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";

export interface BucketResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function consumeTokenBucket(
  key: string,
  capacity: number,
  refillRate: number,
  refillIntervalSec: number,
): Promise<BucketResult> {
  if (!key) {
    throw new Error("consumeTokenBucket: key required");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_rate_limit_token", {
    p_key: key,
    p_capacity: capacity,
    p_refill_rate: refillRate,
    p_refill_interval_seconds: refillIntervalSec,
  });
  if (error) {
    captureError(error, { route: "rate-limit-pg", key, phase: "rpc" });
    logger.warn("ratelimit_pg_rpc_error_failopen", { key, message: error.message });
    return { allowed: true, remaining: capacity - 1, retryAfterMs: 0 };
  }
  // .rpc on TABLE returns array of rows
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { allowed: true, remaining: capacity - 1, retryAfterMs: 0 };
  }
  return {
    allowed: !!row.allowed,
    remaining: Number(row.remaining ?? 0),
    retryAfterMs: Number(row.retry_after_ms ?? 0),
  };
}
```

Then update the placeholder test from 04-01 task 6 (`src/lib/rate-limit-pg.test.ts`) to actually exercise the helper. Replace the file contents with:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));
vi.mock("@/lib/observability", () => ({
  captureError: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { consumeTokenBucket } from "./rate-limit-pg";

beforeEach(() => {
  rpcMock.mockReset();
});

describe("consumeTokenBucket (D-05 wrapper)", () => {
  it("returns allowed when RPC returns allowed=true row", async () => {
    rpcMock.mockResolvedValue({ data: [{ allowed: true, remaining: 4, retry_after_ms: 0 }], error: null });
    const r = await consumeTokenBucket("test:1", 5, 1, 1);
    expect(r).toEqual({ allowed: true, remaining: 4, retryAfterMs: 0 });
  });

  it("returns blocked with retry_after_ms when RPC returns allowed=false", async () => {
    rpcMock.mockResolvedValue({ data: [{ allowed: false, remaining: 0, retry_after_ms: 1500 }], error: null });
    const r = await consumeTokenBucket("test:2", 5, 1, 1);
    expect(r).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1500 });
  });

  it("fails open on RPC error (does not 429 on DB blip)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom", code: "PGRST500" } });
    const r = await consumeTokenBucket("test:3", 5, 1, 1);
    expect(r.allowed).toBe(true);
  });

  it("throws on empty key", async () => {
    await expect(consumeTokenBucket("", 5, 1, 1)).rejects.toThrow(/key required/);
  });
});
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/rate-limit-pg.ts`
- File exports `consumeTokenBucket(key, capacity, refillRate, refillIntervalSec): Promise<BucketResult>`
- File exports `BucketResult` interface with `allowed: boolean, remaining: number, retryAfterMs: number`
- File contains `captureError(error, ...)` for the error branch (Sentry signal)
- `cd campanha-ia && npx vitest run src/lib/rate-limit-pg.test.ts` exits 0 with 4 passing cases
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 4: Migrate `/api/campaign/generate` to Postgres bucket + auth gate (D-21)

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts (lines 1-100 — current rate-limit + IS_DEMO_MODE gating)
- campanha-ia/src/lib/cf-ip.ts (just created — IP extraction)
- campanha-ia/src/lib/rate-limit-pg.ts (just created — Postgres bucket)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-04, D-06, D-20, D-21)
- .planning/codebase/CONCERNS.md (§6 — IS_DEMO_MODE never fires in prod, anon abuse counter must persist)
</read_first>

<action>
Edit `campanha-ia/src/app/api/campaign/generate/route.ts`:

1. Add imports near the top (alongside existing imports):
   ```typescript
   import { getClientIp } from "@/lib/cf-ip";
   import { consumeTokenBucket } from "@/lib/rate-limit-pg";
   ```

2. REMOVE the `import { checkRateLimit } from "@/lib/rate-limit";` import.

3. Replace the current rate-limit block (lines ~55-67, the `const ip = ... checkRateLimit(...)` block) with:
   ```typescript
   // ── Auth gate (D-21): demo mode is dev-only; production requires userId ──
   if (!IS_DEMO_MODE && !clerkUserId) {
     return NextResponse.json({ error: "Não autenticado", code: "UNAUTHORIZED" }, { status: 401 });
   }

   // ── Rate limit (D-04 Postgres bucket; D-06 CF-aware; D-20 anon counter survives PM2 restart) ──
   const clientIp = getClientIp(request);
   const bucketKey = clerkUserId
     ? `generate:user:${clerkUserId}`
     : `generate:ip:${clientIp}`;
   // Anon: 3 / hour. Auth: 15 / hour. Hourly window via 1 token per (3600/cap) seconds.
   const isAuth = !!clerkUserId;
   const capacity = isAuth ? 15 : 3;
   const refillIntervalSec = Math.floor(3600 / capacity); // 1 token every (3600/cap) seconds
   const bucket = await consumeTokenBucket(bucketKey, capacity, 1, refillIntervalSec);
   if (!bucket.allowed) {
     const retryMin = Math.ceil(bucket.retryAfterMs / 60000);
     return NextResponse.json({
       error: `Muitas gerações recentes. Tente novamente em ${retryMin} minuto${retryMin > 1 ? "s" : ""}.`,
       code: "RATE_LIMITED",
     }, { status: 429 });
   }
   ```

4. Confirm no other call to the in-memory `checkRateLimit` remains in this file.

DO NOT delete `src/lib/rate-limit.ts` — `checkLoginRateLimit` is still used by editor-auth.
</action>

<acceptance_criteria>
- `grep -n "checkRateLimit" campanha-ia/src/app/api/campaign/generate/route.ts` returns 0 matches
- `grep -n "consumeTokenBucket" campanha-ia/src/app/api/campaign/generate/route.ts` returns at least 1 match
- `grep -n "getClientIp" campanha-ia/src/app/api/campaign/generate/route.ts` returns at least 1 match
- File contains the D-21 auth gate: an early `if (!IS_DEMO_MODE && !clerkUserId)` returning 401 BEFORE any quota / pipeline logic
- File contains `bucketKey = clerkUserId ? \`generate:user:\${clerkUserId}\` : \`generate:ip:\${clientIp}\``
- `cd campanha-ia && npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 5: Throttle `/api/credits/claim-mini-trial` + require email_verified (D-22)

<read_first>
- campanha-ia/src/app/api/credits/claim-mini-trial/route.ts (current handler — no throttle, no email verify)
- campanha-ia/src/lib/rate-limit-pg.ts (helper just created)
- campanha-ia/src/lib/cf-ip.ts (helper just created)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-22)
</read_first>

<action>
Edit `campanha-ia/src/app/api/credits/claim-mini-trial/route.ts`. The handler must:

1. After the `auth()` call but BEFORE the killswitch check, read `session.sessionClaims.email_verified` (or `session.sessionClaims?.public_metadata?.email_verified` — read whichever shape Clerk currently emits). If not strictly `true`, return:
   ```json
   { "granted": false, "reason": "email_not_verified" }
   ```
   with status 200.

2. After the email check passes but BEFORE the killswitch check, throttle via Postgres bucket. Use:
   - Key: `mini-trial:user:${userId}` (per-user, not per-IP — trials are 1 per clerk_user_id anyway)
   - Capacity: 3 attempts
   - Refill rate: 1 token per 3600 seconds (1/hour)
   - On `!bucket.allowed`, return `{ granted: false, reason: "throttled" }` status 429 with `Retry-After` header set to `Math.ceil(bucket.retryAfterMs / 1000)`.

3. Replace the `import { auth } from "@clerk/nextjs/server"` line — also import `getClientIp` from `@/lib/cf-ip` (in case email-verified path needs IP for log only) and `consumeTokenBucket` from `@/lib/rate-limit-pg`.

4. Add a `logger.info("mini_trial_email_unverified", { user_id: userId })` log line on the email-not-verified rejection so ops can see the deny rate.

The exact placement of the new code, in order: `auth()` → email-verified check → throttle check → existing killswitch → existing slots/RPC logic.
</action>

<acceptance_criteria>
- `grep -n "email_not_verified" campanha-ia/src/app/api/credits/claim-mini-trial/route.ts` returns at least 1 match
- `grep -n "consumeTokenBucket" campanha-ia/src/app/api/credits/claim-mini-trial/route.ts` returns at least 1 match
- `grep -n "mini-trial:user:" campanha-ia/src/app/api/credits/claim-mini-trial/route.ts` returns at least 1 match
- `grep -n "Retry-After" campanha-ia/src/app/api/credits/claim-mini-trial/route.ts` returns at least 1 match
- `grep -n "email_verified" campanha-ia/src/app/api/credits/claim-mini-trial/route.ts` returns at least 1 match
- `tsc --noEmit` exits 0
- Email-verified check happens BEFORE the killswitch check (verify by line ordering — `email_verified` keyword precedes `MINI_TRIAL_KILLSWITCH` keyword)
</acceptance_criteria>

---

### Task 6: Drop `?secret=` query-string path on `/api/cron/exchange-rate` (D-23)

<read_first>
- campanha-ia/src/app/api/cron/exchange-rate/route.ts (current handler with both Authorization + ?secret= paths)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-23)
</read_first>

<action>
Edit `campanha-ia/src/app/api/cron/exchange-rate/route.ts`. The handler currently accepts EITHER `Authorization: Bearer <CRON_SECRET>` OR `?secret=<CRON_SECRET>`. After the edit it MUST accept ONLY `Authorization: Bearer`.

Replace the auth block with:

```typescript
// D-23: ?secret= query-string path removed (leaks via referrer / proxy logs).
// Authorization header only.
const authHeader = request.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Remove the `const url = new URL(request.url);` and `const secret = url.searchParams.get("secret");` lines — they are no longer needed.

Update the comment block at the top of the file to reflect that `?secret=` is no longer supported (specifically, edit the line "Proteção: verifica CRON_SECRET header ou query param" to "Proteção: verifica CRON_SECRET via Authorization: Bearer (D-23)").

If a Vercel/Inngest cron config references `?secret=` somewhere in the repo, surface that as a follow-up note in the verification log (do NOT migrate the config in this plan — only the route).
</action>

<acceptance_criteria>
- `grep -n "searchParams.get" campanha-ia/src/app/api/cron/exchange-rate/route.ts` returns 0 matches
- `grep -n "secret !== cronSecret" campanha-ia/src/app/api/cron/exchange-rate/route.ts` returns 0 matches
- `grep -n "?secret=" campanha-ia/src/app/api/cron/exchange-rate/route.ts` returns 0 matches
- File contains `if (cronSecret && authHeader !== \`Bearer ${cronSecret}\`)`
- File comment block references D-23
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 7: Document Postgres → Redis migration path (D-08)

<read_first>
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-08)
- campanha-ia/docs/supabase-inventory.md (existing docs convention)
</read_first>

<action>
Create `campanha-ia/docs/ratelimit.md` with:

```markdown
# Rate Limit — Postgres token bucket (Phase 4 D-04/D-05)

## Current implementation

Token bucket via SECURITY DEFINER RPC `consume_rate_limit_token(key, capacity, refill_rate, refill_interval_seconds)`.
State persists in `rate_limit_buckets`. Service-role-only writes (RLS enabled, no policies).

Helper: `src/lib/rate-limit-pg.ts` → `consumeTokenBucket(key, capacity, refillRate, refillIntervalSec)`.

Failure mode: RPC error → fail OPEN (return allowed=true) + Sentry `ratelimit_pg_rpc_error_failopen`.
This avoids 429-ing paying users on a DB blip; for anon-abuse the bucket is the only gate.

## When to migrate to Redis (D-08, parking lot)

Symptoms:
- p95 RPC latency on `consume_rate_limit_token` > 20ms (target: ≤10ms per D-05).
- `rate_limit_buckets` row count > 100k and growing (no GC cron yet).
- DB CPU spikes on POST-heavy traffic spikes.

Migration path (NOT executed in M1):
1. Add `REDIS_URL` env var; install `ioredis` or `@upstash/redis`.
2. Mirror `consumeTokenBucket` API exactly — caller (e.g., `/api/campaign/generate`) only needs to swap the import.
3. Use Lua `EVAL` for atomic refill + decrement (single round-trip, mirrors D-05).
4. Run both backends in parallel for 1 week (write to both, read from Postgres, log divergence).
5. Cut over reads when divergence < 0.1%.

## GC sweep (parking lot)

Cron `DELETE FROM rate_limit_buckets WHERE updated_at < now() - interval '24 hours'` keeps the table bounded.
Index `idx_rate_limit_buckets_updated_at` already exists for this. Schedule: nightly via Vercel Cron or Inngest.
Not in M1 — table will grow ~100 rows/day per active user, well within free tier for months.
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/docs/ratelimit.md`
- File contains sections "Current implementation", "When to migrate to Redis", "GC sweep"
- File references D-04, D-05, D-08 by ID
- File documents the fail-open behavior (non-trivial detail for ops)
</acceptance_criteria>

---

## Verification

After all 7 tasks complete:

1. `cd campanha-ia && npx tsc --noEmit` exits 0.
2. `cd campanha-ia && npx vitest run src/lib/cf-ip.test.ts src/lib/rate-limit-pg.test.ts` — all 9 cases pass.
3. `grep -rn "checkRateLimit" campanha-ia/src/app/api/campaign/generate/` returns 0 matches.
4. `grep -rn "?secret=" campanha-ia/src/app/api/cron/exchange-rate/route.ts` returns 0 matches.
5. Manual smoke (post-owner-push of 04-01 migrations): hammer `/api/campaign/generate` from anon IP — get 200 first 3 times, 429 on 4th. Restart PM2. 4th attempt still returns 429 (proves bucket survived restart, closes H-8).
6. Mini-trial happy path: with `email_verified=true`, hit `/api/credits/claim-mini-trial` 4 times in quick succession — first 3 attempts processed, 4th returns 429 with Retry-After header.

## must_haves

```yaml
truths:
  - cf_ip_helper_prefers_cf_connecting_ip
  - rate_limit_pg_helper_fails_open_on_rpc_error
  - generate_route_uses_postgres_bucket_not_in_memory_map
  - generate_route_rejects_unauthenticated_in_production
  - claim_mini_trial_throttled_and_email_verify_required
  - cron_exchange_rate_only_accepts_authorization_header
acceptance:
  - tsc_no_emit_exit_zero
  - cf_ip_test_5_passing
  - rate_limit_pg_test_4_passing
  - no_in_memory_checkRateLimit_in_generate_route
  - no_query_secret_in_exchange_rate_route
```
