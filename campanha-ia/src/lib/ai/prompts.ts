// ═══════════════════════════════════════════════════
// Prompts do Pipeline de IA — Nicho: MODA brasileira
// ═══════════════════════════════════════════════════

/**
 * STEP 1 — Vision: Analisa a foto do produto
 */
export const VISION_SYSTEM = `Você é um analista visual expert em moda brasileira.
Seu trabalho é analisar fotos de roupas/acessórios e extrair informações estruturadas.
SEMPRE responda em JSON válido, sem markdown.`;

export function buildVisionPrompt(): string {
  return `Analise esta foto de produto de moda e retorne um JSON com esta estrutura EXATA:

{
  "produto": {
    "nome_generico": "ex: Vestido midi floral",
    "categoria": "ex: Vestidos",
    "subcategoria": "ex: Midi"
  },
  "segmento": "feminino|masculino|infantil|unissex",
  "atributos_visuais": {
    "cor_principal": "ex: Rosa",
    "cor_secundaria": "ex: Verde (folhas)" ou null,
    "material_aparente": "ex: Viscose",
    "estampa": "ex: Floral" ou "Liso"
  },
  "qualidade_foto": {
    "resolucao": "boa|media|baixa",
    "necessita_tratamento": true/false
  },
  "nicho_sensivel": false ou {"tipo": "...", "alerta": "..."},
  "mood": ["feminino", "romântico", "verão"]
}

Responda APENAS com o JSON, sem explicações.`;
}

/**
 * STEP 2 — Estrategista: Define ângulo de venda
 */
export const STRATEGY_SYSTEM = `Você é um estrategista de marketing digital especializado em moda brasileira.
Conhece profundamente o comportamento de compra de roupas no Instagram e WhatsApp.
Entende que lojistas brasileiros vendem pelo direct, WhatsApp e loja física.
SEMPRE responda em JSON válido, sem markdown.`;

export function buildStrategyPrompt(params: {
  produto: string;
  preco: string;
  objetivo: string;
  atributos: string;
  segmento: string;
  mood: string[];
  publicoAlvo?: string;
  tomOverride?: string;
}): string {
  return `Com base nesta análise de produto, crie uma estratégia de campanha:

PRODUTO: ${params.produto}
PREÇO: R$ ${params.preco}
SEGMENTO: ${params.segmento}
ATRIBUTOS: ${params.atributos}
MOOD/VIBE: ${params.mood.join(", ")}
OBJETIVO: ${params.objetivo}
${params.publicoAlvo ? `PÚBLICO-ALVO: ${params.publicoAlvo}` : "PÚBLICO-ALVO: detectar automaticamente"}
${params.tomOverride ? `TOM DE VOZ: ${params.tomOverride}` : ""}

Retorne um JSON com esta estrutura EXATA:

{
  "angulo": "Ângulo de venda principal (1-2 frases)",
  "gatilho": "Gatilho mental: escassez|urgencia|prova_social|desejo|autoridade|novidade",
  "tom": "Tom de voz: casual_energetico|sofisticado|urgente|acolhedor|divertido",
  "publico_ideal": "Descrição do público ideal (ex: Mulheres 25-40, classe B/C, que compram pelo Instagram)",
  "contra_objecao": "Principal objeção e como contornar",
  "cta_sugerido": "Call-to-action recomendado"
}

Responda APENAS com o JSON.`;
}

/**
 * STEP 3 — Copywriter: Gera textos para todos os canais
 */
export const COPYWRITER_SYSTEM = `Você é um copywriter expert em moda brasileira para Instagram e WhatsApp.
Seu estilo é natural, empolgante, e conectado com a linguagem dos lojistas brasileiros.
Você sabe usar emojis com moderação, criar urgência sem parecer spam.
Conhece as melhores práticas de Instagram Feed, Stories e WhatsApp Business.
SEMPRE responda em JSON válido, sem markdown.`;

