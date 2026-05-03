---
phase: 02-quality-loop
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - campanha-ia/package.json
  - campanha-ia/package-lock.json
  - campanha-ia/src/lib/ai/pipeline.ts
  - campanha-ia/evals/golden-set/.gitkeep
  - campanha-ia/evals/fixtures/.gitkeep
  - campanha-ia/evals/results/.gitkeep
  - campanha-ia/evals/.gitignore
  - campanha-ia/evals/golden-set/SCHEMA.md
  - campanha-ia/evals/golden-set/example.json
  - campanha-ia/evals/run.ts
  - campanha-ia/evals/promptfoo.config.yaml
  - campanha-ia/evals/run.test.ts
  - .github/workflows/eval-on-pr.yml
autonomous: true
requirements: [D-15, D-16, D-17, D-18, D-19, D-20, D-24]

must_haves:
  truths:
    - "evals/golden-set/SCHEMA.md documents the JSON entry shape (form input + product image hash + analyzer JSON + VTO image hash + Sonnet copy + prompt_version + regenerate_reason + per-rubric labels {})"
    - "evals/run.ts runs runCampaignPipeline against every golden-set entry with dryRun=true (NO Supabase upload, NO Inngest emit, NO cost log row)"
    - "runCampaignPipeline accepts dryRun?: boolean param; when true, the 3 side effects are no-op"
    - "Promptfoo config exists with placeholder rubrics that pass-by-default (D-19 + D-24 — Phase 02 is observability-only)"
    - "GitHub Action eval-on-pr.yml triggers on PRs touching campanha-ia/src/lib/ai/** and campanha-ia/evals/**, runs promptfoo, posts results comment, DOES NOT FAIL the PR"
    - "Idempotent: re-running run.ts with the same entries produces no new rows in api_cost_logs (verified by row-count delta == 0)"
  artifacts:
    - path: "campanha-ia/src/lib/ai/pipeline.ts"
      provides: "PipelineInput.dryRun?: boolean; gates Supabase upload, Inngest emit (added by 02-03), cost-log writes"
      contains: "dryRun"
    - path: "campanha-ia/evals/run.ts"
      provides: "Entry-point script reading evals/golden-set/*.json, calling runCampaignPipeline({...entry, dryRun: true})"
    - path: "campanha-ia/evals/promptfoo.config.yaml"
      provides: "Pipeline-agnostic eval config; rubric.pass: 'true' for placeholders"
    - path: ".github/workflows/eval-on-pr.yml"
      provides: "CI runs promptfoo on lib/ai changes; comment-only, never blocking"
    - path: "campanha-ia/evals/golden-set/SCHEMA.md"
      provides: "JSON schema-by-example doc for golden-set entries"
  key_links:
    - from: "campanha-ia/evals/run.ts"
      to: "campanha-ia/src/lib/ai/pipeline.ts → runCampaignPipeline"
      via: "import + call with dryRun: true"
      pattern: "runCampaignPipeline\\(.*dryRun:\\s*true"
    - from: ".github/workflows/eval-on-pr.yml"
      to: "campanha-ia/evals/promptfoo.config.yaml"
      via: "npx promptfoo eval --config evals/promptfoo.config.yaml"
      pattern: "promptfoo\\s+eval\\s+--config"
    - from: "campanha-ia/src/lib/ai/pipeline.ts"
      to: "Supabase upload + Inngest emit + logModelCost"
      via: "if (!input.dryRun) { ... } guards"
      pattern: "input\\.dryRun"
---

<objective>
Land the Phase 02 eval infrastructure WITHOUT activating PR-blocking. Phase 02 ships observability-only per D-24; Phase 2.5 (label-curation) flips the kill switch later. This plan creates the `campanha-ia/evals/` scaffold (golden-set schema doc, dry-run runner, Promptfoo config, GitHub Action) and adds the `dryRun?` parameter to `runCampaignPipeline` so the runner can exercise the production pipeline against golden-set entries without polluting Supabase, Inngest, or cost logs.

