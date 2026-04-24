import { describe, it, expect, beforeAll } from "vitest";
import { signEditorSession, verifyEditorSession, timingSafeStringEqual } from "./editor-session";

describe("editor-session", () => {
  beforeAll(() => {
    process.env.EDITOR_SESSION_SECRET = "test-secret-for-unit-tests-only";
  });

  it("signs a token and verifies it round-trip", () => {
    const token = signEditorSession(3600);
    expect(token.split(".").length).toBe(4);
    expect(verifyEditorSession(token)).toBe(true);
  });

  it("rejects null/undefined/empty tokens", () => {
    expect(verifyEditorSession(null)).toBe(false);
    expect(verifyEditorSession(undefined)).toBe(false);
    expect(verifyEditorSession("")).toBe(false);
  });

  it("rejects malformed token", () => {
    expect(verifyEditorSession("garbage")).toBe(false);
    expect(verifyEditorSession("a.b.c")).toBe(false);
    expect(verifyEditorSession("1.2.3.4.5")).toBe(false);
  });

  it("rejects expired token", () => {
    // TTL -1 → expira imediatamente
    const token = signEditorSession(-1);
    expect(verifyEditorSession(token)).toBe(false);
  });

  it("rejects token with tampered signature", () => {
    const token = signEditorSession(3600);
    const parts = token.split(".");
    parts[3] = "0".repeat(parts[3].length);
    expect(verifyEditorSession(parts.join("."))).toBe(false);
  });

  it("rejects token with tampered timestamp", () => {
    const token = signEditorSession(3600);
    const parts = token.split(".");
    parts[0] = String(parseInt(parts[0], 10) + 10000);
    expect(verifyEditorSession(parts.join("."))).toBe(false);
  });

  describe("timingSafeStringEqual", () => {
    it("returns true for equal strings", () => {
      expect(timingSafeStringEqual("abc123", "abc123")).toBe(true);
    });
    it("returns false for different strings", () => {
      expect(timingSafeStringEqual("abc123", "abc124")).toBe(false);
    });
    it("returns false for different lengths", () => {
      expect(timingSafeStringEqual("abc", "abcd")).toBe(false);
    });
    it("handles empty strings", () => {
      expect(timingSafeStringEqual("", "")).toBe(true);
      expect(timingSafeStringEqual("", "x")).toBe(false);
    });
  });
});
