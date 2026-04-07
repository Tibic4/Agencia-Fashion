# Pipeline CriaLook — Passo a Passo

> Resumo executivo: cada campanha faz **5 chamadas LLM + 1-2 chamadas Gemini Image + 1 QA Visual**.
> Custo total por campanha: **~R$ 0,29-0,45** (LLM + imagem Gemini + QA).
> Custo de criar modelo personalizada: **~R$ 0,01** (Gemini 3.1 Flash Image).
> Provider de imagem: Gemini 3.1 Flash Image Preview (até 14 referências, 4K max)
> QA Visual Agent: Gemini 2.5 Flash (verifica fidelidade do VTO automaticamente)

---

## Os 6 Passos

### PASSO 1 — Vision (Gemini 2.5 Flash)
**O que faz:** Recebe a foto do produto e analisa tudo — cor, tecido, modelagem, detalhes, estampa.
**Entrada:** Foto(s) do produto + tipo informado + material informado
**Saída:** JSON com nome, categoria, cores, material, detalhes visuais, mood
**Custo:** ~R$ 0,01

---

### PASSO 2 — Strategy (Gemini 2.5 Pro)
**O que faz:** Com base na análise visual, cria a estratégia de venda — ângulo, gatilho, tom, público ideal. Inclui sugestão de **pose** para a modelo.
**Entrada:** Análise do passo 1 + preço + objetivo + público-alvo
**Saída:** JSON com ângulo de venda, gatilho mental, tom, contra-objeção, CTAs, **pose_direction**
**Custo:** ~R$ 0,08

**Poses sugeridas por objetivo:**

| Objetivo | Pose sugerida |
|----------|--------------|
| Venda imediata | Frontal 3/4, mãos relaxadas, olhar direto — foco no produto |
| Lançamento | Pose dinâmica, uma mão na cintura, olhar confiante |
| Promoção | Andando naturalmente, sorriso natural, casual |
| Engajamento | Pose expressiva, interagindo com acessório, olhar para o lado |

---

### PASSO 3 — Copywriter (Claude Sonnet 4)
**O que faz:** Gera todos os textos da campanha — feed, stories, WhatsApp, Meta Ads.
**Entrada:** Análise visual + estratégia + nome da loja + preço
**Saída:** JSON com headline, legenda feed, stories (4 slides), WhatsApp, Meta Ads, hashtags
**Custo:** ~R$ 0,12

---

### PASSO 4 — Refiner (Gemini 2.5 Flash)  ⚡ paralelo
**O que faz:** Revisa e melhora os textos — remove clichês, ajusta tom, otimiza para cada plataforma.
**Entrada:** Textos brutos do copywriter
**Saída:** Textos refinados e pontuados
**Custo:** ~R$ 0,02

### PASSO 5 — Scorer (Gemini 2.5 Flash)  ⚡ paralelo
**O que faz:** Avalia a qualidade da campanha (0-100) e sugere melhorias.
**Entrada:** Textos + estratégia + análise visual
**Saída:** Score geral + scores por dimensão + sugestões
**Custo:** ~R$ 0,01

> Passos 4 e 5 rodam **em paralelo** para economizar tempo.

---

### PASSO 6 — Gemini 3.1 Flash Image: Virtual Try-On + Cenário
**O que faz:** Em uma ÚNICA chamada, veste a roupa na modelo + aplica cenário + define pose.
**Entrada:**
  - Foto(s) do produto (até 3: principal + close-up + 2ª peça)
  - Foto da modelo do banco
  - Prompt com cenário + pose + instruções de fidelidade
**Saída:** Imagem da modelo vestindo a roupa
**Modelo:** `gemini-3.1-flash-image-preview`
**Resolução:** 2K (default) — suporta até 4K
**Custo:** ~R$ 0,02-0,04

> ✅ O Gemini aceita até **14 imagens de referência** em uma única chamada.
> As 3 fotos do produto são usadas: principal (silhueta), close-up (textura), 2ª peça (conjunto).

---

### PASSO 6b — QA Visual Agent (Gemini 2.5 Flash)  🔍 automático
**O que faz:** Compara a imagem VTO gerada contra o produto original para verificar fidelidade.
**Analisa:** Cor, textura do tecido, detalhes (botões, estampas), caimento, silhueta.
**Decisão:**
  - ✅ **Aprovado** (maioria dos casos) → usa a 1ª imagem
  - ❌ **Reprovado** (problemas graves) → gera 2ª imagem com prompt de correção