Purpose: Make a label-curator's onboarding (Phase 2.5) a one-line `npx promptfoo eval` away — no infra blocker between "we have labels" and "we have a working CI gate".
Output: New `evals/` directory with 4 source files + GitHub Action + dryRun-instrumented `pipeline.ts`. Zero labels delivered (Phase 2.5).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-quality-loop/02-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md

<interfaces>
<!-- The pipeline interface this plan extends. -->

From campanha-ia/src/lib/ai/pipeline.ts:38-91 (read in full):
```typescript
export interface PipelineInput {
  imageBase64: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  extraImages?: { base64: string; mediaType?: ... }[];
  modelImageBase64: string;
  modelMediaType?: string;
  modelInfo?: ModelInfo;
  price?: string;
  storeName?: string;
  bodyType?: "normal" | "plus";
  backgroundType?: string;
  objective?: string;
  targetAudience?: string;
  toneOverride?: string;
  storeSegment?: string;
  productType?: string;
  material?: string;
  targetLocale?: "pt-BR" | "en";
  storeId?: string;
  campaignId?: string;
  signal?: AbortSignal;
  /** @deprecated */ photoCount?: number;
}

export interface PipelineResult {
  analise: GeminiAnalise;
  vto_hints: { scene_prompts: string[]; aspect_ratio: string; category: string };
  dicas_postagem: SonnetDicasPostagem;
  images: (GeneratedImage | null)[];
  successCount: number;
  durationMs: number;
}

export async function runCampaignPipeline(input: PipelineInput, onProgress?: OnProgress): Promise<PipelineResult>;
```

The 3 side-effect sites that MUST be guarded behind `!input.dryRun`:
1. The pose-history fire-and-forget block (`if (input.storeId && imageResult.successCount > 0)` — currently lines ~287-302). The Supabase write here MUST be skipped under dryRun.
2. The cost-log calls — `logModelCost(...)` calls inside the analyzer/copywriter/VTO `.then(...)` chains. Read pipeline.ts lines 100-260 for exact locations; each `logModelCost(...).catch(...)` invocation gets a `if (!input.dryRun) { ... }` wrap.
3. The Inngest event emit added by Plan 02-03 (judge wiring) — that plan's executor will use the same `if (!input.dryRun)` pattern. Plan 02-02 reserves the convention; Plan 02-03 honors it.
</interfaces>

