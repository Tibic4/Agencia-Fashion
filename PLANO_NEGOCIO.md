# 📊 CriaLook — Plano de Negócio por Faixa de Crescimento

> Última atualização: Abril/2026
> Moeda: BRL (R$) | Câmbio estimado: US$ 1 = R$ 5,50

---

## 💰 Tabela de Planos CriaLook

| Plano      | Preço/mês | Campanhas/mês | Try-On | Público-alvo               |
|------------|-----------|---------------|--------|-----------------------------|
| Grátis     | R$ 0      | 3             | ❌     | Teste / onboarding          |
| Starter    | R$ 59     | 15            | ❌     | Lojista pequena (Instagram) |
| Pro        | R$ 129    | 40            | ✅     | Loja média / multi-canal    |
| Business   | R$ 249    | 100           | ✅     | Loja grande / e-commerce    |
| Agência    | R$ 499    | 200           | ✅     | Agência de marketing        |

---

## 📐 Premissas do Modelo

### Distribuição estimada de planos por fase

| Fase        | Grátis | Starter | Pro  | Business | Agência |
|-------------|--------|---------|------|----------|---------|
| Início      | 60%    | 20%     | 12%  | 6%       | 2%      |
| Crescimento | 40%    | 25%     | 20%  | 10%      | 5%      |
| Maturidade  | 25%    | 25%     | 25%  | 15%      | 10%     |

### Custo por campanha gerada (APIs)
| Serviço      | Custo/campanha | Detalhes                           |
|--------------|----------------|------------------------------------|
| Anthropic    | ~R$ 0,25       | Claude Sonnet 4 (4 chamadas/pipeline) |
| Fashn.ai     | ~R$ 0,40       | Try-on virtual ($0.07/call)        |
| fal.ai       | ~R$ 0,15       | Fallback IDM-VTON                  |
| **Total s/ try-on** | **~R$ 0,25** | Apenas copy (planos Grátis/Starter) |
| **Total c/ try-on** | **~R$ 0,65** | Copy + try-on (planos Pro+)        |

### Uso médio por usuário/mês (campanhas geradas)
| Plano    | Limite | Uso médio estimado |
|----------|--------|--------------------|
| Grátis   | 3      | 2                  |
| Starter  | 15     | 8                  |
| Pro      | 40     | 20                 |
| Business | 100    | 45                 |
| Agência  | 200    | 80                 |

---

## 🟢 Marco 1 — 1.000 Usuários (MVP validado)

### Distribuição: Fase Início (60/20/12/6/2)

| Plano    | Usuários | Receita/mês     | Campanhas/mês | Custo API/mês |
|----------|----------|-----------------|---------------|---------------|
| Grátis   | 600      | R$ 0            | 1.200         | R$ 300        |
| Starter  | 200      | R$ 11.800       | 1.600         | R$ 400        |
| Pro      | 120      | R$ 15.480       | 2.400         | R$ 1.560      |
| Business | 60       | R$ 14.940       | 2.700         | R$ 1.755      |
| Agência  | 20       | R$ 9.980        | 1.600         | R$ 1.040      |
| **Total**| **1.000**| **R$ 52.200**   | **9.500**     | **R$ 5.055**  |

### Infraestrutura necessária

| Serviço         | Plano                | Custo/mês   |
|-----------------|----------------------|-------------|
| Supabase        | Pro                  | R$ 138 ($25)|
| Clerk           | Pro (5k MAU)         | R$ 138 ($25)|
| VPS (KingHost)  | VPS 4GB              | R$ 90       |
| Domínio + SSL   | crialook.com.br      | R$ 8        |
| Sentry          | Team                 | R$ 145 ($26)|
| PostHog         | Free (1M events)     | R$ 0        |
| **Total infra** |                      | **R$ 519**  |

### 📊 Resultado Marco 1

| Métrica           | Valor          |
|-------------------|----------------|
| Receita bruta     | R$ 52.200/mês  |
| Custo API         | R$ 5.055/mês   |
| Custo infra       | R$ 519/mês     |
| **Margem bruta**  | **R$ 46.626/mês (89%)** |
| MRR               | R$ 52.200      |
| ARR               | R$ 626.400     |

### ✅ Ações neste marco
- [ ] Contratar 1 pessoa de suporte/CS
- [ ] Migrar VPS para 8GB RAM
- [ ] Implementar cache de resultados (Redis)
- [ ] Criar programa de indicação (R$ 10 de desconto)

---

## 🔵 Marco 2 — 2.000 Usuários (Product-Market Fit)

