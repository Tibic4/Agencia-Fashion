# 📋 CriaLook — Documentação Técnica Consolidada

> **Versão:** 1.0 — 06/04/2026  
> **Domínio:** crialook.com.br  
> **Repo:** github.com/Tibic4/Agencia-Fashion  
> **Supabase Project:** `emybirklqhonqodzyzet` (sa-east-1, São Paulo)

---

## 1. VISÃO GERAL DO PRODUTO

**CriaLook** é um SaaS de geração de campanhas de marketing com IA, focado em **moda**. O lojista envia uma foto do produto + preço e recebe em ~30 segundos:

- Textos prontos para Instagram Feed, Stories, WhatsApp e Meta Ads
- Try-on virtual (roupa vestida em modelo)
- Composição visual de criativos (Konva.js)
- Score de qualidade + compliance Meta Ads

### Público-alvo
Lojistas de moda brasileiros (PME), vendedores de Instagram/WhatsApp, classes B/C/D.

### Modelo de Negócio
- **Planos mensais** (assinatura via Mercado Pago)
- **Créditos avulsos** (compra adicional via Mercado Pago)
- **❌ NÃO existe plano grátis** — entrada é o pack R$ 9,90 (5 campanhas)

---

## 2. STACK TECNOLÓGICA

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Framework** | Next.js (App Router) | 16.x |
| **Linguagem** | TypeScript | 5.x |
| **Estilização** | Tailwind CSS | v4 |
| **Banco de dados** | Supabase (PostgreSQL) | — |
| **Autenticação** | Clerk | @clerk/nextjs v7 |
| **Pagamentos** | Mercado Pago | mercadopago v2 |
| **IA Texto** | Anthropic (Claude) | @anthropic-ai/sdk v0.52 |
| **IA Texto (fallback)** | Google Gemini | @google/genai v1.5 |
| **Try-on (core)** | Fashn.ai | REST API |
| **Try-on (fallback)** | fal.ai (IDM-VTON) | @fal-ai/client v1.3 |
| **Composição visual** | Konva.js | konva v9 + react-konva v18 |
| **Jobs assíncronos** | Inngest | inngest v4 |
| **Monitoramento erros** | Sentry | @sentry/nextjs v10 |
| **Analytics** | PostHog | posthog-js v1.234 |
| **Hosting** | VPS KingHost | PM2 + Nginx + Certbot |
| **Ícones** | Lucide React | v0.503 |
| **State (forms)** | Zustand | v5 |
| **Validação** | Zod | v3 |
| **Gráficos (admin)** | Recharts | v2 |

---

## 3. ESTRUTURA DO PROJETO

```
Agencia-Fashion/
├── campanha-ia/                    ← Projeto Next.js principal
│   ├── src/
│   │   ├── app/                    ← App Router (páginas e rotas API)
│   │   │   ├── page.tsx            ← Landing page (/)
│   │   │   ├── sign-in/            ← /sign-in (Clerk)
│   │   │   ├── sign-up/            ← /sign-up (Clerk)
│   │   │   ├── onboarding/         ← /onboarding
│   │   │   ├── sobre/              ← /sobre
│   │   │   ├── termos/             ← /termos
│   │   │   ├── privacidade/        ← /privacidade
│   │   │   ├── preview/            ← /preview
│   │   │   ├── test-konva/         ← /test-konva (compositor visual)
│   │   │   ├── (auth)/             ← Rotas protegidas (requer login)
│   │   │   │   ├── gerar/          ← /gerar (geração de campanha)
│   │   │   │   ├── historico/      ← /historico
│   │   │   │   ├── modelo/         ← /modelo (modelo virtual)
│   │   │   │   ├── plano/          ← /plano (planos + créditos)
│   │   │   │   ├── configuracoes/  ← /configuracoes
│   │   │   │   └── admin/          ← /admin (dashboard admin)
│   │   │   └── api/                ← Rotas API
│   │   │       ├── admin/          ← Stats, custos, clientes
│   │   │       ├── campaign/       ← Gerar, status
│   │   │       ├── campaigns/      ← Listar campanhas
│   │   │       ├── checkout/       ← Checkout Mercado Pago
│   │   │       ├── credits/        ← Compra de créditos avulsos
│   │   │       ├── health/         ← Health check
│   │   │       ├── inngest/        ← Webhook Inngest
│   │   │       ├── model/          ← Criar/selecionar modelo
│   │   │       ├── models/         ← Listar modelos
│   │   │       ├── showcase/       ← Vitrine antes/depois
│   │   │       ├── store/          ← Dados da loja
│   │   │       ├── v1/             ← API versioned
│   │   │       └── webhooks/       ← Webhooks
│   │   │           └── mercadopago/ ← IPN Mercado Pago
│   │   ├── components/             ← Componentes React
│   │   ├── lib/                    ← Bibliotecas internas
│   │   │   ├── ai/                 ← Pipeline IA (anthropic, config, prompts)
│   │   │   ├── supabase/           ← Clients (browser, server, admin)
│   │   │   ├── fashn/              ← Fashn.ai integration
│   │   │   ├── fal/                ← fal.ai fallback
│   │   │   ├── google/             ← Google Gemini fallback
│   │   │   ├── payments/           ← Mercado Pago helpers
│   │   │   └── db/                 ← Database helpers (index.ts)
│   │   └── types/                  ← TypeScript interfaces
│   ├── public/                     ← Assets estáticos
│   ├── .env.example                ← Template de variáveis
│   ├── package.json
│   ├── next.config.ts
│   └── tailwind.config.ts
├── CRIALOOK_DOC.md                 ← ESTE DOCUMENTO (fonte de verdade)
├── CUSTOS_PLANOS.md                ← Detalhamento de custos e margens
└── CHECKPOINTS.md                  ← Progresso do projeto
```