**Modelo:** `gemini-2.5-flash` (texto + visão)
**Custo:** ~R$ 0,01 (QA) + ~R$ 0,04 (2ª geração se necessário)
**Tempo extra:** ~2-3s (QA) + ~10-15s (2ª geração se necessário)

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

---

## Tabela de Custos por Campanha

### LLM (texto) — câmbio R$ 5,80/USD

> ✅ Todos os preços verificados contra documentação oficial (Abr/2026):
> - [docs.anthropic.com/en/docs/about-claude/pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
> - [ai.google.dev/pricing](https://ai.google.dev/pricing)

| Step | Provider | Modelo | Preço Input/MTok | Preço Output/MTok | Tokens ~in | Tokens ~out | Custo R$ |
|------|----------|--------|-----------------|------------------|-----------|------------|----------|
| Vision | Google | Gemini 2.5 Flash | $0.30 | $2.50 | ~1.500 | ~500 | R$ 0,01 |
| Strategy | Google | Gemini 2.5 Pro | $1.25 | $10.00 | ~2.000 | ~800 | R$ 0,08 |
| Copywriter | Anthropic | Claude Sonnet 4 | $3.00 | $15.00 | ~3.000 | ~2.000 | R$ 0,12 |
| Refiner | Google | Gemini 2.5 Flash | $0.30 | $2.50 | ~3.000 | ~1.500 | R$ 0,02 |
| Scorer | Google | Gemini 2.5 Flash | $0.30 | $2.50 | ~2.500 | ~500 | R$ 0,01 |
| **Subtotal LLM** | | | | | | | **R$ 0,24** |

### Gemini Image (virtual try-on) + QA — token-based pricing

| Operação | Resolução | Custo estimado |
|----------|-----------|---------------|
| **VTO + cenário** (vestir + fundo + pose) | 2K | **~R$ 0,02-0,04** |
| **QA Visual Agent** (verificação de fidelidade) | — | **~R$ 0,01** |
| **2ª geração** (se QA reprova, ~20% dos casos) | 2K | **~R$ 0,04** |
| Preview de modelo (criar modelo) | 1K | **~R$ 0,01** |

### TOTAL por Campanha

| Componente | Custo (QA aprova) | Custo (QA reprova) |
|-----------|:-:|:-:|
| LLM (5 chamadas) | R$ 0,24 | R$ 0,24 |
| Gemini Image VTO (1ª) | R$ 0,04 | R$ 0,04 |
| QA Visual Agent | R$ 0,01 | R$ 0,01 |
| 2ª geração VTO | — | R$ 0,04 |
| **TOTAL** | **~R$ 0,29** | **~R$ 0,33** |

> Custo de **criar modelo personalizada** (passo extra, fora do pipeline): ~R$ 0,01
> ⚡ QA aprova na maioria dos casos — custo médio: ~R$ 0,30

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

## Fluxo Visual

```
📸 Upload da(s) foto(s) do produto (até 3)
    ↓
[1] Gemini Flash Vision → analisa produto (cor, tecido, detalhes)
    ↓
[2] Gemini Pro Strategy → cria estratégia + sugere pose
    ↓
[3] Claude Sonnet 4 Copywriter → gera textos
    ↓
[4] Gemini Flash Refiner ─┐
[5] Gemini Flash Scorer  ─┤ (paralelo)
    ↓
[6] Gemini 3.1 Flash Image → VTO + cenário + pose (1ª geração)
    ↓
[6b] QA Visual Agent 🔍 → compara VTO vs produto original
    ↓
    ┌─ ✅ Aprovado → usa imagem
    └─ ❌ Reprovado → 2ª geração com correções
    ↓
🎨 Konva Compositor → monta criativo final
   (texto + logo + CTA sobre a imagem)
    ↓
✅ Campanha pronta!
```

---

## Economia vs Pipeline Anterior (Fashn.ai)

| | Pipeline Fashn (antes) | Pipeline Gemini (agora) |
|--|:---:|:---:|
| Chamadas de imagem | 2 (tryon + edit) | **1** |
| Fotos de entrada | 1 produto | **Até 14** |
| Resolução máxima | 1K | **4K** |
| Tempo de geração | 50-150s | **10-30s** |
| Custo por campanha | R$ 1,55 | **R$ 0,28** |
| **Economia** | — | **82%** |