### Distribuição: Transição (50/22/16/8/4)

| Plano    | Usuários | Receita/mês     | Campanhas/mês | Custo API/mês |
|----------|----------|-----------------|---------------|---------------|
| Grátis   | 1.000    | R$ 0            | 2.000         | R$ 500        |
| Starter  | 440      | R$ 25.960       | 3.520         | R$ 880        |
| Pro      | 320      | R$ 41.280       | 6.400         | R$ 4.160      |
| Business | 160      | R$ 39.840       | 7.200         | R$ 4.680      |
| Agência  | 80       | R$ 39.920       | 6.400         | R$ 4.160      |
| **Total**| **2.000**| **R$ 147.000**  | **25.520**    | **R$ 14.380** |

### Infraestrutura necessária

| Serviço         | Plano                | Custo/mês     |
|-----------------|----------------------|---------------|
| Supabase        | Pro + compute addon  | R$ 275 ($50)  |
| Clerk           | Pro (10k MAU)        | R$ 275 ($50)  |
| VPS             | Dedicado 8GB         | R$ 180        |
| CDN (Cloudflare)| Pro                  | R$ 110 ($20)  |
| Sentry          | Team                 | R$ 145 ($26)  |
| PostHog         | Free                 | R$ 0          |
| Redis (Upstash) | Pay-as-you-go        | R$ 55 ($10)   |
| **Total infra** |                      | **R$ 1.040**  |

### 📊 Resultado Marco 2

| Métrica           | Valor            |
|-------------------|------------------|
| Receita bruta     | R$ 147.000/mês   |
| Custo API         | R$ 14.380/mês    |
| Custo infra       | R$ 1.040/mês     |
| Equipe (2 pessoas)| R$ 12.000/mês    |
| **Margem bruta**  | **R$ 119.580/mês (81%)** |
| MRR               | R$ 147.000       |
| ARR               | R$ 1.764.000     |

### ✅ Ações neste marco
- [ ] Contratar dev frontend (part-time)
- [ ] Migrar para servidor dedicado
- [ ] Implementar API de Try-On própria (reduz custo 50%)
- [ ] Criar templates de campanhas por nicho
- [ ] Lançar app mobile (React Native/Expo)

---

## 🟣 Marco 3 — 5.000 Usuários (Escala)

### Distribuição: Crescimento (40/25/20/10/5)

| Plano    | Usuários | Receita/mês      | Campanhas/mês | Custo API/mês |
|----------|----------|------------------|---------------|---------------|
| Grátis   | 2.000    | R$ 0             | 4.000         | R$ 1.000      |
| Starter  | 1.250    | R$ 73.750        | 10.000        | R$ 2.500      |
| Pro      | 1.000    | R$ 129.000       | 20.000        | R$ 13.000     |
| Business | 500      | R$ 124.500       | 22.500        | R$ 14.625     |
| Agência  | 250      | R$ 124.750       | 20.000        | R$ 13.000     |
| **Total**| **5.000**| **R$ 452.000**   | **76.500**    | **R$ 44.125** |

### Infraestrutura necessária

| Serviço         | Plano                  | Custo/mês      |
|-----------------|------------------------|----------------|
| Supabase        | Pro + Large compute    | R$ 550 ($100)  |
| Clerk           | Pro (25k MAU)          | R$ 413 ($75)   |
| Cloud (AWS/GCP) | k8s cluster            | R$ 2.200 ($400)|
| CDN (Cloudflare)| Business               | R$ 1.100 ($200)|
| Sentry          | Business               | R$ 440 ($80)   |
| PostHog         | Growth                 | R$ 248 ($45)   |
| Redis (Upstash) | Pro                    | R$ 165 ($30)   |
| **Total infra** |                        | **R$ 5.116**   |

### 📊 Resultado Marco 3

| Métrica            | Valor              |
|--------------------|---------------------|
| Receita bruta      | R$ 452.000/mês      |
| Custo API          | R$ 44.125/mês       |
| Custo infra        | R$ 5.116/mês        |
| Equipe (5 pessoas) | R$ 45.000/mês       |
| Marketing          | R$ 15.000/mês       |
| **Lucro líquido**  | **R$ 342.759/mês (76%)** |
| MRR                | R$ 452.000          |
| ARR                | R$ 5.424.000        |

### ✅ Ações neste marco
- [ ] Migrar para Kubernetes (AWS EKS / GCP GKE)
- [ ] Treinar modelo de Try-On próprio (reduz custo 80%)
- [ ] Lançar marketplace de templates
- [ ] API pública para integrações (Shopify, WooCommerce, Nuvemshop)
- [ ] Contratar Head de Produto
- [ ] Abrir programa de afiliados

