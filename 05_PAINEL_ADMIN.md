# ⚡ CAMPANHA IA — Painel Administrativo

## Parte 5: Dashboard Admin, Controle de Custos e Gestão de Clientes

---

## 1. ACESSO E SEGURANÇA

- Rota: `/admin/*` — protegida por middleware Next.js
- Auth: Clerk com role `admin` (configurado via Clerk Dashboard)
- RLS: tabelas sensíveis (api_cost_logs, admin_settings) bloqueadas para non-admin
- Apenas emails autorizados em `admin_settings.admin_emails` podem acessar

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const role = req.auth?.sessionClaims?.role;
    if (role !== 'admin') return NextResponse.redirect('/');
  }
}
```

---

## 2. DASHBOARD PRINCIPAL (`/admin`)

### 2.1 Cards de Resumo (Top)

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  👥 Clientes │ │ 📊 Campanhas │ │ 💰 Receita   │ │ 🔥 Custo API │
│     127      │ │   1.847      │ │  R$ 8.430    │ │  R$ 1.290    │
│  +12 (7d)    │ │  +234 (7d)   │ │  +R$ 1.200   │ │  63% margem  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

| Card | Fonte | Cálculo |
|------|-------|---------|
| Clientes | `COUNT(stores)` | Total + novos últimos 7 dias |
| Campanhas | `COUNT(campaigns)` | Total + geradas últimos 7 dias |
| Receita | Stripe API | MRR atual + delta vs mês anterior |
| Custo API | `SUM(api_cost_logs.cost_brl)` | Mês atual + % margem (receita - custo) |

### 2.2 Gráficos

| Gráfico | Tipo | Dados | Período |
|---------|------|-------|---------|
| Campanhas/dia | Linha | campaigns por created_at | 30 dias |
| Custo API/dia | Barras empilhadas | api_cost_logs por provider | 30 dias |
| Novos clientes/semana | Linha | stores por created_at | 12 semanas |
| Distribuição de planos | Donut | stores agrupado por plan_id | Atual |
| Score médio | Gauge | AVG(campaign_scores.nota_geral) | 30 dias |
| Top segmentos | Barras horizontal | stores por segment_primary | Atual |

### 2.3 Alertas Ativos

```
🔴 Custo API hoje R$ 89 — 178% da média diária
🟡 3 campanhas falharam na última hora (ver logs)
🟢 SLA do pipeline: 98.2% sucesso (últimas 24h)
```

**Regras de alerta:**
- 🔴 Custo diário > 150% da média dos últimos 7 dias
- 🔴 Taxa de falha > 5% nas últimas 24h
- 🟡 Custo mensal > 80% do budget configurado
- 🟡 Qualquer provider com latência > 30s
- 🟢 Tudo normal

---

## 3. GESTÃO DE CLIENTES (`/admin/clientes`)

### 3.1 Lista de Clientes

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Buscar por nome, email ou cidade...                     │
│  [Todos] [Grátis] [Starter] [Pro] [Agência] [Inativos]     │
├─────────────────────────────────────────────────────────────┤
│  Loja              Plano     Campanhas  Último uso  Gasto   │
│  ─────────────────────────────────────────────────────────── │
│  Moda da Bia       Pro       47         hoje        R$ 28   │
│  Look Store        Starter   12         2d atrás    R$ 7    │
│  Bella Acessórios  Grátis    3          5d atrás    R$ 2    │
│  Mais Saúde        Pro       89         hoje        R$ 52   │
└─────────────────────────────────────────────────────────────┘
```

**Colunas:**
| Coluna | Fonte | Detalhe |
|--------|-------|---------|
| Loja | stores.name | Nome da loja |
| Plano | plans.display_name via stores.plan_id | Plano atual |
| Campanhas | COUNT(campaigns) WHERE store_id | Total de campanhas |
| Último uso | MAX(campaigns.created_at) | Data da última geração |
| Gasto API | SUM(api_cost_logs.cost_brl) WHERE store_id | Custo total que esse cliente gerou |

**Filtros:** plano, segmento, cidade, data de cadastro, status (ativo/inativo)
**Ordenação:** por nome, campanhas, gasto, último uso

### 3.2 Detalhe do Cliente (`/admin/clientes/[id]`)

