/**
 * CriaLook Gemini Analyzer v7 — Gemini 3.1 Pro Preview
 *
 * Analista visual da pipeline (FOCO: visão + VTO prompts).
 * Usa o modelo mais avançado do Google para:
 * 1. Análise visual do produto (cor, tecido, modelagem, caimento)
 * 2. 3 scene prompts narrativos ULTRA-DETALHADOS para o Gemini VTO
 *
 * ⚠️ Copy/dicas de postagem agora são gerados pelo Claude Sonnet 4.6
 *    via sonnet-copywriter.ts (pipeline híbrido v7).
 *
 * Características:
 * - Structured Output nativo (JSON Schema) → zero parsing errors
 * - Thinking mode → raciocínio profundo sobre moda e composição
 * - 1M tokens de contexto → nunca trunca
 * - Mesma família do VTO (Gemini) → prompts mais alinhados
 * - Image understanding nativo com visão superior
 */

import { GoogleGenAI } from "@google/genai";
import { callGeminiSafe } from "./gemini-error-handler";
import {
  type ModelInfo,
  AGE_MAP,
  BODY_MAP,
  HAIR_COLOR_MAP,
  HAIR_LENGTH_MAP,
  HAIR_TEXTURE_MAP,
  POSE_BANK,
  POSE_BANK_TOTAL,
  SKIN_TONE_MAP,
  isMaleGender,
} from "./identity-translations";

// ═══════════════════════════════════════
// Exported helpers (used by pipeline for backdrop injection)
// ═══════════════════════════════════════

export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Generates a DETERMINISTIC textured backdrop description based on brand color.
 * Using photography language (per VTO Expert Gemini skill) to anchor the model
 * on an identical, repeatable backdrop across all 3 photos.
 *
 * EXPORTED so the pipeline can inject this PROGRAMMATICALLY into each scene_prompt,
 * guaranteeing 100% identical text across all 3 VTO calls.
 */
export function getTexturedBackdropPrompt(hex: string): string {
  const { h, s, l } = hexToHSL(hex);
  const rgb = hexToRgb(hex);

  let texture: string;
  let lightSetup: string;

  if (l > 85) {
    texture = `smooth matte seamless paper backdrop in hex ${hex} (RGB ${rgb})`;
    lightSetup = "professional three-point softbox lighting with feather-edge fill from both sides, creating even shadow-free illumination on the backdrop";
  } else if (l < 20) {
    texture = `rich matte velvet fabric backdrop in deep hex ${hex} (RGB ${rgb}), with a subtle centered spotlight creating a gentle radial luminance falloff — center 8% brighter than edges`;
    lightSetup = "dramatic beauty dish from directly above at 45 degrees, with minimal fill, creating moody editorial contrast";
  } else if (l > 65 && s < 40) {
    texture = `soft matte painted wall in hex ${hex} (RGB ${rgb}), with a very subtle warm vignette naturally darkening 4% toward the corners`;
    lightSetup = "large octabox key light from front-right at 30 degrees, gentle fill reflector from left, creating soft dimensional wraparound light";
  } else if (s > 35 && (h < 60 || h > 300)) {
    texture = `fine matte plaster wall in hex ${hex} (RGB ${rgb}), with a subtle radial light gradient — center 5% brighter, naturally darkening toward corners. The surface has a refined matte texture like Venetian stucco, smooth but not flat`;
    lightSetup = "professional beauty dish key light from above-right at 40 degrees, with a silver reflector fill from lower-left, creating soft wraparound illumination";
  } else if (s > 35 && h >= 60 && h <= 180) {
    texture = `smooth matte concrete wall in hex ${hex} (RGB ${rgb}), with a subtle directional gradient — left side 4% brighter than right, creating natural depth. The surface has a fine sand-finish texture`;
    lightSetup = "directional softbox key light from upper-left at 35 degrees, no fill, creating clean editorial side-lit illumination";
  } else if (s > 35 && h > 180 && h <= 300) {
    texture = `smooth matte brushed plaster wall in hex ${hex} (RGB ${rgb}), with a centered soft spotlight creating 5% brighter center and natural edge darkening. The surface has a fine eggshell finish`;
    lightSetup = "large parabolic softbox from front-center at 40 degrees above, with subtle rim light from behind, creating dimensional studio illumination";
  } else {
    texture = `smooth matte seamless backdrop in hex ${hex} (RGB ${rgb}), with a very subtle top-to-bottom gradient — top 3% lighter than bottom for natural depth`;
    lightSetup = "even three-point lighting setup with main softbox from front-right, fill from front-left, and hair light from above-behind";
  }

  return `BACKDROP SPECIFICATION (MUST BE IDENTICAL IN ALL 3 PHOTOS):\n${texture}.\nLIGHTING: ${lightSetup}.\nThe background color MUST be EXACTLY hex ${hex} — do NOT shift, approximate, or reinterpret the hue.\n❌ FORBIDDEN: changing the backdrop color, adding props/objects to the background, using a completely different backdrop style between photos.`;
}

