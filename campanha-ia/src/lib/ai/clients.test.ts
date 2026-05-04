import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const anthropicCtorMock = vi.fn();
const googleGenAICtorMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    constructor(opts: unknown) {
      anthropicCtorMock(opts);
    }
  }
  return { default: FakeAnthropic };
});
vi.mock("@google/genai", () => {
  class FakeGoogleGenAI {
    constructor(opts: unknown) {
      googleGenAICtorMock(opts);
    }
  }
  return { GoogleGenAI: FakeGoogleGenAI };
});

import {
  MissingAIKeyError,
  __resetAIClientsForTests,
  getAnthropic,
  getGoogleGenAI,
} from "./clients";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __resetAIClientsForTests();
  anthropicCtorMock.mockReset();
  googleGenAICtorMock.mockReset();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("MissingAIKeyError", () => {
  it("carries provider + envVar list in message and code", () => {
    const e = new MissingAIKeyError("anthropic", ["ANTHROPIC_API_KEY"]);
    expect(e.code).toBe("MISSING_AI_KEY");
    expect(e.message).toContain("anthropic");
    expect(e.message).toContain("ANTHROPIC_API_KEY");
  });
});

describe("getAnthropic", () => {
  it("throws MissingAIKeyError when ANTHROPIC_API_KEY is missing", () => {
    expect(() => getAnthropic()).toThrow(MissingAIKeyError);
  });

  it("constructs once with maxRetries:2 and reuses singleton", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const c1 = getAnthropic();
    const c2 = getAnthropic();
    expect(c1).toBe(c2);
    expect(anthropicCtorMock).toHaveBeenCalledTimes(1);
    expect(anthropicCtorMock.mock.calls[0][0]).toMatchObject({
      apiKey: "sk-ant-test",
      maxRetries: 2,
    });
  });
});

describe("getGoogleGenAI", () => {
  it("throws when both GOOGLE_AI_API_KEY and GEMINI_API_KEY are missing", () => {
    expect(() => getGoogleGenAI()).toThrow(MissingAIKeyError);
  });

  it("prefers GOOGLE_AI_API_KEY", () => {
    process.env.GOOGLE_AI_API_KEY = "preferred-key";
    process.env.GEMINI_API_KEY = "fallback-key";
    getGoogleGenAI();
    expect(googleGenAICtorMock.mock.calls[0][0]).toEqual({ apiKey: "preferred-key" });
  });

  it("falls back to GEMINI_API_KEY when GOOGLE_AI_API_KEY is absent", () => {
    process.env.GEMINI_API_KEY = "gem-test";
    getGoogleGenAI();
    expect(googleGenAICtorMock.mock.calls[0][0]).toEqual({ apiKey: "gem-test" });
  });

  it("singleton across calls", () => {
    process.env.GOOGLE_AI_API_KEY = "k1";
    const a = getGoogleGenAI();
    const b = getGoogleGenAI();
    expect(a).toBe(b);
    expect(googleGenAICtorMock).toHaveBeenCalledTimes(1);
  });
});

describe("__resetAIClientsForTests", () => {
  it("forces re-construction on next get* call", () => {
    process.env.ANTHROPIC_API_KEY = "k1";
    getAnthropic();
    __resetAIClientsForTests();
    process.env.ANTHROPIC_API_KEY = "k2";
    getAnthropic();
    expect(anthropicCtorMock).toHaveBeenCalledTimes(2);
    expect(anthropicCtorMock.mock.calls[1][0].apiKey).toBe("k2");
  });
});
