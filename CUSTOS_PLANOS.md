# 💰 CriaLook — Análise de Custos por Plano (v2 — A+ com Modelo+Fundo)

> **Data:** 05/04/2026
> **Base:** Arquitetura 01_ARQUITETURA_GERAL.md + APIS_PLATAFORMAS.md
> **Cenário:** 100% de uso de TODOS os limites (pior caso absoluto)
> **Modelo:** A+ (product-to-model + edit para alisar roupa e fundo profissional)

---

## 1. Custos Unitários por Operação (modo A+)

| Operação | APIs envolvidas | Custo |
|----------|----------------|-------|
| **1 campanha A+ (texto + modelo + fundo)** | Vision R$0,08 + Estrategista R$0,06 + Copywriter R$0,10 + Refinador R$0,03 + Scorer R$0,02 + Fashn product-to-model R$0,15 + Fashn edit R$0,10 + Remoção fundo R$0,04 | **R$ 0,58** |
| **1 regeneração de copy** | Copywriter R$0,10 + Refinador R$0,03 + Scorer R$0,02 | **R$ 0,15** |
| **1 regeneração de imagem** | Fashn product-to-model R$0,15 + edit R$0,10 | **R$ 0,25** |
| **1 criação de modelo virtual** | Fashn.ai Model Create (4 samples) | **R$ 1,72** |

---

## 2. Limites de Cada Plano (v2 — margem ≥ 40%)

| Recurso | 🆓 Grátis | ⭐ Starter | 🚀 Pro | 🏢 Business | 🏆 Agência |
|---------|-----------|-----------|--------|------------|-----------|
| **Preço/mês** | R$ 0 | R$ 59 | R$ 129 | R$ 249 | R$ 499 |
| Campanhas/mês | 3 | 15 | 40 | **85** | **170** |
| Canais/campanha | 2 (Feed+WhatsApp) | 4 (todos) | 4 | 4 | 4 |
| Modelo + fundo profissional | ❌ | ✅ | ✅ | ✅ | ✅ |
| Modelos virtuais | 0 | 1 | 2 | 3 | 5 |
| Criações modelo/mês | 0 | 1 | 2 | 3 | 5 |
| Regen/campanha | 0 | 2 | 3 | 3 | 3 |
| Histórico | 7 dias | 90 dias | 1 ano | Ilimitado | Ilimitado |
| Score completo | ❌ (nota geral) | ✅ | ✅ | ✅ | ✅ |
| Link prévia | ❌ | ❌ | ✅ | ✅ | ✅ |
| Marca branca | ❌ | ❌ | ❌ | ❌ | ✅ |
| API pública | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Cálculo PIOR CASO (100% de uso + TODAS regens)

**Fórmula:**
```
Custo Total = (campanhas × R$0,58) + (campanhas × regen_por_camp × R$0,15) + (criações_modelo × R$1,72)
```

### 🆓 Plano Grátis (R$ 0/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas | 3 | R$ 0,58 | R$ 1,74 |
| Regenerações | 3 × 0 = 0 | R$ 0,15 | R$ 0,00 |
| Criação de modelo | 0 | R$ 1,72 | R$ 0,00 |
| **Custo Total** | | | **R$ 1,74** |
| **Receita** | | | **R$ 0,00** |
| **Margem** | | | **-R$ 1,74** |
| **Margem %** | | | **∞ negativa (loss leader)** |

---

### ⭐ Plano Starter (R$ 59/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas A+ | 15 | R$ 0,58 | R$ 8,70 |
| Regenerações | 15 × 2 = 30 | R$ 0,15 | R$ 4,50 |
| Criação de modelo | 1 | R$ 1,72 | R$ 1,72 |
| **Custo Total** | | | **R$ 14,92** |
| **Receita** | | | **R$ 59,00** |
| **Margem** | | | **R$ 44,08** |
| **Margem %** | | | **74,7%** ✅ |

**Custo por campanha efetivo:** R$ 14,92 ÷ 15 = **R$ 0,99/campanha**
**Preço por campanha que o cliente paga:** R$ 59 ÷ 15 = **R$ 3,93/campanha**

---

### 🚀 Plano Pro (R$ 129/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas A+ | 40 | R$ 0,58 | R$ 23,20 |
| Regenerações | 40 × 3 = 120 | R$ 0,15 | R$ 18,00 |
| Criação de modelo | 2 | R$ 1,72 | R$ 3,44 |
| **Custo Total** | | | **R$ 44,64** |
| **Receita** | | | **R$ 129,00** |
| **Margem** | | | **R$ 84,36** |
| **Margem %** | | | **65,4%** ✅ |

**Custo por campanha efetivo:** R$ 44,64 ÷ 40 = **R$ 1,12/campanha**
**Preço por campanha que o cliente paga:** R$ 129 ÷ 40 = **R$ 3,23/campanha**

---

