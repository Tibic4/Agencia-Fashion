/**
 * Phase 1 / 01-05 Task 4 — failCampaign single-shot regression tests.
 *
 * Covers H-10 (concurrent failCampaign calls write error_message exactly
 * once; second call no-ops at the DB layer via WHERE status='processing').
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => {
  const updateCalls: Array<{ payload: Record<string, unknown>; idEq?: string; statusEq?: string }> = [];
  let returnsByCall: Array<unknown[]> = [];
  let callIdx = 0;

  function buildAdminClient() {
    return {
      from() {
        const ctx: { storeId?: string; statusEq?: string; payload?: Record<string, unknown> } = {};
        const chain = {
          update(payload: Record<string, unknown>) {
            ctx.payload = payload;
            return chain;
          },
          eq(col: string, val: unknown) {
            if (col === "id") ctx.storeId = String(val);
            if (col === "status") ctx.statusEq = String(val);
            return chain;
          },
          select() {
            updateCalls.push({
              payload: ctx.payload ?? {},
              idEq: ctx.storeId,
              statusEq: ctx.statusEq,
            });
            const rows = returnsByCall[callIdx] ?? [{ id: ctx.storeId }];
            callIdx++;
            return Promise.resolve({ data: rows, error: null });
          },
        };
        return chain;
      },
    };
  }

  return {
    updateCalls,
    setReturns: (rs: Array<unknown[]>) => { returnsByCall = rs; callIdx = 0; },
    reset: () => { updateCalls.length = 0; returnsByCall = []; callIdx = 0; },
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

import { failCampaign } from "./index";

beforeEach(() => {
  vi.clearAllMocks();
  m.reset();
});

describe("failCampaign single-shot (H-10)", () => {
  it("first call wins, second call no-ops + info-logs (data length 0)", async () => {
    m.setReturns([
      [{ id: "camp-1" }], // first UPDATE matched 1 row
      [],                   // second UPDATE matched 0 rows (status no longer 'processing')
    ]);

    await failCampaign("camp-1", "first");
    await failCampaign("camp-1", "second");

    expect(m.updateCalls).toHaveLength(2);
    // BOTH calls must include WHERE status='processing'
    expect(m.updateCalls[0].statusEq).toBe("processing");
    expect(m.updateCalls[1].statusEq).toBe("processing");
    // First call payload had error_message='first'; second had 'second' but the DB
    // didn't apply it (no row matched). Test asserts the no-op log fired.
    const infoCalls = m.mockLogger.info.mock.calls.map((c) => c[0]);
    expect(infoCalls).toContain("fail_campaign_noop");
    expect(infoCalls.filter((s) => s === "fail_campaign_noop")).toHaveLength(1);
  });

  it("happy path: first call succeeds, no info-log emitted", async () => {
    m.setReturns([[{ id: "camp-2" }]]);
    await failCampaign("camp-2", "boom");
    const infoCalls = m.mockLogger.info.mock.calls.map((c) => c[0]);
    expect(infoCalls).not.toContain("fail_campaign_noop");
  });
});
