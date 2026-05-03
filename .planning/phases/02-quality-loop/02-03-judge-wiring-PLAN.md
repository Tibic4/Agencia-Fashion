---
phase: 02-quality-loop
plan: 03
type: execute
wave: 2
depends_on: [02]
files_modified:
  - campanha-ia/src/lib/ai/judge.ts
  - campanha-ia/src/lib/ai/judge.test.ts
  - campanha-ia/src/lib/db/index.ts
  - campanha-ia/src/lib/pricing/fallbacks.ts
  - campanha-ia/src/lib/inngest/functions.ts
  - campanha-ia/src/lib/inngest/judge.test.ts
  - campanha-ia/src/lib/ai/pipeline.ts
autonomous: false
requirements: [D-01, D-02, D-03, D-04, D-05, D-06, D-23, D-25]

must_haves:
  truths:
    - "Every successful campaign generation (successCount > 0) emits an Inngest event campaign/judge.requested"
    - "judgeCampaignJob receives the event, calls the judge, writes 6 dimensions to campaign_scores, retries 2x on transient failure"
    - "On final failure, judgeCampaignJob writes nivel_risco='falha_judge' to campaign_scores so dashboards can distinguish judge-failure from low-quality"
    - "Judge uses getAnthropic() (Phase 01 D-10) + tool_use + Zod boundary (Phase 01 D-16) — same pattern as Sonnet copywriter"
    - "Judge prompt PT-BR references DOMAIN-RUBRIC.md categories (Forbidden List → nivel_risco='alto'; 5-trigger taxonomy → naturalidade); written in PT-BR because lojista may eventually see justificativa text"
    - "Judge call writes one api_cost_logs row via logModelCost with action='judge_quality' + prompt_version=JUDGE_PROMPT_VERSION"
    - "Idempotency: re-emitting campaign/judge.requested for the same campaignId produces only one campaign_scores row (verified via UPSERT or pre-insert lookup)"
    - "When pipeline runs with dryRun=true (from Plan 02-02), the inngest.send is NOT called"
  artifacts:
    - path: "campanha-ia/src/lib/ai/judge.ts"
      provides: "scoreCampaignQuality(input) function + JudgeOutputSchema (Zod) + JudgeInvalidOutputError + score_campaign_quality tool definition + JUDGE_PROMPT_VERSION constant"
      exports: ["scoreCampaignQuality", "JudgeOutputSchema", "JudgeInvalidOutputError", "JUDGE_PROMPT_VERSION"]
    - path: "campanha-ia/src/lib/db/index.ts"
      provides: "setCampaignScores(campaignId, scores) helper — clamps smallint 1-5, UPSERT on campaign_id"
      contains: "setCampaignScores"
    - path: "campanha-ia/src/lib/pricing/fallbacks.ts"
      provides: "FALLBACK_TOKENS['judge_quality'] entry"
      contains: "judge_quality"
    - path: "campanha-ia/src/lib/inngest/functions.ts"
      provides: "judgeCampaignJob exported + added to inngestFunctions array; event 'campaign/judge.requested' registered via createFunction triggers"
      contains: "judgeCampaignJob"
    - path: "campanha-ia/src/lib/ai/pipeline.ts"
      provides: "inngest.send('campaign/judge.requested') gated by !input.dryRun && successCount > 0"
      contains: "campaign/judge.requested"
  key_links:
    - from: "campanha-ia/src/lib/ai/pipeline.ts"
      to: "Inngest event campaign/judge.requested"
      via: "inngest.send after pose-history block, before final return"
      pattern: "campaign/judge\\.requested"
    - from: "campanha-ia/src/lib/inngest/functions.ts → judgeCampaignJob"
      to: "campanha-ia/src/lib/ai/judge.ts → scoreCampaignQuality"
      via: "step.run('score-campaign', () => scoreCampaignQuality(...))"
      pattern: "scoreCampaignQuality"
    - from: "campanha-ia/src/lib/inngest/functions.ts → judgeCampaignJob"
      to: "campanha-ia/src/lib/db/index.ts → setCampaignScores"
      via: "step.run('persist-scores', () => setCampaignScores(...))"
      pattern: "setCampaignScores"
---

<objective>
Wire the LLM-as-judge as an Inngest async job. Phase 01 captured production signals (regenerate_reason, prompt_version, cost-log metadata); this plan adds the **automated quality scoring loop** that turns those signals into 6 numeric dimensions per campaign. Implements D-01 (event-driven Inngest job), D-02 (retries + falha_judge sentinel), D-03 (tool_use + Zod boundary), D-04 (claude-sonnet-4-6), D-05 (JUDGE_PROMPT_VERSION SHA), D-06 (setCampaignScores helper).

The judge writes 6 columns of `campaign_scores`: `naturalidade`, `nivel_risco` (text — `baixo|medio|alto|falha_judge`), `conversao`, `clareza`, `aprovacao_meta`, `nota_geral` (computed by the model with weights, not server-side averaged per `<specifics>`). Plus 6 PT-BR `justificativa_*` text fields stored in `campaign_scores.melhorias` JSONB (existing column).

Purpose: Make every prompt edit's quality impact measurable within minutes, not weeks.
Output: New `lib/ai/judge.ts`, new `judgeCampaignJob` Inngest function, `setCampaignScores` DB helper, `pipeline.ts` event emit, FALLBACK_TOKENS extension.

Manual gate (autonomous: false) per output requirement #5: this is the first production deploy of judge logic. Pause before final commit so user can review the judge prompt + canary the Inngest event flow on a single store.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-quality-loop/02-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@.planning/codebase/DOMAIN-RUBRIC.md
@.planning/phases/02-quality-loop/02-02-SUMMARY.md

<interfaces>
<!-- The patterns this plan mirrors (extracted, no codebase exploration needed) -->

From campanha-ia/src/lib/ai/sonnet-copywriter.ts (the entry-point template — judge mirrors this shape):

Lines 33-56 — Zod schema then z.infer types:
```typescript
const SonnetDicaLegendaSchema = z.object({...});
export const SonnetDicasPostagemSchema = z.object({...});
export type SonnetDicasPostagem = z.infer<typeof SonnetDicasPostagemSchema>;
```

Lines 76-125 — Anthropic.Tool definition (locked tool name; mirror exactly):
```typescript
const generateDicasPostagemTool: Anthropic.Tool = {
  name: "generate_dicas_postagem",
  description: "...",
  input_schema: { type: "object", properties: {...}, required: [...] },
};
```

