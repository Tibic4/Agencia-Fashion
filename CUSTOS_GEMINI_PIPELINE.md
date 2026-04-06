# 💰 CriaLook — Análise de Custos: Pipeline com Gemini 3.1 Flash Image

> **Data:** Abril 2026 | **Câmbio base:** US$ 1 = R$ 5,75

---

## 1. PREÇOS DO GEMINI 3.1 FLASH IMAGE (Preview)

### 1.1 Geração de Imagem (Output Tokens)

| Resolução | Tokens de saída | Custo/imagem (USD) | Custo/imagem (BRL) |
|-----------|----------------|--------------------|--------------------|
| **0.5K** (512px) | ~747 tokens | $0.045 | **R$ 0,26** |
| **1K** (1024px) | ~1.120 tokens | $0.067 | **R$ 0,39** |
| **2K** (2048px) | ~1.680 tokens | $0.101 | **R$ 0,58** |
| **4K** (4096px) | ~2.520 tokens | $0.151 | **R$ 0,87** |

> Base: US$ 60/milhão de tokens de output (tier otimista). Tier conservador ($120/M) **dobra** os valores acima.

### 1.2 Texto (LLM) — Gemini 3.1 Flash-Lite

| Direção | Preço/1M tokens (USD) | Preço/1M tokens (BRL) |
|---------|----------------------|----------------------|
| Input | $0,25 | R$ 1,44 |
| Output | $1,50 | R$ 8,63 |

> ~10-15x mais barato que Claude Sonnet para tarefas de texto.

---

## 2. COMPARATIVO: PIPELINE ATUAL vs GEMINI

### 2.1 Cenário A — Pipeline Atual (Anthropic + Fashn + DALL-E)

| Etapa | Provider | Custo (BRL) |
|-------|----------|-------------|
| Vision Analyzer | Claude Sonnet | R$ 0,08 |
| Estrategista | Claude Sonnet | R$ 0,06 |
| Copywriter | Claude Sonnet | R$ 0,10 |
| Refinador | Claude Haiku | R$ 0,03 |
| Scorer + Meta Check | Claude Haiku | R$ 0,02 |
| Try-on moda | Fashn.ai | R$ 0,43 |
| Remoção de fundo | Stability AI | R$ 0,05 |
| Lifestyle (não-moda) | DALL-E 3 | R$ 0,23 |
| **TOTAL MODA** | — | **R$ 0,77** |
| **TOTAL NÃO-MODA** | — | **R$ 0,57** |
| **MÉDIA (60/40)** | — | **R$ 0,69** |

---

### 2.2 Cenário B — Pipeline Híbrido (Anthropic texto + Gemini imagens)

Mantém Anthropic para texto (qualidade garantida), substitui toda geração de imagem por Gemini.

| Etapa | Provider | Custo (BRL) |
|-------|----------|-------------|
| Vision Analyzer | Claude Sonnet | R$ 0,08 |
| Estrategista | Claude Sonnet | R$ 0,06 |
| Copywriter | Claude Sonnet | R$ 0,10 |
| Refinador | Claude Haiku | R$ 0,03 |
| Scorer + Meta Check | Claude Haiku | R$ 0,02 |
| **Try-on moda (2K)** | **Gemini 3.1 Flash Image** | **R$ 0,58** |
| Remoção de fundo | ❌ Desnecessário* | R$ 0,00 |
| **Lifestyle (2K)** | **Gemini 3.1 Flash Image** | **R$ 0,58** |
| **TOTAL MODA** | — | **R$ 0,87** |
| **TOTAL NÃO-MODA** | — | **R$ 0,87** |
| **MÉDIA** | — | **R$ 0,87** |

> *O Gemini gera a cena completa (modelo + ambiente) em uma única chamada, eliminando a necessidade de remoção de fundo separada.

⚠️ **Neste cenário, o custo SOBE ~26%.** O Gemini 2K é mais caro que Fashn.ai (R$0,58 vs R$0,43). Porém, se usar 1K:

| | Try-on 1K | Lifestyle 1K | Total Moda | Total Não-Moda |
|---|----------|-------------|-----------|---------------|
| Gemini 1K | R$ 0,39 | R$ 0,39 | **R$ 0,68** | **R$ 0,68** |

> ✅ Com resolução 1K, o custo fica **praticamente igual** ao pipeline atual.

---

### 2.3 Cenário C — Pipeline 100% Gemini (texto + imagens)

Substitui TUDO por Gemini — texto com Flash-Lite, imagens com Flash Image.

