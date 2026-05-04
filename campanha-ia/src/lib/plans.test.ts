import { describe, it, expect } from "vitest";
import {
  PLANS,
  CREDIT_PACKAGES_CAMPAIGNS,
  CREDIT_PACKAGES_MODELS,
  ALL_CREDIT_PACKAGES,
  getModelLimitForPlan,
  getHistoryDaysForPlan,
} from "./plans";

describe("PLANS constants", () => {
  it("has the 3 paid plans with id matching key", () => {
    expect(PLANS.essencial.id).toBe("essencial");
    expect(PLANS.pro.id).toBe("pro");
    expect(PLANS.business.id).toBe("business");
  });
  it("monotonically increasing campaigns_per_month", () => {
    expect(PLANS.essencial.campaigns_per_month).toBeLessThan(PLANS.pro.campaigns_per_month);
    expect(PLANS.pro.campaigns_per_month).toBeLessThan(PLANS.business.campaigns_per_month);
  });
  it("monotonically increasing models", () => {
    expect(PLANS.essencial.models).toBeLessThan(PLANS.pro.models);
    expect(PLANS.pro.models).toBeLessThan(PLANS.business.models);
  });
  it("monotonically increasing price", () => {
    expect(PLANS.essencial.price).toBeLessThan(PLANS.pro.price);
    expect(PLANS.pro.price).toBeLessThan(PLANS.business.price);
  });
});

describe("getModelLimitForPlan", () => {
  it("free/gratis returns 0", () => {
    expect(getModelLimitForPlan("free")).toBe(0);
    expect(getModelLimitForPlan("gratis")).toBe(0);
  });
  it("paid plans return their model count", () => {
    expect(getModelLimitForPlan("essencial")).toBe(PLANS.essencial.models);
    expect(getModelLimitForPlan("pro")).toBe(PLANS.pro.models);
    expect(getModelLimitForPlan("business")).toBe(PLANS.business.models);
  });
  it("unknown plan defaults to 0", () => {
    expect(getModelLimitForPlan("ultra-mega-platinum")).toBe(0);
    expect(getModelLimitForPlan("")).toBe(0);
  });
});

describe("getHistoryDaysForPlan", () => {
  it("free/gratis = 7", () => {
    expect(getHistoryDaysForPlan("free")).toBe(7);
    expect(getHistoryDaysForPlan("gratis")).toBe(7);
  });
  it("paid plans return correct retention", () => {
    expect(getHistoryDaysForPlan("essencial")).toBe(30);
    expect(getHistoryDaysForPlan("pro")).toBe(365);
    expect(getHistoryDaysForPlan("business")).toBe(0); // ilimitado
  });
  it("unknown defaults to 7 (most restrictive)", () => {
    expect(getHistoryDaysForPlan("xpto")).toBe(7);
  });
});

describe("CREDIT_PACKAGES_CAMPAIGNS", () => {
  it("has all 3 SKUs with type=campaigns", () => {
    expect(CREDIT_PACKAGES_CAMPAIGNS["3_campanhas"].type).toBe("campaigns");
    expect(CREDIT_PACKAGES_CAMPAIGNS["10_campanhas"].quantity).toBe(10);
    expect(CREDIT_PACKAGES_CAMPAIGNS["20_campanhas"].quantity).toBe(20);
  });
});

describe("CREDIT_PACKAGES_MODELS", () => {
  it("has all 3 SKUs with type=models", () => {
    expect(CREDIT_PACKAGES_MODELS["3_modelos"].type).toBe("models");
    expect(CREDIT_PACKAGES_MODELS["10_modelos"].quantity).toBe(10);
    expect(CREDIT_PACKAGES_MODELS["25_modelos"].quantity).toBe(25);
  });
});

describe("ALL_CREDIT_PACKAGES", () => {
  it("merges both campaigns and models packages", () => {
    expect(ALL_CREDIT_PACKAGES["3_campanhas"]).toBeDefined();
    expect(ALL_CREDIT_PACKAGES["10_modelos"]).toBeDefined();
  });
  it("annotates trial=false and bonusModels=0 on every entry", () => {
    for (const sku of Object.values(ALL_CREDIT_PACKAGES)) {
      expect(sku.trial).toBe(false);
      expect(sku.bonusModels).toBe(0);
    }
  });
});
