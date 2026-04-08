import Anthropic from "@anthropic-ai/sdk";

// ═══════════════════════════════════════
// Tipos de retorno do Opus
// ═══════════════════════════════════════

export interface OpusAnalise {
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

export interface OpusPrompt {
  concept_name: string;
  positive_prompt: string;
  negative_prompt: string;
  pose: string;
  scenario: string;
}

export interface OpusDicaLegenda {
  foto: number;
  plataforma: string;
  legenda: string;
  hashtags?: string[];
  dica?: string;
}

export interface OpusDicasPostagem {
  melhor_dia: string;
  melhor_horario: string;
  sequencia_sugerida: string;
  legendas: OpusDicaLegenda[];
}

export interface OpusAnalyzerResult {
  analise: OpusAnalise;
  prompts: [OpusPrompt, OpusPrompt, OpusPrompt];
  dicas_postagem: OpusDicasPostagem;
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
}

// ═══════════════════════════════════════
// Função principal
// ═══════════════════════════════════════

/**
 * Chama Claude Opus para análise visual profunda do produto.
 * Retorna: análise detalhada + 3 prompts independentes + dicas de postagem.
 * Tudo em 1 chamada só ao Opus.
 */
export async function analyzeWithOpus(input: AnalyzerInput): Promise<OpusAnalyzerResult> {
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

  // Imagens extras (close-up de textura, segunda peça)
  if (input.extraImages?.length) {
    for (const img of input.extraImages) {
      const mt = img.mediaType || "image/jpeg";
      // Garantir mime type válido p/ Anthropic
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
    text: buildOpusPrompt(input),
  });

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: OPUS_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  // Extrair texto da resposta
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Opus não retornou texto");
  }

  // Parse JSON
  const result = parseOpusJSON(textBlock.text);

  // Validações básicas
  if (!result.analise?.tipo_peca) {
    throw new Error("Opus retornou análise incompleta — tente outra foto");
  }
  if (!result.prompts || result.prompts.length < 3) {
    throw new Error("Opus não gerou os 3 prompts necessários");
  }

  console.log(
    `[Opus] ✅ Análise completa | input=${response.usage.input_tokens} output=${response.usage.output_tokens} tokens | peça: ${result.analise.tipo_peca}`
  );

  return result;
}

// ═══════════════════════════════════════
// System Prompt do Opus
// ═══════════════════════════════════════