| Etapa | Provider | Tokens estimados | Custo (BRL) |
|-------|----------|-----------------|-------------|
| Vision Analyzer | Gemini Flash-Lite | ~2.500 in + 500 out | **R$ 0,01** |
| Estrategista | Gemini Flash-Lite | ~1.000 in + 800 out | **R$ 0,01** |
| Copywriter | Gemini Flash-Lite | ~2.000 in + 2.000 out | **R$ 0,02** |
| Refinador | Gemini Flash-Lite | ~1.500 in + 1.500 out | **R$ 0,02** |
| Scorer + Meta Check | Gemini Flash-Lite | ~1.000 in + 500 out | **R$ 0,01** |
| **Try-on moda (2K)** | **Gemini Flash Image** | ~1.680 out | **R$ 0,58** |
| Remoção de fundo | ❌ Desnecessário | — | R$ 0,00 |
| **Lifestyle (2K)** | **Gemini Flash Image** | ~1.680 out | **R$ 0,58** |
| **TOTAL MODA** | — | — | **R$ 0,65** |
| **TOTAL NÃO-MODA** | — | — | **R$ 0,65** |
| **MÉDIA** | — | — | **R$ 0,65** |

> ✅ **Economia de ~6% no custo médio** vs pipeline atual (R$ 0,65 vs R$ 0,69).

Com resolução **1K** nas imagens:

| | Try-on 1K | Total Moda | Total Não-Moda |
|---|----------|-----------|---------------|
| Full Gemini 1K | R$ 0,39 | **R$ 0,46** | **R$ 0,46** |

> 🔥 **Economia de 33%** com pipeline 100% Gemini + imagens 1K!

---

## 3. TABELA RESUMO — CUSTO POR CAMPANHA

| Pipeline | Moda (2K) | Moda (1K) | Não-moda (2K) | Não-moda (1K) |
|----------|----------|----------|--------------|--------------|
| 🔴 **Atual** (Anthropic+Fashn+DALL-E) | R$ 0,77 | — | R$ 0,57 | — |
| 🟡 **Híbrido** (Anthropic+Gemini) | R$ 0,87 | R$ 0,68 | R$ 0,87 | R$ 0,68 |
| 🟢 **Full Gemini** (Flash-Lite+Flash Image) | R$ 0,65 | R$ 0,46 | R$ 0,65 | R$ 0,46 |

---

## 4. IMPACTO NAS MARGENS POR PLANO

### 4.1 Cenário Pior Caso (100% uso + todas regenerações) — Full Gemini 2K

**Custo médio por campanha: R$ 0,65 (vs R$ 0,69 atual)**
**Custo regeneração copy: R$ 0,05 (vs R$ 0,15 atual)** ← melhoria significativa!
**Custo regeneração imagem: R$ 0,58 (vs R$ 0,33 atual)** ← custo sobe

Regeneração copy = Copywriter (R$0,02) + Refinador (R$0,02) + Scorer (R$0,01) = **R$ 0,05**
Regeneração imagem = 1 imagem Gemini 2K = **R$ 0,58**

| Plano | Receita | Camp. | Custo camp. | Regen máx | Custo regen | **Custo Total** | **Margem R$** | **Margem %** |
|-------|---------|-------|------------|----------|-------------|----------------|--------------|-------------|
| 🆓 Grátis | R$ 0 | 3 | R$ 1,95 | 0 | R$ 0 | **R$ 1,95** | **-R$ 1,95** | Loss leader |
| ⭐ Starter | R$ 59 | 15 | R$ 9,75 | 30 | R$ 1,50* | **R$ 11,25** | **R$ 47,75** | **80,9%** ✅ |
| 🚀 Pro | R$ 129 | 40 | R$ 26,00 | 120 | R$ 6,00* | **R$ 32,00** | **R$ 97,00** | **75,2%** ✅ |
| 🏢 Business | R$ 249 | 85 | R$ 55,25 | 255 | R$ 12,75* | **R$ 68,00** | **R$ 181,00** | **72,7%** ✅ |
| 🏆 Agência | R$ 499 | 170 | R$ 110,50 | 510 | R$ 25,50* | **R$ 136,00** | **R$ 363,00** | **72,7%** ✅ |

> *Regenerações assumindo mix 50% copy (R$0,05) + 50% imagem (R$0,58) = média R$0,05 por regen de copy

⚠️ **Nota:** Regeneração de copy ficou MUITO mais barata (R$0,05 vs R$0,15), mas regeneração de imagem ficou mais cara (R$0,58 vs R$0,33). O ideal é limitar regen de imagem e priorizar regen de copy.

### 4.2 Cenário Uso Médio (60% uso + 20% regen) — Full Gemini 2K

