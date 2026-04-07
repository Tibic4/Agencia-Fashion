# Pipeline de IA — Resumo Técnico

> Arquitetura Híbrida: Gemini + Claude + Fashn.ai + Vision Bridge

---

## Etapas do Pipeline de Texto

| # | Etapa | Modelo | O que faz |
|---|-------|--------|-----------|
| 1 | **Vision** | Gemini 2.5 Flash | Analisa a foto: identifica cor, tecido, estilo, segmento, mood + gera campos VTO |
| 2 | **Strategy** | Gemini 2.5 Pro | Cria estratégia de marketing: público, tom, gatilhos, CTAs por plataforma |
| 3 | **Copywriter** | Claude Sonnet 4 | Escreve textos: headlines, Instagram, WhatsApp, Meta Ads, hashtags |
| 4 | **Refiner** | Gemini 2.5 Flash | Revisa e corrige inconsistências nos textos (roda em paralelo com Scorer) |
| 5 | **Scorer** | Gemini 2.5 Flash | Avalia qualidade da campanha (0-100) com notas por dimensão |

> Se o score < 40, o Copywriter + Refiner rodam novamente automaticamente.

---

## Vision Bridge (Mini-Vision VTO)

Chamada ultra-rápida ao Gemini Flash (~200ms, ~R$ 0,002) que roda **ANTES** do try-on para extrair dados técnicos do produto e instruir o Fashn.ai e Nano Banana com precisão.

### Dados Extraídos

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| `fabricDescriptor` | Textura do tecido em inglês técnico | `"ribbed knit with visible vertical channels, matte finish"` |
| `garmentStructure` | Silhueta e estrutura da peça | `"structured shoulders, A-line silhouette from waist down"` |
| `colorHex` | Cor principal estimada em hex | `"#F5C6D0"` |
| `criticalDetails` | Detalhes que DEVEM ser preservados | `["gold buttons on front placket, 5 total"]` |

### Fontes de Dados (hierarquia de prioridade)

```
1. Material selecionado pelo lojista (ex: "Tricô") → MATERIAL_FABRIC_MAP → override autoritativo
2. Close-up da textura (2ª foto) → análise visual da IA → enriquecimento
3. Foto principal do produto → análise visual da IA → fallback
4. Tipo de produto (ex: "Saia") → PRODUCT_STRUCTURE_MAP → seed de estrutura
```

> Se o lojista selecionar material, ele tem prioridade sobre a detecção da IA. A IA enriquece mas não contradiz.

### Mapas de Material

16 materiais mapeados para descritores de tecido em inglês:

| PT | EN Descriptor |
|----|---------------|
| Viscose | `viscose/rayon fabric, soft drape, slight sheen, lightweight` |
| Algodão | `cotton fabric, matte finish, natural texture, breathable` |
| Tricô | `knit fabric with visible ribbed or cable texture, matte finish` |
| Jeans | `denim fabric, diagonal twill weave, sturdy cotton, visible texture` |
| Seda/Cetim | `silk/satin fabric, smooth glossy surface, luxurious sheen` |
| Couro | `leather or faux leather, smooth or textured surface, slight sheen` |
| Chiffon | `chiffon/mousseline, sheer semi-transparent, delicate flowing drape` |
| ... | *(+ linho, crepe, malha, moletom, poliéster, lã, nylon, suede, renda)* |

---

## Virtual Try-On (Imagem)

### Fluxo com Vision Bridge

```
[Foto principal + Close-up + 2ª peça]
         ↓
[Mini-Vision 🔍] → { fabricDescriptor, garmentStructure, colorHex, criticalDetails }
         ↓                          ↓
[Fashn.ai tryon-max]        [Nano Banana 2]
  (sem prompt custom,         (prompt enriquecido
   Fashn decide sozinho)       com VTO data)
         ↓                          ↓
[Fashn.ai edit]              resultado final
  (BACKGROUND_PROMPTS v2
   + negative prompts)
         ↓
  resultado final
```

### Opção A: Fashn.ai (prioridade)

| Etapa | Endpoint | O que faz |
|-------|----------|-----------|
| Try-On | `tryon-max` | Veste a peça numa modelo do banco (sem prompt, Fashn decide) |
| Editar | `edit` | Alisa roupa + aplica fundo profissional (BACKGROUND_PROMPTS v2) |
| Recorte | `background-remove` | Remove fundo, gera PNG transparente |

