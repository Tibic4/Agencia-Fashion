/**
 * Tests for lib/ai/judge.ts — Phase 02 D-01..D-06.
 *
 * Mirrors sonnet-copywriter.test.ts mocking style:
 *   - `./clients` (`getAnthropic`): inject a stub Anthropic client.
 *   - `./with-timeout`: spy on `withTimeout` to assert label + ms.
 *   - `@/lib/observability` (`captureError`): spy to assert Sentry pages
 *     on both no-tool-block and Zod-failure paths.
 *
 * Coverage:
 *   - JudgeOutputSchema accepts a valid payload, rejects out-of-range,
 *     rejects missing required fields, rejects bad nivel_risco enum.
 *   - JudgeInvalidOutputError: code/userMessage/cause shape.
 *   - scoreCampaignQuality happy path: returns parsed output + usage.
 *   - scoreCampaignQuality calls Anthropic with locked tool_choice +
 *     `score_campaign_quality` tool name + correct model + temperature.
 *   - withTimeout invoked with `30_000` + label `"Judge Quality"`.
 *   - No tool_use block path: throws + pages Sentry with stop_reason ctx.
 *   - Zod validation fail path: throws + pages Sentry with toolBlock.input.
 *   - Leading-text-block edge: parser ignores text blocks and finds the
 *     named tool_use by `name`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (set up before importing the module-under-test) ──────────────

type MessagesCreateFn = (...args: unknown[]) => Promise<unknown>;
let mockMessagesCreate: ReturnType<typeof vi.fn<MessagesCreateFn>> = vi.fn<MessagesCreateFn>();

vi.mock("./clients", () => ({
  getAnthropic: () => ({
    messages: {
      create: (...args: unknown[]) => mockMessagesCreate(...args),
    },
  }),
}));

type WithTimeoutFn = (p: Promise<unknown>, ms: number, label: string) => Promise<unknown>;
const realWithTimeoutMock = vi.fn<WithTimeoutFn>((p) => p);
vi.mock("./with-timeout", () => ({
  withTimeout: (p: Promise<unknown>, ms: number, label: string) =>
    realWithTimeoutMock(p, ms, label),
}));

type CaptureErrorFn = (err: unknown, ctx?: Record<string, unknown>) => void;
const captureErrorSpy = vi.fn<CaptureErrorFn>();
vi.mock("@/lib/observability", () => ({
  captureError: (err: unknown, ctx?: Record<string, unknown>) => captureErrorSpy(err, ctx),
}));

beforeEach(() => {
  mockMessagesCreate = vi.fn<MessagesCreateFn>();
  realWithTimeoutMock.mockClear();
  realWithTimeoutMock.mockImplementation((p) => p);
  captureErrorSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Test fixtures ─────────────────────────────────────────────────────

const validJudgeOutput = {
  naturalidade: 4,
  conversao: 4,
  clareza: 5,
  aprovacao_meta: 5,
  nota_geral: 4,
  nivel_risco: "baixo",
  justificativa_naturalidade: "Hook claro nos primeiros 8 palavras",
  justificativa_conversao: "CTA específico (manda no direct)",
  justificativa_clareza: "Frases curtas em linhas separadas",
  justificativa_aprovacao_meta: "Sem termos médicos ou body-transformation",
  justificativa_nota_geral: "Copy bem estruturada com gatilho identificável",
  justificativa_nivel_risco: "Nenhum item da Forbidden List acionado",
};

function makeJudgeInput() {
  return {
    campaignId: "camp-test-123",
    storeId: "store-test-456",
    copyText: "Achei a calça que afina sem apertar 👖\nManda WIDE no direct",
    productImageUrl: "https://example.com/product.png",
    modelImageUrl: "https://example.com/model.png",
    generatedImageUrl: "https://example.com/vto.png",
    prompt_version: "abcdef123456",
  };
}

function makeToolUseResponse(input: unknown) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [
      { type: "tool_use", id: "toolu_test", name: "score_campaign_quality", input },
    ],
    usage: { input_tokens: 800, output_tokens: 600 },
  };
}

// ─────────────────────────────────────────────────────────────────────
// JudgeOutputSchema (Zod boundary)
// ─────────────────────────────────────────────────────────────────────

describe("JudgeOutputSchema (Zod boundary, D-03)", () => {
  it("safeParse accepts a fully populated valid payload", async () => {
    const { JudgeOutputSchema } = await import("./judge");
    const result = JudgeOutputSchema.safeParse(validJudgeOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nivel_risco).toBe("baixo");
      expect(result.data.naturalidade).toBe(4);
      expect(result.data.justificativa_naturalidade).toMatch(/Hook/);
    }
  });

  it("rejects naturalidade out of range (10 > 5)", async () => {
    const { JudgeOutputSchema } = await import("./judge");
    const bad = { ...validJudgeOutput, naturalidade: 10 };
    expect(JudgeOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects naturalidade below range (0 < 1)", async () => {
    const { JudgeOutputSchema } = await import("./judge");
    const bad = { ...validJudgeOutput, naturalidade: 0 };
    expect(JudgeOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects nivel_risco outside the locked enum (would-be 'falha_judge' from model)", async () => {
    // 'falha_judge' is the Inngest sentinel — judge model itself MUST
    // only emit baixo/medio/alto. If the model ever returns falha_judge
    // we want the Zod boundary to flag it (sentinel must come from us).
    const { JudgeOutputSchema } = await import("./judge");
    const bad = { ...validJudgeOutput, nivel_risco: "falha_judge" };
    expect(JudgeOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects payload missing a required justificativa", async () => {
    const { JudgeOutputSchema } = await import("./judge");
    const { justificativa_nota_geral: _drop, ...bad } = validJudgeOutput;
    expect(JudgeOutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe("JudgeInvalidOutputError (D-03)", () => {
  it("instances carry locked code + retryable=false + PT-BR userMessage", async () => {
    const { JudgeInvalidOutputError } = await import("./judge");
    const err = new JudgeInvalidOutputError("schema drift");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("JUDGE_INVALID_OUTPUT");
    expect(err.retryable).toBe(false);
    expect(err.userMessage).toMatch(/inesperado/i);
    expect(err.message).toBe("schema drift");
  });

  it("optional cause is preserved on the instance", async () => {
    const { JudgeInvalidOutputError } = await import("./judge");
    const cause = new Error("zod issue");
    const err = new JudgeInvalidOutputError("Zod boundary failed", cause);
    expect(err.cause).toBe(cause);
  });
});

describe("JUDGE_PROMPT_VERSION (D-05)", () => {
  it("is a 12-char hex SHA prefix (matches computePromptVersion contract)", async () => {
    const { JUDGE_PROMPT_VERSION } = await import("./judge");
    expect(JUDGE_PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is NOT one of the existing Phase 01 SHAs (must be a NEW prompt)", async () => {
    const { JUDGE_PROMPT_VERSION } = await import("./judge");
    // From .planning/phases/01 outputs — these are the 4 locked prompts.
    const phase01ShaList = [
      "368daa52106b", // Sonnet PT
      "6fb4023c4732", // Sonnet EN
      "5c900fb19472", // Analyzer
      "9d5c754caf28", // VTO
    ];
    expect(phase01ShaList).not.toContain(JUDGE_PROMPT_VERSION);
  });
});

// ─────────────────────────────────────────────────────────────────────
// scoreCampaignQuality — happy path
// ─────────────────────────────────────────────────────────────────────

describe("scoreCampaignQuality — happy path", () => {
  it("returns parsed output + usage when tool_use block is valid", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(validJudgeOutput));
    const { scoreCampaignQuality } = await import("./judge");

    const result = await scoreCampaignQuality(makeJudgeInput());
    expect(result.output.naturalidade).toBe(4);
    expect(result.output.nivel_risco).toBe("baixo");
    expect(result.output.justificativa_naturalidade).toMatch(/Hook/);
    expect(result._usageMetadata).toEqual({ inputTokens: 800, outputTokens: 600 });
    expect(typeof result.durationMs).toBe("number");
  });

  it("calls Anthropic with locked tool_choice + score_campaign_quality tool name + temp=0.2", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(validJudgeOutput));
    const { scoreCampaignQuality } = await import("./judge");

    await scoreCampaignQuality(makeJudgeInput());
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockMessagesCreate.mock.calls[0][0] as {
      model: string;
      max_tokens: number;
      temperature: number;
      tool_choice: unknown;
      tools: Array<{ name: string; input_schema?: { type: string } }>;
    };
    expect(callArgs.model).toBe("claude-sonnet-4-6");
    expect(callArgs.max_tokens).toBe(1500);
    expect(callArgs.temperature).toBe(0.2);
    expect(callArgs.tool_choice).toEqual({
      type: "tool",
      name: "score_campaign_quality",
    });
    expect(Array.isArray(callArgs.tools)).toBe(true);
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].name).toBe("score_campaign_quality");
    expect(callArgs.tools[0].input_schema?.type).toBe("object");
  });

  it("wraps the call with withTimeout(30_000, 'Judge Quality')", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(validJudgeOutput));
    const { scoreCampaignQuality } = await import("./judge");

    await scoreCampaignQuality(makeJudgeInput());
    expect(realWithTimeoutMock).toHaveBeenCalledTimes(1);
    const [, ms, label] = realWithTimeoutMock.mock.calls[0];
    expect(ms).toBe(30_000);
    expect(label).toBe("Judge Quality");
  });
});

// ─────────────────────────────────────────────────────────────────────
// scoreCampaignQuality — failure paths
// ─────────────────────────────────────────────────────────────────────

describe("scoreCampaignQuality — failure paths", () => {
  it("throws JudgeInvalidOutputError + pages Sentry when no tool_use block", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      stop_reason: "max_tokens",
      stop_sequence: null,
      content: [{ type: "text", text: "I'm thinking..." }],
      usage: { input_tokens: 100, output_tokens: 5 },
    });
    const { scoreCampaignQuality, JudgeInvalidOutputError } = await import("./judge");

    await expect(scoreCampaignQuality(makeJudgeInput())).rejects.toBeInstanceOf(
      JudgeInvalidOutputError,
    );
    expect(captureErrorSpy).toHaveBeenCalledTimes(1);
    const [errArg, ctxArg] = captureErrorSpy.mock.calls[0] as [
      Error,
      { extra: { stop_reason: string } },
    ];
    expect(errArg).toBeInstanceOf(JudgeInvalidOutputError);
    expect(errArg.message).toMatch(/tool_use block/);
    expect(ctxArg.extra.stop_reason).toBe("max_tokens");
  });

  it("throws JudgeInvalidOutputError + pages Sentry when tool_use.input fails Zod", async () => {
    // Out-of-range naturalidade — Zod boundary should catch.
    const bad = { ...validJudgeOutput, naturalidade: 10 };
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(bad));
    const { scoreCampaignQuality, JudgeInvalidOutputError } = await import("./judge");

    await expect(scoreCampaignQuality(makeJudgeInput())).rejects.toBeInstanceOf(
      JudgeInvalidOutputError,
    );
    expect(captureErrorSpy).toHaveBeenCalledTimes(1);
    const [errArg, ctxArg] = captureErrorSpy.mock.calls[0] as [
      Error,
      { extra: { input: unknown } },
    ];
    expect(errArg).toBeInstanceOf(JudgeInvalidOutputError);
    expect(errArg.message).toMatch(/^Zod boundary validation failed:/);
    expect(ctxArg.extra.input).toEqual(bad);
  });

  it("does NOT retry on schema-validation failure (no money burn on irrecoverable drift)", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse({ broken: "shape" }));
    const { scoreCampaignQuality, JudgeInvalidOutputError } = await import("./judge");

    await expect(scoreCampaignQuality(makeJudgeInput())).rejects.toBeInstanceOf(
      JudgeInvalidOutputError,
    );
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });
});

describe("scoreCampaignQuality — tool_use block selection (regex-replacement edge)", () => {
  it("ignores leading text blocks and finds the named tool_use block", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      stop_reason: "tool_use",
      stop_sequence: null,
      content: [
        { type: "text", text: "Pensando alto..." },
        {
          type: "tool_use",
          id: "toolu_test",
          name: "score_campaign_quality",
          input: validJudgeOutput,
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const { scoreCampaignQuality } = await import("./judge");

    const result = await scoreCampaignQuality(makeJudgeInput());
    expect(result.output.naturalidade).toBe(4);
  });
});