---

## 4. BANCO DE DADOS (Supabase PostgreSQL)

### 4.1 Diagrama de Relacionamentos

```
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│  plans   │◄────│    stores     │────►│   store_usage    │
│ (5 rows) │     │ (lojas)       │     │ (uso mensal)     │
└──────────┘     └───────┬───────┘     └──────────────────┘
                         │
              ┌──────────┼──────────┬──────────────┐
              │          │          │              │
              ▼          ▼          ▼              ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
        │campaigns │ │ store  │ │  api     │ │   credit     │
        │          │ │ models │ │ cost_logs│ │  purchases   │
        └────┬─────┘ └────────┘ └──────────┘ └──────────────┘
             │
     ┌───────┼───────┐
     ▼               ▼
┌──────────┐  ┌──────────────┐
│ campaign │  │  campaign    │
│ outputs  │  │  scores      │
└──────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  model_bank  │  │showcase_items│  │admin_settings│
│ (20 modelos) │  │ (vitrine)    │  │ (16 configs) │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 4.2 Tabelas Detalhadas

> **RLS** está ativado em **todas** as tabelas.

#### `plans` — Planos de assinatura (5 rows)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | ID do plano |
| `name` | text (unique) | Identificador: free, starter, pro, business, agencia |
| `display_name` | text | Nome exibido: "Starter", "Pro", etc. |
| `price_monthly` | numeric | Preço mensal em BRL |
| `mercadopago_plan_id` | text? | ID do plano no Mercado Pago |
| `campaigns_per_month` | int | Limite de campanhas/mês |
| `channels_per_campaign` | int | Canais por campanha (default: 4) |
| `models_limit` | int | Limite de modelos salvos |
| `model_creations_per_month` | int | Criações de modelo/mês |
| `regenerations_per_campaign` | int | Regenerações por campanha |
| `history_days` | int | Dias de histórico |
| `score_level` | text | basic / detailed / full |
| `has_preview_link` | bool | Tem link de preview |
| `has_white_label` | bool | White label |
| `has_api_access` | bool | Acesso API |
| `support_channel` | text | email / whatsapp / dedicado |
| `is_active` | bool | Ativo para venda |
| `sort_order` | int | Ordem de exibição |

**Dados atuais dos planos:**

| Plano | Preço | Campanhas | Modelos | Regenerações | Ativo |
|-------|-------|-----------|---------|--------------|-------|
| ~~free~~ | R$ 0 | 3 | 0 | 0 | ❌ `false` |
| starter | R$ 59 | 15 | 1 | 2 | ✅ |
| pro | R$ 129 | 40 | 3 | 3 | ✅ |
| business | R$ 249 | 85 | 5 | 5 | ✅ |
| agencia | R$ 499 | 200 | 10 | 10 | ✅ |

---

#### `stores` — Lojas dos clientes
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | — |
| `clerk_user_id` | text (unique) | ID do Clerk |
| `name` | text | Nome da loja |
| `segment_primary` | text | Segmento moda (moda_feminina, etc.) |
| `segments_secondary` | text[] | Segmentos adicionais |
| `city`, `state` | text? | Localização |
| `logo_url` | text? | URL do logo |
| `instagram_handle` | text? | @ do Instagram |
| `brand_colors` | jsonb | Cores da marca |
| `plan_id` | uuid (FK → plans) | Plano ativo |
| `mercadopago_customer_id` | text? | ID cliente Mercado Pago |
| `mercadopago_subscription_id` | text? | ID assinatura Mercado Pago |
| `onboarding_completed` | bool | Completou onboarding? |
| `credit_campaigns` | int | Créditos avulsos de campanha |
| `credit_models` | int | Créditos avulsos de modelo |
| `credit_regenerations` | int | Créditos avulsos de regeneração |

---

#### `campaigns` — Campanhas geradas
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | — |
| `store_id` | uuid (FK → stores) | Loja |
| `product_photo_url` | text | URL da foto |
| `product_photo_storage_path` | text | Caminho no storage |
| `price` | numeric | Preço do produto |
| `target_audience` | text? | Público-alvo |
| `objective` | text | venda_imediata, lancamento, promocao, engajamento |
| `tone_override` | text? | Tom customizado |
| `channels` | text[] | Canais selecionados |
| `use_model` | bool | Usar try-on |
| `model_id` | uuid? (FK → store_models) | Modelo custom |
| `model_bank_id` | uuid? (FK → model_bank) | Modelo stock |
| `product_type` | varchar? | Tipo de peça (blusa, saia, vestido, etc.) |
| `status` | text | pending → processing → completed / failed |
| `pipeline_step` | text | Etapa atual |
| `pipeline_started_at` | timestamptz | Início |
| `pipeline_completed_at` | timestamptz | Fim |
| `pipeline_duration_ms` | int | Duração total |
| `error_message` | text? | Mensagem de erro |
| `retry_count` | int | Tentativas |
| `generation_number` | int | Número da geração (regeneração) |
| `parent_campaign_id` | uuid? (self-FK) | Campanha original |
| `is_archived` | bool | Arquivada |

---

#### `campaign_outputs` — Textos e URLs gerados
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | — |
| `campaign_id` | uuid (FK → campaigns) | — |
| `vision_analysis` | jsonb | Análise visual completa |
| `strategy` | jsonb | Estratégia de marketing |
| `headline_principal` | text | Headline principal |
| `headline_variacao_1`, `_2` | text? | Variações de headline |
| `instagram_feed` | text | Legenda Instagram Feed |
| `instagram_stories` | jsonb | Stories (3 slides) |
| `whatsapp` | text | Mensagem WhatsApp |
| `meta_ads` | jsonb | Headline + texto primário |
| `hashtags` | text[] | Hashtags sugeridas |
| `product_image_clean_url` | text? | Produto sem fundo |
| `model_image_url` | text? | Try-on resultado |
| `creative_feed_url` | text? | Criativo feed |
| `creative_stories_url` | text? | Criativo stories |
| `refinements` | jsonb | Refinamentos aplicados |

---

#### `campaign_scores` — Avaliação de qualidade
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `nota_geral` | int | Score geral (0-100) |
| `conversao` | int | Score de conversão |
| `clareza` | int | Clareza da mensagem |
| `urgencia` | int | Urgência percebida |
| `naturalidade` | int | Quão humano soa |
| `aprovacao_meta` | int | Chance de aprovação Meta |
| `nivel_risco` | text | baixo / medio / alto / critico |
| `pontos_fortes` | jsonb | Array de pontos fortes |
| `melhorias` | jsonb | Array de sugestões |
| `alertas_meta` | jsonb? | Alertas de compliance |

---

#### `store_models` — Modelos virtuais customizados (por loja)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `store_id` | uuid (FK → stores) | Dono |
| `name` | text | Nome do modelo |
| `skin_tone` | text | Tom de pele |
| `hair_style` | text | Estilo de cabelo |
| `body_type` | text | normal / plus_size |
| `style` | text | Estilo de vestimenta |
| `age_range` | text | Faixa etária |
| `fashn_model_id` | text? | ID no Fashn.ai |
| `preview_url` | text? | Foto preview |
| `reference_photos` | text[] | Fotos de referência |

---

#### `model_bank` — Modelos stock (20 modelos pré-cadastrados)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `name` | varchar | Nome do modelo |
| `body_type` | varchar | normal ou plus_size (check constraint) |
| `skin_tone` | varchar | Tom de pele |
| `pose` | varchar | Pose (default: standing) |
| `image_url` | text | URL da imagem |
| `thumbnail_url` | text? | Thumbnail |
| `fashn_job_id` | varchar? | Job Fashn |
| `is_active` | bool | Ativo |

**Distribuição atual:** 10 modelos `normal` + 10 modelos `plus_size`

---

#### `store_usage` — Consumo mensal por loja
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `store_id` | uuid (FK) | Loja |
| `period_start`, `period_end` | date | Período |
| `campaigns_generated` | int | Campanhas usadas |
| `campaigns_limit` | int | Limite do plano |
| `regenerations_used` | int | Regenerações usadas |
| `models_created` | int | Modelos criados |
| `total_api_cost` | numeric | Custo API total |

---

#### `api_cost_logs` — Log de custos por chamada API
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `provider` | text | anthropic, fashn, fal, google |
| `endpoint` | text | Nome do endpoint |
| `model` | text? | Modelo usado |
| `pipeline_step` | text? | Etapa do pipeline |
| `input_tokens`, `output_tokens` | int? | Tokens |
| `cost_usd`, `cost_brl` | numeric | Custo em USD e BRL |
| `exchange_rate` | numeric? | Câmbio usado |
| `response_time_ms` | int? | Tempo de resposta |
| `is_error` | bool | Foi erro? |

---

#### `credit_purchases` — Compras de créditos avulsos
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `store_id` | uuid (FK) | Loja |
| `type` | text | campaigns, models, regenerations |
| `quantity` | int | Quantidade comprada |
| `price_brl` | numeric | Valor pago |
| `mercadopago_payment_id` | text? | ID pagamento |
| `period_start`, `period_end` | date | Validade |
| `consumed` | int | Quantidade consumida |

---

#### `showcase_items` — Vitrine antes/depois (landing page)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `before_photo_url` | text | Foto antes |
| `after_photo_url` | text | Foto depois |
| `caption` | text? | Legenda |
| `is_active` | bool | Visível |
| `sort_order` | int | Ordem |

---

#### `admin_settings` — Configurações globais do sistema (16 registros)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `key` | text (PK) | Nome da config |
| `value` | jsonb | Valor |
| `description` | text? | Descrição |

---

## 5. PIPELINE DE IA

### 5.1 Fluxo Completo

```
FOTO + PREÇO (input do lojista)
        │
   ┌────▼────┐
   │ STEP 1  │  Vision Analyzer (claude-sonnet-4)
   │  ~3s    │  → Identifica produto, segmento, cor, mood
   └────┬────┘
        │ JSON: vision_analysis
   ┌────▼────┐
   │ STEP 2  │  Estrategista (claude-sonnet-4)
   │  ~4s    │  → Ângulo, gatilho, tom, CTA
   └────┬────┘
        │ JSON: strategy
   ┌────▼────┐
   │ STEP 3  │  Copywriter (claude-sonnet-4)
   │  ~5s    │  → Textos para 4 canais
   └────┬────┘
        │ JSON: copy
   ┌────▼────┐
   │ STEP 4  │  Refinador (claude-sonnet-4)
   │  ~3s    │  → Humaniza, corta gordura, fortalece CTA
   └────┬────┘
        │ JSON: refined_copy
   ┌────▼────┐
   │ STEP 5  │  Scorer + Meta Compliance (claude-sonnet-4)
   │  ~3s    │  → Nota 0-100, alertas Meta Ads
   └────┬────┘
        │
   ┌────▼────────────────────┐
   │ STEP 6 (browser-side)   │  Konva.js Compositor
   │ Composição de criativos │  → Overlay texto + preço + logo
   └─────────────────────────┘
