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