Lines 134-149 — classified error class (judge gets a parallel one):
```typescript
export class SonnetInvalidOutputError extends Error {
  readonly code = "SONNET_INVALID_OUTPUT" as const;
  readonly retryable = false;
  readonly userMessage = "...";
  constructor(public readonly technicalMessage: string, cause?: unknown) {
    super(technicalMessage, cause !== undefined ? { cause } : undefined);
    this.name = "SonnetInvalidOutputError";
  }
}
```

Lines 167-173 — prompt-version pattern (judge gets JUDGE_PROMPT_VERSION):
```typescript
export const SONNET_PROMPT_VERSION_PT = computePromptVersion(buildSystemPrompt("pt-BR"));
```

Lines 204-305 — function shape (getAnthropic + withTimeout + tool_choice + tool_use parse + Zod safeParse + captureError on failure). Mirror this exactly for `scoreCampaignQuality`.

From campanha-ia/src/lib/inngest/functions.ts:193-249 — generateModelPreviewJob (the Inngest function template):
```typescript
export const generateModelPreviewJob = inngest.createFunction(
  {
    id: "generate-model-preview",
    retries: 2,
    triggers: [{ event: "model/preview.requested" }],
    onFailure: async ({ event }) => { /* terminal failure handler */ },
  },
  async ({ event, step }) => {
    const data = event.data as ModelPreviewEvent;
    const result = await step.run("step-1-name", async () => { ... });
    await step.run("step-2-name", async () => { ... });
    return { ... };
  }
);
```

Last line of functions.ts (line 301): `export const inngestFunctions = [generateModelPreviewJob, generateBackdropJob, storageGarbageCollectorCron, storageGarbageCollectorManual];` — judgeCampaignJob MUST be added to this array.

From campanha-ia/supabase/migrations/00000000000000_baseline.sql lines 60-76 — campaign_scores schema (the WRITE TARGET):
```sql
CREATE TABLE IF NOT EXISTS public.campaign_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  nota_geral integer NOT NULL,        -- 1-5, judge-computed (NOT server-averaged per <specifics>)
  conversao integer NOT NULL,          -- 1-5
  clareza integer NOT NULL,            -- 1-5
  urgencia integer NOT NULL,           -- 1-5 (legacy column from Phase 0; map to a judge dimension or default to 3 — see Task 1 action)
  naturalidade integer NOT NULL,       -- 1-5
  aprovacao_meta integer NOT NULL,     -- 1-5
  nivel_risco text NOT NULL,           -- 'baixo' | 'medio' | 'alto' | 'falha_judge' (sentinel D-02)
  resumo text,
  pontos_fortes jsonb,
  melhorias jsonb,                     -- store the 6 justificativa_* PT-BR strings as keyed object here
  alertas_meta jsonb,
  created_at timestamp with time zone DEFAULT now()
);
```

NOTE: schema has 6 numeric columns + nivel_risco. The CONTEXT `<specifics>` lists 6 dimensions as: `naturalidade`, `nivel_risco`, `conversao`, `clareza`, `aprovacao_meta`, `nota_geral`. The schema also has `urgencia` (legacy from Phase 0). Action: judge does NOT score `urgencia` (not in the AI-SPEC §5.1 dimensions table); set `urgencia: 3` (neutral midpoint) in the insert payload, document the rationale inline. A future schema cleanup can drop the column.

From campanha-ia/src/lib/ai/log-model-cost.ts — the cost-log helper (judge calls this):
```typescript
await logModelCost({
  storeId,
  campaignId,
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  action: "judge_quality",
  usage: { inputTokens, outputTokens },
  durationMs,
  promptVersion: JUDGE_PROMPT_VERSION,
});
```

From campanha-ia/src/lib/pricing/fallbacks.ts — extend FALLBACK_TOKENS with judge_quality entry. FALLBACK_PRICES already has `claude-sonnet-4-6` (line 42), so judge re-uses it; only FALLBACK_TOKENS needs a new key.

From campanha-ia/src/lib/inngest/client.ts:
```typescript
export const inngest = new Inngest({ id: "crialook", eventKey: process.env.INNGEST_EVENT_KEY });
```
The event payload type is registered implicitly — `inngest.send({ name: "campaign/judge.requested", data: {...} })` just works.

From .planning/codebase/DOMAIN-RUBRIC.md:
- "Forbidden List" section (sizes / body-transformation / invented testimonials / unproven superlatives / identity drift / denim wash drift) — these are the categories that map to `nivel_risco='alto'` in the judge prompt.
- "5 Mental-Trigger Taxonomy" — judge's `naturalidade` dimension scores whether exactly one trigger is identifiable (per the rubric's "in <5s" criterion).
- "Anti-Cliché List" — judge's `naturalidade` also penalizes the listed phrases.
- "Compliance Posture (D-12) — read this first" — judge prompt must instruct the model to flag any body-transformation language as `nivel_risco='alto'` even if it isn't in the regex Forbidden List.
</interfaces>

