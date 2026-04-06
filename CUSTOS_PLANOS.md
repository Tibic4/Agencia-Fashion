# 💰 CriaLook — Custos e Precificação (ARQUITETURA v2.0)

> **Data:** 06/04/2026
> **Pipeline de Texto:** Híbrido Gemini 2.5 Flash/Pro + Claude Sonnet 4 (copywriter)
> **Pipeline de Imagem:** Fashn.ai (roupa) + Nano Banana/Gemini (fundo alternativo)
> **Câmbio:** US$ 1 = R$ 5,80
> **Crédito Fashn:** 1 crédito = US$ 0,075 = R$ 0,44
> **Modelo negócio:** Packs de créditos + Planos mensais (SEM plano grátis)

---

## 1. Pipeline de Texto — Custo Real por Step

### Arquitetura v2.0 (Híbrida Gemini + Claude)

| Etapa | Provider | Modelo | Input/MTok | Output/MTok | Tokens est. | Custo USD | **Custo BRL** |
|-------|----------|--------|-----------|------------|-------------|-----------|---------------|
| Vision Analyzer | Google | gemini-2.5-flash | $0.30 | $2.50 | ~1K in + 500 out | $0.0016 | **R$ 0,009** |
| Estrategista | Google | gemini-2.5-pro | $1.25 | $10.00 | ~1K in + 500 out | $0.0063 | **R$ 0,036** |
| Copywriter | Anthropic | claude-sonnet-4 | $3.00 | $15.00 | ~1.5K in + 1K out | $0.0195 | **R$ 0,113** |
| Refinador | Google | gemini-2.5-flash | $0.30 | $2.50 | ~2K in + 800 out | $0.0026 | **R$ 0,015** |
| Scorer | Google | gemini-2.5-flash | $0.30 | $2.50 | ~2K in + 500 out | $0.0019 | **R$ 0,011** |
| **Subtotal LLM v2.0** | | | | | | **$0.0319** | **R$ 0,184** |

### Comparação com arquitetura v1.0 (tudo Claude Sonnet 4)

| Pipeline | Custo/campanha | Diferença |
|----------|---------------|-----------|
| v1.0 — Claude Sonnet 4 em tudo | R$ 0,33 | — |
| **v2.0 — Gemini + Claude** | **R$ 0,18** | **-45%** ✅ |

> **Nota:** Valores v2.0 calculados com tokens reais retornados pela API. Valores v1.0 eram estimativas hardcoded.

---

## 2. Pipeline de Imagem — Cenários de Custo

### 2.1 Fashn.ai — Tabela de Créditos

| Endpoint | Créditos | Custo USD | Custo BRL | Uso |
|----------|----------|-----------|-----------|-----|
| `product-to-model` | 1 | $0.075 | R$ 0,44 | Gerar modelo vestindo peça (sem banco) |
| `tryon-max` | 4 | $0.300 | R$ 1,74 | Vestir peça em modelo do banco |
| `edit` (1k/fast) | 1 | $0.075 | R$ 0,44 | Alisar roupa + aplicar fundo |
| `edit` (2k/quality) | 3 | $0.225 | R$ 1,31 | Edit alta qualidade |
| `background-remove` | 1 | $0.075 | R$ 0,44 | Recorte PNG transparente |
| `model-create` | var. | ~$0.075+ | R$ 0,44+ | Criar modelo personalizada |

### 2.2 Nano Banana (Gemini 3.1 Flash Image) — Tabela de Preços

| Resolução | Tokens Output | Custo USD | Custo BRL | Qualidade |
|-----------|--------------|-----------|-----------|-----------|
| 0.5K (512px) | 747 | $0.045 | R$ 0,26 | Baixa (preview) |
| 1K (1024px) | 1.120 | $0.067 | R$ 0,39 | Boa (social media) |
| **2K (2048px)** | 1.680 | **$0.101** | **R$ 0,59** | **Alta (e-commerce)** |
| 4K (4096px) | 2.520 | $0.151 | R$ 0,88 | Máxima (impressão) |

> Token output de imagem: $60/MTok

### 2.3 Pipelines de Imagem — Comparativo de Custo

#### Cenário A: SEM modelo do banco (foto flat-lay → modelo com roupa + fundo)

