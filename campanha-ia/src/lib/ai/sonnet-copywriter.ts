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

  // Envia imagem ao Sonnet para identificação visual própria
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

  contentParts.push({ type: "text", text: userPrompt });

  // Sonnet call com timeout de 30s + 1 retry
  const callSonnet = () => client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 0.7,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: contentParts,
      },
    ],
  });

  let response: Anthropic.Message;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sonnet timeout (30s)")), 30_000)
    );
    response = await Promise.race([callSonnet(), timeoutPromise]);
  } catch (firstErr) {
    console.warn(`[Sonnet Copy] ⚠️ Tentativa 1 falhou: ${firstErr instanceof Error ? firstErr.message : firstErr}. Retrying...`);
    // Retry 1x
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Sonnet timeout retry (30s)")), 30_000)
      );
      response = await Promise.race([callSonnet(), timeoutPromise]);
    } catch (retryErr) {
      console.error(`[Sonnet Copy] ❌ Retry também falhou: ${retryErr instanceof Error ? retryErr.message : retryErr}`);
      throw retryErr;
    }
  }

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

  // Nota: Sonnet agora PODE mencionar peça/cor/tecido.
  // A validação de "forbidden" foi removida — Sonnet identifica visualmente.

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
  return `Você é a MELHOR copywriter de Instagram do Brasil — especializada em VENDER moda feminina.
10 anos criando legendas que geram vendas reais para lojistas no Instagram.

Sua copy é VENDEDORA. Não é poesia. Não é filosofia. É copy que faz a seguidora PARAR, QUERER e COMPRAR.
Você escreve como "amiga vendedora" — direta, entusiasmada, com urgência natural.

═══ REGRA DE PRODUTO ═══

Você vai receber a FOTO do produto. OLHE a foto com atenção e identifique:
- Tipo de peça (vestido, calça, blusa, conjunto, etc.)
- Cor principal
- Tecido/material (se visível)
- Detalhes marcantes (renda, botões, decote, estampa, etc.)

🎯 REGRA DE CONFIANÇA:
- Se você tem CERTEZA do que é a peça → MENCIONE no copy! ("Esse vestido", "Essa calça")
- Se você tem CERTEZA da cor → MENCIONE! ("Esse pretinho", "Nesse tom de rosa")
- Se NÃO tem certeza (foto escura, ângulo ruim) → fique genérico ("essa novidade", "esse achado")
- NUNCA invente. Se não vê, não mencione.

═══ EXEMPLO DE COPY RUIM ❌ (genérico demais, não vende) ═══

"Aquela sensação de estar em casa mesmo longe dela ✨
Para quem valoriza o bem-estar em cada escolha 🌿"

PROBLEMA: não diz NADA sobre o produto. Parece meditação.

═══ EXEMPLO DE COPY BOM ✅ (específico + vendedor) ═══

EXEMPLO 1 (com certeza da peça):
"Esse vestido tá DEMAIS 🔥
Olha esse caimento… parece que foi feito pra você!
Poucas unidades. Comenta EU QUERO 👇"

EXEMPLO 2 (com certeza da cor):
"Pretinho básico? Não. Pretinho PODEROSO ✨
Esse aqui você vai querer em todas as cores.
Corre pro direct! 💬"

EXEMPLO 3 (sem certeza → genérico):
"Gente, eu AVISEI que ia chegar 🔥
E quando vocês virem de perto… 😍
Quem quer? Manda QUERO no direct 👇"

EXEMPLO 4 (conjunto):
"Conjunto que veste fácil e vende sozinho 😍
Suas clientes vão PIRAR. Acredita.
Disponível agora — manda um oi! 💬"

═══ TÉCNICAS OBRIGATÓRIAS ═══

1. HOOK QUE PARA O SCROLL (primeira frase):
   - Urgência: "Gente, CORRAM" / "Tá voando da loja"
   - Curiosidade: "Sabe o que tá fazendo sucesso?"
   - Produto: "Esse vestido… gente." / "Olha essa calça!"

2. FRASES CURTAS E DIRETAS:
   - Max 12 palavras por frase
   - Emojis estratégicos (🔥 ✨ 💕 👇 😍)

3. CTA QUE GERA AÇÃO (max 6 palavras):
   - "Comenta EU QUERO 👇"
   - "Corre pro direct! 💬"
   - "Salva e marca a amiga 📌"

4. OPÇÃO B = TOM OPOSTO:
   - Se A é urgente → B é aspiracional
   - Se A é divertida → B é sofisticada

═══ FORMATO ═══
Responda em JSON puro. Sem markdown, sem \`\`\`, sem explicação.`;
}

