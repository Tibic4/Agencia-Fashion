# 🔑 CAMPANHA IA — APIs e Plataformas Necessárias

> Lista de TODAS as APIs, serviços e plataformas que o projeto utiliza.
> Para cada uma: o que faz, onde criar conta, e o que configurar.

---

## 1. INFRAESTRUTURA

### Supabase (Banco + Storage + Realtime)
- **O que faz:** PostgreSQL, Storage de imagens, Realtime (progresso do pipeline), Auth helpers
- **URL:** https://supabase.com
- **Projeto:** `emybirklqhonqodzyzet` (sa-east-1, São Paulo) ✅ CRIADO
- **Variáveis:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Plano:** Free (500MB DB, 1GB storage) → Pro quando escalar
- **Status:** ✅ Ativo

### Vercel (Deploy + Edge Functions)
- **O que faz:** Hosting, CI/CD, Edge Functions, Analytics
- **URL:** https://vercel.com
- **Variáveis:** Todas as env vars do projeto
- **Plano:** Hobby (grátis) → Pro quando escalar
- **Configurar:** Conectar repo GitHub/GitLab, domínio customizado
- **Status:** ⬜ Pendente

---

## 2. AUTENTICAÇÃO

### Clerk (Auth)
- **O que faz:** Login (Google, Email, WhatsApp), gestão de sessões, roles (admin), webhooks
- **URL:** https://clerk.com
- **Variáveis:** `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- **Plano:** Free (10.000 MAU) → Pro quando necessário
- **Configurar:**
  - [ ] Criar app no Clerk Dashboard
  - [ ] Ativar Google OAuth
  - [ ] Ativar Email/Password
  - [ ] Configurar webhook endpoint
  - [ ] Criar custom claim `role: admin`
- **Status:** ⬜ Pendente

---

## 3. PAGAMENTOS

### Stripe (Recorrência + Créditos)
- **O que faz:** Assinaturas mensais, pagamentos avulsos (créditos), PIX, Customer Portal
- **URL:** https://stripe.com
- **Variáveis:** `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Plano:** Pay-as-you-go (2.99% + R$ 0,39 por transação)
- **Configurar:**
  - [ ] Criar conta Stripe BR
  - [ ] Ativar PIX nas configurações
  - [ ] Criar 5 produtos (Grátis, Starter, Pro, Business, Agência)
  - [ ] Criar price IDs para cada plano
  - [ ] Criar prices avulsos (créditos extras)
  - [ ] Configurar Customer Portal
  - [ ] Registrar webhook endpoint
- **Status:** ⬜ Pendente

---

## 4. INTELIGÊNCIA ARTIFICIAL (LLM)

### Anthropic API (Pipeline de texto)
- **O que faz:** Vision Analyzer, Estrategista, Copywriter, Refinador, Scorer
- **URL:** https://console.anthropic.com
- **Variáveis:** `ANTHROPIC_API_KEY`
- **Modelos usados:**
  - `claude-sonnet-4-20250514` → Vision, Estrategista, Copywriter
  - `claude-haiku-4-20250414` → Refinador, Scorer
- **Custo:** ~R$ 0,29/campanha (apenas LLM)
- **Rate limits:** 1000 req/min (Tier 1)
- **Configurar:**
  - [ ] Criar conta com billing ativo
  - [ ] Gerar API key
  - [ ] Verificar tier e rate limits
- **Status:** ⬜ Pendente

### OpenAI API (Geração de imagem)
- **O que faz:** Gerar imagens lifestyle (DALL-E 3) para nichos não-moda
- **URL:** https://platform.openai.com
- **Variáveis:** `OPENAI_API_KEY`
- **Modelo usado:** `dall-e-3`
- **Custo:** ~R$ 0,23/imagem (1024×1024)
- **Configurar:**
  - [ ] Criar conta com billing ativo
  - [ ] Gerar API key
- **Status:** ⬜ Pendente

---

## 5. PROCESSAMENTO DE IMAGEM

### Fashn.ai (Virtual Try-On)
- **O que faz:** Vestir roupas em modelos virtuais (moda)
- **URL:** https://fashn.ai
- **Variáveis:** `FASHN_API_KEY`, `FASHN_API_URL`
- **Endpoints usados:**
  - `Model Create` → criar modelo virtual (4 samples)
  - `Product to Model` → vestir roupa na modelo
- **Custo:** ~R$ 0,43/try-on, ~R$ 1,72/model create
- **Configurar:**
  - [ ] Criar conta
  - [ ] Ativar billing
  - [ ] Gerar API key
  - [ ] Testar endpoint com foto de produto
- **Status:** ⬜ Pendente
- **Fallback:** Kolors Virtual Try-On ou IDM-VTON (self-hosted)

### Stability AI (Remoção de fundo)
- **O que faz:** Remover fundo de fotos de produtos
- **URL:** https://platform.stability.ai
- **Variáveis:** `STABILITY_API_KEY`
- **Endpoint usado:** Remove Background
- **Custo:** ~R$ 0,05/imagem
- **Configurar:**
  - [ ] Criar conta
  - [ ] Adicionar créditos
  - [ ] Gerar API key
- **Status:** ⬜ Pendente
- **Fallback:** fal.ai ou remove.bg

---

## 6. MONITORAMENTO

### Sentry (Erros)
- **O que faz:** Captura de erros, stack traces, source maps
- **URL:** https://sentry.io
- **Variáveis:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- **Plano:** Developer (grátis, 5K eventos/mês)
- **Status:** ⬜ Pendente

### PostHog (Analytics + Funil)
- **O que faz:** Eventos de funil, feature flags, session replay
- **URL:** https://posthog.com
- **Variáveis:** `POSTHOG_KEY`, `POSTHOG_HOST`
- **Plano:** Free (1M eventos/mês)
- **Status:** ⬜ Pendente

---

## 7. JOBS ASSÍNCRONOS

### Inngest (Fila de Jobs)
- **O que faz:** Executar pipeline de IA de forma assíncrona com retry
- **URL:** https://inngest.com
- **Variáveis:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- **Plano:** Free (25K runs/mês)
- **Alternativa:** Vercel Cron + Background Functions
- **Status:** ⬜ Pendente

---

## 8. RESUMO DE CUSTOS DE PLATAFORMA

| Plataforma | Custo fixo/mês | Custo variável |
|-----------|---------------|----------------|
| Supabase | R$ 0 (Free) → R$ 130 (Pro) | Storage: R$ 0,13/GB |
| Vercel | R$ 0 (Hobby) → R$ 100 (Pro) | Bandwidth: R$ 0,20/GB |
| Clerk | R$ 0 (Free) | R$ 0,02/MAU acima de 10K |
| Stripe | R$ 0 | 2,99% + R$ 0,39/transação |
| Anthropic | R$ 0 | ~R$ 0,29/campanha |
| OpenAI | R$ 0 | ~R$ 0,23/imagem lifestyle |
| Fashn.ai | R$ 0 | ~R$ 0,43/try-on |
| Stability AI | R$ 0 | ~R$ 0,05/remoção fundo |
| Sentry | R$ 0 (Dev) | — |
| PostHog | R$ 0 (Free) | — |
| Inngest | R$ 0 (Free) | — |
| **TOTAL fixo MVP** | **R$ 0/mês** | **~R$ 0,69/campanha** |
