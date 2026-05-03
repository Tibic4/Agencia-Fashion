/**
 * Tests for evals/run.ts — D-17 driver + C-02 dry-run safety mandate.
 *
 * Critical invariants under test (per CONTEXT.md C-02):
 *   - run.ts NEVER calls runCampaignPipeline without dryRun: true.
 *   - run.ts NEVER hits Supabase admin client (proxy for "no DB writes").
 *   - run.ts NEVER fires logModelCost (proxy for "no api_cost_logs row").
 *   - Entries with id starting "_" are skipped (so the shipped
 *     example.json doesn't accidentally execute).
 *   - Empty golden-set → exit 0 with informational message (D-24).
 *
 * Mocking strategy: stub runCampaignPipeline at the module boundary so
 * the test never reaches the real Anthropic / Gemini SDK. Use vi.spyOn
 * on fs to drive controlled file contents without writing to disk.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";

const mockRunCampaignPipeline = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockCreateAdminClient = vi.fn<() => unknown>();
const mockLogModelCost = vi.fn<(...args: unknown[]) => Promise<void>>();

vi.mock("@/lib/ai/pipeline", () => ({
  runCampaignPipeline: (...args: unknown[]) => mockRunCampaignPipeline(...args),
}));

// Belt-and-suspenders: even if pipeline mock falls through, these mocks
// catch any accidental DB write attempts the test would otherwise miss.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));
vi.mock("@/lib/ai/log-model-cost", () => ({
  logModelCost: (...args: unknown[]) => mockLogModelCost(...args),
}));

function makePipelineResult() {
  return {
    analise: { tipo_peca: "Vestido" },
    vto_hints: { scene_prompts: [], aspect_ratio: "3:4", category: "dresses" },
    dicas_postagem: {
      caption_sugerida: "Olha que peça maravilhosa!",
      legendas: [],
      hashtags: [],
    },
    images: [{ base64: "img" }],
    successCount: 1,
    durationMs: 1234,
  };
}

const validEntry = {
  id: "real-entry-001",
  form_input: {
    imageBase64: "AAA=",
    modelImageBase64: "BBB=",
    targetLocale: "pt-BR" as const,
  },
  labels: {},
};

const skippedEntry = {
  id: "_example_do_not_run",
  form_input: { imageBase64: "AAA=", modelImageBase64: "BBB=" },
  labels: {},
};

beforeEach(() => {
  mockRunCampaignPipeline.mockReset();
  mockCreateAdminClient.mockReset();
  mockLogModelCost.mockReset();
  mockRunCampaignPipeline.mockResolvedValue(makePipelineResult());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// loadEntries — directory IO + skip-prefix handling
// ─────────────────────────────────────────────────────────────────────

describe("loadEntries", () => {
  it("returns [] when the golden-set directory is missing (ENOENT)", async () => {
    const enoent = new Error("ENOENT") as NodeJS.ErrnoException;
    enoent.code = "ENOENT";
    vi.spyOn(fs, "readdir").mockRejectedValueOnce(enoent);

    const { loadEntries } = await import("./run");
    const result = await loadEntries("/nonexistent");
    expect(result).toEqual([]);
  });

  it("skips entries whose id starts with '_' (the reserved skip-prefix)", async () => {
    vi.spyOn(fs, "readdir").mockResolvedValueOnce([
      "real.json",
      "example.json",
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
    vi.spyOn(fs, "readFile")
      .mockResolvedValueOnce(JSON.stringify(validEntry) as never)
      .mockResolvedValueOnce(JSON.stringify(skippedEntry) as never);

    const { loadEntries } = await import("./run");
    const entries = await loadEntries("/golden-set");

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("real-entry-001");
  });

  it("ignores non-.json files", async () => {
    vi.spyOn(fs, "readdir").mockResolvedValueOnce([
      "real.json",
      "README.md",
      "fixture.png",
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
    vi.spyOn(fs, "readFile").mockResolvedValueOnce(
      JSON.stringify(validEntry) as never,
    );

    const { loadEntries } = await import("./run");
    const entries = await loadEntries("/golden-set");
    expect(entries).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
// runEntries — C-02 dry-run safety mandate
// ─────────────────────────────────────────────────────────────────────

describe("runEntries — C-02 dry-run safety mandate", () => {
  it("ALWAYS calls runCampaignPipeline with dryRun: true (D-18 contract)", async () => {
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined as never);
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const closeFn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs, "open").mockResolvedValue({
      write: writeFn,
      close: closeFn,
    } as unknown as Awaited<ReturnType<typeof fs.open>>);

    const { runEntries } = await import("./run");
    await runEntries([validEntry], "/tmp/last-run.jsonl");

    expect(mockRunCampaignPipeline).toHaveBeenCalledTimes(1);
    expect(mockRunCampaignPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
  });

  it("NEVER touches the Supabase admin client (proxy for 'no DB writes')", async () => {
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined as never);
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const closeFn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs, "open").mockResolvedValue({
      write: writeFn,
      close: closeFn,
    } as unknown as Awaited<ReturnType<typeof fs.open>>);

    const { runEntries } = await import("./run");
    await runEntries([validEntry], "/tmp/last-run.jsonl");

    // The pipeline mock short-circuits before any real Supabase access
    // would happen; this assertion locks the contract that run.ts itself
    // never instantiates an admin client outside the pipeline.
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockLogModelCost).not.toHaveBeenCalled();
  });

  it("writes one JSONL line per entry to the configured outPath", async () => {
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined as never);
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const closeFn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(fs, "open").mockResolvedValue({
      write: writeFn,
      close: closeFn,
    } as unknown as Awaited<ReturnType<typeof fs.open>>);

    const { runEntries } = await import("./run");
    const entries = [
      validEntry,
      { ...validEntry, id: "real-entry-002" },
    ];
    const result = await runEntries(entries, "/tmp/last-run.jsonl");

    expect(writeFn).toHaveBeenCalledTimes(2);
    expect(closeFn).toHaveBeenCalledTimes(1);
    expect(result.entriesProcessed).toBe(2);
    expect(result.outputPath).toBe("/tmp/last-run.jsonl");

    const firstLine = writeFn.mock.calls[0][0] as string;
    const parsed = JSON.parse(firstLine.trim());
    expect(parsed.id).toBe("real-entry-001");
    expect(parsed.caption_sugerida).toBe("Olha que peça maravilhosa!");
    expect(parsed.vto_success).toBe(true);
  });

  it("returns entriesProcessed: 0 with an informational log when entries is empty (D-24 pass-by-default)", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const openSpy = vi.spyOn(fs, "open");

    const { runEntries } = await import("./run");
    const result = await runEntries([], "/tmp/last-run.jsonl");

    expect(result.entriesProcessed).toBe(0);
    expect(result.outputPath).toBeNull();
    expect(openSpy).not.toHaveBeenCalled(); // no file written
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Phase 2.5 will populate golden-set"),
    );
  });
});