```
┌─ Moda da Bia ──────────────────────────────────┐
│                                                  │
│  📋 Dados                                        │
│  Segmento: Moda Feminina                        │
│  Cidade: São Paulo, SP                           │
│  Plano: Pro (desde 15/mar)                       │
│  Email: bia@modadabia.com                        │
│  Stripe: [Ver no Stripe ↗]                       │
│                                                  │
│  📊 Uso este mês                                 │
│  Campanhas: 12/100 (12%)                         │
│  Regenerações: 8 usadas                          │
│  Custo API: R$ 7,23                              │
│  Score médio: 82/100                             │
│                                                  │
│  🧍 Modelo virtual                               │
│  [Preview da modelo] Clara, cacheado, casual     │
│                                                  │
│  📸 Últimas campanhas                            │
│  [Grid com thumbnails das últimas 6 campanhas]   │
│                                                  │
│  ⚙️ Ações                                       │
│  [Pausar conta] [Upgrade gratuito] [Resetar uso] │
└──────────────────────────────────────────────────┘
```

---

## 4. CONTROLE DE CUSTOS API (`/admin/custos`)

### 4.1 Resumo de Custos

```
┌─ Custos API — Abril 2026 ──────────────────────┐
│                                                  │
│  Total mês:     R$ 1.290,47                      │
│  Budget:        R$ 2.000,00                      │
│  Restante:      R$ 709,53 (64,5% usado)          │
│  Média/dia:     R$ 43,01                          │
│  Projeção mês:  R$ 1.720 ✅                       │
│                                                  │
│  Receita mês:   R$ 8.430,00                      │
│  Margem bruta:  R$ 7.139,53 (84,7%)              │
└──────────────────────────────────────────────────┘
```

### 4.2 Custo por Provider

```
┌─────────────────────────────────────────────────┐
│  Provider        Requests   Custo    % Total     │
│  ─────────────────────────────────────────────── │
│  Anthropic       8.234      R$ 680   52.7%       │
│  Fashn.ai        1.847      R$ 412   31.9%       │
│  OpenAI          623        R$ 143   11.1%       │
│  Stability AI    891        R$ 45    3.5%        │
│  Remove.bg       134        R$ 10    0.8%        │
└─────────────────────────────────────────────────┘
```

### 4.3 Custo por Etapa do Pipeline

| Etapa | Modelo | Requests | Custo médio | Custo total |
|-------|--------|----------|-------------|-------------|
| Vision Analyzer | Sonnet | 1.847 | R$ 0,08 | R$ 147,76 |
| Estrategista | Sonnet | 1.847 | R$ 0,06 | R$ 110,82 |
| Copywriter | Sonnet | 1.847 | R$ 0,10 | R$ 184,70 |
| Refinador | Haiku | 1.847 | R$ 0,03 | R$ 55,41 |
| Scorer | Haiku | 1.847 | R$ 0,02 | R$ 36,94 |
| Try-on (moda) | Fashn | 1.204 | R$ 0,43 | R$ 517,72 |
| Remoção fundo | Stability | 643 | R$ 0,05 | R$ 32,15 |
| Lifestyle img | DALL-E 3 | 643 | R$ 0,23 | R$ 147,89 |

### 4.4 Configurações de Budget

```
┌─ Configurações de Custo ───────────────────────┐
│                                                  │
│  Taxa USD/BRL:        [5.50] ← atualizar manual │
│  Budget mensal:       [R$ 2.000]                 │
│  Alerta em:           [80%] do budget            │
│  Limite hard:         [R$ 2.500] ← para pipeline │
│                                                  │
│  Ações ao atingir limite:                        │
│  ○ Pausar novas gerações                         │
│  ○ Degradar para Haiku em todas as etapas        │
│  ○ Apenas alertar admin (não pausar)             │
│                                                  │
│  [Salvar configurações]                          │
└──────────────────────────────────────────────────┘
```

### 4.5 Alertas de Custo

| Tipo | Condição | Ação automática |
|------|----------|-----------------|
| 🟡 Warning | Budget > 80% | Email para admin |
| 🔴 Crítico | Budget > 95% | Email + notificação push |
| ⛔ Hard limit | Budget > 100% | Pausa gerações ou degrada modelo |
| 🔴 Spike | Custo diário > 200% da média | Email imediato |
| 🔴 Provider down | Latência > 60s ou erro 5xx | Email + ativa fallback |

---

