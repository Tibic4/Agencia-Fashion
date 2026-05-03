/**
 * Tests for runCampaignPipeline — Phase 02 D-18 dryRun guard.
 *
 * Mocks every external collaborator so the test runs offline in <2s:
 *   - `./gemini-analyzer` → stub analyzer result
 *   - `./gemini-vto-generator` → stub VTO result with successCount=1
 *   - `./sonnet-copywriter` → stub copy result
 *   - `./log-model-cost` → spy on logModelCost (must NOT fire under dryRun)
 *   - `@/lib/supabase/admin` → spy on createAdminClient (must NOT fire
 *     under dryRun for the pose-history block)
 *   - `./identity-translations` → real (pure utilities)
 *
 * Test coverage (5 cases per the plan's <behavior> block):
 *   1. dryRun:true → pose-history Supabase update is NOT called.
 *   2. dryRun:true → logModelCost is NOT called (analyzer + sonnet sites).
 *   3. dryRun:false → both side effects fire (Phase 01 behavior preserved).
 *   4. dryRun omitted → defaults to false (backwards-compat assertion).
 *   5. dryRun:true → return shape is still populated (eval consumers need
 *      dicas_postagem + images).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (set up before importing the module-under-test) ──────────────

const mockAnalyzeWithGemini = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGenerateWithGeminiVTO = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGenerateCopyWithSonnet = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockLogModelCost = vi.fn<(...args: unknown[]) => Promise<void>>();
const mockCreateAdminClient = vi.fn<() => unknown>();
const mockInngestSend = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock("./gemini-analyzer", () => ({
  analyzeWithGemini: (...args: unknown[]) => mockAnalyzeWithGemini(...args),
  ANALYZER_PROMPT_VERSION: "test_analyzer_v",
}));

vi.mock("./gemini-vto-generator", () => ({
  generateWithGeminiVTO: (...args: unknown[]) => mockGenerateWithGeminiVTO(...args),
}));

vi.mock("./sonnet-copywriter", () => ({
  generateCopyWithSonnet: (...args: unknown[]) => mockGenerateCopyWithSonnet(...args),
  sonnetPromptVersionFor: (locale: string) => `test_sonnet_${locale}`,
}));

vi.mock("./log-model-cost", () => ({
  logModelCost: (...args: unknown[]) => mockLogModelCost(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

// Phase 02 D-01: pipeline emits campaign/judge.requested via inngest.send.
// Mock the singleton so we can spy on the call without bringing up Inngest.
vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

// ── Stub fixtures shared across cases ───────────────────────────────────

function makeAnalyzerResult() {
  return {
    analise: {
      tipo_peca: "Vestido",
      cor_principal: "Floral",
      ocasiao: "Casual chique",
    },
    vto_hints: {
      pose_index: 2,
      scene_prompts: ["a model wearing a dress"],
      aspect_ratio: "3:4",
      category: "dresses",
    },
    _usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      totalTokenCount: 150,
    },
  };
}

function makeVTOResult() {
  return {
    // imageUrl is the field pipeline.ts:319 reads to build the
    // judge.requested event payload. base64 is the original byte slot.
    images: [
      {
        base64: "img-bytes",
        imageUrl: "https://supabase.test/vto-output.png",
        mimeType: "image/png",
        durationMs: 4200,
      },
    ],
    successCount: 1,
    totalDurationMs: 4200,
  };
}

function makeCopyResult() {
  return {
    dicas_postagem: {
      melhor_dia: "Terça",
      melhor_horario: "21h",
      sequencia_sugerida: "Feed → Story",
      caption_sugerida: "Olha que peça maravilhosa!",
      caption_alternativa: "Detalhe que faz a diferença",
      tom_legenda: "Descontraído",
      cta: "Manda QUERO",
      dica_extra: "Combine com close-up",
      story_idea: "Faça uma enquete",
      hashtags: ["a", "b", "c", "d", "e"],
      legendas: [
        { foto: 1, plataforma: "Feed", legenda: "x" },
        { foto: 2, plataforma: "Stories", legenda: "y" },
        { foto: 3, plataforma: "WhatsApp", legenda: "z" },
      ],
    },
    _usageMetadata: { inputTokens: 200, outputTokens: 80 },
  };
}

const validInput = {
  imageBase64: "AAA=",
  modelImageBase64: "BBB=",
  storeId: "store-test-123",
  campaignId: "camp-test-456",
  targetLocale: "pt-BR" as const,
};

// ── Test setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockAnalyzeWithGemini.mockReset();
  mockGenerateWithGeminiVTO.mockReset();
  mockGenerateCopyWithSonnet.mockReset();
  mockLogModelCost.mockReset();
  mockCreateAdminClient.mockReset();
  mockInngestSend.mockReset();

  mockAnalyzeWithGemini.mockResolvedValue(makeAnalyzerResult());
  mockGenerateWithGeminiVTO.mockResolvedValue(makeVTOResult());
  mockGenerateCopyWithSonnet.mockResolvedValue(makeCopyResult());
  mockLogModelCost.mockResolvedValue(undefined);
  mockInngestSend.mockResolvedValue({ ids: ["evt-test"] });

  // Supabase admin chain: ".from(...).select(...).eq(...).single()" returns
  // null pose history; ".from(...).update(...).eq(...)" resolves silently.
  // Tests assert on createAdminClient call count rather than the chain shape.
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { recent_pose_indices: [] } }),
    update: vi.fn().mockReturnThis(),
  };
  mockCreateAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helper to await microtasks (the pose-history void IIFE is fire-and-forget) ──

async function flushMicrotasks() {
  // Two ticks: one for the await import, one for the supabase chain.
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

// ─────────────────────────────────────────────────────────────────────
// Behavior 1 + 2 + 5: dryRun:true skips side effects, still returns data
// ─────────────────────────────────────────────────────────────────────

describe("runCampaignPipeline — dryRun: true (D-18)", () => {
  it("does NOT call logModelCost at any of the analyzer/sonnet sites", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput, dryRun: true });
    expect(mockLogModelCost).not.toHaveBeenCalled();
  });

  it("does NOT update pose-history (createAdminClient never invoked from the post-VTO block)", async () => {
    // The pre-VTO read may invoke createAdminClient to fetch pose history
    // — that's a READ, not a WRITE, and the dryRun contract per D-18 only
    // gates WRITES. We assert here on the post-VTO update block by
    // counting createAdminClient invocations: dryRun:true should produce
    // exactly one (the read); dryRun:false should produce two (read + write).
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput, dryRun: true });
    await flushMicrotasks();
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
  });

  it("still returns a populated PipelineResult — eval consumers need dicas_postagem + images", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    const result = await runCampaignPipeline({ ...validInput, dryRun: true });
    expect(result.dicas_postagem.caption_sugerida).toBe("Olha que peça maravilhosa!");
    expect(result.images).toHaveLength(1);
    expect(result.successCount).toBe(1);
    expect(result.analise.tipo_peca).toBe("Vestido");
    expect(result.vto_hints.aspect_ratio).toBe("3:4");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Behavior 3 + 4: dryRun:false (default) preserves Phase 01 behavior
// ─────────────────────────────────────────────────────────────────────

describe("runCampaignPipeline — dryRun: false / omitted (Phase 01 behavior)", () => {
  it("calls logModelCost for both analyzer and sonnet when dryRun: false", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput, dryRun: false });
    // Two sites: analyzer (line ~170) + sonnet .then (line ~212)
    expect(mockLogModelCost).toHaveBeenCalledTimes(2);
  });

  it("calls logModelCost for both analyzer and sonnet when dryRun is omitted (default false)", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput });
    expect(mockLogModelCost).toHaveBeenCalledTimes(2);
  });

  it("invokes createAdminClient TWICE when dryRun:false: pose-history read + post-VTO write", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput, dryRun: false });
    await flushMicrotasks();
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 02 D-01: campaign/judge.requested Inngest emit
// ─────────────────────────────────────────────────────────────────────

describe("runCampaignPipeline — campaign/judge.requested Inngest emit (D-01)", () => {
  it("does NOT emit when dryRun:true (eval traffic stays off Inngest)", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput, dryRun: true });
    await flushMicrotasks();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("emits ONCE with the locked event name + minimal payload when dryRun:false + successCount > 0", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput, dryRun: false });
    await flushMicrotasks();

    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const sent = mockInngestSend.mock.calls[0][0] as {
      name: string;
      data: Record<string, unknown>;
    };
    expect(sent.name).toBe("campaign/judge.requested");
    expect(sent.data).toMatchObject({
      campaignId: "camp-test-456",
      storeId: "store-test-123",
      copyText: "Olha que peça maravilhosa!",
      generatedImageUrl: "https://supabase.test/vto-output.png",
      prompt_version: "test_sonnet_pt-BR",
      // Known limitation per D-01 SUMMARY: pipeline.ts doesn't have
      // public Supabase URLs for product/model at emit time.
      productImageUrl: "",
      modelImageUrl: "",
    });
  });

  it("does NOT emit when successCount=0 (judge has nothing to score)", async () => {
    mockGenerateWithGeminiVTO.mockResolvedValueOnce({
      images: [null],
      successCount: 0,
      totalDurationMs: 4200,
    });
    const { runCampaignPipeline } = await import("./pipeline");
    await runCampaignPipeline({ ...validInput, dryRun: false });
    await flushMicrotasks();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("does NOT emit when storeId is missing (anonymous test invocations)", async () => {
    const { runCampaignPipeline } = await import("./pipeline");
    const { storeId: _drop, ...noStore } = validInput;
    await runCampaignPipeline({ ...noStore, dryRun: false });
    await flushMicrotasks();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});
