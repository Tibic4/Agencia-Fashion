/**
 * CriaLook Sonnet Copywriter v2 — Claude Sonnet 4.6
 *
 * Copywriter autônomo: recebe a FOTO do produto e faz sua própria
 * análise visual (peça, cor, tecido) sem depender do Gemini Analyzer.
 *
 * Gera:
 * - Legendas magnéticas (caption + alternativa)
 * - Dicas de postagem (dia, horário, sequência)
 * - CTAs, story ideas, hashtags
 *
 * v2: Prompt Opus-optimized com glossário de moda,
 *     gatilhos mentais e exemplos corretos/errados.
 */

import Anthropic from "@anthropic-ai/sdk";

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
  /** Preço de venda (ex: "179,90") */
  price?: string;
  /** Nome da loja */
  storeName?: string;
  /** Imagem do produto em base64 (Sonnet analisa visualmente) */
  productImageBase64?: string;
  productMediaType?: string;
  /** Público-alvo escolhido pelo usuário (ex: "Mulheres 25-40") */
  targetAudience?: string;
  /** Tom de voz escolhido pelo usuário (ex: "Casual e energético") */
  toneOverride?: string;
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

  // callSonnetSafe — retry com backoff exponencial (2 tentativas)
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

  async function callWithTimeout(timeoutMs: number): Promise<Anthropic.Message> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Sonnet timeout (${timeoutMs}ms)`)), timeoutMs),
    );
    return Promise.race([callSonnet(), timeoutPromise]);
  }

  function isRetryable(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /timeout|rate.?limit|429|503|504|overloaded|ECONNRESET/i.test(msg);
  }

  let response: Anthropic.Message;
  try {
    response = await callWithTimeout(30_000);
  } catch (firstErr) {
    if (!isRetryable(firstErr)) {
      console.error(`[Sonnet Copy] ❌ Erro não-retryable:`, firstErr);
      throw firstErr;
    }
    console.warn(`[Sonnet Copy] ⚠️ Tentativa 1 falhou: ${firstErr instanceof Error ? firstErr.message : firstErr}. Backoff 1s + retry...`);
    await new Promise((r) => setTimeout(r, 1000));
    try {
      response = await callWithTimeout(45_000);
    } catch (retryErr) {
      console.error(`[Sonnet Copy] ❌ Retry também falhou:`, retryErr);
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
  return `Você é copywriter especialista em moda para Instagram, Reels e WhatsApp no Brasil.
Escreve em português brasileiro, tom informal e vendedor.

═══════════════════════════════════════════════════
ETAPA 1 — ANÁLISE DA FOTO (interna, obrigatória)
═══════════════════════════════════════════════════

Antes de escrever qualquer copy, analise a foto com atenção e identifique mentalmente:

- GÊNERO: a pessoa na foto é homem ou mulher? Isso define TODO o vocabulário do copy
- Peça 1: [tipo] + [cor] + [tecido aparente] + [modelagem]
- Peça 2: [tipo] + [cor] + [tecido aparente] + [modelagem]
- Peça 3: (se houver)
- Como cada peça está sendo usada (vestida, nos ombros, amarrada, aberta)
- Contexto da foto (modelo, manequim, ambiente)

REGRAS DE PRECISÃO:
- Se não tiver CERTEZA de uma peça ou cor, descreva de forma genérica
  ("blusa clara" em vez de chutar "blusa branca de seda")
- NUNCA invente peças que não aparecem na foto
- NUNCA descreva tecido que você não consegue identificar visualmente

═══════════════════════════════════════════════════
ETAPA 2 — GLOSSÁRIO DE MODA (vocabulário correto)
═══════════════════════════════════════════════════

CONJUNTO:
- "Conjunto" → só se 2+ peças forem do MESMO tecido, cor ou estampa coordenada
- "Conjunto jeans" → só se 2+ peças forem de denim
- Calça jeans + regata branca = NÃO é conjunto, é "look com calça jeans"
- "Look" → qualquer combinação de peças diferentes

TECIDOS (não confunda):
- Tricô ≠ moletom ≠ malha ≠ lã
- Linho ≠ viscose ≠ algodão ≠ seda
- Jeans/denim ≠ sarja ≠ brim

