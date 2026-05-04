---
plan_id: 01-02
phase: 1
title: Webhook Dedup Helper Module
wave: 1
depends_on: []
files_modified:
  - campanha-ia/src/lib/webhooks/dedup.ts
  - campanha-ia/src/lib/webhooks/dedup.test.ts
autonomous: true
requirements: [C-1, C-2, C-3, C-4]
must_haves:
  truths:
    - "dedupWebhook(provider, eventId, payload) returns { duplicate: false } on first insert and { duplicate: true } on PG 23505 unique violation"
    - "markWebhookProcessed(provider, eventId) updates processed_at to now() and is safe to call multiple times"
    - "Helper does NOT swallow non-23505 errors — they bubble up so the handler can decide retry semantics"
  acceptance:
    - "Vitest run for lib/webhooks/dedup.test.ts exits 0 with all assertions passing"
    - "Helper file exports exactly two functions: dedupWebhook and markWebhookProcessed"
---

# Plan 01-02: Webhook Dedup Helper

## Objective

Provide a reusable `dedupWebhook(provider, eventId, payload)` helper that the MP, Clerk, and Google Play RTDN handlers (Wave 2) all consume. Centralizes the "INSERT first, ON CONFLICT → duplicate" pattern (D-06) and the "mark processed" reconcile signal (D-08).

This plan ships the helper + unit tests only. Wave 2 plans wire it into each webhook handler.

## Truths the executor must respect

- The helper relies on the `webhook_events` table created in 01-01. **Executor MUST NOT** start this plan until 01-01 task 5 (schema push) reports success — otherwise tests will fail with "relation does not exist."
- Use `createAdminClient()` from `@/lib/supabase/admin` (canonical pattern, NOT a top-level service-role `createClient`).
- Provider must be a string literal type union: `'mp' | 'clerk' | 'rtdn'`. No free-form strings.
- Helper must NOT call Sentry/`captureError` itself. Caller is responsible for telemetry — the helper only handles dedup mechanics.
- Test must mock `createAdminClient` (vitest pattern matches `lib/mp-signature.test.ts`). DO NOT hit the real database from unit tests.

## Tasks

### Task 1: Create the dedup helper module

<read_first>
- campanha-ia/src/lib/supabase/admin.ts (canonical createAdminClient pattern — lines 1-20)
- campanha-ia/src/lib/observability.ts (logger / captureError shape — used by callers, not by this helper)
- .planning/phases/01-payments-webhook-integrity/01-CONTEXT.md (D-05, D-06, D-07, D-08)
- .planning/phases/01-payments-webhook-integrity/01-RESEARCH.md (R-03)
</read_first>

<action>
Create `campanha-ia/src/lib/webhooks/dedup.ts` with EXACTLY this content:

```ts
/**
 * Phase 1 D-05/D-06/D-07: webhook event dedup helper.
 *
 * Pattern (per CONTEXT.md):
 *   1. Verify signature (caller).
 *   2. const { duplicate } = await dedupWebhook(provider, eventId, payload);
 *   3. if (duplicate) return 200 OK immediately.
 *   4. Process the event (caller).
 *   5. await markWebhookProcessed(provider, eventId) in finally.
 *
 * The PRIMARY KEY (provider, event_id) on webhook_events makes the INSERT the
 * dedup primitive — Postgres returns code 23505 (unique_violation) on the second
 * insert. We translate that into { duplicate: true }; any other DB error bubbles
 * up so the caller can decide between 200 (swallow per MP convention) and 5xx
 * (re-queue per RTDN convention).
 *
 * Service-role-only: webhook_events has RLS enabled with no policies. Only the
 * admin client (which bypasses RLS via service_role) can read/write. See
 * 20260503_180300_create_webhook_events.sql.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookProvider = "mp" | "clerk" | "rtdn";

export interface DedupResult {
  /** True iff the (provider, event_id) was already in webhook_events. */
  duplicate: boolean;
}

/**
 * Insert a webhook event into webhook_events.
 *
 * - Returns { duplicate: false } on first insert.
 * - Returns { duplicate: true } when the (provider, event_id) PK already exists
 *   (Postgres error code 23505).
 * - Throws on any other database error — caller decides 200 vs 5xx.
 */
export async function dedupWebhook(
  provider: WebhookProvider,
  eventId: string,
  payload: unknown
): Promise<DedupResult> {
  if (!eventId || typeof eventId !== "string") {
    throw new Error(`dedupWebhook: eventId must be a non-empty string (got ${JSON.stringify(eventId)})`);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_id: eventId,
      payload: payload as Record<string, unknown> | null,
    });

  if (!error) return { duplicate: false };
  // Postgres unique_violation
  if ((error as { code?: string }).code === "23505") return { duplicate: true };
  throw error;
}

/**
 * Mark a webhook event as fully processed. Idempotent: re-running just overwrites
 * processed_at with a newer timestamp.
 *
 * Caller MUST invoke this AFTER successful processing (in a `finally` is fine, but
 * skip if you want "ghost transactions" reconcile to surface failed handlers).
 */
export async function markWebhookProcessed(
  provider: WebhookProvider,
  eventId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_id", eventId);
  if (error) throw error;
}
```
</action>

