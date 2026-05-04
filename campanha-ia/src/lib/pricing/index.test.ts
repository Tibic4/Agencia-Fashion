import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client so getAdminSetting() returns whatever each test
// stages — keyed by the `key` filter so tests don't depend on Promise.all's
// internal scheduling order.
const settingsByKey = new Map<string, unknown>();
const singleMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          single: async () => {
            singleMock(key);
            const v = settingsByKey.get(key);
            return v === undefined ? { data: null } : { data: { value: v } };
          },
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({}) }),
    }),
  }),
}));

import {
  calculateCostBrlDynamic,
  getExchangeRate,
  getModelPricing,
  invalidatePricingCache,
} from "./index";

beforeEach(() => {
  singleMock.mockReset();
  settingsByKey.clear();
  invalidatePricingCache();
});

describe("getModelPricing", () => {
  it("returns the admin-stored map when present", async () => {
    settingsByKey.set("model_pricing", {
      "test-model": { inputPerMTok: 1, outputPerMTok: 2 },
    });
    const r = await getModelPricing();
    expect(r["test-model"]).toEqual({ inputPerMTok: 1, outputPerMTok: 2 });
  });

  it("falls back to FALLBACK_MODEL_PRICING when admin returns null", async () => {
    const r = await getModelPricing();
    expect(r["gemini-3-pro-image-preview"]).toEqual({
      inputPerMTok: 2.0,
      outputPerMTok: 120.0,
    });
  });

  it("caches the result on subsequent calls (admin lookup happens once)", async () => {
    settingsByKey.set("model_pricing", { foo: { inputPerMTok: 0, outputPerMTok: 0 } });
    await getModelPricing();
    await getModelPricing();
    expect(singleMock).toHaveBeenCalledTimes(1);
  });
});

describe("getExchangeRate", () => {
  it("returns parsed admin value when stored", async () => {
    settingsByKey.set("usd_brl_exchange_rate", "5.4321");
    const r = await getExchangeRate();
    expect(r).toBeCloseTo(5.4321, 3);
  });

  it("falls back to FALLBACK_EXCHANGE_RATE (5.80) when admin returns null", async () => {
    const r = await getExchangeRate();
    expect(r).toBe(5.8);
  });
});

describe("calculateCostBrlDynamic", () => {
  it("returns 0 when model unknown", async () => {
    const cost = await calculateCostBrlDynamic("non-existent-model", {
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(cost).toBe(0);
  });

  it("computes USD then converts via the cached rate", async () => {
    settingsByKey.set("model_pricing", {
      "test-model": { inputPerMTok: 10, outputPerMTok: 20 },
    });
    settingsByKey.set("usd_brl_exchange_rate", "5.0");
    // Eagerly warm the rate cache so Promise.all in calculateCostBrlDynamic
    // doesn't race against itself before settingsByKey is read.
    expect(await getExchangeRate()).toBe(5);
    // 1M input @ $10 + 1M output @ $20 = $30 USD * 5 = R$150
    const cost = await calculateCostBrlDynamic("test-model", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(150, 2);
  });
});

describe("invalidatePricingCache", () => {
  it("forces re-fetch on next getModelPricing call", async () => {
    settingsByKey.set("model_pricing", { a: { inputPerMTok: 1, outputPerMTok: 2 } });
    await getModelPricing();
    invalidatePricingCache();
    settingsByKey.set("model_pricing", { b: { inputPerMTok: 3, outputPerMTok: 4 } });
    const second = await getModelPricing();
    expect(second.b).toBeDefined();
    expect(singleMock).toHaveBeenCalledTimes(2);
  });
});