```

**Tempo total:** 25-40 segundos  
**Custo total (texto):** ~R$ 0,33/campanha  
**Custo total (texto + try-on):** ~R$ 0,86/campanha

### 5.2 Modelos de IA em Uso

| Etapa | Modelo Padrão | Fallback | Custo/chamada |
|-------|--------------|----------|---------------|
| Vision Analyzer | claude-sonnet-4-20250514 | Google Gemini | R$ 0,08 |
| Estrategista | claude-sonnet-4-20250514 | Google Gemini | R$ 0,06 |
| Copywriter | claude-sonnet-4-20250514 | Google Gemini | R$ 0,10 |
| Refinador | claude-sonnet-4-20250514 | Google Gemini | R$ 0,05 |
| Scorer | claude-sonnet-4-20250514 | Google Gemini | R$ 0,04 |
| Try-on | Fashn.ai | fal.ai (IDM-VTON) | R$ 0,43 / R$ 0,20 |

> **Nota:** Todos os modelos usam `claude-sonnet-4-20250514` como padrão (configurável via env `AI_MODEL_*`). O Google Gemini (`@google/genai`) é o fallback para o pipeline de texto.

### 5.3 Tratamento de Erros

| Erro | Retry | Fallback | Ação |
|------|-------|----------|------|
| JSON inválido do LLM | 2x | Re-prompt sem markdown | Log + retry |
| LLM timeout > 30s | 1x | Google Gemini | Log + retry |
| Fashn.ai indisponível | Não | fal.ai IDM-VTON | Degradação com alerta |
| Score < 40 | Não | Re-executa Copywriter+Refiner (temp 0.9) | Auto-retry |
| Upload falha | 2x | — | Erro para usuário |

### 5.4 Tipos de Produto (Fashn Categories)

| Tipo | Categoria Fashn |
|------|----------------|
| blusa, regata, top, jaqueta | `tops` |
| saia, calça, shorts | `bottoms` |
| vestido, macacão, conjunto | `one-pieces` |
| acessório | `auto` |

---

## 6. SISTEMA DE PAGAMENTOS (Mercado Pago)

### 6.1 Fluxos

**Assinatura mensal:**
```
Usuário → /plano → Checkout Pro MP → Webhook IPN → Atualiza plan_id + store_usage
```

**Créditos avulsos:**
```
Usuário → /plano → Checkout Avulso → Webhook IPN → Incrementa credit_* em stores
```

### 6.2 Packs de Créditos Avulsos

| Pack | Preço | Campanhas | Modelos | Regenerações |
|------|-------|-----------|---------|--------------|
| **Pack Entrada** | R$ 9,90 | 5 | — | — |
| Pack Padrão | R$ 29,90 | 15 | 1 | 3 |
| Pack Premium | R$ 49,90 | 30 | 2 | 5 |
| Pack Modelo Extra | R$ 19,90 | — | 1 | — |
| Pack Regeneração | R$ 4,90 | — | — | 5 |

### 6.3 Webhook IPN
- **Endpoint:** `POST /api/webhooks/mercadopago`
- **Eventos:** `payment.created`, `payment.updated`
- **Ações:** Verificar status `approved`, atualizar `plan_id`, criar `store_usage`, incrementar `credit_*`

### 6.4 Taxas Mercado Pago
| Meio | Taxa |
|------|------|
| PIX | 0,99% |
| Cartão crédito | 4,98% |
| Boleto | R$ 3,49/boleto |

---

## 7. PLANOS E CUSTOS (fonte: CUSTOS_PLANOS.md)

### 7.1 Custo por Campanha (para o CriaLook)

| Componente | Custo |
|-----------|-------|
| Vision Analyzer (Claude Sonnet) | R$ 0,08 |
| Estrategista (Claude Sonnet) | R$ 0,06 |
| Copywriter (Claude Sonnet) | R$ 0,10 |
| Refinador (Claude Sonnet) | R$ 0,05 |
| Scorer (Claude Sonnet) | R$ 0,04 |
| **Subtotal texto** | **R$ 0,33** |
| Try-on Fashn.ai | R$ 0,43 |
| Supabase Storage (~500KB) | R$ 0,10 |
| **Total com try-on** | **R$ 0,86** |
| **Total sem try-on** | **R$ 0,43** |

### 7.2 Margem por Plano

| Plano | Preço | Custo máx | Margem |
|-------|-------|-----------|--------|
| Starter (15 camp) | R$ 59 | R$ 12,90 | 78% |
| Pro (40 camp) | R$ 129 | R$ 34,40 | 73% |
| Business (85 camp) | R$ 249 | R$ 73,10 | 71% |
| Agência (200 camp) | R$ 499 | R$ 172,00 | 66% |

---

## 8. DEPLOY E INFRAESTRUTURA

### 8.1 Stack de Produção

```
Internet → Nginx (443/SSL) → PM2 (Node.js) → Next.js (:3000)
                                   ↓
                           Supabase Cloud (sa-east-1)
