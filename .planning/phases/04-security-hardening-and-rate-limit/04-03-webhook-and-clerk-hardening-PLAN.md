---
plan_id: 04-03
phase: 4
title: Clerk webhook timestamp-skew + MP webhook reaffirm + webhook/admin tests
wave: 2
depends_on: [04-01]
owner_action: false
files_modified:
  - campanha-ia/src/app/api/webhooks/clerk/route.ts
  - campanha-ia/src/app/api/webhooks/clerk/route.test.ts
  - campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts
  - campanha-ia/src/app/api/admin/settings/route.test.ts
autonomous: true
requirements: [H-5, H-14, "D-01", "D-02", "D-03", "D-24"]
must_haves:
  truths:
    - "Clerk webhook rejects requests with svix-timestamp older than 5min OR newer than 30s into the future (replay defense)"
    - "MP webhook test asserts D-03 empty x-request-id rejection (regression guard for what P1 already shipped)"
    - "Clerk webhook test covers signature failure + dedup + timestamp skew + happy path"
    - "Admin route 403 test exists for /api/admin/settings (proves guard wires through)"
  acceptance:
    - "vitest covers all four test scenarios (clerk: 4 cases, mp x-request-id: 1 case, admin 403: 1 case)"
    - "tsc --noEmit exits 0"
    - "Clerk route uses 5min skew = 300_000 ms exactly, future tolerance = 30_000 ms"
---

# Plan 04-03: Webhook Timestamp Skew + Test Coverage

## Objective

1. Add Svix timestamp-skew check (D-24) to the Clerk webhook handler. Currently the handler validates HMAC + dedup but accepts arbitrarily-old `svix-timestamp` headers — replay window is unbounded by time.
2. Reaffirm D-01..D-03 (MP webhook replay defense via `webhook_events` provider='mp') is wired correctly. P1 already delivered this; we only add a regression test for the empty `x-request-id` rejection (H-14) so future refactors don't silently un-do it.
3. Add the missing CONCERNS §12 test coverage: clerk webhook test cases + admin route 403 test.

D-02 (`mp_webhook_seen` view) is NOT created — no caller reads MP-only events; the unified `webhook_events WHERE provider='mp'` query is sufficient (per D-02 "only if any code/query reads it").

## Truths the executor must respect

- Clerk timestamp skew: 5 minutes past (`300_000` ms) + 30 seconds future tolerance (clock drift). Reject outside that window.
- The clerk webhook already deduplicates via `dedupWebhook("clerk", svixId)`. Timestamp skew is layered defense — it does NOT replace dedup.
- MP webhook is ALREADY hardened (P1 commit `e7c2938` + downstream commits). This plan only adds a regression test, NOT new logic in `mercadopago/route.ts`.
- Admin route 403 test must exercise the actual `requireAdmin` guard (no mocking the guard itself — only mock the Clerk auth() return).
- Clerk SDK quirk: `auth()` returns `sessionClaims` whose shape is `{ metadata, publicMetadata, email_verified, ... }` depending on JWT template. Tests must mock the shape that matches what `requireAdmin` reads.

## Tasks

### Task 1: Add Svix timestamp-skew check to Clerk webhook handler

<read_first>
- campanha-ia/src/app/api/webhooks/clerk/route.ts (current handler — confirm absence of timestamp check; lines 31-58 = verifyClerkSignature)
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (lines 55-62 — pattern for early-return-on-invalid-header)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-24)
- .planning/audits/MONOREPO-BUG-BASH.md (H-5 — replay protection rationale)
</read_first>

<action>
Edit `campanha-ia/src/app/api/webhooks/clerk/route.ts`. After the `verifyClerkSignature` returns true and `eventId` is set, BEFORE `JSON.parse(payload)`, insert a timestamp-skew check.

Add a constant near the top of the file (after the `import` block):
```typescript
// D-24: Svix recommends ±5 minutes. We use 5min past + 30s future for clock drift.
const CLERK_SVIX_MAX_PAST_MS = 5 * 60 * 1000;     // 300_000
const CLERK_SVIX_MAX_FUTURE_MS = 30 * 1000;       // 30_000
```