### 🏢 Plano Business (R$ 249/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas A+ | 85 | R$ 0,58 | R$ 49,30 |
| Regenerações | 85 × 3 = 255 | R$ 0,15 | R$ 38,25 |
| Criação de modelo | 3 | R$ 1,72 | R$ 5,16 |
| **Custo Total** | | | **R$ 92,71** |
| **Receita** | | | **R$ 249,00** |
| **Margem** | | | **R$ 156,29** |
| **Margem %** | | | **62,8%** ✅ |

**Custo por campanha efetivo:** R$ 92,71 ÷ 85 = **R$ 1,09/campanha**
**Preço por campanha que o cliente paga:** R$ 249 ÷ 85 = **R$ 2,93/campanha**

---

### 🏆 Plano Agência (R$ 499/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas A+ | 170 | R$ 0,58 | R$ 98,60 |
| Regenerações | 170 × 3 = 510 | R$ 0,15 | R$ 76,50 |
| Criação de modelo | 5 | R$ 1,72 | R$ 8,60 |
| **Custo Total** | | | **R$ 183,70** |
| **Receita** | | | **R$ 499,00** |
| **Margem** | | | **R$ 315,30** |
| **Margem %** | | | **63,2%** ✅ |

**Custo por campanha efetivo:** R$ 183,70 ÷ 170 = **R$ 1,08/campanha**
**Preço por campanha que o cliente paga:** R$ 499 ÷ 170 = **R$ 2,94/campanha**

---

## 4. Resumo Comparativo (100% uso)

| Plano | Receita | Custo 100% | Margem R$ | Margem % | Status |
|-------|---------|-----------|-----------|----------|--------|
| 🆓 Grátis | R$ 0 | R$ 1,74 | -R$ 1,74 | — | 🔴 Loss leader |
| ⭐ Starter | R$ 59 | R$ 14,92 | R$ 44,08 | 74,7% | 🟢 Excelente |
| 🚀 Pro | R$ 129 | R$ 44,64 | R$ 84,36 | 65,4% | 🟢 Excelente |
| 🏢 Business | R$ 249 | R$ 92,71 | R$ 156,29 | 62,8% | 🟢 Excelente |
| 🏆 Agência | R$ 499 | R$ 183,70 | R$ 315,30 | 63,2% | 🟢 Excelente |

---

## 5. O que mudou vs v1

| Item | v1 (antes) | v2 A+ (agora) | Motivo |
|------|-----------|--------------|--------|
| Custo/campanha | R$ 0,77 (try-on) | **R$ 0,58** (product-to-model+edit) | product-to-model é mais barato |
| Business campanhas | 100 | **85** | Garantir margem ≥ 40% |
| Agência campanhas | 200 | **170** | Garantir margem ≥ 40% |
| Business/Agência regen | 5/campanha | **3/campanha** | Alinhamento de custo |
| Modelo+fundo | Não incluído | **Incluído em todos os pagos** | Diferencial competitivo |

---

## 6. Custos de Plataforma (fixos mensais)

| Serviço | Plano Free | Limite | Custo Pro |
|---------|-----------|-------|-----------|
| Supabase | R$ 0 | 500MB DB, 1GB storage | R$ 130/mês |
| Clerk | R$ 0 | 10.000 MAU | R$ 0,02/MAU extra |
| Mercado Pago | R$ 0 | Pay-as-you-go | PIX 0,99% / Cartão 4,98% |
| Sentry | R$ 0 | 5K eventos/mês | — |
| PostHog | R$ 0 | 1M eventos/mês | — |
| VPS | Já pago | — | — |
| **Total fixo MVP** | **R$ 0/mês** | | |

---

## 7. Custo da Taxa Mercado Pago sobre a Receita

| Plano | Receita | Taxa PIX (0,99%) | Taxa Cartão (4,98%) | Receita líq. PIX | Receita líq. Cartão |
|-------|---------|------------------|--------------------|-----------------|---------------------|
| Starter | R$ 59 | R$ 0,58 | R$ 2,94 | R$ 58,42 | R$ 56,06 |
| Pro | R$ 129 | R$ 1,28 | R$ 6,42 | R$ 127,72 | R$ 122,58 |
| Business | R$ 249 | R$ 2,47 | R$ 12,40 | R$ 246,53 | R$ 236,60 |
| Agência | R$ 499 | R$ 4,94 | R$ 24,85 | R$ 494,06 | R$ 474,15 |

---

## 8. Margem Real (100% uso + taxa MP cartão = pior cenário absoluto)

| Plano | Receita líq. | Custo APIs | **Margem Final** | **Margem %** |
|-------|-------------|-----------|-----------------|-------------|
| ⭐ Starter | R$ 56,06 | R$ 14,92 | **R$ 41,14** | **73,4%** ✅ |
| 🚀 Pro | R$ 122,58 | R$ 44,64 | **R$ 77,94** | **63,6%** ✅ |
| 🏢 Business | R$ 236,60 | R$ 92,71 | **R$ 143,89** | **60,8%** ✅ |
| 🏆 Agência | R$ 474,15 | R$ 183,70 | **R$ 290,45** | **61,3%** ✅ |