@campanha-ia/src/lib/ai/pipeline.ts
@campanha-ia/package.json
@.github/workflows/ci.yml
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create evals/ directory + golden-set schema doc + Promptfoo config</name>
  <files>campanha-ia/evals/golden-set/.gitkeep, campanha-ia/evals/fixtures/.gitkeep, campanha-ia/evals/results/.gitkeep, campanha-ia/evals/.gitignore, campanha-ia/evals/golden-set/SCHEMA.md, campanha-ia/evals/golden-set/example.json, campanha-ia/evals/promptfoo.config.yaml, campanha-ia/package.json, campanha-ia/package-lock.json</files>
  <read_first>
    - .planning/phases/02-quality-loop/02-CONTEXT.md decisions D-15, D-16, D-19, D-20, D-24
    - .planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md §5.3 (golden-set schema-per-entry shape)
    - .planning/codebase/DOMAIN-RUBRIC.md "Forbidden List" + "5 Mental-Trigger Taxonomy" (rubrics referenced in Promptfoo placeholders)
    - campanha-ia/package.json (current devDependencies block)
  </read_first>
  <action>
    1. **Create directory structure** (per D-15):
       - `campanha-ia/evals/golden-set/.gitkeep` (empty)
       - `campanha-ia/evals/fixtures/.gitkeep` (empty)
       - `campanha-ia/evals/results/.gitkeep` (empty)

    2. **Create `campanha-ia/evals/.gitignore`**:
       ```
       # Per D-15: gitignore large fixtures (>100KB) + per-PR result outputs.
       # The directory itself is tracked via .gitkeep; only generated artifacts
       # are excluded.
       fixtures/*.jpg
       fixtures/*.jpeg
       fixtures/*.png
       fixtures/*.webp
       results/*.json
       results/*.html
       !.gitkeep
       ```

    3. **Create `campanha-ia/evals/golden-set/SCHEMA.md`** — schema-by-example doc per AI-SPEC §5.3 + D-16. Required JSON keys: `id` (string slug), `created_at` (ISO), `form_input` (anonymized — `{price?, storeName?, targetAudience?, toneOverride?, locale}`), `product_image_hash` (SHA-256 of fixture file in `fixtures/`), `analyzer_output` (full GeminiAnalise object — null if not yet captured), `vto_image_hash` (SHA-256 of generated image), `sonnet_copy` (full SonnetDicasPostagem object), `prompt_version` (12-char SHA from `lib/ai/prompt-version.ts`), `regenerate_reason` (one of VALID_REGENERATE_REASONS or null), `labels` (object — keys: garment_attribute, color_wash, mental_trigger, anti_cliche, compliance_safe — values: empty `{}` placeholders until Phase 2.5; final shape per dimension TBD by labeler). Document each field. Note explicitly: "labels MUST be `{}` until Phase 2.5 — Promptfoo treats empty labels as warning, not failure (D-24)".

    4. **Create `campanha-ia/evals/golden-set/example.json`** — one minimal canonical example with all fields populated except `labels: {}`. Use stub data (real fixture filenames will land in Phase 2.5). Mark with `"id": "_example_do_not_run"` — `run.ts` skips entries whose id starts with `_`.

    5. **Install promptfoo** (per D-20):
       ```bash
       cd campanha-ia && npm install -D promptfoo
       ```
       This is the campanha-ia repo (not crialook-app), so plain `npm install` is fine — the `npm run lock:fix` rule from memory only applies to `crialook-app`. Verify the lockfile updates cleanly with no peer warnings.

    6. **Create `campanha-ia/evals/promptfoo.config.yaml`** — pass-by-default placeholders per D-19 + D-24:
       ```yaml
       # Phase 02 — Promptfoo config (observability-only).
       # Per CONTEXT.md D-24: rubric pass-rates are recorded but DO NOT fail PRs.
       # Phase 2.5 will replace these placeholder asserts with the real rubrics
       # from DOMAIN-RUBRIC.md (Forbidden List, 5-trigger taxonomy, etc.) AND
       # change `threshold: 0` below to a real failing threshold (e.g. 0.95 on
       # Critical-stakes dimensions).

       description: "CriaLook AI pipeline evals (Phase 02 — observability)"

       # We do NOT use Promptfoo's built-in providers — the pipeline is custom
       # bare-SDK orchestration. Instead, run.ts produces a JSONL file at
       # results/last-run.jsonl which Promptfoo consumes as a static dataset.
       providers:
         - id: file://./fixtures/last-run.jsonl
           label: pipeline_v7

       prompts:
         - "{{caption_sugerida}}"

       # Pass-by-default: empty test set means promptfoo emits a warning
       # ("no tests defined") but exits 0. Phase 2.5 replaces this block with
       # per-dimension assertions sourced from DOMAIN-RUBRIC.md.
       tests: []

       # Threshold = 0 means "any pass rate is acceptable". Phase 2.5 raises it.
       sharing: false
       outputPath: results/promptfoo-output.json
       ```

       Note in a comment at the top of the file: "If promptfoo CLI requires at least one test entry to exit 0, add a single trivial test like `- assert: [{ type: 'is-valid-json', value: '{}' }]` to keep the CLI happy. Verify behavior by running `cd campanha-ia && npx promptfoo eval --config evals/promptfoo.config.yaml` locally; if it exits non-zero on the empty-test case, add the trivial assert."

    Do NOT add labels. Do NOT activate PR blocking. Do NOT add the prompt-content rubrics from DOMAIN-RUBRIC.md as live asserts — those land in Phase 2.5 once human ground truth exists.
  </action>
  <acceptance_criteria>
    - `ls campanha-ia/evals/golden-set/.gitkeep campanha-ia/evals/fixtures/.gitkeep campanha-ia/evals/results/.gitkeep campanha-ia/evals/.gitignore campanha-ia/evals/golden-set/SCHEMA.md campanha-ia/evals/golden-set/example.json campanha-ia/evals/promptfoo.config.yaml` returns all 7 files.
    - `grep -c '"promptfoo"' campanha-ia/package.json` returns 1 (devDependency present).
    - `cd campanha-ia && npx promptfoo --version` succeeds (binary resolves).
    - `grep -E "Phase 02|observability-only|D-24" campanha-ia/evals/promptfoo.config.yaml | wc -l` ≥ 2 (intent documented inline).
    - `jq -r '.id' campanha-ia/evals/golden-set/example.json` returns `_example_do_not_run` (skip-prefix marker present).
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx promptfoo --version && jq -e '.id == "_example_do_not_run" and .labels == {}' evals/golden-set/example.json > /dev/null</automated>
  </verify>
  <done>Directory structure exists; promptfoo installed as devDep; pass-by-default config in place; example entry validates schema.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add dryRun param to PipelineInput; wrap 3 side-effect sites</name>
  <files>campanha-ia/src/lib/ai/pipeline.ts, campanha-ia/src/lib/ai/pipeline.test.ts</files>
  <read_first>
    - campanha-ia/src/lib/ai/pipeline.ts (THE file being modified — read lines 38-91 for PipelineInput; lines 100-320 for runCampaignPipeline body to identify EVERY logModelCost call site and the pose-history block at 287-302)
    - campanha-ia/src/lib/ai/log-model-cost.ts (the helper being wrapped)
    - .planning/phases/02-quality-loop/02-CONTEXT.md decision D-18 (the contract: dryRun guards Supabase upload + Inngest emit + cost-log)
    - campanha-ia/src/lib/ai/sonnet-copywriter.test.ts (vitest mocking pattern to mirror)
  </read_first>
  <behavior>
    - Test 1: `runCampaignPipeline({...validInput, dryRun: true})` — pose-history Supabase update is NOT called (verified via spy on createAdminClient or supabase.from). Returns a valid PipelineResult.
    - Test 2: `runCampaignPipeline({...validInput, dryRun: true})` — every `logModelCost` call is NOT made (spy on `logModelCost` import returns 0 calls).
    - Test 3: `runCampaignPipeline({...validInput, dryRun: false})` (default) — pose-history update IS called, logModelCost IS called (preserves Phase 01 behavior).
    - Test 4: `runCampaignPipeline({...validInput})` (no dryRun specified) — same as Test 3. Default is `false`. Backwards-compat assertion.
    - Test 5: When `dryRun: true`, the function STILL returns a populated `dicas_postagem` and `images` array — the eval needs the pipeline output, just not the side effects.
  </behavior>
  <action>
    1. **Extend PipelineInput** in `campanha-ia/src/lib/ai/pipeline.ts` (around line 80, after the `photoCount` deprecated field):
       ```typescript
       /**
        * D-18 (Phase 02 quality-loop): when true, runCampaignPipeline
        * (a) skips the pose-history Supabase update,
        * (b) skips every logModelCost call (no api_cost_logs row),
        * (c) skips the Inngest judge.requested emit (added by Plan 02-03).
        * Used by evals/run.ts to exercise the pipeline against golden-set
        * entries without polluting production data. Default false.
        */
       dryRun?: boolean;
       ```

    2. **Wrap the pose-history block** (currently lines 287-302). Find:
       ```typescript
       if (input.storeId && imageResult.successCount > 0) {
         void (async () => { ... })();
       }
       ```
       Change the predicate to:
       ```typescript
       if (!input.dryRun && input.storeId && imageResult.successCount > 0) {
         void (async () => { ... })();
       }
       ```

    3. **Wrap every logModelCost call**. Run `grep -n "logModelCost" campanha-ia/src/lib/ai/pipeline.ts` to enumerate sites — there are call sites in the analyzer fire-and-forget chain, the Sonnet copywriter chain, and the VTO chain (read 01-04-SUMMARY.md if needed for Phase 01 context). For EACH `logModelCost({...}).catch(...)` invocation, wrap with:
       ```typescript
       if (!input.dryRun) {
         logModelCost({...}).catch((e) => console.warn("[Pipeline] logModelCost failed:", e.message));
       }
       ```
       Do NOT change the call shape itself — just gate it. Preserve every fire-and-forget `.catch()` exactly.

    4. **Reserve the Inngest emit gate** for Plan 02-03. Add a comment placeholder near the bottom of `runCampaignPipeline` (after the pose-history block, before the `const durationMs = Date.now() - startTime;` at line 307):
       ```typescript
       // ── D-01 (Plan 02-03): Inngest judge.requested emit lands here ──────
       // Plan 02-03's executor adds:
       //   if (!input.dryRun && imageResult.successCount > 0) {
       //     await inngest.send({ name: "campaign/judge.requested", data: { ... } });
       //   }
       // The dryRun guard is already in scope; the emit itself is owned by 02-03.
       ```

    5. **Create `campanha-ia/src/lib/ai/pipeline.test.ts`** — mirror the mocking style of `campanha-ia/src/lib/ai/sonnet-copywriter.test.ts` (vi.mock for clients, log-model-cost, supabase admin). Cover the 5 behavior tests above. Mock all SDK calls so the test runs in <2s and never touches real APIs.

       Key spy: `vi.mock("./log-model-cost", () => ({ logModelCost: vi.fn().mockResolvedValue(undefined) }))` and assert `expect(logModelCost).not.toHaveBeenCalled()` under dryRun.
  </action>
  <acceptance_criteria>
    - `grep -nE "dryRun\?:\s*boolean" campanha-ia/src/lib/ai/pipeline.ts | grep -v '^#' | wc -l` ≥ 1 (param declared on PipelineInput).
    - `grep -cnE "input\.dryRun|!input\.dryRun" campanha-ia/src/lib/ai/pipeline.ts | grep -v '^#' | wc -l` ≥ 4 (every side-effect site guarded — count varies depending on logModelCost call sites; verify by inspection).
    - `grep -nE "Plan 02-03.*Inngest|judge\.requested.*emit lands here" campanha-ia/src/lib/ai/pipeline.ts | wc -l` ≥ 1 (placeholder comment present for 02-03).
    - `cd campanha-ia && npx vitest run src/lib/ai/pipeline.test.ts` passes all 5 tests.
    - `cd campanha-ia && npx tsc --noEmit` clean.
    - Existing tests still pass: `cd campanha-ia && npx vitest run src/lib/ai/sonnet-copywriter.test.ts src/lib/ai/log-model-cost.test.ts`.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/lib/ai/pipeline.test.ts src/lib/ai/sonnet-copywriter.test.ts src/lib/ai/log-model-cost.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>PipelineInput.dryRun gates pose-history + every logModelCost call; default behavior preserved; 5 new tests + Phase 01 tests still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create evals/run.ts (dry-run pipeline driver) + GitHub Action</name>
  <files>campanha-ia/evals/run.ts, campanha-ia/evals/run.test.ts, .github/workflows/eval-on-pr.yml</files>
  <read_first>
    - campanha-ia/src/lib/ai/pipeline.ts (just modified by Task 2 — read the new PipelineInput.dryRun)
    - campanha-ia/evals/golden-set/SCHEMA.md + example.json (just created in Task 1)
    - campanha-ia/evals/promptfoo.config.yaml (just created in Task 1 — feeds run.ts output as dataset)
    - .github/workflows/ci.yml (existing CI to mirror env + node version + cache patterns)
    - .planning/phases/02-quality-loop/02-CONTEXT.md decisions D-17, D-18, D-19, D-24, C-02 (eval test mandate)
  </read_first>
  <behavior>
    - Test 1 (dry-run safety — C-02 mandate): run.ts processing a single golden-set entry calls `runCampaignPipeline` with `dryRun: true`. Spy asserts `expect(runCampaignPipeline).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }))`.
    - Test 2 (no DB writes — C-02 mandate): mock the supabase admin client; assert `supabase.from('api_cost_logs').insert` is NEVER called during a run.ts execution.
    - Test 3 (skip-prefix): entries with `id` starting with `_` are skipped (the `_example_do_not_run` example shipped in Task 1 must NOT execute).
    - Test 4 (output shape): run.ts writes a JSONL file to `evals/results/last-run.jsonl` with one line per entry containing `{id, prompt_version, caption_sugerida, sonnet_copy, vto_success}`. Promptfoo consumes this as a dataset.
    - Test 5 (empty golden-set): when only `_example_do_not_run` exists, run.ts exits 0 with stdout "no entries to evaluate (Phase 02 — Phase 2.5 will populate golden-set)" — pass-by-default per D-24.
  </behavior>
  <action>
    1. **Create `campanha-ia/evals/run.ts`**:
       ```typescript
       /**
        * Phase 02 (D-17 + D-18) — Golden-set dry-run driver.
        *
        * Reads every JSON file in evals/golden-set/, runs runCampaignPipeline
        * against each with dryRun: true, writes results to results/last-run.jsonl.
        * Promptfoo consumes the JSONL as a static dataset (see promptfoo.config.yaml).
        *
        * Entries with id starting with "_" are skipped (e.g. _example_do_not_run).
        *
        * Exit codes:
        *   0 = ran (or no entries to run — pass-by-default per D-24)
        *   1 = a runtime exception escaped the loop (treated as CI failure;
        *       NOT a quality regression — quality-regression PR-blocking is
        *       Phase 2.5 per D-24).
        */
       import { promises as fs } from "node:fs";
       import * as path from "node:path";
       import { runCampaignPipeline, type PipelineInput } from "@/lib/ai/pipeline";

       const GOLDEN_SET_DIR = path.join(__dirname, "golden-set");
       const RESULTS_OUT = path.join(__dirname, "results", "last-run.jsonl");

       interface GoldenSetEntry {
         id: string;
         form_input: Partial<PipelineInput>;
         product_image_hash?: string;  // SHA-256 of fixture file (informational only)
         labels?: Record<string, unknown>;
         // ...rest per SCHEMA.md
       }

       async function loadEntries(): Promise<GoldenSetEntry[]> {
         const files = await fs.readdir(GOLDEN_SET_DIR);
         const jsons = files.filter((f) => f.endsWith(".json"));
         const entries: GoldenSetEntry[] = [];
         for (const f of jsons) {
           const raw = await fs.readFile(path.join(GOLDEN_SET_DIR, f), "utf-8");
           const entry = JSON.parse(raw) as GoldenSetEntry;
           if (entry.id.startsWith("_")) continue;
           entries.push(entry);
         }
         return entries;
       }

       async function main(): Promise<void> {
         const entries = await loadEntries();
         if (entries.length === 0) {
           console.log("no entries to evaluate (Phase 02 — Phase 2.5 will populate golden-set)");
           process.exit(0);
         }
         await fs.mkdir(path.dirname(RESULTS_OUT), { recursive: true });
         const out = await fs.open(RESULTS_OUT, "w");
         try {
           for (const entry of entries) {
             // D-18: dryRun gates ALL side effects.
             const input: PipelineInput = {
               ...(entry.form_input as PipelineInput),
               dryRun: true,
             };
             const result = await runCampaignPipeline(input);
             await out.write(
               JSON.stringify({
                 id: entry.id,
                 prompt_version: result.dicas_postagem ? "n/a-needs-prompt-version-export" : null,
                 caption_sugerida: result.dicas_postagem?.caption_sugerida ?? null,
                 sonnet_copy: result.dicas_postagem,
                 vto_success: result.successCount > 0,
               }) + "\n"
             );
           }
         } finally {
           await out.close();
         }
         console.log(`evaluated ${entries.length} entries → ${RESULTS_OUT}`);
       }

       main().catch((e) => {
         console.error("eval run failed:", e);
         process.exit(1);
       });
       ```

       Note: the executor may need to add a script `"eval": "tsx evals/run.ts"` to `campanha-ia/package.json` if `tsx` is already installed; otherwise, leverage `npx tsx evals/run.ts` directly from the GitHub Action (no script entry needed).

    2. **Create `campanha-ia/evals/run.test.ts`** — vitest. Mock `runCampaignPipeline` (return a stub PipelineResult), mock `fs.readdir` to return controlled entries, assert the 5 behavior cases. Use `vi.spyOn(process, 'exit').mockImplementation(...)` to capture exit codes.

    3. **Create `.github/workflows/eval-on-pr.yml`** — paths-filtered, observability-only:
       ```yaml
       name: AI Pipeline Evals (observability-only)

       on:
         pull_request:
           branches: [main]
           paths:
             - 'campanha-ia/src/lib/ai/**'
             - 'campanha-ia/evals/**'

       jobs:
         eval:
           name: Promptfoo eval (Phase 02 — observability-only, never blocks PR)
           runs-on: ubuntu-latest
           defaults:
             run:
               working-directory: campanha-ia
           # NEVER fail the PR. Per D-24, Phase 02 records pass-rates only.
           # Phase 2.5 will remove `continue-on-error` and add the rubric gate.
           continue-on-error: true
           steps:
             - uses: actions/checkout@v4
             - uses: actions/setup-node@v4
               with:
                 node-version: "24"
                 cache: "npm"
                 cache-dependency-path: campanha-ia/package-lock.json
             - run: npm ci
             - name: Run eval driver (dry-run pipeline against golden-set)
               # The driver itself uses dryRun:true — no live API calls hit
               # production secrets. If golden-set is empty, exits 0 with
               # "no entries to evaluate" message (D-24 pass-by-default).
               run: npx tsx evals/run.ts
             - name: Run promptfoo (observability-only, no PR gate)
               run: npx promptfoo eval --config evals/promptfoo.config.yaml --output evals/results/promptfoo-${{ github.event.pull_request.number }}.json
               continue-on-error: true
             - name: Comment results on PR
               if: always()
               uses: actions/github-script@v7
               with:
                 script: |
                   const fs = require('fs');
                   const path = `campanha-ia/evals/results/promptfoo-${context.issue.number}.json`;
                   let body = '## AI Pipeline Eval (Phase 02 — observability-only)\n\n';
                   if (!fs.existsSync(path)) {
                     body += '_No results file produced — likely empty golden-set (Phase 2.5 will populate)._';
                   } else {
                     const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
                     body += '```json\n' + JSON.stringify(data?.results?.stats || data, null, 2).slice(0, 4000) + '\n```';
                   }
                   body += '\n\n_This check NEVER fails the PR (D-24). Phase 2.5 activates the gate._';
                   await github.rest.issues.createComment({
                     issue_number: context.issue.number,
                     owner: context.repo.owner,
                     repo: context.repo.repo,
                     body,
                   });
       ```

       The `continue-on-error: true` at the JOB level + at each step is belt-and-suspenders per D-24 — even if promptfoo exits 1, the PR check stays green.
  </action>
  <acceptance_criteria>
    - `ls campanha-ia/evals/run.ts campanha-ia/evals/run.test.ts .github/workflows/eval-on-pr.yml` returns all 3 files.
    - `grep -c "dryRun: true" campanha-ia/evals/run.ts` ≥ 1 (D-18 contract honored).
    - `grep -cE "if \(entry\.id\.startsWith\(.*_.*\)\) continue|skip" campanha-ia/evals/run.ts | grep -v '^#'` ≥ 1 (skip-prefix handling present).
    - `grep -cE "continue-on-error:\s*true" .github/workflows/eval-on-pr.yml` ≥ 2 (job-level + at least one step-level guard).
    - `grep -E "paths:|campanha-ia/src/lib/ai|campanha-ia/evals" .github/workflows/eval-on-pr.yml | wc -l` ≥ 3 (paths filter present).
    - `cd campanha-ia && npx vitest run evals/run.test.ts` passes all 5 tests.
    - `cd campanha-ia && npx tsx --version` succeeds (or document the script-entry alternative in run.ts comments).
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run evals/run.test.ts && grep -cE "continue-on-error:\s*true" ../.github/workflows/eval-on-pr.yml | head -1</automated>
  </verify>
  <done>run.ts drives dry-run pipeline against golden-set; tests prove zero DB writes + skip-prefix + empty-set handling; CI runs promptfoo on path-changes but never blocks PRs.</done>
