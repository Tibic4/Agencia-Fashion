/**
 * Phase 02 / Plan 02-05 Task 3 — judge reconcile cron route handler tests.
 *
 * Covers D-16 (query), D-17 (re-emit + retry_count bump), D-18 (dead-letter
 * at retry exceed), and the missing-payload defensive branch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => {
  const inngestSendMock = vi.fn();
  const sentryCaptureMessageMock = vi.fn();
  const captureErrorMock = vi.fn();

  // Supabase admin chain — track per-table operations
  const updateCalls: Array<{ table: string; payload: Record<string, unknown>; idEq?: string }> = [];
  const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  let pendingRows: unknown[] = [];
  let queryError: { message: string } | null = null;

  function buildAdminClient() {
    return {
      from(table: string) {
        const ctx: { table: string; idEq?: string; payload?: Record<string, unknown> } = { table };
        const chain = {
          select() {
            return chain;
          },
          eq(col: string, val: unknown) {
            if (col === "id") ctx.idEq = String(val);
            // For the SELECT chain we don't need to track other eqs
            return chain;
          },
          lt() {
            return chain;
          },
          or() {
            // SELECT terminator — return the data
            return Promise.resolve({ data: pendingRows, error: queryError });
          },
          update(payload: Record<string, unknown>) {
            ctx.payload = payload;
            return chain;
          },
          insert(payload: Record<string, unknown>) {
            insertCalls.push({ table, payload });
            return Promise.resolve({ error: null });
          },
          then(resolve: (v: unknown) => unknown) {
            // Terminal await for the update().eq() chain — record the call
            if (ctx.payload) {
              updateCalls.push({
                table: ctx.table,
                payload: ctx.payload,
                idEq: ctx.idEq,
              });
            }
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return chain;
      },
    };
  }

  return {
    inngestSendMock,
    sentryCaptureMessageMock,
    captureErrorMock,
    updateCalls,
    insertCalls,
    setPendingRows: (rows: unknown[]) => {
      pendingRows = rows;
    },
    setQueryError: (err: { message: string } | null) => {
      queryError = err;
    },
    reset: () => {
      updateCalls.length = 0;
      insertCalls.length = 0;
      pendingRows = [];
      queryError = null;
      inngestSendMock.mockReset();
      sentryCaptureMessageMock.mockReset();
      captureErrorMock.mockReset();
      inngestSendMock.mockResolvedValue({ ids: ["evt-test"] });
    },
    buildAdminClient,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => m.buildAdminClient(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => m.inngestSendMock(...args),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => m.sentryCaptureMessageMock(...args),
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: unknown) => void) => {
    cb({
      setExtra: vi.fn(),
      setLevel: vi.fn(),
      setFingerprint: vi.fn(),
    });
  }),
  setUser: vi.fn(),
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

describe("/api/cron/judge-reconcile", () => {
  beforeEach(() => {
    m.reset();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  function bearer(token: string): Headers {
    return new Headers({ authorization: `Bearer ${token}` });
  }

  it("rejects request without Bearer token (401)", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://test/api/cron/judge-reconcile", { method: "POST" });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("rejects request with wrong Bearer token (401)", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://test/api/cron/judge-reconcile", {
      method: "POST",
      headers: bearer("wrong-token"),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns processed=0 when no pending rows", async () => {
    m.setPendingRows([]);
    const { POST } = await import("./route");
    const req = new Request("http://test/api/cron/judge-reconcile", {
      method: "POST",
      headers: bearer("test-cron-secret"),
    });
    const res = await POST(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, processed: 0, dead_lettered: 0, errors: 0 });
    expect(m.inngestSendMock).not.toHaveBeenCalled();
  });

  it("re-emits Inngest event for a pending row and increments retry_count", async () => {
    m.setPendingRows([
      {
        id: "camp-1",
        store_id: "store-1",
        judge_payload: { campaignId: "camp-1", storeId: "store-1", copyText: "hi" },
        judge_retry_count: 1,
        judge_last_attempt: null,
      },
    ]);
    const { POST } = await import("./route");
    const req = new Request("http://test/api/cron/judge-reconcile", {
      method: "POST",
      headers: bearer("test-cron-secret"),
    });
    const res = await POST(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, processed: 1, dead_lettered: 0 });
    expect(m.inngestSendMock).toHaveBeenCalledTimes(1);
    expect(m.inngestSendMock.mock.calls[0][0]).toMatchObject({
      name: "campaign/judge.requested",
      data: { campaignId: "camp-1" },
    });
    // Update with retry_count=2 should have been recorded
    const update = m.updateCalls.find((u) => u.idEq === "camp-1" && u.table === "campaigns");
    expect(update).toBeDefined();
    expect(update!.payload.judge_retry_count).toBe(2);
    expect(update!.payload.judge_last_attempt).toBeDefined();
  });

  it("moves to dead-letter when retry_count would exceed 3", async () => {
    m.setPendingRows([
      {
        id: "camp-deadletter",
        store_id: "store-2",
        judge_payload: { campaignId: "camp-deadletter" },
        judge_retry_count: 3,
        judge_last_attempt: new Date(0).toISOString(),
      },
    ]);
    const { POST } = await import("./route");
    const req = new Request("http://test/api/cron/judge-reconcile", {
      method: "POST",
      headers: bearer("test-cron-secret"),
    });
    const res = await POST(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ dead_lettered: 1, processed: 0 });
    // Insert into judge_dead_letter
    const dlInsert = m.insertCalls.find((i) => i.table === "judge_dead_letter");
    expect(dlInsert).toBeDefined();
    expect(dlInsert!.payload).toMatchObject({
      campaign_id: "camp-deadletter",
      last_error: "exceeded_3_retries",
    });
    // Cleared judge_pending
    const clearUpd = m.updateCalls.find(
      (u) => u.table === "campaigns" && u.idEq === "camp-deadletter" && u.payload.judge_pending === false,
    );
    expect(clearUpd).toBeDefined();
    // Sentry alert
    expect(m.sentryCaptureMessageMock).toHaveBeenCalledWith(
      "judge.dead_letter",
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({
          campaign_id: "camp-deadletter",
          reason: "exceeded_3_retries",
        }),
      }),
    );
    // Did NOT re-emit Inngest
    expect(m.inngestSendMock).not.toHaveBeenCalled();
  });

  it("dead-letters immediately when judge_payload is missing", async () => {
    m.setPendingRows([
      {
        id: "camp-no-payload",
        store_id: "store-3",
        judge_payload: null,
        judge_retry_count: 0,
        judge_last_attempt: null,
      },
    ]);
    const { POST } = await import("./route");
    const req = new Request("http://test/api/cron/judge-reconcile", {
      method: "POST",
      headers: bearer("test-cron-secret"),
    });
    const res = await POST(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ dead_lettered: 1 });
    // Inserted with last_error='missing_payload'
    const dlInsert = m.insertCalls.find(
      (i) => i.table === "judge_dead_letter" && i.payload.last_error === "missing_payload",
    );
    expect(dlInsert).toBeDefined();
    // captureError called for missing payload
    expect(m.captureErrorMock).toHaveBeenCalled();
  });
});
