# 💰 CriaLook — Análise de Custos por Plano

> **Data:** 05/04/2026
> **Base:** Arquitetura 01_ARQUITETURA_GERAL.md + APIS_PLATAFORMAS.md
> **Cenário:** 100% de uso de TODOS os limites (pior caso absoluto)

---

## 1. Custos Unitários por Operação (fonte: arquitetura)

| Operação | APIs envolvidas | Custo |
|----------|----------------|-------|
| **1 campanha (moda, com try-on)** | Vision R$0,08 + Estrategista R$0,06 + Copywriter R$0,10 + Refinador R$0,03 + Scorer R$0,02 + Fashn try-on R$0,43 + Remoção fundo R$0,05 | **R$ 0,77** |
| **1 regeneração de copy** | Copywriter R$0,10 + Refinador R$0,03 + Scorer R$0,02 | **R$ 0,15** |
| **1 regeneração de imagem** | Fashn/DALL-E R$0,23–0,43 + composição R$0 | **R$ 0,33** |
| **1 criação de modelo virtual** | Fashn.ai Model Create (4 samples) | **R$ 1,72** |

---

## 2. Limites de Cada Plano (fonte: arquitetura seção 5.2)

| Recurso | 🆓 Grátis | ⭐ Starter | 🚀 Pro | 🏢 Business | 🏆 Agência |
|---------|-----------|-----------|--------|------------|-----------|
| **Preço/mês** | R$ 0 | R$ 59 | R$ 129 | R$ 249 | R$ 499 |
| Campanhas/mês | 3 | 15 | 40 | 100 | 200 |
| Canais/campanha | 2 (Feed+WhatsApp) | 4 (todos) | 4 | 4 | 4 |
| Modelos virtuais | 0 | 1 | 2 | 3 | 5 |
| Criações modelo/mês | 0 | 1 | 2 | 3 | 5 |
| Regen/campanha | 0 | 2 | 3 | 5 | 5 |
| Histórico | 7 dias | 90 dias | 1 ano | Ilimitado | Ilimitado |
| Score completo | ❌ (nota geral) | ✅ | ✅ | ✅ | ✅ |
| Link prévia | ❌ | ❌ | ✅ | ✅ | ✅ |
| Marca branca | ❌ | ❌ | ❌ | ❌ | ✅ |
| API pública | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Cálculo PIOR CASO (100% de uso + TODAS regens)

**Fórmula:**
```
Custo Total = (campanhas × R$0,77) + (campanhas × regen_por_camp × R$0,15) + (criações_modelo × R$1,72)
```

### 🆓 Plano Grátis (R$ 0/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas | 3 | R$ 0,77 | R$ 2,31 |
| Regenerações | 3 × 0 = 0 | R$ 0,15 | R$ 0,00 |
| Criação de modelo | 0 | R$ 1,72 | R$ 0,00 |
| **Custo Total** | | | **R$ 2,31** |
| **Receita** | | | **R$ 0,00** |
| **Margem** | | | **-R$ 2,31** |
| **Margem %** | | | **∞ negativa (loss leader)** |

---

### ⭐ Plano Starter (R$ 59/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas | 15 | R$ 0,77 | R$ 11,55 |
| Regenerações | 15 × 2 = 30 | R$ 0,15 | R$ 4,50 |
| Criação de modelo | 1 | R$ 1,72 | R$ 1,72 |
| **Custo Total** | | | **R$ 17,77** |
| **Receita** | | | **R$ 59,00** |
| **Margem** | | | **R$ 41,23** |
| **Margem %** | | | **69,9%** ✅ |

**Custo por campanha efetivo:** R$ 17,77 ÷ 15 = **R$ 1,18/campanha**
**Preço por campanha que o cliente paga:** R$ 59 ÷ 15 = **R$ 3,93/campanha**

---

### 🚀 Plano Pro (R$ 129/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas | 40 | R$ 0,77 | R$ 30,80 |
| Regenerações | 40 × 3 = 120 | R$ 0,15 | R$ 18,00 |
| Criação de modelo | 2 | R$ 1,72 | R$ 3,44 |
| **Custo Total** | | | **R$ 52,24** |
| **Receita** | | | **R$ 129,00** |
| **Margem** | | | **R$ 76,76** |
| **Margem %** | | | **59,5%** ✅ |

**Custo por campanha efetivo:** R$ 52,24 ÷ 40 = **R$ 1,31/campanha**
**Preço por campanha que o cliente paga:** R$ 129 ÷ 40 = **R$ 3,23/campanha**

---