const OPUS_SYSTEM_PROMPT = `Você é o maior analista de moda do Brasil. Você recebe fotos de peças de roupa e faz uma análise primorosa — detalhes que outros modelos perdem, você pega: o tom exato da cor, se o botão é fosco ou brilhante, se o tecido tem elastano, quantos botões tem, se a barra é canelada, se a peça está amarrotada ou lisa no manequim.

A partir da sua análise, você gera 3 PROMPTS COMPLETOS para um modelo de geração de imagem (Gemini Image). Cada prompt cria uma foto diferente — cenários e poses diferentes — mas TODAS mantêm a peça EXATAMENTE como ela é.

⚠️ CRÍTICO: Cada prompt vai para uma chamada de API SEPARADA e INDEPENDENTE. O Gemini NÃO vê os outros prompts. Por isso, CADA prompt precisa conter a descrição COMPLETA da peça — não assuma que ele já sabe. Repita TODOS os detalhes em cada prompt.

Você também dá dicas práticas de postagem para a lojista.

REGRAS ABSOLUTAS:
1. NUNCA invente detalhes que não existem na peça
2. Descreva cores com nome + hex (ex: "rosa bebê #F4C2C2")
3. Conte EXATAMENTE quantos botões, bolsos, detalhes visíveis
4. Identifique se é 1 peça ou conjunto (2 peças)
5. Os 3 prompts devem ser DIFERENTES em cenário/pose mas IDÊNTICOS na descrição exata da peça
6. Prompts em INGLÊS (Gemini funciona melhor em inglês)
7. Dicas de postagem em PORTUGUÊS (para a lojista brasileira)

ANÁLISE OBRIGATÓRIA DA PEÇA (cada item DEVE estar na análise E repetido em cada prompt):
- MATERIAL/TECIDO: composição exata (ex: "tricô canelado com elastano", "viscose lisa", "jeans denim 100% algodão")
- COR: nome da cor + hex code (ex: "rosa bebê #F4C2C2") — se tem mais de uma cor, listar TODAS
- COMPRIMENTO: curto (acima do joelho), midi (no joelho/panturrilha), longo (até o tornozelo), cropped (acima da cintura)
- MANGA: sem manga, alça fina, alça larga, manga curta, manga 3/4, manga longa, manga bufante
- GOLA/DECOTE: gola alta, gola V, gola redonda, gola quadrada, decote canoa, decote coração, sem gola
- CINTURA: cós elástico, cós rígido, sem marcação, amarração, pregas
- BARRA: reta, arredondada, assimétrica, canelada, desfiada, com elástico
- MODELAGEM: ajustada/justa, reta, ampla/oversized, evasê/A-line, lápis, flare
- FECHAMENTO: botões (quantos + material), zíper (onde), amarração, sem fechamento
- DETALHES EXTRAS: bolsos (quantos + tipo), pregas, franzidos, bordados, pedrarias, costuras aparentes

REGRAS PARA OS PROMPTS POSITIVOS (CRITICAL):
8. Seja MEGA descritivo — o Gemini recebe APENAS texto + fotos de referência
9. Descreva a peça como se alguém cego precisasse fabricá-la: "a cropped top made of ribbed knit fabric in baby pink #F4C2C2, with a high turtleneck collar, long fitted sleeves with ribbed cuffs (3cm wide), elastic hem at crop length ending 5cm above the navel, no buttons, no prints, solid color throughout"
10. Se a peça está AMARROTADA/amassada na foto do manequim, instrua: "the fabric must appear smooth, well-pressed and wrinkle-free on the model"
11. Cada prompt deve ter >150 palavras — REPITA todos os detalhes da peça em cada prompt (material, cor hex, comprimento, manga, gola, barra, detalhes). Não economize palavras.

REGRA DE CONSISTÊNCIA DA MODELO (CRITICAL):
12. As 3 fotos DEVEM parecer a MESMA pessoa — IDÊNTICO rosto, tom de pele, cabelo, corpo, proporções
13. O que MUDA entre as 3 fotos: APENAS a pose, o cenário/fundo e a iluminação
14. O que NÃO MUDA: rosto, cabelo (cor, corte, estilo), corpo, tom de pele, a peça de roupa
15. Em CADA prompt, inclua: "The model must match the reference photo EXACTLY — same face, same skin tone, same hair color and style, same body proportions. Only the pose and background change."

REGRAS DE POSE (cada prompt deve ter pose DIFERENTE e DESCRITA em detalhe):
16. A pose deve combinar com o estilo da peça:
    - Peça justa/elegante → pose confiante, uma mão na cintura, olhando para câmera
    - Peça fluida/casual → pose relaxada, andando naturalmente, sorriso leve
    - Peça esportiva → pose dinâmica, em movimento, expressão determinada
    - Conjunto → pose que mostre AMBAS as peças claramente, corpo levemente de lado
17. Descreva a pose em detalhe no campo "pose" (ex: "standing with left hand on hip, right arm relaxed at side, weight on left leg, slight smile, looking directly at camera")
18. As 3 poses devem ser VISIVELMENTE DIFERENTES entre si — variação real, não sutil

REGRAS PARA OS NEGATIVE PROMPTS (CRITICAL):
19. Negative prompts devem ser EXAUSTIVOS e ESPECÍFICOS à peça analisada
20. SEMPRE incluir: cor errada, textura errada, detalhes inventados, padrão inexistente
21. Se a peça é LISA (sem estampa) → negative: "Do NOT add any prints, patterns, stripes, plaid, or decorative elements to the fabric"
22. Se a peça tem X botões → negative: "Do NOT add or remove buttons. Must have EXACTLY [X] buttons."
23. Se a peça é de cor sólida → negative: "Do NOT add ombré, gradient, tie-dye, or color variation to the garment"
24. Se a peça tem gola específica → negative: "Do NOT change neckline from [tipo exato]"
25. SEMPRE incluir no negative: "Do NOT generate barefoot model. Do NOT add text, watermarks, or logos. Do NOT change the garment in any way."

Responda APENAS com JSON válido, sem markdown.`;

// ═══════════════════════════════════════
// User Prompt builder
// ═══════════════════════════════════════

