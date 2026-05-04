/**
 * Phase 02 / 02-02 Task 3 — incrementRegenCount IDOR fix regression tests.
 *
 * Covers H-9: fallback SELECT path now requires storeId (when provided) and
 * fails loud when no row is found instead of silently incrementing from 0.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => {
  const selectChainCalls: Array<{ idEq?: string; storeIdEq?: string }> = [];
  let selectResult: { data: { regen_count: number } | null } = { data: { regen_count: 5 } };
  // RPC must fail in the new path (so we exercise fallback)
  let rpcShouldFail = true;
  const captureErrorMock = vi.fn();

  function buildAdminClient() {
    return {
      rpc(_name: string, _args: Record<string, unknown>) {
        if (rpcShouldFail) {
          return Promise.resolve({ data: null, error: { message: "rpc broken" } });
        }
        return Promise.resolve({ data: 99, error: null });
      },
      from() {
        const ctx: { idEq?: string; storeIdEq?: string; payload?: Record<string, unknown> } = {};
        const chain = {
          select() {
            return chain;
          },
          update(payload: Record<string, unknown>) {
            ctx.payload = payload;
            return chain;
          },
          eq(col: string, val: unknown) {
            if (col === "id") ctx.idEq = String(val);
            if (col === "store_id") ctx.storeIdEq = String(val);
            return chain;
          },
          single() {
            selectChainCalls.push({ idEq: ctx.idEq, storeIdEq: ctx.storeIdEq });
            return Promise.resolve({ data: selectResult.data, error: null });
          },
          then(resolve: (v: unknown) => unknown) {
            // For the update().eq().eq() terminal await
            return Promise.resolve({ data: null, error: null }).then(resolve);
          },
        };
        return chain;
      },
    };
  }

  return {
    selectChainCalls,
    setSelectResult: (data: { regen_count: number } | null) => {
      selectResult = { data };
    },
    setRpcShouldFail: (b: boolean) => {
      rpcShouldFail = b;
    },
    reset: () => {
      selectChainCalls.length = 0;
      selectResult = { data: { regen_count: 5 } };
      rpcShouldFail = true;
      captureErrorMock.mockClear();
    },
    buildAdminClient,
    captureErrorMock,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => m.buildAdminClient(),
}));

vi.mock("@/lib/observability", async () => {
  const actual = await vi.importActual<typeof import("@/lib/observability")>(
    "@/lib/observability",
  );
  return {
    ...actual,
    captureError: (...args: unknown[]) => m.captureErrorMock(...args),
  };
});

describe("incrementRegenCount — H-9 fallback IDOR fix", () => {
  beforeEach(() => {
    m.reset();
  });

  it("fallback SELECT includes store_id when storeId is provided", async () => {
    m.setSelectResult({ regen_count: 7 });
    const { incrementRegenCount } = await import("./index");
    const result = await incrementRegenCount("camp-1", "store-1");
    expect(result).toBe(8);
    // Two SELECT chain executions: the primary RPC fails first, then we hit
    // the legacy single-arg RPC, that also fails, then we go to fallback.
    // The fallback SELECT call records idEq='camp-1', storeIdEq='store-1'.
    const fallbackCall = m.selectChainCalls[m.selectChainCalls.length - 1];
    expect(fallbackCall.idEq).toBe("camp-1");
    expect(fallbackCall.storeIdEq).toBe("store-1");
  });

  it("fallback throws when SELECT returns no row (cross-store access blocked)", async () => {
    m.setSelectResult(null);
    const { incrementRegenCount } = await import("./index");
    await expect(incrementRegenCount("camp-leaked", "store-attacker")).rejects.toThrow(
      /Campaign not found/,
    );
    expect(m.captureErrorMock).toHaveBeenCalled();
    const args = m.captureErrorMock.mock.calls[0];
    expect(args[1]).toMatchObject({
      function: "incrementRegenCount",
      campaignId: "camp-leaked",
      storeId: "store-attacker",
    });
  });

  it("fallback SELECT omits store_id when storeId is undefined (legacy path)", async () => {
    m.setSelectResult({ regen_count: 3 });
    const { incrementRegenCount } = await import("./index");
    const result = await incrementRegenCount("camp-legacy");
    expect(result).toBe(4);
    const fallbackCall = m.selectChainCalls[m.selectChainCalls.length - 1];
    expect(fallbackCall.idEq).toBe("camp-legacy");
    expect(fallbackCall.storeIdEq).toBeUndefined();
  });
});