### Opção B: Nano Banana 2 (fallback)

| Modelo | O que faz |
|--------|-----------|
| `gemini-2.5-flash-preview-image-generation` | Gera foto de modelo vestindo a peça em um só passo, com VTO data injetado no prompt |

### BACKGROUND_PROMPTS v2

9 cenários profissionais com:
- **Temperatura de cor específica** (ex: 5500K branco, 4500K natureza, 6500K urbano)
- **Direção de iluminação** explícita por cenário
- **Negative prompts universais**: anti-etiqueta, anti-manequim, anti-alteração de cor/textura

| Cenário | Temp. Cor | Atmosfera |
|---------|-----------|-----------|
| Branco | 5500K | Estúdio limpo, difuso, e-commerce |
| Estúdio | gradient | Softbox direcional, elegante |
| Lifestyle | golden hour | Apartamento moderno, luz natural |
| Urbano | 6500K | Street-style, concreto, moody |
| Natureza | 4500K | Jardim tropical, golden hour |
| Interior | 5000K | Loft minimalista, abundante luz |
| Boutique | 3500K | Loja luxo, mármore, ouro |
| Gradiente | 5500K | Rose pink → peach gold, abstrato |
| Personalizado | — | Prompt livre do lojista |

---

## Prioridade de Try-On

```
1. Modelo do banco (modelBankId) → Fashn tryon-max + edit
2. Modelo ativa da loja (legado) → Fashn tryon-max
3. Nano Banana 2 (fallback sem Fashn) → Gemini imagen
4. Sem try-on → usa foto original do produto
```

---

## Fluxo Completo

```
Foto(s) + Preço + Material + Tipo
        ↓
[Mini-Vision 🔍] → extrai VTO data (3 fotos + material hint)
        ↓
[Try-On] → Fashn.ai ou Nano Banana (com VTO data)
        ↓
[1] Vision (Gemini Flash) → analisa produto + campos VTO
        ↓
[2] Strategy (Gemini Pro) → define estratégia
        ↓
[3] Copywriter (Claude Sonnet) → escreve textos
        ↓
[4] Refiner ∥ [5] Scorer (Gemini Flash × 2, paralelo)
        ↓
Score < 40? → re-executa Copy + Refine
        ↓
📦 Campanha pronta (textos + imagem try-on + score)
```

---

## APIs Necessárias

| API | Key | Usado para |
|-----|-----|------------|
| Google Gemini | `GOOGLE_AI_API_KEY` | Vision, Strategy, Refiner, Scorer, Mini-Vision VTO, Nano Banana |
| Anthropic Claude | `ANTHROPIC_API_KEY` | Copywriter |
| Fashn.ai | `FASHN_API_KEY` | Virtual Try-On (imagem) + Edit (cenário) |

## Custos por Campanha

| Item | Custo |
|------|-------|
| Mini-Vision VTO | ~R$ 0,002 |
| Pipeline texto (5 steps) | ~R$ 0,15 |
| Fashn tryon-max + edit | ~R$ 1,31 |
| **Total típico** | **~R$ 1,46** |

## Arquivos no Código

| Arquivo | Papel |
|---------|-------|
| `src/lib/ai/pipeline.ts` | Orquestrador do pipeline de texto |
| `src/lib/ai/providers/` | Abstração Gemini/Claude |
| `src/lib/ai/prompts.ts` | System prompts (inclui campos VTO) |
| `src/lib/ai/config.ts` | Tipos de produto + materiais |
| `src/lib/schemas.ts` | Schemas Zod (inclui 4 campos VTO opcionais) |
| `src/lib/fashn/client.ts` | Fashn.ai client + BACKGROUND_PROMPTS v2 + buildFashnTryOnPrompt |
| `src/lib/google/nano-banana.ts` | Nano Banana client (com VTO data injection) |
| `src/app/api/campaign/generate/route.ts` | API endpoint + Mini-Vision + orquestração try-on |

## Debug

O response da API inclui `tryOnDebug` quando o try-on falha, mostrando a razão do erro sem precisar de logs do servidor.
