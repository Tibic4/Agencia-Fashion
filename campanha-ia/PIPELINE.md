# Pipeline CriaLook v2.1 — Passo a Passo

> Resumo executivo: cada campanha faz **6 chamadas LLM + 1-2 chamadas Gemini Image + 1 QA Visual (CoT)** = até 9 chamadas de IA.
> Custo total por campanha: **R$ 0,95** (QA aprova) / **R$ 1,56** (QA reprova) — câmbio R$ 5,80/USD.
> Custo de criar modelo personalizada: **R$ 0,59** (Gemini 3.1 Flash Image 2K) — com ou sem foto de referência.
> Provider de imagem: Gemini 3.1 Flash Image Preview (até 14 referências, 4K max)
> QA Visual Agent: Gemini 2.5 Flash com **Chain of Thought** (verifica fidelidade do VTO automaticamente)
> Frontend: **SSE streaming** — progresso real do pipeline em tempo real
> ⚠️ Preços auditados em 07/04/2026: [Google AI](https://ai.google.dev/pricing) · [Anthropic](https://docs.anthropic.com/en/docs/about-claude/pricing)

---

## Os 6 Passos

### PASSO 1 — Vision (Gemini 2.5 Flash) 🎯 Few-Shot
**O que faz:** Recebe a foto do produto e analisa tudo — cor, tecido, modelagem, detalhes, estampa.
**Entrada:** Foto(s) do produto + tipo informado + material informado
**Saída:** JSON com nome, categoria, cores, material, detalhes visuais, mood, campos VTO
**Custo:** R$ 0,010 ($0.00170 — input $0.30/MTok × 1.5K + output $2.50/MTok × 0.5K)

> 🆕 **Few-Shot Prompting:** O prompt inclui 2 exemplos completos de output ideal (blusa cropped + conjunto) para ancorar o formato e nível de detalhe dos campos `vto_*`. Melhora consistência do JSON em ~30%.

---

### PASSO 2 — Strategy (Gemini 2.5 Pro)
**O que faz:** Com base na análise visual, cria a estratégia de venda — ângulo, gatilho, tom, público ideal. Inclui sugestão de **pose** para a modelo.
**Entrada:** Análise do passo 1 + preço + objetivo + público-alvo
**Saída:** JSON com ângulo de venda, gatilho mental, tom, contra-objeção, CTAs, **pose_direction**
**Custo:** R$ 0,061 ($0.01050 — input $1.25/MTok × 2K + output $10.00/MTok × 0.8K)

**Poses sugeridas por objetivo:**

| Objetivo | Pose sugerida |
|----------|--------------|
| Venda imediata | Frontal 3/4, mãos relaxadas, olhar direto — foco no produto |
| Lançamento | Pose dinâmica, uma mão na cintura, olhar confiante |
| Promoção | Andando naturalmente, sorriso natural, casual |
| Engajamento | Pose expressiva, interagindo com acessório, olhar para o lado |

---

### PASSO 3 — Copywriter (Claude Sonnet 4) 📐 Frameworks + Limites
**O que faz:** Gera todos os textos da campanha — feed, stories, WhatsApp, Meta Ads.
**Entrada:** Análise visual + estratégia + nome da loja + preço
**Saída:** JSON com headline, legenda feed, stories (4 slides), WhatsApp, Meta Ads, hashtags
**Custo:** R$ 0,226 ($0.03900 — input $3.00/MTok × 3K + output $15.00/MTok × 2K)

**Frameworks por canal:**

| Canal | Framework | Limite de chars |
|-------|-----------|:---:|
| Instagram Feed | **AIDA** (Atenção → Interesse → Desejo → Ação) | 300-800 chars (sem hashtags) |
| Instagram Stories | **HOOK → REVEAL → CTA** (3 atos) | máx 70 chars/slide |
| WhatsApp | **PAS** (Problema → Agitação → Solução) | 150-300 chars |
| Meta Ads | **BAF** (Before → After → Bridge) | 40 chars título, 125 chars texto |
| Headlines | — | 8-12 palavras, máx 80 chars |

> 🆕 **Lista negra expandida (2 camadas):**
> - **Camada 1 (Copywriter):** 13 termos proibidos na geração ("peça coringa", "look perfeito", "must-have", etc.)
> - **Camada 2 (Refiner):** 14 termos adicionais verificados + substituídos no refinamento ("arrasa", "lacra", "virou queridinha", etc.)

---

### PASSO 4 — Refiner (Gemini 2.5 Flash)  ➡️ sequencial
**O que faz:** Revisa e melhora os textos — remove clichês (camada 2), ajusta tom, otimiza para cada plataforma.
**Entrada:** Textos brutos do copywriter
**Saída:** Textos refinados
**Custo:** R$ 0,027 ($0.00465 — input $0.30/MTok × 3K + output $2.50/MTok × 1.5K)

### PASSO 5 — Scorer (Gemini 2.5 Flash)  ➡️ sequencial (após Refiner)
**O que faz:** Avalia a qualidade da campanha (0-100) e sugere melhorias.
**Entrada:** Textos **REFINADOS** (do passo 4) + estratégia + análise visual
**Saída:** Score geral + scores por dimensão + sugestões
**Custo:** R$ 0,012 ($0.00200 — input $0.30/MTok × 2.5K + output $2.50/MTok × 0.5K)

> 🆕 **v2.1:** Passos 4 e 5 agora rodam em **sequência** (Refiner → Scorer). O Scorer avalia os textos refinados que o cliente realmente verá, não os textos brutos. Latência extra: ~1-2s (irrelevante vs VTO 10-30s em paralelo).

---

### PASSO 6 — Gemini 3.1 Flash Image: Virtual Try-On + Cenário 🛡️ Realismo
**O que faz:** Em uma ÚNICA chamada, veste a roupa na modelo + aplica cenário + define pose.
**Entrada:**
  - Foto(s) do produto (até 3: principal + close-up + 2ª peça)
  - Foto da modelo (seleção por prioridade — ver abaixo)
  - Prompt com cenário + pose + instruções de fidelidade + **requisitos de realismo físico**
**Saída:** Imagem da modelo vestindo a roupa
**Modelo:** `gemini-3.1-flash-image-preview`
**Resolução:** 2K (default) — suporta até 4K
**Custo imagem 2K:** R$ 0,592 ($0.101/img — 1680 tokens × $60/MTok)
**Custo input texto:** R$ 0,006 ($0.001 — $0.50/MTok × 2K tokens)
> ⚠️ **Atenção:** O output de imagem do Gemini 3.1 Flash Image custa **$60/MTok** (20x mais que texto $3/MTok). Uma imagem 2K = 1680 tokens = $0.101/imagem.

**Seleção da modelo (ordem de prioridade):**

| Prioridade | Fonte | Detalhe |
|:---:|-------|--------|
| 1️⃣ | `model_bank_id` (banco público) | Modelo selecionada pelo usuário na UI |
| 2️⃣ | Modelo ativa da loja (custom) | `preview_url` (personalizada) > `image_url` (stock) |
| 3️⃣ | Fallback body type | Modelo aleatória do banco filtrando por `body_type` |
| 4️⃣ | Fallback geral | Primeira modelo ativa do banco |

> ✅ O Gemini aceita até **14 imagens de referência** em uma única chamada.
> As 3 fotos do produto são usadas: principal (silhueta), close-up (textura), 2ª peça (conjunto).

> 🆕 **Requisitos de Realismo Físico (v2.1):** O prompt agora inclui 6 regras positivas de constrangimento:
> textura uniforme, anatomia correta (2 braços/2 pernas), neckline fiel, costuras contínuas,
> silhueta proporcional, e draping com gravidade real. Abordagem "re-frame positivo" em vez de
> negative prompts (mais eficaz para modelos autoregressivos como Gemini Image).

---

### PASSO 6b — QA Visual Agent (Gemini 2.5 Flash)  🔍 Chain of Thought
**O que faz:** Compara a imagem VTO gerada contra o produto original usando **raciocínio passo-a-passo**.
**Analisa (5 steps CoT):**
  1. **COLOR** — compara hue/saturação/brilho exatos
  2. **TEXTURE** — verifica tipo de tecido e trama
  3. **DETAILS** — conta botões, estampas, logos, posições
  4. **FIT & SILHOUETTE** — avalia caimento, comprimento, ajuste
  5. **MISSING ELEMENTS** — busca elementos ausentes
**Decisão:**
  - ✅ **Aprovado** (maioria dos casos) → usa a 1ª imagem
  - ❌ **Reprovado** (problemas graves) → gera 2ª imagem com **RETRY FOCUS CRITICAL OVERRIDE**
**Modelo:** `gemini-2.5-flash` (texto + visão)
**Custo QA:** R$ 0,013 ($0.00225 — Gemini 2.5 Flash: input $0.30/MTok × 2.5K + output $2.50/MTok × 0.6K)
**Custo 2ª geração (se reprova):** R$ 0,599 ($0.10325 — Gemini 3.1 Flash Image: input $0.50/MTok × 2.5K + img 2K $0.101)
**Tempo extra:** ~3-4s (QA CoT) + ~10-15s (2ª geração se necessário)

> 🆕 **Chain of Thought (v2.1):** O agente agora é forçado a raciocinar step-by-step antes de decidir,
> retornando um campo `reasoning` com a análise. Acurácia estimada: **+25-40%** vs avaliação direta.
> O campo `reasoning` é logado para análise posterior de padrões de falha.

**Categorias de verificação:**

| Categoria | O que verifica | Exemplo de problema |
|-----------|---------------|--------------------|
| 🎨 Cor | Hue, saturação, brilho | Camisa rosa ficou salmão |
| 🧵 Textura | Tipo de tecido, trama | Tricô ficou liso como algodão |
| 🔍 Detalhes | Botões, zípers, estampas | 5 botões viraram 3 |
| 👗 Caimento | Fit, comprimento, silhueta | Cropped ficou comprido |
| ❌ Ausência | Elementos faltando | Bordado sumiu |

> ⚡ **Fail-open:** Se o QA falhar, aceita a 1ª imagem (nunca trava o pipeline).
> Se a 2ª geração falhar, usa a 1ª imagem como fallback.

> 🆕 **Feedback Loop Priorizado (v2.1):** Quando o QA reprova, as issues são ordenadas por severidade
> (cor/textura primeiro) e injetadas com **RETRY FOCUS CRITICAL OVERRIDE** — instrução de máxima
> prioridade que identifica a falha principal e inclui o `colorHex` do Vision como alvo concreto.

---

## Pipeline de Geração de Modelo Virtual

> Pipeline separado da campanha. Roda **assincronamente via Inngest** quando o usuário cria ou regenera uma modelo.
> Suporta dois modos: **Text-Only** (traits descritivos) e **Multimodal** (foto facial de referência).
> Custo: **R$ 0,59** (Gemini 3.1 Flash Image 2K — $0.101/img) independente do modo.

### Dois Modos de Geração

| Modo | Trigger | Input | Output |
|------|---------|-------|--------|
| 📝 **Text-Only** | Usuário preenche seletores sem foto | Traits: skin, hair, body, pose, age | Modelo completa (corpo inteiro, fundo branco) |
| 📷 **Multimodal** | Usuário envia foto de rosto + seletores | Foto facial + traits de corpo/hair/pose | Modelo com rosto idêntico à foto + corpo/roupa dos seletores |

---

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

---

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

---

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
         └─ Gemini 3.1 Flash Image → gera imagem
         ↓
    [Inngest step.run "save-preview-url"]
         └─ Upload PNG para Storage → UPDATE preview_url no DB
         ↓
    Frontend: polling detecta preview_url ≠ null → mostra imagem ✅
```

> ⚡ **Retry:** 2 tentativas automáticas com backoff exponencial.
> 🔄 **Regenerar:** `POST /api/model/regenerate-preview` re-baixa a `face_ref_url` do DB e dispara nova geração (mantém modo multimodal).

---

### Prompts Centralizados

Arquivo: `src/lib/model-prompts.ts` — **fonte única de verdade**.

Exporta:
- `SKIN_DESC`, `HAIR_DESC`, `BODY_DESC`, `AGE_DESC`, `POSE_DESC` — mapas de descritores
- `buildGeminiParts(traits, faceBase64?, faceMime?)` — monta array de parts para a API Gemini

Consumidores:
- `src/lib/inngest/functions.ts` → job Inngest (fluxo principal)
- `src/lib/model-preview.ts` → fallback direto (fire-and-forget)

> Alterar prompts ou descritores em **um único arquivo** propaga para ambos os fluxos.

---

### Integração com VTO (Campanha)

A foto de referência **NÃO participa** do pipeline de campanha/VTO. O fluxo é:

1. Modelo é gerada (com ou sem face ref) → imagem salva como `preview_url`
2. Quando gera campanha → VTO busca `preview_url` (ou `image_url` para stock)
3. VTO veste a roupa **na imagem já gerada** → a cara certa já está lá!

> ✅ Pipeline VTO é 100% isolado. Não precisa da foto original nem do base64.

---

### Storage e Cleanup

| Operação | Bucket | Path |
|----------|--------|------|
| Face ref upload | `assets` | `face-refs/{storeId}/{uuid}.jpg` |
| Preview gerado | `assets` | `model-previews/{storeId}/{modelId}.png` |
| **Delete modelo** | `assets` | Remove **ambos** os arquivos automaticamente |

> 🧹 O `deleteStoreModel()` faz SELECT → extrai paths → `storage.remove()` antes do DELETE no DB.

---

## Tabela de Custos por Campanha

### Preços Oficiais dos Modelos — câmbio R$ 5,80/USD

> ✅ Todos os preços verificados contra documentação oficial (07/Abr/2026):
> - [Google AI Pricing](https://ai.google.dev/pricing)
> - [Anthropic Pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)

| Modelo | Input/MTok | Output/MTok | Fonte |
|--------|:----------:|:-----------:|:-----:|
| Gemini 2.5 Flash | $0.30 | $2.50 | Google |
| Gemini 2.5 Pro (≤200k) | $1.25 | $10.00 | Google |
| Gemini 3.1 Flash Image (texto) | $0.50 | $3.00 | Google |
| **Gemini 3.1 Flash Image (img 2K)** | — | **$0.101/img** (1680 tok × $60/MTok) | Google |
| Claude Sonnet 4 | $3.00 | $15.00 | Anthropic |

### 9 Chamadas de IA por Campanha (cenário: QA reprova)

| # | Step | Modelo | ~Input | ~Output | Custo USD | Custo BRL |
|---|------|--------|:------:|:-------:|:---------:|:---------:|
| 1 | Vision (foto produto) | Gemini 2.5 Flash | 1.500 | 500 | $0.00170 | R$ 0,010 |
| 2 | Strategy | Gemini 2.5 Pro | 2.000 | 800 | $0.01050 | R$ 0,061 |
| 3 | Copywriter | Claude Sonnet 4 | 3.000 | 2.000 | $0.03900 | R$ 0,226 |
| 4 | Refiner | Gemini 2.5 Flash | 3.000 | 1.500 | $0.00465 | R$ 0,027 |
| 5 | Scorer | Gemini 2.5 Flash | 2.500 | 500 | $0.00200 | R$ 0,012 |
| 6 | Mini-Vision VTO | Gemini 2.5 Flash | 1.200 | 400 | $0.00136 | R$ 0,008 |
| 7 | **VTO 1ª geração (img 2K)** | Gemini 3.1 Flash Image | 2.000 | 1 img | **$0.10200** | **R$ 0,592** |
| 8 | QA Visual Agent (CoT) | Gemini 2.5 Flash | 2.500 | 600 | $0.00225 | R$ 0,013 |
| 9 | **VTO 2ª geração (QA reprovou)** | Gemini 3.1 Flash Image | 2.500 | 1 img | **$0.10325** | **R$ 0,599** |
| | | | | | | |
| | **TOTAL (QA reprova)** | | | | **$0.2667** | **R$ 1,56** |
| | **TOTAL (QA aprova — sem step 9)** | | | | **$0.1635** | **R$ 0,95** |

> ⚠️ **Componente mais caro:** VTO (imagem 2K) = R$ 0,59/geração. Responde por **76%** do custo total.
> 📊 Custo médio ponderado (~20% retry): **R$ 1,07/campanha**
> Custo de **criar modelo personalizada** (fora do pipeline): **R$ 0,59**

---

## Cenários Disponíveis (Gemini Image)

Todos usam a **mesma chamada** — só muda o prompt de cenário:

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
| ✏️ Personalizado | Texto livre do usuário |

---

## Poses Disponíveis (pesquisa de conversão Instagram 2025)

As poses são sugeridas automaticamente pela Strategy com base no objetivo:

| Pose | Descrição | Melhor para |
|------|-----------|-------------|
| 🧍 Frontal 3/4 | Leve giro de corpo, uma perna relaxada, olhar direto | E-commerce, venda direta |
| 🚶 Andando | Passo natural, braços em movimento, sorriso casual | Saias, vestidos, looks fluidos |
| 💃 Confiante | Mão na cintura, peso em uma perna, queixo levantado | Lançamentos, looks premium |
| 👀 Olhar lateral | Corpo frontal, rosto virado, conexão sutil | Peças com detalhes nas costas |
| 🤚 Interagindo | Ajustando gola, mão no bolso, segurando acessório | Engajamento, mostrar detalhes |

> **Tendência 2025:** Poses candid/naturais convertem mais que poses rígidas.
> Evitar: Poses estáticas perfeitas demais (causam "fadiga de perfeição").

---

## Fluxo Visual (v2.1)

```
📸 Upload da(s) foto(s) do produto (até 3)
    ↓
[1] Gemini Flash Vision (Few-Shot) → analisa produto (cor, tecido, detalhes, campos VTO)
    ↓                                        ┌─── SSE streaming ──► Frontend
[2] Gemini Pro Strategy → cria estratégia     │    (progresso real)
    ↓                                        │
[3] Claude Sonnet 4 Copywriter (AIDA/PAS/BAF) │
    ↓                                        │
[4] Gemini Flash Refiner → refina textos      │
    ↓ (sequencial)                            │
[5] Gemini Flash Scorer → avalia REFINADOS    │
    ↓                                        │
[6] Gemini 3.1 Flash Image (Realismo+) ──────┘
    ↓                          ↑ (paralelo com passos 1-5)
[6b] QA Visual Agent 🔍 (Chain of Thought)
    ↓
    ┌─ ✅ Aprovado → usa imagem
    └─ ❌ Reprovado → 2ª geração com RETRY FOCUS CRITICAL OVERRIDE
    ↓
🎨 Konva Compositor → monta criativo final
   (texto + logo + CTA sobre a imagem)
    ↓
✅ Campanha pronta!
```

---

## Melhorias Pendentes (identificadas na auditoria v2.1)

| # | Melhoria | Impacto | Custo extra |
|---|---------|---------|:-----------:|
| 1 | Remover dead code no Refiner (`responseSchema ? undefined : undefined`) | Legibilidade | R$ 0,00 |
| 2 | Re-rodar Scorer após auto-retry (score < 40) para refletir nota real | Score fidedigno | ~R$ 0,003 (~5% das campanhas) |
| 3 | Try/catch no `writer.close()` do SSE | Resiliência | R$ 0,00 |

---

## Economia vs Pipeline Anterior (Fashn.ai)

| | Pipeline Fashn (antes) | Pipeline Gemini (agora) |
|--|:---:|:---:|
| Chamadas de imagem | 2 (tryon + edit) | **1-2** (VTO + retry) |
| Fotos de entrada | 1 produto | **Até 14** |
| Resolução máxima | 1K | **4K** |
| Tempo de geração | 50-150s | **10-30s** |
| Custo por campanha (QA aprova) | R$ 1,55 | **R$ 0,95** |
| Custo por campanha (QA reprova) | R$ 1,55 | **R$ 1,56** |
| Custo médio ponderado (~20% retry) | R$ 1,55 | **R$ 1,07** |
| **Economia média** | — | **31%** |
