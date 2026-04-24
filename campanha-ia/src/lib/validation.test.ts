import { describe, it, expect } from "vitest";
import { isValidUuid } from "./validation";

describe("isValidUuid", () => {
  it("aceita UUIDs v4 válidos", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(true);
  });

  it("aceita UPPER case", () => {
    expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejeita strings malformadas", () => {
    expect(isValidUuid("abc")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isValidUuid("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716-44665544000Z")).toBe(false);
  });

  it("rejeita não-strings", () => {
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(123)).toBe(false);
    expect(isValidUuid({})).toBe(false);
    expect(isValidUuid([])).toBe(false);
  });

  it("rejeita SQL injection attempts", () => {
    expect(isValidUuid("'; DROP TABLE stores; --")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000' OR 1=1")).toBe(false);
  });
});
