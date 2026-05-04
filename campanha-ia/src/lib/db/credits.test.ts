/**
 * Phase 1 / 01-05 Task 3 — fallback-stripped RPC paths.
 *
 * Validates incrementCampaignsUsed, addCreditsToStore, consumeCredit all
 * THROW + captureError when the RPC fails (no silent read-modify-write
 * fallback that races under concurrency).
 *
 * Also asserts the M-12 / D-12 rolling-30-day period math in addCreditsToStore.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => {
  const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let rpcError: { message: string } | null = null;
  let rpcReturn: unknown = null;
  // For getOrCreateCurrentUsage — the simplest path: return an existing usage row.
  const usageRow = { id: "usage-1", campaigns_generated: 0, period_end: "2099-01-01", period_start: "2024-01-01" };

  function buildAdminClient() {
    return {
      from(table: string) {
        if (table === "stores") {
          return {
            select() {
              return {
                eq() {
                  return {
                    single: async () => ({ data: { plan_id: "plan-1", credit_campaigns: 5, credit_models: 2, credit_regenerations: 3 }, error: null }),
                    maybeSingle: async () => ({ data: { id: "store-1", clerk_user_id: "user-1" }, error: null }),
                  };
                },
              };
            },
          };
        }
        if (table === "store_usage") {
          // getCurrentUsage / getOrCreateCurrentUsage chain
          const chain: Record<string, (...args: unknown[]) => unknown> = {};
          chain.select = () => chain;
          chain.eq = () => chain;
          chain.lte = () => chain;
          chain.gte = () => chain;
          chain.order = () => chain;
          chain.limit = () => chain;
          chain.single = async () => ({ data: usageRow, error: null });
          chain.maybeSingle = async () => ({ data: usageRow, error: null });
          chain.upsert = () => Promise.resolve({ error: null });
          return chain;
        }
        if (table === "credit_purchases") {
          return {
            insert(payload: Record<string, unknown>) {
              insertCalls.push({ table, payload });
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "plans") {
          return {
            select() {
              return {
                eq() {
                  return {
                    single: async () => ({ data: { id: "plan-1", campaigns_per_month: 30 }, error: null }),
                  };
                },
              };
            },
          };
        }
        return {};
      },
      rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ name, args });
        return Promise.resolve({ data: rpcReturn, error: rpcError });
      },
    };
  }

  return {
    insertCalls,
    rpcCalls,
    setRpcError: (e: { message: string } | null) => { rpcError = e; },
    setRpcReturn: (r: unknown) => { rpcReturn = r; },
    reset: () => {
      insertCalls.length = 0;
      rpcCalls.length = 0;
      rpcError = null;
      rpcReturn = null;
    },
    buildAdminClient,
    mockCaptureError: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => m.buildAdminClient(),
}));

vi.mock("@/lib/observability", () => ({
  logger: {
    info: (...args: unknown[]) => m.mockLogger.info(...args),
    warn: (...args: unknown[]) => m.mockLogger.warn(...args),
    error: (...args: unknown[]) => m.mockLogger.error(...args),
  },
  captureError: (...args: unknown[]) => m.mockCaptureError(...args),
}));

import { incrementCampaignsUsed, addCreditsToStore, consumeCredit } from "./index";

beforeEach(() => {
  vi.clearAllMocks();
  m.reset();
});

describe("fallback-stripped RPC paths (H-11, H-6)", () => {
  it("incrementCampaignsUsed: RPC error → throws + captureError, NO silent fallback", async () => {
    m.setRpcError({ message: "rpc dead" });
    await expect(incrementCampaignsUsed("store-1")).rejects.toThrow(/increment_campaigns_used failed/);
    expect(m.mockCaptureError).toHaveBeenCalledTimes(1);
  });

  it("incrementCampaignsUsed: RPC ok → no throw, RPC called once", async () => {
    m.setRpcError(null);
    await incrementCampaignsUsed("store-1");
    expect(m.rpcCalls.find((c) => c.name === "increment_campaigns_used")).toBeDefined();
    expect(m.mockCaptureError).not.toHaveBeenCalled();
  });

  it("addCreditsToStore: RPC error → throws + captureError; credit_purchases row already inserted", async () => {
    m.setRpcError({ message: "rpc dead" });
    await expect(addCreditsToStore("store-1", "campaigns", 10, 25.0, "pay-xyz")).rejects.toThrow(/add_credits_atomic failed/);
    expect(m.mockCaptureError).toHaveBeenCalledTimes(1);
    // The purchase log row was inserted before the RPC failure — documented behaviour.
    expect(m.insertCalls.find((c) => c.table === "credit_purchases")).toBeDefined();
  });

  it("addCreditsToStore: M-12 / D-12 rolling-30-day period math in inserted row", async () => {
    m.setRpcError(null);
    const before = Date.now();
    await addCreditsToStore("store-1", "campaigns", 10, 25.0, "pay-1");
    const insert = m.insertCalls.find((c) => c.table === "credit_purchases");
    expect(insert).toBeDefined();
    const periodStart = String(insert!.payload.period_start);
    const periodEnd = String(insert!.payload.period_end);
    const startMs = new Date(periodStart).getTime();
    const endMs = new Date(periodEnd).getTime();
    // periodStart is "today" (within 1 day of test start)
    expect(Math.abs(startMs - before)).toBeLessThan(48 * 3600_000);
    // periodEnd is exactly periodStart + 30 days
    const diffDays = (endMs - startMs) / (24 * 3600_000);
    expect(diffDays).toBeGreaterThanOrEqual(29.9);
    expect(diffDays).toBeLessThanOrEqual(30.1);
  });

  it("consumeCredit: RPC error → throws + captureError, NO silent fallback", async () => {
    m.setRpcError({ message: "rpc dead" });
    await expect(consumeCredit("store-1", "campaigns")).rejects.toThrow(/consume_credit_atomic failed/);
    expect(m.mockCaptureError).toHaveBeenCalledTimes(1);
  });

  it("consumeCredit: RPC returns -1 (no credit) → returns false, no throw", async () => {
    m.setRpcError(null);
    m.setRpcReturn(-1);
    const result = await consumeCredit("store-1", "campaigns");
    expect(result).toBe(false);
  });

  it("consumeCredit: RPC returns >=0 → returns true", async () => {
    m.setRpcError(null);
    m.setRpcReturn(7);
    const result = await consumeCredit("store-1", "campaigns");
    expect(result).toBe(true);
  });
});
