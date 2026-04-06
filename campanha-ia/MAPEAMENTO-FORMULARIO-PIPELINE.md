# 🔗 Mapeamento: Formulário → Pipeline → Prompts

> Como cada campo da tela `/gerar` alimenta a pipeline de IA

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

**No route.ts** (linha 171):
```ts
if (useModel && store) {
  // Tenta Fashn.ai → fallback Nano Banana 2
}
```
Controla se a geração de imagem de modelo vestindo a peça será executada. **NÃO afeta o pipeline de texto** (Vision/Strategy/Copy/Refiner/Scorer).

**Status**: ✅ **Conectado e funcional**

---

## 4. 👤 Tipo de corpo (Normal / Plus Size)

| Campo UI | Opções | FormData | Variável | Onde entra |
|----------|--------|----------|----------|------------|
| Cards "Normal" / "Plus Size" | `normal`, `plus` | `bodyType` | `bodyType` | **Strategy** + **Copywriter** + **Try-On** |

**No prompt Strategy** (linhas 110-117):
```
CONTEXTO PLUS SIZE: Esta é uma loja de moda plus size / inclusiva. A estratégia DEVE:
- Valorizar corpos reais e diversos
- Usar linguagem body-positive e empoderadora
- Evitar COMPLETAMENTE termos como "disfarçar", "esconder", "emagrecer"
```

**No prompt Copywriter** (linhas 203-210):
```
REGRAS PLUS SIZE (OBRIGATÓRIAS):
- Use linguagem body-positive e empoderadora
- PROIBIDO: "disfarçar", "esconder", "emagrecer", "afinar"
- Hashtags DEVEM incluir: #modaplussize #plussize #bodypositive
```

**No Try-On**: Passa `bodyType` para Nano Banana (define proporções do corpo gerado).

**Status**: ✅ **Conectado e funcional** — afeta prompts E imagem

---

## 5. 👩 Escolha a modelo (Banco de Modelos)

| Campo UI | FormData | Variável | Onde entra |
|----------|----------|----------|------------|
| Grid de modelos com fotos | `modelBankId` | `modelBankId` | **Virtual Try-On** (Fashn.ai `tryon-max`) |

**No route.ts** (linhas 187-215):
```ts
if (modelBankId && productUrl && process.env.FASHN_API_KEY) {
  // Busca a imagem da modelo no Supabase (model_bank)
  // Chama generateWithModelBank() → tryon-max + edit
}
```

Se o usuário selecionar "Aleatória", o `modelBankId` é null e usa a modelo ativa da loja ou product-to-model.

**NÃO afeta o pipeline de texto** — é exclusivo para geração de imagem.

**Status**: ✅ **Conectado e funcional**

---

## 6. 👕 Tipo de produto

| Campo UI | Opções | FormData | Variável | Onde entra |
|----------|--------|----------|----------|------------|
| Cards "Blusa", "Saia", etc | 8 categorias | `productType` | `productType` | **Vision** (Step 1) + **Pipeline params** |

**No prompt Vision** (linha 19):
```
IMPORTANTE: O usuário informou que este produto é do tipo "blusa".
```
Ajuda o Gemini Flash a não confundir categorias (ex: cropped vs blusa, macacão vs vestido).

Também é passado para o `runCampaignPipeline()` (linha 365):
```ts
productType: productType || undefined,
```

**Status**: ✅ **Conectado e funcional**

---

## 7. 🧵 Material / Tecido

| Campo UI | FormData | Variável | Onde entra |
|----------|----------|----------|------------|
| Select "Não sei / Deixar IA detectar" | `material` | `material` | **Vision** (Step 1) |

**No prompt Vision** (linhas 21-22):
```
IMPORTANTE: O usuário informou que o material/tecido é "tricô canelado". 
Use EXATAMENTE este material na análise, NÃO tente adivinhar outro.
```
Se "Não sei" → campo vazio → Vision usa análise visual para detectar o tecido.

**Status**: ✅ **Conectado e funcional**

---

## 8. 💰 Preço de venda

| Campo UI | FormData | Variável | Onde entra |
|----------|----------|----------|------------|
| Input "R$ Ex: 89,90" | `price` | `price` | **Strategy** + **Copywriter** + **Scorer** |

**No prompt Strategy** (linha 130):
```
PREÇO: R$ 89,90 (faixa: médio (custo-benefício))
```
O Strategy auto-detecta a faixa de preço:
- ≤ R$ 59 → "entrada (impulso)"
- ≤ R$ 149 → "médio (custo-benefício)"
- ≤ R$ 299 → "médio-alto (aspiracional)"
- > R$ 299 → "premium (exclusividade)"