function buildOpusPrompt(input: AnalyzerInput): string {
  const extras: string[] = [];
  if (input.price) extras.push(`Preço de venda: R$ ${input.price}`);
  if (input.storeName) extras.push(`Loja: ${input.storeName}`);
  if (input.bodyType === "plus") extras.push("Tipo de corpo da modelo: plus size (GG/XGG)");

  let bgHint = "";
  if (input.backgroundType && input.backgroundType !== "branco" && input.backgroundType !== "estudio") {
    bgHint = `\nA lojista prefere cenário: ${input.backgroundType}. Use isso como inspiração para o Prompt #1. Os outros 2 prompts devem ter cenários DIFERENTES.`;
  }

  const numPhotos = 1 + (input.extraImages?.length || 0);
  const photoDesc =
    numPhotos > 1
      ? `estas ${numPhotos} fotos. A PRIMEIRA foto é a visão completa do produto. ${numPhotos >= 2 ? "A SEGUNDA pode ser close-up do tecido ou segunda peça do conjunto." : ""} ${numPhotos >= 3 ? "A TERCEIRA pode ser a segunda peça do conjunto ou outro ângulo." : ""}`
      : "esta foto do produto de moda";

  return `Analise ${photoDesc}.
${extras.length > 0 ? "\nINFO DO LOJISTA:\n" + extras.join("\n") : ""}${bgHint}

Retorne um JSON com esta estrutura EXATA (sem markdown, apenas JSON puro):
{
  "analise": {
    "tipo_peca": "blusa | saia | calca | vestido | macacao | jaqueta | conjunto | acessorio",
    "pecas": ["nome descritivo detalhado da peça 1", "nome descritivo da peça 2 se conjunto"],
    "tecido": "descrição detalhada do tecido e composição",
    "cor_principal": { "nome": "nome da cor", "hex": "#XXXXXX" },
    "cores_secundarias": [],
    "modelagem": "ajustado | oversized | flare | reto | evasê | etc",
    "caimento": "fluido | estruturado | justo | etc",
    "detalhes": ["detalhe 1 com quantidade e posição", "detalhe 2", "..."],
    "estacao": "primavera/verão | outono/inverno | meia-estação",
    "mood": "romântico casual | urbano moderno | etc",
    "publico": "mulheres 20-35 | etc"
  },
  "prompts": [
    {
      "concept_name": "Editorial Urbano",
      "positive_prompt": "MAIS DE 150 PALAVRAS EM INGLÊS — Generate a photorealistic full-body fashion photograph of a Brazilian woman. The model must match the reference photo EXACTLY — same face, same skin tone, same hair color and style, same body proportions. Only the pose and background change. She is wearing EXACTLY this garment: [DESCREVA A PEÇA COM TODOS OS DETALHES — material exato, cor hex, textura, modelagem, comprimento, gola, manga, barra, cada botão e bolso]. The fabric must appear smooth and well-pressed. [POSE DETALHADA em inglês]. Setting: [CENÁRIO DETALHADO]. Professional fashion photography lighting...",
      "negative_prompt": "EXAUSTIVO E ESPECÍFICO: Do NOT change the fabric color from #XXXXXX. Do NOT add or remove buttons — must have exactly N. Do NOT change the neckline. Do NOT add prints/patterns to what is a solid-color garment. Do NOT generate barefoot model. Do NOT add text, watermarks, logos. Do NOT alter sleeve length or garment proportions.",
      "pose": "standing with left hand on hip, right arm relaxed at side, weight on left leg, slight smile, looking directly at camera",
      "scenario": "modern city sidewalk, golden hour light"
    },
    {
      "concept_name": "Studio Clean",
      "positive_prompt": "MAIS DE 150 PALAVRAS EM INGLÊS — [mesmos detalhes da peça, pose e cenário DIFERENTES]",
      "negative_prompt": "[mesmo negative prompt exaustivo]",
      "pose": "pose completamente diferente da #1",
      "scenario": "cenário diferente do #1"
    },
    {
      "concept_name": "Lifestyle Natural",
      "positive_prompt": "MAIS DE 150 PALAVRAS EM INGLÊS — [mesmos detalhes da peça, pose e cenário DIFERENTES]",
      "negative_prompt": "[mesmo negative prompt exaustivo]",
      "pose": "pose completamente diferente das #1 e #2",
      "scenario": "cenário diferente dos #1 e #2"
    }
  ],
  "dicas_postagem": {
    "melhor_dia": "terça ou quinta",
    "melhor_horario": "11h-13h ou 19h-21h",
    "sequencia_sugerida": "dica de como usar as 3 fotos em sequência",
    "legendas": [
      {
        "foto": 1,
        "plataforma": "Instagram Feed",
        "legenda": "legenda pronta para copiar com emojis ✨",
        "hashtags": ["#modafeminina", "#lookdodia", "#moda"],
        "dica": "dica de como usar esta foto"
      },
      {
        "foto": 2,
        "plataforma": "WhatsApp / Catálogo",
        "legenda": "legenda para catálogo de produtos",
        "hashtags": [],
        "dica": "dica de como usar esta foto"
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

function parseOpusJSON(raw: string): OpusAnalyzerResult {
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
    // Tentar reparar JSON incompleto (truncado por max_tokens)
    console.warn("[Opus] JSON truncado, tentando reparar...");
    let repaired = cleaned;

    // Fechar strings abertas
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';

    // Fechar objetos/arrays abertos
    const opens = (repaired.match(/[{[]/g) || []).length;
    const closes = (repaired.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      const lastOpen = Math.max(repaired.lastIndexOf("{"), repaired.lastIndexOf("["));
      repaired += repaired[lastOpen] === "{" ? "}" : "]";
    }

    try {
      return JSON.parse(repaired);
    } catch {
      console.error("[Opus] Falha ao parsear JSON:", cleaned.slice(0, 500));
      throw new Error("Opus retornou resposta inválida — tente novamente");
    }
  }
}
