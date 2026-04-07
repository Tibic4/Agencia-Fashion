# 💰 CriaLook — Custos e Precificação

> **Data:** 07/04/2026 · Auditado com preços oficiais  
> **Câmbio:** R$ 5,80/USD  
> **Fontes:** [Google AI Pricing](https://ai.google.dev/pricing) · [Anthropic Pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)  
> **Taxa Mercado Pago (cartão):** 4,98%

---

## 0. Custo Real por Operação (Auditado)

### Custo por Campanha (com modelo, resolução 1K)

| Componente | Custo R$ |
|-----------|:--------:|
| Mini-Vision VTO (Gemini Flash) | R$ 0,004 |
| Vision (Gemini Flash) | R$ 0,010 |
| Strategy (Gemini Pro) | R$ 0,061 |
| Copywriter (Claude Sonnet 4) | R$ 0,226 |
| Refiner (Gemini Flash) | R$ 0,027 |
| Scorer (Gemini Flash) | R$ 0,012 |
| QA Visual Agent (Gemini Flash) | R$ 0,007 |
| **Subtotal texto** | **R$ 0,347** |
| **VTO imagem 1K** (Nano Banana 2) | **R$ 0,39** |
| **Total (QA aprova)** | **R$ 0,74** |
| Total (QA reprova, 2ª geração) | R$ 1,13 |

> **Custo médio ponderado** (80% aprova / 20% reprova): **~R$ 0,82/campanha**

### Custo para Criar Modelo Virtual

| Resolução | Custo R$ |
|:---------:|:--------:|
| 1K (1024px) | **R$ 0,39** |
| 0.5K (512px) | R$ 0,26 |

### Custos base para cálculos

| Item | Custo arredondado |
|------|:-:|
| 1 campanha completa | **R$ 1,00** |
| 1 modelo virtual | **R$ 0,50** |

> Arredondamos para cima para cobrir variações de câmbio, retries extras e overhead de storage/infra.

---

## 1. Estrutura: 3 Planos

### Filosofia

| Plano | Público | Proposta |
|-------|---------|----------|
| **Essencial** | Lojista pequeno, 1 pessoa, começo | Testar a plataforma, volume baixo |
| **Pro** | Loja em crescimento, vende todo dia | Volume médio, todas as features |
| **Agência** | Agência/marca com múltiplas contas | Volume alto, white-label, API |

---

### Tabela de Planos

| Recurso | ⭐ Essencial | 🚀 Pro | 🏆 Agência |
|---------|:----------:|:------:|:--------:|
| **Preço** | **R$ 97/mês** | **R$ 247/mês** | **R$ 497/mês** |
| Campanhas/mês | 30 | 80 | 200 |
| Modelos virtuais | 1 | 3 | 10 |
| Try-On (VTO) | ✓ | ✓ | ✓ |
| Canais (IG, WPP, Meta Ads) | ✓ | ✓ | ✓ |
| Score completo | ✓ | ✓ | ✓ |
| Histórico | 90 dias | 365 dias | Ilimitado |
| White-label | ✗ | ✗ | ✓ |
| API pública | ✗ | ✗ | ✓ |
| Suporte | Email | Prioritário | Dedicado |

---

## 2. Análise de Margem — Pior Caso (100% de uso)

> Premissa: todas as campanhas usam VTO com modelo

| | ⭐ Essencial | 🚀 Pro | 🏆 Agência |
|---|:---:|:---:|:---:|
| **Receita** | R$ 97 | R$ 247 | R$ 497 |
| Taxa MP (4,98%) | -R$ 4,83 | -R$ 12,30 | -R$ 24,75 |
| Custo campanhas (×R$ 1,00) | -R$ 30,00 | -R$ 80,00 | -R$ 200,00 |
| Custo modelos (×R$ 0,50) | -R$ 0,50 | -R$ 1,50 | -R$ 5,00 |
| **Custo total API** | **-R$ 30,50** | **-R$ 81,50** | **-R$ 205,00** |
| **Margem R$** | **R$ 61,67** | **R$ 153,20** | **R$ 267,25** |
| **Margem %** | **63,6%** | **62,0%** | **53,8%** |

---

## 3. Análise de Margem — Cenário Realista (60% de uso)

> A maioria dos clientes não usa 100% da cota

| | ⭐ Essencial | 🚀 Pro | 🏆 Agência |
|---|:---:|:---:|:---:|
| **Receita** | R$ 97 | R$ 247 | R$ 497 |
| Taxa MP (4,98%) | -R$ 4,83 | -R$ 12,30 | -R$ 24,75 |
| Custo APIs (60%) | -R$ 18,30 | -R$ 48,90 | -R$ 123,00 |
| **Margem R$** | **R$ 73,87** | **R$ 185,80** | **R$ 349,25** |
| **Margem %** | **76,2%** | **75,2%** | **70,3%** |

---

## 4. Custo por Campanha vs Preço por Campanha

> Quanto o cliente "paga" por campanha em cada plano (se usar tudo)

| Plano | Preço/camp | Custo/camp | **Margem/camp** |
|-------|:----------:|:----------:|:---------------:|
| ⭐ Essencial (30 camp) | R$ 3,23 | R$ 1,00 | **R$ 2,23 (69%)** |
| 🚀 Pro (80 camp) | R$ 3,09 | R$ 1,00 | **R$ 2,09 (67%)** |
| 🏆 Agência (200 camp) | R$ 2,49 | R$ 1,00 | **R$ 1,49 (60%)** |

> Agência tem menor margem por campanha, mas maior volume e LTV.

---

## 5. Créditos Avulso (add-ons)

### Campanhas extras

| Pack | Preço | $/campanha | Custo | **Margem** |
|------|:-----:|:----------:|:-----:|:----------:|
| 5 campanhas | **R$ 24,99** | R$ 5,00 | R$ 5,00 | **80%** |
| 10 campanhas | **R$ 39,99** | R$ 4,00 | R$ 10,00 | **75%** |
| 25 campanhas | **R$ 84,99** | R$ 3,40 | R$ 25,00 | **71%** |

### Modelos extras

| Pack | Preço | $/modelo | Custo | **Margem** |
|------|:-----:|:--------:|:-----:|:----------:|
| 1 modelo | **R$ 4,99** | R$ 4,99 | R$ 0,50 | **90%** |
| 3 modelos | **R$ 9,99** | R$ 3,33 | R$ 1,50 | **85%** |

---

## 6. Resumo Financeiro por Cenário de Escala

> MRR considerando distribuição: 60% Essencial, 30% Pro, 10% Agência

| Clientes | MRR Estimado | Custo API (60% uso) | **Lucro bruto** |
|:--------:|:------------:|:-------------------:|:---------------:|
| 10 | R$ 1.441 | ~R$ 305 | **R$ 1.136** |
| 50 | R$ 7.205 | ~R$ 1.525 | **R$ 5.680** |
| 100 | R$ 14.410 | ~R$ 3.050 | **R$ 11.360** |
| 500 | R$ 72.050 | ~R$ 15.250 | **R$ 56.800** |

```
Cálculo MRR por cliente:
  60% × R$ 97  = R$ 58,20
  30% × R$ 247 = R$ 74,10
  10% × R$ 497 = R$ 49,70
  MRR médio/cliente = R$ 182,00

Cálculo custo médio/cliente (60% uso):
  60% × R$ 18,30  = R$ 10,98
  30% × R$ 48,90  = R$ 14,67
  10% × R$ 123,00 = R$ 12,30
  Custo médio/cliente = R$ 37,95
```

---

## 7. Break-Even e Infraestrutura

| Item fixo mensal | Estimativa |
|-----------------|:----------:|
| Supabase Pro | R$ 145 |
| Vercel Pro | R$ 116 |
| Clerk (auth) | R$ 145 |
| Domínio + DNS | R$ 10 |
| **Total infra** | **~R$ 416/mês** |

> **Break-even:** ~3 clientes pagantes cobrem a infra fixa.
> A partir do 4º cliente, tudo é lucro operacional.
