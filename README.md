<div align="center">

# 🎨 CriaLook

**Foto da peça → campanha completa pronta para postar em 60 segundos.**

SaaS B2C de geração de campanhas de moda com IA — para lojistas brasileiros que vendem por Instagram, WhatsApp e Meta Ads.

[![Live](https://img.shields.io/badge/live-crialook.com.br-A855F7?style=flat-square)](https://crialook.com.br)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)

![Status](https://img.shields.io/badge/status-em%20produção-success?style=flat-square)
![Tests](https://img.shields.io/badge/tests-33%20passing-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-proprietary-lightgrey?style=flat-square)

</div>

---

## 🎯 O que faz

Lojista envia uma foto da peça (no manequim, cabide ou no chão) e em ~60 segundos recebe:

- **3 fotos editoriais** com modelo virtual ultra-realista vestindo a peça
- **Legendas persuasivas** otimizadas para Instagram, WhatsApp e Meta Ads
- **Hashtags estratégicas** (entre 8-15) para máximo alcance
- **Cenário visual** alinhado à identidade visual da loja (cor de marca extraída automaticamente)
- **Score de conversão** prevendo performance da campanha

Tudo via **pipeline de IA multi-modelo** orquestrado em paralelo (~50-60s end-to-end).

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                       CLIENTE (Next.js 16)                       │
│  Landing · Onboarding · /gerar · /historico · /admin · /editor   │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Server Actions / API Routes
┌────────────────────────────▼─────────────────────────────────────┐
│                      API LAYER (Next.js)                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│   │  /gerar  │  │ webhooks │  │ /credits │  │ /api/cron/...  │   │
│   │   SSE    │  │  MP/Clerk│  │ MP/Trial │  │ downgrade etc  │   │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────────────┘   │
└────────┼─────────────┼─────────────┼─────────────────────────────┘
         │             │             │
    ┌────▼────────┐    │      ┌──────▼──────────┐
    │ AI Pipeline │    │      │ Mercado Pago    │
    │ (paralelo)  │    │      │ checkout +      │
    │             │    │      │ subscriptions   │
    │ • Gemini    │    │      └─────────────────┘
    │   3.1 Pro   │    │
    │   Analyzer  │    │      ┌─────────────────┐
    │ • Gemini    │    └──────► Clerk (auth)    │
    │   VTO ×3    │           └─────────────────┘
    │ • Sonnet    │
    │   4.6 Copy  │           ┌─────────────────┐
    │             │           │ Inngest (jobs)  │
    └─────┬───────┘           │ • storage GC    │
          │                   │ • model preview │
          │                   └─────────────────┘
          │
    ┌─────▼────────────────────────────────────────────┐
    │                Supabase (Postgres)               │
    │                                                  │
    │  RLS em todas tabelas · 14 RPCs SECURITY DEFINER │
    │  Storage privado · Pool transacional             │
    │                                                  │
    │  Tabelas: stores, campaigns, campaign_outputs,   │
    │  campaign_scores, store_models, credit_purchases,│
    │  store_usage, mini_trial_uses, plan_payments_…   │
    └──────────────────────────────────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │ Sentry · PostHog ·  │
                  │ UptimeRobot · cron  │
                  └─────────────────────┘
```

---

## 🛠️ Stack tecnológica

### Frontend
- **Next.js 16** (App Router, Server Components, Server Actions, ISR)
- **React 19** (use Suspense, transitions, optimistic updates)
- **TypeScript 5** (strict mode)
- **Tailwind v4** + design system custom (CSS variables, dark mode)
- **Framer Motion** (animações de UX)
- **Konva** (canvas editor para Instagram Stories/Posts)

### Backend
- **Next.js API Routes** (Edge + Node runtimes)
- **Supabase** (PostgreSQL 17 com RLS, RPCs atômicas, Storage)
- **Clerk** (auth + webhooks)
- **Mercado Pago** (checkout + subscriptions + webhooks HMAC)
- **Inngest** (background jobs com retries)

### IA
- **Anthropic Claude Sonnet 4.6** (`claude-sonnet-4-6`) — copywriting persuasivo PT-BR com análise visual da peça
- **Google Gemini 3.1 Pro** — vision analyzer (atributos da peça + scene prompts)
- **Google Gemini 3 Pro Image** — virtual try-on multi-image fusion (3 imagens em paralelo)

### Observabilidade
- **Sentry** (errors + traces, com PII redaction)
- **PostHog** (analytics + feature flags, com consent gate LGPD)
- **UptimeRobot** (uptime externo)
- **Cron health-check** com auto-restart PM2

### Deploy
- **VPS KingHost** (Ubuntu 24.04, 2 vCPU, 4GB RAM, Nginx, PM2 ecosystem)
- **GitHub Actions** (lint + typecheck + build + tests)
- **Backup automático** Supabase (pg_dump + retenção 30d)

---

## ✨ Highlights de engenharia

### Segurança
- **Webhook Mercado Pago HMAC-validated** com timing-safe compare e janela anti-replay (5min)
- **Validação de fraud-gate**: rejeita pagamento se valor pago ≠ preço esperado do plano/pacote
- **Idempotência atômica** em pagamentos (RPC com `pg_advisory_lock`)
- **RLS habilitado** em todas as 14+ tabelas com policies por `clerk_user_id`
- **HMAC-signed cookies** no editor standalone (não string literal "authenticated")
- **Rate limiting** por IP e por user (anti-abuso de IA cara)
- **CSP, HSTS, X-Frame, Referrer-Policy** no Nginx
- **LGPD-compliant**: páginas de privacidade, termos, DPO, subprocessadores, consentimento biométrico, banner de cookies, endpoints `DELETE /api/me` e `GET /api/me/export`

### Performance
- Imagens convertidas pra WebP (-90% peso, de 15MB total → 2MB)
- Lazy-load com `next/dynamic` em componentes below-the-fold
- Preconnect/dns-prefetch para Supabase, Clerk, Mercado Pago
- Pipeline de IA com **3 VTOs paralelos** + retries exponenciais com circuit breaker
- **Brotli + Nginx `proxy_cache`** em rotas estáticas (com bypass automático para usuários logados) — landing serve em ~14ms internos, throughput 693 req/s

### Qualidade de código
- **33 testes unitários** (Vitest) — HMAC validator, rate-limiter, editor sessions, validation
- **TypeScript strict** com `noFallthroughCasesInSwitch` + `noImplicitOverride`
- **CI verde** em cada PR (lint + typecheck + build + tests)
- **Husky pre-commit** bloqueia commit com type errors
- **Load testing** com k6 — ramp 1→100 VUs em produção, threshold abort para proteção, métricas baseline vs pós-otimização documentadas em [`loadtests/`](./loadtests/README.md)

### DevOps
- **PM2 ecosystem** com `max_memory_restart: 1500M` e graceful shutdown 30s
- **Logs estruturados** em `/var/log/crialook/`
- **Cron diário de backup** Supabase com retenção 30d
- **Cron horário de downgrade** de assinaturas canceladas
- **Health-check com auto-restart** se app cair

---

## 🧪 Como rodar localmente

```bash
git clone https://github.com/Tibic4/Agencia-Fashion.git
cd Agencia-Fashion/campanha-ia

# Instalar dependências
npm ci

# Configurar env (copia o template e preenche)
cp .env.example .env.local
# Edita com suas chaves: SUPABASE, CLERK, MERCADOPAGO, ANTHROPIC, GOOGLE_AI

# Rodar em dev
npm run dev   # http://localhost:3000

# Rodar testes
npm test           # vitest watch mode
npm run test:ci    # vitest run

# Type-check + lint
npm run typecheck
npm run lint

# Build de produção
npm run build
```

---

## 📂 Estrutura

```
.
├── campanha-ia/             # App Next.js principal
│   ├── src/
│   │   ├── app/             # App Router (rotas, API, layouts)
│   │   ├── components/      # Componentes React reutilizáveis
│   │   ├── lib/             # Lógica de negócio (db, ai, auth, payments)
│   │   ├── hooks/           # React hooks custom
│   │   └── types/           # TypeScript types
│   ├── supabase/migrations/ # SQL migrations versionadas
│   ├── scripts/             # Tooling (introspect, apply-migration, sb-query)
│   └── public/              # Assets estáticos
├── docs/
│   ├── juridico/            # LGPD compliance + minutas
│   └── legacy/              # Documentos de produto e roadmap
├── loadtests/               # Scripts k6 + relatórios de performance
├── ops/                     # Scripts de produção (backup, healthcheck)
├── ecosystem.config.js      # PM2 ecosystem
├── nginx-crialook.conf      # Nginx canonical config
└── deploy-crialook.sh       # Script de deploy
```

---

## 📊 Auditoria & qualidade

Em abril/2026, a aplicação passou por **auditoria de segurança e código** completa por 12 agentes de IA especializados, identificando 270 achados em:

- Segurança (auth, webhook, SSRF, IDOR)
- Camada de dados (RLS, queries, race conditions)
- Mercado Pago (idempotência, fraud-gate, HMAC)
- Performance (LCP, bundle, imagens)
- Acessibilidade (WCAG 2.1 AA)
- LGPD compliance
- DevOps (Nginx, Docker, PM2)
- SEO técnico
- Conversão (CRO)

**~200 fixes aplicados** em 14 commits + 5 migrations Supabase, com CI verde e zero regressões.

Veja `docs/juridico/LGPD-COMPLIANCE.md` para o checklist legal e `docs/legacy/` para evolução do produto.

---

## 🚀 Em produção

- **URL:** https://crialook.com.br
- **Deploy:** VPS Ubuntu (KingHost) com Nginx + PM2 + Cloudflare DNS
- **Database:** Supabase (region SA-East-1)
- **Build:** GitHub Actions → SSH deploy
- **Monitoring:** UptimeRobot + Sentry + cron health-check

---

## 👨‍💻 Sobre

Construído por **Alton Jorge de Souza Vieira** — desenvolvedor fullstack com foco em produtos de moda + IA. CriaLook nasceu para resolver minha própria dor (loja de roupa precisando de fotos profissionais) e virou ferramenta para outros lojistas brasileiros.

📫 Contato: [contato@crialook.com.br](mailto:contato@crialook.com.br)
🌐 Produto: [crialook.com.br](https://crialook.com.br)

---

<div align="center">

Construído com 🤖 + ☕ em Patrocínio/MG

</div>
