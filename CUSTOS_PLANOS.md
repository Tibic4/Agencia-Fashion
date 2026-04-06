# 💰 CriaLook — Custos e Precificação (VERSÃO FINAL)

> **Data:** 05/04/2026
> **Pipeline:** Claude Sonnet 4 (texto) + Fashn.ai (imagem)
> **Câmbio:** US$ 1 = R$ 5,75
> **Modelos:** Banco de 20 modelos stock (sempre usa tryon-max)
> **Modelo negócio:** Packs de créditos + Planos mensais (SEM plano grátis)

---

## 1. Pipeline Real — Custo por Campanha

### 1.1 Texto (LLM — Anthropic Claude Sonnet 4)

| Etapa | Modelo | Custo |
|-------|--------|-------|
| Vision Analyzer | claude-sonnet-4-20250514 | R$ 0,08 |
| Estrategista | claude-sonnet-4-20250514 | R$ 0,06 |
| Copywriter | claude-sonnet-4-20250514 | R$ 0,10 |
| Refinador | claude-sonnet-4-20250514 | R$ 0,05 |
| Scorer | claude-sonnet-4-20250514 | R$ 0,04 |
| **Subtotal LLM** | | **R$ 0,33** |

### 1.2 Imagem (Fashn.ai)

| Etapa | Modelo Fashn | Custo |
|-------|-------------|-------|
| Try-on (vestir peça na modelo stock) | tryon-max | R$ 0,43 |
| Edit (alisar roupa + cenário/fundo) | edit | R$ 0,10 |
| **Subtotal imagem** | | **R$ 0,53** |

### 1.3 TOTAL POR CAMPANHA

```
╔══════════════════════════════════════╗
║  CUSTO POR CAMPANHA = R$ 0,86       ║
║  (R$ 0,33 texto + R$ 0,53 imagem)   ║
╚══════════════════════════════════════╝
```

---

## 2. Custos de Operações Extras

| Operação | Etapas | Custo |
|----------|--------|-------|
| **Campanha completa** | 5 LLM + tryon-max + edit | **R$ 0,86** |
| **Campanha com auto-retry** | Acima + Copywriter extra (score < 40) | **R$ 0,96** |
| **Regeneração de copy** | Copywriter + Refiner + Scorer | **R$ 0,19** |
| **Regeneração de imagem** | tryon-max + edit | **R$ 0,53** |
| **Modelo personalizada** | Fashn model-create | **R$ 0,50** |

---

## 3. Jornada do Cliente

```
1. Landing page → "Testar na Prática"
2. Cria conta (email/Google)
3. Onboarding → configura loja
4. Tela de créditos → compra pack de entrada (R$ 9,90 = 3 campanhas)
5. Gera primeira campanha → momento WOW
6. Créditos acabam → upsell plano mensal
7. Percebe que plano é mais barato → assina Starter/Pro
```

---

## 4. Packs de Créditos (avulsos)

### 4.1 Pack de Entrada (1x por conta nova)

| Pack | Preço | Por crédito | Custo real | Margem |
|------|-------|-------------|-----------|--------|
| 🎯 **3 campanhas** | **R$ 9,90** | R$ 3,30 | R$ 2,58 | **74%** ✅ |

### 4.2 Packs Avulsos (sempre disponível)

| Pack | Preço | Por crédito | Custo real | Margem |
|------|-------|-------------|-----------|--------|
| +5 campanhas | R$ 29,90 | **R$ 5,98** | R$ 4,30 | **86%** ✅ |
| +10 campanhas | R$ 49,90 | **R$ 4,99** | R$ 8,60 | **83%** ✅ |
| +25 campanhas | R$ 99,90 | **R$ 4,00** | R$ 21,50 | **78%** ✅ |

### 4.3 Outros Avulsos

| Item | Preço | Custo real | Margem |
|------|-------|-----------|--------|
| +1 Modelo personalizada | R$ 4,90 | R$ 0,50 | **90%** ✅ |
| +3 Modelos personalizadas | R$ 12,90 | R$ 1,50 | **88%** ✅ |
| +10 Regenerações | R$ 9,90 | R$ 2,90 | **71%** ✅ |

---

## 5. Planos Mensais (melhor custo-benefício)

| Recurso | ⭐ Starter | 🚀 Pro | 🏢 Business | 🏆 Agência |
|---------|-----------|--------|------------|-----------|
| **Preço/mês** | R$ 59 | R$ 129 | R$ 249 | R$ 499 |
| **Por crédito** | **R$ 3,93** | **R$ 3,23** | **R$ 2,93** | **R$ 2,94** |
| Campanhas/mês | 15 | 40 | 85 | 170 |
| Canais/campanha | Todos (4) | Todos (4) | Todos (4) | Todos (4) |
| Modelo stock | ✅ | ✅ | ✅ | ✅ |
| Cenários | 3 | 4 (todos) | 4 | 4 + personalizado |
| Regen/campanha | 2 | 3 | 3 | 3 |
| Modelos personalizadas | 1 | 2 | 3 | 5 |
| Histórico | 90 dias | 1 ano | Ilimitado | Ilimitado |
| Score completo | ✅ | ✅ | ✅ | ✅ |
| Link prévia | ❌ | ✅ | ✅ | ✅ |
| Marca branca | ❌ | ❌ | ❌ | ✅ |
| API pública | ❌ | ❌ | ❌ | ✅ |

