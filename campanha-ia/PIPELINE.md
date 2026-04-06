# Pipeline CriaLook — Passo a Passo

> Resumo executivo: cada campanha faz **5 chamadas LLM + 2 chamadas Fashn.ai**.
> Custo total por campanha: **~R$ 1,55** (3 créditos Fashn + LLM).
> Custo de criar modelo personalizada: **R$ 0,44** (1 crédito Fashn.ai).
> Fonte: [help.fashn.ai/plans-and-pricing/api-pricing](https://help.fashn.ai/plans-and-pricing/api-pricing)

---

## Os 7 Passos

### PASSO 1 — Vision (Gemini 2.5 Flash)
**O que faz:** Recebe a foto do produto e analisa tudo — cor, tecido, modelagem, detalhes, estampa.
**Entrada:** Foto(s) do produto + tipo informado + material informado
**Saída:** JSON com nome, categoria, cores, material, detalhes visuais, mood
**Custo:** ~R$ 0,01

---

### PASSO 2 — Strategy (Gemini 2.5 Pro)
**O que faz:** Com base na análise visual, cria a estratégia de venda — ângulo, gatilho, tom, público ideal.
**Entrada:** Análise do passo 1 + preço + objetivo + público-alvo
**Saída:** JSON com ângulo de venda, gatilho mental, tom, contra-objeção, CTAs
**Custo:** ~R$ 0,08

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

### PASSO 6 — Fashn.ai: Gerar Modelo (product-to-model ou try-on)
**O que faz:** Pega a foto da roupa e veste na modelo do banco (corpo inteiro).
**Entrada:** Foto do produto + modelo do banco selecionada
**Saída:** Imagem da modelo vestindo a roupa
**Chamada:** `tryon-max` (2 créditos — quality mode auto)
**Custo:** $0.15 = **R$ 0,87**

> ⚠️ Quando `generation_mode` é omitido, **tryon-max usa 'quality' automaticamente** (2 créditos).
> Ref: [docs.fashn.ai/api-reference/tryon-max](https://docs.fashn.ai/api-reference/tryon-max)

---

### PASSO 7 — Fashn.ai: Refinar + Cenário (edit)
**O que faz:** 3 coisas em 1 chamada:
- 🎨 Aplica o cenário escolhido (branco, urbano, boutique, etc.)
- 👗 Alisa o tecido e corrige caimento da roupa
- 🏷️ Remove etiquetas de preço, tags, adesivos e artefatos de manequim
**Entrada:** Imagem do passo 6 + prompt do cenário
**Saída:** Imagem final polida com fundo profissional
**Custo:** 1 crédito = $0.075 = R$ 0,44 (Fast/1K default)

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

### Fashn.ai (imagem) — $0.075/crédito, câmbio R$ 5,80/USD

> Fonte oficial: [Fashn API Pricing](https://help.fashn.ai/plans-and-pricing/api-pricing)
> Docs por endpoint: [docs.fashn.ai](https://docs.fashn.ai/)

| Operação | Créditos | Custo USD | Custo R$ | Notas |
|----------|----------|-----------|----------|-------|
| **tryon-max** (vestir peça na modelo) | **2** | **$0.15** | **R$ 0,87** | quality auto |
| edit (cenário/refinamento) | 1 | $0.075 | R$ 0,44 | fast/1K auto |
| model-create (criar modelo) | 1 | $0.075 | R$ 0,44 | avulso |

### TOTAL por Campanha

| Componente | Custo |
|-----------|-------|
| LLM (5 chamadas) | R$ 0,24 |
| Fashn tryon-max (2 créd) | R$ 0,87 |
| Fashn edit (1 créd) | R$ 0,44 |
| **TOTAL** | **R$ 1,55** |

> Custo de **criar modelo personalizada** (passo extra, fora do pipeline): +R$ 0,44

---

## Cenários Disponíveis (Fashn.ai edit)

Todos usam a **mesma chamada** (edit, $0.075 = R$ 0,44) — só muda o prompt:

| Cenário | Descrição do prompt |
|---------|-------------------|
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

## Fluxo Visual

```
📸 Upload da foto
    ↓
[1] Gemini Flash Vision → analisa produto
    ↓
[2] Gemini Pro Strategy → cria estratégia
    ↓
[3] Claude Sonnet 4 Copywriter → gera textos
    ↓
[4] Gemini Flash Refiner ─┐
[5] Gemini Flash Scorer  ─┤ (paralelo)
    ↓
[6] Fashn.ai → gera modelo vestindo a roupa
    ↓
[7] Fashn.ai edit → aplica cenário escolhido
    ↓
🎨 Konva Compositor → monta criativo final
   (texto + logo + CTA sobre a imagem)
    ↓
✅ Campanha pronta!
```