// ═══════════════════════════════════════
// Tipos de retorno (tipos de retorno do analyzer)
// ═══════════════════════════════════════

export interface GeminiAnalise {
  tipo_peca: string;
  pecas: string[];
  tecido: string;
  cor_principal: { nome: string; hex: string };
  cores_secundarias: { nome: string; hex: string }[];
  modelagem: string;
  caimento: string;
  detalhes: string[];
  estacao: string;
  mood: string;
  publico: string;
}

export interface GeminiVTOHint {
  /** Único índice do POSE_BANK (0..POSE_BANK_TOTAL-1). */
  pose_index: number;
  /** Scene+styling prompt para o Gemini VTO (em inglês). NÃO descreve cabelo/pele/olhos/idade. */
  scene_prompts: string[];
  /** Aspect ratio sugerido */
  aspect_ratio: "9:16" | "3:4" | "4:5" | "2:3";
  /** Tipo de peça para categorização */
  category: string;
}

// ⚠️ GeminiDicasPostagem removido — copy agora é gerado pelo Sonnet (sonnet-copywriter.ts)
// Tipos legados re-exportados para backward compat
export type { SonnetDicasPostagem as GeminiDicasPostagem } from "./sonnet-copywriter";
export type { SonnetDicaLegenda as GeminiDicaLegenda } from "./sonnet-copywriter";

export interface GeminiAnalyzerResult {
  analise: GeminiAnalise;
  vto_hints: GeminiVTOHint;
  /** Token usage real da API (internal — não faz parte do JSON schema) */
  _usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ═══════════════════════════════════════
// Singleton GoogleGenAI (compartilhado com VTO)
// ═══════════════════════════════════════

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY (ou GEMINI_API_KEY) não configurada");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// ═══════════════════════════════════════
// Config
// ═══════════════════════════════════════

const MODEL = "gemini-3.1-pro-preview";

// ═══════════════════════════════════════
// Input (mesma interface do analyzer original)
// ═══════════════════════════════════════

export interface AnalyzerInput {
  productImageBase64: string;
  productMediaType?: "image/jpeg" | "image/png" | "image/webp";
  extraImages?: { base64: string; mediaType?: string }[];
  price?: string;
  bodyType?: "normal" | "plus";
  backgroundType?: string;
  storeName?: string;

  modelInfo?: ModelInfo;

