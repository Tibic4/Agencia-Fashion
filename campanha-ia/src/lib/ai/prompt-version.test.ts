/**
 * Tests for prompt-version helper (D-15).
 *
 * Verifies the 12-char SHA-256 hex prefix contract used by api_cost_logs.metadata.prompt_version.
 * The hash MUST be deterministic across processes so that two boots of the same prompt
 * string produce the same identifier — that is the whole point of the version column.
 */

import { describe, expect, it } from "vitest";
import { computePromptVersion } from "./prompt-version";

describe("computePromptVersion", () => {
  it("returns the 12-char SHA-256 hex prefix of 'hello world'", () => {
    // node -e "console.log(require('crypto').createHash('sha256').update('hello world').digest('hex').slice(0,12))"
    expect(computePromptVersion("hello world")).toBe("b94d27b9934d");
  });

  it("is deterministic — two calls with the same input return the same value", () => {
    const a = computePromptVersion("the quick brown fox jumps over the lazy dog");
    const b = computePromptVersion("the quick brown fox jumps over the lazy dog");
    expect(a).toBe(b);
    expect(a).toHaveLength(12);
  });

  it("is case-sensitive ('a' and 'A' produce different hashes)", () => {
    expect(computePromptVersion("a")).not.toBe(computePromptVersion("A"));
  });

  it("returns the empty-string SHA prefix 'e3b0c44298fc' for ''", () => {
    expect(computePromptVersion("")).toBe("e3b0c44298fc");
  });
});