---

## 🟡 Marco 4 — 10.000 Usuários (Liderança regional)

### Distribuição: Crescimento (35/25/22/12/6)

| Plano    | Usuários | Receita/mês      | Campanhas/mês | Custo API/mês  |
|----------|----------|------------------|---------------|----------------|
| Grátis   | 3.500    | R$ 0             | 7.000         | R$ 1.750       |
| Starter  | 2.500    | R$ 147.500       | 20.000        | R$ 5.000       |
| Pro      | 2.200    | R$ 283.800       | 44.000        | R$ 28.600      |
| Business | 1.200    | R$ 298.800       | 54.000        | R$ 35.100      |
| Agência  | 600      | R$ 299.400       | 48.000        | R$ 31.200      |
| **Total**| **10.000**| **R$ 1.029.500**| **173.000**   | **R$ 101.650** |

### Infraestrutura necessária

| Serviço              | Plano               | Custo/mês        |
|----------------------|----------------------|------------------|
| Supabase             | Team / Enterprise    | R$ 2.420 ($440)  |
| Clerk                | Enterprise           | R$ 1.100 ($200)  |
| Cloud (AWS)          | Multi-AZ cluster     | R$ 5.500 ($1000) |
| CDN                  | Business             | R$ 1.100 ($200)  |
| Monitoramento        | Stack completo       | R$ 1.650 ($300)  |
| Modelo próprio (GPU) | 2x A10G              | R$ 4.400 ($800)  |
| **Total infra**      |                      | **R$ 16.170**    |

### 📊 Resultado Marco 4

| Métrica               | Valor                 |
|------------------------|-----------------------|
| Receita bruta          | R$ 1.029.500/mês      |
| Custo API              | R$ 101.650/mês        |
| Custo infra            | R$ 16.170/mês         |
| Equipe (12 pessoas)    | R$ 120.000/mês        |
| Marketing              | R$ 50.000/mês         |
| Escritório + overhead  | R$ 20.000/mês         |
| **Lucro líquido**      | **R$ 721.680/mês (70%)** |
| MRR                    | R$ 1.029.500          |
| ARR                    | **R$ 12.354.000**     |

### ✅ Ações neste marco
- [ ] Constituir empresa S.A. (preparar para investimento)
- [ ] Abrir escritório em SP
- [ ] Lançar CriaLook em outros países (LATAM)
- [ ] API White-label para agências
- [ ] Negociar preços por volume com Anthropic/provedores

---

## 🔴 Marco 5 — 15.000 Usuários (Expansão LATAM)

### Distribuição: Maturidade (30/25/23/13/9)

| Plano    | Usuários | Receita/mês      | Campanhas/mês | Custo API/mês  |
|----------|----------|------------------|---------------|----------------|
| Grátis   | 4.500    | R$ 0             | 9.000         | R$ 2.250       |
| Starter  | 3.750    | R$ 221.250       | 30.000        | R$ 7.500       |
| Pro      | 3.450    | R$ 445.050       | 69.000        | R$ 44.850      |
| Business | 1.950    | R$ 485.550       | 87.750        | R$ 57.038      |
| Agência  | 1.350    | R$ 673.650       | 108.000       | R$ 70.200      |
| **Total**| **15.000**| **R$ 1.825.500**| **303.750**   | **R$ 181.838** |

### 📊 Resultado Marco 5

| Métrica               | Valor                  |
|------------------------|------------------------|
| Receita bruta          | R$ 1.825.500/mês       |
| Custos operacionais    | R$ 500.000/mês         |
| **Lucro líquido**      | **R$ 1.325.500/mês (73%)** |
| ARR                    | **R$ 21.906.000**      |

---

## ⚫ Marco 6 — 20.000 Usuários (Líder de mercado)

### Distribuição: Maturidade (25/25/25/15/10)

| Plano    | Usuários | Receita/mês       | Campanhas/mês | Custo API/mês  |
|----------|----------|--------------------|---------------|----------------|
| Grátis   | 5.000    | R$ 0              | 10.000        | R$ 2.500       |
| Starter  | 5.000    | R$ 295.000        | 40.000        | R$ 10.000      |
| Pro      | 5.000    | R$ 645.000        | 100.000       | R$ 65.000      |
| Business | 3.000    | R$ 747.000        | 135.000       | R$ 87.750      |
| Agência  | 2.000    | R$ 998.000        | 160.000       | R$ 104.000     |
| **Total**| **20.000**| **R$ 2.685.000** | **445.000**   | **R$ 269.250** |

