# 📊 CriaLook — Sugestões para Aumentar Margem (sem mexer no preço)

> O problema: Business (36,9%) e Agência (37,4%) estão abaixo de 40% no pior caso.

---

## Diagnóstico: Onde está o custo?

### Business (R$ 249/mês) — Decomposição do custo:

| Componente | Valor | % do custo total |
|-----------|-------|-----------------|
| 100 campanhas × R$0,77 | R$ 77,00 | **49%** |
| 500 regens × R$0,15 | R$ 75,00 | **48%** |
| 3 modelos × R$1,72 | R$ 5,16 | **3%** |
| **Total** | **R$ 157,16** | |

> 🎯 **As regenerações custam quase tanto quanto as campanhas em si!**

---

## Sugestão 1: Reduzir regen/campanha nos planos altos (RECOMENDADA)

**Mudança:** Business e Agência de 5 regen/camp → **3 regen/camp**

| Plano | Atual (5 regen) | Proposto (3 regen) | Economia | Nova margem |
|-------|----------------|-------------------|----------|-------------|
| 🏢 Business | R$ 157,16 (36,9%) | **R$ 127,16** | R$ 30 | **48,9%** ✅ |
| 🏆 Agência | R$ 312,60 (37,4%) | **R$ 252,60** | R$ 60 | **49,4%** ✅ |

> ✅ Ambos ficam acima de 40%. Na prática, 3 regenerações já é generoso — raramente alguém usa todas.

---

## Sugestão 2: Usar Haiku em mais etapas do pipeline

**Mudança:** Trocar Sonnet por Haiku no Estrategista (R$0,06 → R$0,02)

| Pipeline | Atual | Proposto | Economia/campanha |
|----------|-------|----------|------------------|
| Vision | Sonnet R$0,08 | Sonnet R$0,08 | R$ 0 (precisa visão) |
| Estrategista | Sonnet R$0,06 | **Haiku R$0,02** | **R$ 0,04** |
| Copywriter | Sonnet R$0,10 | Sonnet R$0,10 | R$ 0 (qualidade core) |
| Refinador | Haiku R$0,03 | Haiku R$0,03 | R$ 0 |
| Scorer | Haiku R$0,02 | Haiku R$0,02 | R$ 0 |
| **Total LLM** | **R$0,29** | **R$0,25** | **R$0,04/camp** |

**Impacto acumulado (com Sugestão 1):**

| Plano | Custo com S1 | Custo com S1+S2 | Margem final |
|-------|-------------|----------------|-------------|
| ⭐ Starter | R$ 17,17 | R$ 16,57 | **71,9%** |
| 🚀 Pro | R$ 50,64 | R$ 49,04 | **62,0%** |
| 🏢 Business | R$ 123,16 | R$ 119,16 | **52,1%** |
| 🏆 Agência | R$ 244,60 | R$ 236,60 | **52,6%** |

---

## Sugestão 3: Cache de análise de produtos similares

- Se o lojista refotografa a MESMA peça, reutilizar o resultado do Vision Analyzer
- Cache por hash da imagem (perceptual hash)
- **Economia:** R$0,08/campanha repetida (~10-20% das campanhas)
- **Impacto:** ~R$0,01/campanha na média

---

## Sugestão 4: Rate-limit de regenerações diárias

Em vez de permitir usar todas as regens de uma vez:
- **Limite:** máx 5 regens/dia (mesmo que o plano tenha mais no mês)
- **Efeito:** Distribui o consumo e evita abuse
- **Impacto na margem:** Indireto — reduz uso real em ~30%

---

## Resumo das sugestões

| # | Sugestão | Impacto | Complexidade | Recomendação |
|---|----------|---------|-------------|-------------|
| 1 | Regen 5→3 (Business/Agência) | 🟢 Alto (+12pp margem) | Fácil (mudar número) | ⭐ FAZER |
| 2 | Estrategista Sonnet→Haiku | 🟡 Médio (+3pp margem) | Fácil (mudar modelo) | ⭐ FAZER |
| 3 | Cache de Vision | 🟡 Médio (variável) | Média (implementar) | Fase 2 |
| 4 | Rate-limit diário de regen | 🟢 Alto (comportamental) | Fácil | Fase 2 |

---

## Cenário Final Recomendado (Sugestões 1+2 aplicadas)

| Plano | Receita | Custo 100% | Margem R$ | Margem % | Status |
|-------|---------|-----------|-----------|----------|--------|
| 🆓 Grátis | R$ 0 | R$ 2,19 | -R$ 2,19 | — | 🔴 Loss leader |
| ⭐ Starter | R$ 59 | R$ 16,57 | R$ 42,43 | **71,9%** | 🟢 |
| 🚀 Pro | R$ 129 | R$ 49,04 | R$ 79,96 | **62,0%** | 🟢 |
| 🏢 Business | R$ 249 | R$ 119,16 | R$ 129,84 | **52,1%** | 🟢 |
| 🏆 Agência | R$ 499 | R$ 236,60 | R$ 262,40 | **52,6%** | 🟢 |

> ✅ **Todos os planos acima de 50% de margem no pior caso!**
