/**
 * Phase 02 D-07/D-08/D-10 — alert thresholds + queries tests.
 *
 * Mocks supabase with a chainable builder pattern — each .from(...) returns
 * an object whose terminal awaits resolve to controlled `data` shapes the
 * test arranges. No real network calls.
 */
import { describe, it, expect } from "vitest";
import {
  FACE_WRONG_THRESHOLD_PCT,
  FACE_WRONG_WOW_DELTA_PP,
  NIVEL_RISCO_ALTO_THRESHOLD_PCT,
  queryFaceWrongRate,
  queryNivelRiscoAltoRate,
  buildFaceWrongFingerprint,
  buildNivelRiscoAltoFingerprint,
} from "./alerts";

// ─── Mock supabase client builder ──────────────────────────────────────────

interface MockTable {
  data: unknown[];
}

function makeSupabase(tables: Record<string, MockTable | MockTable[]>) {
  // For `campaigns` table this-week vs last-week, queries differ by .lt().
  // We arrange the tables map so the second-call returns last-week data:
  //   tables.campaigns can be a single MockTable OR an array [thisWeek, lastWeek]
  //   tables.api_cost_logs is a single MockTable
  //   tables.campaign_scores is a single MockTable
  const callCounts: Record<string, number> = {};

  function builder(tableName: string) {
    const callIdx = callCounts[tableName] ?? 0;
    callCounts[tableName] = callIdx + 1;

    const table = tables[tableName];
    let data: unknown[] = [];
    if (Array.isArray(table)) {
      data = table[callIdx]?.data ?? [];
    } else if (table) {
      data = table.data;
    }

    // Chain methods all return the same builder; awaiting it yields { data }.
    const chain = {
      select: () => chain,
      gte: () => chain,
      lt: () => chain,
      eq: () => chain,
      in: () => chain,
      limit: () => chain,
      // Allow `await` on any chain step by making it thenable with the data.
      then: (resolve: (value: { data: unknown[] }) => void) => resolve({ data }),
    };
    return chain;
  }

  return {
    from: (tableName: string) => builder(tableName),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Threshold constants (LOCKED per D-07/D-08/D-10)", () => {
  it("Test 8: exports exact LOCKED threshold values", () => {
    expect(FACE_WRONG_THRESHOLD_PCT).toBe(5);
    expect(FACE_WRONG_WOW_DELTA_PP).toBe(1);
    expect(NIVEL_RISCO_ALTO_THRESHOLD_PCT).toBe(1);
  });
});

describe("queryFaceWrongRate (D-07)", () => {
  it("Test 1: computes thisWeek / lastWeek rates and topPromptVersions", async () => {
    // 100 campaigns this week, 8 face_wrong; 50 campaigns last week, 1 face_wrong.
    const thisWeekRows = Array.from({ length: 100 }, (_, i) => ({
      id: `c-this-${i}`,
      regenerate_reason: i < 8 ? "face_wrong" : null,
    }));
    const lastWeekRows = Array.from({ length: 50 }, (_, i) => ({
      id: `c-last-${i}`,
      regenerate_reason: i < 1 ? "face_wrong" : null,
    }));
    // api_cost_logs: 5 logs with prompt_version='abc123', 3 with 'def456', 1 'ghi789' for the 8 face_wrong.
    const logs = [
      ...Array(5).fill({ metadata: { prompt_version: "abc123" }, campaign_id: "c-this-0" }),
      ...Array(3).fill({ metadata: { prompt_version: "def456" }, campaign_id: "c-this-1" }),
      { metadata: { prompt_version: "ghi789" }, campaign_id: "c-this-2" },
    ];

    const supabase = makeSupabase({
      campaigns: [{ data: thisWeekRows }, { data: lastWeekRows }],
      api_cost_logs: { data: logs },
    });

    const r = await queryFaceWrongRate(supabase, new Date("2026-05-04T07:00:00Z"));
    expect(r.thisWeekPct).toBe(8);   // 8/100 * 100
    expect(r.lastWeekPct).toBe(2);   // 1/50  * 100
    expect(r.deltaPp).toBe(6);       // 8 - 2
    expect(r.topPromptVersions.length).toBeLessThanOrEqual(3);
    expect(r.topPromptVersions[0]).toBe("abc123"); // top by count
    expect(r.sampleSize).toEqual({ thisWeek: 100, lastWeek: 50 });
  });

  it("Test 2: returns zeros when there's no data (graceful degradation)", async () => {
    const supabase = makeSupabase({
      campaigns: [{ data: [] }, { data: [] }],
      api_cost_logs: { data: [] },
    });
    const r = await queryFaceWrongRate(supabase, new Date("2026-05-04T07:00:00Z"));
    expect(r.thisWeekPct).toBe(0);
    expect(r.lastWeekPct).toBe(0);
    expect(r.deltaPp).toBe(0);
    expect(r.topPromptVersions).toEqual([]);
  });
});

