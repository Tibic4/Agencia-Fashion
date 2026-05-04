import { describe, it, expect } from "vitest";
import { getClientIp } from "./cf-ip";

function mkReq(headers: Record<string, string>): Request {
  return new Request("http://x.test", { headers });
}

describe("getClientIp (D-06 CF-aware)", () => {
  it("prefers cf-connecting-ip", () => {
    const req = mkReq({
      "cf-connecting-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2, 3.3.3.3",
      "x-real-ip": "4.4.4.4",
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to first hop of x-forwarded-for", () => {
    const req = mkReq({ "x-forwarded-for": "9.9.9.9, 10.10.10.10" });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    const req = mkReq({ "x-real-ip": "5.5.5.5" });
    expect(getClientIp(req)).toBe("5.5.5.5");
  });

  it("returns 'unknown' when all headers absent", () => {
    const req = mkReq({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace in x-forwarded-for first hop", () => {
    const req = mkReq({ "x-forwarded-for": "  7.7.7.7  , 8.8.8.8" });
    expect(getClientIp(req)).toBe("7.7.7.7");
  });
});
