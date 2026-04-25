# CriaLook — Plano de Negócio Definitivo

> Última atualização: 14/Abril/2026
> Moeda: BRL (R$) | Câmbio: US$ 1 = R$ 5,80
> Infraestrutura: VPS 8GB RAM (self-hosted) + Supabase + Inngest
> Fonte de verdade de preços: `campanha-ia/src/lib/plans.ts`

---

## Tabela de Planos (valores reais do código)

| Plano | Preço/mês | Campanhas/mês | Modelos | Histórico | Público |
|-------|:---------:|:-------------:|:-------:|:---------:|---------|
| 🆓 Grátis | R$ 0 | 0 | 0 | 7 dias | Cadastro sem pagamento |
| 💡 Essencial | R$ 179 | 15 | 5 | 30 dias | Lojista pequena (Instagram/WhatsApp) |
| 🚀 Pro | R$ 359 | 40 | 15 | 365 dias | Loja média / multi-canal |
| 🏢 Business | R$ 749 | 100 | 40 | Ilimitado | Multi-loja / quem posta todo dia |

### Trial (pack único — primeira compra)

| Item | Valor |
|------|-------|
| Preço | R$ 19,90 (pagamento único) |
| Campanhas incluídas | 3 |
| Modelo virtual bônus | +1 |
| Restrição | 1x por loja (verificado via `credit_purchases`) |

### Packs Avulsos — Campanhas

| Pack | Campanhas | Preço | Preço/unidade |
|------|:---------:|:-----:|:-------------:|
| Starter | +3 | R$ 49,90 | R$ 16,63 |
| Smart | +10 | R$ 149,90 | R$ 14,99 |
| Volume | +20 | R$ 249,00 | R$ 12,45 |

### Packs Avulsos — Modelos Virtuais

| Pack | Modelos | Preço | Preço/unidade |
|------|:-------:|:-----:|:-------------:|
| Básico | +3 | R$ 19,90 | R$ 6,63 |
| Smart | +10 | R$ 49,90 | R$ 4,99 |
| Volume | +25 | R$ 99,90 | R$ 4,00 |

---

## Custo por Campanha (auditado — Abril/2026)

> Preços oficiais: Google AI + Anthropic. Output médio 2K tokens.

| # | Etapa | Modelo | Custo USD | Custo R$ |
|---|-------|--------|:---------:|:--------:|
| 1 | Vision (foto produto) | Gemini 2.5 Flash | $0,00170 | R$ 0,010 |
| 2 | Strategy | Gemini 2.5 Pro | $0,01050 | R$ 0,061 |
| 3 | Copywriter | Claude Sonnet 4.6 | $0,03900 | R$ 0,226 |
| 4 | Refiner | Gemini 2.5 Flash | $0,00465 | R$ 0,027 |
| 5 | Scorer | Gemini 2.5 Flash | $0,00200 | R$ 0,012 |
| 6 | Mini-Vision VTO | Gemini 2.5 Flash | $0,00136 | R$ 0,008 |
| 7 | **VTO 1ª geração (img 2K)** | Gemini Flash Image | **$0,10200** | **R$ 0,592** |
| 8 | QA Visual Agent (CoT) | Gemini 2.5 Flash | $0,00225 | R$ 0,013 |
| 9 | **VTO 2ª geração (QA reprova)** | Gemini Flash Image | **$0,10325** | **R$ 0,599** |
| | **Total sem retry (QA aprova)** | | $0,1635 | **R$ 0,95** |
| | **Total com retry (QA reprova)** | | $0,2667 | **R$ 1,56** |
| | **Média ponderada (~20% retry)** | | $0,1841 | **R$ 1,07** |
| | **Criar modelo virtual (2K)** | Gemini Flash Image | $0,1020 | **R$ 0,59** |

### Margens por plano

