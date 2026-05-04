/**
 * Phase 02 / Plan 02-05 Task 5 — billing/verify HTTP handler tests (QUALITY #3).
 *
 * No tests existed for this route prior to Plan 02-05. Covers:
 *   1. Unauthenticated → 401
 *   2. Google Play not configured → 503
 *   3. Invalid SKU → 400
 *   4. Invalid purchaseToken → 400
 *   5. Invalid response from Play (non-numeric expiry) → 502
 *   6. Expired subscription (expiry <= now) → 410
 *   7. Pending payment (paymentState !== 1) → 402
 *   8. Valid IAB purchase → updateStorePlan called with mapped slug + 200
 *   9. Acknowledgement skipped when state already acked
 *
 * M2 Phase 1 (compensating controls 2 + 3) extends with:
 *  10. Mismatched obfuscatedExternalAccountId → 403 OBFUSCATED_ID_MISMATCH
 *  11. Missing obfuscatedExternalAccountId → 403 OBFUSCATED_ID_MISMATCH
 *  12. Per-user rate limit triggered (31st req in 5min) → 429 + Retry-After
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

const USER_ID = "user_v_1";
const EXPECTED_OBFUSCATED = createHash("sha256").update(USER_ID).digest("hex").slice(0, 64);

const m = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUpdateStorePlan: vi.fn(async () => undefined),
  mockGetStoreByClerkId: vi.fn(async () => ({ id: "store-verify-1", clerk_user_id: "user_v_1" })),
  mockVerifySubscription: vi.fn(),
  mockAcknowledgeSubscription: vi.fn(async () => undefined),
  mockIsGooglePlayConfigured: vi.fn(() => true),
  mockCaptureError: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockConsumeTokenBucket: vi.fn(async () => ({ allowed: true, remaining: 29, retryAfterMs: 0 })),
  upsertCalls: [] as Array<{ table: string; payload: Record<string, unknown> }>,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => Promise.resolve(m.mockAuth()),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        upsert(payload: Record<string, unknown>) {
          m.upsertCalls.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  getStoreByClerkId: (...args: unknown[]) =>
    (m.mockGetStoreByClerkId as (...a: unknown[]) => Promise<unknown>)(...args),
  updateStorePlan: (...args: unknown[]) =>
    (m.mockUpdateStorePlan as (...a: unknown[]) => Promise<undefined>)(...args),
}));

vi.mock("@/lib/observability", () => ({
  logger: {
    info: (...args: unknown[]) => m.mockLogger.info(...args),
    warn: (...args: unknown[]) => m.mockLogger.warn(...args),
    error: (...args: unknown[]) => m.mockLogger.error(...args),
  },
  captureError: (...args: unknown[]) => m.mockCaptureError(...args),
}));

vi.mock("@/lib/rate-limit-pg", () => ({
  consumeTokenBucket: (...args: unknown[]) =>
    (m.mockConsumeTokenBucket as (...a: unknown[]) => Promise<unknown>)(...args),
}));

vi.mock("@/lib/payments/google-play", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/google-play")>(
    "@/lib/payments/google-play",
  );
  return {
    ...actual,
    isGooglePlayConfigured: () => m.mockIsGooglePlayConfigured(),
    verifySubscription: (...args: unknown[]) =>
      (m.mockVerifySubscription as (...a: unknown[]) => Promise<unknown>)(...args),
    acknowledgeSubscription: (...args: unknown[]) =>
      (m.mockAcknowledgeSubscription as (...a: unknown[]) => Promise<undefined>)(...args),
  };
});

import { POST } from "./route";

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.upsertCalls.length = 0;
  m.mockAuth.mockReturnValue({ userId: USER_ID });
  m.mockIsGooglePlayConfigured.mockReturnValue(true);
  m.mockGetStoreByClerkId.mockResolvedValue({ id: "store-verify-1", clerk_user_id: USER_ID });
  m.mockConsumeTokenBucket.mockResolvedValue({ allowed: true, remaining: 29, retryAfterMs: 0 });
});

describe("/api/billing/verify (Plan 02-05 / QUALITY #3)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    m.mockAuth.mockReturnValueOnce({ userId: null });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(401);
    expect(m.mockVerifySubscription).not.toHaveBeenCalled();
  });

  it("returns 503 when Google Play is not configured", async () => {
    m.mockIsGooglePlayConfigured.mockReturnValueOnce(false);
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("BILLING_NOT_CONFIGURED");
  });

  it("rejects with 400 when SKU is invalid", async () => {
    const res = await POST(makeRequest({ sku: "not-a-real-sku", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(400);
    expect(m.mockVerifySubscription).not.toHaveBeenCalled();
  });

  it("rejects with 400 when purchaseToken is missing or too short", async () => {
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 502 when verifier returns non-numeric expiry", async () => {
    m.mockVerifySubscription.mockResolvedValueOnce({
      expiryTimeMillis: "not-a-number",
      paymentState: 1,
      acknowledgementState: 1,
      autoRenewing: true,
      obfuscatedExternalAccountId: EXPECTED_OBFUSCATED,
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(502);
  });

  it("returns 410 when subscription is already expired", async () => {
    m.mockVerifySubscription.mockResolvedValueOnce({
      expiryTimeMillis: String(Date.now() - 60_000),
      paymentState: 1,
      acknowledgementState: 1,
      autoRenewing: false,
      obfuscatedExternalAccountId: EXPECTED_OBFUSCATED,
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(410);
  });

  it("returns 402 when paymentState !== 1 (pending)", async () => {
    m.mockVerifySubscription.mockResolvedValueOnce({
      expiryTimeMillis: String(Date.now() + 86_400_000),
      paymentState: 0,
      acknowledgementState: 1,
      autoRenewing: true,
      obfuscatedExternalAccountId: EXPECTED_OBFUSCATED,
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(402);
  });

  it("valid IAB purchase → upsert subscription + updateStorePlan called + 200", async () => {
    m.mockVerifySubscription.mockResolvedValueOnce({
      expiryTimeMillis: String(Date.now() + 86_400_000),
      paymentState: 1,
      acknowledgementState: 1, // already acked
      autoRenewing: true,
      obfuscatedExternalAccountId: EXPECTED_OBFUSCATED,
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ plan: "pro_mensal" });
    // Subscription upsert recorded
    const subUpsert = m.upsertCalls.find((c) => c.table === "subscriptions");
    expect(subUpsert).toBeDefined();
    expect(subUpsert!.payload.clerk_user_id).toBe("user_v_1");
    // Plan applied to store
    expect(m.mockUpdateStorePlan).toHaveBeenCalledTimes(1);
    expect(m.mockUpdateStorePlan).toHaveBeenCalledWith("store-verify-1", "pro");
    // No acknowledge needed
    expect(m.mockAcknowledgeSubscription).not.toHaveBeenCalled();
  });

  it("calls acknowledgeSubscription when acknowledgementState === 0", async () => {
    m.mockVerifySubscription.mockResolvedValueOnce({
      expiryTimeMillis: String(Date.now() + 86_400_000),
      paymentState: 1,
      acknowledgementState: 0, // not acked
      autoRenewing: true,
      obfuscatedExternalAccountId: EXPECTED_OBFUSCATED,
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(200);
    expect(m.mockAcknowledgeSubscription).toHaveBeenCalledWith("pro_mensal", "tok_aaaaaaaaaa");
  });
});

describe("/api/billing/verify — M2 Phase 1: obfuscated hash (control 3)", () => {
  it("rejects with 403 OBFUSCATED_ID_MISMATCH when hash does not match userId", async () => {
    m.mockVerifySubscription.mockResolvedValueOnce({
      expiryTimeMillis: String(Date.now() + 86_400_000),
      paymentState: 1,
      acknowledgementState: 1,
      autoRenewing: true,
      // Hash for some OTHER user — replay attack scenario
      obfuscatedExternalAccountId: createHash("sha256")
        .update("user_attacker")
        .digest("hex")
        .slice(0, 64),
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("OBFUSCATED_ID_MISMATCH");
    // No persistence happened
    expect(m.upsertCalls.length).toBe(0);
    expect(m.mockUpdateStorePlan).not.toHaveBeenCalled();
    // Sentry breadcrumb fired
    expect(m.mockCaptureError).toHaveBeenCalledTimes(1);
    const ctx = m.mockCaptureError.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(ctx?.["billing.obfuscated_mismatch"]).toBe(true);
  });

  it("rejects with 403 OBFUSCATED_ID_MISMATCH when field is missing from Play response", async () => {
    m.mockVerifySubscription.mockResolvedValueOnce({
      expiryTimeMillis: String(Date.now() + 86_400_000),
      paymentState: 1,
      acknowledgementState: 1,
      autoRenewing: true,
      // No obfuscatedExternalAccountId — pre-control mobile or stripped at network
      obfuscatedExternalAccountId: undefined,
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("OBFUSCATED_ID_MISMATCH");
    expect(m.upsertCalls.length).toBe(0);
  });
});

describe("/api/billing/verify — M2 Phase 1: rate limit (control 2)", () => {
  it("returns 429 + Retry-After header when token bucket is exhausted", async () => {
    m.mockConsumeTokenBucket.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterMs: 12_345,
    });
    const res = await POST(makeRequest({ sku: "pro_mensal", purchaseToken: "tok_aaaaaaaaaa" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBe("13");
    // Bucket key is namespaced + per-user
    expect(m.mockConsumeTokenBucket).toHaveBeenCalledWith(
      `billing.verify:${USER_ID}`,
      30,
      30,
      300,
    );
    // No verifySubscription call when rate-limited
    expect(m.mockVerifySubscription).not.toHaveBeenCalled();
  });
});
