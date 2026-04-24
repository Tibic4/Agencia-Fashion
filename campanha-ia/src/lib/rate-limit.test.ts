import { describe, it, expect } from "vitest";
import { checkLoginRateLimit, resetLoginRateLimit } from "./rate-limit";

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
