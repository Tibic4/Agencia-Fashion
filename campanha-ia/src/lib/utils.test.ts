import { describe, it, expect } from "vitest";
import { cn, formatPrice, formatDate, formatRelativeTime, sleep } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toContain("a");
    expect(cn("a", "b")).toContain("b");
  });
  it("dedupes tailwind conflicts via twMerge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("filters falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatPrice", () => {
  it("renders BRL with comma decimals", () => {
    const r = formatPrice(89.9);
    // Intl can use NBSP — assert by stripping spaces
    expect(r.replace(/\s/g, "")).toContain("R$");
    expect(r).toContain("89,90");
  });
  it("handles zero", () => {
    expect(formatPrice(0)).toContain("0,00");
  });
});

describe("formatDate", () => {
  it("renders dd/mm/yyyy from ISO string", () => {
    expect(formatDate("2026-05-03T12:00:00Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
  it("renders dd/mm/yyyy from Date instance", () => {
    expect(formatDate(new Date("2026-01-15"))).toMatch(/\d{2}\/\d{2}\/2026/);
  });
});

describe("formatRelativeTime", () => {
  it("'agora' for under 1min", () => {
    const just = new Date(Date.now() - 30 * 1000);
    expect(formatRelativeTime(just)).toBe("agora");
  });
  it("Nmin atrás for under 1h", () => {
    const t = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(t)).toMatch(/min atrás/);
  });
  it("Nh atrás for under 24h", () => {
    const t = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(t)).toMatch(/h atrás/);
  });
  it("Nd atrás for under 7d", () => {
    const t = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(t)).toMatch(/d atrás/);
  });
  it("falls back to formatDate after 7d", () => {
    const t = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(t)).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("sleep", () => {
  it("resolves after the requested ms", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});