  /**
   * Índice do POSE_BANK que NÃO pode ser escolhido nesta campanha — pipeline
   * passa o resultado de `getStreakBlockedPose(history)`. Só é não-null
   * quando a mesma pose veio em 3 campanhas seguidas, forçando troca.
   */
  blockedPoseIndex?: number | null;
}

// ═══════════════════════════════════════
// JSON Schema para Structured Output
// ═══════════════════════════════════════

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    analise: {
      type: "object",
      description: "Análise visual detalhada da peça de roupa",
      properties: {
        tipo_peca: { type: "string", description: "Tipo da peça: blusa, saia, calca, vestido, macacao, jaqueta, conjunto, acessorio" },
        pecas: { type: "array", items: { type: "string" }, description: "Nomes descritivos de cada peça (ex: 'Blusa cropped com manga bufante')" },
        tecido: { type: "string", description: "Descrição detalhada do tecido (ex: 'crepe de viscose com toque sedoso')" },
        cor_principal: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Nome preciso da cor (ex: 'azul petróleo')" },
            hex: { type: "string", description: "Código hex da cor (ex: '#1A5276')" },
          },
          required: ["nome", "hex"],
        },
        cores_secundarias: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              hex: { type: "string" },
            },
            required: ["nome", "hex"],
          },
        },
        modelagem: { type: "string", description: "Tipo de modelagem: ajustado, oversized, flare, reto, evasê, A-line, wrap, bodycon" },
        caimento: { type: "string", description: "Tipo de caimento: fluido, estruturado, justo, solto" },
        detalhes: { type: "array", items: { type: "string" }, description: "Detalhes construtivos como botões, gola, acabamentos" },
        estacao: { type: "string", description: "Estação ideal: primavera/verão, outono/inverno, meia-estação" },
        mood: { type: "string", description: "Mood/vibe visual (ex: 'romântico casual', 'urbano moderno')" },
        publico: { type: "string", description: "Público-alvo (ex: 'mulheres 20-35 classe B')" },
      },
      required: ["tipo_peca", "pecas", "tecido", "cor_principal", "cores_secundarias", "modelagem", "caimento", "detalhes", "estacao", "mood", "publico"],
    },
    vto_hints: {
      type: "object",
      description: "Hints para o gerador de imagem VTO (Virtual Try-On)",
      properties: {
        pose_index: {
          type: "integer",
          minimum: 0,
          maximum: POSE_BANK_TOTAL - 1,
          description: `Índice único do POSE_BANK (0-${POSE_BANK_TOTAL - 1}) que melhor combina com a peça. Todas as poses do bank são estáveis — escolha pela peça, não por tier.`,
        },
        scene_prompts: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 1,
          description:
            "Array com EXATAMENTE 1 scene prompt narrativo EM INGLÊS para o Gemini VTO. PROIBIDO descrever cabelo/pele/olhos/idade — esses traços vêm fixos do IDENTITY LOCK. Foque em CENÁRIO, ILUMINAÇÃO, ÂNGULO DE CÂMERA, STYLING DO VESTIR e MOOD. A pose vem do pose_index acima — não duplique a pose no texto.",
        },
        aspect_ratio: {
          type: "string",
          enum: ["9:16", "3:4", "4:5", "2:3"],
          description: "Aspect ratio sugerido para a imagem",
        },
        category: {
          type: "string",
          enum: ["tops", "bottoms", "dresses", "outerwear", "sets", "accessories"],
          description: "Categoria da peça",
        },
      },
      required: ["pose_index", "scene_prompts", "aspect_ratio", "category"],
    },
    // ⚠️ dicas_postagem removido — agora gerado pelo Sonnet Copywriter
  },
  required: ["analise", "vto_hints"],
};

// ═══════════════════════════════════════
// Função principal
// ═══════════════════════════════════════

/**
 * Chama Gemini 3.1 Pro para análise visual do produto.
 * Retorna: análise + hints para Gemini VTO + dicas de postagem.
 */