// ═══════════════════════════════════════
// User Prompt builder
// ═══════════════════════════════════════

function buildUserPrompt(input: CopywriterInput): string {
  const { analise } = input;

  // Passa a análise do Gemini como REFERÊNCIA (não como verdade absoluta)
  const contextParts: string[] = [];
  if (analise.tipo_peca) contextParts.push(`Análise prévia identificou: ${analise.tipo_peca}`);
  if (analise.cor_principal?.nome) contextParts.push(`Cor principal (referência): ${analise.cor_principal.nome}`);
  if (analise.tecido) contextParts.push(`Tecido (referência): ${analise.tecido}`);
  if (analise.mood) contextParts.push(`Mood/vibe: ${analise.mood}`);
  if (analise.publico) contextParts.push(`Público-alvo: ${analise.publico}`);
  if (analise.estacao) contextParts.push(`Estação: ${analise.estacao}`);
  if (analise.detalhes?.length) contextParts.push(`Detalhes: ${analise.detalhes.join(", ")}`);
  if (input.price) contextParts.push(`Preço: R$ ${input.price}`);
  if (input.storeName) contextParts.push(`Loja: ${input.storeName}`);

  const hour = new Date().getHours();
  const dayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });

  return `OLHE A FOTO DO PRODUTO com atenção. Identifique você mesma o tipo de peça, cor e detalhes.

REFERÊNCIA DA ANÁLISE PRÉVIA (confira com seus próprios olhos — pode discordar):
${contextParts.join("\n")}
Contexto temporal: ${dayOfWeek}, ${hour}h

IMPORTANTE:
- Se você TEM CERTEZA do tipo de peça (vestido, calça, blusa, conjunto etc.) → USE na copy!
- Se você TEM CERTEZA da cor → USE na copy!
- Se NÃO TEM CERTEZA → fique genérica ("essa novidade", "esse achado")
- NUNCA invente algo que não vê na foto.

Gere o JSON:
{
  "melhor_dia": "Dia + justificativa (ex: 'Terça — público planejando a semana')",
  "melhor_horario": "Horário + justificativa (ex: '19h — saída do trabalho, scrollando')",
  "sequencia_sugerida": "Como usar as 3 fotos no feed/stories",
  "caption_sugerida": "Legenda VENDEDORA (150-250 chars, emojis, hook + CTA). Pode mencionar a peça/cor se tiver certeza.",
  "caption_alternativa": "Segunda opção com TOM OPOSTO. 150-250 chars.",
  "tom_legenda": "Tom da voz em 3-5 palavras",
  "cta": "Call-to-action curto (max 6 palavras)",
  "dica_extra": "1 dica PRÁTICA de marketing (max 40 palavras)",
  "story_idea": "Ideia criativa para Story (max 40 palavras)",
  "hashtags": ["5-8 hashtags sem #, focadas e específicas"],
  "legendas": [
    { "foto": 1, "plataforma": "Instagram Feed", "legenda": "Legenda completa", "hashtags": ["5-8"], "dica": "Como usar" },
    { "foto": 2, "plataforma": "WhatsApp", "legenda": "Mensagem WhatsApp", "dica": "Abordagem" },
    { "foto": 3, "plataforma": "Stories", "legenda": "Texto do Story", "dica": "Feature do Insta" }
  ]
}`;
}