```

- **VPS:** KingHost (Ubuntu/Debian)
- **Process Manager:** PM2
- **Reverse Proxy:** Nginx
- **SSL:** Certbot (Let's Encrypt) — auto-renovação
- **Domínio:** crialook.com.br (DNS A → IP VPS)

### 8.2 Comandos de Deploy

```bash
# Na VPS
cd /caminho/Agencia-Fashion
git pull
cd campanha-ia
npm install
npm run build     # CPU limitada: sem turbopack (OOM fix)
pm2 restart crialook

# Logs
pm2 logs crialook --lines 50
pm2 status
pm2 monit
```

### 8.3 Nginx Config Essencial
- `proxy_read_timeout 120s` — necessário para pipeline IA (~30-60s)
- `client_max_body_size 15M` — upload de fotos de produto

### 8.4 Variáveis de Ambiente (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://emybirklqhonqodzyzet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Clerk (Auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/gerar
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Anthropic (IA)
ANTHROPIC_API_KEY=sk-ant-...

# Fashn.ai (Try-on)
FASHN_API_KEY=fa-...
FASHN_API_URL=https://api.fashn.ai/v1

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...
MERCADOPAGO_CLIENT_ID=...
MERCADOPAGO_CLIENT_SECRET=...
MERCADOPAGO_WEBHOOK_SECRET=...

# App
NEXT_PUBLIC_APP_URL=https://crialook.com.br
NEXT_PUBLIC_APP_NAME=CriaLook

# Monitoramento
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
POSTHOG_KEY=...
POSTHOG_HOST=https://app.posthog.com

# Jobs
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

### 8.5 Webhooks Externos a Configurar

| Serviço | URL | Status |
|---------|-----|--------|
| Mercado Pago (IPN) | `https://crialook.com.br/api/webhooks/mercadopago` | ⬜ Pendente |
| Clerk | `https://crialook.com.br/api/webhooks/clerk` | ⬜ Pendente |
| Inngest | `https://crialook.com.br/api/inngest` | ⬜ Pendente |

