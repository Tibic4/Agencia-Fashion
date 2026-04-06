# 🔗 Mapeamento: Formulário → Pipeline → Prompts

> Como cada campo da tela `/gerar` alimenta a pipeline de IA
> Última atualização: 06/04/2026

---

## 1. 📸 Upload da Foto

| Campo UI | FormData | Variável no route.ts | Onde entra na pipeline |
|----------|----------|---------------------|----------------------|
| Dropzone "Arraste a foto" | `image` (File) | `imageFile` → `imageBase64` | **Vision** (Step 1) — foto enviada como `inlineData` multimodal |

**No prompt Vision**: A foto é a entrada principal. O Gemini Flash analisa visualmente e extrai cor, tecido, estilo, detalhes, mood, etc.

**Status**: ✅ **Conectado e funcional**

---

## 2. 🎯 Objetivo

| Campo UI | Opções | FormData | Variável | Onde entra |
|----------|--------|----------|----------|------------|
| Cards "Venda imediata" etc | `venda_imediata`, `lancamento`, `promocao`, `engajamento` | `objective` | `objective` | **Strategy** (Step 2) |

**No prompt Strategy** (linha 134):
```
OBJETIVO: ${params.objetivo}
```
O Gemini Pro usa isso para decidir o ângulo de venda, gatilho (escassez vs novidade vs desconto) e tom.

**Status**: ✅ **Conectado e funcional**

---

## 3. 🔘 Toggle "Usar modelo virtual"

| Campo UI | FormData | Variável | Onde entra |
|----------|----------|----------|------------|
| Toggle on/off | `useModel` | `useModel` (boolean) | **Virtual Try-On** (após pipeline de texto) |

**No route.ts**:
```ts
if (useModel && store) {
  // Fashn.ai → product-to-model ou tryon-max
}
```
Controla se a geração de imagem de modelo vestindo a peça será executada. **NÃO afeta o pipeline de texto** (Vision/Strategy/Copy/Refiner/Scorer).

**Status**: ✅ **Conectado e funcional**

---

## 4. 👤 Tipo de corpo (Normal / Plus Size)

| Campo UI | Opções | FormData | Variável | Onde entra |
|----------|--------|----------|----------|------------|
| Cards "Normal" / "Plus Size" | `normal`, `plus` | `bodyType` | `bodyType` | **Strategy** + **Copywriter** + **Try-On** |

**No prompt Strategy**:
```
CONTEXTO PLUS SIZE: Esta é uma loja de moda plus size / inclusiva. A estratégia DEVE:
- Valorizar corpos reais e diversos
- Usar linguagem body-positive e empoderadora
- Evitar COMPLETAMENTE termos como "disfarçar", "esconder", "emagrecer"
```

**No prompt Copywriter**:
```
REGRAS PLUS SIZE (OBRIGATÓRIAS):
- Use linguagem body-positive e empoderadora
- PROIBIDO: "disfarçar", "esconder", "emagrecer", "afinar"
- Hashtags DEVEM incluir: #modaplussize #plussize #bodypositive
```

**No Try-On (Fashn.ai)**: Passa `bodyType` para gerar modelo com corpo adequado.

**Prompt product-to-model (Normal)**:
```
Full body photo from head to feet of a slim attractive Brazilian woman 
(P/M sizing, US 4-8). Barefoot, no shoes.
```

**Prompt product-to-model (Plus)**:
```
Full body photo from head to feet of a beautiful plus-size/curvy 
Brazilian woman (GG/XGG sizing, US 14-18). Full curves, wide hips, 
thick thighs. Barefoot, no shoes. DO NOT generate slim/thin body.
```

**Status**: ✅ **Conectado e funcional** — afeta prompts de texto E imagem

---

## 5. 👩 Escolha a modelo (Banco de Modelos)

| Campo UI | FormData | Variável | Onde entra |
|----------|----------|----------|------------|
| Grid de modelos (20 stock + personalizadas) | `modelBankId` | `modelBankId` | **Virtual Try-On** (Fashn.ai `tryon-max`) |

**Banco atual no Supabase** (tabela `model_bank`, bucket `models`):
- 10 modelos **Normal** (diversidade de pele: clara, média, morena, negra)
- 10 modelos **Plus Size** (mesma diversidade)
- Todas com corpo inteiro, descalças, camiseta branca + short preto
- Filtro por body_type na UI

**Fluxo de decisão**:
| Seleção | O que acontece | Chamada API | Custo |
|---------|---------------|-------------|-------|
| "Aleatória" 🎲 | IA gera modelo do zero | `product-to-model` | $0.03 |
| Modelo do banco | Roupa é vestida na modelo | `tryon-max` | $0.08 |
| Modelo personalizada ⭐ | Roupa é vestida na modelo do lojista | `tryon-max` | $0.08 |

