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
import type { ModelInfo } from "./pipeline";
import { callGeminiSafe } from "./gemini-error-handler";

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
  let r = parseInt(c.substring(0, 2), 16) / 255;
  let g = parseInt(c.substring(2, 4), 16) / 255;
  let b = parseInt(c.substring(4, 6), 16) / 255;
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
  /** 3 scene+styling prompts para o Gemini VTO (em inglês) */
  scene_prompts: [string, string, string];
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
        scene_prompts: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 3,
          description: "3 scene prompts narrativos detalhados EM INGLÊS para o Gemini VTO. Cada um com 4-7 frases descrevendo cenário, iluminação, pose, styling, câmera e mood.",
        },
        aspect_ratio: {
          type: "string",
          enum: ["9:16", "3:4", "4:5", "2:3"],
          description: "Aspect ratio sugerido para as imagens",
        },
        category: {
          type: "string",
          enum: ["tops", "bottoms", "dresses", "outerwear", "sets", "accessories"],
          description: "Categoria da peça",
        },
      },
      required: ["scene_prompts", "aspect_ratio", "category"],
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
  if (!result.vto_hints?.scene_prompts || result.vto_hints.scene_prompts.length < 3) {
    throw new Error("Gemini não gerou os 3 scene prompts para VTO");
  }

  // Garantir que temos exatamente 3 prompts (tupla)
  result.vto_hints.scene_prompts = [
    result.vto_hints.scene_prompts[0],
    result.vto_hints.scene_prompts[1],
    result.vto_hints.scene_prompts[2],
  ] as [string, string, string];

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

  // Traduzir dados da modelo para inglês (para os scene_prompts)
  const skinToneMap: Record<string, string> = {
    branca: "fair/light skin",
    morena_clara: "light-medium warm skin tone",
    morena: "medium-to-dark warm brown skin",
    negra: "deep rich dark skin",
  };
  const bodyMap: Record<string, string> = {
    normal: "standard/slim body frame",
    media: "standard average build",
    medio: "standard average male build",
    magra: "slim/petite body frame",
    plus_size: "plus-size curvy body with full figure",
    plus: "plus-size curvy body with full figure",
    robusto: "robust/heavy-set male build with broad shoulders and stocky frame",
    atletico: "athletic muscular build",
  };
  const hairColorMap: Record<string, string> = {
    preto: "jet black hair",
    castanho_escuro: "dark brown hair",
    castanho: "medium brown hair",
    ruivo: "auburn/red hair",
    loiro_escuro: "dark blonde hair",
    loiro: "blonde hair",
    platinado: "platinum blonde hair",
  };
  const hairTextureMap: Record<string, string> = {
    liso: "straight",
    ondulado: "wavy",
    cacheado: "curly",
    crespo: "coily/afro-textured",
  };
  const hairLengthMap: Record<string, string> = {
    joaozinho: "pixie-cut short",
    chanel: "bob-cut chin-length",
    ombro: "shoulder-length",
    medio: "medium-length past shoulders",
    longo: "long flowing",
  };
  const ageMap: Record<string, string> = {
    jovem_18_25: "young person (18-25)",
    adulta_26_35: "adult woman (26-35)",
    adulto_26_35: "adult man (26-35)",
    madura_36_50: "mature woman (36-50)",
    maduro_36_50: "mature man (36-50)",
  };

  // Construir descrição da modelo
  const modelParts: string[] = [];
  if (mi?.ageRange && ageMap[mi.ageRange]) modelParts.push(ageMap[mi.ageRange]);
  if (mi?.skinTone && skinToneMap[mi.skinTone]) modelParts.push(`with ${skinToneMap[mi.skinTone]}`);
  if (mi?.bodyType && bodyMap[mi.bodyType]) modelParts.push(bodyMap[mi.bodyType]);

  const hairParts: string[] = [];
  if (mi?.hairLength && hairLengthMap[mi.hairLength]) hairParts.push(hairLengthMap[mi.hairLength]);
  if (mi?.hairTexture && hairTextureMap[mi.hairTexture]) hairParts.push(hairTextureMap[mi.hairTexture]);
  if (mi?.hairColor && hairColorMap[mi.hairColor]) hairParts.push(hairColorMap[mi.hairColor]);
  if (hairParts.length > 0) modelParts.push(hairParts.join(" "));

  // Determinar gênero
  const isMale = mi?.gender === 'masculino' || mi?.gender === 'male' || mi?.gender === 'm';
  const genderLabel = isMale ? 'male model' : 'female model';

  const modelDescription = modelParts.length > 0
    ? `\n\n🧍 MODELO SELECIONAD${isMale ? 'O' : 'A'} PELA LOJISTA:\n${isMale ? 'O modelo' : 'A modelo'} na foto de referência é: ${genderLabel}, ${modelParts.join(", ")}.\nUse esses detalhes nos scene_prompts para que o Gemini VTO (que vai executar esses prompts) entenda exatamente QUE PESSOA reproduzir — isso melhora a fidelidade da identidade. Incorpore a cor de pele, cabelo e tipo de corpo NATURALMENTE na descrição da cena (ex: ${isMale ? '"warm golden-hour light complementing his deep skin tone", "his short textured dark hair styled naturally"' : '"warm golden-hour light complementing her deep skin tone", "her long wavy auburn hair flowing naturally"'}).`
    : "";

  return `Você é o Fashion Editorial Director mais experiente do Brasil — especializado em fotografia de e-commerce, campanhas para Instagram e virtual try-on com IA.

Sua MISSÃO é analisar fotos de peças de roupa e criar 3 cenários de fotos profissionais DISTINTOS que serão executados por IA de Virtual Try-On (outro modelo Gemini) — essa IA recebe a foto do produto + foto de uma modelo e gera uma imagem fotorrealista da modelo VESTINDO aquela peça.

O modelo VTO que vai executar seus prompts é um Gemini Pro com imagem nativa — ele entende prompts NARRATIVOS ricos. Quanto MAIS detalhado e visual o prompt, MELHOR o resultado. Ele compreende:
- Linguagem de fotografia profissional (lentes, iluminação, composição)
- Física de tecidos e caimento real
- Cenários e ambientes detalhados
- Expressões faciais e poses específicas
- Interação de luz com diferentes tons de pele

Você PRECISA gerar prompts que pareçam direções de um fotógrafo de moda sênior para sua equipe.${modelDescription}

REGRAS ABSOLUTAS PARA OS SCENE PROMPTS:

1. Cada prompt DEVE ser em INGLÊS e ter 4-7 frases detalhadas
2. Cada prompt DEVE incluir TODOS estes 6 elementos:
   a) CENÁRIO/AMBIENTE — onde a foto acontece (estúdio, rua, café, jardim, boutique...)
   b) ILUMINAÇÃO — tipo de luz, temperatura de cor, direção (softbox, golden hour, natural window light, ring light...)
   c) POSE E EXPRESSÃO — como a modelo está posicionada, expressão facial, linguagem corporal
   d) STYLING DO VESTIR — como a peça está vestida (tucked in, off-shoulder, sleeves rolled, jacket open...)
   e) CÂMERA — ângulo, enquadramento, profundidade de campo, estilo fotográfico
   f) MOOD/ATMOSFERA — sensação visual geral (editorial, aspiracional, fresh, warm, sophisticated...)

3. Os 3 prompts DEVEM usar o MESMO CENÁRIO/FUNDO — a campanha é uma SESSÃO DE FOTOS coesa:
   - O ambiente, fundo e iluminação DEVEM ser IDÊNTICOS nos 3 prompts
   - O que MUDA entre os 3 prompts: POSE, ÂNGULO DE CÂMERA e EXPRESSÃO FACIAL
   - Pense como uma sessão real: mesmo estúdio/locação, 3 poses diferentes
   - ❌ NUNCA mude o fundo entre os prompts (ex: P1 estúdio, P2 jardim = PROIBIDO)

4. 🚨 CADA PROMPT DEVE TER UMA POSE COMPLETAMENTE DIFERENTE — NUNCA repita a mesma pose!
   Use este banco de referência (escolha 3 poses DISTINTAS):
   - "standing with a relaxed three-quarter turn, one hand resting on her hip, chin slightly tilted up"
   - "walking mid-stride with natural arm swing, captured in motion with confidence"
   - "sitting on a tall stool with legs crossed elegantly, leaning slightly forward"
   - "standing straight front-facing with arms at sides, calm neutral editorial expression"
   - "leaning against a wall with one shoulder, arms loosely crossed, playful half-smile"
   - "turning to look over her shoulder (back view showing garment construction), face in profile"
   - "crouching slightly with one knee forward, dynamic fashion-forward angle"
   - "hands in jacket/pants pockets, weight shifted to one leg, relaxed street-style stance"
   - "one arm raised adjusting hair, showcasing the garment's sleeve and silhouette"
   - "seated on the ground with knees up, casual lifestyle feel"
   - "stepping off a curb or stair, mid-movement with fabric catching air"
   - "arms behind back with clasped hands, chest open — elegant confident posture"
   Adapte a pose à peça: vestido longo → pose que mostre caimento; jaqueta → pose que mostre estrutura.

5. Se a peça é um CONJUNTO (blusa+saia, top+calça), CADA prompt deve mencionar TODAS as peças

6. 📏 ENQUADRAMENTO OBRIGATÓRIO: CORPO INTEIRO (FULL BODY)
   - TODOS os 3 prompts DEVEM especificar "full-body shot from head to feet/shoes"
   - A modelo deve aparecer DOS PÉS À CABEÇA — NUNCA corte na cintura ou joelho
   - Inclua sapatos/sandálias/pés no enquadramento
   - Aspect ratio 9:16 (formato Instagram Stories), orientação retrato
   - ❌ PROIBIDO: meio corpo, busto, close-up, corte na cintura

7. 👠 SAPATOS E CALÇADOS — OBRIGATÓRIO EM CADA PROMPT:
   - Cada scene_prompt DEVE mencionar sapato/sandália/tênis
   - Harmonize COR do calçado com a paleta do look
   - ❌ PROIBIDO: pés descalços (exceto moda praia)

8. NUNCA escreva prompts curtos — CADA prompt deve ser narrativo e detalhado

9. ⛔ PROIBIÇÕES ABSOLUTAS nos scene_prompts (adicione como negative constraints):
   - Mudança de cor de cabelo (manter EXATAMENTE como referência)
   - Dedos extras, dedos fundidos, dedos faltando
   - Distorções anatômicas (membros extras, proporções erradas)
   - Mudança de cor do tecido (manter EXATAMENTE como na foto do produto)
   - Texto ou logo INVENTADO pela IA que NÃO existe na peça original (se o produto tem logo da marca bordado/estampado, PRESERVE fielmente)
   - ✅ PRESERVAR: logos, monogramas, bordados, estampas de marca que são PARTE DO DESIGN da peça — esses são elementos intencionais do produto
   - Roupas flutuando sem conexão com o corpo
   - Comprimento de manga/barra diferente do original

EXEMPLO DE PROMPT EXCELENTE ✅:
"Full-body fashion photograph from head to feet in a bright, airy loft studio with floor-to-ceiling windows casting soft natural light from the left. The model walks mid-stride with natural arm swing, captured in fluid motion with confidence, her long wavy hair bouncing softly. The blouse is neatly tucked into the high-waisted trousers, belt cinched at the smallest point of the waist. She wears nude pointed-toe heels visible in the frame. Shot with an 85mm portrait lens at f/2.8, full-body framing with 10% headroom and feet visible at the bottom edge. The overall mood is polished, modern editorial — think Vogue Brazil meets everyday elegance. ABSOLUTE PROHIBITIONS: no hair color changes, no extra fingers, no fabric color shifts from original product."

EXEMPLO DE PROMPT RUIM ❌:
"Studio setting with good lighting. Model stands confidently wearing the garment."

IMPORTANTE: NÃO gere dicas de postagem, legendas ou copy.
O copy é gerado por um módulo separado (Claude Sonnet 4.6).
Foque APENAS na análise visual e nos scene prompts para VTO.`;
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
    sceneInstruction = `\n\n🎬 CENÁRIO DEFINIDO: ${scene.name}\n${scene.description}.\n${scene.details}\nTODOS os 3 prompts DEVEM usar este MESMO cenário como fundo.\nVarie apenas POSE e ÂNGULO DE CÂMERA entre os 3 prompts — o ambiente e iluminação são IGUAIS.`;
  } else {
    sceneInstruction = `\n\n🎬 CENÁRIO (NENHUM SELECIONADO — ESCOLHA AUTOMÁTICA):\nA lojista NÃO selecionou um cenário. Você DEVE:\n1. Escolher UM único cenário que melhor combine com a peça (estúdio clean, urbano, lifestyle, etc)\n2. Usar esse MESMO cenário nos 3 prompts (scene_prompts[0], [1] e [2])\n3. O ambiente, fundo e iluminação devem ser IDÊNTICOS nos 3 prompts\n4. Varie apenas POSE e ÂNGULO DE CÂMERA entre os 3 prompts\n5. ❌ PROIBIDO: usar cenários diferentes entre os prompts`;
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

Gere a análise visual completa e os 3 scene prompts narrativos em inglês.
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