Inside `POST(req)`, after `if (!verifyClerkSignature(...)) { return 401 }` and before `const eventId = svixId as string;`, add:

```typescript
// D-24: timestamp-skew check (replay defense).
// svix-timestamp is unix seconds. Reject if too old or far in the future.
const tsSec = svixTimestamp ? Number.parseInt(svixTimestamp, 10) : NaN;
if (!Number.isFinite(tsSec)) {
  logger.warn("clerk_webhook_invalid_timestamp", { svixId, svixTimestamp });
  return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
}
const tsMs = tsSec * 1000;
const nowMs = Date.now();
if (tsMs < nowMs - CLERK_SVIX_MAX_PAST_MS || tsMs > nowMs + CLERK_SVIX_MAX_FUTURE_MS) {
  logger.warn("clerk_webhook_timestamp_skew", {
    svixId,
    svixTimestamp,
    skew_ms: nowMs - tsMs,
  });
  return NextResponse.json({ error: "Timestamp out of range" }, { status: 401 });
}
```
</action>

<acceptance_criteria>
- File `campanha-ia/src/app/api/webhooks/clerk/route.ts` contains `CLERK_SVIX_MAX_PAST_MS = 5 * 60 * 1000`
- File contains `CLERK_SVIX_MAX_FUTURE_MS = 30 * 1000`
- File contains `clerk_webhook_timestamp_skew` log key
- Timestamp check is positioned AFTER `verifyClerkSignature` succeeds, BEFORE `JSON.parse(payload)` and BEFORE `dedupWebhook`
- Returns 400 for non-numeric timestamp, 401 for skew-out-of-range
- `cd campanha-ia && npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 2: Add unit tests for Clerk webhook (skew + happy + dedup + sig)

<read_first>
- campanha-ia/src/app/api/webhooks/clerk/route.ts (post-task-1 state)
- campanha-ia/src/app/api/webhooks/clerk/route.test.ts (existing P1 tests — extend, do not replace)
- campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts (mock pattern for createAdminClient + verifier)
</read_first>

<action>
Edit (or extend) `campanha-ia/src/app/api/webhooks/clerk/route.test.ts`. Add a `describe("Phase 4 D-24 timestamp skew", ...)` block with the following cases. Reuse the mocking infrastructure already present in the file (the existing P1 tests mock `createStore`, `getStoreByClerkId`, `dedupWebhook`, etc.).

Each new case must:
- Construct a payload + valid HMAC using the same secret and helper functions the existing tests use.
- Set `svix-timestamp` header to a controlled value (use `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-05-04T12:00:00Z"))` to anchor `Date.now()`).

Cases to add:

1. **`rejects timestamp older than 5 minutes (returns 401)`** — set svix-timestamp to `Math.floor(Date.now() / 1000) - 301`, expect status 401, body `{ error: /Timestamp out of range/ }`.
2. **`rejects timestamp more than 30s in the future (returns 401)`** — set svix-timestamp to `Math.floor(Date.now() / 1000) + 31`, expect status 401.
3. **`accepts timestamp at the boundary (5min past, allowed)`** — set svix-timestamp to `Math.floor(Date.now() / 1000) - 299`, expect status 200 (NOT 401). The dedup mock should return `{ duplicate: false }` and the user.created handler should fire.
4. **`rejects non-numeric timestamp (returns 400)`** — set svix-timestamp to `"not-a-number"`, expect status 400.

After the new cases, restore real timers (`vi.useRealTimers()`) in `afterEach`.

Confirm existing P1 cases still pass.
</action>

<acceptance_criteria>
- `cd campanha-ia && npx vitest run src/app/api/webhooks/clerk/route.test.ts` exits 0
- Test file contains `describe("Phase 4 D-24 timestamp skew"` (or equivalent)
- Test file contains at least 4 new `it(...)` cases covering: too old, too future, boundary accept, malformed
- `vi.useFakeTimers()` and `vi.setSystemTime(...)` are used
- `vi.useRealTimers()` is called in `afterEach` (or equivalent cleanup)
- Pre-existing P1 clerk tests still pass (no regression)
</acceptance_criteria>

---

### Task 3: Add MP-webhook regression test for empty `x-request-id` (H-14 reaffirm)

