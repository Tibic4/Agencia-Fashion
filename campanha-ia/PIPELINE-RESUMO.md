# Pipeline de IA — Resumo Técnico

> Arquitetura Híbrida: Gemini + Claude + Fashn.ai

---

## Etapas do Pipeline de Texto

| # | Etapa | Modelo | O que faz |
|---|-------|--------|-----------|
| 1 | **Vision** | Gemini 2.5 Flash | Analisa a foto: identifica cor, tecido, estilo, segmento, mood |
| 2 | **Strategy** | Gemini 2.5 Pro | Cria estratégia de marketing: público, tom, gatilhos, CTAs por plataforma |
| 3 | **Copywriter** | Claude Sonnet 4 | Escreve textos: headlines, Instagram, WhatsApp, Meta Ads, hashtags |
| 4 | **Refiner** | Gemini 2.5 Flash | Revisa e corrige inconsistências nos textos (roda em paralelo com Scorer) |
| 5 | **Scorer** | Gemini 2.5 Flash | Avalia qualidade da campanha (0-100) com notas por dimensão |

> Se o score < 40, o Copywriter + Refiner rodam novamente automaticamente.

---

## Virtual Try-On (Imagem)

### Opção A: Fashn.ai

| Etapa | Endpoint | O que faz |
|-------|----------|-----------|
| Gerar modelo | `product-to-model` | Cria modelo vestindo a peça a partir da foto flat-lay |
| Try-On | `tryon-max` | Veste a peça numa modelo do banco de modelos |
| Editar | `edit` | Alisa roupa + aplica fundo profissional |
| Recorte | `background-remove` | Remove fundo, gera PNG transparente |

### Opção B: Nano Banana 2

| Modelo | O que faz |
|--------|-----------|
| `gemini-3.1-flash-image-preview` | Gera foto de modelo vestindo a peça em um só passo (single-shot) |

---

## Fluxo Resumido

```
Foto + Preço
    ↓
[1] Vision (Gemini Flash) → analisa produto
    ↓
[2] Strategy (Gemini Pro) → define estratégia
    ↓
[3] Copywriter (Claude Sonnet) → escreve textos
    ↓
[4] Refiner ∥ [5] Scorer (Gemini Flash × 2, paralelo)
    ↓
Score < 40? → re-executa Copy + Refine
    ↓
📦 Campanha pronta

(opcional) → Fashn.ai ou Nano Banana → Foto de modelo
```

---

## APIs Necessárias

| API | Key | Usado para |
|-----|-----|------------|
| Google Gemini | `GOOGLE_AI_API_KEY` | Vision, Strategy, Refiner, Scorer, Nano Banana |
| Anthropic Claude | `ANTHROPIC_API_KEY` | Copywriter |
| Fashn.ai | `FASHN_API_KEY` | Virtual Try-On (imagem) |

## Arquivos no Código

| Arquivo | Papel |
|---------|-------|
| `src/lib/ai/pipeline.ts` | Orquestrador do pipeline |
| `src/lib/ai/providers/` | Abstração Gemini/Claude |
| `src/lib/ai/prompts.ts` | System prompts |
| `src/lib/fashn/client.ts` | Fashn.ai client |
| `src/lib/google/nano-banana.ts` | Nano Banana client |
| `src/app/api/campaign/generate/route.ts` | API endpoint |
