/**
 * CriaLook Sonnet Copywriter v1 — Claude Sonnet 4.6
 *
 * Copywriter especializado em Instagram para lojistas brasileiras.
 * Recebe a análise visual do Gemini Analyzer e gera:
 * - Legendas magnéticas (caption + alternativa)
 * - Dicas de postagem (dia, horário, sequência)
 * - CTAs, story ideas, hashtags
 *
 * Separado do Analyzer para:
 * 1. Cada modelo faz o que faz melhor (Gemini = visão, Sonnet = copy PT-BR)
 * 2. Menor overload cognitivo por chamada
 * 3. Copy significativamente mais natural e persuasivo
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeminiAnalise } from "./gemini-analyzer";

// ═══════════════════════════════════════
// Tipos de retorno
// ═══════════════════════════════════════

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
  caption_sugerida: string;
  caption_alternativa: string;
  tom_legenda: string;
  cta: string;
  dica_extra: string;
  story_idea: string;
  hashtags: string[];
  legendas: SonnetDicaLegenda[];
}

export interface SonnetCopyResult {
  dicas_postagem: SonnetDicasPostagem;
  _usageMetadata?: {
    inputTokens: number;
    outputTokens: number;
  };
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
// Config
// ═══════════════════════════════════════

const MODEL = "claude-sonnet-4-20250514";

// ═══════════════════════════════════════
// Input
// ═══════════════════════════════════════

export interface CopywriterInput {
  /** Análise visual do produto (do Gemini Analyzer) */
  analise: GeminiAnalise;
  /** Preço de venda (ex: "179,90") */
  price?: string;
  /** Nome da loja */
  storeName?: string;
  /** Imagem do produto em base64 (para Sonnet analisar visualmente) */
  productImageBase64?: string;
  productMediaType?: string;
}

// ═══════════════════════════════════════
// Função principal
// ═══════════════════════════════════════

export async function generateCopyWithSonnet(input: CopywriterInput): Promise<SonnetCopyResult> {
  const client = getClient();
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  // Montar messages — com imagem se disponível
  const contentParts: Anthropic.ContentBlockParam[] = [];

  if (input.productImageBase64) {
    contentParts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: (input.productMediaType || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: input.productImageBase64,
      },
    });
  }

  contentParts.push({
    type: "text",
    text: userPrompt,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    temperature: 0.9, // alta criatividade para copy
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: contentParts,
      },
    ],
  });

  const durationMs = Date.now() - startTime;

  // Extrair texto da resposta
  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";

  if (!text) {
    throw new Error("Sonnet não retornou resposta de copy");
  }

  // Parse JSON
  let result: SonnetDicasPostagem;
  try {
    // Limpar markdown code blocks se houver
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      result = JSON.parse(cleaned.slice(first, last + 1));
    } else {
      result = JSON.parse(cleaned);
    }
  } catch {
    console.error("[Sonnet Copy] ❌ JSON inválido:", text.slice(0, 500));
    throw new Error("Sonnet retornou copy inválido — tente novamente");
  }

  // Validar campos obrigatórios
  if (!result.caption_sugerida || !result.legendas || result.legendas.length < 3) {
    console.warn("[Sonnet Copy] ⚠️ Resposta incompleta, preenchendo fallbacks...");
    result.caption_sugerida = result.caption_sugerida || "✨ Novidade que vai te surpreender! Confira 💕";
    result.caption_alternativa = result.caption_alternativa || "Elegância e atitude em cada detalhe ✨";
    result.legendas = result.legendas || [
      { foto: 1, plataforma: "Instagram Feed", legenda: result.caption_sugerida },
      { foto: 2, plataforma: "WhatsApp", legenda: "Chegou novidade! Manda um oi que eu te conto 😍" },
      { foto: 3, plataforma: "Stories", legenda: "Qual é a sua vibe? Vote aqui! 🔥" },
    ];
  }

  // Validar: nenhum copy deve mencionar tipo de peça/cor/tecido
  const forbidden = /\b(calça|blusa|vestido|saia|conjunto|macacão|camisa|camiseta|short|bermuda|regata|jaqueta|casaco|moletom|sapato|tênis|sandália|bota|chinelo|scarpin|sapatilha|bolsa|cinto|algodão|seda|linho|couro|jeans|denim|poliéster|lycra|renda|crochê|tricô|veludo|cetim|chiffon)\b/gi;

  const allText = `${result.caption_sugerida} ${result.caption_alternativa} ${result.cta} ${result.dica_extra} ${result.story_idea}`;
  if (forbidden.test(allText)) {
    console.warn("[Sonnet Copy] ⚠️ Clothing reference leaked through — Sonnet broke the rule");
  }

  // Token usage
  const usage = {
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };

  console.log(
    `[Sonnet Copy] ✅ Copy em ${durationMs}ms | in=${usage.inputTokens} out=${usage.outputTokens} tokens`
  );

  return {
    dicas_postagem: result,
    _usageMetadata: usage,
  };
}

// ═══════════════════════════════════════
// System Prompt
// ═══════════════════════════════════════