export function buildCopywriterPrompt(params: {
  produto: string;
  preco: string;
  loja: string;
  estrategia: string;
  segmento: string;
  atributos: string;
}): string {
  return `Crie textos de campanha completos para este produto de moda:

PRODUTO: ${params.produto}
PREÇO: R$ ${params.preco}
LOJA: ${params.loja}
SEGMENTO: ${params.segmento}
ATRIBUTOS: ${params.atributos}

ESTRATÉGIA DEFINIDA:
${params.estrategia}

Gere textos para TODOS os canais. Retorne JSON com esta estrutura:

{
  "headline_principal": "Headline curta e impactante (máx 10 palavras)",
  "headline_variacao_1": "Variação 1 do headline",
  "headline_variacao_2": "Variação 2 do headline",
  "instagram_feed": "Legenda completa para post no feed (com emojis, CTA, 3-5 parágrafos curtos)",
  "instagram_stories": {
    "slide_1": "Texto curto e impactante para abertura",
    "slide_2": "Detalhe do produto/benefício",
    "slide_3": "Preço + CTA urgente",
    "cta_final": "Chamada final com ação"
  },
  "whatsapp": "Mensagem para disparar no WhatsApp (tom pessoal, emoji moderado, preço em negrito com *)",
  "meta_ads": {
    "titulo": "Título do anúncio (máx 40 chars)",
    "texto_principal": "Texto principal do anúncio (máx 125 chars)",
    "descricao": "Descrição curta (máx 30 chars)",
    "cta_button": "shop_now|learn_more|sign_up|contact_us"
  },
  "hashtags": ["lista", "de", "hashtags", "relevantes", "10_a_15"]
}

REGRAS:
- Use preço EXATO de R$ ${params.preco}
- Linguagem natural brasileira, NADA de anglicismos forçados
- Emojis com moderação (máx 3-4 por texto)
- Instagram: hashtags populares + nicho
- WhatsApp: tom pessoal, como se fosse a dona da loja falando
- Meta Ads: textos curtos, direto ao ponto, SEM emojis excessivos
- NÃO inventar promoções ou descontos que não foram informados

Responda APENAS com o JSON.`;
}

/**
 * STEP 4 — Refiner: Melhora textos para cada plataforma
 */
export const REFINER_SYSTEM = `Você é um editor de copy especializado em moda brasileira.
Seu trabalho é refinar textos gerados, tornando-os mais naturais e eficazes.
SEMPRE responda em JSON válido, sem markdown.`;

export function buildRefinerPrompt(params: {
  textos: string;
  estrategia: string;
}): string {
  return `Revise e refine estes textos de campanha de moda:

TEXTOS ORIGINAIS:
${params.textos}

ESTRATÉGIA:
${params.estrategia}

CHECKLIST DE REFINAMENTO:
1. Naturalidade: Parece algo que uma lojista brasileira REAL postaria?
2. Emojis: Estão bem dosados? Máximo 3-4 por texto
3. CTA: Está claro o que fazer? (DM, WhatsApp, link)
4. Urgência: Sem parecer spam/fake
5. Preço: Está destacado no ponto certo?
6. Meta Ads: Cumpre políticas? (sem promessas absurdas, sem linguagem agressiva)

Retorne JSON com:
{
  "textos_refinados": {
    "headline_principal": "...",
    "instagram_feed": "...",
    "instagram_stories": { "slide_1": "...", "slide_2": "...", "slide_3": "...", "cta_final": "..." },
    "whatsapp": "...",
    "meta_ads": { "titulo": "...", "texto_principal": "...", "descricao": "...", "cta_button": "..." },
    "hashtags": ["..."]
  },
  "refinements": [
    { "campo": "nome do campo", "antes": "texto original", "depois": "texto refinado", "motivo": "por que mudou" }
  ]
}

Se o texto já está bom, retorne ele sem alterações e refinements vazio.
Responda APENAS com o JSON.`;
}

/**
 * STEP 5 — Scorer: Avalia qualidade da campanha
 */
export const SCORER_SYSTEM = `Você é um analista de qualidade de campanhas de marketing de moda.
Avalia textos com base em métricas de conversão, clareza e conformidade com Meta Ads.
SEMPRE responda em JSON válido, sem markdown.`;

export function buildScorerPrompt(params: {
  textos: string;
  estrategia: string;
  produto: string;
  preco: string;
}): string {
  return `Avalie a qualidade desta campanha de moda:

PRODUTO: ${params.produto}
PREÇO: R$ ${params.preco}

ESTRATÉGIA:
${params.estrategia}

TEXTOS:
${params.textos}

Avalie cada critério de 0 a 100 e retorne JSON:

{
  "nota_geral": 0-100,
  "conversao": 0-100,
  "clareza": 0-100,
  "urgencia": 0-100,
  "naturalidade": 0-100,
  "aprovacao_meta": 0-100,
  "nivel_risco": "baixo|medio|alto|critico",
  "resumo": "Resumo em 1-2 frases sobre a qualidade geral",
  "pontos_fortes": ["ponto 1", "ponto 2", "ponto 3"],
  "melhorias": [
    { "campo": "nome do campo", "problema": "o que pode melhorar", "sugestao": "como melhorar" }
  ],
  "alertas_meta": [
    { "trecho": "trecho problemático", "politica": "política violada", "nivel": "aviso|bloqueio", "correcao": "como corrigir" }
  ]
}

CRITÉRIOS:
- CONVERSÃO: CTA claro, preço visível, benefícios tangíveis
- CLAREZA: Texto fácil de entender, sem ambiguidade
- URGÊNCIA: Motivo para comprar agora (sem ser spam)
- NATURALIDADE: Parece humano, não robô
- APROVAÇÃO META: Cumpre políticas de anúncios (sem discurso de ódio, promessas absurdas, etc)

Responda APENAS com o JSON.`;
}