## 5. GESTÃO DE CAMPANHAS (`/admin/campanhas`)

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Buscar por loja, produto...                             │
│  [Todas] [Sucesso] [Falha] [Em progresso]                   │
│  Período: [Hoje ▼]                                          │
├─────────────────────────────────────────────────────────────┤
│  Loja           Produto         Status   Score  Tempo  Custo│
│  ─────────────────────────────────────────────────────────── │
│  Moda da Bia    Vestido floral  ✅ OK    87     32s    R$0.8│
│  Look Store     Tênis casual    ✅ OK    72     28s    R$0.6│
│  Mais Saúde     Cápsulas vita   ⚠️ Risco 91     35s    R$0.5│
│  Bella Acess.   Brinco prata   ❌ Falha  -      -      R$0.1│
└─────────────────────────────────────────────────────────────┘
```

**Ao clicar em uma campanha:**
- Ver todos os outputs (textos, imagens, scores)
- Ver log completo do pipeline (cada etapa com input/output/tempo/custo)
- Ver alertas Meta se houver
- Botão "Regerar como admin" (bypass de limites do plano)

---

## 6. LOGS E DEBUG (`/admin/logs`)

### 6.1 Tipos de log

| Tipo | Cor | Exemplo |
|------|-----|---------|
| `pipeline_success` | 🟢 | Pipeline completo em 32s |
| `pipeline_partial` | 🟡 | Imagem falhou, texto OK |
| `pipeline_error` | 🔴 | JSON inválido do Estrategista (retry 1/2) |
| `api_error` | 🔴 | Fashn.ai 500 Internal Server Error |
| `api_timeout` | 🟠 | Anthropic timeout após 30s |
| `rate_limit` | 🟡 | Anthropic 429 — aguardando 5s |
| `validation_error` | 🔴 | Output do Copywriter sem campo meta_ads |
| `cost_alert` | 🟡 | Budget diário 150% da média |
| `user_action` | ⚪ | Loja "X" trocou modelo virtual |

### 6.2 Filtros

- Por tipo: success, error, warning
- Por provider: anthropic, fashn, stability, openai
- Por etapa: vision, strategist, copywriter, refiner, scorer, image
- Por loja: busca por nome
- Por período: hoje, 7d, 30d, custom

### 6.3 Detalhe do erro

```
┌─ Erro #4821 ────────────────────────────────────┐
│  Tipo: pipeline_error                            │
│  Etapa: copywriter                               │
│  Loja: Moda da Bia                               │
│  Campanha: 7f2a3b...                             │
│  Horário: 04/abr 14:23:47                        │
│                                                  │
│  Erro: JSON inválido — campo meta_ads ausente    │
│  Retry: 1/2 — sucesso no retry                   │
│                                                  │
│  ▸ Input (expandir)                              │
│  ▸ Output bruto (expandir)                       │
│  ▸ Output parseado (expandir)                    │
│  ▸ Stack trace (expandir)                        │
└──────────────────────────────────────────────────┘
```

---

## 7. MÉTRICAS E KPIs DO ADMIN

### 7.1 KPIs de Negócio

| KPI | Cálculo | Meta |
|-----|---------|------|
| MRR | SUM(planos ativos × preço) | Crescimento 15%/mês |
| Churn | Cancelamentos / Total início mês | < 5% |
| LTV | MRR médio × Meses médios | > R$ 500 |
| CAC | (Gasto marketing) / Novos clientes | < R$ 50 |
| Margem bruta | (Receita - Custo API) / Receita | > 80% |

### 7.2 KPIs de Produto

| KPI | Cálculo | Meta |
|-----|---------|------|
| Campanhas/cliente/mês | AVG campanhas por store ativo | > 8 |
| Taxa de sucesso pipeline | Campanhas OK / Total | > 95% |
| Tempo médio de geração | AVG(pipeline_duration_ms) | < 40s |
| Score médio | AVG(nota_geral) | > 75 |
| Taxa de regeneração | Regenerações / Campanhas | < 20% |
| Conversão free→paid | Upgrades / Free ativos | > 10% |

### 7.3 KPIs de Custo

| KPI | Cálculo | Meta |
|-----|---------|------|
| Custo/campanha | Custo API total / Campanhas | < R$ 1,00 |
| Custo/cliente/mês | Custo API / Clientes ativos | < R$ 15 |
| % Receita em API | Custo API / Receita | < 20% |
| Custo Fashn/campanha moda | Custo Fashn / Campanhas moda | < R$ 0,50 |