@campanha-ia/src/lib/ai/sonnet-copywriter.ts
@campanha-ia/src/lib/ai/clients.ts
@campanha-ia/src/lib/ai/with-timeout.ts
@campanha-ia/src/lib/ai/prompt-version.ts
@campanha-ia/src/lib/ai/log-model-cost.ts
@campanha-ia/src/lib/pricing/fallbacks.ts
@campanha-ia/src/lib/inngest/client.ts
@campanha-ia/src/lib/inngest/functions.ts
@campanha-ia/src/lib/db/index.ts
@campanha-ia/src/lib/ai/pipeline.ts
@campanha-ia/src/lib/observability.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create lib/ai/judge.ts (tool_use + Zod boundary, mirrors sonnet-copywriter.ts:100-225)</name>
  <files>campanha-ia/src/lib/ai/judge.ts, campanha-ia/src/lib/ai/judge.test.ts, campanha-ia/src/lib/pricing/fallbacks.ts, campanha-ia/src/lib/db/index.ts</files>
  <read_first>
    - campanha-ia/src/lib/ai/sonnet-copywriter.ts lines 100-305 (THE template — tool def, error class, prompt version, the function body that mirrors withTimeout + tool_choice + Zod safeParse + captureError)
    - campanha-ia/src/lib/ai/sonnet-copywriter.test.ts lines 1-80 (mocking pattern: clients, with-timeout, observability)
    - campanha-ia/supabase/migrations/00000000000000_baseline.sql lines 60-76 (write target: campaign_scores columns with their CHECK constraints)
    - .planning/codebase/DOMAIN-RUBRIC.md "Forbidden List" + "5 Mental-Trigger Taxonomy" + "Compliance Posture (D-12)" — judge prompt MUST cite these categories
    - campanha-ia/src/lib/pricing/fallbacks.ts (where FALLBACK_TOKENS lives)
    - campanha-ia/src/lib/db/index.ts:929-988 (savePipelineResultV3 — the helper-style pattern setCampaignScores mirrors)
  </read_first>
  <behavior>
    - Test 1: scoreCampaignQuality({campaignId, copyText, productImageUrl, modelImageUrl, generatedImageUrl, prompt_version}) with a mocked Anthropic returning a valid tool_use block → returns parsed JudgeOutput with all 6 numeric dims (1-5 each) + nivel_risco enum + 6 justificativa fields.
    - Test 2: When the response has NO tool_use block → throws JudgeInvalidOutputError; captureError is invoked once with `{ extra: { stop_reason } }`.
    - Test 3: When tool_use.input fails Zod validation (e.g. naturalidade=10, out of range) → throws JudgeInvalidOutputError; captureError is invoked.
    - Test 4: withTimeout is called with `30_000` ms and label `"Judge Quality"` (mirror sonnet-copywriter T-05-03 pattern).
    - Test 5: tool name is exactly `"score_campaign_quality"` (LOCKED per CONTEXT.md `<specifics>` — assert via `expect(messages.create).toHaveBeenCalledWith(expect.objectContaining({ tool_choice: { type: "tool", name: "score_campaign_quality" } }))`).
    - Test 6: Clamping in setCampaignScores — passing naturalidade=7 → row inserted with naturalidade=5 (clamp upper); passing naturalidade=0 → naturalidade=1 (clamp lower). Mock supabase.from('campaign_scores').upsert and assert the payload.
    - Test 7: Idempotency in setCampaignScores — calling twice with same campaignId → upsert with `onConflict: 'campaign_id'` ensures one row only (assert the upsert call shape).
  </behavior>
  <action>
    1. **Create `campanha-ia/src/lib/ai/judge.ts`** — mirror `sonnet-copywriter.ts:100-305`:

       ```typescript
       /**
        * CriaLook LLM-as-Judge — Phase 02 D-01..D-06.
        *
        * Scores every successful campaign generation across 6 dimensions defined
        * in AI-SPEC §5.1. Triggered async via Inngest event campaign/judge.requested
        * (see lib/inngest/functions.ts → judgeCampaignJob).
        *
        * Pattern mirrors sonnet-copywriter.ts exactly (D-03):
        *   getAnthropic() → withTimeout → tool_use + tool_choice → Zod boundary.
        *
        * Cost: ~R$0.02/campaign (D-04, claude-sonnet-4-6).
        * Prompt version: cached at module load (D-05) so api_cost_logs row carries SHA.
        */
       import type Anthropic from "@anthropic-ai/sdk";
       import { z } from "zod";
       import { getAnthropic } from "./clients";
       import { withTimeout } from "./with-timeout";
       import { computePromptVersion } from "./prompt-version";
       import { captureError } from "@/lib/observability";

       // ── Zod schema (source of truth for shape; tool input_schema mirrors below) ──
       export const JudgeOutputSchema = z.object({
         naturalidade:    z.number().int().min(1).max(5),
         conversao:       z.number().int().min(1).max(5),
         clareza:         z.number().int().min(1).max(5),
         aprovacao_meta:  z.number().int().min(1).max(5),
         nota_geral:      z.number().int().min(1).max(5),
         nivel_risco:     z.enum(["baixo", "medio", "alto"]),  // "falha_judge" only set by Inngest onFailure (D-02), not by the model
         justificativa_naturalidade:    z.string().min(1).max(500),
         justificativa_conversao:       z.string().min(1).max(500),
         justificativa_clareza:         z.string().min(1).max(500),
         justificativa_aprovacao_meta:  z.string().min(1).max(500),
         justificativa_nota_geral:      z.string().min(1).max(500),
         justificativa_nivel_risco:     z.string().min(1).max(500),
       });
       export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

       // ── Tool definition (LOCKED name per CONTEXT.md <specifics>) ──
       const scoreCampaignQualityTool: Anthropic.Tool = {
         name: "score_campaign_quality",  // LOCKED — do not rename
         description:
           "Score the campaign across 6 quality dimensions plus a nivel_risco enum. " +
           "Use 1-5 integer scale (1 worst, 5 best). Output one PT-BR justificativa per dimension.",
         input_schema: {
           type: "object",
           properties: {
             naturalidade:    { type: "integer", minimum: 1, maximum: 5 },
             conversao:       { type: "integer", minimum: 1, maximum: 5 },
             clareza:         { type: "integer", minimum: 1, maximum: 5 },
             aprovacao_meta:  { type: "integer", minimum: 1, maximum: 5 },
             nota_geral:      { type: "integer", minimum: 1, maximum: 5 },
             nivel_risco:     { type: "string", enum: ["baixo", "medio", "alto"] },
             justificativa_naturalidade:    { type: "string" },
             justificativa_conversao:       { type: "string" },
             justificativa_clareza:         { type: "string" },
             justificativa_aprovacao_meta:  { type: "string" },
             justificativa_nota_geral:      { type: "string" },
             justificativa_nivel_risco:     { type: "string" },
           },
           required: [
             "naturalidade","conversao","clareza","aprovacao_meta","nota_geral","nivel_risco",
             "justificativa_naturalidade","justificativa_conversao","justificativa_clareza",
             "justificativa_aprovacao_meta","justificativa_nota_geral","justificativa_nivel_risco",
           ],
         },
       };

       // ── Classified error (parallel to SonnetInvalidOutputError) ──
       export class JudgeInvalidOutputError extends Error {
         readonly code = "JUDGE_INVALID_OUTPUT" as const;
         readonly retryable = false;
         constructor(public readonly technicalMessage: string, cause?: unknown) {
           super(technicalMessage, cause !== undefined ? { cause } : undefined);
           this.name = "JudgeInvalidOutputError";
         }
       }

       // ── PT-BR System prompt — references DOMAIN-RUBRIC.md categories ──
       // Compliance posture per DOMAIN-RUBRIC.md "Compliance Posture (D-12)":
       // PT-BR because lojista may eventually see the justificativa text in /admin/quality.
       const JUDGE_SYSTEM_PROMPT = `Você é avaliador de qualidade de copy para anúncios de moda no Instagram brasileiro.
       Recebe (a) o texto da legenda gerada pelo copywriter, (b) URLs da foto do produto, da modelo e da imagem VTO final.
       Sua tarefa é pontuar 6 dimensões em escala 1-5 (1 pior, 5 melhor) e classificar nivel_risco.

       DIMENSÕES (sempre 1-5 inteiro):
       1. naturalidade — Soa humano e brasileiro? Tem gancho nos primeiros 12 palavras? Evita os clichês listados (Tá perfeito 🔥, Look pronto, Arrasou, Diva, Maravilhosa, Apaixonada, Confira esta peça incrível, "🔥🔥🔥" sem texto)? Usa exatamente 1 dos 5 gatilhos (Escassez/Prova social/Curiosidade/Transformação-do-LOOK/Preço) identificável em <5s?
       2. conversao — CTA específico (não genérico tipo "Comenta EU QUERO")? Pede ação clara (manda no direct, comenta com tamanho, etc)?
       3. clareza — Frases ≤12 palavras? 3-5 linhas total? Cada frase em linha separada (\\n entre frases)?
       4. aprovacao_meta — Probabilidade de passar revisão Meta/Instagram (sem termos médicos/farmacêuticos, sem reivindicações superlativas sem prova, sem testemunhos inventados)?
       5. nota_geral — Sua média ponderada das outras 4 + ajuste pelo nivel_risco. NÃO é média aritmética — você decide os pesos. Se nivel_risco='alto', nota_geral cai pelo menos 2 pontos.

       NIVEL_RISCO (CRÍTICO — fonte: DOMAIN-RUBRIC.md "Forbidden List"):
       - 'alto' se a copy contém QUALQUER UMA destas categorias:
         * Tamanhos inventados ("do P ao GG", "tem do 36 ao 48", "todos os tamanhos", "plus size") quando o lojista não forneceu
         * Reivindicação de transformação corporal ("afina a cintura", "tira celulite", "modela o corpo", "tira a barriga", "rejuvenesce", "deixa mais magra")
         * Testemunho inventado ("clientes adoraram", "todo mundo aprovou", "as meninas amaram", "@usuario disse")
         * Superlativo sem prova ("a melhor blusa do Brasil", "a peça #1 do Instagram", "número 1 em conforto")
         * Identidade do modelo descrita além do que a foto mostra ("morena linda", "loira atlética", "jovem de 20 anos" sem dados estruturados)
         * Wash de jeans descrito incorretamente vs a foto (jeans escuro chamado de "jeans claro" e vice-versa)
       - 'medio' se a copy tem 1 sinal amarelo isolado: clichê genérico ("disponível agora", "não perca", "corre pra garantir", "peça única"), emoji-spam (≥3 emojis sem âncora), CTA genérico sem ação clara
       - 'baixo' (default) se nenhuma das categorias acima

       JUSTIFICATIVAS (PT-BR, máximo 500 caracteres cada): uma frase curta por dimensão explicando a nota. O lojista pode eventualmente ler estas justificativas no painel /admin/quality — escreva pra ela, sem jargão técnico.`;

       export const JUDGE_PROMPT_VERSION = computePromptVersion(JUDGE_SYSTEM_PROMPT);

       // ── Input ──
       export interface JudgeInput {
         campaignId: string;
         storeId: string;
         copyText: string;            // SonnetDicasPostagem.caption_sugerida (or full JSON stringified)
         productImageUrl: string;
         modelImageUrl: string;
         generatedImageUrl: string;
         prompt_version: string;      // The Sonnet prompt_version that produced copyText (for traceability)
       }

       export interface JudgeResult {
         output: JudgeOutput;
         _usageMetadata?: { inputTokens: number; outputTokens: number };
         durationMs: number;
       }

       const MODEL = "claude-sonnet-4-6";

       // ── Main function — mirrors generateCopyWithSonnet shape ──
       export async function scoreCampaignQuality(input: JudgeInput): Promise<JudgeResult> {
         const client = getAnthropic();
         const startTime = Date.now();

         const userText = `LEGENDA GERADA:\n${input.copyText}\n\nIMAGENS:\n- Produto: ${input.productImageUrl}\n- Modelo: ${input.modelImageUrl}\n- VTO final: ${input.generatedImageUrl}\n\nVersão do prompt do copywriter: ${input.prompt_version}`;

         const response = await withTimeout(
           client.messages.create({
             model: MODEL,
             max_tokens: 1500,
             temperature: 0.2,  // lower than copywriter — judge wants consistency, not creativity
             system: JUDGE_SYSTEM_PROMPT,
             tools: [scoreCampaignQualityTool],
             tool_choice: { type: "tool", name: "score_campaign_quality" },
             messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
           }),
           30_000,
           "Judge Quality",
         );

         const durationMs = Date.now() - startTime;

         const toolBlock = response.content.find(
           (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "score_campaign_quality",
         );
         if (!toolBlock) {
           const err = new JudgeInvalidOutputError("Judge did not emit the expected tool_use block");
           captureError(err, { extra: { stop_reason: response.stop_reason } });
           throw err;
         }

         const parsed = JudgeOutputSchema.safeParse(toolBlock.input);
         if (!parsed.success) {
           const err = new JudgeInvalidOutputError(
             `Zod boundary validation failed: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
             parsed.error,
           );
           captureError(err, { extra: { input: toolBlock.input } });
           throw err;
         }

         return {
           output: parsed.data,
           _usageMetadata: {
             inputTokens: response.usage?.input_tokens || 0,
             outputTokens: response.usage?.output_tokens || 0,
           },
           durationMs,
         };
       }
       ```

    2. **Extend `campanha-ia/src/lib/pricing/fallbacks.ts`** — add a `judge_quality` entry to `FALLBACK_TOKENS`. Pick estimates by reasoning: judge prompt ~800 input tokens (system prompt above is ~2KB, plus user text with URLs = ~600), output ~400 tokens (12 fields). Use `{ inputTokens: 1200, outputTokens: 400 }`. Add a comment block explaining the estimate basis (similar to existing entries' comments).

       FALLBACK_PRICES already has `claude-sonnet-4-6` (line 42) — DO NOT add a duplicate.

    3. **Add `setCampaignScores` to `campanha-ia/src/lib/db/index.ts`** — append after `savePipelineResultV3` (line 988):

       ```typescript
       /**
        * D-06 (Phase 02 quality-loop): persist judge output to campaign_scores.
        *
        * Idempotent — UPSERT on campaign_id (judge may re-run if Inngest retries
        * after a transient failure; only the most recent score row should exist).
        * Clamps every numeric dimension to [1, 5] before insert (defense in depth
        * against schema drift if the judge ever returns out-of-range integers
        * that slip past Zod somehow).
        *
        * The 6 PT-BR justificativa_* strings land in the `melhorias` JSONB column
        * (existing schema; reusing the slot since the column was unused after Phase 0).
        *
        * Sentinel value for D-02: when called with nivel_risco='falha_judge', the
        * numeric columns are still required NOT NULL — caller passes 0-clamped-to-1
        * to satisfy the constraint; downstream queries treat falha_judge as "ignore numerics".
        *
        * The unique constraint on campaign_id MAY NOT EXIST yet — if upsert fails
        * with "no unique constraint matching ON CONFLICT specification", add it via
        * a one-line migration: ALTER TABLE campaign_scores ADD CONSTRAINT campaign_scores_campaign_id_key UNIQUE (campaign_id);
        * (Document this in the SUMMARY so the user can apply.)
        */
       export interface CampaignScoresInput {
         campaignId: string;
         naturalidade: number;
         conversao: number;
         clareza: number;
         aprovacao_meta: number;
         nota_geral: number;
         nivel_risco: "baixo" | "medio" | "alto" | "falha_judge";
         justificativas: {
           naturalidade: string;
           conversao: string;
           clareza: string;
           aprovacao_meta: string;
           nota_geral: string;
           nivel_risco: string;
         };
       }

       export async function setCampaignScores(input: CampaignScoresInput): Promise<void> {
         const supabase = createAdminClient();
         const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
         const { error } = await supabase
           .from("campaign_scores")
           .upsert(
             {
               campaign_id: input.campaignId,
               naturalidade:   clamp(input.naturalidade),
               conversao:      clamp(input.conversao),
               clareza:        clamp(input.clareza),
               aprovacao_meta: clamp(input.aprovacao_meta),
               nota_geral:     clamp(input.nota_geral),
               urgencia:       3,  // Legacy column from Phase 0 baseline; not in AI-SPEC §5.1 dims.
                                   // Set to neutral midpoint until a follow-up migration drops the column.
               nivel_risco:    input.nivel_risco,
               melhorias:      input.justificativas,  // 6 PT-BR strings as keyed object
             },
             { onConflict: "campaign_id" },
           );
         if (error) throw new Error(`setCampaignScores failed: ${error.message}`);
       }
       ```

    4. **Create `campanha-ia/src/lib/ai/judge.test.ts`** — mirror `sonnet-copywriter.test.ts` mocking style. Cover the 7 behavior tests above (5 for judge + 2 for setCampaignScores clamping/idempotency). For setCampaignScores, mock `createAdminClient` from `@/lib/supabase/admin` and assert the upsert call shape.
  </action>
  <acceptance_criteria>
    - `ls campanha-ia/src/lib/ai/judge.ts campanha-ia/src/lib/ai/judge.test.ts` returns both files.
    - `grep -c 'name: "score_campaign_quality"' campanha-ia/src/lib/ai/judge.ts` returns ≥ 2 (tool def + tool_choice).
    - `grep -nE "JudgeInvalidOutputError|JudgeOutputSchema|JUDGE_PROMPT_VERSION|scoreCampaignQuality" campanha-ia/src/lib/ai/judge.ts | wc -l` ≥ 8 (all key exports present and used).
    - `grep -c "judge_quality" campanha-ia/src/lib/pricing/fallbacks.ts` returns 1 (FALLBACK_TOKENS entry added).
    - `grep -c "setCampaignScores" campanha-ia/src/lib/db/index.ts` ≥ 2 (declaration + JSDoc).
    - `grep -E "afina a cintura|tira celulite|modela o corpo|do P ao GG|todos os tamanhos|clientes adoraram|melhor blusa do Brasil|jeans escuro" campanha-ia/src/lib/ai/judge.ts | wc -l` ≥ 6 (judge prompt cites Forbidden List categories from DOMAIN-RUBRIC.md).
    - `grep -E "Escassez|Prova social|Curiosidade|Transformação|Preço" campanha-ia/src/lib/ai/judge.ts | wc -l` ≥ 5 (5-trigger taxonomy referenced).
    - `cd campanha-ia && npx vitest run src/lib/ai/judge.test.ts` passes all 7 tests.
    - `cd campanha-ia && npx tsc --noEmit` clean.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/lib/ai/judge.test.ts src/lib/ai/sonnet-copywriter.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>judge.ts exports scoreCampaignQuality + JudgeOutputSchema + JUDGE_PROMPT_VERSION + JudgeInvalidOutputError; setCampaignScores upserts with clamping; FALLBACK_TOKENS extended; 7 tests green; PT-BR judge prompt cites Forbidden List + 5 triggers verbatim from DOMAIN-RUBRIC.md.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add judgeCampaignJob to Inngest functions + register in inngestFunctions array</name>
  <files>campanha-ia/src/lib/inngest/functions.ts, campanha-ia/src/lib/inngest/judge.test.ts</files>
  <read_first>
    - campanha-ia/src/lib/inngest/functions.ts (THE file being modified — read lines 193-249 generateModelPreviewJob template + line 301 inngestFunctions export array)
    - campanha-ia/src/lib/ai/judge.ts (just created in Task 1)
    - campanha-ia/src/lib/db/index.ts setCampaignScores (just added in Task 1)
    - campanha-ia/src/lib/ai/log-model-cost.ts (judge cost-log call)
    - .planning/phases/02-quality-loop/02-CONTEXT.md decisions D-01, D-02, D-05, C-02 (idempotency test mandate)
    - .planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md §6.2 (offline flywheel metrics — judge writes feed this)
  </read_first>
  <behavior>
    - Test 1 (happy path): judgeCampaignJob receives event with valid payload → calls scoreCampaignQuality (mocked to return valid JudgeOutput) → calls setCampaignScores with the parsed scores → calls logModelCost with action='judge_quality' + JUDGE_PROMPT_VERSION + claude-sonnet-4-6 + the duration. Final return contains `{campaignId, nota_geral, nivel_risco}`.
    - Test 2 (terminal failure → falha_judge sentinel per D-02): scoreCampaignQuality throws JudgeInvalidOutputError → onFailure handler runs → setCampaignScores called with `nivel_risco='falha_judge'` and numeric dimensions clamped to 1.
    - Test 3 (idempotency — C-02 mandate): emit campaign/judge.requested twice for same campaignId → setCampaignScores called twice, but the upsert (mocked) records only one underlying row per campaign_id. Assert `setCampaignScores` is called with `campaignId: 'X'` exactly twice and the upsert spy receives `onConflict: 'campaign_id'` both times.
    - Test 4: Event name is exactly `'campaign/judge.requested'` (assert via the registered triggers).
    - Test 5: retries: 2 (assert createFunction config).
    - Test 6: judgeCampaignJob is included in the exported `inngestFunctions` array (read the array length pre/post Task — should grow by 1).
  </behavior>
  <action>
    1. **Modify `campanha-ia/src/lib/inngest/functions.ts`**:

       a. Add imports at the top (after existing imports, before `inngest` import):
       ```typescript
       import { scoreCampaignQuality, JUDGE_PROMPT_VERSION } from "@/lib/ai/judge";
       import { setCampaignScores } from "@/lib/db";
       import { logModelCost } from "@/lib/ai/log-model-cost";
       ```

       b. Insert new section BEFORE line 301 (the inngestFunctions export):

       ```typescript
       // ═══════════════════════════════════════════════════════════
       // JUDGE — LLM-as-judge for campaign quality (Phase 02 D-01..D-06)
       // ═══════════════════════════════════════════════════════════

       interface JudgeRequestEvent {
         campaignId: string;
         storeId: string;
         copyText: string;
         productImageUrl: string;
         modelImageUrl: string;
         generatedImageUrl: string;
         prompt_version: string;  // SHA from sonnet-copywriter for traceability
       }

       /**
        * Job: score every successful campaign with the LLM-as-judge.
        * Triggered by event campaign/judge.requested emitted from pipeline.ts.
        * Provider: Anthropic (claude-sonnet-4-6) — same model as copywriter for cost-forecast symmetry.
        * Cost: ~R$0.02/campaign per D-04.
        * Retries: 2 with exponential backoff (matches generateModelPreviewJob convention).
        * Terminal failure: writes nivel_risco='falha_judge' sentinel per D-02.
        */
       export const judgeCampaignJob = inngest.createFunction(
         {
           id: "judge-campaign",
           retries: 2,
           triggers: [{ event: "campaign/judge.requested" }],
           onFailure: async ({ event, error }) => {
             // D-02 sentinel: persist nivel_risco='falha_judge' so /admin/quality
             // can distinguish "judge failed" from "low quality". captureError is
             // already invoked inside scoreCampaignQuality on JudgeInvalidOutputError;
             // this branch handles transport failures (timeouts, 5xx after retries).
             try {
               const data =
                 (event.data as unknown as { event?: { data?: JudgeRequestEvent } })?.event?.data ??
                 (event.data as unknown as JudgeRequestEvent);
               if (data?.campaignId) {
                 await setCampaignScores({
                   campaignId: data.campaignId,
                   naturalidade: 1,
                   conversao: 1,
                   clareza: 1,
                   aprovacao_meta: 1,
                   nota_geral: 1,
                   nivel_risco: "falha_judge",
                   justificativas: {
                     naturalidade: "judge falhou — score não confiável",
                     conversao: "judge falhou — score não confiável",
                     clareza: "judge falhou — score não confiável",
                     aprovacao_meta: "judge falhou — score não confiável",
                     nota_geral: "judge falhou — score não confiável",
                     nivel_risco: `judge falhou após retries: ${error?.message?.slice(0, 200) ?? "unknown"}`,
                   },
                 });
                 console.error(`[Inngest:Judge] ❌ Falhou p/ campaign ${data.campaignId} — sentinel falha_judge gravado`);
               }
             } catch (e) {
               console.error("[Inngest:Judge] Erro no onFailure handler:", e);
             }
           },
         },
         async ({ event, step }) => {
           const data = event.data as JudgeRequestEvent;

           // Step 1: call the judge (Anthropic tool_use + Zod boundary inside scoreCampaignQuality)
           const judgeResult = await step.run("score-campaign", async () => {
             return await scoreCampaignQuality({
               campaignId: data.campaignId,
               storeId: data.storeId,
               copyText: data.copyText,
               productImageUrl: data.productImageUrl,
               modelImageUrl: data.modelImageUrl,
               generatedImageUrl: data.generatedImageUrl,
               prompt_version: data.prompt_version,
             });
           });

           // Step 2: persist scores (idempotent UPSERT on campaign_id per D-06)
           await step.run("persist-scores", async () => {
             await setCampaignScores({
               campaignId: data.campaignId,
               naturalidade:   judgeResult.output.naturalidade,
               conversao:      judgeResult.output.conversao,
               clareza:        judgeResult.output.clareza,
               aprovacao_meta: judgeResult.output.aprovacao_meta,
               nota_geral:     judgeResult.output.nota_geral,
               nivel_risco:    judgeResult.output.nivel_risco,
               justificativas: {
                 naturalidade:   judgeResult.output.justificativa_naturalidade,
                 conversao:      judgeResult.output.justificativa_conversao,
                 clareza:        judgeResult.output.justificativa_clareza,
                 aprovacao_meta: judgeResult.output.justificativa_aprovacao_meta,
                 nota_geral:     judgeResult.output.justificativa_nota_geral,
                 nivel_risco:    judgeResult.output.justificativa_nivel_risco,
               },
             });
           });

           // Step 3: log cost (D-05 — JUDGE_PROMPT_VERSION lands in api_cost_logs.metadata)
           await step.run("log-cost", async () => {
             await logModelCost({
               storeId: data.storeId,
               campaignId: data.campaignId,
               provider: "anthropic",
               model: "claude-sonnet-4-6",
               action: "judge_quality",
               usage: judgeResult._usageMetadata,
               durationMs: judgeResult.durationMs,
               promptVersion: JUDGE_PROMPT_VERSION,
             });
           });

           return {
             campaignId: data.campaignId,
             nota_geral: judgeResult.output.nota_geral,
             nivel_risco: judgeResult.output.nivel_risco,
           };
         }
       );
       ```

       c. **Update the inngestFunctions array** at line 301:
       ```typescript
       export const inngestFunctions = [
         generateModelPreviewJob,
         generateBackdropJob,
         judgeCampaignJob,                      // ← NEW (Phase 02 D-01)
         storageGarbageCollectorCron,
         storageGarbageCollectorManual,
       ];
       ```

    2. **Create `campanha-ia/src/lib/inngest/judge.test.ts`** — vitest. Mock `@/lib/ai/judge`, `@/lib/db`, `@/lib/ai/log-model-cost`. Construct synthetic Inngest event objects and invoke the function handler directly (Inngest's createFunction returns an object with the handler accessible — read `campanha-ia/src/lib/inngest/storage-gc.test.ts` if it exists for the project's pattern; otherwise call `judgeCampaignJob.fn` or equivalent based on the Inngest SDK version). Cover the 6 behavior cases above.
  </action>
  <acceptance_criteria>
    - `grep -nE "judgeCampaignJob|campaign/judge\\.requested" campanha-ia/src/lib/inngest/functions.ts | wc -l` ≥ 4 (define + trigger + export array entry + comment).
    - `grep -nE "id: \"judge-campaign\"|retries: 2" campanha-ia/src/lib/inngest/functions.ts | wc -l` ≥ 2.
    - `grep -nE "step\\.run\\(\"score-campaign\"|step\\.run\\(\"persist-scores\"|step\\.run\\(\"log-cost\"" campanha-ia/src/lib/inngest/functions.ts | wc -l` ≥ 3 (3 steps registered).
    - `grep -c "falha_judge" campanha-ia/src/lib/inngest/functions.ts` ≥ 1 (D-02 sentinel in onFailure handler).
    - `grep -c "judgeCampaignJob," campanha-ia/src/lib/inngest/functions.ts` ≥ 1 (in export array).
    - `cd campanha-ia && npx vitest run src/lib/inngest/judge.test.ts` passes all 6 tests.
    - `cd campanha-ia && npx tsc --noEmit` clean.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/lib/inngest/judge.test.ts src/lib/ai/judge.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>judgeCampaignJob registered with 3 steps, retries: 2, falha_judge sentinel onFailure; idempotency proven via upsert; included in inngestFunctions array; 6 tests green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Emit campaign/judge.requested from pipeline.ts (gated by !dryRun + successCount > 0)</name>
  <files>campanha-ia/src/lib/ai/pipeline.ts</files>
  <read_first>
    - campanha-ia/src/lib/ai/pipeline.ts (THE file being modified — read lines 287-320 where the placeholder comment was added by Plan 02-02 Task 2)
    - .planning/phases/02-quality-loop/02-02-SUMMARY.md (the line numbers where Plan 02-02 wrote the placeholder)
    - campanha-ia/src/lib/inngest/client.ts (the inngest singleton import)
    - campanha-ia/src/lib/inngest/functions.ts judgeCampaignJob.JudgeRequestEvent shape (just defined in Task 2)
    - campanha-ia/src/lib/ai/sonnet-copywriter.ts:167-173 sonnetPromptVersionFor (gives the Sonnet prompt_version for the event payload)
    - .planning/phases/02-quality-loop/02-CONTEXT.md `<specifics>` Inngest judgeCampaignJob event payload
  </read_first>
  <action>
    1. **Add inngest import** at the top of `campanha-ia/src/lib/ai/pipeline.ts` (alongside existing imports):
       ```typescript
       import { inngest } from "@/lib/inngest/client";
       ```

    2. **Replace the placeholder comment** (added by Plan 02-02 Task 2 — find by `grep -n "Plan 02-03.*Inngest" pipeline.ts`) with the actual emit. The emit goes after the pose-history fire-and-forget block, before the final `const durationMs = Date.now() - startTime;` line:

       ```typescript
       // ── D-01 (Phase 02): emit Inngest event so judgeCampaignJob scores this campaign. ──
       // Fire-and-forget — judge runs durably in Inngest with retries: 2 (D-02). Pipeline
       // never awaits or surfaces judge failures to the user. dryRun gate per D-18:
       // evals/run.ts uses dryRun=true to drive the pipeline against golden-set entries
       // without polluting Inngest with eval traffic.
       if (!input.dryRun && imageResult.successCount > 0 && input.storeId && input.campaignId) {
         const generatedImageUrl = imageResult.images[0]?.imageUrl;
         if (generatedImageUrl) {
           const sonnetVersion = sonnetPromptVersionFor(input.targetLocale ?? "pt-BR");
           // We send minimal payload (D-01 specifics): judge does NOT re-fetch from DB.
           // Image URLs MUST already be Supabase public URLs at this point (savePipelineResultV3
           // is called downstream of runCampaignPipeline by the route handler — but the URLs
           // returned by Gemini VTO are uploaded inside generateWithGeminiVTO before this point).
           void inngest
             .send({
               name: "campaign/judge.requested",
               data: {
                 campaignId: input.campaignId,
                 storeId: input.storeId,
                 copyText: copyResult.dicas_postagem.caption_sugerida,
                 productImageUrl: "",  // see SUMMARY note: pipeline doesn't have a public URL for the input photo here; route.ts has it after upload. For now pass empty string — judge prompt allows missing URLs and just scores the copy + VTO. Follow-up: route.ts can re-emit with the productImageUrl after savePipelineResultV3.
                 modelImageUrl: "",    // same reasoning — modelInfo lives in pipeline input but as base64, not a URL
                 generatedImageUrl,
                 prompt_version: sonnetVersion,
               },
             })
             .catch((e) => console.warn("[Pipeline] inngest.send judge.requested failed:", e instanceof Error ? e.message : e));
         }
       }
       ```

       Note in the SUMMARY: passing empty productImageUrl/modelImageUrl is a known limitation of emitting from pipeline.ts (it doesn't have public URLs for those — only Gemini's generated image URL is available post-VTO). The judge prompt is robust to missing URLs (it scores the text primarily). A follow-up improvement is to emit from `route.ts` AFTER `savePipelineResultV3` where `imageUrls` for product/model are known — but that requires CONTEXT.md D-01 to be reinterpreted (it says "from pipeline.ts"). Choose to honor CONTEXT D-01 literally for this plan; surface the limitation in the SUMMARY as a candidate Phase 03 improvement. Log to `deferred-items.md`.

    3. **Verify the placeholder comment from Plan 02-02 is removed/replaced** so there is no orphan comment.
  </action>
  <acceptance_criteria>
    - `grep -c "campaign/judge\\.requested" campanha-ia/src/lib/ai/pipeline.ts` returns 1.
    - `grep -nE "if \(!input\\.dryRun.*successCount > 0|imageResult\\.successCount > 0.*input\\.dryRun" campanha-ia/src/lib/ai/pipeline.ts | wc -l` ≥ 1 (dryRun + successCount gate present).
    - `grep -c "Plan 02-03.*Inngest|judge\\.requested.*emit lands here" campanha-ia/src/lib/ai/pipeline.ts` returns 0 (placeholder comment from 02-02 fully replaced).
    - `grep -c 'import { inngest }' campanha-ia/src/lib/ai/pipeline.ts` ≥ 1.
    - `cd campanha-ia && npx vitest run src/lib/ai/pipeline.test.ts` STILL passes — the existing dryRun tests must continue to pass (the new emit is gated and tests should already mock inngest.send).
    - `cd campanha-ia && npx tsc --noEmit` clean.
  </acceptance_criteria>
  <verify>
    <automated>cd campanha-ia && npx vitest run src/lib/ai/pipeline.test.ts src/lib/inngest/judge.test.ts src/lib/ai/judge.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>pipeline.ts emits campaign/judge.requested after Promise.all; gated by !dryRun + successCount > 0 + storeId/campaignId presence; fire-and-forget with .catch warn; pipeline.test.ts passes (executor extends test mocks for inngest.send if needed).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Canary review before merge — first production deploy of judge logic</name>
  <what-built>
    Plans 01-03 land the LLM-as-judge wired end-to-end:
    - lib/ai/judge.ts: PT-BR judge prompt referencing DOMAIN-RUBRIC.md categories
    - lib/inngest/functions.ts: judgeCampaignJob with retries 2 + falha_judge sentinel
    - lib/db/index.ts: setCampaignScores with idempotent UPSERT
    - lib/pricing/fallbacks.ts: judge_quality token estimates
    - lib/ai/pipeline.ts: campaign/judge.requested event emit (gated by !dryRun + successCount > 0)
  </what-built>
  <how-to-verify>
    Per output requirement #5: this is the first production deploy of judge logic. Pause for user to:

    1. **Read the judge prompt** in `campanha-ia/src/lib/ai/judge.ts` JUDGE_SYSTEM_PROMPT constant. Verify:
       - PT-BR (lojista may eventually see justificativa text)
       - Cites Forbidden List categories (sizes, body-transformation, invented testimonials, etc.) as `nivel_risco='alto'` triggers
       - References 5-trigger taxonomy for `naturalidade`
       - Does NOT include the deferred "afina a cintura na hora" prompt-content gap (that's a separate prompt-edit phase per D-23)

    2. **Decide on the productImageUrl/modelImageUrl gap**: Task 3 emits the Inngest event with empty strings for these URLs because pipeline.ts doesn't have public URLs at emit time. Options:
       - (a) Accept the limitation for Phase 02; judge scores the text primarily. Log to deferred-items.md.
       - (b) Move the emit to route.ts (after savePipelineResultV3) where imageUrls ARE known. Requires reinterpreting D-01.
       - (c) Modify pipeline.ts to receive the upload URLs from VTO (more invasive).

       Default: (a). User can override.

    3. **Consider canary strategy**: should the executor temporarily gate the emit behind an env flag like `FEATURE_JUDGE_QUALITY=1` (default off) so production traffic can be canary'd to a single store before full rollout?

    4. **Verify SQL constraint**: confirm whether `campaign_scores.campaign_id` has a UNIQUE constraint. If not, the upsert will fail at runtime. Run on Supabase:
       ```sql
       SELECT conname FROM pg_constraint WHERE conrelid = 'campaign_scores'::regclass AND contype = 'u';
       ```
       If no row mentions campaign_id, write a one-line migration:
       ```sql
       ALTER TABLE campaign_scores ADD CONSTRAINT campaign_scores_campaign_id_key UNIQUE (campaign_id);
       ```
       and place at `campanha-ia/supabase/migrations/{timestamp}_add_campaign_scores_unique_campaign_id.sql`. Apply via `npx supabase db push` (or the project's standard migration workflow).
  </how-to-verify>
  <resume-signal>Type "approved" to commit; "needs canary flag" to add FEATURE_JUDGE_QUALITY env gate before commit; "needs migration" to add the UNIQUE constraint migration before commit; or describe other concerns.</resume-signal>
</task>

</tasks>

<verification>
End-to-end smoke (manual, dev environment):
1. Trigger a campaign generation through the normal flow (web or mobile).
2. Within ~30s, check Inngest dashboard: `judge-campaign` function should show 1 successful run.
3. Query Supabase:
   ```sql
   SELECT campaign_id, naturalidade, nivel_risco, melhorias FROM campaign_scores ORDER BY created_at DESC LIMIT 1;
   ```
   Should return a row with the latest campaign_id, all 6 numeric dims in [1,5], nivel_risco in {'baixo','medio','alto'}, and melhorias JSONB containing the 6 PT-BR justificativa_* strings.
4. Query api_cost_logs:
   ```sql
   SELECT action, model_used, metadata->>'prompt_version' AS prompt_version, cost_brl
   FROM api_cost_logs WHERE action = 'judge_quality' ORDER BY created_at DESC LIMIT 1;
   ```
   Should return a row with `claude-sonnet-4-6`, the JUDGE_PROMPT_VERSION SHA, cost ~R$0.02.

Idempotency smoke: re-emit `campaign/judge.requested` for the same campaignId via Inngest dashboard "Re-run" button; verify only one row in campaign_scores (UPSERT working).

Failure smoke: temporarily break the Anthropic key in dev → trigger a campaign → verify Inngest retries 2x then onFailure writes nivel_risco='falha_judge' to campaign_scores.

Automated:
- `cd campanha-ia && npx vitest run src/lib/ai/judge.test.ts src/lib/inngest/judge.test.ts src/lib/ai/pipeline.test.ts`
- `cd campanha-ia && npx tsc --noEmit`
</verification>

<success_criteria>
- judge.ts mirrors sonnet-copywriter.ts pattern exactly (tool_use, withTimeout 30s, Zod boundary, captureError on failure).
- Tool name `score_campaign_quality` is locked.
- Judge prompt is PT-BR, cites Forbidden List categories + 5-trigger taxonomy verbatim from DOMAIN-RUBRIC.md.
- judgeCampaignJob runs as Inngest async with retries 2, 3 steps, falha_judge sentinel onFailure.
- setCampaignScores upserts on campaign_id (idempotency proven by test + manual re-emit smoke).
- pipeline.ts emits campaign/judge.requested gated by !dryRun + successCount > 0.
- FALLBACK_TOKENS extended with judge_quality estimate.
- All new tests (7+6+5 = 18) green; existing Phase 01 tests still green.
- User has reviewed the PT-BR judge prompt and approved (or requested edits) before commit.
</success_criteria>

<output>
After completion, create `.planning/phases/02-quality-loop/02-03-SUMMARY.md` documenting:
- Files created/modified
- Final JUDGE_PROMPT_VERSION SHA value (12 chars)
- Whether the canary env gate was added (decision from Task 4 checkpoint)
- Whether the UNIQUE constraint migration was added (and migration file path)
- The decision on productImageUrl/modelImageUrl emit-time gap (a/b/c from Task 4) — and a deferred-items.md entry if (a)
- The exact line in pipeline.ts where the emit lands (so Plan 02-04/02-06 executors can find it)
- Sample insertion observed in dev: campaign_scores row + api_cost_logs row (from the smoke test)
</output>