| Pipeline | Steps | Custo BRL | Tempo |
|----------|-------|-----------|-------|
| **Fashn puro** (atual) | `product-to-model` → `edit` | **R$ 0,87** | 40-60s |
| Nano Banana @2K | 1 chamada (tudo junto) | R$ 0,59 | 10-20s |

#### Cenário B: COM modelo do banco (vestir peça + fundo)

| Pipeline | Steps | Custo BRL | Tempo |
|----------|-------|-----------|-------|
| **Fashn puro** (atual) | `tryon-max` → `edit` | **R$ 2,18** | 60-120s |
| Nano Banana @2K | 1 chamada (produto + modelo ref + fundo) | R$ 0,59 | 10-20s |

> ⚠️ **Nota:** O Nano Banana é mais barato mas tem menor fidelidade da roupa (pode alterar cor/textura). O Fashn é superior para preservar detalhes do produto.

---

## 3. TOTAL POR CAMPANHA — Valores Reais

### 3.1 Campanha SEM modelo do banco

```
╔═══════════════════════════════════════════════════════════════╗
║  CUSTO POR CAMPANHA (sem modelo) = R$ 1,05                   ║
║                                                               ║
║  Pipeline texto (Gemini+Claude):  R$ 0,18                    ║
║  Pipeline imagem (Fashn 2x):      R$ 0,87                    ║
║                                                               ║
║  Antes (v1.0 tudo Claude+Fashn):  R$ 1,20  → economia -12%  ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3.2 Campanha COM modelo do banco

```
╔═══════════════════════════════════════════════════════════════╗
║  CUSTO POR CAMPANHA (com modelo) = R$ 2,36                   ║
║                                                               ║
║  Pipeline texto (Gemini+Claude):  R$ 0,18                    ║
║  Pipeline imagem (Fashn 2x):      R$ 2,18                    ║
║                                                               ║
║  Antes (v1.0 tudo Claude+Fashn):  R$ 2,51  → economia -6%   ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3.3 Campanha SEM imagem (só texto)

