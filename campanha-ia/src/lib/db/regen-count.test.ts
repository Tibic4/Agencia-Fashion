/**
 * Phase 4 / 04-01 Task 5 — incrementRegenCount post-D-19 contract.
 *
 * The legacy 1-arg RPC overload + read-modify-write fallback (which was
 * the H-9 IDOR leak) are GONE. The helper now requires storeId, calls
 * only the 2-arg RPC, and throws on RPC error (no silent recovery).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let rpcResult: { data: number | null; error: { message: string } | null } = {
    data: 7,
    error: null,
  };

  function buildAdminClient() {
    return {
      rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ name, args });
        return Promise.resolve(rpcResult);
      },
    };
  }

  return {
    rpcCalls,
    setRpcResult: (r: { data: number | null; error: { message: string } | null }) => {
      rpcResult = r;
    },
    reset: () => {
      rpcCalls.length = 0;
      rpcResult = { data: 7, error: null };
    },
    buildAdminClient,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => m.buildAdminClient(),
}));

describe("incrementRegenCount — D-19 / H-9 (post-cutover)", () => {
  beforeEach(() => {
    m.reset();
  });

  it("calls the 2-arg RPC with p_campaign_id + p_store_id and returns data", async () => {
    m.setRpcResult({ data: 7, error: null });
    const { incrementRegenCount } = await import("./index");
    const result = await incrementRegenCount("camp-1", "store-1");
    expect(result).toBe(7);
    expect(m.rpcCalls).toHaveLength(1);
    expect(m.rpcCalls[0]).toEqual({
      name: "increment_regen_count",
      args: { p_campaign_id: "camp-1", p_store_id: "store-1" },
    });
  });

  it("throws when storeId is the empty string (D-19 guard)", async () => {
    const { incrementRegenCount } = await import("./index");
    await expect(incrementRegenCount("camp-1", "")).rejects.toThrow(
      /storeId é obrigatório/,
    );
    expect(m.rpcCalls).toHaveLength(0);
  });

  it("throws when the RPC errors (no silent fallback)", async () => {
    m.setRpcResult({ data: null, error: { message: "rpc broken" } });
    const { incrementRegenCount } = await import("./index");
    await expect(incrementRegenCount("camp-1", "store-1")).rejects.toThrow(
      /increment_regen_count failed: rpc broken/,
    );
  });
});
