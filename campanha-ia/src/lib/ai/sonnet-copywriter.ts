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

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropic } from "./clients";
import { withTimeout } from "./with-timeout";
import { computePromptVersion } from "./prompt-version";
import { captureError } from "@/lib/observability";

// ═══════════════════════════════════════
// Tipos de retorno
// ═══════════════════════════════════════
//
// D-16: schema é a fonte única de verdade. As interfaces `SonnetDicaLegenda` e
// `SonnetDicasPostagem` são derivadas via `z.infer` para garantir que prompt,
// tool_choice e tipo TS nunca dessincronizem (drift de schema vira erro de
// compilação na hora). O `SonnetInvalidOutputError` paraleliza o shape do
// `gemini-error-handler` para que `route.ts` possa tratá-los uniformemente.

const SonnetDicaLegendaSchema = z.object({
  foto: z.number().int().positive(),
  plataforma: z.string().min(1),
  legenda: z.string().min(1),
  hashtags: z.array(z.string()).optional(),
  dica: z.string().optional(),
});

export const SonnetDicasPostagemSchema = z.object({
  melhor_dia: z.string(),
  melhor_horario: z.string(),
  sequencia_sugerida: z.string(),
  caption_sugerida: z.string().min(1),
  caption_alternativa: z.string(),
  tom_legenda: z.string(),
  cta: z.string(),
  dica_extra: z.string(),
  story_idea: z.string(),
  hashtags: z.array(z.string()),
  legendas: z.array(SonnetDicaLegendaSchema).min(3),
});

export type SonnetDicaLegenda = z.infer<typeof SonnetDicaLegendaSchema>;
export type SonnetDicasPostagem = z.infer<typeof SonnetDicasPostagemSchema>;

export interface SonnetCopyResult {
  dicas_postagem: SonnetDicasPostagem;
  _usageMetadata?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ═══════════════════════════════════════
// D-16: Tool definition + classified error
// ═══════════════════════════════════════
//
// O nome `generate_dicas_postagem` é travado pelo CONTEXT.md (D-16) — não
// renomear sem coordenar. `tool_choice: { type: "tool", name: "..." }` força
// o Sonnet a emitir só blocos `tool_use`, sem texto natural antes; o JSON
// schema abaixo espelha `SonnetDicasPostagemSchema` (mesmos campos + mesmo
// `min`/required), porém em snake-case JSON Schema porque é o que a
// Anthropic API consome.
const generateDicasPostagemTool: Anthropic.Tool = {
  name: "generate_dicas_postagem",
  description:
    "Emit the structured marketing-copy package for one fashion product photo. " +
    "Use the loja's tone, the requested locale, and only attributes visible in the image. " +
    "Never invent sizes, fabrics or colors that are not visually verifiable.",
  input_schema: {
    type: "object",
    properties: {
      melhor_dia: { type: "string" },
      melhor_horario: { type: "string" },
      sequencia_sugerida: { type: "string" },
      caption_sugerida: { type: "string" },
      caption_alternativa: { type: "string" },
      tom_legenda: { type: "string" },
      cta: { type: "string" },
      dica_extra: { type: "string" },
      story_idea: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
      legendas: {
        type: "array",
        minItems: 3,
        items: {
          type: "object",
          properties: {
            foto: { type: "integer" },
            plataforma: { type: "string" },
            legenda: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } },
            dica: { type: "string" },
          },
          required: ["foto", "plataforma", "legenda"],
        },
      },
    },
    required: [
      "melhor_dia",
      "melhor_horario",
      "sequencia_sugerida",
      "caption_sugerida",
      "caption_alternativa",
      "tom_legenda",
      "cta",
      "dica_extra",
      "story_idea",
      "hashtags",
      "legendas",
    ],
  },
};

/**
 * Classified error — paralela a `GeminiBlockedError`/`GeminiServerError` em
 * `gemini-error-handler.ts` para o `route.ts` mapear status uniforme. NÃO é
 * retryable (D-16 / T-05-04: drift de schema não cura sozinho com retry; só
 * queima dinheiro). O `pipeline.ts:218-237` catch-all já fornece dicas
 * default quando esta exception sobe.
 */
