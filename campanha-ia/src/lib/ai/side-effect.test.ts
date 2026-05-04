import { describe, it, expect, vi } from "vitest";
import { sideEffect } from "./side-effect";

describe("sideEffect", () => {
  it("does NOT call fn when dryRun is true", async () => {
    const fn = vi.fn(async () => "ran");
    const result = await sideEffect({ dryRun: true }, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("calls fn and returns its value when dryRun is false", async () => {
    const fn = vi.fn(async () => "ran");
    const result = await sideEffect({ dryRun: false }, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe("ran");
  });

  it("calls fn and returns its value when dryRun is undefined", async () => {
    const fn = vi.fn(async () => 42);
    const result = await sideEffect({}, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe(42);
  });

  it("propagates fn errors (does not swallow)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(sideEffect({ dryRun: false }, fn)).rejects.toThrow("boom");
  });

  it("does NOT propagate errors when dryRun is true (fn never runs)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(sideEffect({ dryRun: true }, fn)).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
