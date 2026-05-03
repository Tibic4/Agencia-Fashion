/**
 * Tests for `logModelCost` (D-18 — Phase 01 AI Pipeline Hardening).
 *
 * The single helper that replaced `logAnalyzerCost` + `logSonnetCost` +
 * `logGeminiVTOCosts`. The C-02 regression gate is the **determinism** test:
 * because the consolidation collapses three near-identical functions onto
 * one, any silent drift between "same input, same row" would defeat the
 * point. The remaining tests cover the contract surface that downstream
 * plans (Plan 01-05 Sonnet rewrite) and the api_cost_logs reader (admin
 * /custos page) rely on.
 *
 * Mocking strategy:
 *  - `@/lib/supabase/admin`: capture the `.insert()` payload to assert
 *    on the exact row written.
 *  - `@/lib/pricing`: control `getExchangeRate()` and `getModelPricing()`
 *    so the cost arithmetic is deterministic and the live-source vs
 *    fallback branches are both reachable from tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Captured `.insert()` payloads — populated by the supabase mock; reset per-test.
const insertPayloads: Array<Record<string, unknown>> = [];
// Toggle to make the supabase mock simulate a write failure (fire-and-forget test).
let supabaseInsertError: { message: string } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      insert: (payload: Record<string, unknown>) => {
        insertPayloads.push(payload);
        return Promise.resolve({ error: supabaseInsertError });
      },
    }),
  }),
}));

// Pricing mock — controllable per test via setters.
let mockExchangeRate = 5.5;
let mockPricing: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "gemini-3.1-pro-preview": { inputPerMTok: 2.0, outputPerMTok: 12.0 },
  "claude-sonnet-4-6":      { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "gemini-3-pro-image-preview": { inputPerMTok: 2.0, outputPerMTok: 120.0 },
};

vi.mock("@/lib/pricing", () => ({
  getExchangeRate: vi.fn(async () => mockExchangeRate),
  getModelPricing: vi.fn(async () => mockPricing),
}));

beforeEach(() => {
  insertPayloads.length = 0;
  supabaseInsertError = null;
  mockExchangeRate = 5.5;
  mockPricing = {
    "gemini-3.1-pro-preview": { inputPerMTok: 2.0, outputPerMTok: 12.0 },
    "claude-sonnet-4-6":      { inputPerMTok: 3.0, outputPerMTok: 15.0 },
    "gemini-3-pro-image-preview": { inputPerMTok: 2.0, outputPerMTok: 120.0 },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// C-02: regression gate — same input → same api_cost_logs row.
// ─────────────────────────────────────────────────────────────────────

describe("logModelCost — determinism (C-02 regression gate)", () => {
  it("produces byte-identical insert payloads for two calls with identical args", async () => {
    const { logModelCost } = await import("./log-model-cost");

    const args = {
      storeId: "store-abc",
      campaignId: "camp-xyz",
      provider: "google" as const,
      model: "gemini-3.1-pro-preview",
      action: "gemini_analyzer",
      usage: { inputTokens: 1234, outputTokens: 567 },
      durationMs: 8421,
      exchangeRate: 5.5, // pinned to bypass live-source non-determinism
      promptVersion: "5c900fb19472",
    };

    await logModelCost(args);
    await logModelCost(args);

    expect(insertPayloads).toHaveLength(2);
    expect(insertPayloads[0]).toEqual(insertPayloads[1]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// D-15 contract: prompt_version flows from caller → metadata jsonb.
// ─────────────────────────────────────────────────────────────────────

describe("logModelCost — D-15 prompt_version forwarding", () => {
  it("writes promptVersion to metadata.prompt_version on the insert payload", async () => {
    const { logModelCost } = await import("./log-model-cost");

    await logModelCost({
      storeId: "store-1",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      action: "sonnet_copywriter",
      usage: { inputTokens: 100, outputTokens: 50 },
      durationMs: 1000,
      exchangeRate: 2.0,
      promptVersion: "abc123def456",
    });

    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0].metadata).toEqual({ prompt_version: "abc123def456" });
  });

  it("writes metadata=null when promptVersion is omitted (legacy callers)", async () => {
    const { logModelCost } = await import("./log-model-cost");

    await logModelCost({
      storeId: "store-1",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      action: "sonnet_copywriter",
      durationMs: 1000,
      exchangeRate: 2.0,
    });

    expect(insertPayloads[0].metadata).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Token resolution — fallback table vs real usage.
// ─────────────────────────────────────────────────────────────────────

describe("logModelCost — token resolution", () => {
  it("falls back to FALLBACK_TOKENS[action] when usage is undefined", async () => {
    const { logModelCost } = await import("./log-model-cost");

    await logModelCost({
      storeId: "store-1",
      provider: "google",
      model: "gemini-3.1-pro-preview",
      action: "gemini_analyzer",
      usage: undefined,
      durationMs: 5000,
      exchangeRate: 2.0,
    });

    // gemini_analyzer fallback: 4000 in / 2000 out (lib/pricing/fallbacks.ts)
    expect(insertPayloads[0].input_tokens).toBe(4000);
    expect(insertPayloads[0].output_tokens).toBe(2000);
    expect(insertPayloads[0].tokens_used).toBe(6000);
  });

  it("uses real tokens from usage when present, ignoring fallback table", async () => {
    const { logModelCost } = await import("./log-model-cost");

    await logModelCost({
      storeId: "store-1",
      provider: "google",
      model: "gemini-3.1-pro-preview",
      action: "gemini_analyzer",
      usage: { inputTokens: 1234, outputTokens: 567 },
      durationMs: 5000,
      exchangeRate: 2.0,
    });

    expect(insertPayloads[0].input_tokens).toBe(1234);
    expect(insertPayloads[0].output_tokens).toBe(567);
    expect(insertPayloads[0].tokens_used).toBe(1801);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Cost arithmetic — pinned exchangeRate=2.0 so cost_brl == cost_usd * 2.
// ─────────────────────────────────────────────────────────────────────

describe("logModelCost — cost arithmetic", () => {
  it("computes cost_brl as cost_usd * exchangeRate", async () => {
    const { logModelCost } = await import("./log-model-cost");

    // 1M input @ $2/M + 1M output @ $12/M = $14 USD; * 2 BRL/USD = R$28
    await logModelCost({
      storeId: "store-1",
      provider: "google",
      model: "gemini-3.1-pro-preview",
      action: "gemini_analyzer",
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      durationMs: 1000,
      exchangeRate: 2.0,
    });

    const row = insertPayloads[0] as Record<string, number>;
    expect(row.cost_usd).toBeCloseTo(14, 6);
    expect(row.cost_brl).toBeCloseTo(28, 6);
    expect(row.cost_brl).toBeCloseTo(row.cost_usd * 2.0, 9);
    expect(row.exchange_rate).toBe(2.0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Fire-and-forget contract — supabase write error must not throw.
// ─────────────────────────────────────────────────────────────────────

describe("logModelCost — fire-and-forget on insert failure", () => {
  it("does NOT throw when supabase returns { error: ... }", async () => {
    const { logModelCost } = await import("./log-model-cost");
    supabaseInsertError = { message: "duplicate key value violates unique constraint" };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      logModelCost({
        storeId: "store-1",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        action: "sonnet_copywriter",
        usage: { inputTokens: 100, outputTokens: 50 },
        durationMs: 1000,
        exchangeRate: 2.0,
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("cost-log failed"),
      expect.stringContaining("duplicate key"),
    );
  });
});
