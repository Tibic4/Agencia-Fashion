/**
 * Phase 1 / 01-04 Task 5 — RTDN webhook regression tests.
 *
 * Covers C-1 (revoke/recover routes through updateStorePlan with canonical
 * slugs) and D-06 (replayed Pub/Sub messageId short-circuits via dedup).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  mockUpdateStorePlan: vi.fn(async () => undefined),
  mockGetStoreByClerkId: vi.fn(async () => ({ id: "store-rtdn-1", clerk_user_id: "user_rtdn_1" })),
  mockDedupWebhook: vi.fn(async () => ({ duplicate: false }) as { duplicate: boolean }),
  mockMarkWebhookProcessed: vi.fn(async () => undefined),
  mockCaptureError: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockVerifyJwt: vi.fn(async () => ({ ok: true })),
  // We let the real google-play helpers run through (they're pure), but the
  // route also reads isGooglePlayConfigured — must return true for the happy path.
  mockIsGooglePlayConfigured: vi.fn(() => true),
  // supabase admin chain: the route reads `subscriptions` by purchase_token
  // before invoking updateStorePlan. We need that lookup to return a row.
  buildAdminClient: () => ({
    from(table: string) {
      if (table === "subscriptions") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { clerk_user_id: "user_rtdn_1" },
                    error: null,
                  }),
                };
              },
            };
          },
          update() {
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => m.buildAdminClient(),
}));

vi.mock("@/lib/db", () => ({
  updateStorePlan: (...args: unknown[]) => (m.mockUpdateStorePlan as (...a: unknown[]) => Promise<undefined>)(...args),
  getStoreByClerkId: (...args: unknown[]) => (m.mockGetStoreByClerkId as (...a: unknown[]) => Promise<unknown>)(...args),
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

vi.mock("@/lib/payments/google-pubsub-auth", () => ({
  verifyPubSubJwt: (...args: unknown[]) => (m.mockVerifyJwt as (...a: unknown[]) => Promise<{ ok: boolean }>)(...args),
}));

vi.mock("@/lib/payments/google-play", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/google-play")>("@/lib/payments/google-play");
  return {
    ...actual,
    isGooglePlayConfigured: () => m.mockIsGooglePlayConfigured(),
  };
});

process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.crialook.app";

import { POST } from "./route";

function makeRtdn(opts: {
  notificationType: number;
  subscriptionId?: string;
  purchaseToken?: string;
  messageId?: string;
}): NextRequest {
  const innerPayload = {
    version: "1.0",
    packageName: "com.crialook.app",
    eventTimeMillis: String(Date.now()),
    subscriptionNotification: {
      version: "1.0",
      notificationType: opts.notificationType,
      purchaseToken: opts.purchaseToken ?? "tok-1",
      subscriptionId: opts.subscriptionId ?? "pro_mensal",
    },
  };
  const envelope = {
    message: {
      data: Buffer.from(JSON.stringify(innerPayload)).toString("base64"),
      messageId: opts.messageId ?? "pubsub-msg-1",
    },
  };
  const headers = new Map<string, string>([
    ["authorization", "Bearer fake-jwt"],
  ]);
  return {
    headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
    json: async () => envelope,
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.mockDedupWebhook.mockResolvedValue({ duplicate: false });
  m.mockGetStoreByClerkId.mockResolvedValue({ id: "store-rtdn-1", clerk_user_id: "user_rtdn_1" });
  m.mockVerifyJwt.mockResolvedValue({ ok: true });
  m.mockIsGooglePlayConfigured.mockReturnValue(true);
});

describe("RTDN webhook — Phase 1 regressions", () => {
  it("C-1 (REVOKED, type 12): updateStorePlan called with FREE_PLAN_SLUG ('gratis') and null sub_id", async () => {
    const res = await POST(makeRtdn({ notificationType: 12 }));
    expect(res.status).toBe(200);
    expect(m.mockUpdateStorePlan).toHaveBeenCalledWith("store-rtdn-1", "gratis", null);
  });

  it("C-1 (RENEWED, type 2): updateStorePlan called with canonical slug from SKU", async () => {
    await POST(makeRtdn({ notificationType: 2, subscriptionId: "pro_mensal" }));
    expect(m.mockUpdateStorePlan).toHaveBeenCalledWith("store-rtdn-1", "pro", null);
  });

  it("D-06: replayed messageId short-circuits — updateStorePlan NOT called second time", async () => {
    m.mockDedupWebhook.mockResolvedValueOnce({ duplicate: false });
    await POST(makeRtdn({ notificationType: 2, messageId: "msg-replay" }));

    m.mockDedupWebhook.mockResolvedValueOnce({ duplicate: true });
    await POST(makeRtdn({ notificationType: 2, messageId: "msg-replay" }));

    expect(m.mockUpdateStorePlan).toHaveBeenCalledTimes(1);
  });

  it("missing Pub/Sub messageId returns 400", async () => {
    const innerPayload = {
      version: "1.0",
      packageName: "com.crialook.app",
      eventTimeMillis: String(Date.now()),
      subscriptionNotification: {
        version: "1.0",
        notificationType: 2,
        purchaseToken: "t",
        subscriptionId: "pro_mensal",
      },
    };
    const envelope = {
      message: {
        data: Buffer.from(JSON.stringify(innerPayload)).toString("base64"),
        messageId: "  ", // whitespace → trim → empty
      },
    };
    const req = {
      headers: { get: () => "Bearer fake-jwt" },
      json: async () => envelope,
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(m.mockUpdateStorePlan).not.toHaveBeenCalled();
  });
});