</task>

</tasks>

<verification>
End-to-end smoke (local):
1. `cd campanha-ia && npx tsx evals/run.ts` → prints "no entries to evaluate" (only `_example_do_not_run` present) and exits 0.
2. `cd campanha-ia && npx promptfoo eval --config evals/promptfoo.config.yaml` → exits 0 (pass-by-default).
3. Inspect git diff: zero new rows would have been inserted into `api_cost_logs` (verify by adding a temp `console.log` inside `logModelCost` and re-running run.ts on a populated entry — no log line should fire).

CI smoke: open a draft PR touching `campanha-ia/src/lib/ai/pipeline.ts` (e.g. comment-only change). Confirm the `eval-on-pr` workflow runs, comments on the PR, and the check is GREEN even if promptfoo emits warnings.

Automated:
- `cd campanha-ia && npx vitest run evals/run.test.ts src/lib/ai/pipeline.test.ts`
- `cd campanha-ia && npx tsc --noEmit`
- `cd campanha-ia && npx promptfoo --version` (CLI resolves)
</verification>

<success_criteria>
- `evals/` scaffold exists with golden-set/, fixtures/, results/, schema doc, example, promptfoo config, runner, runner test.
- `runCampaignPipeline` accepts `dryRun: true` → zero `api_cost_logs` writes, zero pose-history updates, Inngest emit guarded (placeholder for 02-03).
- `.github/workflows/eval-on-pr.yml` triggers on `lib/ai/**` + `evals/**` PR changes; `continue-on-error: true` at job + step levels (D-24).
- Promptfoo CI runs and posts a results comment on PRs but NEVER fails them.
- All 5 dry-run-safety tests + 5 pipeline.test.ts tests + existing Phase 01 tests pass.
- Phase 2.5 onramp is the addition of (a) labeled JSON entries to `evals/golden-set/`, (b) real assertions in `evals/promptfoo.config.yaml`, (c) removal of `continue-on-error` from the workflow. No infra blocker remains.
</success_criteria>

<output>
After completion, create `.planning/phases/02-quality-loop/02-02-SUMMARY.md` documenting:
- Files created (paths)
- Final lockfile delta (`promptfoo` + transitive deps)
- The exact list of `logModelCost` call sites in pipeline.ts that got the dryRun guard (line numbers, for 02-03's executor to verify the Inngest emit goes in the right spot)
- Whether a script entry was added to package.json for `tsx evals/run.ts` or whether `npx tsx` is the documented invocation
- Note for Phase 2.5 onboarding (3 changes needed to flip the gate, listed above)
</output>
