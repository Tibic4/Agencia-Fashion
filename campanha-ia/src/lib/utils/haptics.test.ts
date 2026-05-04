import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { haptics } from "./haptics";

const vibrateSpy = vi.fn();

// Node 22+ ships a getter-only `navigator` global. Override with
// defineProperty so we can swap it per-test.
function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vibrateSpy.mockReset();
  setNavigator({ vibrate: vibrateSpy });
});

afterEach(() => {
  // Reset to a benign empty-navigator (the original getter-backed one is
  // not restorable cheaply; tests don't depend on the real Node default).
  setNavigator({});
});

describe("haptics web utility", () => {
  it("light → vibrates 10ms", () => {
    haptics.light();
    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });
  it("medium → vibrates 25ms", () => {
    haptics.medium();
    expect(vibrateSpy).toHaveBeenCalledWith(25);
  });
  it("selection → vibrates 5ms", () => {
    haptics.selection();
    expect(vibrateSpy).toHaveBeenCalledWith(5);
  });
  it("success → vibrates pattern [20,50,20]", () => {
    haptics.success();
    expect(vibrateSpy).toHaveBeenCalledWith([20, 50, 20]);
  });
  it("error → vibrates pattern [40,60,40]", () => {
    haptics.error();
    expect(vibrateSpy).toHaveBeenCalledWith([40, 60, 40]);
  });

  it("safely no-ops when navigator.vibrate is undefined", () => {
    setNavigator({});
    expect(() => haptics.light()).not.toThrow();
    expect(() => haptics.medium()).not.toThrow();
    expect(() => haptics.success()).not.toThrow();
    expect(() => haptics.error()).not.toThrow();
    expect(() => haptics.selection()).not.toThrow();
  });
});