export class SonnetInvalidOutputError extends Error {
  readonly code = "SONNET_INVALID_OUTPUT" as const;
  readonly retryable = false;
  readonly userMessage = "A IA retornou copy em formato inesperado. Tente novamente.";
  constructor(
    public readonly technicalMessage: string,
    cause?: unknown,
  ) {
    // Forward `cause` through the standard ES2022 Error options bag so it
    // lands on `this.cause` (the lib.es2022 base property) — using a
    // parameter property here would require `override` and create a
    // shadow field that diverges from `Error.cause` consumers (Sentry).
    super(technicalMessage, cause !== undefined ? { cause } : undefined);
    this.name = "SonnetInvalidOutputError";
  }
}

// ═══════════════════════════════════════
// Config
// ═══════════════════════════════════════

const MODEL = "claude-sonnet-4-6";

// ═══════════════════════════════════════
// D-15: prompt_version (cached at module load)
// ═══════════════════════════════════════
// Computed once at import — every cost-log row carries the SHA prefix of the
// system prompt that produced it, so prompt edits become correlatable to
// quality/cost shifts in api_cost_logs.metadata.prompt_version.
//
// Locale split because buildSystemPrompt branches on locale and the two
// prompts are materially different documents (PT-BR vs EN); a single hash
// would silently flip whenever traffic changed locale mix.
export const SONNET_PROMPT_VERSION_PT = computePromptVersion(buildSystemPrompt("pt-BR"));
export const SONNET_PROMPT_VERSION_EN = computePromptVersion(buildSystemPrompt("en"));

/** Returns the cached prompt_version for the locale used in the call. */
export function sonnetPromptVersionFor(locale: "pt-BR" | "en"): string {
  return locale === "en" ? SONNET_PROMPT_VERSION_EN : SONNET_PROMPT_VERSION_PT;
}

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
  /**
   * Idioma alvo do copy. PT-BR é o default (mercado primário, mantém o
   * comportamento histórico). EN é selecionado quando o app envia o header
   * `X-App-Locale: en`. As JSON keys da resposta NÃO mudam — o frontend
   * lê pelas mesmas chaves; só os valores em texto livre são traduzidos.
   */
  targetLocale?: "pt-BR" | "en";
}

// ═══════════════════════════════════════
// Função principal
// ═══════════════════════════════════════

export async function generateCopyWithSonnet(input: CopywriterInput): Promise<SonnetCopyResult> {
  const client = getAnthropic();
  const startTime = Date.now();

  const locale: "pt-BR" | "en" = input.targetLocale ?? "pt-BR";
  const systemPrompt = buildSystemPrompt(locale);
  const userPrompt = buildUserPrompt(input, locale);

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

  // ── D-16: tool_use + withTimeout (replaces inline timeout/retry/regex) ──
  //
  // Por que mudou:
  //   * `tool_choice: { type: "tool", name: "..." }` força o Sonnet a emitir
  //     APENAS um bloco `tool_use` com `input` na forma do schema — fim do
  //     parser regex que extraía JSON do meio do texto e morria silencioso.
  //   * `withTimeout(..., 30_000, "Sonnet Copy")` é o único liveness gate
  //     (T-05-03): a SDK Anthropic tem timeout interno de 10min, muito acima
  //     do `maxDuration = 300s` da rota Vercel. Sem ele, uma chamada
  //     pendurada come o budget inteiro.
  //   * Retry de transporte (408/409/429/5xx) já é feito pela SDK via
  //     `maxRetries: 2` em `clients.ts:getAnthropic` (Plan 03 / D-10). O
  //     loop manual com backoff foi DELETADO — duplicava esse comportamento
  //     com classificação ad-hoc de erro por regex em `.message`, o que
  //     nunca foi confiável.
  //   * Fallback de campos (caption padrão / legendas placeholder) também
  //     DELETADO. Per D-16 / T-05-04: drift de schema deve ser RUIDOSO
  //     (Sentry alert via SonnetInvalidOutputError), não silencioso. O
  //     orquestrador em `pipeline.ts:218-237` já tem o catch-all com
  //     `dicas` default — esse é o lugar certo pra fallback (orquestrador,
  //     não call-site).
  const response = await withTimeout(
    client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.7,
      system: systemPrompt,
      tools: [generateDicasPostagemTool],
      tool_choice: { type: "tool", name: "generate_dicas_postagem" },
      messages: [{ role: "user", content: contentParts }],
    }),
    30_000,
    "Sonnet Copy",
  );

  const durationMs = Date.now() - startTime;

  // Selecionar o bloco tool_use pelo nome — a SDK pode (em teoria) intercalar
  // text blocks; o parser antigo de regex falhava nesses casos. Com
  // tool_choice forçado isso é raro, mas o `find` por `name` é defensivo.
  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "generate_dicas_postagem",
  );
  if (!toolBlock) {
    const err = new SonnetInvalidOutputError("Sonnet did not emit the expected tool_use block");
    captureError(err, { extra: { stop_reason: response.stop_reason } });
    throw err;
  }

  // Boundary Zod: `tool_use.input` é `unknown` no nível de tipo — NUNCA
  // `as SonnetDicasPostagem`, sempre `safeParse`. Drift de schema (campo
  // novo/faltando) explode aqui em vez de corromper downstream.
  const parsed = SonnetDicasPostagemSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    const err = new SonnetInvalidOutputError(
      `Zod boundary validation failed: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`,
      parsed.error,
    );
    captureError(err, { extra: { input: toolBlock.input } });
    throw err;
  }

  const usage = {
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };

  console.log(
    `[Sonnet Copy] ✅ Copy em ${durationMs}ms | in=${usage.inputTokens} out=${usage.outputTokens} tokens`,
  );

  return {
    dicas_postagem: parsed.data,
    _usageMetadata: usage,
  };
}