| Plano | Receita/camp | Custo/camp | Margem/camp | Margem % |
|-------|:----------:|:----------:|:-----------:|:--------:|
| Trial | R$ 6,63 | R$ 1,07 | R$ 5,56 | 84% |
| Essencial | R$ 11,93 | R$ 1,07 | R$ 10,86 | 91% |
| Pro | R$ 8,98 | R$ 1,07 | R$ 7,91 | 88% |
| Business | R$ 7,49 | R$ 1,07 | R$ 6,42 | 86% |

> **Essencial é o plano mais lucrativo por campanha.** Pro e Business ganham no volume.

---

## Stack Técnica em Produção

| Componente | Tecnologia | Papel |
|-----------|-----------|-------|
| Frontend | Next.js 15 App Router | SSR + UI |
| Hosting | VPS 8GB RAM (self-hosted) | Deploy + Docker |
| Banco de dados | Supabase (PostgreSQL) | Dados + Storage + RLS |
| Auth | Clerk | Autenticação + SSO |
| Pipeline IA (texto) | Gemini 2.5 Flash/Pro + Claude Sonnet 4.6 | 7 etapas de geração |
| Pipeline IA (imagem) | Gemini Flash Image | Virtual Try-On |
| QA visual | Gemini 2.5 Flash | Verificação de fidelidade |
| Background jobs | **Inngest** | Geração assíncrona + retries + cron |
| Pagamentos | Mercado Pago | PreApproval (assinatura) + Preferences (avulso) |
| Câmbio | AwesomeAPI | Atualização diária USD/BRL |
| Monitoramento | Sentry | Error tracking |
| Storage cleanup | GC automático (Inngest cron) | Purge imagens >25 dias não-favoritadas |

### Inngest — Jobs em Produção

| Função | Trigger | O que faz |
|--------|---------|-----------|
| `generateCampaignJob` | `campaign/generate` | Pipeline completo (texto + VTO + QA) |
| `generateModelPreviewJob` | `model/generate-preview` | Preview de modelo virtual |
| Cron `exchange-rate` | Diário | Atualiza câmbio USD/BRL |
| Cron `storage-gc` | Diário 03:00 UTC | Limpa imagens >25 dias não-favoritadas |

### Storage GC — Detalhes

- **Retenção:** 25 dias após `created_at`
- **Proteção:** `is_favorited = true` imune ao GC
- **Batch size:** 100 campanhas / max 500 arquivos por run
- **Buckets varridos:** `product-photos`, `campaign-outputs`, `assets/model-previews`
- **Campanhas purgadas:** marcadas `is_archived = true`, copy/scores preservados
- **API:** `PATCH /api/campaign/[id]/favorite` | `POST /api/admin/storage-gc`
- **Economia estimada:** ~99% menos storage vs sem GC

---

## Marco 1 — 500 Usuários Pagantes (MVP validado)

**Distribuição estimada:** 50% Essencial / 25% Pro / 10% Business / 15% Trial

| Plano | Usuários | Receita/mês | Camp/mês (60% uso) | Custo API/mês |
|-------|:--------:|:-----------:|:------------------:|:-------------:|
| Trial (pack único) | 75 | R$ 1.493 | 225 | R$ 241 |
| Essencial | 250 | R$ 44.750 | 2.250 | R$ 2.408 |
| Pro | 125 | R$ 44.875 | 3.000 | R$ 3.210 |
| Business | 50 | R$ 37.450 | 3.000 | R$ 3.210 |
| **Total** | **500** | **R$ 128.568** | **8.475** | **R$ 9.069** |

### Infraestrutura necessária (VPS 8GB já coberta)

| Serviço | Plano | Custo/mês |
|---------|-------|:---------:|
| VPS 8GB (produção) | Contabo/Hetzner | R$ 150 |
| Supabase | Pro | R$ 145 ($25) |
| Clerk | Pro (2.5k MAU) | R$ 145 ($25) |
| Inngest | Hobby (50k exec) | R$ 0 |
| Domínio + SSL | crialook.com.br | R$ 10 |
| Sentry | Team | R$ 145 ($25) |
| **Total infra** | | **R$ 595** |

### Resultado Marco 1

