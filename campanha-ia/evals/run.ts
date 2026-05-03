/**
 * Phase 02 (D-17 + D-18) — Golden-set dry-run driver.
 *
 * Reads every JSON file in evals/golden-set/, runs runCampaignPipeline
 * against each with dryRun: true (per D-18 — no Supabase upload, no
 * cost-log row, no Inngest emit), and writes per-entry results to
 * evals/results/last-run.jsonl. Promptfoo consumes that JSONL as a
 * static dataset (see promptfoo.config.yaml).
 *
 * Entries with id starting with "_" are skipped (e.g. _example_do_not_run
 * shipped as the canonical schema example — see evals/golden-set/SCHEMA.md).
 *
 * Exit codes:
 *   0 = ran (or no entries to run — pass-by-default per D-24)
 *   1 = a runtime exception escaped the loop (treated as CI failure;
 *       NOT a quality regression — quality-regression PR-blocking is
 *       Phase 2.5 per D-24).
 *
 * Local invocation:
 *   cd campanha-ia && npx tsx evals/run.ts
 *
 * CI invocation: see .github/workflows/eval-on-pr.yml — same command,
 * inside the campanha-ia working directory.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { runCampaignPipeline, type PipelineInput } from "@/lib/ai/pipeline";

const GOLDEN_SET_DIR = path.join(__dirname, "golden-set");
const RESULTS_OUT = path.join(__dirname, "results", "last-run.jsonl");

export interface GoldenSetEntry {
  /** URL-safe slug. Entries whose id starts with "_" are skipped. */
  id: string;
  /** Anonymized PipelineInput subset — see SCHEMA.md. */
  form_input: Partial<PipelineInput>;
  /** Informational only — actual bytes live in form_input.imageBase64. */
  product_image_hash?: string;
  /** Empty {} until Phase 2.5 labelers populate the 5-rubric taxonomy. */
  labels?: Record<string, unknown>;
  /** Phase 01 audit signal — joins to api_cost_logs.metadata.prompt_version. */
  prompt_version?: string;
  /** One of VALID_REGENERATE_REASONS or null — see SCHEMA.md. */
  regenerate_reason?: string | null;
  // Other fields per SCHEMA.md (analyzer_output, sonnet_copy, vto_image_hash)
  // are NOT consumed by run.ts directly — they're for asserts in Phase 2.5.
}

export async function loadEntries(dir: string = GOLDEN_SET_DIR): Promise<GoldenSetEntry[]> {
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (e) {
    // Missing dir → empty entry set (per D-24 pass-by-default contract).
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const jsons = files.filter((f) => f.endsWith(".json"));
  const entries: GoldenSetEntry[] = [];
  for (const f of jsons) {
    const raw = await fs.readFile(path.join(dir, f), "utf-8");
    const entry = JSON.parse(raw) as GoldenSetEntry;
    if (typeof entry.id !== "string") {
      console.warn(`[evals/run] skipping ${f} — missing id`);
      continue;
    }
    if (entry.id.startsWith("_")) continue; // Reserved skip-prefix.
    entries.push(entry);
  }
  return entries;
}

export async function runEntries(
  entries: GoldenSetEntry[],
  outPath: string = RESULTS_OUT,
): Promise<{ entriesProcessed: number; outputPath: string | null }> {
  if (entries.length === 0) {
    console.log(
      "no entries to evaluate (Phase 02 — Phase 2.5 will populate golden-set)",
    );
    return { entriesProcessed: 0, outputPath: null };
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const out = await fs.open(outPath, "w");
  try {
    for (const entry of entries) {
      // D-18 contract: dryRun: true gates Supabase pose-history write,
      // analyzer + Sonnet logModelCost calls, and (once 02-03 lands) the
      // Inngest judge.requested emit. NEVER override to false here.
      const input: PipelineInput = {
        // form_input is Partial<PipelineInput>; the runtime contract is
        // that golden-set entries supply imageBase64 + modelImageBase64.
        // Missing-required-field detection is Phase 2.5 schema-validation.
        ...(entry.form_input as PipelineInput),
        dryRun: true,
      };
      const result = await runCampaignPipeline(input);
      await out.write(
        JSON.stringify({
          id: entry.id,
          // prompt_version on the result is implicit via what the pipeline
          // ran — the curated value lives on the entry. Phase 2.5 may
          // assert these match.
          prompt_version_curated: entry.prompt_version ?? null,
          regenerate_reason: entry.regenerate_reason ?? null,
          caption_sugerida: result.dicas_postagem?.caption_sugerida ?? null,
          sonnet_copy: result.dicas_postagem,
          vto_success: result.successCount > 0,
          duration_ms: result.durationMs,
        }) + "\n",
      );
    }
  } finally {
    await out.close();
  }
  console.log(`evaluated ${entries.length} entries → ${outPath}`);
  return { entriesProcessed: entries.length, outputPath: outPath };
}

export async function main(): Promise<void> {
  const entries = await loadEntries();
  await runEntries(entries);
}

// Only execute when run directly (not when imported by run.test.ts).
// `require.main === module` is the canonical Node check; under tsx +
// CommonJS it resolves cleanly. Tests import the module without ever
// reaching this block.
if (require.main === module) {
  main().catch((e) => {
    console.error("eval run failed:", e);
    process.exit(1);
  });
}
