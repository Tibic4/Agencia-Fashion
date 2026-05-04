/**
 * Phase 1 / 01-03 Task 4 — HTTP-level regression tests for the MP webhook.
 *
 * Covers the C-2 (renewal preserves sub_id), C-4 (cancel preserves sub_id),
 * D-06 (replay short-circuits via dedup), H-14 (empty x-request-id rejects),
 * and L-11 (default arm warn) findings.
 *
 * All Supabase access is mocked — no DB hit. The signature validator is
 * mocked to always-pass for the happy paths and exercised for the
 * empty-id path which never reaches it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────
// Mocks — must be hoisted before importing the route module.
// vi.hoisted() lets us share state with vi.mock factories which are hoisted
// above any top-level `const`.
// ─────────────────────────────────────────────────────────────────────────

const m = vi.hoisted(() => {
  const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const countByTable: Record<string, number> = {};
  return {
    mockGetPaymentStatus: vi.fn(),
    mockGetSubscriptionStatus: vi.fn(),
    mockUpdateStorePlan: vi.fn(),
    mockAddCreditsToStore: vi.fn(),
    mockValidateSig: vi.fn(() => true),
    mockDedupWebhook: vi.fn(async () => ({ duplicate: false }) as { duplicate: boolean }),
    mockMarkWebhookProcessed: vi.fn(async () => undefined),
    mockCaptureError: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    updateCalls,
    insertCalls,
    countByTable,
    buildAdminClient: () => ({
      from(table: string) {
        return {
          update(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload });
            return {
              eq: () => Promise.resolve({ error: null, data: null }),
            };
          },
          insert(payload: Record<string, unknown>) {
            insertCalls.push({ table, payload });
            return Promise.resolve({ error: null, data: null });
          },
          select() {
            return {
              eq() {
                return Promise.resolve({
                  count: countByTable[table] ?? 0,
                  data: null,
                  error: null,
                });
              },
            };
          },
        };
      },
    }),
  };
});

vi.mock("@/lib/payments/mercadopago", () => ({
  getPaymentStatus: (...args: unknown[]) => m.mockGetPaymentStatus(...args),
  getSubscriptionStatus: (...args: unknown[]) => m.mockGetSubscriptionStatus(...args),
}));

vi.mock("@/lib/db", () => ({
  updateStorePlan: (...args: unknown[]) => m.mockUpdateStorePlan(...args),
  addCreditsToStore: (...args: unknown[]) => m.mockAddCreditsToStore(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => m.buildAdminClient(),
}));

vi.mock("@/lib/mp-signature", () => ({
  validateMpSignature: (...args: unknown[]) => (m.mockValidateSig as (...a: unknown[]) => boolean)(...args),
}));

vi.mock("@/lib/webhooks/dedup", () => ({
  dedupWebhook: (...args: unknown[]) => (m.mockDedupWebhook as (...a: unknown[]) => Promise<{ duplicate: boolean }>)(...args),
  markWebhookProcessed: (...args: unknown[]) => (m.mockMarkWebhookProcessed as (...a: unknown[]) => Promise<undefined>)(...args),
}));

vi.mock("@/lib/observability", () => ({
  logger: {
    info: (...args: unknown[]) => m.mockLogger.info(...args),
    warn: (...args: unknown[]) => m.mockLogger.warn(...args),
    error: (...args: unknown[]) => m.mockLogger.error(...args),
  },
  captureError: (...args: unknown[]) => m.mockCaptureError(...args),
}));

vi.mock("@/lib/plans", () => ({
  PLANS: {
    pro: { price: 49.9 },
    plus: { price: 99.9 },
  },
  ALL_CREDIT_PACKAGES: {},
}));

// ─────────────────────────────────────────────────────────────────────────
// Import route AFTER mocks.
// ─────────────────────────────────────────────────────────────────────────
process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-secret";

import { POST } from "./route";

function makeRequest(opts: {
  body: Record<string, unknown>;
  xRequestId?: string;
}): NextRequest {
  const headers = new Map<string, string>();
  if (opts.xRequestId !== undefined) headers.set("x-request-id", opts.xRequestId);
  headers.set("x-signature", "ts=1,v1=deadbeef");
  return {
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
    json: async () => opts.body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.updateCalls.length = 0;
  m.insertCalls.length = 0;
  for (const k of Object.keys(m.countByTable)) delete m.countByTable[k];
  m.mockValidateSig.mockReturnValue(true);
  m.mockDedupWebhook.mockResolvedValue({ duplicate: false });
});

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe("MP webhook route — Phase 1 regressions", () => {
  // Phase 4 D-03 reaffirms H-14: empty x-request-id MUST be rejected with 400
  // BEFORE signature validation. This test below already encodes the contract;
  // do not remove it without re-reading 04-CONTEXT.md (D-03) and confirming the
  // route handler still rejects empty x-request-id at line ~58 of route.ts.
  it("H-14 / Phase 4 D-03: empty x-request-id → 400, signature validator NOT called", async () => {
    const req = makeRequest({ body: { type: "payment", data: { id: "p1" } }, xRequestId: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(m.mockValidateSig).not.toHaveBeenCalled();
    expect(m.mockDedupWebhook).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toMatch(/missing x-request-id/i);
  });

  it("C-2: renewal payment does NOT pass mpSubscriptionId to updateStorePlan", async () => {
    m.mockGetPaymentStatus.mockResolvedValueOnce({
      status: "approved",
      transactionAmount: 49.9,
      externalReference: "store-1|pro",
      payer: { id: "customer-1" },
    });
    const req = makeRequest({
      body: { type: "payment", data: { id: "pay-1" } },
      xRequestId: "req-renew-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(m.mockUpdateStorePlan).toHaveBeenCalledTimes(1);
    // Critical assertion: the third argument (mpSubscriptionId) is NOT passed.
    // updateStorePlan signature is (storeId, planName, mpSubscriptionId?) — call.length
    // tells us how many args the route actually supplied.
    const call = m.mockUpdateStorePlan.mock.calls[0];
    expect(call[0]).toBe("store-1");
    expect(call[1]).toBe("pro");
    expect(call.length).toBeLessThanOrEqual(2);
  });

  it("C-4: cancelled subscription writes subscription_status='cancelled' and does NOT touch sub_id", async () => {
    m.mockGetSubscriptionStatus.mockResolvedValueOnce({
      id: "sub-xyz",
      status: "cancelled",
      externalReference: "store-1|pro",
    });
    const req = makeRequest({
      body: { type: "subscription_preapproval", data: { id: "sub-xyz" } },
      xRequestId: "req-cancel-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Find the stores update.
    const storesUpdate = m.updateCalls.find((c) => c.table === "stores");
    expect(storesUpdate).toBeDefined();
    expect(storesUpdate!.payload).toHaveProperty("subscription_status", "cancelled");
    expect(storesUpdate!.payload).not.toHaveProperty("mercadopago_subscription_id");
  });

  it("D-06: replayed webhook (same x-request-id) short-circuits — business logic invoked once", async () => {
    m.mockGetPaymentStatus.mockResolvedValue({
      status: "approved",
      transactionAmount: 49.9,
      externalReference: "store-1|pro",
      payer: { id: "customer-1" },
    });

    const body = { type: "payment", data: { id: "pay-replay" } };
    // First call: not duplicate.
    m.mockDedupWebhook.mockResolvedValueOnce({ duplicate: false });
    await POST(makeRequest({ body, xRequestId: "req-replay-1" }));

    // Second call: duplicate.
    m.mockDedupWebhook.mockResolvedValueOnce({ duplicate: true });
    await POST(makeRequest({ body, xRequestId: "req-replay-1" }));

    expect(m.mockGetPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it("L-11: default-arm subscription status emits warn-level log", async () => {
    m.mockGetSubscriptionStatus.mockResolvedValueOnce({
      id: "sub-xyz",
      status: "expired",
      externalReference: "store-1|pro",
    });
    const req = makeRequest({
      body: { type: "subscription_preapproval", data: { id: "sub-xyz" } },
      xRequestId: "req-unhandled-1",
    });
    await POST(req);
    const warnCalls = m.mockLogger.warn.mock.calls.map((c) => c[0]);
    expect(warnCalls).toContain("mp_subscription_status_unhandled");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 02 / Plan 02-05 Task 4 — additional handler-level coverage
// (QUALITY priority #3). Phase 1's 5 cases are above; these extend.
// ─────────────────────────────────────────────────────────────────────────

describe("MP webhook full handler — Plan 02-05 / QUALITY #3 additional cases", () => {
  it("invalid signature → 401, no business logic invoked", async () => {
    m.mockValidateSig.mockReturnValueOnce(false);
    const req = makeRequest({
      body: { type: "payment", data: { id: "pay-bad-sig" } },
      xRequestId: "req-bad-sig-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(m.mockGetPaymentStatus).not.toHaveBeenCalled();
    expect(m.mockGetSubscriptionStatus).not.toHaveBeenCalled();
    expect(m.mockUpdateStorePlan).not.toHaveBeenCalled();
    expect(m.mockAddCreditsToStore).not.toHaveBeenCalled();
  });

  it("invalid JSON body → 400, signature/dedup not invoked", async () => {
    const req = {
      headers: {
        get(name: string) {
          if (name.toLowerCase() === "x-request-id") return "req-bad-json-1";
          if (name.toLowerCase() === "x-signature") return "ts=1,v1=deadbeef";
          return null;
        },
      },
      json: async () => {
        throw new Error("invalid json");
      },
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(m.mockValidateSig).not.toHaveBeenCalled();
    expect(m.mockDedupWebhook).not.toHaveBeenCalled();
  });

  it("dedup throws → returns 200 with error flag (fail-closed for retry-loop avoidance)", async () => {
    m.mockDedupWebhook.mockRejectedValueOnce(new Error("dedup transport down"));
    const req = makeRequest({
      body: { type: "payment", data: { id: "pay-dedup-fail" } },
      xRequestId: "req-dedup-fail-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, error: "dedup_failed" });
    // captureError invoked for ops visibility
    expect(m.mockCaptureError).toHaveBeenCalled();
    // Business logic NOT invoked
    expect(m.mockGetPaymentStatus).not.toHaveBeenCalled();
  });

  it("getPaymentStatus throws → outer catch returns 200 + error flag (no retry storm)", async () => {
    m.mockGetPaymentStatus.mockRejectedValueOnce(new Error("MP API 503"));
    const req = makeRequest({
      body: { type: "payment", data: { id: "pay-mp-down" } },
      xRequestId: "req-mp-down-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, error: true });
    expect(m.mockCaptureError).toHaveBeenCalled();
    // markWebhookProcessed must NOT be called -- row stays for ops reconcile
    expect(m.mockMarkWebhookProcessed).not.toHaveBeenCalled();
  });
});
