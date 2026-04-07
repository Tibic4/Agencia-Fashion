# Pipeline de IA — Resumo Técnico

> Arquitetura: Gemini + Claude + QA Visual Agent (Gemini-only, sem Fashn.ai)

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

Chamada ultra-rápida ao Gemini Flash (~200ms, ~R$ 0,002) que roda **ANTES** do try-on para extrair dados técnicos do produto e instruir o Gemini VTO com precisão.

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

### Provider Único: Gemini 3.1 Flash Image Preview (Nano Banana 2)

| Modelo | O que faz |
|--------|-----------|
| `gemini-3.1-flash-image-preview` | Gera foto de modelo vestindo a peça em um só passo, com VTO data injetado no prompt |

### QA Visual Agent 🔍 (NOVO)

Após a 1ª geração VTO, um agente de QA compara a imagem gerada com o produto original:

```
[1ª Geração VTO] → Imagem gerada
        ↓
[QA Visual Agent] → Gemini 2.5 Flash (texto + visão)
  Analisa: cor, textura, detalhes, caimento, elementos ausentes
        ↓
  ┌─ ✅ Aprovado → retorna imagem (maioria dos casos)
  └─ ❌ Reprovado (problemas graves) → 2ª geração com prompt de correção
        ↓
  [2ª Geração VTO] → Imagem corrigida com instruções específicas
```

**Categorias de verificação:**

| Categoria | Severidade | Ação |
|-----------|-----------|------|
| Cor ligeiramente diferente | minor | ✅ Aprova com nota |
| Cor totalmente errada | major | ❌ Reprova + corrige |
| Textura incorreta (ex: tricô→liso) | major | ❌ Reprova + corrige |
| Detalhes faltando (botões, estampa) | major | ❌ Reprova + corrige |
| Caimento estranho | minor | ✅ Aprova |

**Fail-open:** Se QA falhar → aceita 1ª imagem. Se 2ª geração falhar → usa 1ª como fallback.

### Fluxo com Vision Bridge

```
[Foto principal + Close-up + 2ª peça]
         ↓
[Mini-Vision 🔍] → { fabricDescriptor, garmentStructure, colorHex, criticalDetails }
         ↓
[Nano Banana 2] → Gemini 3.1 Flash Image (com VTO data no prompt)
         ↓
[QA Visual Agent 🔍] → Gemini 2.5 Flash (verificação de fidelidade)
         ↓
┌─ ✅ OK → resultado final
└─ ❌ Problemas → [Nano Banana 2 retry] → resultado corrigido
```

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
1. Modelo do banco (modelBankId) → Gemini VTO + QA
2. Modelo ativa da loja → Gemini VTO + QA
3. Sem modelo → sem try-on, usa foto original
```

---

## Fluxo Completo

```
Foto(s) + Preço + Material + Tipo
        ↓
[Mini-Vision 🔍] → extrai VTO data (3 fotos + material hint)
        ↓
[Try-On] → Gemini 3.1 Flash Image (com VTO data)
        ↓
[QA Visual 🔍] → verifica fidelidade (cor, textura, detalhes)
  └─ reprovado? → 2ª geração com correções
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

> **Nota:** Try-On + QA rodam em PARALELO com o pipeline de texto (Steps 1-5).

---

## APIs Necessárias

| API | Key | Usado para |
|-----|-----|------------|
| Google Gemini | `GOOGLE_AI_API_KEY` | Vision, Strategy, Refiner, Scorer, Mini-Vision VTO, Nano Banana, QA Visual Agent |
| Anthropic Claude | `ANTHROPIC_API_KEY` | Copywriter |

## Custos por Campanha

| Item | Custo (QA aprova) | Custo (QA reprova) |
|------|:-:|:-:|
| Mini-Vision VTO | R$ 0,002 | R$ 0,002 |
| Pipeline texto (5 steps) | R$ 0,24 | R$ 0,24 |
| Gemini VTO (1ª geração) | R$ 0,04 | R$ 0,04 |
| QA Visual Agent | R$ 0,01 | R$ 0,01 |
| 2ª geração VTO | — | R$ 0,04 |
| **Total típico** | **~R$ 0,29** | **~R$ 0,33** |

## Arquivos no Código

| Arquivo | Papel |
|---------|-------|
| `src/lib/ai/pipeline.ts` | Orquestrador do pipeline de texto |
| `src/lib/ai/providers/` | Abstração Gemini/Claude |
| `src/lib/ai/prompts.ts` | System prompts (inclui campos VTO) |
| `src/lib/ai/config.ts` | Tipos de produto + materiais |
| `src/lib/schemas.ts` | Schemas Zod (inclui 4 campos VTO opcionais) |
| `src/lib/google/nano-banana.ts` | Nano Banana client + QA Visual Agent |
| `src/app/api/campaign/generate/route.ts` | API endpoint + Mini-Vision + orquestração try-on |

## Debug

O response da API inclui `tryOnDebug` quando o try-on falha, mostrando a razão do erro sem precisar de logs do servidor.

### Logs do QA Visual Agent
```
[NanoBanana] 🔍 Iniciando QA Visual Agent...
[QA-Agent] 🔍 Analisando fidelidade do VTO...
[QA-Agent] ⏱️ Análise em 2345ms
[QA-Agent] ✅ Aprovado (1 issues menores)    ← normal
[QA-Agent] ❌ Reprovado — 2 problema(s) grave(s):
  └─ color: garment color shifted from pink to salmon
  └─ texture: knit texture simplified to smooth
[NanoBanana] 🔄 QA reprovado — gerando 2ª tentativa com correções...
[NanoBanana] ✅ 2ª geração OK (12450ms, total 28900ms)
```