| Métrica | Valor |
|---------|-------|
| Receita bruta | R$ 128.568/mês |
| Taxa MP (4,98%) | -R$ 6.403/mês |
| Custo API | -R$ 9.069/mês |
| Custo infra | -R$ 595/mês |
| **Margem bruta** | **R$ 112.501/mês (87%)** |
| MRR | R$ 127.075 |
| ARR | R$ 1.524.900 |

### Ações neste marco
- [ ] Monitorar conversão Trial → Essencial (meta: >30%)
- [ ] Implementar Batch API do Gemini para steps de texto (-50% custo texto)
- [ ] Criar programa de indicação (créditos bônus)
- [ ] Upsell automático quando usuário atinge 80% do limite (WhatsApp)
- [ ] Implementar plano anual (2 meses grátis) para reduzir churn

---

## Marco 2 — 1.500 Usuários Pagantes (Product-Market Fit)

**Distribuição estimada:** 45% Essencial / 30% Pro / 12% Business / 13% Trial

| Plano | Usuários | Receita/mês | Camp/mês (60% uso) | Custo API/mês |
|-------|:--------:|:-----------:|:------------------:|:-------------:|
| Trial (pack único) | 195 | R$ 3.881 | 585 | R$ 626 |
| Essencial | 675 | R$ 120.825 | 6.075 | R$ 6.500 |
| Pro | 450 | R$ 161.550 | 10.800 | R$ 11.556 |
| Business | 180 | R$ 134.820 | 10.800 | R$ 11.556 |
| **Total** | **1.500** | **R$ 421.076** | **28.260** | **R$ 30.238** |

### Infraestrutura necessária

| Serviço | Plano | Custo/mês |
|---------|-------|:---------:|
| VPS upgrade | 16GB | R$ 300 |
| Supabase | Pro + Compute addon | R$ 290 ($50) |
| Clerk | Pro (7.5k MAU) | R$ 290 ($50) |
| Inngest | Pro (80k exec) | R$ 145 ($25) |
| CDN (Cloudflare) | Pro | R$ 116 ($20) |
| Redis (Upstash) | Pay-as-you-go | R$ 58 ($10) |
| Sentry | Team | R$ 145 ($25) |
| **Total infra** | | **R$ 1.344** |

### Resultado Marco 2

| Métrica | Valor |
|---------|-------|
| Receita bruta | R$ 421.076/mês |
| Taxa MP (4,98%) | -R$ 20.970/mês |
| Custo API | -R$ 30.238/mês |
| Custo infra | -R$ 1.344/mês |
| Equipe (2 pessoas) | -R$ 14.000/mês |
| **Margem bruta** | **R$ 354.524/mês (84%)** |
| MRR | R$ 417.195 |
| ARR | R$ 5.006.340 |

### Ações neste marco
- [ ] Contratar dev frontend (part-time)
- [ ] Implementar Batch API Gemini (reduz custo texto ~50%)
- [ ] Criar templates de campanhas por nicho
- [ ] Lançar programa de afiliados
- [ ] Relatório mensal por email com métricas de desempenho
- [ ] Upsell automático via WhatsApp quando 80% do limite atingido

---

## Marco 3 — 5.000 Usuários Pagantes (Escala)

**Distribuição estimada:** 40% Essencial / 35% Pro / 15% Business / 10% Trial

| Plano | Usuários | Receita/mês | Camp/mês (60% uso) | Custo API/mês |
|-------|:--------:|:-----------:|:------------------:|:-------------:|
| Trial (pack único) | 500 | R$ 9.950 | 1.500 | R$ 1.605 |
| Essencial | 2.000 | R$ 358.000 | 18.000 | R$ 19.260 |
| Pro | 1.750 | R$ 628.250 | 42.000 | R$ 44.940 |
| Business | 750 | R$ 561.750 | 45.000 | R$ 48.150 |
| **Total** | **5.000** | **R$ 1.557.950** | **106.500** | **R$ 113.955** |

### Infraestrutura necessária

