import { callClaude, callClaudeVision } from "./anthropic";
import {
  VISION_SYSTEM,
  buildVisionPrompt,
  STRATEGY_SYSTEM,
  buildStrategyPrompt,
  COPYWRITER_SYSTEM,
  buildCopywriterPrompt,
  REFINER_SYSTEM,
  buildRefinerPrompt,
  SCORER_SYSTEM,
  buildScorerPrompt,
} from "./prompts";
import type {
  VisionAnalysis,
  Strategy,
  CampaignOutput,
  CampaignScore,
  PipelineStep,
} from "@/types";

// ═══════════════════════════════════════
// Pipeline de geração de campanha
// ═══════════════════════════════════════

export interface PipelineInput {
  imageBase64: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  price: string;
  objective: string;
  storeName: string;
  targetAudience?: string;
  toneOverride?: string;
}

export interface PipelineResult {
  vision: VisionAnalysis;
  strategy: Strategy;
  output: Omit<CampaignOutput, "id" | "campaign_id">;
  score: Omit<CampaignScore, "id" | "campaign_id">;
  durationMs: number;
}

export type OnProgress = (step: PipelineStep, label: string, progress: number) => void;

/**
 * Executa o pipeline completo de geração de campanha.
 * Sem dependência de banco — retorna dados puros para a API route salvar.
 */
export async function runCampaignPipeline(
  input: PipelineInput,
  onProgress?: OnProgress,
): Promise<PipelineResult> {
  const startTime = Date.now();

  // ── STEP 1: Vision ──────────────────────────
  onProgress?.("vision", "Analisando produto...", 10);
  const visionRaw = await callClaudeVision({
    system: VISION_SYSTEM,
    prompt: buildVisionPrompt(),
    imageBase64: input.imageBase64,
    mediaType: input.mediaType,
  });
  const vision = parseJSON<VisionAnalysis>(visionRaw, "Vision");

  // ── STEP 2: Strategy ────────────────────────
  onProgress?.("strategy", "Criando estratégia...", 25);
  const strategyRaw = await callClaude({
    system: STRATEGY_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildStrategyPrompt({
          produto: vision.produto.nome_generico,
          preco: input.price,
          objetivo: input.objective,
          atributos: JSON.stringify(vision.atributos_visuais),
          segmento: vision.segmento,
          mood: vision.mood,
          publicoAlvo: input.targetAudience,
          tomOverride: input.toneOverride,
        }),
      },
    ],
    temperature: 0.8,
  });
  const strategy = parseJSON<Strategy>(strategyRaw, "Strategy");

  // ── STEP 3: Copywriter ──────────────────────
  onProgress?.("copywriter", "Escrevendo textos...", 45);
  const copyRaw = await callClaude({
    system: COPYWRITER_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildCopywriterPrompt({
          produto: vision.produto.nome_generico,
          preco: input.price,
          loja: input.storeName,
          estrategia: JSON.stringify(strategy),
          segmento: vision.segmento,
          atributos: JSON.stringify(vision.atributos_visuais),
        }),
      },
    ],
    maxTokens: 3000,
    temperature: 0.85,
  });
  const copyTexts = parseJSON<any>(copyRaw, "Copywriter");

  // ── STEP 4: Refiner ─────────────────────────
  onProgress?.("refiner", "Refinando copy...", 60);
  const refinerRaw = await callClaude({
    system: REFINER_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildRefinerPrompt({
          textos: JSON.stringify(copyTexts),
          estrategia: JSON.stringify(strategy),
        }),
      },
    ],
    maxTokens: 3000,
    temperature: 0.5,
  });
  const refined = parseJSON<any>(refinerRaw, "Refiner");

  // Use refined texts if available, else original
  const finalTexts = refined.textos_refinados || copyTexts;

  // ── STEP 5: Scorer ──────────────────────────
  onProgress?.("scorer", "Avaliando qualidade...", 75);
  const scoreRaw = await callClaude({
    system: SCORER_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildScorerPrompt({
          textos: JSON.stringify(finalTexts),
          estrategia: JSON.stringify(strategy),
          produto: vision.produto.nome_generico,
          preco: input.price,
        }),
      },
    ],
    temperature: 0.3,
  });
  const score = parseJSON<Omit<CampaignScore, "id" | "campaign_id">>(scoreRaw, "Scorer");

  // ── STEP 6: Compose output ──────────────────
  onProgress?.("composition", "Montando resultado...", 95);

  const output: Omit<CampaignOutput, "id" | "campaign_id"> = {
    vision_analysis: vision,
    strategy,
    headline_principal: finalTexts.headline_principal,
    headline_variacao_1: finalTexts.headline_variacao_1 || null,
    headline_variacao_2: finalTexts.headline_variacao_2 || null,
    instagram_feed: finalTexts.instagram_feed,
    instagram_stories: finalTexts.instagram_stories,
    whatsapp: finalTexts.whatsapp,
    meta_ads: finalTexts.meta_ads,
    hashtags: finalTexts.hashtags || [],
    product_image_clean_url: null,
    model_image_url: null,
    lifestyle_image_url: null,
    creative_feed_url: null,
    creative_stories_url: null,
    refinements: refined.refinements || [],
  };

  const durationMs = Date.now() - startTime;
  onProgress?.("done", "Pronto!", 100);

  return {
    vision,
    strategy,
    output,
    score,
    durationMs,
  };
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

/**
 * Parse JSON robusto — tenta extrair JSON mesmo com markdown wrapper
 */
function parseJSON<T>(raw: string, stepName: string): T {
  // Remove possíveis wrappers markdown
  let cleaned = raw.trim();

  // Remove ```json ... ```
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) {
    cleaned = jsonBlock[1].trim();
  }

  // Remove possíveis prefixos/sufixos não-JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error(`[Pipeline:${stepName}] Falha ao parsear JSON:`, cleaned.slice(0, 200));
    throw new Error(`Pipeline falhou no step ${stepName}: resposta inválida da IA`);
  }
}
