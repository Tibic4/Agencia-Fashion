/**
 * CriaLook Sonnet Analyzer v4
 *
 * Substitui o Opus para análise do produto.
 * Mais rápido e barato — Sonnet 4 é suficiente para análise visual.
 * NÃO gera prompts de imagem (FASHN não precisa) — foca em:
 * 1. Análise da peça (para display no frontend)
 * 2. Dicas de postagem (para a lojista)
 * 3. Styling hints para o FASHN (prompt de estilo)
 */

import Anthropic from "@anthropic-ai/sdk";

// ═══════════════════════════════════════
// Tipos de retorno
// ═══════════════════════════════════════

export interface SonnetAnalise {
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

export interface SonnetFashnHint {
  /** 3 styling prompts para o FASHN product-to-model */
  styling_prompts: [string, string, string];
  /** Aspect ratio sugerido */
  aspect_ratio: "3:4" | "4:5" | "2:3";
  /** Tipo de peça para categorização */
  category: string;
}

export interface SonnetDicaLegenda {
  foto: number;
  plataforma: string;
  legenda: string;
  hashtags?: string[];
  dica?: string;
}

export interface SonnetDicasPostagem {
  melhor_dia: string;
  melhor_horario: string;
  sequencia_sugerida: string;
  legendas: SonnetDicaLegenda[];
}

export interface SonnetAnalyzerResult {
  analise: SonnetAnalise;
  fashn_hints: SonnetFashnHint;
  dicas_postagem: SonnetDicasPostagem;
}

// ═══════════════════════════════════════
// Singleton Anthropic client
// ═══════════════════════════════════════

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ═══════════════════════════════════════
// Input
// ═══════════════════════════════════════

export interface AnalyzerInput {
  /** Base64 da foto principal do produto (sem prefixo data:) */
  productImageBase64: string;
  productMediaType?: "image/jpeg" | "image/png" | "image/webp";
  /** Fotos extras: close-up, segunda peça */
  extraImages?: { base64: string; mediaType?: string }[];
  /** Preço informado pelo usuário (opcional) */
  price?: string;
  /** Tipo de corpo da modelo */
  bodyType?: "normal" | "plus";
  /** Background preferido pelo usuário */
  backgroundType?: string;
  /** Nome da loja */
  storeName?: string;
  /** Cor da marca da loja (hex) */
  brandColor?: string;
}

// ═══════════════════════════════════════
// Função principal
// ═══════════════════════════════════════

/**
 * Chama Claude Sonnet para análise visual do produto.
 * Retorna: análise + hints para FASHN + dicas de postagem.
 */
export async function analyzeWithSonnet(input: AnalyzerInput): Promise<SonnetAnalyzerResult> {
  const anthropic = getClient();

  // Montar content blocks (imagens + texto)
  const content: Anthropic.ContentBlockParam[] = [];

  // Imagem principal do produto
  content.push({
    type: "image",
    source: {
      type: "base64",
      media_type: input.productMediaType || "image/jpeg",
      data: input.productImageBase64,
    },
  });

  // Imagens extras
  if (input.extraImages?.length) {
    for (const img of input.extraImages) {
      const mt = img.mediaType || "image/jpeg";
      const validMt: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
        mt.startsWith("image/") ? (mt as any) : "image/jpeg";
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: validMt,
          data: img.base64,
        },
      });
    }
  }

  // Prompt de instrução
  content.push({
    type: "text",
    text: buildSonnetPrompt(input),
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SONNET_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  // Extrair texto
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Sonnet não retornou texto");
  }

  if (response.stop_reason === "max_tokens") {
    console.error(`[Sonnet] ⚠️ RESPOSTA TRUNCADA!`);
  }

  const result = parseSonnetJSON(textBlock.text);

  if (!result.analise?.tipo_peca) {
    throw new Error("Sonnet retornou análise incompleta — tente outra foto");
  }
  if (!result.fashn_hints?.styling_prompts || result.fashn_hints.styling_prompts.length < 3) {
    throw new Error("Sonnet não gerou os 3 styling prompts para FASHN");
  }

  console.log(
    `[Sonnet] ✅ Análise completa | input=${response.usage.input_tokens} output=${response.usage.output_tokens} tokens | peça: ${result.analise.tipo_peca}`
  );

  return result;
}

// ═══════════════════════════════════════
// System Prompt
// ═══════════════════════════════════════

const SONNET_SYSTEM_PROMPT = `Você é um analista de moda especializado em e-commerce brasileiro. Você recebe fotos de peças de roupa e faz uma análise detalhada para gerar conteúdo visual profissional usando IA.

Sua análise será usada para alimentar um sistema de Virtual Try-On (FASHN AI) que coloca peças de roupa em modelos virtuais. Por isso, você precisa:

1. ANALISAR a peça com detalhes (cor, tecido, modelagem, detalhes)
2. GERAR 3 styling prompts curtos e eficazes para o FASHN (em inglês)
3. CRIAR dicas de postagem para a lojista brasileira (em português)

REGRAS PARA OS STYLING PROMPTS (FASHN):
- Os prompts do FASHN são CURTOS (1-2 frases) — descrevem o CENÁRIO e POSE, não a roupa
- O FASHN já vê a foto do produto — não precisa descrever a peça
- Exemplos bons: "professional studio setting, neutral background", "outdoor urban street, golden hour lighting", "café terrace, relaxed sitting pose"
- Cada prompt deve propor um cenário DIFERENTE
- Prompts em INGLÊS

REGRAS PARA DICAS DE POSTAGEM:
- Em PORTUGUÊS brasileiro
- Práticas e úteis para lojistas pequenas/médias
- Incluir legendas prontas para copiar com emojis
- Hashtags relevantes para o nicho

Responda APENAS com JSON válido, sem markdown.`;