| Serviço | Plano | Custo/mês |
|---------|-------|:---------:|
| Cloud (AWS EKS / GKE) | Kubernetes | R$ 2.320 ($400) |
| Supabase | Pro + Large compute | R$ 580 ($100) |
| Clerk | Pro (25k MAU) | R$ 435 ($75) |
| Inngest | Pro (500k exec) | R$ 435 ($75) |
| CDN Cloudflare | Business | R$ 1.160 ($200) |
| Redis | Pro | R$ 174 ($30) |
| Sentry | Business | R$ 464 ($80) |
| **Total infra** | | **R$ 5.568** |

### Resultado Marco 3

| Métrica | Valor |
|---------|-------|
| Receita bruta | R$ 1.557.950/mês |
| Taxa MP (4,98%) | -R$ 77.586/mês |
| Custo API | -R$ 113.955/mês |
| Custo infra | -R$ 5.568/mês |
| Equipe (5 pessoas) | -R$ 45.000/mês |
| Marketing | -R$ 20.000/mês |
| **Lucro líquido** | **R$ 1.295.841/mês (83%)** |
| MRR | R$ 1.548.000 |
| ARR | **R$ 18.576.000** |

### Ações neste marco
- [ ] Migrar para Kubernetes (AWS EKS / GCP GKE)
- [ ] Lançar app mobile (React Native/Expo)
- [ ] API pública (Shopify, WooCommerce, Nuvemshop)
- [ ] Contratar Head de Produto
- [ ] Negociar preços por volume com Google/Anthropic
- [ ] Marketplace de modelos virtuais (community-created)

---

## Marco 4 — 10.000 Usuários Pagantes (Liderança regional)

**Distribuição estimada:** 35% Essencial / 37% Pro / 20% Business / 8% Trial

| Plano | Usuários | Receita/mês | Camp/mês (60% uso) | Custo API/mês |
|-------|:--------:|:-----------:|:------------------:|:-------------:|
| Trial (pack único) | 800 | R$ 15.920 | 2.400 | R$ 2.568 |
| Essencial | 3.500 | R$ 626.500 | 31.500 | R$ 33.705 |
| Pro | 3.700 | R$ 1.328.300 | 88.800 | R$ 95.016 |
| Business | 2.000 | R$ 1.498.000 | 120.000 | R$ 128.400 |
| **Total** | **10.000** | **R$ 3.468.720** | **242.700** | **R$ 259.689** |

### Resultado Marco 4

| Métrica | Valor |
|---------|-------|
| Receita bruta | R$ 3.468.720/mês |
| Taxa MP (4,98%) | -R$ 172.742/mês |
| Custo API | -R$ 259.689/mês |
| Custo infra | -R$ 13.282/mês |
| Equipe (12 pessoas) | -R$ 130.000/mês |
| Marketing | -R$ 60.000/mês |
| Escritório + overhead | -R$ 25.000/mês |
| **Lucro líquido** | **R$ 2.808.007/mês (81%)** |
| MRR | R$ 3.453.000 |
| ARR | **R$ 41.436.000** |

---

## Marco 5 — 20.000 Usuários Pagantes (Líder de mercado)

**Distribuição estimada:** 30% Essencial / 40% Pro / 25% Business / 5% Trial

| Plano | Usuários | Receita/mês | Camp/mês (60% uso) | Custo API/mês |
|-------|:--------:|:-----------:|:------------------:|:-------------:|
| Trial (pack único) | 1.000 | R$ 19.900 | 3.000 | R$ 3.210 |
| Essencial | 6.000 | R$ 1.074.000 | 54.000 | R$ 57.780 |
| Pro | 8.000 | R$ 2.872.000 | 192.000 | R$ 205.440 |
| Business | 5.000 | R$ 3.745.000 | 300.000 | R$ 321.000 |
| **Total** | **20.000** | **R$ 7.710.900** | **549.000** | **R$ 587.430** |

### Resultado Marco 5

