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
  /** 3 styling prompts para o FASHN tryon-max (instruções de caimento/estilo) */
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

Sua análise será usada para alimentar o FASHN AI "tryon-max" — um sistema de Virtual Try-On que VESTE a peça real numa modelo virtual. O tryon-max recebe a foto do produto + foto da modelo e coloca a peça na modelo com alta fidelidade.

Por isso, você precisa:

1. ANALISAR a peça com detalhes (cor, tecido, modelagem, detalhes)
2. GERAR 3 styling prompts para o tryon-max (em inglês)
3. CRIAR dicas de postagem para a lojista brasileira (em português)

REGRAS CRÍTICAS PARA OS STYLING PROMPTS (tryon-max):
- O prompt do tryon-max controla COMO a peça é vestida — NÃO descreve cenários
- São instruções curtas de STYLING/CAIMENTO da peça no corpo da modelo
- Exemplos BONS:
  • "tuck in shirt, natural relaxed pose" (camisa por dentro)
  • "roll up sleeves, casual confident look" (mangas dobradas)
  • "open jacket showing inner layer" (jaqueta aberta)
  • "belt cinched at waist, elegant drape" (marcação na cintura)
  • "off-shoulder style, relaxed fit" (ombro caído)
  • "button up fully, professional sleek look" (toda abotoada)
  • "tie front knot, casual summer style" (nó na frente)
  • "layered over simple top, street style" (sobreposição)
- Exemplos RUINS (NÃO FAÇA ISSO):
  • "urban street golden hour lighting" ← cenário, não styling
  • "professional studio neutral background" ← isso é background
- Cada prompt deve propor uma VARIAÇÃO DIFERENTE de como vestir a peça
- Se a peça não permite variações (ex: vestido simples), varie pose/atitude:
  • "natural standing pose, hands at sides"
  • "walking confidently, slight movement"
  • "hand on hip, looking away naturally"
- Máximo 1-2 frases curtas por prompt
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

  // ── Mood de styling (tryon-max controla caimento, não cenário) ──
  const STYLING_MOODS: Record<string, string> = {
    branco: "Clean minimal styling, natural relaxed fit",
    estudio: "Polished professional styling, well-fitted look",
    lifestyle: "Casual everyday styling, relaxed comfortable fit",
    urbano: "Street style confident look, edgy modern fit",
    natureza: "Effortless natural styling, breezy relaxed drape",
    interior: "Elegant refined styling, sophisticated silhouette",
    boutique: "Fashion-forward styling, details highlighted",
    gradiente: "Clean styled look, garment details front and center",
  };

  let styleHint = "";
  const bgType = input.backgroundType || "";

  if (bgType.startsWith("personalizado:")) {
    const customText = bgType.replace("personalizado:", "").trim();
    if (customText) {
      styleHint = `\nESTILO PREFERIDO pela lojista: "${customText}". Use como inspiração para o Prompt #1. Os outros 2 devem ser variações diferentes.`;
    }
  } else if (bgType && STYLING_MOODS[bgType]) {
    styleHint = `\nMOOD DE STYLING PREFERIDO: "${STYLING_MOODS[bgType]}". Use como inspiração para o Prompt #1.`;
  }

  const numPhotos = 1 + (input.extraImages?.length || 0);
  const photoDesc =
    numPhotos > 1
      ? `estas ${numPhotos} fotos do produto`
      : "esta foto do produto de moda";

  return `Analise ${photoDesc}.
${extras.length > 0 ? "\nINFO DO LOJISTA:\n" + extras.join("\n") : ""}${styleHint}

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
      "natural relaxed fit, hands in pockets, casual confident look",
      "tuck in front, belt at waist, polished styling",
      "sleeves slightly rolled, walking pose, effortless style"
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
