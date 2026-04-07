# 💰 CriaLook — Custos e Precificação

> **Data:** 07/04/2026 · Auditado com preços oficiais  
> **Câmbio:** R$ 5,80/USD  
> **Fontes:** [Google AI Pricing](https://ai.google.dev/pricing) · [Anthropic Pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)  
> **Taxa Mercado Pago (cartão):** 4,98%  
> **Custo base campanha (c/ QA reprovando):** R$ 1,56  
> **Custo base modelo virtual:** R$ 0,59

---

## 0. Custo Detalhado por Campanha (auditoria oficial)

### Preços oficiais dos modelos (Abril 2026)

| Modelo | Input/MTok | Output/MTok | Fonte |
|--------|:----------:|:-----------:|:-----:|
| Gemini 2.5 Flash | $0.30 | $2.50 | [Google](https://ai.google.dev/pricing) |
| Gemini 2.5 Pro (≤200k) | $1.25 | $10.00 | [Google](https://ai.google.dev/pricing) |
| Gemini 3.1 Flash Image (texto) | $0.50 | $3.00 | [Google](https://ai.google.dev/pricing) |
| Gemini 3.1 Flash Image (img 2K) | — | **$0.101/img** (1680 tok × $60/MTok) | [Google](https://ai.google.dev/pricing) |
| Claude Sonnet 4 | $3.00 | $15.00 | [Anthropic](https://docs.anthropic.com/en/docs/about-claude/pricing) |

### 9 chamadas de IA por campanha (cenário QA reprova)

| # | Step | Modelo | ~Input | ~Output | Custo USD | Custo BRL |
|---|------|--------|:------:|:-------:|:---------:|:---------:|
| 1 | Vision (foto produto) | Gemini 2.5 Flash | 1.500 | 500 | $0.00170 | R$ 0,010 |
| 2 | Strategy | Gemini 2.5 Pro | 2.000 | 800 | $0.01050 | R$ 0,061 |
| 3 | Copywriter | Claude Sonnet 4 | 3.000 | 2.000 | $0.03900 | R$ 0,226 |
| 4 | Refiner | Gemini 2.5 Flash | 3.000 | 1.500 | $0.00465 | R$ 0,027 |
| 5 | Scorer | Gemini 2.5 Flash | 2.500 | 500 | $0.00200 | R$ 0,012 |
| 6 | Mini-Vision VTO | Gemini 2.5 Flash | 1.200 | 400 | $0.00136 | R$ 0,008 |
| 7 | VTO 1ª geração (img 2K) | Gemini 3.1 Flash Image | 2.000 | 1 img | $0.10200 | R$ 0,592 |
| 8 | QA Visual Agent (CoT) | Gemini 2.5 Flash | 2.500 | 600 | $0.00225 | R$ 0,013 |
| 9 | VTO 2ª geração (QA reprovou) | Gemini 3.1 Flash Image | 2.500 | 1 img | $0.10325 | R$ 0,599 |
| | **TOTAL** | | | | **$0.2667** | **R$ 1,548** |
| | **TOTAL (arredondado)** | | | | | **R$ 1,56** |

> ⚠️ O VTO (imagem 2K) é o componente mais caro: $0.101/imagem cada.
> Custo sem retry QA (QA aprova): R$ 0,95. Média ponderada (~20% retry): R$ 1,07.
> Usamos o cenário conservador (QA reprova) para precificar.

### Modelo virtual (1x por modelo criada)

| Step | Modelo | Custo |
|------|--------|:-----:|
| Preview (img 2K, com ou sem foto facial) | Gemini 3.1 Flash Image | **R$ 0,59** |

---

## 1. Planos Mensais

| Recurso | 🎯 Trial | ⭐ Essencial | 🚀 Pro | 🏆 Agência |
|---|:---:|:---:|:---:|:---:|
| **Tipo** | Pack único | Mensal | Mensal | Mensal |
| **Preço** | **R$ 14,90** | **R$ 59/mês** | **R$ 149/mês** | **R$ 379/mês** |
| Campanhas | 3 | 20 | 55 | 160 |
| Modelos virtuais | 0 | 1 | 3 | 8 |
| Try-On (VTO) | ✓ | ✓ | ✓ | ✓ |
| Canais (IG, WPP, Meta Ads) | ✓ | ✓ | ✓ | ✓ |
| Score completo | ✗ | ✓ | ✓ | ✓ |
| Histórico | 7 dias | 90 dias | 365 dias | Ilimitado |
| White-label | ✗ | ✗ | ✗ | ✓ |
| API pública | ✗ | ✗ | ✗ | ✓ |
| Suporte | — | Email | Prioritário | Dedicado |

### Preço por campanha (dentro do plano)

| Plano | Preço total | Campanhas | **R$/campanha** |
|-------|:----------:|:---------:|:---------------:|
| 🎯 Trial | R$ 14,90 | 3 | **R$ 4,97** |
| ⭐ Essencial | R$ 59 | 20 | **R$ 2,95** |
| 🚀 Pro | R$ 149 | 55 | **R$ 2,71** |
| 🏆 Agência | R$ 379 | 160 | **R$ 2,37** |

---

## 2. Margens — Pior caso (100% de uso, QA reprova todas)

| Plano | Receita | Taxa MP | Custo API | **Margem R$** | **Margem %** |
|-------|:-------:|:-------:|:---------:|:-------------:|:------------:|
| 🎯 Trial | R$ 14,90 | -R$ 0,74 | -R$ 4,68 | **R$ 9,48** | **64%** |
| ⭐ Essencial | R$ 59 | -R$ 2,94 | -R$ 31,79 | **R$ 24,27** | **41%** |
| 🚀 Pro | R$ 149 | -R$ 7,42 | -R$ 87,57 | **R$ 54,01** | **36%** |
| 🏆 Agência | R$ 379 | -R$ 18,87 | -R$ 254,32 | **R$ 105,81** | **28%** |

```
Custos API (QA reprova tudo, pior caso absoluto):
  Trial:     3 camp × R$ 1,56                     = R$   4,68
  Essencial: 20 camp × R$ 1,56 + 1 mod × R$ 0,59 = R$  31,79
  Pro:       55 camp × R$ 1,56 + 3 mod × R$ 0,59 = R$  87,57
  Agência:  160 camp × R$ 1,56 + 8 mod × R$ 0,59 = R$ 254,32
```

## 3. Margens — Cenário realista (60% uso, ~20% QA reprova → custo médio R$ 1,07)

| Plano | Receita | Taxa MP | Custo API | **Margem R$** | **Margem %** |
|-------|:-------:|:-------:|:---------:|:-------------:|:------------:|
| 🎯 Trial | R$ 14,90 | -R$ 0,74 | -R$ 1,93 | **R$ 12,23** | **82%** |
| ⭐ Essencial | R$ 59 | -R$ 2,94 | -R$ 13,19 | **R$ 42,87** | **73%** |
| 🚀 Pro | R$ 149 | -R$ 7,42 | -R$ 36,38 | **R$ 105,20** | **71%** |
| 🏆 Agência | R$ 379 | -R$ 18,87 | -R$ 107,47 | **R$ 252,66** | **67%** |

```
Custos API (60% uso, custo médio R$ 1,07/camp):
  Trial:     1,8 camp × R$ 1,07                     = R$   1,93
  Essencial: 12 camp × R$ 1,07 + 0,6 mod × R$ 0,59 = R$  13,19
  Pro:       33 camp × R$ 1,07 + 1,8 mod × R$ 0,59 = R$  36,38
  Agência:   96 camp × R$ 1,07 + 4,8 mod × R$ 0,59 = R$ 107,47
```

---

## 4. Campanhas Avulso

> Sempre mais caro que nos planos (R$ 2,95/camp no Essencial)

| Pack | Preço | R$/campanha | Custo API | **Margem** |
|------|:-----:|:-----------:|:---------:|:----------:|
| 1 campanha | **R$ 8,90** | R$ 8,90 | R$ 1,56 | **82%** |
| 5 campanhas | **R$ 34,90** | R$ 6,98 | R$ 7,80 | **78%** |
| 10 campanhas | **R$ 59,90** | R$ 5,99 | R$ 15,60 | **74%** |

---

## 5. Modelos Avulso

> Sempre mais caro que nos planos

| Pack | Preço | R$/modelo | Custo API | **Margem** |
|------|:-----:|:---------:|:---------:|:----------:|
| 1 modelo | **R$ 9,90** | R$ 9,90 | R$ 0,59 | **94%** |
| 3 modelos | **R$ 19,90** | R$ 6,63 | R$ 1,77 | **91%** |

---

## 6. Escala de Preço por Campanha

```
Plano Agência    R$ 2,37/camp  ← mais barato (incentiva plano maior)
Plano Pro        R$ 2,71/camp
Plano Essencial  R$ 2,95/camp
──────────────────────────────
Trial            R$ 4,97/camp  ← intermediário
──────────────────────────────
Avulso 10x       R$ 5,99/camp
Avulso 5x        R$ 6,98/camp
Avulso 1x        R$ 8,90/camp  ← mais caro (incentiva plano)
```