| Métrica | Valor |
|---------|-------|
| Receita bruta | R$ 7.710.900/mês |
| Taxa MP (4,98%) | -R$ 384.003/mês |
| Custo API | -R$ 587.430/mês |
| Custos operacionais (infra + equipe + mktg) | -R$ 500.000/mês |
| **Lucro líquido** | **R$ 6.239.467/mês (81%)** |
| MRR | R$ 7.691.000 |
| ARR | **R$ 92.292.000** |

---

## Resumo Visual de Crescimento

```
Pagantes    MRR              ARR               Margem
─────────   ─────────────    ──────────────    ──────
500         R$ 127.075       R$ 1.524.900      87%
1.500       R$ 417.195       R$ 5.006.340      84%
5.000       R$ 1.548.000     R$ 18.576.000     83%
10.000      R$ 3.453.000     R$ 41.436.000     81%
20.000      R$ 7.691.000     R$ 92.292.000     81%
```

---

## Roadmap de Infraestrutura por Marco

### Servidor / Compute

| Pagantes | Infra | Custo | Ações |
|----------|-------|-------|-------|
| 0–500 | **VPS 8GB** (atual) | R$ 150/mês | Self-hosted Next.js + Docker |
| 500–1.500 | VPS 16GB | R$ 300/mês | + Cloudflare Pro |
| 1.500–5.000 | AWS EKS / GKE | $400/mês | Kubernetes, auto-scale |
| 5.000–10.000 | AWS multi-AZ | $1.000/mês | Load balancer, ElastiCache |
| 10.000+ | Multi-region | $2.000+/mês | CDN global, edge functions |

### Supabase

| Pagantes | Plano | Custo |
|----------|-------|-------|
| 0–500 | Pro | $25/mês |
| 500–1.500 | Pro + Compute addon | $50/mês |
| 1.500–5.000 | Pro + Large compute | $100/mês |
| 5.000–10.000 | Team | $440/mês |
| 10.000+ | Enterprise | Negociar |

### Clerk (Autenticação)

| Pagantes | Plano | Custo |
|----------|-------|-------|
| 0–500 | Pro (2.5k MAU) | $25/mês |
| 500–5.000 | Pro (25k MAU) | $75/mês |
| 5.000–10.000 | Enterprise | $200/mês |

### Inngest (Background Jobs)

| Pagantes | Plano | Custo | Execuções/mês |
|----------|-------|-------|:-------------:|
| 0–500 | Hobby | $0/mês | ~12k |
| 500–1.500 | Pro | $25/mês | ~40k |
| 1.500–5.000 | Pro | $75/mês | ~150k |
| 5.000–10.000 | Pro | $150/mês | ~350k |
| 10.000+ | Pro | $300/mês | ~800k |

---

## Funcionalidades Implementadas (Abril/2026)

| Feature | Status |
|---------|--------|
| Pipeline IA texto (7 etapas) | ✅ Produção |
| Virtual Try-On com QA visual | ✅ Produção |
| Modelos virtuais personalizados | ✅ Produção |
| Background jobs assíncronos (Inngest) | ✅ Produção |
| Storage GC automático (cron diário) | ✅ Produção |
| Pagamentos Mercado Pago (assinatura + avulso) | ✅ Produção |
| Trial pack R$ 19,90 (3 campanhas + 1 modelo) | ✅ Produção |
| Créditos avulsos (campanhas + modelos) | ✅ Produção |
| Webhook MP com idempotência | ✅ Produção |
| Admin panel (lojas, modelos, backdrops, GC) | ✅ Produção |
| Dark mode | ✅ Produção |
| Rate limiting por IP | ✅ Produção |
| Quota enforcement (429 QUOTA_EXCEEDED) | ✅ Produção |
| Loading guard anti-flash (storeChecked) | ✅ Produção |
| Polling pós-pagamento (30s) | ✅ Produção |
| NO_STORE guard em todas as rotas protegidas | ✅ Produção |

---

## Roadmap de Produto (próximas versões)