// ═══════════════════════════════════════
// System Prompt
// ═══════════════════════════════════════

function buildSystemPrompt(locale: "pt-BR" | "en"): string {
  if (locale === "en") return buildSystemPromptEN();
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
- Transformação → "wide leg que alonga as pernas no espelho", "de casa pro trabalho sem trocar"
- Preço (APENAS se informado) → "Por menos de R$ 100", "Investimento: R$ 79,90"

Se o preço foi informado, considere usá-lo como gatilho.
Se NÃO foi informado, NUNCA invente preço — use outros gatilhos.

Identifique UM benefício real da peça (não característica):
- Característica (evitar): "calça wide leg cintura alta"
- Benefício (usar): "wide leg fluido que cria silhueta alongada no espelho"

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

function buildUserPrompt(input: CopywriterInput, locale: "pt-BR" | "en"): string {
  if (locale === "en") return buildUserPromptEN(input);

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
  "sequencia_sugerida": "Como usar a foto no feed/stories (e combinar com close-ups da peça)",
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

// ═══════════════════════════════════════
// English variant
// ═══════════════════════════════════════
//
// Why a separate prompt instead of "translate to English"?
//   Telling Claude to "write in English" works for grammar but loses the
//   sales register. The Brazilian market and the US market have different
//   idioms ("achei a calça que…" → "I just found the pants that…"),
//   different hashtag conventions (#OOTD vs #lookdodia), and different
//   social-platform metaphors. We mirror the structure (5 stages,
//   glossary, JSON shape) so the parser stays unchanged, but rewrite the
//   examples and vocabulary natively.
//
// Currency: we keep R$ because the storefront is Brazilian; an EN-speaking
// user buying through a BR shop still pays in BRL. Only formatting changes
// (decimal point optional but accepted).

function buildSystemPromptEN(): string {
  return `You are a fashion copywriter specialized in Instagram, Reels and WhatsApp content for online boutiques. Write in conversational US English with a sales-driven, friendly tone.

═══════════════════════════════════════════════════
STAGE 1 — PHOTO ANALYSIS (internal, mandatory)
═══════════════════════════════════════════════════

Before writing any copy, study the photo and mentally identify:

- GENDER: is the person in the photo a man or a woman? This drives EVERY pronoun and vocabulary choice.
- Item 1: [type] + [color] + [visible fabric] + [silhouette]
- Item 2: [type] + [color] + [visible fabric] + [silhouette]
- Item 3: (if any)
- How each piece is being worn (on the body, draped, knotted, open)
- Photo context (model, mannequin, environment)

ACCURACY RULES:
- If you're not SURE about a piece or color, describe it generically
  ("light top" instead of guessing "white silk top").
- NEVER invent items not visible in the photo.
- NEVER describe a fabric you can't visually identify.

═══════════════════════════════════════════════════
STAGE 2 — FASHION GLOSSARY (correct vocabulary)
═══════════════════════════════════════════════════

SET / COORD:
- "Set" or "matching set" → only when 2+ pieces share fabric, color or coordinated print.
- "Denim set" → only if 2+ pieces are denim.
- Jeans + white tank = NOT a set, it's "an outfit with jeans".
- "Look" / "outfit" → any combination of different pieces.

FABRICS (don't confuse):
- Knit ≠ sweatshirt ≠ jersey ≠ wool
- Linen ≠ viscose ≠ cotton ≠ silk
- Denim ≠ twill ≠ chambray

PIECES:
- Cardigan = open knit (with buttons or open front)
- Top ≠ shirt ≠ tee ≠ tank ≠ crop top
- Wide-leg ≠ palazzo ≠ straight ≠ flare ≠ skinny
- Halter, midi, fit-and-flare, bodycon, athleisure — use these where they fit.

COLORS (close but distinct shades):
- Caramel ≠ beige ≠ camel ≠ brown ≠ terracotta
- Off-white ≠ white ≠ ivory ≠ ecru
- Navy ≠ dark blue ≠ teal

═══════════════════════════════════════════════════
STAGE 3 — STRATEGIC CHOICE (before writing)
═══════════════════════════════════════════════════

Pick ONE mental trigger for this copy (just one, never mix):
- Scarcity → "last drop", "restocked and flying off"
- Social proof → "the fan-favorite is back", "everyone's been asking"
- Curiosity → "I just found the pants that…", "discovered the trick to…"
- Transformation → "wide-leg cut that elongates the leg line in the mirror", "office-to-dinner without a swap"
- Price (ONLY if provided) → "Under R$ 100", "Yours for R$ 79.90"

If the price was provided, consider using it as a trigger.
If NOT provided, NEVER make one up — use the other triggers.

Identify ONE real benefit of the piece (not a feature):
- Feature (avoid): "high-waisted wide-leg pants"
- Benefit (use): "fluid wide-leg cut that creates an elongated silhouette in the mirror"

═══════════════════════════════════════════════════
STAGE 4 — COPY RULES
═══════════════════════════════════════════════════

STRUCTURE:
- 1st line = scroll-stopping hook (don't describe, provoke)
- 3 to 5 lines total
- EACH SENTENCE on its own line (use \\n between sentences) — readability is king on Instagram
- Short sentences (max 12 words each)
- Swap features for BENEFITS every time
- Specific CTA at the end

GOOD vs BAD CTA:
✅ "DM me JEANS and I'll send you the sizes"
✅ "Comment I WANT IT with your size"
❌ "Comment I WANT IT" (generic, no clear action)
❌ "Available now" (no action)

EMOJIS:
- Max 2 per copy, well placed
- Use emojis that complement, not decorate (👖 🤎 ✨ 👀 🔥)

OPTION B = OPPOSITE TONE:
- If A is urgent → B is aspirational
- If A is playful → B is sophisticated

═══════════════════════════════════════════════════
STAGE 5 — AVOID (clichés that kill copy)
═══════════════════════════════════════════════════

❌ "Obsessed 🔥" / "Outfit goals" / "Available now"
❌ "Don't miss out" / "Run, won't last" / "One of one"
❌ "Speechless" / "Iconic" / "Literally everything"

⚠️ NEVER MENTION SIZES:
- NEVER cite sizes (XS, S, M, L, XL, 0, 2, 4, 36, 38, "from XS to XL", "all sizes", etc.).
- You DON'T know which sizes are available — making it up is a hard error.
- If the CTA needs to be size-related, say "DM your size and I'll check" or "tell me your size in the comments".
- NEVER say "available XS to XL", "we have 0 to 14", or any variation.

═══════════════════════════════════════════════════
GOOD EXAMPLE ✅ (target quality)
═══════════════════════════════════════════════════

PHOTO: white ribbed tank + blue wide-leg jeans + caramel cardigan over the shoulders

COPY (note the line breaks between sentences):
"I found the pants that snatch without squeezing 👖\\nWide-leg, high-waisted — sits right on every body.\\nThrow on a basic white tank and you're set.\\nThe cardigan over the shoulders adds that quiet-luxury vibe.\\nDM me WIDE and I'll send you everything 🤎"

═══════════════════════════════════════════════════
BAD EXAMPLE ❌ (DO NOT)
═══════════════════════════════════════════════════

"This denim set is EVERYTHING 🔥
Tank + pants + cardigan = outfit goals!
Limited stock. Comment I WANT IT 👇"

Problems:
- "Denim set" WRONG (only the pants are denim)
- "Everything 🔥" cliché
- "Outfit goals" cliché
- No hook, no benefit, no trigger
- Generic CTA

═══════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════

IMPORTANT — GENDER (identify from the photo):
- If the person is a MAN: use masculine vocabulary, masculine hashtags (#mensfashion, #menstyle), masculine tone.
- If the person is a WOMAN: use feminine vocabulary, feminine hashtags (#womensfashion, #styleinspo), feminine tone.
- NEVER use feminine terms for menswear or vice versa.
- If there's no person in the photo or you can't tell, use neutral terms.

CRITICAL — JSON KEYS STAY THE SAME:
- The JSON keys (caption_sugerida, melhor_dia, melhor_horario, tom_legenda, etc) MUST stay in Portuguese — the frontend reads by these keys.
- ONLY the VALUES are written in English.
- Hashtags in English (#OOTD, #styleinspo, #fashionfind, #mensstyle, etc).
- "plataforma" values: "Instagram Feed", "WhatsApp", "Stories" — these are international names, keep them.

Reply ONLY with raw JSON. No markdown, no \`\`\`, no internal analysis, no explanation.`;
}

function buildUserPromptEN(input: CopywriterInput): string {
  const contextParts: string[] = [];
  if (input.price) contextParts.push(`Price: R$ ${input.price}`);
  if (input.storeName) contextParts.push(`Store: ${input.storeName}`);
  if (input.targetAudience) {
    contextParts.push(
      `Target audience: ${input.targetAudience} — adapt vocabulary and references to this profile`,
    );
  }
  if (input.toneOverride) {
    contextParts.push(
      `Required tone: ${input.toneOverride} — write IN this tone, don't invent another`,
    );
  }

  const hour = new Date().getHours();
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const context = contextParts.length > 0 ? `\n${contextParts.join("\n")}` : "";

  return `Analyze the PHOTO following the 5 stages from the system prompt.
${context}
Time context: ${dayOfWeek}, ${hour}:00

If the photo doesn't clearly show clothing, use generic terms ("this drop", "this find").

Generate the JSON (keys in Portuguese, values in English):
{
  "melhor_dia": "Day + short justification",
  "melhor_horario": "Time + short justification",
  "sequencia_sugerida": "How to use the photo across feed/stories (paired with close-ups of the piece)",
  "caption_sugerida": "SALES caption (200-300 chars, max 2 emojis, hook + benefit + specific CTA. Use \\n between every sentence)",
  "caption_alternativa": "Second option with OPPOSITE tone. 200-300 chars. Use \\n between sentences.",
  "tom_legenda": "Voice tone in 3-5 words",
  "cta": "Short, specific call-to-action (max 6 words)",
  "dica_extra": "1 PRACTICAL marketing tip (max 40 words)",
  "story_idea": "Creative Story idea (max 40 words)",
  "hashtags": ["EXACTLY 5 hashtags without #, mix: 2 high-volume (>500k posts, e.g. womensfashion) + 3 niche to the piece (e.g. stripedtee)"],
  "legendas": [
    { "foto": 1, "plataforma": "Instagram Feed", "legenda": "200-300 chars — hook + benefit + CTA. Use \\n between sentences. No hashtags here.", "hashtags": ["EXACTLY 5 hashtags without #: 2 high-volume + 3 niche"], "dica": "How to use on feed" },
    { "foto": 2, "plataforma": "WhatsApp", "legenda": "MAX 200 chars — direct, personal 1:1 message tone. If price was given, include it. Ex: 'Hey! Just dropped [piece] for R$ X. Want a peek?'", "dica": "Approach" },
    { "foto": 3, "plataforma": "Stories", "legenda": "MAX 100 chars — short line + urgent CTA, fits the screen", "dica": "Insta feature to use" }
  ]
}`;
}
