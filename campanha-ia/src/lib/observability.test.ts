import { describe, it, expect, vi } from "vitest";
import { logger } from "./observability";

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