<read_first>
- campanha-ia/src/app/api/webhooks/mercadopago/route.ts (lines 55-62 — current empty x-request-id rejection)
- campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts (P1 mock pattern)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-03)
</read_first>

<action>
Add to `campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts` a single new case in the existing top-level describe block (or a new `describe("Phase 4 D-03 empty x-request-id"`). Body:

```typescript
it("rejects empty x-request-id with 400 BEFORE signature validation (H-14, D-03)", async () => {
  const req = new NextRequest("http://x.test/api/webhooks/mercadopago", {
    method: "POST",
    headers: { "x-request-id": "" }, // explicitly empty
    body: JSON.stringify({ type: "payment", data: { id: "evt_xx" } }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.error).toMatch(/missing x-request-id/i);
});
```

If the existing P1 test already covers this exact case (search for `missing x-request-id`), DO NOT duplicate — just add a comment in the file pointing at the existing case so future refactors don't remove it without thinking.
</action>

<acceptance_criteria>
- `cd campanha-ia && npx vitest run src/app/api/webhooks/mercadopago/route.test.ts` exits 0
- `grep -n "missing x-request-id" campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts` returns at least 1 match
- Test asserts status 400 (NOT 401 — empty header is handled BEFORE signature validation per H-14)
</acceptance_criteria>

---

### Task 4: Add admin route 403 test (CONCERNS §12)

<read_first>
- campanha-ia/src/lib/admin/guard.ts (requireAdmin shape — what it checks, what it returns)
- campanha-ia/src/app/api/admin/settings/route.ts (lines 27-32 — the 403 path; uses `requireAdmin().isAdmin === false`)
- campanha-ia/src/app/api/webhooks/clerk/route.test.ts (mocking @clerk/nextjs/server pattern)
</read_first>

<action>
Create `campanha-ia/src/app/api/admin/settings/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Default-non-admin claims; per-test override sets userId / role.
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

// Stub Supabase admin client so the GET path doesn't try to talk to a real DB.
const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

import { GET } from "./route";

beforeEach(() => {
  authMock.mockReset();
  fromMock.mockReset();
});

describe("/api/admin/settings — 403 for non-admin (CONCERNS §12)", () => {
  it("returns 403 when no session", async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: null });
    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Acesso negado/i);
  });

  it("returns 403 when user is logged in but not admin (no metadata.role)", async () => {
    authMock.mockResolvedValue({
      userId: "user_nonadmin",
      sessionClaims: { metadata: {}, publicMetadata: {} },
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("allows admin via publicMetadata.role='admin'", async () => {
    authMock.mockResolvedValue({
      userId: "user_admin",
      sessionClaims: { metadata: {}, publicMetadata: { role: "admin" } },
    });
    // Stub the admin_settings select chain
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    fromMock.mockReturnValue({ select: selectMock });
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/app/api/admin/settings/route.test.ts`
- `cd campanha-ia && npx vitest run src/app/api/admin/settings/route.test.ts` exits 0
- 3 cases passing (no-session 403, non-admin-logged 403, admin allowed)
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

## Verification

After all 4 tasks complete:

1. `cd campanha-ia && npx tsc --noEmit` exits 0.
2. `cd campanha-ia && npx vitest run` — all webhook + admin tests pass; no pre-existing test regressions.
3. Static check: `grep -n "CLERK_SVIX_MAX_PAST_MS\|CLERK_SVIX_MAX_FUTURE_MS" campanha-ia/src/app/api/webhooks/clerk/route.ts` returns at least 2 matches (one declaration, one+ usage).
4. Static check: `grep -n "missing x-request-id" campanha-ia/src/app/api/webhooks/mercadopago/route.test.ts` returns at least 1 match.

## must_haves

```yaml
truths:
  - clerk_webhook_rejects_skewed_timestamp
  - clerk_webhook_rejects_malformed_timestamp
  - clerk_webhook_test_covers_4_d24_cases
  - mp_webhook_test_covers_d03_empty_request_id_regression
  - admin_settings_route_test_covers_3_403_cases
acceptance:
  - tsc_no_emit_exit_zero
  - all_clerk_webhook_tests_pass
  - all_mp_webhook_tests_pass
  - all_admin_settings_tests_pass
```