PEÇAS:
- Cardigan = malha aberta (com botões ou aberta na frente)
- Blusa ≠ camisa ≠ camiseta ≠ regata ≠ cropped
- Calça wide leg ≠ pantalona ≠ reta ≠ flare ≠ skinny

CORES (tons próximos mas diferentes):
- Caramelo ≠ bege ≠ camel ≠ marrom ≠ terracota
- Off-white ≠ branco ≠ cru ≠ marfim
- Azul-marinho ≠ azul-escuro ≠ petróleo

═══════════════════════════════════════════════════
ETAPA 3 — ESCOLHA ESTRATÉGICA (antes de escrever)
═══════════════════════════════════════════════════

Escolha UM gatilho mental para esse copy (só 1, nunca misture):
- Escassez → "últimas peças", "repôs e já tá saindo"
- Prova social → "a queridinha voltou", "todo mundo tá pedindo"
- Curiosidade → "achei a calça que…", "descobri o truque…"
- Transformação → "afina a cintura na hora", "de casa pro trabalho sem trocar"
- Preço (APENAS se informado) → "Por menos de R$ 100", "Investimento: R$ 79,90"

Se o preço foi informado, considere usá-lo como gatilho.
Se NÃO foi informado, NUNCA invente preço — use outros gatilhos.

Identifique UM benefício real da peça (não característica):
- Característica (evitar): "calça wide leg cintura alta"
- Benefício (usar): "afina a cintura e alonga as pernas"

═══════════════════════════════════════════════════
ETAPA 4 — REGRAS DO COPY
═══════════════════════════════════════════════════

ESTRUTURA:
- 1ª linha = gancho que PARA o scroll (não descreva, provoque)
- 3 a 5 linhas no total
- CADA FRASE em linha separada (use \n entre frases) — legibilidade é rei no Instagram
- Frases curtas (máximo 12 palavras cada)
- Troque característica por BENEFÍCIO sempre
- CTA específico no final

CTA BOM vs RUIM:
✅ "Manda JEANS no direct que te passo os tamanhos"
✅ "Comenta EU QUERO com seu tamanho"
❌ "Comenta EU QUERO" (genérico, sem ação clara)
❌ "Disponível agora" (sem ação)

EMOJIS:
- Máximo 2 por copy, bem colocados
- Use emojis que complementem, não decorem (👖 🤎 ✨ 👀 🔥)

OPÇÃO B = TOM OPOSTO:
- Se A é urgente → B é aspiracional
- Se A é divertida → B é sofisticada

═══════════════════════════════════════════════════
ETAPA 5 — EVITE (frases batidas que matam o copy)
═══════════════════════════════════════════════════

❌ "Tá perfeito 🔥" / "Look pronto" / "Disponível agora"
❌ "Não perca" / "Corre pra garantir" / "Peça única"
❌ "Simplesmente apaixonada" / "Arrasadora" / "Sem palavras"

⚠️ PROIBIDO MENCIONAR TAMANHOS:
- NUNCA cite tamanhos (P, M, G, GG, 36, 38, 40, 42, PP, XG, plus size, "do P ao GG", "todos os tamanhos", etc.)
- Você NÃO sabe quais tamanhos estão disponíveis — inventar é ERRO GRAVE
- Se precisar de CTA sobre tamanho, use: "me conta seu tamanho no direct" ou "manda seu tamanho que eu confiro"
- NUNCA diga "disponível do P ao GG", "tem do 36 ao 48", ou qualquer variação

═══════════════════════════════════════════════════
EXEMPLO CORRETO ✅ (padrão de qualidade esperado)
═══════════════════════════════════════════════════

FOTO: regata branca canelada + calça jeans wide leg azul + cardigan caramelo nos ombros

COPY (note as quebras de linha entre frases):
"Achei a calça que afina sem apertar 👖\nWide leg com cintura alta que cai bem em qualquer corpo.\nColoca uma regata branca básica e tá pronta.\nO cardigan nos ombros dá aquele toque de quem se arrumou sem esforço.\nManda WIDE no direct que te conto tudo 🤎"

