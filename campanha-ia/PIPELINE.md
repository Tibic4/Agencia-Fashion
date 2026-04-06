# Pipeline CriaLook — Passo a Passo

> Resumo executivo: cada campanha faz **5 chamadas LLM + 2 chamadas Fashn.ai**.
> Custo total por campanha: **~R$ 1,11** (Pipeline A+) ou **~R$ 1,11** (com Banco de Modelos).
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
**O que faz:** Pega a foto da roupa e gera uma modelo vestindo a peça (corpo inteiro).
**Entrada:** Foto do produto + tipo de corpo (normal/plus)
**Saída:** Imagem da modelo vestindo a roupa (fundo branco)

| Caminho | Quando usa | Chamada | Créditos | Custo USD |
|---------|-----------|---------|----------|----------|
| **Pipeline A+** | Sem modelo do banco | `product-to-model` | 1 | $0.075 |
| **Banco de Modelos** | Com modelo selecionada | `tryon-max` | 1 | $0.075 |

> ⚠️ Ambos custam **o mesmo** na config padrão (Fast/1K = 1 crédito).
> Custo sobe se mudar resolução: 2K=2 créd, 4K Quality=5 créd ($0.375 = R$ 2,18).

---

### PASSO 7 — Fashn.ai: Refinar + Cenário (edit)
**O que faz:** 3 coisas em 1 chamada:
- 🎨 Aplica o cenário escolhido (branco, urbano, boutique, etc.)
- 👗 Alisa o tecido e corrige caimento da roupa
- 🏷️ Remove etiquetas de preço, tags, adesivos e artefatos de manequim
**Entrada:** Imagem do passo 6 + prompt do cenário
**Saída:** Imagem final polida com fundo profissional
**Custo:** 1 crédito = $0.075 (Fast/1K default)

---

## Tabela de Custos por Campanha

### LLM (texto) — câmbio R$ 5,80/USD

| Step | Provider | Modelo | Tokens ~in | Tokens ~out | Custo R$ |
|------|----------|--------|-----------|------------|----------|
| Vision | Google | Gemini 2.5 Flash | ~1.500 | ~500 | R$ 0,01 |
| Strategy | Google | Gemini 2.5 Pro | ~2.000 | ~800 | R$ 0,08 |
| Copywriter | Anthropic | Claude Sonnet 4 | ~3.000 | ~2.000 | R$ 0,12 |
| Refiner | Google | Gemini 2.5 Flash | ~3.000 | ~1.500 | R$ 0,02 |
| Scorer | Google | Gemini 2.5 Flash | ~2.500 | ~500 | R$ 0,01 |
| **Subtotal LLM** | | | | | **R$ 0,24** |

### Fashn.ai (imagem) — $0.075/crédito, câmbio R$ 5,80/USD

> Fonte oficial: [Fashn API Pricing](https://help.fashn.ai/plans-and-pricing/api-pricing)
> Nosso pipeline usa padrão Fast/1K (1 crédito por chamada).

| Operação | Créditos | Custo USD | Custo R$ |
|----------|----------|-----------|----------|
| product-to-model (Pipeline A+) | 1 | $0.075 | R$ 0,44 |
| tryon-max (Banco Modelos) | 1 | $0.075 | R$ 0,44 |
| edit (cenário) | 1 | $0.075 | R$ 0,44 |
| model-create (criar modelo personalizada) | 1 | $0.075 | R$ 0,44 |
| **Subtotal Fashn (por campanha)** | **2** | **$0.15** | **R$ 0,87** |

> 📝 `product-to-model` e `tryon-max` custam o mesmo no Fast/1K.
> O custo R$ 2,18 que aparece em alguns docs é para Quality/4K (5 créditos).

### TOTAL por Campanha

| Caminho | LLM | Fashn (2 chamadas) | **TOTAL** |
|---------|-----|-------------------|-----------|
| Pipeline A+ (sem banco) | R$ 0,24 | R$ 0,87 | **R$ 1,11** |
| Com Banco de Modelos | R$ 0,24 | R$ 0,87 | **R$ 1,11** |

> Custo de **criar modelo personalizada** (passo extra, fora do pipeline): +R$ 0,44

---

## Cenários Disponíveis (Fashn.ai edit)

Todos usam a **mesma chamada** (edit, $0.02) — só muda o prompt:

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