### 5.1 Escada de Preço — Pack vs Plano

```
MAIS CARO ────────────────────────── MAIS BARATO

Pack 5      Pack 10     Pack 25     Starter    Pro     Business
R$5,98      R$4,99      R$4,00      R$3,93    R$3,23   R$2,93
/crédito    /crédito    /crédito    /crédito  /crédito /crédito

         💡 "Quer pagar menos? Assine um plano!"
```

---

## 6. Margens por Plano — PIOR CASO (100% uso + todas as regens)

**Premissas:** 100% campanhas usadas, 100% regens usadas
**Mix regen:** 70% copy (R$0,19) + 30% imagem (R$0,53) = R$0,29/regen

### Com taxa Mercado Pago (cartão 4,98%)

| Plano | Receita | Taxa MP | Custo APIs | **Margem** | **%** |
|-------|---------|---------|-----------|-----------|------|
| ⭐ Starter | R$ 59 | R$ 2,94 | R$ 21,60 | **R$ 34,46** | **61,5%** ✅ |
| 🚀 Pro | R$ 129 | R$ 6,42 | R$ 69,20 | **R$ 53,38** | **43,5%** ⚠️ |
| 🏢 Business | R$ 249 | R$ 12,40 | R$ 147,05 | **R$ 89,55** | **37,8%** ⚠️ |
| 🏆 Agência | R$ 499 | R$ 24,85 | R$ 294,10 | **R$ 180,05** | **38,0%** ⚠️ |

### Com PIX (0,99%)

| Plano | Receita | Taxa PIX | Custo APIs | **Margem** | **%** |
|-------|---------|---------|-----------|-----------|------|
| ⭐ Starter | R$ 59 | R$ 0,58 | R$ 21,60 | **R$ 36,82** | **63,5%** ✅ |
| 🚀 Pro | R$ 129 | R$ 1,28 | R$ 69,20 | **R$ 58,52** | **46,7%** ✅ |
| 🏢 Business | R$ 249 | R$ 2,47 | R$ 147,05 | **R$ 99,48** | **40,6%** ⚠️ |
| 🏆 Agência | R$ 499 | R$ 4,94 | R$ 294,10 | **R$ 199,96** | **41,0%** ⚠️ |

---

## 7. Margens — USO REAL (60% campanhas + 20% com 1 regen)

| Plano | Receita | Custo APIs | **Margem R$** | **Margem %** |
|-------|---------|-----------|--------------|-------------|
| 🎯 Trial R$9,90 | R$ 9,90 | R$ 2,58 | **R$ 7,32** | **74%** ✅ |
| ⭐ Starter R$59 | R$ 59 | R$ 8,32 | **R$ 50,68** | **85,9%** ✅ |
| 🚀 Pro R$129 | R$ 129 | R$ 22,09 | **R$ 106,91** | **82,9%** ✅ |
| 🏢 Business R$249 | R$ 249 | R$ 46,76 | **R$ 202,24** | **81,2%** ✅ |
| 🏆 Agência R$499 | R$ 499 | R$ 93,52 | **R$ 405,48** | **81,3%** ✅ |

---

## 8. Custos Fixos de Plataforma

| Serviço | Custo atual | Limite free |
|---------|------------|-------------|
| Supabase | R$ 0 | 500MB DB, 1GB storage |
| Clerk | R$ 0 | 10.000 MAU |
| Mercado Pago | R$ 0 | Pay-as-you-go |
| Anthropic API | Pay-as-you-go | — |
| Fashn.ai API | Pay-as-you-go | — |
| VPS KingHost | Já pago | — |
| **Total fixo** | **R$ 0/mês** | |

---

## 9. Resumo Executivo

```
┌─────────────────────────────────────────────────────┐
│          MODELO DE NEGÓCIO — SEM PLANO GRÁTIS        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  💰 Custo por campanha: R$ 0,86                      │
│  🎯 Pack entrada (3 camp): R$ 9,90  → margem 74%    │
│  ⭐ Starter (15/mês): R$ 59        → margem 86%     │
│  🚀 Pro (40/mês): R$ 129           → margem 83%     │
│  🏢 Business (85/mês): R$ 249      → margem 81%     │
│  🏆 Agência (170/mês): R$ 499      → margem 81%     │
│                                                      │
│  📊 Packs avulsos custam 27-52% MAIS que planos     │
│  → Incentiva assinatura mensal                       │
│                                                      │
│  🚫 Zero custo com curiosos (sem free tier)          │
│  💡 R$ 9,90 filtra 100% dos não-compradores         │
│                                                      │
└─────────────────────────────────────────────────────┘
```