| Plano | Receita | Camp. | Custo camp. | Regen | Custo regen | **Custo Total** | **Margem R$** | **Margem %** |
|-------|---------|-------|------------|-------|-------------|----------------|--------------|-------------|
| 🆓 Grátis | R$ 0 | 2 | R$ 1,30 | 0 | R$ 0 | **R$ 1,30** | **-R$ 1,30** | Loss leader |
| ⭐ Starter | R$ 59 | 9 | R$ 5,85 | 2 | R$ 0,10 | **R$ 5,95** | **R$ 53,05** | **89,9%** ✅ |
| 🚀 Pro | R$ 129 | 24 | R$ 15,60 | 5 | R$ 0,25 | **R$ 15,85** | **R$ 113,15** | **87,7%** ✅ |
| 🏢 Business | R$ 249 | 51 | R$ 33,15 | 10 | R$ 0,50 | **R$ 33,65** | **R$ 215,35** | **86,5%** ✅ |
| 🏆 Agência | R$ 499 | 102 | R$ 66,30 | 20 | R$ 1,00 | **R$ 67,30** | **R$ 431,70** | **86,5%** ✅ |

> 🔥 **Margem média ~87% no uso real** — vs ~83% no pipeline antigo. Melhoria significativa!

---

## 5. VANTAGENS ALÉM DO PREÇO

### 5.1 Simplificação do Pipeline

| Aspecto | Pipeline Atual | Pipeline Gemini |
|---------|---------------|----------------|
| **Vendors de imagem** | 3 (Fashn + Stability + DALL-E) | **1 (Gemini)** |
| **Vendors de texto** | 2 (Sonnet + Haiku) | **1 (Gemini Flash-Lite)** |
| **Chamadas API/campanha** | 7-8 | **6** |
| **Pontos de falha** | 5+ APIs diferentes | **1 API** |
| **Complexidade de fallback** | Alta (3 fallbacks de imagem) | **Baixa** |
| **Manutenção de SDKs** | @anthropic, @falai, openai, stability | **@google/genai** |

### 5.2 Capacidades Exclusivas do Gemini Flash Image

- **Multi-modal nativo:** Recebe foto da roupa + prompt → gera imagem direto
- **Edição in-place:** Pode editar partes específicas da imagem gerada
- **Text-in-image:** Insere texto nas imagens de forma nativa
- **Consistência de estilo:** Mantém estilo visual entre chamadas
- **Batch API:** Desconto de 50% para jobs não-realtime

### 5.3 Riscos

| Risco | Mitigação |
|-------|----------|
| Preview instável | Manter Fashn.ai como fallback |
| Qualidade try-on inferior | Testar extensivamente antes de migrar |
| Preço pode subir | Documentar com $120/M como cenário conservador |
| Rate limits | Batch API + queuing com Inngest |
| Censura de imagens de moda | Testar com diferentes tipos de roupa (lingerie, moda praia) |

---

## 6. CENÁRIO CONSERVADOR (US$ 120/M output tokens)

Se o preço real for **$120/M** em vez de $60/M:

| Resolução | Custo/imagem (BRL) |
|-----------|-------------------|
| 1K | **R$ 0,77** |
| 2K | **R$ 1,16** |

| Pipeline Full Gemini | Moda 2K | Moda 1K |
|---------------------|---------|---------|
| Custo/campanha | **R$ 1,23** | **R$ 0,84** |
| vs Atual (R$ 0,69) | ❌ +78% | ❌ +22% |

> ⚠️ No cenário conservador ($120/M), o pipeline Full Gemini com imagem 2K **não compensa**. Nesse caso, usar 1K ou manter Fashn.ai.

---

## 7. RECOMENDAÇÃO FINAL

### Pipeline Recomendado: "Gemini-First com Fallback"

```
┌─ Recomendação de Implementação ────────────────────┐
│                                                      │
│  📝 TEXTO (copy, análise, score):                   │
│     Primary: Gemini 3.1 Flash-Lite                  │
│     Fallback: Claude Haiku (se qualidade cair)       │
│     Economia: ~R$ 0,22/campanha (76% menos)          │
│                                                      │
│  📸 IMAGENS (try-on, lifestyle):                     │
│     Primary: Gemini 3.1 Flash Image (1K ou 2K)       │
│     Fallback: Fashn.ai (try-on) + DALL-E (lifestyle) │
│     Economia: variável (depende do tier de preço)    │
│                                                      │
│  💡 MELHOR CUSTO-BENEFÍCIO:                          │
│     Full Gemini com imagens 1K = R$ 0,46/campanha   │
│     Economia vs atual: 33%                            │
│                                                      │
│  💎 MELHOR QUALIDADE:                                │
│     Full Gemini com imagens 2K = R$ 0,65/campanha   │
│     Economia vs atual: 6%                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Próximo Passo: Validação de Qualidade

Antes de migrar, validar com testes A/B:
1. ✅ Gerar 10+ try-ons com Gemini e comparar com Fashn.ai
2. ✅ Testar diferentes tipos de roupa (vestido, jeans, camiseta, moletom)
3. ✅ Verificar fidelidade de cor/textura (especialmente denim)
4. ✅ Testar geração de calçados (obrigatório no pipeline)
5. ✅ Medir latência: Gemini vs Fashn.ai
6. ✅ Verificar rate limits em volume (50+ requests/hora)
