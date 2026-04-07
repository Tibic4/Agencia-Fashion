# 💰 CriaLook — Custos e Precificação

> **Data:** 07/04/2026 · Auditado com preços oficiais  
> **Câmbio:** R$ 5,80/USD  
> **Fontes:** [Google AI Pricing](https://ai.google.dev/pricing) · [Anthropic Pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)  
> **Taxa Mercado Pago (cartão):** 4,98%  
> **Custo base campanha (c/ retry QA):** R$ 1,20  
> **Custo base modelo virtual:** R$ 0,50

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
| 🎯 Trial | R$ 14,90 | -R$ 0,74 | -R$ 3,60 | **R$ 10,56** | **71%** |
| ⭐ Essencial | R$ 59 | -R$ 2,94 | -R$ 24,50 | **R$ 31,56** | **53%** |
| 🚀 Pro | R$ 149 | -R$ 7,42 | -R$ 67,50 | **R$ 74,08** | **50%** |
| 🏆 Agência | R$ 379 | -R$ 18,87 | -R$ 196,00 | **R$ 164,13** | **43%** |

```
Custos API:
  Trial:     3 camp × R$ 1,20                    = R$   3,60
  Essencial: 20 camp × R$ 1,20 + 1 mod × R$ 0,50 = R$  24,50
  Pro:       55 camp × R$ 1,20 + 3 mod × R$ 0,50 = R$  67,50
  Agência:  160 camp × R$ 1,20 + 8 mod × R$ 0,50 = R$ 196,00
```

## 3. Margens — Cenário realista (60% de uso)

| Plano | Receita | Taxa MP | Custo API | **Margem R$** | **Margem %** |
|-------|:-------:|:-------:|:---------:|:-------------:|:------------:|
| 🎯 Trial | R$ 14,90 | -R$ 0,74 | -R$ 2,16 | **R$ 12,00** | **81%** |
| ⭐ Essencial | R$ 59 | -R$ 2,94 | -R$ 14,70 | **R$ 41,36** | **70%** |
| 🚀 Pro | R$ 149 | -R$ 7,42 | -R$ 40,50 | **R$ 101,08** | **68%** |
| 🏆 Agência | R$ 379 | -R$ 18,87 | -R$ 117,60 | **R$ 242,53** | **64%** |

---

## 4. Campanhas Avulso

> Sempre mais caro que nos planos (R$ 2,95/camp no Essencial)

| Pack | Preço | R$/campanha | Custo API | **Margem** |
|------|:-----:|:-----------:|:---------:|:----------:|
| 1 campanha | **R$ 8,90** | R$ 8,90 | R$ 1,20 | **87%** |
| 5 campanhas | **R$ 34,90** | R$ 6,98 | R$ 6,00 | **83%** |
| 10 campanhas | **R$ 59,90** | R$ 5,99 | R$ 12,00 | **80%** |

---

## 5. Modelos Avulso

> Sempre mais caro que nos planos

| Pack | Preço | R$/modelo | Custo API | **Margem** |
|------|:-----:|:---------:|:---------:|:----------:|
| 1 modelo | **R$ 9,90** | R$ 9,90 | R$ 0,50 | **95%** |
| 3 modelos | **R$ 19,90** | R$ 6,63 | R$ 1,50 | **92%** |

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