### 📊 Resultado Marco 6

| Métrica               | Valor                  |
|------------------------|------------------------|
| Receita bruta          | R$ 2.685.000/mês       |
| Custos operacionais    | R$ 700.000/mês         |
| **Lucro líquido**      | **R$ 1.985.000/mês (74%)** |
| MRR                    | R$ 2.685.000           |
| ARR                    | **R$ 32.220.000**      |

---

## 📈 Resumo Visual de Crescimento

```
Usuários    MRR             ARR              Margem
─────────   ──────────────  ───────────────  ──────
1.000       R$ 52.200       R$ 626.400       89%
2.000       R$ 147.000      R$ 1.764.000     81%
5.000       R$ 452.000      R$ 5.424.000     76%
10.000      R$ 1.029.500    R$ 12.354.000    70%
15.000      R$ 1.825.500    R$ 21.906.000    73%
20.000      R$ 2.685.000    R$ 32.220.000    74%
```

---

## 🏗️ Roadmap de Infraestrutura por Marco

### Supabase
| Usuários | Plano     | Custo      | Ações                               |
|----------|-----------|------------|--------------------------------------|
| 1.000    | Pro       | $25/mês    | Banco único, connection pooling      |
| 2.000    | Pro+      | $50/mês    | Compute addon, read replicas         |
| 5.000    | Pro+      | $100/mês   | Large compute, caching layer         |
| 10.000   | Team      | $440/mês   | Dedicated compute, PITR backup       |
| 20.000   | Enterprise| Negociar   | Dedicated cluster, SLA 99.9%         |

### Clerk (Autenticação)
| Usuários | Plano      | Custo     | Ações                               |
|----------|------------|-----------|--------------------------------------|
| 1.000    | Pro        | $25/mês   | SSO padrão, rate limiting            |
| 5.000    | Pro        | $75/mês   | Custom domain, branding              |
| 10.000   | Enterprise | $200/mês  | SAML SSO, audit logs, SLA            |

### Servidor / Cloud
| Usuários | Infra              | Custo       | Ações                          |
|----------|--------------------|-------------|--------------------------------|
| 1.000    | VPS 4GB (KingHost) | R$ 90/mês   | PM2, Nginx, SSL                |
| 2.000    | Dedicado 8GB       | R$ 180/mês  | + Redis, CDN                   |
| 5.000    | AWS EKS / GKE      | $400/mês    | Kubernetes, auto-scale, multi-AZ|
| 10.000   | AWS multi-AZ       | $1000/mês   | Load balancer, RDS, ElastiCache|
| 20.000   | Multi-region       | $2000+/mês  | CDN global, edge functions     |

---

## ⚠️ Riscos e Mitigações

| Risco                          | Impacto | Mitigação                                    |
|--------------------------------|---------|----------------------------------------------|
| Anthropic aumentar preços      | Alto    | Cache agressivo, fine-tune modelo menor       |
| Churn alto em plano gratuito   | Médio   | Melhorar onboarding, trial do Pro por 7 dias  |
| Concorrente grande (Canva AI)  | Alto    | Nichos verticais (moda BR), integrações locais|
| Fashn.ai sair do ar            | Médio   | Fallback fal.ai já implementado ✅            |
| LGPD / regulação               | Médio   | Política de privacidade, DPO                  |
| Inadimplência Mercado Pago     | Baixo   | Webhook de cancelamento automático            |

---

## 🎯 Métricas de Sucesso (North Stars)

| Métrica                    | Meta Ano 1 | Meta Ano 2 | Meta Ano 3 |
|----------------------------|-----------|-----------|-----------|
| Usuários ativos            | 2.000     | 10.000    | 20.000    |
| MRR                        | R$ 147k   | R$ 1.03M  | R$ 2.68M  |
| Churn mensal               | < 8%      | < 5%      | < 3%      |
| NPS                        | > 40      | > 55      | > 65      |
| Campanhas/dia              | 850       | 5.700     | 14.800    |
| Tempo médio de geração     | < 15s     | < 10s     | < 8s      |
| CAC (Custo de Aquisição)   | R$ 30     | R$ 25     | R$ 20     |
| LTV (Lifetime Value)       | R$ 400    | R$ 700    | R$ 1.200  |
| LTV/CAC                    | 13x       | 28x       | 60x       |

---

*Documento vivo — atualizar a cada marco atingido.*