```
╔═══════════════════════════════════════════════════════════════╗
║  CUSTO POR CAMPANHA (só texto) = R$ 0,18                     ║
║                                                               ║
║  Antes (v1.0):  R$ 0,33  → economia -45%                    ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 4. Custos de Operações Extras

| Operação | Steps | **Custo BRL** |
|----------|-------|---------------|
| **Campanha completa (sem modelo)** | 5 LLM + product-to-model + edit | **R$ 1,05** |
| **Campanha completa (com modelo)** | 5 LLM + tryon-max + edit | **R$ 2,36** |
| **Auto-retry copy** (score < 40) | Copywriter + Refiner extras | **+R$ 0,13** |
| **Regeneração de copy** | Copywriter + Refiner + Scorer | **R$ 0,14** |
| **Regeneração de imagem (sem modelo)** | product-to-model + edit | **R$ 0,87** |
| **Regeneração de imagem (com modelo)** | tryon-max + edit | **R$ 2,18** |
| **Modelo personalizada** | Fashn model-create | **~R$ 0,44+** |

---

## 5. Packs de Créditos (avulsos)

### 5.1 Pack de Entrada (1x por conta nova)

| Pack | Preço | Por crédito | Custo real* | Margem |
|------|-------|-------------|-----------|--------|
| 🎯 **3 campanhas** | **R$ 9,90** | R$ 3,30 | R$ 3,15 | **68%** ✅ |

*custo real = mix 50% sem modelo (R$ 1,05) e 50% com modelo (R$ 2,36)*

### 5.2 Packs Avulsos (sempre disponível)

| Pack | Preço | Por crédito | Custo real* | Margem |
|------|-------|-------------|-----------|--------|
| +5 campanhas | R$ 29,90 | R$ 5,98 | R$ 5,25 | **82%** ✅ |
| +10 campanhas | R$ 49,90 | R$ 4,99 | R$ 10,50 | **79%** ✅ |
| +25 campanhas | R$ 99,90 | R$ 4,00 | R$ 26,25 | **74%** ✅ |

*custo real = mix 50/50 sem/com modelo = R$ 1,05 média*
*Nota: se maioria usar modelo do banco, custo real sobe para R$ 2,36/camp*

### 5.3 Cenários de Custo por Perfil de Uso

| Perfil do cliente | Custo/campanha | Como calcula |
|---|---|---|
| Só texto (sem imagem) | R$ 0,18 | Raro — apenas copy |
| Sem modelo do banco | R$ 1,05 | product-to-model + edit |
| **Com modelo do banco** | **R$ 2,36** | **tryon-max + edit (MAIS CARO)** |
| Mix realista (30% sem img, 40% sem modelo, 30% com modelo) | **R$ 1,05** | Média ponderada |

### 5.4 Outros Avulsos

| Item | Preço | Custo real | Margem |
|------|-------|-----------|--------|
| +1 Modelo personalizada | R$ 4,90 | R$ 0,44 | **91%** ✅ |
| +3 Modelos personalizadas | R$ 12,90 | R$ 1,32 | **90%** ✅ |
| +10 Regenerações copy | R$ 9,90 | R$ 1,40 | **86%** ✅ |

---

## 6. Planos Mensais

| Recurso | ⭐ Starter | 🚀 Pro | 🏢 Business | 🏆 Agência |
|---------|-----------|--------|------------|-----------| 
| **Preço/mês** | R$ 59 | R$ 129 | R$ 249 | R$ 499 |
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

---

## 7. Margens por Plano

### 7.1 PIOR CASO — 100% uso + todas as regens

**Premissas:** 100% campanhas usadas, 100% regens, 50% usa modelo do banco
**Custo médio/campanha:** R$ 1,71 (mix 50% sem modelo R$ 1,05 + 50% com modelo R$ 2,36)
**Custo regen:** R$ 0,14 (copy — mais comum) a R$ 0,87 (imagem sem modelo)
**Mix regen:** 70% copy (R$ 0,14) + 30% imagem (R$ 0,87) = R$ 0,36/regen

#### Com taxa Mercado Pago (cartão 4,98%)

| Plano | Receita | Taxa MP | Campanhas | Regens | Custo APIs | **Margem** | **%** |
|-------|---------|---------|-----------|--------|-----------|-----------|------|
| ⭐ Starter | R$ 59 | R$ 2,94 | 15 × R$1,71 | 30 × R$0,36 | R$ 36,45 | **R$ 19,61** | **33,2%** ⚠️ |
| 🚀 Pro | R$ 129 | R$ 6,42 | 40 × R$1,71 | 120 × R$0,36 | R$ 111,60 | **R$ 10,98** | **8,5%** 🔴 |
| 🏢 Business | R$ 249 | R$ 12,40 | 85 × R$1,71 | 255 × R$0,36 | R$ 237,15 | **-R$ 0,55** | **-0,2%** 🔴 |
| 🏆 Agência | R$ 499 | R$ 24,85 | 170 × R$1,71 | 510 × R$0,36 | R$ 474,30 | **-R$ 0,15** | **0%** 🔴 |

> ⚠️ **ALERTA:** No pior caso com 50% usando modelo do banco (tryon-max a R$ 2,18), os planos Pro/Business/Agência NÃO dão lucro! O `tryon-max` do Fashn (4 créditos) é o vilão.

#### No pior caso SEM modelo do banco (todos usam product-to-model R$ 1,05)

| Plano | Receita | Taxa MP | Custo APIs | **Margem** | **%** |
|-------|---------|---------|-----------|-----------|------|
| ⭐ Starter | R$ 59 | R$ 2,94 | R$ 26,55 | **R$ 29,51** | **50,0%** ✅ |
| 🚀 Pro | R$ 129 | R$ 6,42 | R$ 85,20 | **R$ 37,38** | **29,0%** ⚠️ |
| 🏢 Business | R$ 249 | R$ 12,40 | R$ 181,05 | **R$ 55,55** | **22,3%** ⚠️ |
| 🏆 Agência | R$ 499 | R$ 24,85 | R$ 362,10 | **R$ 112,05** | **22,5%** ⚠️ |

### 7.2 USO REAL — 60% campanhas + 20% com 1 regen

**Premissas:** 60% das campanhas usadas, 20% dessas com 1 regen
**Mix modelo banco:** 30% usam modelo do banco

| Plano | Receita | Custo APIs | **Margem R$** | **Margem %** |
|-------|---------|-----------|--------------|-------------|
| 🎯 Trial R$9,90 | R$ 9,90 | R$ 3,15 | **R$ 6,75** | **68%** ✅ |
| ⭐ Starter R$59 | R$ 59 | R$ 11,34 | **R$ 47,66** | **80,8%** ✅ |
| 🚀 Pro R$129 | R$ 129 | R$ 30,24 | **R$ 98,76** | **76,6%** ✅ |
| 🏢 Business R$249 | R$ 249 | R$ 64,26 | **R$ 184,74** | **74,2%** ✅ |
| 🏆 Agência R$499 | R$ 499 | R$ 128,52 | **R$ 370,48** | **74,2%** ✅ |

---

## 8. Custos Fixos de Plataforma

| Serviço | Custo atual | Provider | Limite free |
|---------|------------|----------|-------------|
| Supabase | R$ 0 | Supabase | 500MB DB, 1GB storage |
| Clerk (auth) | R$ 0 | Clerk | 10.000 MAU |
| Mercado Pago | R$ 0 | Mercado Pago | Pay-as-you-go |
| Anthropic API | Pay-as-you-go | Anthropic | — |
| Google AI API | Pay-as-you-go | Google | — |
| Fashn.ai API | Pay-as-you-go | Fashn.ai | — |
| Inngest | R$ 0 | Inngest | 25K events/mês |
| PostHog | R$ 0 | PostHog | 1M events/mês |
| VPS KingHost | Já pago | KingHost | — |
| **Total fixo** | **R$ 0/mês** | | |

---

## 9. Decomposição de Custos por API

| Provider | Quando paga | Modelo de cobrança | Custo típico |
|----------|------------|-------------------|-------------|
| **Anthropic** | Copywriter step | Tokens (input $3/MTok + output $15/MTok) | R$ 0,113/campanha |
| **Google AI** | Vision, Strategy, Refiner, Scorer | Tokens (input $0.30/MTok + output $2.50-10/MTok) | R$ 0,071/campanha |
| **Google AI** | Nano Banana imagem (quando usado) | Tokens de imagem ($60/MTok output) | R$ 0,59/imagem @2K |
| **Fashn.ai** | Product-to-model | 1 crédito ($0.075) | R$ 0,44/imagem |
| **Fashn.ai** | Try-on Max (banco modelos) | 4 créditos ($0.300) | R$ 1,74/imagem |
| **Fashn.ai** | Edit (fundo) | 1 crédito ($0.075) | R$ 0,44/chamada |
| **Fashn.ai** | Background remove | 1 crédito ($0.075) | R$ 0,44/chamada |

---

## 10. Resumo Executivo

```
┌─────────────────────────────────────────────────────────────────┐
│         MODELO DE NEGÓCIO — ARQUITETURA v2.0 (HÍBRIDA)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🧠 Pipeline texto: Gemini Flash/Pro + Claude Sonnet 4          │
│  📸 Pipeline imagem: Fashn.ai (roupa) + Nano Banana (alt)      │
│                                                                  │
│  💰 Custo texto/campanha: R$ 0,18  (antes: R$ 0,33 = -45%)    │
│  📸 Custo imagem sem modelo: R$ 0,87  (Fashn 2x chamadas)     │
│  📸 Custo imagem com modelo: R$ 2,18  (tryon-max = vilão)     │
│                                                                  │
│  🎯 Pack entrada (3 camp): R$ 9,90   → margem 68%              │
│  ⭐ Starter (15/mês): R$ 59         → margem 81% (uso real)   │
│  🚀 Pro (40/mês): R$ 129            → margem 77% (uso real)   │
│  🏢 Business (85/mês): R$ 249       → margem 74% (uso real)   │
│  🏆 Agência (170/mês): R$ 499      → margem 74% (uso real)   │
│                                                                  │
│  ⚠️ RISCO: tryon-max (R$ 1,74) come margem se 50%+ dos        │
│     clientes usarem banco de modelos no pior caso               │
│                                                                  │
│  💡 SOLUÇÃO: Melhorar prompts do Nano Banana para try-on       │
│     (R$ 0,59 vs R$ 2,18 = economia de 73%) ou negociar        │
│     volume com Fashn.ai                                          │
│                                                                  │
│  🏗️ Infra fixa: R$ 0/mês (tudo free tier ou pay-as-you-go)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
