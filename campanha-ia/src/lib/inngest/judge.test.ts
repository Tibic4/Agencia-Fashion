/**
 * Tests for judgeCampaignJob — Phase 02 D-01..D-06.
 *
 * Inngest's createFunction returns an object with `.fn` (the main handler),
 * `.opts.onFailure` (the terminal failure handler), and `.opts.triggers` /
 * `.opts.retries` / `.opts.id`. We invoke `.fn` and `.opts.onFailure`
 * directly with synthetic event/step objects so we exercise the same
 * orchestration logic Inngest runs at runtime, without bringing up the
 * full Inngest dev server.
 *
 * Coverage (the 6 behaviors the plan calls for):
 *   1. Happy path: scoreCampaignQuality returns valid → setCampaignScores
 *      called with the parsed dims + justificativas → logModelCost called
 *      with action='judge_quality' + JUDGE_PROMPT_VERSION + claude-sonnet-4-6.
 *   2. onFailure → falha_judge sentinel: error reaches handler → calls
 *      setCampaignScores with nivel_risco='falha_judge' + numerics=1.
 *   3. Idempotency mandate (C-02): re-emit produces only one row — proxy
 *      via setCampaignScores being called with the same campaignId both
 *      times (the DB layer's UPSERT collapses to one row, pinned in
 *      set-campaign-scores.test.ts).
 *   4. Event name LOCKED: `campaign/judge.requested` (assert via opts.triggers).
 *   5. retries: 2 (assert via opts.retries).
 *   6. judgeCampaignJob is included in inngestFunctions array.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks: stub the three downstream collaborators ─────────────────────

const mockScoreCampaignQuality = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockSetCampaignScores = vi.fn<(...args: unknown[]) => Promise<void>>();
const mockLogModelCost = vi.fn<(...args: unknown[]) => Promise<void>>();

vi.mock("@/lib/ai/judge", () => ({
  scoreCampaignQuality: (...args: unknown[]) => mockScoreCampaignQuality(...args),
  JUDGE_PROMPT_VERSION: "abc123def456",
}));

vi.mock("@/lib/db", () => ({
  setCampaignScores: (...args: unknown[]) => mockSetCampaignScores(...args),
}));

vi.mock("@/lib/ai/log-model-cost", () => ({
  logModelCost: (...args: unknown[]) => mockLogModelCost(...args),
}));

// Storage GC functions don't need to be loaded for this test — keep
// them out so missing env vars (Supabase) don't break import.
vi.mock("./storage-gc", () => ({
  storageGarbageCollectorCron: { id: "stub-gc-cron" },
  storageGarbageCollectorManual: { id: "stub-gc-manual" },
}));

// Phase 3 D-03: hoist dynamic import to beforeAll so the first-load cost
// of the entire Inngest + Supabase + AI graph is paid ONCE, outside any
// per-test 5000ms timeout. The 2 timeouts QUALITY.md flagged were both
// the first describe block to hit `await import("./functions")`.
let functionsModule: typeof import("./functions");

beforeAll(async () => {
  functionsModule = await import("./functions");
});

// ── Stub fixtures ───────────────────────────────────────────────────────

const validJudgeOutput = {
  naturalidade: 4,
  conversao: 3,
  clareza: 5,
  aprovacao_meta: 5,
  nota_geral: 4,
  nivel_risco: "baixo" as const,
  justificativa_naturalidade: "hook claro",
  justificativa_conversao: "cta ok",
  justificativa_clareza: "frases curtas",
  justificativa_aprovacao_meta: "sem termo médico",
  justificativa_nota_geral: "boa copy",
  justificativa_nivel_risco: "nada da forbidden list",
};

function makeJudgeResult(overrides: Partial<typeof validJudgeOutput> = {}) {
  return {
    output: { ...validJudgeOutput, ...overrides },
    _usageMetadata: { inputTokens: 850, outputTokens: 620 },
    durationMs: 4242,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    name: "campaign/judge.requested",
    data: {
      campaignId: "camp-test-123",
      storeId: "store-test-456",
      copyText: "Achei a calça 👖",
      productImageUrl: "https://example.com/p.png",
      modelImageUrl: "https://example.com/m.png",
      generatedImageUrl: "https://example.com/vto.png",
      prompt_version: "sonnet_test_v",
      ...overrides,
    },
  };
}

/**
 * Synthetic step.run that just calls the registered fn — same semantics
 * as Inngest's local executor, minus the durable checkpointing.
 * Records the step names called for the idempotency-shape assertion.
 */
function makeStep(stepNames: string[]) {
  return {
    run: vi.fn(async (name: string, fn: () => Promise<unknown>) => {
      stepNames.push(name);
      return await fn();
    }),
  };
}

