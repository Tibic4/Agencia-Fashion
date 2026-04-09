/**
 * CriaLook Sonnet Analyzer v5.1 — Ultra-detailed prompts for Gemini VTO
 *
 * Analisa o produto e gera:
 * 1. Análise completa da peça (para display no frontend)
 * 2. 3 scene-prompts narrativos ULTRA-DETALHADOS para o Gemini VTO
 *    — cada prompt descreve: cenário + iluminação + pose + styling + câmera
 *    — usa dados da modelo (skin_tone, body_type, hair, etc.) e cenário
 * 3. Dicas de postagem premium para lojistas brasileiras
 *
 * Otimizado para Gemini 3.1 Flash Image (Nano Banana 2):
 * — Prompts narrativos longos → Gemini entende contexto rico
 * — Detalhes de fotografia profissional → qualidade editorial
 * — Referências a physique da modelo → consistência de identidade
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ModelInfo } from "./pipeline";

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

export interface SonnetVTOHint {
  /** 3 scene+styling prompts para o Gemini VTO (em inglês) */
  scene_prompts: [string, string, string];
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
  vto_hints: SonnetVTOHint;
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
  /** Metadados da modelo selecionada (skin_tone, body_type, hair, etc.) */
  modelInfo?: ModelInfo;
}

// ═══════════════════════════════════════
// Função principal
// ═══════════════════════════════════════

