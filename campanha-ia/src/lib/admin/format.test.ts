import { describe, it, expect } from "vitest";
import { formatDateBR, formatDateTimeBR, formatTimeBR } from "./format";

describe("admin/format helpers", () => {
  const sample = new Date(Date.UTC(2026, 4, 3, 14, 5, 9)); // May 3 2026 14:05:09 UTC

  it("formatDateBR returns dd/MM/yyyy from Date", () => {
    expect(formatDateBR(sample)).toMatch(/\d{2}\/\d{2}\/2026/);
  });
  it("formatDateBR returns dd/MM/yyyy from ISO string", () => {
    expect(formatDateBR("2026-05-03T14:05:09Z")).toMatch(/\d{2}\/\d{2}\/2026/);
  });
  it("formatDateBR returns em-dash for invalid date", () => {
    expect(formatDateBR("not-a-date")).toBe("—");
    expect(formatDateBR(new Date("invalid"))).toBe("—");
  });

  it("formatDateTimeBR returns dd/MM HH:mm", () => {
    const r = formatDateTimeBR(sample);
    expect(r).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
  it("formatDateTimeBR returns em-dash for invalid", () => {
    expect(formatDateTimeBR("garbage")).toBe("—");
  });

  it("formatTimeBR returns HH:mm:ss", () => {
    const r = formatTimeBR(sample);
    expect(r).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
  it("formatTimeBR returns em-dash for invalid", () => {
    expect(formatTimeBR("nope")).toBe("—");
  });

  it("pads single digit components", () => {
    const single = new Date(2026, 0, 5, 3, 4, 7); // Jan 5 03:04:07 local
    expect(formatDateBR(single)).toContain("05/01/2026");
    expect(formatTimeBR(single)).toBe("03:04:07");
  });
});
