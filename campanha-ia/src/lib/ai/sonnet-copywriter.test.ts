/**
 * Tests for the Sonnet copywriter — D-16 (Phase 01 AI Pipeline Hardening, Plan 05).
 *
 * Two layers under test:
 *   1. The Zod boundary schema + the SonnetInvalidOutputError class
 *      (Task 1 — additive; no Anthropic interaction yet).
 *   2. The tool_use rewrite of generateCopyWithSonnet (Task 2 — happy path,
 *      missing tool_use block, Zod failure, withTimeout invocation,
 *      logModelCost is NOT called from inside this module — it's owned by
 *      pipeline.ts; tested elsewhere in log-model-cost.test.ts).
 *
 * Mocking strategy:
 *  - `./clients` (`getAnthropic`): inject a stub Anthropic client so we
 *    control the response shape without real API calls.
 *  - `./with-timeout`: spy on `withTimeout` to assert the wrapper is wired
 *    in with the locked label + 30s deadline (T-05-03 mitigation).
 *  - `@/lib/observability` (`captureError`): spy to assert Sentry is paged
 *    on both the no-tool-block path and the Zod-failure path.
 *
 * Why no logModelCost spy here: in pipeline v7 the cost-log call lives at
 * `lib/ai/pipeline.ts:212-227` (the `.then(...)` chain on copyPromise), NOT
 * inside generateCopyWithSonnet. log-model-cost.test.ts already pins that
 * contract via the C-02 determinism gate. Re-spying on it from this file
 * would double-test, drift over time, and obscure where the real wiring is.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (set up before importing the module-under-test) ──────────────

// Stubbed Anthropic client. Tests rewrite `mockMessagesCreate` per case.
// Typed as a variadic mock so vi.fn's generic constraint resolves to the
// callable arm (otherwise Vitest 4.x's overload picks the Constructable arm
// and tsc rejects the call expression downstream).
type MessagesCreateFn = (...args: unknown[]) => Promise<unknown>;
let mockMessagesCreate: ReturnType<typeof vi.fn<MessagesCreateFn>> = vi.fn<MessagesCreateFn>();

vi.mock("./clients", () => ({
  getAnthropic: () => ({
    messages: {
      create: (...args: unknown[]) => mockMessagesCreate(...args),
    },
  }),
}));

// Spy on withTimeout but preserve the real promise plumbing — we want to
// assert the call shape (label + ms) and still let the underlying mock
// resolution drive test outcomes.
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

/** A valid SonnetDicasPostagem payload; mirrors the locked tool input_schema. */
const validDicas = {
  melhor_dia: "Terça — público engajado meio de semana",
  melhor_horario: "21h — momento de relax + scroll",
  sequencia_sugerida: "Feed primeiro, story 30min depois",
  caption_sugerida: "Achei a calça que afina sem apertar 👖",
  caption_alternativa: "Wide leg que cai bem em qualquer corpo",
  tom_legenda: "Descontraído e direto",
  cta: "Manda WIDE no direct",
  dica_extra: "Combine com close-up da peça",
  story_idea: "Enquete: comprariam essa peça?",
  hashtags: ["modafeminina", "lookdodia", "wideleg", "calcaalfaiataria", "achadosfashion"],
  legendas: [
    { foto: 1, plataforma: "Instagram Feed", legenda: "Achei a calça 👖", hashtags: ["wideleg"], dica: "use no feed" },
    { foto: 2, plataforma: "WhatsApp", legenda: "Oi! Chegou novidade", dica: "tom 1:1" },
    { foto: 3, plataforma: "Stories", legenda: "Vote: nova ou clássica?", dica: "use enquete" },
  ],
};

/** Standard Anthropic Message shape with one tool_use block + usage metadata. */
function makeToolUseResponse(input: unknown) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [
      { type: "tool_use", id: "toolu_test", name: "generate_dicas_postagem", input },
    ],
    usage: { input_tokens: 1234, output_tokens: 567 },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Task 1: Schema + error class contract.
// ─────────────────────────────────────────────────────────────────────