/**
 * Chama Claude Sonnet para análise visual do produto.
 * Retorna: análise + hints para Gemini VTO + dicas de postagem.
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
    system: buildSystemPrompt(input),
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
  if (!result.vto_hints?.scene_prompts || result.vto_hints.scene_prompts.length < 3) {
    throw new Error("Sonnet não gerou os 3 scene prompts para Gemini VTO");
  }

  console.log(
    `[Sonnet] ✅ Análise completa | input=${response.usage.input_tokens} output=${response.usage.output_tokens} tokens | peça: ${result.analise.tipo_peca}`
  );

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
    magra: "slim/petite body frame",
    plus_size: "plus-size curvy body with full figure",
    plus: "plus-size curvy body with full figure",
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
    jovem_18_25: "young woman (18-25)",
    adulta_26_35: "adult woman (26-35)",
    madura_36_50: "mature woman (36-50)",
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

  const modelDescription = modelParts.length > 0
    ? `\n\n🧍 MODELO SELECIONADA PELA LOJISTA:\nA modelo na foto de referência é: ${modelParts.join(", ")}.\nUse esses detalhes nos scene_prompts para que o Gemini entenda exatamente QUE PESSOA reproduzir — isso melhora a fidelidade da identidade. Incorpore a cor de pele, cabelo e tipo de corpo NATURALMENTE na descrição da cena (ex: "warm golden-hour light complementing her deep skin tone", "her long wavy auburn hair flowing naturally").`
    : "";

  return `Você é o analista de moda mais experiente do Brasil, especializado em fotografia de e-commerce e campanhas para Instagram.

Sua MISSÃO CRÍTICA é analisar fotos de peças de roupa e criar 3 cenários de fotos profissionais DISTINTOS que serão executados por uma IA de Virtual Try-On (Gemini) — essa IA recebe a foto do produto + foto de uma modelo e gera uma imagem fotorrealista da modelo VESTINDO aquela peça.

O Gemini é um modelo multimodal avançado que entende prompts NARRATIVOS ricos. Quanto MAIS detalhado o prompt, MELHOR o resultado. Ele compreende:
- Linguagem de fotografia profissional (lentes, iluminação, composição)
- Física de tecidos e caimento
- Cenários e ambientes detalhados
- Expressões faciais e poses
- Cor de pele e como a luz interage com ela

Você PRECISA gerar prompts que pareçam direções de um fotógrafo de moda para seu assistente.${modelDescription}

REGRAS ABSOLUTAS PARA OS SCENE PROMPTS:

1. Cada prompt DEVE ser em INGLÊS e ter 4-7 frases detalhadas
2. Cada prompt DEVE incluir TODOS estes 6 elementos:
   a) CENÁRIO/AMBIENTE — onde a foto acontece (estúdio, rua, café, jardim, boutique...)
   b) ILUMINAÇÃO — tipo de luz, temperatura de cor, direção (softbox, golden hour, natural window light, ring light...)
   c) POSE E EXPRESSÃO — como a modelo está posicionada, expressão facial, linguagem corporal
   d) STYLING DO VESTIR — como a peça está vestida (tucked in, off-shoulder, sleeves rolled, jacket open...)
   e) CÂMERA — ângulo, enquadramento, profundidade de campo, estilo fotográfico
   f) MOOD/ATMOSFERA — sensação visual geral (editorial, aspiracional, fresh, warm, sophisticated...)

3. Os 3 prompts DEVEM ser RADICALMENTE diferentes entre si:
   - Prompt 1: segue o cenário preferido da lojista (se informado)
   - Prompt 2: cenário contrastante (se P1 é estúdio, P2 é externo)
   - Prompt 3: criativo/inesperado (ângulo diferente, mood especial)

4. 🚨 CADA PROMPT DEVE TER UMA POSE COMPLETAMENTE DIFERENTE — NUNCA repita a mesma pose!
   Use este banco de referência (escolha 3 poses DISTINTAS dos 3 prompts):
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
   Adapte a pose à peça: se a peça é um vestido longo, use pose que mostre o caimento; se é jaqueta, use pose que mostre a estrutura.

5. Se a peça é um CONJUNTO (blusa+saia, top+calça), CADA prompt deve mencionar TODAS as peças

6. NUNCA escreva prompts curtos como "tuck in shirt" ou "casual confident look" — isso é INÚTIL para o Gemini

EXEMPLO DE PROMPT EXCELENTE ✅:
"Professional fashion photography in a bright, airy loft studio with floor-to-ceiling windows casting soft natural light from the left. The model walks mid-stride with natural arm swing, captured in fluid motion with confidence, her long wavy hair bouncing softly. The blouse is neatly tucked into the high-waisted trousers, belt cinched at the smallest point of the waist. Shot with an 85mm portrait lens at f/2.8, creating a creamy bokeh in the background while keeping fabric texture tack-sharp. The overall mood is polished, modern editorial — think Vogue Brazil meets everyday elegance."

EXEMPLO DE PROMPT RUIM ❌:
"Studio setting with good lighting. Model stands confidently wearing the garment."

REGRAS PARA DICAS DE POSTAGEM:
- Em PORTUGUÊS brasileiro, tom acessível e "amiga da lojista"
- Legendas prontas para copiar com emojis relevantes
- Hashtags atuais do nicho fashion brasileiro
- Incluir dica de SEQUÊNCIA (como postar as 3 fotos nos stories/feed)

Responda APENAS com JSON válido, sem markdown, sem backticks.`;
}

// ═══════════════════════════════════════
// User Prompt builder
// ═══════════════════════════════════════

function buildSonnetPrompt(input: AnalyzerInput): string {
  const extras: string[] = [];
  if (input.price) extras.push(`Preço de venda: R$ ${input.price}`);
  if (input.storeName) extras.push(`Loja: ${input.storeName}`);
  if (input.brandColor) extras.push(`Cor da marca da loja: ${input.brandColor}`);

  // Body type context
  if (input.bodyType === "plus" || input.modelInfo?.bodyType === "plus_size" || input.modelInfo?.bodyType === "plus") {
    extras.push("🔴 ATENÇÃO — Modelo é plus size. Os prompts devem valorizar o corpo curvilíneo com poses e ângulos flattering");
  }

  // ── Scene context (cenário selecionado) ──
  const SCENE_MOODS: Record<string, { name: string; description: string; details: string }> = {
    branco: {
      name: "Estúdio Branco Minimalista",
      description: "Clean minimalist white studio with pure seamless white cyclorama background",
      details: "Soft even lighting from large overhead softboxes. No shadows on background. E-commerce product-focus aesthetic."
    },
    estudio: {
      name: "Estúdio Profissional",
      description: "Professional fashion photography studio with controlled three-point lighting setup",
      details: "Key light 45° from subject, fill light opposite, hair/rim light from behind. Neutral gray or gradient backdrop. Sharp, editorial feel."
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
    gradiente: {
      name: "Gradiente Editorial",
      description: "Smooth color gradient backdrop transitioning between two harmonious tones",
      details: "Even front lighting with no harsh shadows. Fashion editorial aesthetic with color that complements the garment."
    },
  };

  let sceneInstruction = "";
  const bgType = input.backgroundType || "";

  if (bgType.startsWith("personalizado:")) {
    const customText = bgType.replace("personalizado:", "").trim();
    if (customText) {
      sceneInstruction = `\n\n🎬 CENÁRIO PREFERIDO PELA LOJISTA:\n"${customText}"\nUse este cenário como inspiração PRINCIPAL para o Prompt #1 (scene_prompts[0]).\nOs Prompts #2 e #3 devem usar cenários COMPLETAMENTE diferentes para dar variedade à campanha.`;
    }
  } else if (bgType === "minha_marca" && input.brandColor) {
    sceneInstruction = `\n\n🎬 CENÁRIO PREFERIDO: Minha Marca\nA lojista quer fotos com a identidade visual da marca. Cor principal: ${input.brandColor}.\nPrompt #1: Use um backdrop com gradiente ou tom sólido na cor ${input.brandColor} (ou complementar). Iluminação que valorize a cor da marca.\nPrompts #2 e #3: cenários diferentes mas MANTENHA toques da cor da marca em detalhes (acessórios, fundo sutil, filtro de cor).`;
  } else if (bgType && SCENE_MOODS[bgType]) {
    const scene = SCENE_MOODS[bgType];
    sceneInstruction = `\n\n🎬 CENÁRIO PREFERIDO: ${scene.name}\n${scene.description}.\n${scene.details}\nUse este cenário como base para o Prompt #1 (scene_prompts[0]).\nOs Prompts #2 e #3 DEVEM ser cenários COMPLETAMENTE diferentes (ex: se P1 é estúdio, P2 pode ser urbano, P3 natureza).`;
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

Retorne um JSON com esta estrutura EXATA (sem markdown, apenas JSON puro):
{
  "analise": {
    "tipo_peca": "blusa | saia | calca | vestido | macacao | jaqueta | conjunto | acessorio",
    "pecas": ["nome descritivo da peça 1", "nome da peça 2 se conjunto"],
    "tecido": "descrição detalhada do tecido (ex: crepe de viscose com toque sedoso)",
    "cor_principal": { "nome": "nome preciso da cor (ex: azul petróleo)", "hex": "#XXXXXX" },
    "cores_secundarias": [{ "nome": "cor", "hex": "#XXXXXX" }],
    "modelagem": "ajustado | oversized | flare | reto | evasê | A-line | wrap | bodycon",
    "caimento": "fluido | estruturado | justo | solto",
    "detalhes": ["detalhe1 (ex: botões de madrepérola 1cm)", "detalhe2 (ex: gola V profunda 15cm)"],
    "estacao": "primavera/verão | outono/inverno | meia-estação",
    "mood": "romântico casual | urbano moderno | chic minimalista | boho sofisticado | etc",
    "publico": "mulheres 20-35 classe B | etc"
  },
  "vto_hints": {
    "scene_prompts": [
      "PROMPT 1 (4-7 frases): [cenário preferido + iluminação detalhada + pose específica + styling do vestir + ângulo de câmera + mood] — lembre de mencionar TODAS as peças visíveis do produto",
      "PROMPT 2 (4-7 frases): [cenário DIFERENTE do P1 + iluminação diferente + pose diferente + styling alternativo + câmera diferente + mood contrastante]",
      "PROMPT 3 (4-7 frases): [cenário criativo/inesperado + iluminação especial + pose dinâmica ou artística + styling ousado + ângulo fotográfico interessante + mood marcante]"
    ],
    "aspect_ratio": "3:4",
    "category": "tops | bottoms | dresses | outerwear | sets | accessories"
  },
  "dicas_postagem": {
    "melhor_dia": "terça ou quinta (maior engajamento para moda)",
    "melhor_horario": "11h-13h ou 19h-21h",
    "sequencia_sugerida": "dica detalhada de como usar as 3 fotos em sequência no feed/stories",
    "legendas": [
      {
        "foto": 1,
        "plataforma": "Instagram Feed",
        "legenda": "legenda pronta e envolvente com emojis ✨👗",
        "hashtags": ["#modafeminina", "#lookdodia", "#ootd"],
        "dica": "por que esta legenda funciona e como adaptar"
      },
      {
        "foto": 2,
        "plataforma": "WhatsApp / Catálogo",
        "legenda": "texto persuasivo para catálogo de WhatsApp ❤️",
        "hashtags": [],
        "dica": "tom de voz para WhatsApp"
      },
      {
        "foto": 3,
        "plataforma": "Instagram Stories / Reels",
        "legenda": "legenda curta/CTA para stories 🔥",
        "hashtags": ["#stories", "#modabrasil"],
        "dica": "como usar nos stories com enquete"
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