**NÃO afeta o pipeline de texto** — é exclusivo para geração de imagem.

**Status**: ✅ **Conectado e funcional** — 20 modelos stock ativas no Supabase

---

## 6. 👕 Tipo de produto

| Campo UI | Opções | FormData | Variável | Onde entra |
|----------|--------|----------|----------|------------|
| Cards com emoji | `blusa`, `saia`, `calca`, `vestido`, `macacao`, `jaqueta`, `conjunto`, `acessorio` | `productType` | `productType` | **Vision** (Step 1) + **Pipeline params** |

**No prompt Vision**:
```
IMPORTANTE: O usuário informou que este produto é do tipo "blusa".
```
Ajuda o Gemini Flash a não confundir categorias (ex: cropped vs blusa, macacão vs vestido).

**Status**: ✅ **Conectado e funcional**

---

## 7. 🧵 Material / Tecido (Chips visuais)

| Campo UI | FormData | Variável | Onde entra |
|----------|----------|----------|------------|
| Grid de chips selecionáveis | `material` | `material` | **Vision** (Step 1) |

**Opções disponíveis** (chips):
`algodao`, `seda`, `linho`, `jeans`, `viscose`, `trico`, `couro`, `renda`, `chiffon`, `poliester`, `la`, `nylon`, `suede`, `outro` (campo livre)

**No prompt Vision**:
```
IMPORTANTE: O usuário informou que o material/tecido é "tricô canelado". 
Use EXATAMENTE este material na análise, NÃO tente adivinhar outro.
```

Se nenhum chip selecionado → campo vazio → Vision detecta automaticamente pela foto.

**Status**: ✅ **Conectado e funcional** — chips visuais (antes era dropdown)

---

## 8. 💰 Preço de venda (OPCIONAL)

| Campo UI | FormData | Variável | Onde entra |
|----------|----------|----------|------------|
| Input "R$ Ex: 89,90" (label "opcional") | `price` | `price` | **Strategy** + **Copywriter** + **Scorer** |

> ⚠️ **Preço agora é OPCIONAL**: Se não informado, a pipeline gera sem mencionar preço nos textos.

**Quando preço é informado**:

**No prompt Strategy**:
```
PREÇO: R$ 89,90 (faixa: médio (custo-benefício))
```
Faixas auto-detectadas: ≤R$59 (impulso), ≤R$149 (custo-benefício), ≤R$299 (aspiracional), >R$299 (premium)

**No Copywriter**:
```
PREÇO: R$ 89,90
Preço EXATO de R$ 89,90 — destaque com emoji ou negrito
```

**No Scorer**: Verifica posicionamento do preço nos textos.

**Quando preço NÃO é informado**: Campos de preço omitidos dos prompts; textos gerados sem valor monetário.

**Status**: ✅ **Conectado e funcional** — opcional desde v2.2

---

## 9. 🎨 Cenário (antes "Fundo")

| Campo UI | Opções | FormData | Variável | Onde entra |
|----------|--------|----------|----------|------------|
| Grid 4×3 com thumbnails corpo inteiro | 9 opções | `backgroundType` | `backgroundType` | **Fashn.ai `edit`** (Step 7) |

**9 cenários disponíveis**:

| Cenário | Valor | Thumbnail | Prompt Fashn.ai `edit` |
|---------|---------|-----------|----------------------|
| ⬜ Branco | `branco` | `/bg/branco.png` | Clean pure white studio, even soft lighting |
| 📸 Estúdio | `estudio` | `/bg/estudio.png` | Grey gradient backdrop, professional softboxes |
| 🌿 Lifestyle | `lifestyle` | `/bg/lifestyle.png` | Bright modern apartment, natural sunlight |
| 🏙️ Urbano | `urbano` | `/bg/urbano.png` | Modern urban street, concrete walls, street art |
| 🌳 Natureza | `natureza` | `/bg/natureza.png` | Outdoor setting, green trees, golden hour |
| 🏠 Interior | `interior` | `/bg/interior.png` | Elegant modern interior, designer furniture |
| 🛍️ Boutique | `boutique` | `/bg/boutique.png` | Luxury boutique, marble, gold accents |
| ✨ Gradiente | `gradiente` | `/bg/gradiente.png` | Smooth gradient pink to lavender |
| ✏️ Personalizado | `personalizado` | — | Texto livre do usuário |

**Todas as thumbnails**: Mesma modelo, corpo inteiro, mesma pose — garantem consistência visual.

**NÃO afeta o pipeline de texto** — apenas a imagem gerada.

**NÃO aumenta custo** — reutiliza a chamada `edit` ($0.02) que já faria o alisamento + remoção de etiquetas.

