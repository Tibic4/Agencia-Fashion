import { describe, it, expect } from "vitest";
import { checkLoginRateLimit, checkRateLimit, resetLoginRateLimit } from "./rate-limit";

describe("checkLoginRateLimit", () => {
  it("allows up to maxAttempts within window", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit({ key, maxAttempts: 5 }).allowed).toBe(true);
    }
    expect(checkLoginRateLimit({ key, maxAttempts: 5 }).allowed).toBe(false);
  });

  it("resets after explicit reset", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) checkLoginRateLimit({ key, maxAttempts: 5 });
    expect(checkLoginRateLimit({ key, maxAttempts: 5 }).allowed).toBe(false);
    resetLoginRateLimit(key);
    expect(checkLoginRateLimit({ key, maxAttempts: 5 }).allowed).toBe(true);
  });

  it("returns retryAfterMs when blocked", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) checkLoginRateLimit({ key, maxAttempts: 5 });
    const r = checkLoginRateLimit({ key, maxAttempts: 5, blockDurationMs: 30000 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(30000);
  });

  it("independent keys don't affect each other", () => {
    const k1 = `test:${Math.random()}`;
    const k2 = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) checkLoginRateLimit({ key: k1, maxAttempts: 5 });
    expect(checkLoginRateLimit({ key: k1, maxAttempts: 5 }).allowed).toBe(false);
    expect(checkLoginRateLimit({ key: k2, maxAttempts: 5 }).allowed).toBe(true);
  });
});

describe("checkRateLimit (per-IP)", () => {
  function freshIp(prefix = "ip"): string {
    return `${prefix}-${Math.random().toString(36).slice(2)}`;
  }

  it("allows initial requests for an unseen IP", () => {
    const r = checkRateLimit(freshIp());
    expect(r.allowed).toBe(true);
  });

  it("blocks after the anonymous hourly limit (3)", () => {
    const ip = freshIp();
    expect(checkRateLimit(ip).allowed).toBe(true);
    expect(checkRateLimit(ip).allowed).toBe(true);
    expect(checkRateLimit(ip).allowed).toBe(true);
    const blocked = checkRateLimit(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("authenticated bucket is independent of anonymous (separate keys)", () => {
    const ip = freshIp();
    // anon: max 3
    checkRateLimit(ip);
    checkRateLimit(ip);
    checkRateLimit(ip);
    expect(checkRateLimit(ip).allowed).toBe(false);
    // auth bucket should still allow (separate `auth:` prefix)
    expect(checkRateLimit(ip, { authenticated: true }).allowed).toBe(true);
  });

  it("authenticated allows up to 15/hour", () => {
    const ip = freshIp();
    for (let i = 0; i < 15; i++) {
      expect(checkRateLimit(ip, { authenticated: true }).allowed).toBe(true);
    }
    expect(checkRateLimit(ip, { authenticated: true }).allowed).toBe(false);
  });
});