---

## 9. MONITORAMENTO E OBSERVABILIDADE

| Ferramenta | O que monitora | Plano |
|-----------|---------------|-------|
| **Sentry** | Erros, stack traces, source maps | Free (5K eventos/mês) |
| **PostHog** | Funil, eventos, session replay | Free (1M eventos/mês) |
| **PM2 Monit** | CPU, RAM, restarts do processo | — |
| **Nginx Logs** | Access logs, error logs | `/var/log/nginx/` |
| **Supabase Dashboard** | Queries, storage, DB metrics | — |

### 9.1 Health Check
- **Endpoint:** `GET /api/health`
- **Verifica:** App rodando, resposta OK

---

## 10. SEGURANÇA

### 10.1 Implementado
- ✅ RLS (Row Level Security) em todas as tabelas
- ✅ Clerk JWT para autenticação
- ✅ Admin role separado via Clerk metadata
- ✅ Rate limiting por IP nas rotas de geração
- ✅ Credit safety (não debitar em caso de erro)
- ✅ `.env.local` no `.gitignore`
- ✅ Service Role Key apenas no servidor

### 10.2 Aviso Pendente
- ⚠️ Tabela `showcase_items` tem policy `showcase_admin_all` com `USING (true)` — restringir para admin apenas

---

## 11. CHANGELOG (baseado nos commits)

