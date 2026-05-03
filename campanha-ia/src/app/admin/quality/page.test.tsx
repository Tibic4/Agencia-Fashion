/**
 * Tests for the /admin/quality data loader (Phase 02 D-21, Plan 02-04).
 *
 * Pinned behavior:
 *   1. Empty state: with zero rows in every queried table, getQualityData()
 *      resolves cleanly with means7d=null per dimension, empty tables,
 *      correlation=null/[], and totalRows/validCount/failureCount=0.
 *   2. Plan 02-05 view absence tolerance: when the
 *      vw_prompt_version_regen_correlation query rejects (PostgrestError
 *      code 42P01 in production), the .then(ok, fail) catch arm sets
 *      data.correlation to null — does NOT crash the page.
 *   3. D-02 sentinel filter: a single row with nivel_risco='falha_judge'
 *      counts toward totalRows but NOT validCount, and means7d for every
 *      dimension stays null (no aggregation over the sentinel).
 *
 * Mock strategy: hoisted mutable fixtures + a chainable supabase mock
 * that dispatches by table name. The two campaign_scores queries (7d and
 * 14d windows) are differentiated by whether the chain calls `.lt()` —
 * only the 14d window applies a `.lt(sevenDaysAgo)` upper bound. This
 * avoids the brittle call-counter pattern.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted fixture state — vitest's vi.mock factories cannot capture outer
// variables, so we expose them on the test-module scope and let the mock
// factory close over the bindings via the runtime require/import order.
let mockScores7d: Array<Record<string, unknown>> = [];
let mockScores14d: Array<Record<string, unknown>> = [];
let mockJudgeCostLogs: Array<Record<string, unknown>> = [];
let mockCorrelation: Array<Record<string, unknown>> | null = [];
let mockCorrelationRejects = false;

vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ isAdmin: true, userId: "test-admin" }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    // Builder factory: returns a chainable thenable that resolves to
    // { data, error } and tracks whether `.lt()` was called so the
    // campaign_scores branch can pick 7d vs 14d fixtures.
    const makeBuilder = (resolveData: (state: { ltCalled: boolean }) => unknown) => {
      const state = { ltCalled: false };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.gte = () => builder;
      builder.lt = () => {
        state.ltCalled = true;
        return builder;
      };
      builder.order = () => builder;
      builder.limit = () => builder;
      // Make the builder thenable so `await supabase.from(...).select(...)`
      // resolves directly to the response envelope.
      builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: resolveData(state), error: null }).then(resolve, reject);
      return builder;
    };

    const correlationBuilder: Record<string, unknown> = {};
    correlationBuilder.select = () => correlationBuilder;
    correlationBuilder.limit = () => correlationBuilder;
    correlationBuilder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      if (mockCorrelationRejects) {
        return Promise.reject(
          Object.assign(new Error("relation does not exist"), { code: "42P01" }),
        ).then(resolve, reject);
      }
      return Promise.resolve({ data: mockCorrelation, error: null }).then(resolve, reject);
    };

    return {
      from: (table: string) => {
        if (table === "campaign_scores") {
          // The 14d window is the ONE that calls .lt(sevenDaysAgo) to cap
          // the upper bound. Page resolves the .then() once the chain is
          // awaited, so by the time the resolver runs, .lt() has been
          // called (or not). We snapshot ltCalled at resolution time.
          return makeBuilder((state) => (state.ltCalled ? mockScores14d : mockScores7d));
        }
        if (table === "api_cost_logs") {
          return makeBuilder(() => mockJudgeCostLogs);
        }
        if (table === "vw_prompt_version_regen_correlation") {
          return correlationBuilder;
        }
        return makeBuilder(() => []);
      },
    };
  },
}));

// Import AFTER the mocks are registered.
import { getQualityData } from "./page";

beforeEach(() => {
  mockScores7d = [];
  mockScores14d = [];
  mockJudgeCostLogs = [];
  mockCorrelation = [];
  mockCorrelationRejects = false;
});

describe("getQualityData (D-21 dashboard data loader)", () => {
  it("renders an empty state cleanly when there are zero rows everywhere", async () => {
    const data = await getQualityData();

    expect(data.totalRows).toBe(0);
    expect(data.validCount).toBe(0);
    expect(data.failureCount).toBe(0);

    // Every dimension's mean is null (not 0 / not NaN) when the input set
    // is empty — the UI relies on this to render "—" instead of "0.00".
    expect(data.means7d.naturalidade).toBeNull();
    expect(data.means7d.conversao).toBeNull();
    expect(data.means7d.clareza).toBeNull();
    expect(data.means7d.aprovacao_meta).toBeNull();
    expect(data.means7d.nota_geral).toBeNull();

    // Every WoW delta is null for the same reason — the UI renders
    // "— sem comparação" rather than a "+0.00" arrow.
    expect(data.wowDelta.naturalidade).toBeNull();

    expect(data.promptVersionTable).toEqual([]);
    expect(data.worstRated).toEqual([]);
    // Empty correlation array (view exists but no rows) is distinct from
    // a missing view (null) — both must render without crashing.
    expect(data.correlation).toEqual([]);
  });

  it("survives when the correlation view does not exist (Plan 02-05 migration not applied)", async () => {
    mockCorrelationRejects = true;

    const data = await getQualityData();

    // The .then(ok, fail) catch arm in the page must convert the
    // PostgrestError into a null `data` field — proving the page would
    // render the "view not yet created" placeholder instead of crashing.
    expect(data.correlation).toBeNull();
    // The rest of the loader still resolves cleanly so the dashboard
    // renders the other 3 sections normally.
    expect(data.totalRows).toBe(0);
  });

  it("filters falha_judge sentinel rows from numeric aggregates per D-02", async () => {
    // One sentinel row — the Inngest onFailure handler writes these with
    // neutral 1s in the numeric columns; including them in means would
    // bias every dimension toward 1. The dashboard MUST exclude them.
    mockScores7d = [
      {
        campaign_id: "camp-failed-1",
        naturalidade: 1,
        conversao: 1,
        clareza: 1,
        aprovacao_meta: 1,
        nota_geral: 1,
        nivel_risco: "falha_judge",
        melhorias: null,
        created_at: new Date().toISOString(),
      },
    ];

    const data = await getQualityData();

    expect(data.totalRows).toBe(1);
    expect(data.validCount).toBe(0);
    expect(data.failureCount).toBe(1);
    // No valid rows → no aggregates produced → null means.
    expect(data.means7d.naturalidade).toBeNull();
    expect(data.means7d.nota_geral).toBeNull();
    // Worst-rated table excludes sentinel rows too (it iterates valid7d).
    expect(data.worstRated).toEqual([]);
  });
});
