# 🤖 Pipeline de IA — CriaLook v2.0

> **Arquitetura Híbrida**: Gemini 2.5 Flash/Pro + Claude Sonnet 4
> **Custo médio por campanha**: ~R$ 0,09  
> **Tempo médio**: ~15-25 segundos  
> **Arquivo principal**: `src/lib/ai/pipeline.ts`

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [APIs e Modelos Utilizados](#apis-e-modelos-utilizados)
3. [Fluxo do Pipeline — Passo a Passo](#fluxo-do-pipeline--passo-a-passo)
4. [Geração de Imagem (Virtual Try-On)](#geração-de-imagem-virtual-try-on)
5. [Provider Abstraction Layer](#provider-abstraction-layer)
6. [Custos Detalhados](#custos-detalhados)
7. [Variáveis de Ambiente](#variáveis-de-ambiente)
8. [Diagramas de Fluxo](#diagramas-de-fluxo)

---

## Visão Geral

A pipeline recebe uma **foto de roupa + preço** e gera uma **campanha de marketing completa** em ~20 segundos:

- 📸 Análise visual do produto (cor, tecido, estilo, segmento)
- 🧠 Estratégia de marketing (público, posicionamento, tom)
- ✍️ Textos para Instagram, WhatsApp e Meta Ads
- 🔄 Refinamento dos textos (coerência, tom, CTA)
- ⭐ Score de qualidade (0-100)
- 👗 Foto de modelo vestindo a peça (opcional)

### Princípios de Design

| Princípio | Implementação |
|-----------|--------------|
| **Custo mínimo** | Gemini Flash para steps analíticos (10x mais barato que Claude) |
| **Qualidade máxima** | Claude Sonnet 4 para copywriting (tom brasileiro superior) |
| **Raciocínio forte** | Gemini Pro para estratégia (planejamento complexo) |
| **Resiliência** | Retry com backoff exponencial em todos os steps |
| **Velocidade** | Refiner ∥ Scorer rodam em paralelo (`Promise.all`) |
| **Validação** | Zod schemas em todas as etapas |

---

## APIs e Modelos Utilizados

### 1. Google Gemini API (`@google/genai`)

| Modelo | Steps | Uso |
|--------|-------|-----|
| **Gemini 2.5 Flash** | Vision, Refiner, Scorer | Velocidade + custo baixo, structured output nativo |
| **Gemini 2.5 Pro** | Strategy | Raciocínio complexo para planejamento de campanha |
| **Gemini 3.1 Flash Image** (Nano Banana 2) | Virtual Try-On (opção B) | Geração de imagem de modelo vestindo a peça |

- **API Key**: `GOOGLE_AI_API_KEY`
- **SDK**: `@google/genai` (Google AI JavaScript SDK)
- **Pricing page**: https://ai.google.dev/pricing

### 2. Anthropic Claude API (`@anthropic-ai/sdk`)

| Modelo | Steps | Uso |
|--------|-------|-----|
| **Claude Sonnet 4** (`claude-sonnet-4-20250514`) | Copywriter | Tom de voz "lojista brasileira", textos persuasivos |

- **API Key**: `ANTHROPIC_API_KEY`
- **SDK**: `@anthropic-ai/sdk`
- **Pricing page**: https://www.anthropic.com/pricing

### 3. Fashn.ai API (Virtual Try-On)

| Endpoint | Créditos | Custo USD | Custo BRL | Uso |
|----------|----------|-----------|-----------|-----|
| `product-to-model` | 1 | $0.075 | R$ 0,44 | Gerar modelo vestindo peça (sem banco) |
| `tryon-max` | 4 | $0.300 | R$ 1,74 | Vestir peça em modelo do banco |
| `edit` (1k/fast) | 1 | $0.075 | R$ 0,44 | Alisar roupa + aplicar fundo |
| `edit` (2k/quality) | 3 | $0.225 | R$ 1,31 | Edit alta qualidade |
| `background-remove` | 1 | $0.075 | R$ 0,44 | Recorte PNG transparente |
| `model-create` | var. | ~$0.075+ | R$ 0,44+ | Criar modelo personalizada |

- **API Key**: `FASHN_API_KEY`
- **Base URL**: `https://api.fashn.ai/v1`
- **Docs**: https://docs.fashn.ai
- **Arquivo**: `src/lib/fashn/client.ts`

### Fallback Automático

- Se `GOOGLE_AI_API_KEY` não existe → **tudo roda no Claude** (mais caro, ~R$ 0,33/campanha)
- Se `ANTHROPIC_API_KEY` não existe → Copywriter usa **Gemini Pro** como fallback
- Se nenhuma key existe → **Demo mode** (dados mock, sem chamada real)

---

## Fluxo do Pipeline — Passo a Passo

### STEP 1: 👁️ Vision (Análise Visual)

> **O que faz**: Analisa a foto do produto e identifica todas as características visuais.

| Campo | Valor |
|-------|-------|
| **API** | Google Gemini |
| **Modelo** | `gemini-2.5-flash` |
| **Tipo** | Multimodal (imagem + texto) |
| **Temperatura** | 0.3 (determinístico) |
| **Max Tokens** | 1.024 |
| **Structured Output** | ✅ Sim (Zod → responseSchema nativo) |

**Input**: Foto do produto em base64 + prompt descritivo  
**Output** (JSON validado por Zod):

```json
{
  "produto": {
    "nome_generico": "Blusa cropped de tricô",
    "categoria": "blusa"
  },
  "atributos_visuais": {
    "cor_principal": "rosa bebê",
    "cores_secundarias": ["branco"],
    "padrao": "liso",
    "tecido_aparente": "tricô canelado",
    "caimento": "ajustado",
    "comprimento": "cropped",
    "manga": "manga longa",
    "decote": "gola alta",
    "detalhes": ["barra canelada", "punhos canelados"]
  },
  "segmento": "casual_chic",
  "mood": "romântico",
  "faixa_etaria_provavel": "18-35"
}
```

**Arquivo do prompt**: `src/lib/ai/prompts.ts` → `VISION_SYSTEM` + `buildVisionPrompt()`

---

### STEP 2: 🧠 Strategy (Estratégia de Marketing)

> **O que faz**: Cria a estratégia de campanha baseada na análise visual + objetivo + público.

| Campo | Valor |
|-------|-------|
| **API** | Google Gemini |
| **Modelo** | `gemini-2.5-pro` |
| **Tipo** | Texto (sem imagem) |
| **Temperatura** | 0.8 (criativo mas consistente) |
| **Structured Output** | ✅ Sim |

**Input**: Produto, preço, objetivo, atributos visuais, segmento, público-alvo  
**Output** (JSON validado por Zod):

```json
{
  "posicionamento": "Peça essencial para o inverno...",
  "publico_alvo": "Mulheres 20-35, classe B/C...",
  "tom_de_voz": "Próximo e aspiracional...",
  "gatilhos": ["escassez", "desejo"],
  "plataformas": {
    "instagram_feed": { "foco": "Lifestyle aspiracional", "cta": "Compre agora" },
    "instagram_stories": { "foco": "Urgência", "cta": "Arraste pra cima" },
    "whatsapp": { "foco": "Proximidade", "cta": "Consulte disponibilidade" },
    "meta_ads": { "foco": "Conversão direta", "cta": "Garanta a sua" }
  }
}
```

**Por quê Gemini Pro?** Estratégia exige raciocínio em cadeia (planejar público → posicionar → decidir tom → distribuir por plataforma). Flash erra a coerência entre plataformas.

---

### STEP 3: ✍️ Copywriter (Geração de Textos)

> **O que faz**: Escreve todos os textos da campanha com tom de lojista brasileira.

| Campo | Valor |
|-------|-------|
| **API** | Anthropic (Claude) |
| **Modelo** | `claude-sonnet-4-20250514` |
| **Tipo** | Texto |
| **Temperatura** | 0.85 (alta criatividade) |
| **Max Tokens** | 4.096 |
| **Structured Output** | ❌ Não (Claude não suporta, parseado com JSON) |

**Input**: Produto, preço, loja, estratégia, segmento, atributos visuais  
**Output** (JSON parseado):

```json
{
  "headline_principal": "Tricô que abraça ✨ R$ 89,90",
  "headline_variacao_1": "Inverno quentinho e estiloso",
  "headline_variacao_2": "O cropped que vai salvar seus looks",
  "instagram_feed": "Sabe aquela peça que vira coringa?...",
  "instagram_stories": "ACABOU DE CHEGAR 🔥\nTricô cropped...",
  "whatsapp": "Oi! 🌸 Olha essa novidade...",
  "meta_ads": {
    "titulo_principal": "Blusa Tricô Cropped | R$ 89,90",
    "titulo_curto": "Tricô Cropped 🧶",
    "texto_principal": "A blusa que combina com tudo...",
    "descricao_link": "Frete grátis acima de R$ 199"
  },
  "hashtags": ["#modafeminina", "#trico", "#inverno2026"]
}
```

**Por quê Claude?** Gera textos com o tom exato de "lojista brasileira no Instagram" — emojis bem colocados, gírias naturais ("coringa", "arrasa"), CTAs persuasivos sem soar artificial. Gemini tende a soar corporativo demais.

---

### STEP 4+5: 🔄 Refiner ∥ ⭐ Scorer (PARALELO)

> **O que fazem**: Refinam os textos e avaliam a qualidade — rodam **simultaneamente**.

#### 4. Refiner

| Campo | Valor |
|-------|-------|
| **API** | Google Gemini |
| **Modelo** | `gemini-2.5-flash` |
| **Temperatura** | 0.5 |
| **Max Tokens** | 3.000 |

**O que faz**: Revisa os textos do Copywriter e corrige inconsistências (tom, CTAs, informações). Retorna versões refinadas + lista de correções.

```json
{
  "textos_refinados": {
    "instagram_feed": "(versão corrigida...)",
    "whatsapp": "(versão polida...)"
  },
  "refinements": [
    "Ajustei o CTA do stories para combinar com a estratégia de urgência",
    "Corrigi preço no WhatsApp que estava divergente"
  ]
}
```

#### 5. Scorer

| Campo | Valor |
|-------|-------|
| **API** | Google Gemini |
| **Modelo** | `gemini-2.5-flash` |
| **Temperatura** | 0.3 |
| **Structured Output** | ✅ Sim |

**O que faz**: Avalia a qualidade da campanha numa escala de 0-100.

```json
{
  "nota_geral": 78,
  "dimensoes": {
    "relevancia": 85,
    "persuasao": 72,
    "clareza": 80,
    "consistencia": 75,
    "engajamento": 78
  },
  "pontos_fortes": ["Headlines criativas", "Bom uso de emojis"],
  "pontos_fracos": ["CTA do stories poderia ser mais urgente"],
  "sugestoes": ["Adicionar gatilho de escassez no feed"]
}
```

**Otimização**: Executados em paralelo via `Promise.all()`, economizando ~33% do tempo total.

---

### AUTO-RETRY: Score < 40

Se o `nota_geral` for menor que 40, o pipeline **re-executa automaticamente** o Copywriter + Refiner com temperatura mais alta (0.9) para tentar gerar textos melhores. Isso adiciona 1 chamada extra ao Claude + 1 ao Gemini Flash.

---

### STEP 6: 📦 Composição Final

Monta o resultado final unificando:
- Vision analysis
- Strategy
- Textos finais (refinados se disponíveis, senão originais)
- Score
- Breakdown de custos (tokens consumidos por step)

Não consome API — é lógica local.

---

## Geração de Imagem (Virtual Try-On)

> **Executado APÓS o pipeline de texto**, apenas se o usuário ativou "Usar modelo virtual".
> Dois providers disponíveis: **Fashn.ai** (especializado em moda) e **Nano Banana 2** (Gemini nativo).

---

### Fashn.ai (Provider Especializado em Moda)

| Campo | Valor |
|-------|-------|
| **API** | Fashn.ai REST API |
| **Base URL** | `https://api.fashn.ai/v1` |
| **Modelo principal** | `product-to-model` / `tryon-max` |
| **Arquivo** | `src/lib/fashn/client.ts` |

**Como funciona**: A Fashn.ai é uma API especializada em moda. Você submete um job, recebe um ID, e faz polling até o resultado ficar pronto (máx 120s).

#### Pipeline A+: Sem Banco de Modelos

```
Foto Produto → product-to-model → edit (fundo) → Foto Final
```

| Etapa | Endpoint | Créditos | Custo |
|-------|----------|----------|-------|
| Gerar modelo | `product-to-model` | 1 | R$ 0,44 |
| Editar fundo | `edit` (1k/fast) | 1 | R$ 0,44 |
| **Total** | — | **2** | **R$ 0,88** |

#### Pipeline com Banco de Modelos

```
Foto Produto + Modelo do Banco → tryon-max → edit (fundo) → Foto Final
```

| Etapa | Endpoint | Créditos | Custo |
|-------|----------|----------|-------|
| Try-On | `tryon-max` | 4 | R$ 1,74 |
| Editar fundo | `edit` (1k/fast) | 1 | R$ 0,44 |
| **Total** | — | **5** | **R$ 2,18** |

#### Endpoints Completos

| Endpoint | Créditos | Custo USD | Custo BRL | Uso |
|----------|----------|-----------|-----------|-----|
| `product-to-model` | 1 | $0.075 | R$ 0,44 | Gerar modelo vestindo peça (sem banco) |
| `tryon-max` | 4 | $0.300 | R$ 1,74 | Vestir peça em modelo do banco |
| `edit` (1k/fast) | 1 | $0.075 | R$ 0,44 | Alisar roupa + aplicar fundo |
| `edit` (2k/quality) | 3 | $0.225 | R$ 1,31 | Edit alta qualidade |
| `background-remove` | 1 | $0.075 | R$ 0,44 | Recorte PNG transparente |
| `model-create` | var. | ~$0.075+ | R$ 0,44+ | Criar modelo personalizada |

**Prompts de fundo (anti-manequim)**:
- `branco` — Estúdio branco profissional
- `estudio` — Estúdio com gradiente suave
- `lifestyle` — Cenário urbano ao ar livre
- `personalizado` — Prompt customizado pelo usuário

---

### Nano Banana 2 (Provider Alternativo — Gemini Nativo)

| Campo | Valor |
|-------|-------|
| **API** | Google Gemini (mesma key do pipeline de texto) |
| **Modelo** | `gemini-3.1-flash-image-preview` |
| **SDK** | `@google/genai` |
| **Custo** | ~R$ 0,15 por imagem |
| **Arquivo** | `src/lib/google/nano-banana.ts` |

**O que faz**: Recebe a foto do produto + modelo de referência + prompt → gera foto fotorrealista via Gemini Image.

**Inputs**:
1. 📸 Foto do produto (obrigatória)
2. 🧵 Close-up do tecido (opcional — melhora reprodução de textura)
3. 🏪 Foto da loja/cenário (opcional — para background personalizado)
4. 👩 Modelo de referência (do banco de modelos — skin tone, cabelo)
5. 📝 Prompt detalhado (construído automaticamente)

**Cenários disponíveis**:

| ID | Label | Descrição |
|----|-------|-----------|
| `estudio` | Estúdio Profissional | Fundo branco limpo, iluminação pro |
| `boutique` | Boutique | Interior de loja elegante |
| `urbano` | Urbano | Cenário de rua, arquitetura moderna |
| `natureza` | Ao Ar Livre | Vegetação, golden hour |
| `personalizado` | Sua Loja | Foto do cliente como fundo |

**Aspect Ratios**:

| Tipo | Ratio |
|------|-------|
| Instagram Feed | 4:5 |
| Instagram Stories | 9:16 |
| E-commerce | 3:4 |
| Banner | 16:9 |

**Resolução**: 2K (configurado via `imageSize: "2K"`)

---

### Comparativo: Fashn.ai vs Nano Banana 2

| Aspecto | Fashn.ai | Nano Banana 2 |
|---------|----------|---------------|
| **Custo (sem banco)** | R$ 0,88 | R$ 0,15 |
| **Custo (com banco)** | R$ 2,18 | R$ 0,15 |
| **Qualidade** | Especializado em moda | Genérico (bom em moda) |
| **Try-On com modelo** | ✅ Nativo (`tryon-max`) | ✅ Via prompt |
| **Edit/Refine** | ✅ Endpoint dedicado | ❌ Single-shot |
| **Background remove** | ✅ Endpoint dedicado | ❌ Não suporta |
| **API Key extra** | Sim (`FASHN_API_KEY`) | Não (usa `GOOGLE_AI_API_KEY`) |
| **Velocidade** | ~20-60s (polling) | ~5-15s (síncrono) |

---

## Provider Abstraction Layer

A camada de abstração permite trocar modelos por step sem mexer na lógica do pipeline.

### Arquitetura

```
pipeline.ts
    ↓ usa
providers/index.ts (factory — escolhe provider por step)
    ↓ cria
providers/gemini.ts (GeminiProvider — implementa LLMProvider)
providers/claude.ts (ClaudeProvider — implementa LLMProvider)
    ↓ define
providers/types.ts (LLMProvider interface + pricing)
```

### Interface `LLMProvider`

```typescript
interface LLMProvider {
  readonly name: "anthropic" | "google";
  generate(request: LLMRequest): Promise<LLMResponse>;
  generateWithVision(request: LLMVisionRequest): Promise<LLMResponse>;
}
```

### Configuração por Step (Padrão)

| Step | Provider | Modelo | Structured Output |
|------|----------|--------|-------------------|
| Vision | Google | `gemini-2.5-flash` | ✅ Nativo |
| Strategy | Google | `gemini-2.5-pro` | ✅ Nativo |
| Copywriter | Anthropic | `claude-sonnet-4-20250514` | ❌ JSON parse |
| Refiner | Google | `gemini-2.5-flash` | ✅ Nativo |
| Scorer | Google | `gemini-2.5-flash` | ✅ Nativo |

### Override por Env

Cada step pode ser overridado via variável de ambiente:
```env
AI_MODEL_VISION=gemini-2.5-flash
AI_MODEL_STRATEGY=gemini-2.5-pro
AI_MODEL_COPYWRITER=claude-sonnet-4-20250514
AI_MODEL_REFINER=gemini-2.5-flash
AI_MODEL_SCORER=gemini-2.5-flash
```

---

## Custos Detalhados

### Preços por Milhão de Tokens (USD)

| Modelo | Input/MTok | Output/MTok |
|--------|-----------|-------------|
| Gemini 2.5 Flash | $0.30 | $2.50 |
| Gemini 2.5 Pro | $1.25 | $10.00 |
| Claude Sonnet 4 | $3.00 | $15.00 |

### Custo Estimado por Campanha (Arquitetura Híbrida)

| Step | Modelo | Input ~tokens | Output ~tokens | Custo USD | Custo BRL |
|------|--------|--------------|---------------|-----------|-----------|
| Vision | Gemini Flash | ~1.500 | ~500 | $0.0017 | R$ 0,010 |
| Strategy | Gemini Pro | ~1.200 | ~800 | $0.0095 | R$ 0,055 |
| Copywriter | Claude Sonnet | ~1.500 | ~1.200 | $0.0225 | R$ 0,131 |
| Refiner | Gemini Flash | ~2.000 | ~1.000 | $0.0031 | R$ 0,018 |
| Scorer | Gemini Flash | ~2.000 | ~400 | $0.0016 | R$ 0,009 |
| **TOTAL** | — | — | — | **~$0.037** | **~R$ 0,09** * |

*\* Câmbio: R$ 5,80/USD (configurável via `USD_BRL_EXCHANGE_RATE`)*

### Custo Virtual Try-On (Opcional)

| Provider | Fluxo | Custo por imagem |
|----------|-------|-----------------|
| Fashn.ai (sem banco) | `product-to-model` + `edit` | R$ 0,88 |
| Fashn.ai (com banco) | `tryon-max` + `edit` | R$ 2,18 |
| Nano Banana 2 | Single-shot (Gemini 3.1) | R$ 0,15 |

### Custo TOTAL por Campanha Completa (com imagem)

| Configuração | Texto | Imagem | **Total** |
|-------------|-------|--------|-----------|
| Híbrido + Nano Banana | R$ 0,09 | R$ 0,15 | **R$ 0,24** |
| Híbrido + Fashn (sem banco) | R$ 0,09 | R$ 0,88 | **R$ 0,97** |
| Híbrido + Fashn (com banco) | R$ 0,09 | R$ 2,18 | **R$ 2,27** |
| Só texto (sem imagem) | R$ 0,09 | — | **R$ 0,09** |

### Comparativo: v1 (Todo Claude) vs v2 (Híbrido)

| Métrica | v1 (Claude only) | v2 (Híbrido) | Economia |
|---------|-------------------|---------------|----------|
| Custo/campanha | ~R$ 0,33 | ~R$ 0,09 | **73%** |
| Latência | ~30s (sequencial) | ~18s (paralelo) | **40%** |
| Qualidade copy | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (mantida) | — |

---

## Variáveis de Ambiente

```env
# ══ APIs OBRIGATÓRIAS ══
GOOGLE_AI_API_KEY=<sua-chave-google>      # Gemini Flash + Pro + Nano Banana
ANTHROPIC_API_KEY=<sua-chave-anthropic>    # Claude Sonnet (Copywriter)

# ══ VIRTUAL TRY-ON (Fashn.ai) ══
FASHN_API_KEY=<sua-chave-fashn>            # Fashn.ai Virtual Try-On
FASHN_API_URL=https://api.fashn.ai/v1     # (padrão, opcional)

# ══ OPCIONAIS (override de modelos) ══
AI_MODEL_VISION=gemini-2.5-flash
AI_MODEL_STRATEGY=gemini-2.5-pro
AI_MODEL_COPYWRITER=claude-sonnet-4-20250514
AI_MODEL_REFINER=gemini-2.5-flash
AI_MODEL_SCORER=gemini-2.5-flash
AI_MODEL_GEMINI_FLASH=gemini-2.5-flash
AI_MODEL_GEMINI_PRO=gemini-2.5-pro
AI_MODEL_CLAUDE_SONNET=claude-sonnet-4-20250514

# ══ CÂMBIO ══
USD_BRL_EXCHANGE_RATE=5.80                # Atualizar periodicamente
```

---

## Diagramas de Fluxo

### Pipeline Principal (Texto)

```
               ┌─────────────┐
               │ Foto + Preço│
               └──────┬──────┘
                      ▼
           ┌──────────────────┐
     STEP 1│  👁️  VISION      │ Gemini 2.5 Flash
           │  Analisa produto │ (multimodal)
           └────────┬─────────┘
                    ▼
           ┌──────────────────┐
     STEP 2│  🧠  STRATEGY    │ Gemini 2.5 Pro
           │  Cria estratégia │
           └────────┬─────────┘
                    ▼
           ┌──────────────────┐
     STEP 3│  ✍️  COPYWRITER   │ Claude Sonnet 4
           │  Escreve textos  │
           └────────┬─────────┘
                    ▼
        ┌───────────┴───────────┐
        ▼                       ▼
  ┌───────────┐          ┌───────────┐
  │ 🔄 REFINER│          │ ⭐ SCORER │  ← PARALELO
  │ Gemini    │          │ Gemini    │
  │ Flash     │          │ Flash     │
  └─────┬─────┘          └─────┬─────┘
        └───────────┬───────────┘
                    ▼
              ┌───────────┐
              │ Score < 40?│
              └─────┬─────┘
               ╱         ╲
            SIM           NÃO
             ▼              ▼
     ┌──────────────┐  ┌──────────────┐
     │ Auto-Retry   │  │  📦 RESULTADO │
     │ Copy+Refine  │  │  Campanha    │
     └──────┬───────┘  └──────────────┘
            ▼
     ┌──────────────┐
     │  📦 RESULTADO │
     └──────────────┘
```

### Pipeline de Imagem (Virtual Try-On)

```
              ┌─────────────┐
              │ Foto Produto│
              └──────┬──────┘
                     ▼
         ┌──────────────────────┐
         │ Opcionais:           │
         │ • Close-up tecido    │
         │ • Foto cenário loja  │
         │ • Modelo referência  │
         └──────────┬───────────┘
                    ▼
         ┌───────────────────────┐
         │ 📸 NANO BANANA 2     │
         │ Gemini 3.1 Flash     │
         │ Image Preview        │
         │                      │
         │ Gera modelo vestindo │
         │ a peça no cenário    │
         └──────────┬───────────┘
                    ▼
         ┌───────────────────────┐
         │ Upload p/ Supabase   │
         │ Storage              │
         └───────────────────────┘
```

---

## Arquivos Relevantes

| Arquivo | Papel |
|---------|-------|
| `src/lib/ai/pipeline.ts` | Orquestrador principal do pipeline |
| `src/lib/ai/providers/index.ts` | Factory — escolhe provider por step |
| `src/lib/ai/providers/gemini.ts` | Implementação do Gemini Provider |
| `src/lib/ai/providers/claude.ts` | Implementação do Claude Provider |
| `src/lib/ai/providers/types.ts` | Interface LLMProvider + pricing |
| `src/lib/ai/prompts.ts` | Todos os system prompts e builders |
| `src/lib/ai/config.ts` | Mapeamento de categorias |
| `src/lib/ai/mock-data.ts` | Dados mock para demo mode |
| `src/lib/fashn/client.ts` | Fashn.ai Virtual Try-On (especializado moda) |
| `src/lib/google/nano-banana.ts` | Nano Banana 2 Virtual Try-On (Gemini nativo) |
| `src/lib/schemas.ts` | Zod schemas para validação |
| `src/app/api/campaign/generate/route.ts` | API Route (entry point HTTP) |

---

*Última atualização: Abril 2026 — Pipeline v2.0 (Híbrido)*
