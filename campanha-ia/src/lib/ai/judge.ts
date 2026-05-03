/**
 * CriaLook LLM-as-Judge — Phase 02 D-01..D-06.
 *
 * Scores every successful campaign generation across 6 dimensions defined in
 * AI-SPEC §5.1. Triggered async via Inngest event `campaign/judge.requested`
 * (see lib/inngest/functions.ts → judgeCampaignJob).
 *
 * Pattern mirrors sonnet-copywriter.ts exactly (D-03 Phase 01):
 *   getAnthropic() → withTimeout → tool_use + tool_choice → Zod boundary.
 *
 * Cost: ~R$0.09/campaign at FALLBACK estimates (D-04, claude-sonnet-4-6 — see
 * lib/pricing/fallbacks.ts judge_quality entry for the breakdown). Real
 * usage from the SDK overrides the fallback once live.
 *
 * Prompt versioning (D-05): JUDGE_PROMPT_VERSION cached at module load so
 * api_cost_logs.metadata.prompt_version carries the SHA — judge-prompt edits
 * are themselves correlatable to score shifts in /admin/quality (Plan 02-04).
 *
 * The Forbidden List + 5-trigger taxonomy quoted in JUDGE_SYSTEM_PROMPT below
 * are lifted verbatim from .planning/codebase/DOMAIN-RUBRIC.md so the rubric
 * doc and the runtime prompt cannot drift silently. Prompt-edit PRs that
 * touch this constant MUST also update DOMAIN-RUBRIC.md (and vice versa).
 *
 * D-23 scope note: this phase does NOT touch prompt CONTENT of the
 * sonnet-copywriter (the deferred "afina a cintura na hora" example at
 * sonnet-copywriter.ts:289 stays — fixing it is a separate prompt-edit phase).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropic } from "./clients";
import { withTimeout } from "./with-timeout";
import { computePromptVersion } from "./prompt-version";
import { captureError } from "@/lib/observability";

// ═══════════════════════════════════════
// Zod schema (single source of truth)
// ═══════════════════════════════════════
//
// The tool input_schema below mirrors this in JSON Schema form (the
// Anthropic API consumes JSON Schema, not Zod). Drift between the two
// surfaces as Zod validation failure at the boundary, not as silent
// downstream corruption — same contract pattern as Sonnet copywriter D-16.

export const JudgeOutputSchema = z.object({
  // ── 5 numeric dimensions (1-5 inteiro) ──
  // Note: AI-SPEC §5.1 defines 6 dimensions; the 6th (nivel_risco) is the
  // categorical enum below. Per <specifics>, nota_geral is computed by the
  // judge with its own weighting, NOT a server-side average.
  naturalidade:    z.number().int().min(1).max(5),
  conversao:       z.number().int().min(1).max(5),
  clareza:         z.number().int().min(1).max(5),
  aprovacao_meta:  z.number().int().min(1).max(5),
  nota_geral:      z.number().int().min(1).max(5),
  // ── nivel_risco enum ──
  // "falha_judge" is NOT in this enum — only the Inngest onFailure handler
  // writes that sentinel via setCampaignScores (D-02). The judge model
  // itself only emits baixo/medio/alto.
  nivel_risco:     z.enum(["baixo", "medio", "alto"]),
  // ── 6 PT-BR justificativas (lojista may eventually see these in
  //    /admin/quality — write for her, sem jargão técnico) ──
  justificativa_naturalidade:    z.string().min(1).max(500),
  justificativa_conversao:       z.string().min(1).max(500),
  justificativa_clareza:         z.string().min(1).max(500),
  justificativa_aprovacao_meta:  z.string().min(1).max(500),
  justificativa_nota_geral:      z.string().min(1).max(500),
  justificativa_nivel_risco:     z.string().min(1).max(500),
});
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

// ═══════════════════════════════════════
// Tool definition (LOCKED name per CONTEXT.md <specifics>)
// ═══════════════════════════════════════
//
// `score_campaign_quality` is the tool name agreed in 02-CONTEXT.md
// <specifics>. Renaming it requires coordinated edits across this file +
// lib/inngest/functions.ts (judgeCampaignJob spy assertions if any) +
// every grep target in the plan's acceptance_criteria. Don't.
const scoreCampaignQualityTool: Anthropic.Tool = {
  name: "score_campaign_quality",
  description:
    "Score the campaign across 5 numeric quality dimensions plus a nivel_risco enum. " +
    "Use 1-5 integer scale (1 worst, 5 best). Output one PT-BR justificativa per dimension. " +
    "nota_geral is your own weighted score across the other dimensions, not an arithmetic mean.",
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
      "naturalidade", "conversao", "clareza", "aprovacao_meta", "nota_geral", "nivel_risco",
      "justificativa_naturalidade", "justificativa_conversao", "justificativa_clareza",
      "justificativa_aprovacao_meta", "justificativa_nota_geral", "justificativa_nivel_risco",
    ],
  },
};

// ═══════════════════════════════════════
// Classified error (parallel to SonnetInvalidOutputError)
// ═══════════════════════════════════════
//
// Same shape as SonnetInvalidOutputError so the Inngest job (which catches
// + maps these into nivel_risco='falha_judge' via onFailure) can pattern-
// match uniformly. retryable=false because schema drift doesn't cure with
// retry — only burns money.
export class JudgeInvalidOutputError extends Error {
  readonly code = "JUDGE_INVALID_OUTPUT" as const;
  readonly retryable = false;
  readonly userMessage = "O avaliador retornou resposta em formato inesperado.";
  constructor(
    public readonly technicalMessage: string,
    cause?: unknown,
  ) {
    super(technicalMessage, cause !== undefined ? { cause } : undefined);
    this.name = "JudgeInvalidOutputError";
  }
}

// ═══════════════════════════════════════
// PT-BR System prompt — DOMAIN-RUBRIC.md is the source of truth
// ═══════════════════════════════════════
//
// PT-BR because the lojista may eventually read the judge's justificativa
// strings in /admin/quality (Plan 02-04). Write for her, sem jargão técnico.
//
// Forbidden List categories quoted verbatim from DOMAIN-RUBRIC.md so the
// rubric doc and the runtime prompt cannot drift silently. The 5 categories
// each map to nivel_risco='alto'. One yellow flag = 'medio'. Clean = 'baixo'.
//
// 5-trigger taxonomy quoted from DOMAIN-RUBRIC.md — judge's `naturalidade`
// dimension scores whether exactly one trigger is identifiable in <5s.
//
// D-25 scope: judge persists scores; no calibration vs human labels this
// phase (≥0.7 correlation gate is Phase 2.5 acceptance criterion).
const JUDGE_SYSTEM_PROMPT = `Você é avaliador de qualidade de copy para anúncios de moda no Instagram brasileiro.
Recebe (a) o texto da legenda gerada pelo copywriter, (b) URLs da foto do produto, da modelo e da imagem VTO final.
Sua tarefa é pontuar 5 dimensões em escala 1-5 (1 pior, 5 melhor) + 1 nota_geral computada por você + classificar nivel_risco.
Você também escreve uma justificativa curta em PT-BR para cada dimensão (a lojista pode ler).

═══════════════════════════════════════════════════
DIMENSÕES NUMÉRICAS (sempre 1-5 inteiro)
═══════════════════════════════════════════════════

1. naturalidade — Soa humano e brasileiro? Tem gancho de scroll-stop nos primeiros 12 palavras?
   Evita os clichês listados (Tá perfeito 🔥, Look pronto, Arrasou/Arrasadora, Diva, Maravilhosa,
   Apaixonada, Confira esta peça incrível, Sem palavras, "🔥🔥🔥" sem texto, Disponível agora,
   Não perca, Corre pra garantir, Peça única)?
   Usa exatamente 1 dos 5 gatilhos identificável em <5s?
     - Escassez ("últimas peças", "repôs e já tá saindo")
     - Prova social ("a queridinha voltou", "todo mundo tá pedindo")
     - Curiosidade ("achei a calça que…", "descobri o truque…")
     - Transformação do LOOK ("de casa pro trabalho sem trocar", "transforma o jeans em produção de festa") — NUNCA do CORPO
     - Preço (apenas se valor estiver no contexto)

2. conversao — CTA específico (não genérico tipo só "Comenta EU QUERO")?
   Pede ação clara (manda no direct, comenta com tamanho, etc)?

3. clareza — Frases ≤12 palavras? 3-5 linhas total? Cada frase em linha separada (\\n entre frases)?

4. aprovacao_meta — Probabilidade de passar revisão Meta/Instagram?
   Sem termos médicos/farmacêuticos, sem reivindicações superlativas sem prova,
   sem testemunhos inventados.

5. nota_geral — SUA média ponderada das outras 4 + ajuste pelo nivel_risco.
   NÃO é média aritmética — você decide os pesos (ex: aprovacao_meta pesa mais que clareza).
   Se nivel_risco='alto', nota_geral cai pelo menos 2 pontos.

═══════════════════════════════════════════════════
NIVEL_RISCO (CRÍTICO — fonte: DOMAIN-RUBRIC.md "Forbidden List")
═══════════════════════════════════════════════════

Classifique 'alto' se a copy contém QUALQUER UMA destas categorias:

(A) Tamanhos inventados: "do P ao GG", "tem do 36 ao 48", "todos os tamanhos", "plus size",
    "PP", "XG", citação de busto/cintura/comprimento em cm — quando lojista não forneceu.

(B) Reivindicação de transformação CORPORAL (não confundir com transformação do LOOK):
    "afina a cintura", "tira celulite", "modela o corpo", "tira a barriga", "rejuvenesce",
    "deixa mais magra", "esconde gordurinhas". Estas são CONAR-risk (CBARP Arts. 17 + 27).

(C) Testemunho inventado: "clientes adoraram", "todo mundo aprovou", "as meninas amaram",
    "@usuario disse", citação de cliente fictícia ("Maria comprou e amou").

(D) Superlativo sem prova: "a melhor blusa do Brasil", "a peça #1 do Instagram",
    "número 1 em conforto", "a mais elegante do mercado".

(E) Identidade do modelo descrita ALÉM do que a foto mostra: "morena linda", "loira atlética",
    "jovem de 20 anos", "negra gostosa" — sem dados estruturados do modelo na entrada.

(F) Wash de jeans descrito INCORRETAMENTE vs a foto:
    jeans claro chamado de "jeans escuro", médio chamado de "delavê", e vice-versa.

Classifique 'medio' se a copy tem 1 sinal amarelo isolado:
    clichê genérico ("disponível agora", "não perca", "corre pra garantir", "peça única"),
    emoji-spam (≥3 emojis sem âncora textual), CTA genérico sem ação clara.

Classifique 'baixo' (default) se nenhuma das categorias acima aparece.

═══════════════════════════════════════════════════
JUSTIFICATIVAS (PT-BR, máximo 500 caracteres cada)
═══════════════════════════════════════════════════

Uma frase curta por dimensão explicando a nota. A lojista pode eventualmente ler estas
justificativas no painel /admin/quality — escreva pra ela, sem jargão técnico.

Exemplos do tom:
- "Hook fraco — começa descrevendo a peça em vez de provocar"
- "CTA genérico ('comenta EU QUERO') sem pedir ação concreta"
- "Risco alto: cita 'afina a cintura' (transformação corporal — CONAR)"

Use a tool score_campaign_quality para responder. Não escreva texto solto antes ou depois.`;

export const JUDGE_PROMPT_VERSION = computePromptVersion(JUDGE_SYSTEM_PROMPT);

// ═══════════════════════════════════════
// Input + Result types
// ═══════════════════════════════════════

export interface JudgeInput {
  campaignId: string;
  storeId: string;
  /** SonnetDicasPostagem.caption_sugerida (or stringified full JSON) */
  copyText: string;
  productImageUrl: string;
  modelImageUrl: string;
  generatedImageUrl: string;
  /** The Sonnet prompt_version that produced copyText (traceability) */
  prompt_version: string;
}