export async function analyzeWithGemini(input: AnalyzerInput): Promise<GeminiAnalyzerResult> {
  const ai = getAI();
  const startTime = Date.now();

  // Montar parts (imagens + texto)
  const parts: any[] = [];

  // Imagem principal do produto
  parts.push({
    inlineData: {
      mimeType: input.productMediaType || "image/jpeg",
      data: input.productImageBase64,
    },
  });

  // Imagens extras
  if (input.extraImages?.length) {
    for (const img of input.extraImages) {
      parts.push({
        inlineData: {
          mimeType: img.mediaType || "image/jpeg",
          data: img.base64,
        },
      });
    }
  }

  // Prompt de instrução
  parts.push({
    text: buildUserPrompt(input),
  });

  const response = await callGeminiSafe(
    () => ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: buildSystemPrompt(input),
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA as any,
        thinkingConfig: {
          thinkingBudget: 2048,
        },
        // Task estruturada (classificar peça + escolher poses + extrair cores).
        // Default ~1.0 produz variação demais pra schema enforcement; 0.3
        // estabiliza escolhas mantendo alguma variação saudável. topP 0.85
        // corta cauda longa de tokens improváveis = reduz alucinação rara.
        temperature: 0.3,
        topP: 0.85,
      },
    }),
    { label: "Gemini Analyzer", maxRetries: 1, backoffMs: 3000 }
  );

  const durationMs = Date.now() - startTime;

  // Extrair texto da resposta
  const text = response.text;
  if (!text) {
    throw new Error("Gemini 3.1 Pro não retornou resposta");
  }

  // Parse JSON — structured output garante JSON válido
  let result: GeminiAnalyzerResult;
  try {
    result = JSON.parse(text);
  } catch {
    // Fallback: tentar reparar (raro com structured output)
    console.warn("[Gemini Analyzer] JSON inválido, tentando reparar...");
    result = repairAndParse(text);
  }

  // Validação de integridade
  if (!result.analise?.tipo_peca) {
    throw new Error("Gemini retornou análise incompleta — tente outra foto");
  }
  if (!result.vto_hints?.scene_prompts || result.vto_hints.scene_prompts.length < 1) {
    throw new Error("Gemini não gerou o scene prompt para VTO");
  }
  if (typeof result.vto_hints?.pose_index !== "number") {
    throw new Error("Gemini não retornou pose_index");
  }

  // Garantir que temos exatamente 1 prompt (sliciado caso Gemini gere a mais)
  result.vto_hints.scene_prompts = [result.vto_hints.scene_prompts[0]];

  // Tokens de uso — Gemini retorna no candidato
  const usage = response.usageMetadata;
  console.log(
    `[Gemini 3.1 Pro] ✅ Análise em ${durationMs}ms | input=${usage?.promptTokenCount ?? "?"} output=${usage?.candidatesTokenCount ?? "?"} tokens | peça: ${result.analise.tipo_peca}`
  );

  // Attach real token usage para o pipeline usar no cost logger
  result._usageMetadata = usage ? {
    promptTokenCount: (usage as any).promptTokenCount || 0,
    candidatesTokenCount: (usage as any).candidatesTokenCount || 0,
    totalTokenCount: (usage as any).totalTokenCount || 0,
  } : undefined;

  return result;
}

// ═══════════════════════════════════════
// System Prompt — dinâmico com dados da modelo
// ═══════════════════════════════════════

