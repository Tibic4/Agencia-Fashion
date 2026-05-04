/**
 * Phase 1 / 01-05 Task 1 — cron downgrade optimistic-lock regression tests.
 *
 * Covers H-7 (cancel-then-resub mid-cron preserves paid plan) and the
 * subscription_status='cancelled' filter swap.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const m = vi.hoisted(() => {
  // ── State controlling the supabase mock ──
  const state = {
    freePlanId: "free-plan-uuid",
    candidates: [] as Array<{ id: string; plan_id: string; name: string; updated_at: string }>,
    // Map of store_id → { period_end }
    usageByStore: {} as Record<string, { period_end: string } | null>,
    // For optimistic lock: how many rows the UPDATE will return per call
    updateReturnsByStore: {} as Record<string, Array<unknown> | "throw">,
    storesUpdateCalls: [] as Array<{ payload: Record<string, unknown>; storeId: string; updatedAtPredicate: string }>,
  };

  function buildAdminClient() {
    return {
      from(table: string) {
        if (table === "plans") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: { id: state.freePlanId }, error: null }),
                  };
                },
              };
            },
          };
        }
        if (table === "stores") {
          // Builder for SELECT chains
          const selectChain = {
            _filter: {} as Record<string, unknown>,
            eq(col: string, val: unknown) {
              this._filter[col] = val;
              return this;
            },
            neq() {
              return this;
            },
            then(onF: (v: unknown) => unknown) {
              // The cron's candidate select chains: .select(...).eq("subscription_status", "cancelled").neq("plan_id", id)
              // No await on a then-able directly — actually the route does `await supabase.from(...).select(...).eq(...).neq(...)`
              // which is a thenable returning { data, error }. We just resolve here.
              return onF({ data: state.candidates, error: null });
            },
          };

          return {
            select() {
              // Returning a thenable that resolves to { data, error } when awaited.
              // But the route builds .select(...).eq(...).neq(...) and awaits the chain.
              // So we return selectChain.
              return selectChain;
            },
            update(payload: Record<string, unknown>) {
              const ctx: { storeId?: string; updatedAt?: string } = {};
              const chain = {
                eq(col: string, val: unknown) {
                  if (col === "id") ctx.storeId = String(val);
                  if (col === "updated_at") ctx.updatedAt = String(val);
                  return chain;
                },
                select() {
                  // terminal — return the optimistic-lock result for this store
                  state.storesUpdateCalls.push({
                    payload,
                    storeId: ctx.storeId ?? "?",
                    updatedAtPredicate: ctx.updatedAt ?? "?",
                  });
                  const r = state.updateReturnsByStore[ctx.storeId ?? ""];
                  if (r === "throw") {
                    return Promise.resolve({ data: null, error: { message: "boom" } });
                  }
                  return Promise.resolve({ data: r ?? [{ id: ctx.storeId }], error: null });
                },
              };
              return chain;
            },
          };
        }
        if (table === "store_usage") {
          // Chain: .select("period_end").eq("store_id", id).order(...).limit(1).maybeSingle()
          const chain: Record<string, (...args: unknown[]) => unknown> = {};
          chain.select = () => chain;
          chain.eq = (...args: unknown[]) => {
            const val = args[1];
            (chain as { _storeId?: string })._storeId = String(val);
            return chain;
          };
          chain.order = () => chain;
          chain.limit = () => chain;
          chain.maybeSingle = async () => {
            const id = (chain as { _storeId?: string })._storeId ?? "";
            return { data: state.usageByStore[id] ?? null, error: null };
          };
          return chain;
        }
        return {};
      },
    };
  }

  return {
    state,
    buildAdminClient,
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockCaptureError: vi.fn(),
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

process.env.CRON_SECRET = "cron-secret-test";

import { POST } from "./route";

function makeReq(): NextRequest {
  return {
    headers: { get: (n: string) => (n.toLowerCase() === "authorization" ? "Bearer cron-secret-test" : null) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.state.candidates = [];
  m.state.usageByStore = {};
  m.state.updateReturnsByStore = {};
  m.state.storesUpdateCalls = [];
});

describe("cron/downgrade-expired — Phase 1 regressions", () => {
  it("happy path: cancelled+expired store gets downgraded; UPDATE includes subscription_status='expired'", async () => {
    m.state.candidates = [
      { id: "store-a", plan_id: "pro-plan", name: "A", updated_at: "2025-01-01T00:00:00Z" },
    ];
    m.state.usageByStore["store-a"] = { period_end: "2024-12-01" };
    // Optimistic lock succeeds (1 row affected)
    m.state.updateReturnsByStore["store-a"] = [{ id: "store-a" }];

    const res = await POST(makeReq());
    const body = await (res as unknown as { json: () => Promise<Record<string, number>> }).json();
    expect(body.downgraded).toBe(1);
    expect(body.skippedRace).toBe(0);

    expect(m.state.storesUpdateCalls).toHaveLength(1);
    const call = m.state.storesUpdateCalls[0];
    expect(call.payload).toHaveProperty("plan_id", "free-plan-uuid");
    expect(call.payload).toHaveProperty("subscription_status", "expired");
    // Optimistic lock predicate matches the captured updated_at
    expect(call.updatedAtPredicate).toBe("2025-01-01T00:00:00Z");
  });

  it("D-09: race detected (UPDATE returns 0 rows) → skippedRace++ and info-log", async () => {
    m.state.candidates = [
      { id: "store-race", plan_id: "pro-plan", name: "R", updated_at: "2025-01-01T00:00:00Z" },
    ];
    m.state.usageByStore["store-race"] = { period_end: "2024-12-01" };
    // Simulate renewal mid-cron: UPDATE matches 0 rows
    m.state.updateReturnsByStore["store-race"] = [];

    const res = await POST(makeReq());
    const body = await (res as unknown as { json: () => Promise<Record<string, number>> }).json();
    expect(body.downgraded).toBe(0);
    expect(body.skippedRace).toBe(1);

    const infoCalls = m.mockLogger.info.mock.calls.map((c) => c[0]);
    expect(infoCalls).toContain("cron_downgrade_skipped_race");
  });

  it("non-expired period skips (no UPDATE attempted)", async () => {
    m.state.candidates = [
      { id: "store-future", plan_id: "pro-plan", name: "F", updated_at: "2025-01-01T00:00:00Z" },
    ];
    m.state.usageByStore["store-future"] = { period_end: "2099-01-01" };

    const res = await POST(makeReq());
    const body = await (res as unknown as { json: () => Promise<Record<string, number>> }).json();
    expect(body.downgraded).toBe(0);
    expect(m.state.storesUpdateCalls).toHaveLength(0);
  });
});