function buildSystemPrompt(): string {
  return `Você é a MELHOR copywriter de Instagram do Brasil — especializada em moda feminina, 
com 10 anos de experiência criando legendas que geram vendas para lojas no Instagram.

Sua copy é MAGNÉTICA: para o scroll, gera salvamentos, compartilhamentos e vendas reais.
Você escreve como "amiga da lojista" — autêntica, calorosa, sem ser artificial.

═══ REGRA ABSOLUTA — VIOLAÇÃO = OUTPUT DESCARTADO ═══

🚫 NUNCA mencione nas legendas/captions/CTAs:
- Tipo de peça: calça, blusa, vestido, saia, conjunto, macacão, camisa, short, bermuda, regata, jaqueta, casaco, moletom, sapato, tênis, sandália etc.
- Cores: preto, branco, vermelho, azul, rosa, verde, bege, etc.
- Tecidos/Materiais: algodão, seda, linho, couro, jeans, renda, crochê, veludo, cetim, chiffon, etc.
- Estampas: floral, listrado, xadrez, estampado, liso, etc.
- Palavras genéricas de roupa: peça, roupa, look, outfit, produção

✅ Use APENAS termos emocionais/genéricos:
- "esse visual", "essa novidade", "essa escolha", "essa vibe"
- "confiança", "poder", "brilho", "liberdade", "atitude"
- "se sentir incrível", "arrasar", "se destacar"

═══ TÉCNICAS DE COPY OBRIGATÓRIAS ═══

1. HOOK FIRST — A primeira frase PARA o scroll:
   - Curiosidade: "Tem algo nessa foto que ninguém percebe…"
   - Emoção: "Aquela sensação de se sentir incrível ✨"
   - Pergunta: "Quem mais acorda querendo se sentir assim?"
   - Contrarian: "Todo mundo fala X, mas a verdade é Y"

2. SHORT. BREATHE. LAND:
   - Uma ideia por frase
   - Quebre linhas para dar ritmo
   - Frases curtas, depois uma explicação
   - Deixe os pontos importantes respirarem

3. CAPTION_ALTERNATIVA = TOM OPOSTO:
   - Se a principal é descontraída → a alternativa é sofisticada
   - Se a principal é urgente → a alternativa é contemplativa
   - Isso dá à lojista OPÇÃO de escolha

4. CTA QUE CONVERTE (max 8 palavras):
   - Pergunta: "O que vocês acham?"
   - Salvar: "Salva pra depois 📌"
   - Compartilhar: "Marca quem precisa ver"
   - DM: "Manda QUERO no direct"

═══ FORMATO DE RESPOSTA ═══
Responda SEMPRE em JSON puro válido. Sem markdown, sem \`\`\`, sem explicações.
Apenas o objeto JSON.`;
}

// ═══════════════════════════════════════
// User Prompt builder
// ═══════════════════════════════════════

function buildUserPrompt(input: CopywriterInput): string {
  const { analise } = input;

  // Construir contexto do produto SEM mencionar detalhes que o Sonnet não deve repetir
  const contextParts: string[] = [];
  if (analise.mood) contextParts.push(`Mood/vibe visual: ${analise.mood}`);
  if (analise.publico) contextParts.push(`Público-alvo: ${analise.publico}`);
  if (analise.estacao) contextParts.push(`Estação: ${analise.estacao}`);
  if (input.price) contextParts.push(`Preço: R$ ${input.price}`);
  if (input.storeName) contextParts.push(`Loja: ${input.storeName}`);

  const hour = new Date().getHours();
  const dayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });

  return `Crie copy profissional para Instagram baseado nesta foto de campanha de moda.

CONTEXTO DO PRODUTO (use para calibrar o TOM, mas NUNCA repita esses detalhes na copy):
${contextParts.join("\n")}
Contexto temporal: ${dayOfWeek}, ${hour}h

Gere o JSON com esta estrutura EXATA:
{
  "melhor_dia": "Dia ideal para postar + justificativa pelo mood (ex: 'Terça — seu público está planejando a semana')",
  "melhor_horario": "Horário ideal + justificativa (ex: '21h — quando relaxam no sofá e abrem o Insta')",
  "sequencia_sugerida": "Como usar as 3 fotos em sequência no feed/stories. NÃO mencione tipo de roupa, cor ou tecido.",
  "caption_sugerida": "Legenda MAGNÉTICA (150-250 chars com emojis). Hook + emoção + CTA. PROIBIDO mencionar peça/cor/tecido.",
  "caption_alternativa": "Segunda opção com TOM OPOSTO. Mesmas regras. 150-250 chars.",
  "tom_legenda": "Tom da voz em 3-5 palavras",
  "cta": "Call-to-action curto (max 8 palavras). Que gere AÇÃO IMEDIATA.",
  "dica_extra": "1 dica PRÁTICA de marketing para essa campanha (max 40 palavras).",
  "story_idea": "Ideia criativa para Story usando features do Instagram (max 40 palavras).",
  "hashtags": ["10-15 hashtags sem #. Mix: 3 alto alcance, 4 nicho fashion, 3 tendência, 2 comunidade"],
  "legendas": [
    { "foto": 1, "plataforma": "Instagram Feed", "legenda": "Legenda completa para foto 1", "hashtags": ["5-8 hashtags"], "dica": "Como usar esta legenda" },
    { "foto": 2, "plataforma": "WhatsApp", "legenda": "Mensagem para enviar no WhatsApp", "dica": "Como abordar o cliente" },
    { "foto": 3, "plataforma": "Stories", "legenda": "Texto do Story com CTA", "dica": "Feature do Instagram para usar" }
  ]
}`;
}