function buildSystemPrompt(input: AnalyzerInput): string {
  const mi = input.modelInfo;

  // Construir descrição da modelo APENAS pra contexto do Analyzer.
  // ⚠️ Por regra (PARTE 2 abaixo), Analyzer NÃO descreve cabelo/pele/olhos
  // nos scene_prompts — esses traços vêm fixos via IDENTITY LOCK no VTO.
  const modelParts: string[] = [];
  if (mi?.ageRange && AGE_MAP[mi.ageRange]) modelParts.push(AGE_MAP[mi.ageRange]);
  if (mi?.skinTone && SKIN_TONE_MAP[mi.skinTone]) modelParts.push(`with ${SKIN_TONE_MAP[mi.skinTone]}`);
  if (mi?.bodyType && BODY_MAP[mi.bodyType]) modelParts.push(BODY_MAP[mi.bodyType]);

  const hairParts: string[] = [];
  if (mi?.hairLength && HAIR_LENGTH_MAP[mi.hairLength]) hairParts.push(HAIR_LENGTH_MAP[mi.hairLength]);
  if (mi?.hairTexture && HAIR_TEXTURE_MAP[mi.hairTexture]) hairParts.push(HAIR_TEXTURE_MAP[mi.hairTexture]);
  if (mi?.hairColor && HAIR_COLOR_MAP[mi.hairColor]) hairParts.push(HAIR_COLOR_MAP[mi.hairColor].label);
  if (hairParts.length > 0) modelParts.push(hairParts.join(" "));

  const isMale = isMaleGender(mi?.gender);
  const genderLabel = isMale ? "male model" : "female model";

  const modelContext = modelParts.length > 0
    ? `\n\n🧍 MODELO SELECIONAD${isMale ? "O" : "A"} PELA LOJISTA (apenas para seu contexto — NÃO descreva esses traços nos scene_prompts):
${isMale ? "O modelo" : "A modelo"} na foto de referência é: ${genderLabel}, ${modelParts.join(", ")}.

⚠️ Esses traços de identidade (cabelo, pele, olhos, idade) são travados pelo IDENTITY LOCK do gerador VTO. Você NÃO precisa repeti-los — de fato, MENCIONAR cabelo/pele/olhos no scene_prompt CRIA CONFLITO entre o IDENTITY LOCK e a descrição da cena, gerando alucinação. Foque o scene_prompt em CENÁRIO, ILUMINAÇÃO, ÂNGULO DE CÂMERA, STYLING DO VESTIR e MOOD.`
    : "";

  // Pose bank renderizado a partir do helper compartilhado — fonte única.
  const poseBankText = POSE_BANK.map(
    (p, i) => `   [${i}] ${p}`,
  ).join("\n");

  // Bloqueio por streak: o histórico mostrou a mesma pose em 3 campanhas
  // seguidas — o pipeline força mudança nessa próxima geração.
  const blockRule = (typeof input.blockedPoseIndex === "number")
    ? `\n\n🚫 ÍNDICE BLOQUEADO NESTA CAMPANHA (foi usado nas 3 últimas seguidas):
[${input.blockedPoseIndex}]
ESCOLHA OBRIGATORIAMENTE outro índice. Pegue o que melhor combina com a peça entre os índices restantes (0-${POSE_BANK_TOTAL - 1}).`
    : "";

  return `Você é o Fashion Editorial Director mais experiente do Brasil — especializado em fotografia de e-commerce, campanhas para Instagram e virtual try-on com IA.

Sua MISSÃO é analisar a foto de uma peça de roupa e definir 1 cenário de foto profissional que será executado por IA de Virtual Try-On (outro modelo Gemini Pro Image). Essa IA recebe foto da peça + foto da modelo e gera a imagem fotorrealista da modelo VESTINDO a peça.

O VTO entende prompts NARRATIVOS ricos. Quanto MAIS detalhado e visual o prompt, MELHOR o resultado.${modelContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 1 — POSE (campo pose_index)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Você DEVE escolher EXATAMENTE 1 índice do POSE_BANK abaixo (0-${POSE_BANK_TOTAL - 1}). Todas as poses são estáveis — escolha a que MELHOR valoriza a peça.

POSE_BANK:
${poseBankText}${blockRule}

Como escolher:
• Vestido/saia longa → priorize poses que mostrem caimento (3, 7)
• Jaqueta/blazer estruturado → poses que mostrem ombros/silhueta (3, 4)
• Look casual/streetwear → poses com atitude (1, 4)
• Conjunto/peça com detalhe lateral → 3/4 turn (0, 5, 6)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 2 — SCENE PROMPT (campo scene_prompts, array de 1 item)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O scene_prompt é um texto narrativo em INGLÊS de 4-7 frases. A POSE já vem do pose_index — NÃO repita a pose textualmente, foque nos OUTROS elementos:

a) CENÁRIO/AMBIENTE — onde a foto acontece (estúdio, rua, café, jardim, boutique...)
b) ILUMINAÇÃO — tipo de luz, temperatura, direção (softbox, golden hour, natural window light...)
c) STYLING DO VESTIR — como a peça é vestida (tucked in, off-shoulder, sleeves rolled, jacket open...)
d) CÂMERA — ângulo, enquadramento, profundidade de campo, lente
e) MOOD/ATMOSFERA — sensação visual (editorial, aspiracional, fresh, sophisticated...)

🚫 PROIBIDO no scene_prompt mencionar:
- Cor de cabelo, textura de cabelo, comprimento de cabelo
- Tom de pele, cor dos olhos, idade aparente
Esses estão no IDENTITY LOCK do VTO. Mencionar aqui causa CONFLITO (ex: IDENTITY LOCK diz "dark brown hair", scene diz "her long blonde hair flowing" → IA aluciona).

✅ PERMITIDO no scene_prompt: como a luz interage com a pessoa SEM identificar traço de cabelo/pele/olhos (ex: "warm golden-hour light wraps softly around her silhouette", "soft window light catches the fabric", "edge light defines her profile against the dark backdrop").

REGRAS DO PROMPT:
1. Cada prompt deve mencionar SAPATO/CALÇADO (não pés descalços, exceto moda praia)
2. Cada prompt deve especificar "full-body shot from head to feet/shoes"
3. Aspect ratio 9:16 (Instagram Stories), orientação retrato
4. Se a peça é CONJUNTO (blusa+saia, top+calça), o prompt menciona TODAS as peças
5. 💠 DENIM/JEANS: especifique o WASH EXATO ("dark raw indigo denim", "medium stonewash", "light acid-wash", "jet black denim") — jeans é o tecido que mais sofre color shift
6. PRESERVAR logos/bordados/estampas que são PARTE DO DESIGN — não inventar nem remover

EXEMPLO DE SCENE_PROMPT EXCELENTE ✅ (com pose já definida em pose_index=2):
"Full-body fashion photograph in a bright, airy loft studio with floor-to-ceiling windows casting soft diffused natural light from the left at a 30-degree angle. The garment is neatly tailored, blouse tucked into the high-waisted trousers with a thin belt cinched at the natural waist, sleeves left flowing. She wears nude pointed-toe heels visible in the frame. Shot with an 85mm portrait lens at f/2.8, full-body framing with 10% headroom above and feet visible at the bottom edge. Mood: polished, modern editorial — Vogue Brazil meets everyday elegance."

EXEMPLO RUIM ❌ (descreve cabelo, viola PARTE 2):
"Studio with light. The model with long blonde hair stands confidently wearing the garment."

EXEMPLO RUIM ❌ (descreve pose — pose vem do pose_index):
"Walking mid-stride with arm swing in a sunlit studio."

IMPORTANTE: NÃO gere dicas de postagem, legendas ou copy. O copy é gerado por outro módulo. Foque APENAS na análise visual + pose_index + scene_prompts.`;
}