### Fase 1 — Retenção e Conversão (pós-lançamento)
- [ ] Upsell automático via WhatsApp quando 80% do limite atingido
- [ ] Programa de indicação (quem indica: +3 campanhas / quem chega: +2 campanhas)
- [ ] Relatório mensal por email (campanhas geradas, score médio, dica personalizada)
- [ ] Plano anual com desconto 17% (2 meses grátis) — Mercado Pago subscription anual

### Fase 2 — Expansão de Produto (Marco 1→2)
- [ ] Publicação direta no Instagram via Meta Graph API (plano Pro+)
- [ ] Compartilhamento WhatsApp 1-click
- [ ] Carrossel inteligente (smart batching: múltiplas fotos → carrossel formatado)
- [ ] Canvas editor nativo (Fabric.js) para sobreposição de preços e selos

### Fase 3 — Plataforma (Marco 2→3)
- [ ] API pública (Shopify, WooCommerce, Nuvemshop)
- [ ] Marketplace de modelos virtuais (community-created)
- [ ] App mobile (React Native/Expo)
- [ ] Casting Manager (modelos fixas por loja — auto-rotação)

### Fase 4 — Enterprise (Marco 3+)
- [ ] Plano Enterprise (campanhas ilimitadas, SLA 99.9%, white-label)
- [ ] SAML SSO para redes de lojas
- [ ] API white-label para agências
- [ ] Multi-região (LATAM)

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|:-------:|----------|
| Google aumentar preço Gemini | Alto | Cache agressivo, Batch API, negociar volume |
| Anthropic aumentar preço Claude | Médio | Copywriter tem fallback Gemini (implementável) |
| Churn alto no Trial | Médio | Melhorar onboarding, follow-up WhatsApp |
| Concorrente grande (Canva AI) | Alto | Foco no nicho moda BR, integrações locais (MP, WPP) |
| VPS 8GB atingir limite de CPU | Médio | Inngest já desacopla geração; migrar para cluster ao atingir 500 usuários |
| LGPD / regulação | Médio | Política de privacidade ativa, DPO |
| Inadimplência Mercado Pago | Baixo | Webhook de cancelamento automático → downgrade para grátis |
| Câmbio USD/BRL disparar | Médio | Cron diário de câmbio + alerta no admin |
| Storage excessivo | Baixo | GC automático já implementado (purge >25 dias) |
| Inngest downtime | Baixo | Retry nativo + backoff automático |
| Webhook MP duplicado | Baixo | Idempotência via `mercadopago_payment_id` em `credit_purchases` |

---

## Métricas de Sucesso (North Stars)

| Métrica | Meta Ano 1 | Meta Ano 2 | Meta Ano 3 |
|---------|:----------:|:----------:|:----------:|
| Usuários pagantes | 1.500 | 5.000 | 15.000 |
| MRR | R$ 417k | R$ 1.548k | R$ 5M |
| Churn mensal (Essencial) | < 10% | < 7% | < 5% |
| Churn mensal (Pro) | < 6% | < 4% | < 3% |
| Churn mensal (Business) | < 4% | < 3% | < 2% |
| NPS | > 40 | > 55 | > 65 |
| Conversão Trial→Plano | 30% | 40% | 50% |
| Upgrade Essencial→Pro | 15% | 20% | 25% |
| Tempo médio geração | < 45s | < 30s | < 20s |
| CAC | R$ 35 | R$ 28 | R$ 22 |
| LTV Essencial (12m) | R$ 2.148 | R$ 2.868 | R$ 3.588 |
| LTV Pro (12m) | R$ 4.308 | R$ 5.748 | R$ 7.188 |
| LTV Business (12m) | R$ 8.988 | R$ 11.988 | R$ 14.988 |
| LTV/CAC médio | 30x | 60x | 100x |

---

*Documento definitivo — substituí plano_negocio.md e evolution_roadmap.md anteriores.*
*Preços e limites auditados diretamente de `campanha-ia/src/lib/plans.ts` em 14/04/2026.*
*VPS atual: 8GB RAM, self-hosted, Docker + Next.js.*