### 🏢 Plano Business (R$ 249/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas | 100 | R$ 0,77 | R$ 77,00 |
| Regenerações | 100 × 5 = 500 | R$ 0,15 | R$ 75,00 |
| Criação de modelo | 3 | R$ 1,72 | R$ 5,16 |
| **Custo Total** | | | **R$ 157,16** |
| **Receita** | | | **R$ 249,00** |
| **Margem** | | | **R$ 91,84** |
| **Margem %** | | | **36,9%** ⚠️ |

**Custo por campanha efetivo:** R$ 157,16 ÷ 100 = **R$ 1,57/campanha**
**Preço por campanha que o cliente paga:** R$ 249 ÷ 100 = **R$ 2,49/campanha**

> ⚠️ No pior caso absoluto (todas as 500 regenerações usadas), a margem cai abaixo de 40%.

---

### 🏆 Plano Agência (R$ 499/mês)

| Item | Qtd | Unitário | Subtotal |
|------|-----|----------|----------|
| Campanhas | 200 | R$ 0,77 | R$ 154,00 |
| Regenerações | 200 × 5 = 1000 | R$ 0,15 | R$ 150,00 |
| Criação de modelo | 5 | R$ 1,72 | R$ 8,60 |
| **Custo Total** | | | **R$ 312,60** |
| **Receita** | | | **R$ 499,00** |
| **Margem** | | | **R$ 186,40** |
| **Margem %** | | | **37,4%** ⚠️ |

**Custo por campanha efetivo:** R$ 312,60 ÷ 200 = **R$ 1,56/campanha**
**Preço por campanha que o cliente paga:** R$ 499 ÷ 200 = **R$ 2,50/campanha**

---

## 4. Resumo Comparativo (100% uso)

| Plano | Receita | Custo 100% | Margem R$ | Margem % | Status |
|-------|---------|-----------|-----------|----------|--------|
| 🆓 Grátis | R$ 0 | R$ 2,31 | -R$ 2,31 | — | 🔴 Loss leader |
| ⭐ Starter | R$ 59 | R$ 17,77 | R$ 41,23 | 69,9% | 🟢 Saudável |
| 🚀 Pro | R$ 129 | R$ 52,24 | R$ 76,76 | 59,5% | 🟢 Saudável |
| 🏢 Business | R$ 249 | R$ 157,16 | R$ 91,84 | 36,9% | 🟡 Apertado |
| 🏆 Agência | R$ 499 | R$ 312,60 | R$ 186,40 | 37,4% | 🟡 Apertado |

---

## 5. Divergências Encontradas: Código vs Arquitetura

| Item | Arquitetura | Código (`plano/page.tsx`) | Código (`mercadopago.ts`) |
|------|-------------|--------------------------|--------------------------|
| Starter preço | R$ 59 | ~~R$ 49,90~~ | R$ 59 |
| Pro preço | R$ 129 | ~~R$ 97~~ | R$ 129 |
| Business preço | R$ 249 | — (não existe na UI) | R$ 249 |
| Agência preço | R$ 499 | — (não existe na UI) | R$ 499 |
| Planos na UI | 5 planos | 3 planos (Starter, Pro, Scale) | 4 planos |
| "Scale" | Não existe | R$ 197 (200 camp) | — |
| Starter campanhas | 15 | 15 ✅ | 15 ✅ |
| Pro campanhas | 40 | ~~50~~ | 40 |

> **⚠️ AÇÃO NECESSÁRIA:** Os preços e nomes na página `/plano` (`page.tsx`) estão DIFERENTES da arquitetura e do `mercadopago.ts`. Precisa alinhar.

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
|-------|---------|------------------|--------------------|-----------------|--------------------|
| Starter | R$ 59 | R$ 0,58 | R$ 2,94 | R$ 58,42 | R$ 56,06 |
| Pro | R$ 129 | R$ 1,28 | R$ 6,42 | R$ 127,72 | R$ 122,58 |
| Business | R$ 249 | R$ 2,47 | R$ 12,40 | R$ 246,53 | R$ 236,60 |
| Agência | R$ 499 | R$ 4,94 | R$ 24,85 | R$ 494,06 | R$ 474,15 |

---

## 8. Margem Real (100% uso + taxa MP cartão = pior cenário)

| Plano | Receita líq. | Custo APIs | **Margem Final** | **Margem %** |
|-------|-------------|-----------|-----------------|-------------|
| ⭐ Starter | R$ 56,06 | R$ 17,77 | **R$ 38,29** | **68,3%** ✅ |
| 🚀 Pro | R$ 122,58 | R$ 52,24 | **R$ 70,34** | **57,4%** ✅ |
| 🏢 Business | R$ 236,60 | R$ 157,16 | **R$ 79,44** | **33,6%** ⚠️ |
| 🏆 Agência | R$ 474,15 | R$ 312,60 | **R$ 161,55** | **34,1%** ⚠️ |
