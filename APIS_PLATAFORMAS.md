# 🔑 CAMPANHA IA — APIs e Plataformas Necessárias

> **Foco: MODA** (feminina, masculina, infantil, calçados, acessórios)
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

### VPS (Deploy + Hosting)
- **O que faz:** Hosting do Next.js em produção
- **Domínio:** `crialook.com.br`
- **Stack de deploy:** Node.js + PM2 + Nginx + Let's Encrypt (SSL grátis)
- **Configurar:**
  - [ ] Instalar Node.js 20+ na VPS
  - [ ] Instalar PM2 (`npm i -g pm2`)
  - [ ] Configurar Nginx como reverse proxy (porta 3000 → 80/443)
  - [ ] Configurar SSL com Certbot (Let's Encrypt)
  - [ ] Apontar DNS do `crialook.com.br` para o IP da VPS
  - [ ] Configurar CI/CD (GitHub Actions → SSH deploy)
- **Status:** ⬜ Pendente

---

## 2. AUTENTICAÇÃO

### Clerk (Auth)
- **O que faz:** Login (Google, Email, WhatsApp), gestão de sessões, roles (admin), webhooks
- **URL:** httpsclerk.com://
- **Variáveis:** `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- **Plano:** Free (10.000 MAU) → Pro quando necessário
- **Configurar:**
  - [ ] Criar app no Clerk Dashboard
  - [ ] Ativar Google OAuth
  - [ ] Ativar Email/Password
  - [ ] Configurar webhook endpoint
  - [ ] Criar custom claim `role: admin`
- **Status:** ✅ Configurado

---

## 3. PAGAMENTOS

### Mercado Pago (Recorrência + Créditos)
- **O que faz:** Assinaturas mensais, pagamentos avulsos (créditos), PIX nativo, Boleto, Cartão parcelado, Checkout Pro
- **URL:** https://www.mercadopago.com.br/developers
- **Variáveis:** `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`
- **Plano:** Pay-as-you-go
  - PIX: 0,99% por transação
  - Cartão de crédito: 4,98% por transação
  - Boleto: R$ 3,49 por boleto pago
- **MCP Server:** `https://mcp.mercadopago.com/mcp` (remoto, sem instalação local)
- **Configurar:**
  - [x] Criar conta Mercado Pago Developer
  - [x] Criar aplicação no painel de desenvolvedores
  - [x] Gerar Access Token (produção)
  - [x] Gerar Public Key
  - [ ] Criar 5 planos de assinatura (Grátis, Starter, Pro, Business, Agência)
  - [ ] Configurar pagamentos avulsos (créditos extras)
  - [ ] Configurar webhook endpoint (IPN)
  - [ ] Configurar MCP Server no IDE
- **Status:** ⬜ Pendente

---

## 4. INTELIGÊNCIA ARTIFICIAL (LLM)

### Anthropic API (Pipeline de texto)
- **O que faz:** Vision Analyzer, Estrategista, Copywriter, Refinador, Scorer — especializado em moda
- **URL:** https://console.anthropic.com
- **Variáveis:** `ANTHROPIC_API_KEY`
- **Modelos usados:**
  - `claude-sonnet-4-20250514` → Vision (análise de peça de roupa), Estrategista, Copywriter
  - `claude-haiku-4-20250414` → Refinador, Scorer
- **Custo:** ~R$ 0,29/campanha (apenas LLM)
- **Rate limits:** 1000 req/min (Tier 1)
- **Configurar:**
  - [ ] Criar conta com billing ativo
  - [ ] Gerar API key
  - [ ] Verificar tier e rate limits
- **Status:** ✅ Configurado

---

## 5. PROCESSAMENTO DE IMAGEM (MODA)

### Fashn.ai (Virtual Try-On) ⭐ CORE
- **O que faz:** Vestir roupas/acessórios em modelos virtuais — funcionalidade central do produto
- **URL:** https://fashn.ai
- **Variáveis:** `FASHN_API_KEY`, `FASHN_API_URL`
- **Endpoints usados:**
  - `Model Create` → criar modelo virtual personalizada (4 samples)
  - `Product to Model` → vestir peça na modelo
- **Custo:** ~R$ 0,43/try-on, ~R$ 1,72/model create
- **Configurar:**
  - [ ] Criar conta
  - [ ] Ativar billing
  - [ ] Gerar API key
  - [ ] Testar endpoint com foto de produto de moda
- **Status:** ✅ Configurado
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
- **Status:** 🚫 Cancelado/Não será usado
- **Fallback:** fal.ai ou remove.bg

### fal.ai (Virtual Try-On fallback)
- **O que faz:** Try-on virtual usando IDM-VTON (open source). Fallback do Fashn.ai.
- **URL:** https://fal.ai
- **Variáveis:** `FAL_KEY`
- **Endpoint usado:** `fal-ai/idm-vton`
- **Custo:** ~R$ 0,15-0,25/imagem (mais barato que Fashn.ai)
- **Configurar:**
  - [x] Criar conta
  - [x] Gerar API key
- **Status:** ✅ Configurado

---

## 6. MONITORAMENTO

### Sentry (Erros)
- **O que faz:** Captura de erros, stack traces, source maps
- **URL:** https://sentry.io
- **Variáveis:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- **Plano:** Developer (grátis, 5K eventos/mês)
- **Status:** ✅ Configurado

### PostHog (Analytics + Funil)
- **O que faz:** Eventos de funil, feature flags, session replay
- **URL:** https://posthog.com
- **Variáveis:** `POSTHOG_KEY`, `POSTHOG_HOST`
- **Plano:** Free (1M eventos/mês)
- **Status:** ✅ Configurado

---

## 7. JOBS ASSÍNCRONOS

### Inngest (Fila de Jobs)
- **O que faz:** Executar pipeline de IA de forma assíncrona com retry
- **URL:** https://inngest.com
- **Chaves configuradas:**
  - `INNGEST_EVENT_KEY` configurado
  - `INNGEST_SIGNING_KEY` configurado
- **Variáveis:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- **Plano:** Free (25K runs/mês)
- **Alternativa:** Vercel Cron + Background Functions
- **Status:** ✅ Configurado

---

## 8. RESUMO DE CUSTOS DE PLATAFORMA

| Plataforma | Custo fixo/mês | Custo variável |
|-----------|---------------|----------------|
| Supabase | R$ 0 (Free) → R$ 130 (Pro) | Storage: R$ 0,13/GB |
| VPS | Já pago pelo usuário | — |
| Clerk | R$ 0 (Free) | R$ 0,02/MAU acima de 10K |
| Mercado Pago | R$ 0 | PIX 0,99% / Cartão 4,98% / Boleto R$ 3,49 |
| Anthropic | R$ 0 | ~R$ 0,29/campanha |
| Fashn.ai | R$ 0 | ~R$ 0,43/try-on + R$ 1,72/model |
| Stability AI | R$ 0 | ~R$ 0,05/remoção fundo |
| Sentry | R$ 0 (Dev) | — |
| PostHog | R$ 0 (Free) | — |
| Inngest | R$ 0 (Free) | — |
| **TOTAL fixo MVP** | **R$ 0/mês** | **~R$ 0,77/campanha (com try-on)** |
