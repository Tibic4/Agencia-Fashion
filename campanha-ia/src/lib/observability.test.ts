import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, captureSyntheticAlert } from "./observability";
import * as Sentry from "@sentry/nextjs";

describe("logger", () => {
  it("chama console.log para info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("test_event", { foo: "bar" });
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0][0] as string;
    expect(call).toContain("[info]");
    expect(call).toContain("test_event");
    expect(call).toContain('"foo":"bar"');
    spy.mockRestore();
  });

  it("chama console.error para error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("bad thing");
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain("[error]");
    spy.mockRestore();
  });

  it("loga debug em dev", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.debug("dev debug");
    // Vitest roda com NODE_ENV=test, não production — então debug deve aparecer.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── Phase 02 D-10 — captureSyntheticAlert ──────────────────────────────────

vi.mock("@sentry/nextjs", () => {
  // Closure-captured spies so per-test assertions can introspect calls.
  const setLevel = vi.fn();
  const setFingerprint = vi.fn();
  const setExtra = vi.fn();
  const captureMessage = vi.fn();
  const withScope = vi.fn((cb: (scope: unknown) => void) => {
    cb({ setLevel, setFingerprint, setExtra });
  });
  return {
    withScope,
    captureMessage,
    captureException: vi.fn(),
    setUser: vi.fn(),
    // Expose the spies so tests can read them via the imported namespace.
    __spies: { setLevel, setFingerprint, setExtra, captureMessage, withScope },
  };
});

describe("captureSyntheticAlert", () => {
  // Re-grab the mock spies fresh — they're stable across imports because the
  // mock factory above closures them once at module load.
  const spies = (Sentry as unknown as { __spies: {
    setLevel: ReturnType<typeof vi.fn>;
    setFingerprint: ReturnType<typeof vi.fn>;
    setExtra: ReturnType<typeof vi.fn>;
    captureMessage: ReturnType<typeof vi.fn>;
    withScope: ReturnType<typeof vi.fn>;
  } }).__spies;

  beforeEach(() => {
    spies.setLevel.mockClear();
    spies.setFingerprint.mockClear();
    spies.setExtra.mockClear();
    spies.captureMessage.mockClear();
    spies.withScope.mockClear();
  });

  it("Test 1: calls captureMessage + setFingerprint exactly once with correct args", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    captureSyntheticAlert(
      "face_wrong rate spiked to 8%",
      "face_wrong_spike_20260504",
      { top_prompt_versions: ["a1b2c3"] },
    );
    expect(spies.captureMessage).toHaveBeenCalledTimes(1);
    expect(spies.captureMessage).toHaveBeenCalledWith(
      "face_wrong rate spiked to 8%",
      "warning",
    );
    expect(spies.setFingerprint).toHaveBeenCalledTimes(1);
    expect(spies.setFingerprint).toHaveBeenCalledWith(["face_wrong_spike_20260504"]);
    expect(spies.setLevel).toHaveBeenCalledWith("warning");
    consoleWarn.mockRestore();
  });

  it("Test 2: sets breadcrumbs via setExtra", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const breadcrumbs = { top_prompt_versions: ["abc123", "def456"], delta_pp: 6 };
    captureSyntheticAlert("test message", "test_fingerprint_20260504", breadcrumbs);
    // setExtra should have been called for breadcrumbs + alert_kind marker.
    const calls = spies.setExtra.mock.calls;
    const breadcrumbsCall = calls.find((c) => c[0] === "breadcrumbs");
    expect(breadcrumbsCall).toBeDefined();
    expect(breadcrumbsCall![1]).toEqual(breadcrumbs);
    const kindCall = calls.find((c) => c[0] === "alert_kind");
    expect(kindCall).toBeDefined();
    expect(kindCall![1]).toBe("synthetic_threshold_breach");
    consoleWarn.mockRestore();
  });

  it("Test 3: re-calling with same fingerprint twice does not throw (Sentry handles dedup)", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => {
      captureSyntheticAlert("msg", "face_wrong_spike_20260504", { x: 1 });
      captureSyntheticAlert("msg", "face_wrong_spike_20260504", { x: 1 });
    }).not.toThrow();
    expect(spies.captureMessage).toHaveBeenCalledTimes(2);
    expect(spies.setFingerprint).toHaveBeenCalledTimes(2);
    consoleWarn.mockRestore();
  });

  it("Test 4: never throws even if Sentry.captureMessage throws internally", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    spies.captureMessage.mockImplementationOnce(() => {
      throw new Error("Sentry transport down");
    });
    expect(() => {
      captureSyntheticAlert("msg", "fp_20260504", { x: 1 });
    }).not.toThrow();
    consoleWarn.mockRestore();
  });
});
