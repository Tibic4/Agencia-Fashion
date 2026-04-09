# Pipeline CriaLook v5 — Dual-Agent Architecture

> **Resumo:** cada campanha faz **1 chamada Claude Sonnet + 3 chamadas Gemini VTO em paralelo** = 4 chamadas de IA.
> Custo total por campanha: **~R$ 0,85** (3 imagens, câmbio R$ 5,80/USD)
> **Agentes:** Claude Sonnet 4 (análise + copy) + Gemini 3 Pro Image (VTO × 3)
> Frontend: **SSE streaming** com progresso granular por imagem
> ⚠️ Preços auditados em 09/04/2026: [Google AI](https://ai.google.dev/pricing) · [Anthropic](https://docs.anthropic.com/en/docs/about-claude/pricing)

---

## Arquitetura Dual-Agent

O pipeline v5 eliminou 5 das 9 chamadas do v2.1 (Vision, Strategy, Refiner, Scorer, QA) ao consolidar em **2 agentes especializados**:

| Agente | Modelo | Responsabilidade |
|--------|--------|-----------------|
| 🧠 **Analista** | Claude Sonnet 4 | Análise visual + estratégia + 3 scene prompts narrativos + dicas de postagem |
| 📸 **Fotógrafo** | Gemini 3 Pro Image | 3 VTO em paralelo (multi-image fusion com thinking) |

### Por que 2 em vez de 9?

| v2.1 (9 chamadas) | v5 (4 chamadas) | O que mudou |
|---|---|---|
| Vision (Gemini Flash) | ❌ removido | Sonnet faz visão nativa |
| Strategy (Gemini Pro) | ❌ removido | Sonnet gera estratégia integrada |
| Copywriter (Claude Sonnet) | ✅ **Sonnet** (expandido) | Agora faz tudo: visão + copy + prompts VTO |
| Refiner (Gemini Flash) | ❌ removido | Sonnet já gera texto refinado |
| Scorer (Gemini Flash) | ❌ removido | Score pode ser adicionado depois se necessário |
| VTO × 1 (Gemini Image) | ✅ **VTO × 3** (paralelo) | 3 looks em vez de 1, com progresso individual |
| QA Visual (Gemini Flash) | ❌ removido | Gemini Pro + thinking = qualidade alta sem QA |

---

## Os 2 Passos

### PASSO 1 — Claude Sonnet 4 (Analista Completo)

**O que faz:** Recebe a(s) foto(s) do produto + contexto e gera:
1. **Análise visual** — tipo_peca, cores, tecido, modelagem, caimento, detalhes, mood
2. **3 scene prompts narrativos** — cada um descreve cenário + iluminação + pose + styling + câmera (em inglês, otimizados para Gemini)
3. **Dicas de postagem** — melhor dia/horário, sequência de stories, legendas por plataforma com hashtags

**Entrada:**
  - Foto(s) do produto (principal + close-up + 2ª peça)
  - Preço, nome da loja, cor da marca, segmento
  - Dados da modelo: skin_tone, body_type, hair_color, hair_texture, hair_length, age_range
  - Cenário preferido pelo usuário (branco, lifestyle, urbano, etc.)

**Saída:** JSON com 3 blocos — `analise`, `vto_hints`, `dicas_postagem`

**Modelo:** `claude-sonnet-4-20250514`
**max_tokens:** 12000
**Custo:** ~R$ 0,15 ($0.026 — input $3.00/MTok × 4.4K + output $15.00/MTok × 2.5K)

**Arquivo:** `src/lib/ai/sonnet-analyzer.ts`

#### Prompt Architecture

O Sonnet recebe um **system prompt** com:
- Role: "Fashion Editorial Director and Visual AI Specialist"
- Bloco `<modelo_info>` com todos os traits da modelo
- Bloco `<cenario>` com background preferido
- Instrução de output em JSON com 3 seções obrigatórias
- `<negativo>` — lista de artefatos que os scene prompts devem PROIBIR

#### Negative Prompts (Fidelidade Visual)

O Sonnet injeta negative prompts em cada scene prompt para o Gemini:

```
ABSOLUTE PROHIBITIONS — DO NOT generate any of these:
- Hair color changes (keep EXACTLY as reference)
- Extra fingers, merged fingers, missing fingers
- Anatomical distortions (extra limbs, wrong proportions)
- Fabric color shifts (keep EXACTLY as product photo)
- Logo or text on clothing not present in original
- Floating garments not connected to body
- Mismatched sleeve or hem lengths vs original
```

---

### PASSO 2 — Gemini 3 Pro Image (VTO × 3 em paralelo)

**O que faz:** Recebe os 3 scene prompts do Sonnet + foto do produto + foto da modelo e gera **3 imagens editoriais em paralelo** usando multi-image fusion nativa do Gemini.

**Entrada por chamada:**
  - Scene prompt narrativo (do Sonnet)
  - Foto do produto (base64)
  - Foto da modelo do banco (base64)
  - Body type, aspect ratio

**Saída:** 3 imagens base64 (2K, ~4MP)

**Modelo:** `gemini-3-pro-image-preview`
**Resolução:** 2K (default) — suporta até 4K
**Thinking:** Sempre ativo (budgetTokens: 1024) → máxima qualidade de composição
**Aspect Ratio:** `9:16` (default, ideal para Stories) — Sonnet pode sugerir 3:4 ou 4:5

**Custo por imagem 2K:** ~R$ 0,20 ($0.034 — input + img output)
**Custo total (3 imagens):** ~R$ 0,60

**Arquivo:** `src/lib/ai/gemini-vto-generator.ts`

#### Prompt Structure (por imagem)

Cada chamada ao Gemini recebe:

```
[PART 1: inlineData] → foto da modelo (base64)
[PART 2: inlineData] → foto do produto (base64)
[PART 3: text] →
  You are a professional fashion photographer...
  
  SCENE DIRECTION: {scene_prompt do Sonnet}
  
  BODY TYPE: {normal/plus}
  
  CRITICAL RULES:
  - The model MUST wear the EXACT garment from the product photo
  - Preserve ALL details: color, texture, buttons, patterns, prints
  - The model's face, skin tone, hair MUST match the reference exactly
  - Natural fabric draping with real gravity and physics
  - Professional editorial photography quality
```

#### Progresso Granular por Imagem

As 3 chamadas rodam em `Promise.allSettled` (paralelo). Cada imagem notifica via callback `onImageComplete` quando termina:

```
 8%  Analisando fotos do produto… (Sonnet start)
30%  Análise completa! Criando looks… (Sonnet done)
40%  Montando editoriais de moda… (prompts ready)
~52% Foto 1/3 ✅ (1ª imagem terminou)
~65% Foto 2/3 ✅ (2ª imagem terminou)
~78% Foto 3/3 ✅ — finalizando! (3ª imagem terminou)
92%  Salvando resultados…
100% Pronto!
```

> ⚡ Cada imagem adiciona ~13% ao progresso. Se todas terminarem juntas, a interpolação CSS do frontend suaviza a transição.

#### Seleção da Modelo (ordem de prioridade)

| Prioridade | Fonte | Detalhe |
|:---:|-------|--------|
| 1️⃣ | `model_bank_id` (banco público) | Modelo selecionada pelo usuário na UI |
| 2️⃣ | Modelo ativa da loja (custom) | `preview_url` (personalizada) > `image_url` (stock) |
| 3️⃣ | Fallback body type | Modelo aleatória do banco filtrando por `body_type` |
| 4️⃣ | Fallback geral | Primeira modelo ativa do banco |

---

## Pipeline de Geração de Modelo Virtual

> Pipeline separado da campanha. Roda **assincronamente via Inngest** quando o usuário cria ou regenera uma modelo.
> Suporta dois modos: **Text-Only** (traits descritivos) e **Multimodal** (foto facial de referência).
> Custo: **~R$ 0,20** (Gemini 3 Pro Image 2K) independente do modo.

### Dois Modos de Geração

| Modo | Trigger | Input | Output |
|------|---------|-------|--------|
| 📝 **Text-Only** | Usuário preenche seletores sem foto | Traits: skin, hair, body, pose, age | Modelo completa (corpo inteiro, fundo branco) |
| 📷 **Multimodal** | Usuário envia foto de rosto + seletores | Foto facial + traits de corpo/hair/pose | Modelo com rosto idêntico à foto + corpo/roupa dos seletores |

### Modo Text-Only (sem foto)

**Prompt:** Puramente descritivo. Usa mapas de descritores em inglês otimizados para Gemini Image:

| Seletor no form | Exemplos de descritor |
|-----------------|----------------------|
| Tom de pele | `"fair/light complexion, warm undertones"`, `"rich dark-brown complexion"` |
| Cabelo | `"voluminous curly hair, natural bouncy texture"`, `"sleek straight black hair"` |
| Corpo | `"slim athletic silhouette"`, `"confident plus-size curvy figure"` |
| Pose | `"Standing relaxed with a warm smile. Arms naturally at sides."` |
| Idade | `"a youthful 20-year-old"`, `"an elegant 40-year-old"` |

**Saída fixa:** Camiseta branca crew-neck + shorts preto + descalça. Fundo branco estúdio.

### Modo Multimodal (com foto facial)

**Input da foto:**
1. Usuário faz upload (drag-and-drop ou click) no form `/modelo`
2. Backend redimensiona para **512px** via `sharp` (otimiza tokens)
3. Upload para Supabase Storage (`face-refs/{storeId}/{uuid}.jpg`)
4. URL salva na coluna `face_ref_url` da tabela `store_models`

**Prompt multimodal (dual-input — imagem + texto):**

```
[PART 1: inlineData] → foto facial em base64 (baixada da URL no step.run)

[PART 2: text] →
  FACE IDENTITY (from reference photo):
  - Reproduce the EXACT facial structure: eye shape, nose, lips, eyebrows, jawline
  - Match the skin complexion and undertones exactly as shown
  - DO NOT alter the face shape, features, or skin color

  BODY (INDEPENDENT from reference — use these specifications):
  - Build: {bodyType do seletor}          ← NÃO herda da foto
  - Height: proportional for {age}

  HAIR: {hairStyle do seletor}
  OUTFIT: White t-shirt + black shorts. Barefoot.   ← fixo
  POSE: {pose do seletor}

  CRITICAL RULES:
  - Face MUST match reference identity
  - Body MUST follow specified build, NOT the reference
  - Normalize lighting — ignore lighting from reference photo
```

> 🔑 **Princípio arquitetural:** O rosto vem da foto. Tudo o resto (corpo, roupa, pose, iluminação) vem dos seletores do formulário. Zero bleeding entre as duas fontes.

### Fluxo Inngest (Assíncrono)

```
📷 POST /api/model/create (FormData)
    ↓ (~200ms)
    ├─ Valida campos + processa foto (sharp 512px)
    ├─ Upload face_ref para Storage → obtém URL
    ├─ INSERT store_models (status: pending)
    ├─ UPDATE face_ref_url no modelo
    └─ inngest.send("model/preview.requested", { ...traits, faceRefUrl })
         ↓                                              ↑ payload leve (~200 bytes)
    Retorno instantâneo → frontend mostra placeholder     │ (URL, não base64 — evita
         ↓                                              │  limite de 512KB do Inngest)
    Frontend faz polling em /api/model/preview-status ◄──┘
         ↓
    [Inngest step.run "generate-gemini-preview"]
         ├─ Se faceRefUrl: fetch imagem → base64 em memória
         ├─ buildGeminiParts() → monta parts (text-only ou multimodal)
         └─ Gemini 3 Pro Image → gera imagem
         ↓
    [Inngest step.run "save-preview-url"]
         └─ Upload PNG para Storage → UPDATE preview_url no DB
         ↓
    Frontend: polling detecta preview_url ≠ null → mostra imagem ✅
```

> ⚡ **Retry:** 2 tentativas automáticas com backoff exponencial.
> 🔄 **Regenerar:** `POST /api/model/regenerate-preview` re-baixa a `face_ref_url` do DB e dispara nova geração (mantém modo multimodal).

### Prompts Centralizados

Arquivo: `src/lib/model-prompts.ts` — **fonte única de verdade**.

Exporta:
- `SKIN_DESC`, `HAIR_DESC`, `BODY_DESC`, `AGE_DESC`, `POSE_DESC` — mapas de descritores
- `buildGeminiParts(traits, faceBase64?, faceMime?)` — monta array de parts para a API Gemini

Consumidores:
- `src/lib/inngest/functions.ts` → job Inngest (fluxo principal)
- `src/lib/model-preview.ts` → fallback direto (fire-and-forget)

> Alterar prompts ou descritores em **um único arquivo** propaga para ambos os fluxos.

### Integração com VTO (Campanha)

A foto de referência **NÃO participa** do pipeline de campanha/VTO. O fluxo é:

1. Modelo é gerada (com ou sem face ref) → imagem salva como `preview_url`
2. Quando gera campanha → VTO busca `preview_url` (ou `image_url` para stock)
3. VTO veste a roupa **na imagem já gerada** → a cara certa já está lá!

> ✅ Pipeline VTO é 100% isolado. Não precisa da foto original nem do base64.

### Storage e Cleanup

| Operação | Bucket | Path |
|----------|--------|------|
| Face ref upload | `assets` | `face-refs/{storeId}/{uuid}.jpg` |
| Preview gerado | `assets` | `model-previews/{storeId}/{modelId}.png` |
| **Delete modelo** | `assets` | Remove **ambos** os arquivos automaticamente |

> 🧹 O `deleteStoreModel()` faz SELECT → extrai paths → `storage.remove()` antes do DELETE no DB.

---

## Tabela de Custos por Campanha (v5)

### Preços Oficiais dos Modelos — câmbio R$ 5,80/USD

> ✅ Verificados contra documentação oficial (09/Abr/2026)

| Modelo | Input/MTok | Output/MTok | Fonte |
|--------|:----------:|:-----------:|:-----:|
| Claude Sonnet 4 | $3.00 | $15.00 | Anthropic |
| Gemini 3 Pro Image (texto) | $1.25 | $5.00 | Google |
| **Gemini 3 Pro Image (img 2K)** | — | **~$0.034/img** | Google |

### 4 Chamadas de IA por Campanha

| # | Step | Modelo | Custo USD | Custo BRL |
|---|------|--------|:---------:|:---------:|
| 1 | Analista (visão + copy + prompts) | Claude Sonnet 4 | ~$0.026 | ~R$ 0,15 |
| 2 | VTO Imagem #1 (paralela) | Gemini 3 Pro Image | ~$0.034 | ~R$ 0,20 |
| 3 | VTO Imagem #2 (paralela) | Gemini 3 Pro Image | ~$0.034 | ~R$ 0,20 |
| 4 | VTO Imagem #3 (paralela) | Gemini 3 Pro Image | ~$0.034 | ~R$ 0,20 |
| | | | | |
| | **TOTAL** | | **~$0.128** | **~R$ 0,75** |

> 📊 Custo por imagem VTO 2K: **~R$ 0,20**
> Custo de **criar modelo personalizada**: **~R$ 0,20** (mesma chamada Gemini 3 Pro)

---

## Cenários Disponíveis (Gemini Image)

Todos usam a **mesma chamada** — o cenário é incorporado no scene prompt pelo Sonnet:

| Cenário | Descrição |
|---------|----------|
| ⬜ Branco | Estúdio limpo, fundo branco, e-commerce |
| 📸 Estúdio | Gradiente suave, iluminação profissional |
| 🌿 Lifestyle | Ambiente externo, luz natural |
| 🏙️ Urbano | Parede de concreto, rua, street style |
| 🌳 Natureza | Jardim tropical, bokeh, golden hour |
| 🏠 Interior | Loft minimalista, janelas grandes |
| 🛍️ Boutique | Mármore, detalhes dourados, loja premium |
| ✨ Gradiente | Rosa suave → peach dourado, brand aesthetic |
| 🎨 Minha Marca | Fundo na cor da marca da loja |
| ✏️ Personalizado | Texto livre do usuário |

---

## Fluxo Visual (v5)

```
📸 Upload da(s) foto(s) do produto (até 3)
    ↓
[1] Claude Sonnet 4 — Analisa produto (visão + cor + tecido + detalhes)
    ├─ Gera 3 scene prompts narrativos (cenário + pose + styling)
    ├─ Gera análise completa para display no frontend
    └─ Gera dicas de postagem (legendas + hashtags + horários)
    ↓                                        ┌─── SSE streaming ──► Frontend
    ├─ Foto produto (base64)                 │    (progresso por imagem)
    ├─ Foto modelo (base64)                  │
    ↓                                        │
[2] Gemini 3 Pro Image × 3 (paralelo) ──────┘
    ├─ Imagem 1 pronta → SSE 52%  ───► "Foto 1/3 ✅"
    ├─ Imagem 2 pronta → SSE 65%  ───► "Foto 2/3 ✅"
    └─ Imagem 3 pronta → SSE 78%  ───► "Foto 3/3 ✅"
    ↓
📤 Upload das 3 imagens para Supabase Storage
    ↓
💾 Salva resultado no campaigns.output (JSONB)
    ↓
✅ Campanha pronta! → Redirect para /gerar/demo
```

---

## Evolução do Pipeline

| Versão | Chamadas | Custo/campanha | Imagens | Latência total |
|:------:|:--------:|:--------------:|:-------:|:--------------:|
| v2.1 (Fashn) | 9 | R$ 1,07 (média) | 1 | 40-90s |
| **v5 (atual)** | **4** | **R$ 0,75** | **3** | **20-45s** |
| Diferença | -56% | **-30%** | **+200%** | **-40%** |

### O que foi removido (sem perda de qualidade)

| Step removido | Por que não faz falta |
|---------------|----------------------|
| Vision (Gemini Flash) | Sonnet 4 tem visão nativa igual ou superior |
| Strategy (Gemini Pro) | Sonnet gera estratégia integrada com a análise |
| Refiner (Gemini Flash) | Sonnet já gera textos finais refinados |
| Scorer (Gemini Flash) | Score automático não afeta resultado entregue |
| QA Visual (Gemini Flash) | Gemini 3 Pro + thinking = qualidade alta sem QA |

---

## Arquivos-Chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/lib/ai/pipeline.ts` | Orquestra os 2 agentes + emite SSE progress |
| `src/lib/ai/sonnet-analyzer.ts` | Analista Claude Sonnet 4 (visão + copy + prompts) |
| `src/lib/ai/gemini-vto-generator.ts` | VTO Gemini 3 Pro Image × 3 paralelo |
| `src/lib/model-prompts.ts` | Prompts centralizados de geração de modelo |
| `src/lib/inngest/functions.ts` | Job assíncrono de geração de modelo virtual |
| `src/app/api/campaign/generate/route.ts` | API route – SSE streaming do pipeline |
| `src/app/(auth)/gerar/page.tsx` | Frontend – steps + SSE consumer |
| `src/components/GenerationLoadingScreen.tsx` | Loading screen – interpolação suave |
