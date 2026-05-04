/**
 * Phase 1 / 01-04 Task 2 — Clerk webhook regression tests.
 *
 * Covers C-3 (createStore is invoked with onboardingCompleted=false on
 * user.created so plan_id and store_usage land atomically) and D-06
 * (replayed svix-id short-circuits via dedupWebhook).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  mockCreateStore: vi.fn(async () => ({ id: "new-store-id", plan_id: "free-uuid" })),
  mockGetStoreByClerkId: vi.fn(async () => null as null | Record<string, unknown>),
  mockDedupWebhook: vi.fn(async () => ({ duplicate: false }) as { duplicate: boolean }),
  mockMarkWebhookProcessed: vi.fn(async () => undefined),
  mockCaptureError: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  createStore: (...args: unknown[]) => (m.mockCreateStore as (...a: unknown[]) => Promise<unknown>)(...args),
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

// Bypass real signature: replace verifyClerkSignature behaviour by setting a
// secret that produces a deterministic match for the synthetic payload below,
// OR mock crypto. Easier path: pass valid svix headers and stub the impl by
// setting CLERK_WEBHOOK_SECRET to an empty string-decodable secret and
// pre-computing the expected HMAC ourselves.
//
// Simpler: just patch verifyClerkSignature import in the route by mocking the
// crypto module — but that's brittle. Cleanest: precompute a real HMAC.

import { createHmac } from "crypto";

const SECRET_RAW = "supersecretkeyforhash";
const SECRET_B64 = Buffer.from(SECRET_RAW).toString("base64");
process.env.CLERK_WEBHOOK_SECRET = `whsec_${SECRET_B64}`;

function buildSvixHeaders(svixId: string, payload: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const signedPayload = `${svixId}.${ts}.${payload}`;
  const sig = createHmac("sha256", Buffer.from(SECRET_RAW)).update(signedPayload).digest("base64");
  return {
    "svix-id": svixId,
    "svix-timestamp": ts,
    "svix-signature": `v1,${sig}`,
  };
}

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>, svixId: string): NextRequest {
  const payload = JSON.stringify(body);
  const headers = buildSvixHeaders(svixId, payload);
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: {
      get(name: string) {
        return headerMap.get(name.toLowerCase()) ?? null;
      },
    },
    text: async () => payload,
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.mockDedupWebhook.mockResolvedValue({ duplicate: false });
  m.mockGetStoreByClerkId.mockResolvedValue(null);
  m.mockCreateStore.mockResolvedValue({ id: "new-store-id", plan_id: "free-uuid" });
});

describe("Clerk webhook — Phase 1 regressions", () => {
  it("C-3: user.created routes through createStore with onboardingCompleted=false", async () => {
    const body = {
      type: "user.created",
      data: {
        id: "user_abc",
        email_addresses: [{ email_address: "shop@example.com" }],
      },
    };
    const res = await POST(makeRequest(body, "msg_clerk_1"));
    expect(res.status).toBe(200);
    expect(m.mockCreateStore).toHaveBeenCalledTimes(1);
    const arg = (m.mockCreateStore.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg.clerkUserId).toBe("user_abc");
    expect(arg.onboardingCompleted).toBe(false);
    expect(arg.segmentPrimary).toBe("outro");
    // name derived from email prefix
    expect(arg.name).toBe("shop");
  });

  it("D-06: replay (same svix-id) short-circuits — createStore called once total", async () => {
    const body = { type: "user.created", data: { id: "user_replay" } };
    m.mockDedupWebhook.mockResolvedValueOnce({ duplicate: false });
    await POST(makeRequest(body, "msg_replay_1"));

    m.mockDedupWebhook.mockResolvedValueOnce({ duplicate: true });
    await POST(makeRequest(body, "msg_replay_1"));

    expect(m.mockCreateStore).toHaveBeenCalledTimes(1);
  });

  it("non-user.created event is ignored AND marked processed (no createStore)", async () => {
    const body = { type: "session.created", data: { id: "ses_1" } };
    const res = await POST(makeRequest(body, "msg_session_1"));
    expect(res.status).toBe(200);
    expect(m.mockCreateStore).not.toHaveBeenCalled();
    expect(m.mockMarkWebhookProcessed).toHaveBeenCalled();
  });

  it("existing store for clerk user → no createStore, marked processed", async () => {
    m.mockGetStoreByClerkId.mockResolvedValueOnce({ id: "existing-store" });
    const body = { type: "user.created", data: { id: "user_existed" } };
    await POST(makeRequest(body, "msg_existed_1"));
    expect(m.mockCreateStore).not.toHaveBeenCalled();
    expect(m.mockMarkWebhookProcessed).toHaveBeenCalled();
  });
});