export interface JudgeResult {
  output: JudgeOutput;
  _usageMetadata?: { inputTokens: number; outputTokens: number };
  durationMs: number;
}

const MODEL = "claude-sonnet-4-6";

// ═══════════════════════════════════════
// Main function — mirrors generateCopyWithSonnet shape
// ═══════════════════════════════════════

export async function scoreCampaignQuality(input: JudgeInput): Promise<JudgeResult> {
  const client = getAnthropic();
  const startTime = Date.now();

  // User text: judge does NOT need to re-fetch from DB. Minimal fields.
  // Image URLs may be empty strings when emitted from pipeline.ts (where
  // public URLs aren't yet available for product/model — see Plan 02-03
  // SUMMARY for the productImageUrl/modelImageUrl gap discussion); the
  // judge prompt is robust to missing URLs and scores the text + the VTO
  // generated URL primarily.
  const userText =
    `LEGENDA GERADA:\n${input.copyText}\n\n` +
    `IMAGENS:\n` +
    `- Produto: ${input.productImageUrl || "(URL não disponível neste contexto)"}\n` +
    `- Modelo: ${input.modelImageUrl || "(URL não disponível neste contexto)"}\n` +
    `- VTO final: ${input.generatedImageUrl}\n\n` +
    `Versão do prompt do copywriter: ${input.prompt_version}`;

  // ── tool_use + withTimeout (mirrors sonnet-copywriter.ts:249-261 D-16) ──
  // temperature: 0.2 (lower than copywriter's 0.7) — judge wants
  // consistency across re-runs of the same campaign, not creativity.
  const response = await withTimeout(
    client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.2,
      system: JUDGE_SYSTEM_PROMPT,
      tools: [scoreCampaignQualityTool],
      tool_choice: { type: "tool", name: "score_campaign_quality" },
      messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
    }),
    30_000,
    "Judge Quality",
  );

  const durationMs = Date.now() - startTime;

  // Find the named tool_use block (defensive — even with tool_choice forcing,
  // SDK contract technically allows leading text blocks).
  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === "score_campaign_quality",
  );
  if (!toolBlock) {
    const err = new JudgeInvalidOutputError(
      "Judge did not emit the expected tool_use block",
    );
    captureError(err, { extra: { stop_reason: response.stop_reason } });
    throw err;
  }

  // Boundary Zod: tool_use.input is `unknown` at the type level.
  // NEVER cast — always safeParse. Drift becomes a captured Sentry alert
  // instead of corrupted downstream data.
  const parsed = JudgeOutputSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    const err = new JudgeInvalidOutputError(
      `Zod boundary validation failed: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`,
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