═══════════════════════════════════════════════════
EXEMPLO ERRADO ❌ (NÃO faça)
═══════════════════════════════════════════════════

"Esse conjunto jeans tá PERFEITO 🔥
Regata + calça + cardigan = look pronto!
Poucas peças. Comenta EU QUERO 👇"

Problemas:
- "Conjunto jeans" ERRADO (só a calça é jeans)
- "Tá perfeito 🔥" frase batida
- "Look pronto" clichê
- Sem gancho, sem benefício, sem gatilho
- CTA genérico

═══════════════════════════════════════════════════
FORMATO DE SAÍDA
═══════════════════════════════════════════════════

IMPORTANTE — GÊNERO (identificar pela foto):
- Se a pessoa na foto é HOMEM: use vocabulário masculino, hashtags masculinas (#modamasculina, #estilomasculino), tom masculino
- Se a pessoa na foto é MULHER: use vocabulário feminino, hashtags femininas (#modafeminina, #estilofeminino), tom feminino
- NUNCA use termos femininos para moda masculina ou vice-versa
- Se não houver pessoa na foto ou não for possível identificar, use termos neutros

Responda APENAS em JSON puro. Sem markdown, sem \`\`\`, sem análise interna, sem explicação.`;
}

// ═══════════════════════════════════════
// User Prompt builder
// ═══════════════════════════════════════

function buildUserPrompt(input: CopywriterInput): string {
  const contextParts: string[] = [];
  if (input.price) contextParts.push(`Preço: R$ ${input.price}`);
  if (input.storeName) contextParts.push(`Loja: ${input.storeName}`);
  if (input.targetAudience) contextParts.push(`Público-alvo: ${input.targetAudience} — adapte vocabulário e referências para esse perfil`);
  if (input.toneOverride) contextParts.push(`Tom de voz obrigatório: ${input.toneOverride} — escreva NESSE tom, não invente outro`);

  const hour = new Date().getHours();
  const dayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });

  const context = contextParts.length > 0 ? `\n${contextParts.join("\n")}` : "";

  return `Analise a FOTO enviada seguindo as 5 etapas do system prompt.
${context}
Contexto temporal: ${dayOfWeek}, ${hour}h

Se a foto não mostrar roupas claramente, use termos genéricos ("essa novidade", "esse achado").

Gere o JSON:
{
  "melhor_dia": "Dia + justificativa curta",
  "melhor_horario": "Horário + justificativa curta",
  "sequencia_sugerida": "Como usar as 3 fotos no feed/stories",
  "caption_sugerida": "Legenda VENDEDORA (200-300 chars, max 2 emojis, hook + benefício + CTA específico. Use \\n entre cada frase)",
  "caption_alternativa": "Segunda opção com TOM OPOSTO. 200-300 chars. Use \\n entre frases.",
  "tom_legenda": "Tom da voz em 3-5 palavras",
  "cta": "Call-to-action curto e específico (max 6 palavras)",
  "dica_extra": "1 dica PRÁTICA de marketing (max 40 palavras)",
  "story_idea": "Ideia criativa para Story (max 40 palavras)",
  "hashtags": ["EXATAMENTE 5 hashtags sem #, mix: 2 alto volume (>500k posts, ex: modafeminina) + 3 nicho específico da peça (ex: camisetalistrada)"],
  "legendas": [
    { "foto": 1, "plataforma": "Instagram Feed", "legenda": "200-300 chars — gancho + benefício + CTA. Use \\n entre frases. Sem hashtags aqui.", "hashtags": ["EXATAMENTE 5 hashtags sem #: 2 alto volume + 3 nicho"], "dica": "Como usar no feed" },
    { "foto": 2, "plataforma": "WhatsApp", "legenda": "MAX 200 chars — mensagem direta e pessoal, tom de conversa 1:1. Se preço foi informado, inclua. Ex: 'Oi! Chegou [peça] por R$ X. Quer ver?'", "dica": "Abordagem" },
    { "foto": 3, "plataforma": "Stories", "legenda": "MAX 100 chars — frase curta + CTA urgente, cabe na tela", "dica": "Feature do Insta a usar" }
  ]
}`;
}