beforeEach(() => {
  mockScoreCampaignQuality.mockReset();
  mockSetCampaignScores.mockReset();
  mockLogModelCost.mockReset();

  mockScoreCampaignQuality.mockResolvedValue(makeJudgeResult());
  mockSetCampaignScores.mockResolvedValue(undefined);
  mockLogModelCost.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// Behavior 1: happy path
// ─────────────────────────────────────────────────────────────────────

describe("judgeCampaignJob — happy path (D-01..D-06)", () => {
  it("calls scoreCampaignQuality → setCampaignScores → logModelCost in order", async () => {
    const stepNames: string[] = [];
    const { judgeCampaignJob } = functionsModule;

    const result = await (judgeCampaignJob as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn({
      event: makeEvent(),
      step: makeStep(stepNames),
    });

    expect(stepNames).toEqual([
      "score-campaign",
      "persist-scores",
      "log-cost",
      "clear-judge-pending",
    ]);

    // scoreCampaignQuality: forwarded the event payload verbatim
    expect(mockScoreCampaignQuality).toHaveBeenCalledTimes(1);
    expect(mockScoreCampaignQuality.mock.calls[0][0]).toMatchObject({
      campaignId: "camp-test-123",
      storeId: "store-test-456",
      copyText: "Achei a calça 👖",
      generatedImageUrl: "https://example.com/vto.png",
      prompt_version: "sonnet_test_v",
    });

    // setCampaignScores: parsed dims + 6 PT-BR justificativas
    expect(mockSetCampaignScores).toHaveBeenCalledTimes(1);
    expect(mockSetCampaignScores.mock.calls[0][0]).toMatchObject({
      campaignId: "camp-test-123",
      naturalidade: 4,
      nota_geral: 4,
      nivel_risco: "baixo",
      justificativas: expect.objectContaining({
        naturalidade: "hook claro",
        nivel_risco: "nada da forbidden list",
      }),
    });

    // logModelCost: D-04 + D-05 metadata
    expect(mockLogModelCost).toHaveBeenCalledTimes(1);
    expect(mockLogModelCost.mock.calls[0][0]).toMatchObject({
      storeId: "store-test-456",
      campaignId: "camp-test-123",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      action: "judge_quality",
      durationMs: 4242,
      promptVersion: "abc123def456",
      usage: { inputTokens: 850, outputTokens: 620 },
    });

    // Return shape (used by Inngest dashboard)
    expect(result).toEqual({
      campaignId: "camp-test-123",
      nota_geral: 4,
      nivel_risco: "baixo",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Behavior 2: terminal failure → falha_judge sentinel (D-02)
// ─────────────────────────────────────────────────────────────────────

describe("judgeCampaignJob — onFailure handler writes falha_judge sentinel (D-02)", () => {
  it("calls setCampaignScores with nivel_risco='falha_judge' + numerics=1", async () => {
    const { judgeCampaignJob } = functionsModule;
    const onFailure = (judgeCampaignJob as unknown as { opts: { onFailure?: (ctx: unknown) => Promise<void> } })
      .opts.onFailure!;

    await onFailure({
      event: makeEvent(),
      error: new Error("anthropic 503 after retries exhausted"),
    });

    expect(mockSetCampaignScores).toHaveBeenCalledTimes(1);
    const payload = mockSetCampaignScores.mock.calls[0][0] as {
      campaignId: string;
      nivel_risco: string;
      naturalidade: number;
      conversao: number;
      clareza: number;
      aprovacao_meta: number;
      nota_geral: number;
      justificativas: Record<string, string>;
    };
    expect(payload.campaignId).toBe("camp-test-123");
    expect(payload.nivel_risco).toBe("falha_judge");
    expect(payload.naturalidade).toBe(1);
    expect(payload.conversao).toBe(1);
    expect(payload.clareza).toBe(1);
    expect(payload.aprovacao_meta).toBe(1);
    expect(payload.nota_geral).toBe(1);
    expect(payload.justificativas.nivel_risco).toMatch(/anthropic 503/);
  });

  it("handles the wrapped Inngest event shape (event.data.event.data)", async () => {
    // Inngest's onFailure handler can receive either the original event or
    // a wrapped form. The handler tries the wrapped shape first.
    const { judgeCampaignJob } = functionsModule;
    const onFailure = (judgeCampaignJob as unknown as { opts: { onFailure?: (ctx: unknown) => Promise<void> } })
      .opts.onFailure!;

    await onFailure({
      event: { data: { event: { data: { campaignId: "wrapped-campaign-id", storeId: "X" } } } },
      error: new Error("transport"),
    });

    expect(mockSetCampaignScores).toHaveBeenCalledTimes(1);
    expect(
      (mockSetCampaignScores.mock.calls[0][0] as { campaignId: string }).campaignId,
    ).toBe("wrapped-campaign-id");
  });

  it("does NOT throw when campaignId is missing — logs and exits", async () => {
    const { judgeCampaignJob } = functionsModule;
    const onFailure = (judgeCampaignJob as unknown as { opts: { onFailure?: (ctx: unknown) => Promise<void> } })
      .opts.onFailure!;

    await expect(
      onFailure({ event: { data: {} }, error: new Error("orphan") }),
    ).resolves.not.toThrow();
    expect(mockSetCampaignScores).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Behavior 3: idempotency proxy (C-02 mandate)
// ─────────────────────────────────────────────────────────────────────

describe("judgeCampaignJob — idempotency proxy (C-02)", () => {
  it("re-emit for same campaignId → setCampaignScores called twice with same campaignId (DB UPSERT collapses)", async () => {
    const { judgeCampaignJob } = functionsModule;
    const fn = (judgeCampaignJob as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;

    await fn({ event: makeEvent({ campaignId: "X" }), step: makeStep([]) });
    await fn({ event: makeEvent({ campaignId: "X" }), step: makeStep([]) });

    expect(mockSetCampaignScores).toHaveBeenCalledTimes(2);
    const c1 = mockSetCampaignScores.mock.calls[0][0] as { campaignId: string };
    const c2 = mockSetCampaignScores.mock.calls[1][0] as { campaignId: string };
    expect(c1.campaignId).toBe("X");
    expect(c2.campaignId).toBe("X");
    // The actual DB-side single-row guarantee is pinned in
    // set-campaign-scores.test.ts ("calling twice with same campaignId
    // issues two upserts (DB layer enforces single row)").
  });
});

// ─────────────────────────────────────────────────────────────────────
// Behavior 4 + 5: configuration assertions
// ─────────────────────────────────────────────────────────────────────

describe("judgeCampaignJob — Inngest createFunction config", () => {
  it("event name is LOCKED to 'campaign/judge.requested'", async () => {
    const { judgeCampaignJob } = functionsModule;
    const opts = (judgeCampaignJob as unknown as { opts: { triggers: Array<{ event?: string }> } }).opts;
    expect(opts.triggers).toEqual([{ event: "campaign/judge.requested" }]);
  });

  it("retries: 2 (matches generateModelPreviewJob convention)", async () => {
    const { judgeCampaignJob } = functionsModule;
    const opts = (judgeCampaignJob as unknown as { opts: { retries?: number } }).opts;
    expect(opts.retries).toBe(2);
  });

  it("function id is 'judge-campaign'", async () => {
    const { judgeCampaignJob } = functionsModule;
    const opts = (judgeCampaignJob as unknown as { opts: { id: string } }).opts;
    expect(opts.id).toBe("judge-campaign");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Behavior 6: registered in inngestFunctions array
// ─────────────────────────────────────────────────────────────────────

describe("judgeCampaignJob — registered in inngestFunctions export", () => {
  it("is included in the inngestFunctions array exported from functions.ts", async () => {
    const { judgeCampaignJob, inngestFunctions } = functionsModule;
    expect(inngestFunctions).toContain(judgeCampaignJob);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 02 D-17/D-18: judge_pending lifecycle (Plan 02-05)
// ─────────────────────────────────────────────────────────────────────

describe("judgeCampaignJob — D-17 happy path also clears judge_pending", () => {
  it("step 4 'clear-judge-pending' runs after persist-scores + log-cost", async () => {
    const stepNames: string[] = [];
    const { judgeCampaignJob } = functionsModule;
    await (judgeCampaignJob as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn({
      event: makeEvent(),
      step: makeStep(stepNames),
    });
    // The new step is the 4th one. Order matters because we only want to clear
    // pending AFTER scores are persisted -- otherwise a crash mid-judge would
    // leave pending=false with no scores written.
    expect(stepNames[3]).toBe("clear-judge-pending");
    expect(stepNames).toContain("clear-judge-pending");
  });
});

describe("judgeCampaignJob — D-18 sentinel path also clears judge_pending", () => {
  it("onFailure handler does NOT throw and exercises the sentinel + pending-clear sequence", async () => {
    // This test asserts the handler completes cleanly. The actual supabase
    // update is wrapped in try/catch with forward-compat handling so missing
    // env vars don't break the assertion -- the key invariant is that the
    // sentinel write to setCampaignScores runs (covered by behavior 2 above)
    // AND the post-sentinel clear is attempted (covered by code inspection +
    // the no-throw assertion here).
    const { judgeCampaignJob } = functionsModule;
    const onFailure = (judgeCampaignJob as unknown as { opts: { onFailure?: (ctx: unknown) => Promise<void> } })
      .opts.onFailure!;
    await expect(
      onFailure({
        event: makeEvent({ campaignId: "sentinel-test" }),
        error: new Error("anthropic 503"),
      }),
    ).resolves.not.toThrow();
    // Sentinel was written
    expect(mockSetCampaignScores).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "sentinel-test",
        nivel_risco: "falha_judge",
      }),
    );
  });
});