describe("SonnetDicasPostagemSchema (Zod boundary, D-16)", () => {
  it("safeParse accepts a fully populated valid payload", async () => {
    const { SonnetDicasPostagemSchema } = await import("./sonnet-copywriter");
    const result = SonnetDicasPostagemSchema.safeParse(validDicas);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.caption_sugerida).toBe(validDicas.caption_sugerida);
      expect(result.data.legendas).toHaveLength(3);
      expect(result.data.hashtags).toHaveLength(5);
    }
  });

  it("safeParse rejects empty caption_sugerida (min(1))", async () => {
    const { SonnetDicasPostagemSchema } = await import("./sonnet-copywriter");
    const bad = { ...validDicas, caption_sugerida: "" };
    const result = SonnetDicasPostagemSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("safeParse rejects legendas with fewer than 3 entries (min(3))", async () => {
    const { SonnetDicasPostagemSchema } = await import("./sonnet-copywriter");
    const bad = {
      ...validDicas,
      legendas: [{ foto: 1, plataforma: "Instagram Feed", legenda: "x" }],
    };
    const result = SonnetDicasPostagemSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("safeParse rejects payload missing required fields", async () => {
    const { SonnetDicasPostagemSchema } = await import("./sonnet-copywriter");
    // Drop caption_sugerida entirely
    const { caption_sugerida: _drop, ...bad } = validDicas;
    const result = SonnetDicasPostagemSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("SonnetInvalidOutputError (D-16)", () => {
  it("instances carry the locked code + retryable=false + a PT-BR userMessage", async () => {
    const { SonnetInvalidOutputError } = await import("./sonnet-copywriter");
    const err = new SonnetInvalidOutputError("schema drift");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("SONNET_INVALID_OUTPUT");
    expect(err.retryable).toBe(false);
    expect(err.userMessage).toMatch(/inesperado/i);
    expect(err.message).toBe("schema drift");
  });

  it("optional cause is preserved on the instance", async () => {
    const { SonnetInvalidOutputError } = await import("./sonnet-copywriter");
    const cause = new Error("zod issue");
    const err = new SonnetInvalidOutputError("Zod boundary failed", cause);
    expect(err.cause).toBe(cause);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Task 2: generateCopyWithSonnet — tool_use rewrite contract.
// ─────────────────────────────────────────────────────────────────────

describe("generateCopyWithSonnet — tool_use happy path", () => {
  it("returns dicas_postagem and _usageMetadata when the tool_use block is valid", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(validDicas));
    const { generateCopyWithSonnet } = await import("./sonnet-copywriter");

    const result = await generateCopyWithSonnet({ targetLocale: "pt-BR" });
    expect(result.dicas_postagem.caption_sugerida).toBe(validDicas.caption_sugerida);
    expect(result.dicas_postagem.legendas).toHaveLength(3);
    expect(result._usageMetadata).toEqual({ inputTokens: 1234, outputTokens: 567 });
  });

  it("calls Anthropic with tools[generateDicasPostagemTool] + tool_choice forcing the named tool", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(validDicas));
    const { generateCopyWithSonnet } = await import("./sonnet-copywriter");

    await generateCopyWithSonnet({ targetLocale: "pt-BR" });
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    // The mock arg is typed `unknown` — narrow once via a single assertion at
    // the boundary so the rest of the test reads naturally.
    const callArgs = mockMessagesCreate.mock.calls[0][0] as {
      model: string;
      max_tokens: number;
      temperature: number;
      tool_choice: unknown;
      tools: Array<{ name: string; input_schema?: { type: string } }>;
    };
    expect(callArgs.model).toBe("claude-sonnet-4-6");
    expect(callArgs.max_tokens).toBe(1500);
    expect(callArgs.temperature).toBe(0.7);
    expect(callArgs.tool_choice).toEqual({ type: "tool", name: "generate_dicas_postagem" });
    expect(Array.isArray(callArgs.tools)).toBe(true);
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].name).toBe("generate_dicas_postagem");
    expect(callArgs.tools[0].input_schema?.type).toBe("object");
  });

  it("wraps the call with withTimeout(30_000, 'Sonnet Copy') — T-05-03 liveness mitigation", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(validDicas));
    const { generateCopyWithSonnet } = await import("./sonnet-copywriter");

    await generateCopyWithSonnet({ targetLocale: "pt-BR" });
    expect(realWithTimeoutMock).toHaveBeenCalledTimes(1);
    const [, ms, label] = realWithTimeoutMock.mock.calls[0];
    expect(ms).toBe(30_000);
    expect(label).toBe("Sonnet Copy");
  });
});

describe("generateCopyWithSonnet — failure paths (T-05-01 schema drift, T-05-04 no-retry)", () => {
  it("throws SonnetInvalidOutputError + pages Sentry when no tool_use block is present", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      stop_reason: "max_tokens",
      stop_sequence: null,
      content: [{ type: "text", text: "I'm thinking about it…" }],
      usage: { input_tokens: 100, output_tokens: 5 },
    });
    const { generateCopyWithSonnet, SonnetInvalidOutputError } = await import("./sonnet-copywriter");

    await expect(generateCopyWithSonnet({ targetLocale: "pt-BR" })).rejects.toBeInstanceOf(
      SonnetInvalidOutputError,
    );
    expect(captureErrorSpy).toHaveBeenCalledTimes(1);
    const [errArg, ctxArg] = captureErrorSpy.mock.calls[0] as [
      Error,
      { extra: { stop_reason: string } },
    ];
    expect(errArg).toBeInstanceOf(SonnetInvalidOutputError);
    expect(errArg.message).toMatch(/tool_use block/);
    expect(ctxArg.extra.stop_reason).toBe("max_tokens");
  });

  it("throws SonnetInvalidOutputError + pages Sentry when tool_use.input fails Zod validation", async () => {
    // Drop a required field — Zod boundary should catch this.
    const { caption_sugerida: _drop, ...bad } = validDicas;
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse(bad));
    const { generateCopyWithSonnet, SonnetInvalidOutputError } = await import("./sonnet-copywriter");

    await expect(generateCopyWithSonnet({ targetLocale: "pt-BR" })).rejects.toBeInstanceOf(
      SonnetInvalidOutputError,
    );
    expect(captureErrorSpy).toHaveBeenCalledTimes(1);
    const [errArg, ctxArg] = captureErrorSpy.mock.calls[0] as [
      Error,
      { extra: { input: unknown } },
    ];
    expect(errArg).toBeInstanceOf(SonnetInvalidOutputError);
    expect(errArg.message).toMatch(/^Zod boundary validation failed:/);
    // The mitigated input is forwarded so the Sentry breadcrumb has the
    // exact payload that broke the schema (T-05-02 disposition: accept).
    expect(ctxArg.extra.input).toEqual(bad);
  });

  it("does NOT retry on schema-validation failure (T-05-04 — no money burn on irrecoverable drift)", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeToolUseResponse({ broken: "shape" }));
    const { generateCopyWithSonnet, SonnetInvalidOutputError } = await import("./sonnet-copywriter");

    await expect(generateCopyWithSonnet({ targetLocale: "pt-BR" })).rejects.toBeInstanceOf(
      SonnetInvalidOutputError,
    );
    // Zod failure path → captureError fires → throw. No second messages.create.
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });
});

describe("generateCopyWithSonnet — tool_use block selection (regex-replacement edge case)", () => {
  it("ignores leading text blocks and finds the named tool_use block", async () => {
    // Edge case: even with tool_choice forcing a tool, the SDK contract
    // technically allows leading content before the tool_use block. The
    // parser must iterate `response.content` and select by name (the
    // current regex parser would have walked text and exploded).
    mockMessagesCreate.mockResolvedValueOnce({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      stop_reason: "tool_use",
      stop_sequence: null,
      content: [
        { type: "text", text: "thinking out loud" },
        { type: "tool_use", id: "toolu_test", name: "generate_dicas_postagem", input: validDicas },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const { generateCopyWithSonnet } = await import("./sonnet-copywriter");

    const result = await generateCopyWithSonnet({ targetLocale: "pt-BR" });
    expect(result.dicas_postagem.caption_sugerida).toBe(validDicas.caption_sugerida);
  });
});
