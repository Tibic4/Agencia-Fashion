/**
 * Tests for setCampaignScores — D-06 (Phase 02 Quality Loop).
 *
 * What this pins:
 *   - Idempotent UPSERT on campaign_id (the C-02 mandate).
 *   - Clamping every numeric dim to [1, 5] (defense in depth past Zod).
 *   - The 6 PT-BR justificativa_* strings land in the `melhorias` JSONB.
 *   - The legacy `urgencia` column gets the neutral midpoint (3).
 *   - The D-02 falha_judge sentinel can flow through (numeric clamps still
 *     satisfy the NOT NULL columns; nivel_risco='falha_judge' lands as-is).
 *
 * Mocking strategy: supabase admin client is a chainable mock — `.from()`
 * returns the upsert-spy carrier so we can read the payload + options
 * passed to .upsert() in the assertions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the supabase admin client ─────────────────────────────────────
// One spy: capture the .upsert() args. Re-bound per test in beforeEach.
let upsertSpy = vi.fn();
const fromSpy = vi.fn(() => ({ upsert: upsertSpy }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromSpy }),
}));

beforeEach(() => {
  upsertSpy = vi.fn().mockResolvedValue({ error: null });
  fromSpy.mockClear();
  fromSpy.mockImplementation(() => ({ upsert: upsertSpy }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Test helper: build a "valid" judge-output-shaped input ──────────────
function makeValidScores(overrides: Partial<Parameters<typeof import("./index")["setCampaignScores"]>[0]> = {}) {
  return {
    campaignId: "camp-test-123",
    naturalidade: 4,
    conversao: 4,
    clareza: 5,
    aprovacao_meta: 5,
    nota_geral: 4,
    nivel_risco: "baixo" as const,
    justificativas: {
      naturalidade: "Tem hook claro nos primeiros 8 palavras",
      conversao: "CTA específico (manda no direct)",
      clareza: "Frases curtas em linhas separadas",
      aprovacao_meta: "Sem termos médicos ou body-transformation",
      nota_geral: "Copy bem estruturada com gatilho identificável",
      nivel_risco: "Nenhum item da Forbidden List acionado",
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Idempotency / upsert shape
// ─────────────────────────────────────────────────────────────────────

describe("setCampaignScores — idempotent UPSERT (D-06, C-02)", () => {
  it("calls .from('campaign_scores').upsert(..., { onConflict: 'campaign_id' })", async () => {
    const { setCampaignScores } = await import("./index");
    await setCampaignScores(makeValidScores());

    expect(fromSpy).toHaveBeenCalledWith("campaign_scores");
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const [_payload, opts] = upsertSpy.mock.calls[0];
    expect(opts).toEqual({ onConflict: "campaign_id" });
  });

  it("calling twice with same campaignId issues two upserts (DB layer enforces single row)", async () => {
    // The function itself doesn't dedupe — the DB-side UNIQUE constraint
    // does. This test pins that the function calls .upsert with the same
    // onConflict key both times so the DB collapses to one row.
    const { setCampaignScores } = await import("./index");
    await setCampaignScores(makeValidScores({ campaignId: "X" }));
    await setCampaignScores(makeValidScores({ campaignId: "X", nota_geral: 5 }));

    expect(upsertSpy).toHaveBeenCalledTimes(2);
    expect(upsertSpy.mock.calls[0][0].campaign_id).toBe("X");
    expect(upsertSpy.mock.calls[1][0].campaign_id).toBe("X");
    expect(upsertSpy.mock.calls[0][1]).toEqual({ onConflict: "campaign_id" });
    expect(upsertSpy.mock.calls[1][1]).toEqual({ onConflict: "campaign_id" });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Clamping numeric dimensions to [1, 5]
// ─────────────────────────────────────────────────────────────────────

describe("setCampaignScores — clamp every numeric dim to [1, 5]", () => {
  it("clamps an out-of-range high value (7 → 5)", async () => {
    const { setCampaignScores } = await import("./index");
    await setCampaignScores(makeValidScores({ naturalidade: 7 }));
    const [payload] = upsertSpy.mock.calls[0];
    expect(payload.naturalidade).toBe(5);
  });

  it("clamps an out-of-range low value (0 → 1)", async () => {
    const { setCampaignScores } = await import("./index");
    await setCampaignScores(makeValidScores({ conversao: 0 }));
    const [payload] = upsertSpy.mock.calls[0];
    expect(payload.conversao).toBe(1);
  });

  it("rounds non-integer values (3.6 → 4)", async () => {
    const { setCampaignScores } = await import("./index");
    await setCampaignScores(makeValidScores({ clareza: 3.6 }));
    const [payload] = upsertSpy.mock.calls[0];
    expect(payload.clareza).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Payload shape — column mapping + JSONB melhorias
// ─────────────────────────────────────────────────────────────────────

describe("setCampaignScores — payload shape", () => {
  it("maps the 6 PT-BR justificativas into the melhorias JSONB column", async () => {
    const { setCampaignScores } = await import("./index");
    const input = makeValidScores();
    await setCampaignScores(input);
    const [payload] = upsertSpy.mock.calls[0];
    expect(payload.melhorias).toEqual(input.justificativas);
  });

  it("sets the legacy urgencia column to the neutral midpoint (3)", async () => {
    const { setCampaignScores } = await import("./index");
    await setCampaignScores(makeValidScores());
    const [payload] = upsertSpy.mock.calls[0];
    expect(payload.urgencia).toBe(3);
  });

  it("forwards nivel_risco verbatim including the falha_judge sentinel (D-02)", async () => {
    const { setCampaignScores } = await import("./index");
    await setCampaignScores(makeValidScores({ nivel_risco: "falha_judge" }));
    const [payload] = upsertSpy.mock.calls[0];
    expect(payload.nivel_risco).toBe("falha_judge");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────────────────────────────

describe("setCampaignScores — error propagation", () => {
  it("throws when supabase returns an error object", async () => {
    upsertSpy.mockResolvedValueOnce({ error: { message: "unique violation foo" } });
    const { setCampaignScores } = await import("./index");

    await expect(setCampaignScores(makeValidScores())).rejects.toThrow(
      /setCampaignScores failed: unique violation foo/,
    );
  });
});