| Data | Commit | Mudança |
|------|--------|---------|
| — | `361d1cc` | MVP completo: auth, pipeline IA, demo, SEO |
| — | `7c23446` | **Stripe → Mercado Pago** |
| — | `1dc5a43` | **Rebrand: Campanha IA → CriaLook** |
| — | `e1e20f3` | Integração Sentry, PostHog, Fashn.ai, Inngest |
| — | `39027d3` | Fashn.ai end-to-end integration |
| — | `549efc2` | fal.ai IDM-VTON fallback |
| — | `1c4ead4` | Showcase antes/depois (vitrine) |
| — | `ca61f97` | Suporte plus size no pipeline IA |
| — | `863eafe` | Dashboard admin com métricas completas |
| — | `68aaa58` | **Modelo créditos — remove plano grátis** |
| — | `08effc1` | Créditos avulsos ativos na /plano |
| — | `1ed1ac4` | KonvaCompositor (compositor visual) — **HEAD** |

---

> **Este documento substitui:** `01_ARQUITETURA_GERAL.md`, `02_BANCO_DE_DADOS.md`, `03_PIPELINE_IA.md`, `04_NICHOS_COMPLIANCE.md`, `05_PAINEL_ADMIN.md`, `06_ONBOARDING_CRIATIVOS.md`, `07_APIS_DEPLOY.md`, `APIS_PLATAFORMAS.md`, `DEPLOY_VPS.md`, `PLANO_NEGOCIO.md`, `MONITORAMENTO_GUIA.md`
>
> **Mantidos separados:** `CUSTOS_PLANOS.md` (detalhamento financeiro), `CHECKPOINTS.md` (progresso)