// ═══════════════════════════════════════
// User Prompt builder
// ═══════════════════════════════════════

function buildUserPrompt(input: AnalyzerInput): string {
  const extras: string[] = [];
  if (input.price) extras.push(`Preço de venda: R$ ${input.price}`);
  if (input.storeName) extras.push(`Loja: ${input.storeName}`);


  // Body type context
  if (input.bodyType === "plus" || input.modelInfo?.bodyType === "plus_size" || input.modelInfo?.bodyType === "plus") {
    extras.push("🔴 ATENÇÃO — Modelo é plus size. Os prompts devem valorizar o corpo curvilíneo com poses e ângulos flattering");
  }

  // ── Helpers: delegate to module-level exported functions ──
  // (kept as local aliases for backward compat within buildUserPrompt)
  const _hexToRgb = hexToRgb;


  // ── Scene context (cenário selecionado) ──
  const SCENE_MOODS: Record<string, { name: string; description: string; details: string }> = {
    branco: {
      name: "Estúdio Branco Minimalista",
      description: "Clean minimalist white studio with pure seamless white cyclorama background",
      details: "Soft, even professional lighting. No shadows on background. No visible lighting equipment. E-commerce product-focus aesthetic."
    },
    estudio: {
      name: "Estúdio Profissional",
      description: "Professional fashion photography studio with soft directional lighting",
      details: "Even lighting sculpting the subject naturally. Neutral gray or gradient backdrop. Sharp, editorial feel. No visible lighting equipment, softboxes, umbrellas, or reflectors."
    },
    lifestyle: {
      name: "Lifestyle / Casual",
      description: "Casual everyday setting — modern café interior, cozy living room, or sunlit breakfast table",
      details: "Warm ambient natural light filtering through windows. Lived-in, relatable atmosphere. Shallow depth of field blurring the background props."
    },
    urbano: {
      name: "Urbano / Street",
      description: "Dynamic urban street setting — grafitti walls, concrete architecture, modern glass buildings, or trendy neighborhood",
      details: "Dramatic directional light — golden hour side-lighting or neon reflections. High contrast, fashion-forward street style photography."
    },
    natureza: {
      name: "Natureza / Outdoor",
      description: "Beautiful natural outdoor setting — botanical garden, sun-dappled forest trail, beach promenade, or flower field",
      details: "Gorgeous golden-hour backlight creating a warm halo. Lush green or earth-toned organic background. Dreamy lens flare touches."
    },
    interior: {
      name: "Interior Elegante",
      description: "Sophisticated upscale interior — luxury hotel lobby, modern apartment with designer furniture, or art gallery",
      details: "Warm ambient lighting mixing with focused spots. Marble, wood, and neutral tones in background. Aspirational upper-class atmosphere."
    },
    boutique: {
      name: "Boutique Fashion",
      description: "Chic fashion boutique interior with curated clothing racks, mirrors, and tasteful displays",
      details: "Warm pin-spot lighting highlighting the subject against softly blurred racks. Intimate, feminine shopping atmosphere."
    },
    praia: {
      name: "Praia Paradisíaca",
      description: "Stunning tropical beach with turquoise ocean waves, fine white sand, and palm trees",
      details: "Warm golden sunlight with coastal breeze atmosphere. Model walks naturally along the shoreline. Shallow depth of field on the ocean background. Bright, aspirational summer mood."
    },
    noturno: {
      name: "Noturno / Night Editorial",
      description: "Dramatic urban nighttime setting with city lights, wet street reflections, and cinematic atmosphere",
      details: "Moody low-key lighting mixing warm streetlamps with cool ambient city glow. Bokeh city lights in background. High contrast editorial night photography with dramatic shadows."
    },
    tropical: {
      name: "Tropical / Exótico",
      description: "Lush tropical paradise with exotic monstera leaves, palm fronds, and vibrant green foliage",
      details: "Dappled warm sunlight filtering through the canopy creating light patterns. Rich saturated greens and golden tones. Organic, immersive botanical atmosphere."
    },
    minimalista: {
      name: "Minimalista Contemporâneo",
      description: "Ultra-clean minimalist backdrop with subtle concrete or plaster texture and neutral gray tones",
      details: "Professional even front lighting with no harsh shadows. Architectural geometric lines. Contemporary gallery aesthetic. Less is more — the garment is the hero."
    },
    luxo: {
      name: "Luxo / High-End",
      description: "Opulent luxury hotel lobby, upscale restaurant, or five-star resort interior",
      details: "Warm sophisticated ambient lighting mixing with focused accent lights. Marble floors, gold accents, elegant chandeliers, velvet textures. Aspirational wealth and refinement."
    },
    rural: {
      name: "Rural / Country",
      description: "Beautiful countryside setting with golden wheat fields, rolling green hills, and rustic wooden elements",
      details: "Warm golden hour sunlight creating long shadows. Pastoral tranquil atmosphere with organic earth tones. Fashion meets nature — effortless rural elegance."
    },
    neon: {
      name: "Neon / Cyberpunk",
      description: "Vibrant neon-lit environment with glowing pink, blue, and purple neon signs and colorful reflections",
      details: "Bold colorful neon light painting the subject with vivid hues. Modern cyberpunk or nightclub aesthetic. High-fashion editorial with saturated neon color palette."
    },
    arte: {
      name: "Galeria de Arte",
      description: "Contemporary art gallery interior with white walls, bold abstract paintings or installations",
      details: "Dramatic directional track lighting creating gallery atmosphere. Polished concrete floor. The model becomes part of the art — sophisticated, intellectual, avant-garde."
    },
  };

  let sceneInstruction = "";
  const bgType = input.backgroundType || "";

  if (bgType && SCENE_MOODS[bgType]) {
    const scene = SCENE_MOODS[bgType];
    sceneInstruction = `\n\n🎬 CENÁRIO DEFINIDO: ${scene.name}\n${scene.description}.\n${scene.details}\nUse este cenário como fundo no scene_prompt.`;
  } else {
    sceneInstruction = `\n\n🎬 CENÁRIO (NENHUM SELECIONADO — ESCOLHA AUTOMÁTICA):\nA lojista NÃO selecionou um cenário. Escolha UM cenário que melhor combine com a peça (estúdio clean, urbano, lifestyle, etc) e use no scene_prompt.`;
  }

  // ── Model description for prompts ──
  let modelInstruction = "";
  if (input.modelInfo) {
    const mi = input.modelInfo;
    const parts: string[] = [];
    if (mi.pose) parts.push(`Pose atual na foto de referência: "${mi.pose}"`);
    if (mi.style) {
      const styleMap: Record<string, string> = {
        casual_natural: "estilo casual/natural",
        elegante: "estilo elegante/sofisticado",
        esportivo: "estilo esportivo/athleisure",
        urbano: "estilo urbano/street",
      };
      parts.push(`Estilo visual preferido: ${styleMap[mi.style] || mi.style}`);
    }
    if (parts.length > 0) {
      modelInstruction = `\n\n👤 CONTEXTO DA MODELO:\n${parts.join("\n")}`;
    }
  }

  const numPhotos = 1 + (input.extraImages?.length || 0);
  const photoDesc =
    numPhotos > 1
      ? `estas ${numPhotos} fotos do produto`
      : "esta foto do produto de moda";

  return `Analise ${photoDesc}.${extras.length > 0 ? "\n\nINFO DA LOJISTA:\n" + extras.join("\n") : ""}${sceneInstruction}${modelInstruction}

Gere a análise visual completa, escolha 1 pose_index e produza 1 scene prompt narrativo em inglês (campo scene_prompts como array de 1 item).
NÃO gere dicas de postagem — o copy é gerado por outro modelo.`;
}

// ═══════════════════════════════════════
// Parser JSON de fallback (raro com structured output)
// ═══════════════════════════════════════

function repairAndParse(raw: string): GeminiAnalyzerResult {
  let cleaned = raw.trim();

  // Remove ```json ... ```
  const jsonBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) cleaned = jsonBlock[1].trim();

  // Extrair primeiro objeto JSON completo
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    let repaired = cleaned;

    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';

    const opens = (repaired.match(/[{[]/g) || []).length;
    const closes = (repaired.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      const lastOpen = Math.max(repaired.lastIndexOf("{"), repaired.lastIndexOf("["));
      repaired += repaired[lastOpen] === "{" ? "}" : "]";
    }

    try {
      return JSON.parse(repaired);
    } catch {
      console.error("[Gemini Analyzer] Falha ao parsear JSON:", cleaned.slice(0, 500));
      throw new Error("Gemini retornou resposta inválida — tente novamente");
    }
  }
}