describe("queryNivelRiscoAltoRate (D-08)", () => {
  it("Test 3: computes pct and limits sample to 5 campaign UUIDs", async () => {
    // 100 campaign_scores rows: 2 alto, 0 falha_judge.
    const rows = Array.from({ length: 100 }, (_, i) => ({
      campaign_id: `score-${i}`,
      nivel_risco: i < 2 ? "alto" : "baixo",
    }));
    const supabase = makeSupabase({ campaign_scores: { data: rows } });
    const r = await queryNivelRiscoAltoRate(supabase, new Date("2026-05-04T07:00:00Z"));
    expect(r.pct).toBe(2);          // 2/100 * 100
    expect(r.altoCount).toBe(2);
    expect(r.validTotal).toBe(100);
    expect(r.sampleCampaignIds.length).toBeLessThanOrEqual(5);
  });

  it("Test 4: excludes falha_judge rows from denominator (D-02 sentinel filter)", async () => {
    // 80 baixo + 2 alto + 18 falha_judge = 100 total, but valid total is 82.
    // pct = 2/82 = ~2.439, NOT 2/100 = 2.0.
    const rows = [
      ...Array(80).fill({ campaign_id: "c-baixo", nivel_risco: "baixo" }),
      ...Array(2).fill({ campaign_id: "c-alto", nivel_risco: "alto" }),
      ...Array(18).fill({ campaign_id: "c-falha", nivel_risco: "falha_judge" }),
    ];
    const supabase = makeSupabase({ campaign_scores: { data: rows } });
    const r = await queryNivelRiscoAltoRate(supabase, new Date("2026-05-04T07:00:00Z"));
    expect(r.validTotal).toBe(82);
    expect(r.altoCount).toBe(2);
    expect(r.pct).toBeCloseTo((2 / 82) * 100, 4); // ≈ 2.4390
  });
});

describe("buildFaceWrongFingerprint (D-07 — bucket by Monday-of-week)", () => {
  it("Test 5: Monday returns its own date", () => {
    // 2026-05-04 is a Monday (UTC).
    expect(buildFaceWrongFingerprint(new Date("2026-05-04T00:00:00Z")))
      .toBe("face_wrong_spike_20260504");
    // Next Monday gets a different fingerprint.
    expect(buildFaceWrongFingerprint(new Date("2026-05-11T00:00:00Z")))
      .toBe("face_wrong_spike_20260511");
  });

  it("Test 6: Thursday in same week buckets to Monday", () => {
    // 2026-05-07 is a Thursday — must round back to Monday 2026-05-04.
    expect(buildFaceWrongFingerprint(new Date("2026-05-07T15:30:00Z")))
      .toBe("face_wrong_spike_20260504");
    // Sunday 2026-05-10 is the LAST day of the week of Monday 2026-05-04.
    expect(buildFaceWrongFingerprint(new Date("2026-05-10T23:59:00Z")))
      .toBe("face_wrong_spike_20260504");
  });
});

describe("buildNivelRiscoAltoFingerprint (D-08 — daily bucket)", () => {
  it("Test 7: each day gets its own fingerprint", () => {
    expect(buildNivelRiscoAltoFingerprint(new Date("2026-05-04T07:00:00Z")))
      .toBe("nivel_risco_alto_spike_20260504");
    expect(buildNivelRiscoAltoFingerprint(new Date("2026-05-05T07:00:00Z")))
      .toBe("nivel_risco_alto_spike_20260505");
  });
});