**No Copywriter** (linhas 220, 258):
```
PREÇO: R$ 89,90
Preço EXATO de R$ 89,90 — destaque com emoji ou negrito
```

**No Scorer** (linha 350): Usado para verificar se o preço está bem posicionado nos textos.

**Status**: ✅ **Conectado e funcional** — presente em 3 etapas

---

## 9. 🎨 Fundo do criativo

| Campo UI | Opções | FormData | Variável | Onde entra |
|----------|--------|----------|----------|------------|
| Cards "Branco", "Estúdio", "Lifestyle IA" | `branco`, `estudio`, `lifestyle` | `backgroundType` | `backgroundType` | **Virtual Try-On** (Try-On Fashn.ai `edit`) |

**No route.ts** (linha 201):
```ts
const result = await generateWithModelBank(
  productUrl,
  bankModel.image_url,
  backgroundType as any,  // ← aqui
);
```

O Fashn.ai usa no step de `edit` para aplicar o fundo. No Nano Banana, o background é controlado via prompt.

**NÃO afeta o pipeline de texto** — apenas a imagem gerada.

**Status**: ✅ **Conectado e funcional**

---

## Campos "escondidos" (Opções Avançadas)

Existem campos que estão no dropdown "Opções avançadas" mas são passados para a pipeline:

| Campo | FormData | Onde entra |
|-------|----------|------------|
| Nome da loja | `storeName` | Copywriter (linha 221: `LOJA: ${params.loja}`) |
| Público-alvo | `targetAudience` | Strategy (linha 135: `PÚBLICO-ALVO: ...`) |
| Tom de voz | `toneOverride` | Strategy (linha 136: `TOM DE VOZ: ...`) |

---

## Resumo Visual

```
┌─────────────────┐
│ 1. Foto         │──→ Vision (Gemini Flash) ──→ analisa produto
│ 6. Tipo produto │──→ Vision (hint de categoria)
│ 7. Material     │──→ Vision (hint de tecido)
└─────────────────┘
         ↓ (output: atributos visuais)
┌─────────────────┐
│ 2. Objetivo     │──→ Strategy (Gemini Pro) ──→ define ângulo
│ 8. Preço        │──→ Strategy (faixa de preço)
│ 4. Body type    │──→ Strategy (contexto plus size)
│    Público-alvo │──→ Strategy (opcional)
│    Tom de voz   │──→ Strategy (override)
└─────────────────┘
         ↓ (output: estratégia)
┌─────────────────┐
│ 8. Preço        │──→ Copywriter (Claude Sonnet) ──→ textos
│ 4. Body type    │──→ Copywriter (regras plus size)
│    Nome loja    │──→ Copywriter (personalização)
└─────────────────┘
         ↓ (output: textos)
┌─────────────────┐
│ (nenhum campo)  │──→ Refiner ∥ Scorer (Gemini Flash × 2)
└─────────────────┘
         ↓
┌─────────────────┐
│ 3. Toggle       │──→ Virtual Try-On (se ativo)
│ 4. Body type    │──→ Try-On (corpo da modelo)
│ 5. Modelo banco │──→ Try-On (seleciona modelo)
│ 9. Fundo        │──→ Try-On (background)
└─────────────────┘
```

---

## Veredicto: Prompt Quality

| Step | Prompt | Qualidade | Observações |
|------|--------|-----------|-------------|
| Vision | `buildVisionPrompt()` | ⭐⭐⭐⭐⭐ | Excelente — anti-manequim, detecta cor real do tecido, aceita hints |
| Strategy | `buildStrategyPrompt()` | ⭐⭐⭐⭐⭐ | Forte — faixa de preço auto-detectada, plus size context, urgência |
| Copywriter | `buildCopywriterPrompt()` | ⭐⭐⭐⭐⭐ | O melhor — regras anti-clichê, compliance Meta Ads, tom brasileiro real |
| Refiner | `buildRefinerPrompt()` | ⭐⭐⭐⭐ | Bom — checklist de 12 pontos, mas poderia ter exemplos before/after |
| Scorer | `buildScorerPrompt()` | ⭐⭐⭐⭐ | Bom — pesos claros, alertas Meta Ads, mas falta benchmark |

**Geral**: Os prompts estão **bem aperfeiçoados** para o nicho de moda brasileira. Foram refinados após testes reais (v2.1). Quando quiser dissecar cada um, é só falar.