<acceptance_criteria>
- File exists at exact path `campanha-ia/src/lib/webhooks/dedup.ts`
- File exports `WebhookProvider` type as `'mp' | 'clerk' | 'rtdn'`
- File exports `DedupResult` interface with single boolean field `duplicate`
- File exports `dedupWebhook(provider, eventId, payload)` and `markWebhookProcessed(provider, eventId)` — exactly two functions
- File contains `import { createAdminClient } from "@/lib/supabase/admin";`
- File does NOT contain any direct `createClient(` call (must go through canonical admin wrapper)
- File does NOT import from `@sentry/*` or `lib/observability` (helper stays telemetry-free)
- `tsc --noEmit` on the file passes (`cd campanha-ia && npx tsc --noEmit src/lib/webhooks/dedup.ts` — or `npm run typecheck` if the project provides one)
</acceptance_criteria>

---

### Task 2: Unit tests for dedup helper

<read_first>
- campanha-ia/src/lib/mp-signature.test.ts (vitest+mock pattern reference)
- campanha-ia/vitest.config.ts (test file glob and setup)
- campanha-ia/package.json (verify vitest is the test runner — search for "vitest" in scripts)
</read_first>

<action>
Create `campanha-ia/src/lib/webhooks/dedup.test.ts` with EXACTLY this content:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dedupWebhook, markWebhookProcessed } from "./dedup";

// ── Mock createAdminClient ──
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockEq2 = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: mockInsert,
      update: () => ({ eq: mockEq }),
    }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // chain .eq().eq() for the markWebhookProcessed update
  mockEq.mockReturnValue({ eq: mockEq2 });
  mockEq2.mockResolvedValue({ error: null });
});

describe("dedupWebhook", () => {
  it("returns { duplicate: false } on first insert", async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    const result = await dedupWebhook("mp", "req-abc-123", { foo: "bar" });
    expect(result).toEqual({ duplicate: false });
    expect(mockInsert).toHaveBeenCalledWith({
      provider: "mp",
      event_id: "req-abc-123",
      payload: { foo: "bar" },
    });
  });

  it("returns { duplicate: true } on Postgres 23505 unique_violation", async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: "23505", message: "unique violation" } });
    const result = await dedupWebhook("clerk", "msg_abc", { type: "user.created" });
    expect(result).toEqual({ duplicate: true });
  });

  it("throws on non-23505 database errors", async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: "57P01", message: "admin shutdown" } });
    await expect(dedupWebhook("rtdn", "pubsub-1", {})).rejects.toMatchObject({ code: "57P01" });
  });

  it("rejects empty eventId", async () => {
    await expect(dedupWebhook("mp", "", {})).rejects.toThrow(/non-empty string/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("accepts the three documented providers without TS error", async () => {
    mockInsert.mockResolvedValue({ error: null });
    await dedupWebhook("mp", "x", {});
    await dedupWebhook("clerk", "y", {});
    await dedupWebhook("rtdn", "z", {});
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });
});

describe("markWebhookProcessed", () => {
  // re-mock for these tests
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ eq: mockEq2 });
  });

  it("calls update with processed_at = ISO timestamp and filters by (provider, event_id)", async () => {
    mockEq2.mockResolvedValueOnce({ error: null });
    await markWebhookProcessed("mp", "req-abc-123");
    expect(mockEq).toHaveBeenCalledWith("provider", "mp");
    expect(mockEq2).toHaveBeenCalledWith("event_id", "req-abc-123");
  });

  it("throws when the underlying update reports an error", async () => {
    mockEq2.mockResolvedValueOnce({ error: { code: "X", message: "boom" } });
    await expect(markWebhookProcessed("clerk", "msg")).rejects.toMatchObject({ code: "X" });
  });
});
```
</action>

<acceptance_criteria>
- File exists at exact path `campanha-ia/src/lib/webhooks/dedup.test.ts`
- Running `cd campanha-ia && npx vitest run src/lib/webhooks/dedup.test.ts` exits 0
- Test file covers all three provider literals (`mp`, `clerk`, `rtdn`)
- Test file asserts the 23505 → `{ duplicate: true }` translation explicitly
- Test file asserts non-23505 errors propagate (do not become silent successes)
- Test file asserts empty `eventId` is rejected before the DB call
- No test hits the real database (all paths mock `@/lib/supabase/admin`)
</acceptance_criteria>

---

## Verification

1. `npx tsc --noEmit` (or `npm run typecheck`) in `campanha-ia/` passes with the new files added.
2. `npx vitest run src/lib/webhooks/dedup.test.ts` exits 0; all assertions green.
3. Static check: `grep -E "from ['\\\"]@/lib/observability" campanha-ia/src/lib/webhooks/dedup.ts` returns nothing (helper is telemetry-free).
4. Static check: `grep -E "createClient\\(" campanha-ia/src/lib/webhooks/dedup.ts` returns nothing (no top-level supabase client construction).

## must_haves

```yaml
truths:
  - dedup_helper_uses_admin_client
  - 23505_translated_to_duplicate_true
  - non_23505_errors_propagate
  - markwebhookprocessed_idempotent
acceptance:
  - vitest_dedup_test_exit_0
  - typecheck_passes_with_helper_present
  - no_direct_createclient_call_in_helper
```
