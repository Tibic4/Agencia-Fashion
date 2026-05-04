import { describe, it, expect } from "vitest";
import { skuToPlanSlug, FREE_PLAN_SLUG } from "./sku-plan-mapping";

describe("skuToPlanSlug", () => {
  it("returns FREE_PLAN_SLUG ('gratis') for null", () => {
    expect(skuToPlanSlug(null)).toBe(FREE_PLAN_SLUG);
    expect(FREE_PLAN_SLUG).toBe("gratis");
  });

  it("returns FREE_PLAN_SLUG for undefined", () => {
    expect(skuToPlanSlug(undefined)).toBe("gratis");
  });

  it("returns FREE_PLAN_SLUG for unknown SKU", () => {
    expect(skuToPlanSlug("crialook_pro_monthly")).toBe("gratis");
    expect(skuToPlanSlug("garbage")).toBe("gratis");
  });

  it("maps known SKUs to canonical DB slugs", () => {
    expect(skuToPlanSlug("essencial_mensal")).toBe("essencial");
    expect(skuToPlanSlug("pro_mensal")).toBe("pro");
    expect(skuToPlanSlug("business_mensal")).toBe("business");
  });
});