**Status**: ✅ **Conectado e funcional** — 9 cenários, thumbnails HD

---

## Campos "escondidos" (Opções Avançadas)

| Campo | FormData | Onde entra |
|-------|----------|------------|
| Nome da loja | `storeName` | Copywriter (`LOJA: ${params.loja}`) |
| Público-alvo | `targetAudience` | Strategy (`PÚBLICO-ALVO: ...`) |
| Tom de voz | `toneOverride` | Strategy (`TOM DE VOZ: ...`) |

---

## Resumo Visual

```
┌─────────────────┐
│ 1. Foto         │──→ Vision (Gemini 2.5 Flash) ──→ analisa produto
│ 6. Tipo produto │──→ Vision (hint de categoria)
│ 7. Material     │──→ Vision (hint de tecido) [chips visuais]
└─────────────────┘
         ↓ (output: atributos visuais)
┌─────────────────┐
│ 2. Objetivo     │──→ Strategy (Gemini 2.5 Pro) ──→ define ângulo
│ 8. Preço        │──→ Strategy (faixa de preço) [OPCIONAL]
│ 4. Body type    │──→ Strategy (contexto plus size)
│    Público-alvo │──→ Strategy (opcional)
│    Tom de voz   │──→ Strategy (override)
└─────────────────┘
         ↓ (output: estratégia)
┌─────────────────┐
│ 8. Preço        │──→ Copywriter (Claude Sonnet 4) ──→ textos [OPCIONAL]
│ 4. Body type    │──→ Copywriter (regras plus size)
│    Nome loja    │──→ Copywriter (personalização)
└─────────────────┘
         ↓ (output: textos)
┌─────────────────┐
│ (nenhum campo)  │──→ Refiner ∥ Scorer (Gemini 2.5 Flash × 2) [PARALELO]
└─────────────────┘
         ↓
┌─────────────────┐
│ 3. Toggle       │──→ Fashn.ai (se modelo virtual ativo)
│ 4. Body type    │──→ product-to-model (corpo da modelo) [DESCALÇA]
│ 5. Modelo banco │──→ tryon-max (se modelo selecionada do banco)
│ 9. Cenário      │──→ edit (aplica cenário + alisa + limpa artefatos)
└─────────────────┘
         ↓
┌─────────────────┐
│ Konva Compositor│──→ Monta criativo final (texto + logo + CTA)
└─────────────────┘
         ↓
✅ Campanha pronta!
```

---

## Prompts de Imagem (Fashn.ai) — Alinhamento Atual

### `product-to-model` (produção, `client.ts` L256-260)
```
Full body photo from head to feet of a [bodyInstruction].
Confident natural smile, relaxed standing pose.
Clean white studio background, professional fashion e-commerce photography. 
High resolution, sharp focus.
CRITICAL: Reproduce the garment EXACTLY as shown — preserve every detail.
REMOVE any price tags, store labels, barcodes.
KEEP functional accessories.
Barefoot, no shoes.
Full body VISIBLE from head to toes. NO cropping at knees or ankles.
```

### `edit` — cenário (produção, `client.ts` BACKGROUND_PROMPTS)
Cada cenário = um prompt diferente, todos incluem:
```
CRITICAL: Preserve ALL garment details exactly.
Smooth fabric without wrinkles.
REMOVE any price tags, store labels, barcodes.
KEEP functional accessories. Remove mannequin artifacts.
```

---

## Veredicto: Prompt Quality

| Step | Prompt | Qualidade | Observações |
|------|--------|-----------|-------------|
| Vision | `buildVisionPrompt()` | ⭐⭐⭐⭐⭐ | Anti-manequim, detecta cor real, aceita hints |
| Strategy | `buildStrategyPrompt()` | ⭐⭐⭐⭐⭐ | Faixa de preço auto-detectada, plus size, urgência |
| Copywriter | `buildCopywriterPrompt()` | ⭐⭐⭐⭐⭐ | Anti-clichê, compliance Meta Ads, tom brasileiro real |
| Refiner | `buildRefinerPrompt()` | ⭐⭐⭐⭐ | Checklist 12 pontos, falta exemplos before/after |
| Scorer | `buildScorerPrompt()` | ⭐⭐⭐⭐ | Pesos claros, alertas Meta Ads, falta benchmark |
| product-to-model | Fashn.ai `client.ts` | ⭐⭐⭐⭐⭐ | Corpo inteiro, descalça, preserva detalhes, HD |
| edit (cenário) | Fashn.ai `client.ts` | ⭐⭐⭐⭐⭐ | 3-em-1: cenário + alisar + limpar artefatos |

**Geral**: Pipeline v2.2 — prompts refinados, 9 cenários, 20 modelos HD, preço opcional, chips visuais.
