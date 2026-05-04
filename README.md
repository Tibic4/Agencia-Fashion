<div align="center">

# 🎨 CriaLook

**Foto da peça → campanha completa pronta para postar em 60 segundos.**

SaaS B2C de geração de campanhas de moda com IA — para lojistas brasileiros que vendem por Instagram, WhatsApp e Meta Ads.

Monorepo: **web Next.js** ([`campanha-ia/`](./campanha-ia/)) + **app mobile Expo/React Native** ([`crialook-app/`](./crialook-app/)).

[![Live](https://img.shields.io/badge/live-crialook.com.br-A855F7?style=flat-square)](https://crialook.com.br)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)
![React%20Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)

![Status](https://img.shields.io/badge/status-em%20produção-success?style=flat-square)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-proprietary-lightgrey?style=flat-square)

</div>

---

## 🎯 O que faz

Lojista envia uma foto da peça (no manequim, cabide ou no chão) e em ~60 segundos recebe:

- **1 foto editorial** com modelo virtual ultra-realista vestindo a peça
- **Legendas persuasivas** otimizadas para Instagram, WhatsApp e Meta Ads
- **Hashtags estratégicas** (entre 8-15) para máximo alcance
- **Cenário visual** alinhado à identidade visual da loja (cor de marca extraída automaticamente)
- **Score de conversão** prevendo performance da campanha

Tudo via **pipeline de IA multi-modelo** orquestrado em paralelo (~50-60s end-to-end).

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────┐ ┌─────────────────────────────┐
│  WEB · Next.js 16               │ │  MOBILE · Expo SDK 54       │
│  crialook.com.br                │ │  React Native 0.81          │
│  Landing · /gerar · /admin …    │ │  Android · iOS              │
└─────────────────┬───────────────┘ └─────────────┬───────────────┘
                  │                               │
                  └───────────────┬───────────────┘
                                  │ HTTPS / API Routes
┌─────────────────────────────────▼────────────────────────────────┐
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

### Frontend Web
- **Next.js 16** (App Router, Server Components, Server Actions, ISR)
- **React 19** (use Suspense, transitions, optimistic updates)
- **TypeScript 5** (strict mode)
- **Tailwind v4** + design system custom (CSS variables, dark mode)
- **Framer Motion** (animações de UX)
- **Konva** (canvas editor para Instagram Stories/Posts)

### Mobile (Android + iOS)
- **Expo SDK 54** (managed workflow, EAS Build/Submit, EAS Workflows com fingerprint → OTA vs rebuild)
- **React Native 0.81** com new architecture (Fabric + TurboModules)
- **Expo Router** (file-based navigation paritária com Next.js App Router)
- **TanStack Query** (server state + dedup de in-flight + persistência via MMKV pra cold-start instantâneo)
- **MMKV** (cache HTTP + preferences, sync, sem soft-cap de 6MB do AsyncStorage)
- **zod** (runtime validation das responses de API)
- **@shopify/react-native-skia** (Confetti, AuraGlow, MeshGradient, ParticleLoader em GPU thread)
- **Material You** (palette dinâmica do wallpaper no Android 12+, fallback brand)
- **app.config.ts dinâmico** (3 variants — dev/preview/prod com bundle ids, schemes e ícones distintos)
- **Clerk Expo** (auth nativo + deep links)
- **react-native-iap 14** (Google Play Billing com obfuscatedAccountId pra anti-replay)
- **Sentry** (errors + traces + source maps via plugin EAS)
- **Storybook on-device** + **jest-expo** (catálogo + component tests)
- Paridade visual com o site — design system compartilhado, dark mode, haptics opt-out

### Backend
- **Next.js API Routes** (Edge + Node runtimes)
- **Supabase** (PostgreSQL 17 com RLS, RPCs atômicas, Storage)
- **Clerk** (auth + webhooks)
- **Mercado Pago** (checkout + subscriptions + webhooks HMAC)
- **Inngest** (background jobs com retries)

### IA
- **Anthropic Claude Sonnet 4.6** (`claude-sonnet-4-6`) — copywriting persuasivo PT-BR com análise visual da peça
- **Google Gemini 3.1 Pro** — vision analyzer (atributos da peça + scene prompts)
- **Google Gemini 3 Pro Image** — virtual try-on multi-image fusion (1 foto por campanha — pipeline foi consolidado pra chamada única depois que UX padronizou em hero único)

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
- Pipeline de IA single-shot (chamada VTO única por campanha) + retries exponenciais com circuit breaker
- **Pose schema indexada** (`pose_index` único, banco de 8 poses estáveis) + temperature 0.3 no Analyzer + Identity Lock (hex de cor) no VTO — anti-alucinação de cabelo, e streak-block evita repetir a mesma pose 3 campanhas seguidas pro mesmo lojista
- **MMKV** sync no mobile elimina o tax de bridge/JSON.parse a cada `apiGetCached` (10-100x mais rápido que AsyncStorage)
- **Brotli + Nginx `proxy_cache`** em rotas estáticas (com bypass automático para usuários logados) — landing serve em ~14ms internos, throughput 693 req/s

### Qualidade de código
- **184 testes unitários** web (Vitest) — HMAC validator, rate-limiter, editor sessions, validation, judge pipeline, payments webhooks
- **Component tests** mobile (jest + jest-expo) — pulsing badge, hooks de geração, image picker
- **TypeScript strict** com `noFallthroughCasesInSwitch` + `noImplicitOverride`
- **CI verde** em cada PR (lint + typecheck + build + tests)
- **Husky pre-commit** bloqueia commit com type errors
- **Idempotency-Key** UUID nos POSTs sensíveis (campaign generate, billing verify)
- **Load testing** com k6 — ramp 1→100 VUs em produção, threshold abort para proteção, métricas baseline vs pós-otimização documentadas em [`loadtests/`](./loadtests/README.md)

### DevOps
- **PM2 ecosystem** com `max_memory_restart: 1500M` e graceful shutdown 30s
- **Logs estruturados** em `/var/log/crialook/`
- **Cron diário de backup** Supabase com retenção 30d
- **Cron horário de downgrade** de assinaturas canceladas
- **Health-check com auto-restart** se app cair

---

## 🧪 Como rodar localmente

### Web (`campanha-ia/`)

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

### Mobile (`crialook-app/`)

```bash
cd Agencia-Fashion/crialook-app

# Instalar dependências
# IMPORTANTE: o EAS roda npm 10. Se você usa npm 11+ localmente,
# rode `npm run lock:fix` em vez de `npm install` para gerar um
# package-lock.json compatível com o builder remoto.
npm install

# Configurar env
cp .env.example .env
# Edita: EXPO_PUBLIC_API_URL (aponta pra sua web local ou prod), CLERK, SENTRY

# Rodar em dev (abre menu Expo: a=Android, i=iOS, w=web)
APP_VARIANT=development npx expo start
# (sem APP_VARIANT cai em production — útil pra QA local sem dev menu)

# Rodar testes
npm test           # jest watch mode
npm run test:ci    # jest run

# Build com EAS (Android/iOS)
APP_VARIANT=preview eas build --profile preview --platform android
eas build --profile production --platform android
eas build --profile production --platform ios

# Storybook on-device
npm run storybook:dev
```

---

## 📂 Estrutura

```
.
├── campanha-ia/             # App Next.js principal (web + API + backend)
│   ├── src/
│   │   ├── app/             # App Router (rotas, API, layouts)
│   │   ├── components/      # Componentes React reutilizáveis
│   │   ├── lib/             # Lógica de negócio (db, ai, auth, payments)
│   │   ├── hooks/           # React hooks custom
│   │   └── types/           # TypeScript types
│   ├── supabase/migrations/ # SQL migrations versionadas
│   ├── scripts/             # Tooling (introspect, apply-migration, sb-query)
│   └── public/              # Assets estáticos
├── crialook-app/            # App mobile (Expo / React Native)
│   ├── app/                 # Expo Router (file-based, paritário com Next)
│   ├── components/          # Componentes RN reutilizáveis (+ skia/ pra GPU drawing)
│   ├── lib/                 # i18n, theme, query-client, schemas, toast, cache MMKV
│   ├── hooks/               # Hooks custom (useModelSelector, useMaterialYou, etc)
│   ├── assets/              # Ícones (per-variant), splash, fontes
│   ├── __tests__/           # jest-expo component tests
│   ├── store-assets/        # Screenshots + listing Play Store
│   ├── storybook/           # Catálogo on-device
│   ├── .eas/workflows/      # EAS Workflow (fingerprint → build vs OTA)
│   ├── app.config.ts        # Config Expo dinâmica (3 variants: dev/preview/prod)
│   └── eas.json             # Profiles de build EAS
├── docs/
│   ├── juridico/            # LGPD compliance + minutas
│   └── legacy/              # Documentos de produto e roadmap
├── loadtests/               # Scripts k6 + relatórios de performance
├── ops/                     # Scripts de produção (backup, healthcheck)
├── ecosystem.config.js      # PM2 ecosystem (apenas web)
├── nginx-crialook.conf      # Nginx canonical config
└── deploy-crialook.sh       # Script de deploy (web)
```

---

## 🛠️ Owner workflows

Scripts e runbooks self-service para tarefas que só o owner consegue executar (deploys de produção, builds EAS, revogação de sessões Clerk). Cada script é um pre-flight que NÃO executa a operação destrutiva — ele valida, reporta, e printa o próximo comando para o owner rodar manualmente.

| Comando | Onde rodar | O que faz | Runbook |
|---------|------------|-----------|---------|
| `npm run play:prep` | `crialook-app/` | Pre-flight antes de `eas build`: valida placeholders em `eas.json`, SHA-256 em `assetlinks.json`, vitest, tsc, expo-doctor, `expo prebuild` + grep das permissions Android obrigatórias. | [`crialook-app/docs/PLAY_RELEASE_CHECKLIST.md`](./crialook-app/docs/PLAY_RELEASE_CHECKLIST.md) |
| `npm run deploy:check` | `campanha-ia/` | Pre-flight antes de `git push` + `bash deploy-crialook.sh`: git status clean, commits ahead, vitest, tsc, lint, `next build`, paridade de migrations Supabase. | [`ops/deploy.md`](./ops/deploy.md) |
| `npm run clerk:revoke-loadtest` | `campanha-ia/` | Helper informativo para revogar as 2 sessões Clerk capturadas em `loadtests/.env.loadtest` durante M1 P4 (printa URLs do Dashboard + `curl` templates do Admin API; não executa nenhuma chamada remota). | [`crialook-app/docs/CLERK_KEYS.md`](./crialook-app/docs/CLERK_KEYS.md) |

Outros runbooks owner-action que ainda não têm script wrapper (quando o ganho de automação seria mínimo):

- [`ops/DEPLOY_USER_MIGRATION.md`](./ops/DEPLOY_USER_MIGRATION.md) — cutover SSH `root → crialook` (D-12/D-14/D-15).
- [`ops/csp-rollout.md`](./ops/csp-rollout.md) — janela 14 dias `Report-Only → enforced` (P8 D-16).
- [`crialook-app/docs/CLERK_KEYS.md`](./crialook-app/docs/CLERK_KEYS.md) §Rotation — política anual + emergência.

Hard rule pra todos: nenhum desses scripts faz `git push`, `eas build`, deploy, nem chama Clerk Admin API automaticamente. Eles preparam o terreno; o owner aperta o gatilho.

---

## 📊 Auditoria & qualidade

Em abril/2026 fiz uma rodada de **hardening de segurança e código** cobrindo 270 pontos de atenção em:

- Segurança (auth, webhook, SSRF, IDOR)
- Camada de dados (RLS, queries, race conditions)
- Mercado Pago (idempotência, fraud-gate, HMAC)
- Performance (LCP, bundle, imagens)
- Acessibilidade (WCAG 2.1 AA)
- LGPD compliance
- DevOps (Nginx, Docker, PM2)
- SEO técnico
- Conversão (CRO)

**~230 fixes aplicados** ao longo das rodadas, em commits pequenos e focados, CI verde e zero regressões.

Veja `docs/juridico/LGPD-COMPLIANCE.md` para o checklist legal e `docs/legacy/` para evolução do produto.

---

## 🚀 Em produção

**Web:**
- **URL:** https://crialook.com.br
- **Deploy:** VPS Ubuntu (KingHost) com Nginx + PM2 + Cloudflare DNS
- **Database:** Supabase (region SA-East-1)
- **Build:** GitHub Actions → SSH deploy
- **Monitoring:** UptimeRobot + Sentry + cron health-check

**Mobile:**
- **Android:** Google Play (track Internal Testing → rampa pra Production)
- **iOS:** App Store (em fase de submissão)
- **Build/Submit:** EAS (Expo Application Services)
- **OTA updates:** Expo Updates (canal `production`)

---

## 👨‍💻 Sobre

Construído por **Alton Jorge de Souza Vieira** — desenvolvedor fullstack com foco em produtos de moda + IA. CriaLook nasceu para resolver minha própria dor (loja de roupa precisando de fotos profissionais) e virou ferramenta para outros lojistas brasileiros.

📫 Contato: [contato@crialook.com.br](mailto:contato@crialook.com.br)
🌐 Produto: [crialook.com.br](https://crialook.com.br)

---

<div align="center">

Construído com 💜 + ☕ em Patrocínio/MG

</div>