// ═══════════════════════════════════════
// User Prompt builder
// ═══════════════════════════════════════

function buildSonnetPrompt(input: AnalyzerInput): string {
  const extras: string[] = [];
  if (input.price) extras.push(`Preço de venda: R$ ${input.price}`);
  if (input.storeName) extras.push(`Loja: ${input.storeName}`);
  if (input.bodyType === "plus") extras.push("Tipo de corpo da modelo: plus size (GG/XGG)");
  if (input.brandColor) extras.push(`Cor da marca da loja: ${input.brandColor}`);

  // ── Cenário ──
  const SCENARIO_DESCRIPTIONS: Record<string, string> = {
    branco: "Clean white studio background",
    estudio: "Professional studio with soft lighting",
    lifestyle: "Everyday lifestyle setting — café, living room, cozy environment",
    urbano: "Urban modern setting — city street, modern architecture, golden hour",
    natureza: "Outdoor natural setting — garden, beach at sunset, green field",
    interior: "Elegant interior — modern loft, decorated apartment",
    boutique: "Fashion boutique interior — minimalist racks, warm lighting",
    gradiente: "Elegant gradient background matching garment colors",
  };

  let bgHint = "";
  const bgType = input.backgroundType || "";

  if (bgType.startsWith("personalizado:")) {
    const customText = bgType.replace("personalizado:", "").trim();
    if (customText) {
      bgHint = `\nCENÁRIO PREFERIDO pela lojista: "${customText}". Use como base para o Prompt #1. Os outros 2 devem ser diferentes.`;
    }
  } else if (bgType && SCENARIO_DESCRIPTIONS[bgType]) {
    bgHint = `\nCENÁRIO PREFERIDO: "${SCENARIO_DESCRIPTIONS[bgType]}". Use como base para o Prompt #1.`;
  }

  const numPhotos = 1 + (input.extraImages?.length || 0);
  const photoDesc =
    numPhotos > 1
      ? `estas ${numPhotos} fotos do produto`
      : "esta foto do produto de moda";

  return `Analise ${photoDesc}.
${extras.length > 0 ? "\nINFO DO LOJISTA:\n" + extras.join("\n") : ""}${bgHint}

Retorne um JSON com esta estrutura EXATA (sem markdown, apenas JSON puro):
{
  "analise": {
    "tipo_peca": "blusa | saia | calca | vestido | macacao | jaqueta | conjunto | acessorio",
    "pecas": ["nome descritivo da peça 1", "nome da peça 2 se conjunto"],
    "tecido": "descrição do tecido",
    "cor_principal": { "nome": "nome da cor", "hex": "#XXXXXX" },
    "cores_secundarias": [],
    "modelagem": "ajustado | oversized | flare | reto | evasê",
    "caimento": "fluido | estruturado | justo",
    "detalhes": ["detalhe 1", "detalhe 2"],
    "estacao": "primavera/verão | outono/inverno | meia-estação",
    "mood": "romântico casual | urbano moderno | etc",
    "publico": "mulheres 20-35 | etc"
  },
  "fashn_hints": {
    "styling_prompts": [
      "professional studio setting, model standing confidently, soft lighting",
      "outdoor urban street, golden hour, walking naturally",
      "café terrace, relaxed pose, natural daylight"
    ],
    "aspect_ratio": "3:4",
    "category": "tops | bottoms | dresses | outerwear | sets | accessories"
  },
  "dicas_postagem": {
    "melhor_dia": "terça ou quinta",
    "melhor_horario": "11h-13h ou 19h-21h",
    "sequencia_sugerida": "dica de como usar as 3 fotos em sequência",
    "legendas": [
      {
        "foto": 1,
        "plataforma": "Instagram Feed",
        "legenda": "legenda pronta ✨",
        "hashtags": ["#modafeminina", "#lookdodia"],
        "dica": "dica de uso"
      },
      {
        "foto": 2,
        "plataforma": "WhatsApp / Catálogo",
        "legenda": "legenda para catálogo",
        "hashtags": [],
        "dica": "dica"
      },
      {
        "foto": 3,
        "plataforma": "Instagram Stories",
        "legenda": "legenda curta para stories",
        "hashtags": ["#stories"],
        "dica": "dica de stories"
      }
    ]
  }
}`;
}

// ═══════════════════════════════════════
// Parser JSON robusto
// ═══════════════════════════════════════

function parseSonnetJSON(raw: string): SonnetAnalyzerResult {
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
    console.warn("[Sonnet] JSON truncado, tentando reparar...");
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
      console.error("[Sonnet] Falha ao parsear JSON:", cleaned.slice(0, 500));
      throw new Error("Sonnet retornou resposta inválida — tente novamente");
    }
  }
}
