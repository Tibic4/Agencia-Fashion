# 🎯 CriaLook — Marketing de Moda com IA

> Transforme fotos de roupa em campanhas de marketing prontas em 60 segundos.

SaaS para lojistas de moda brasileiros que automatiza a criação de campanhas para Instagram, WhatsApp e Meta Ads usando Inteligência Artificial.

---

## ✨ Features

- 📸 **Upload & Go** — Tire a foto da peça, a IA faz o resto
- 🤖 **Pipeline de 5 agentes IA** — Vision → Estratégia → Copy → Refinamento → Score
- 📱 **4 canais** — Instagram Feed, Stories, WhatsApp e Meta Ads
- 👩 **Modelo Virtual** — IA veste a roupa em uma modelo digital (Fashn.ai)
- 📊 **Score de qualidade** — Nota 0-100 com sugestões de melhoria
- 💰 **Freemium** — 3 campanhas/mês grátis, planos a partir de R$47
- 🖼️ **Vitrine Antes/Depois** — Upload via admin, exibe na landing page
- 💚 **WhatsApp flutuante** — Botão com animação heartbeat
- 🛡️ **Rate limiting** — Proteção contra abuso por IP
- ♿ **Plus Size** — Linguagem body-positive automática no pipeline de IA

## 🛠️ Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router + Turbopack) |
| Linguagem | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| IA (texto) | Anthropic Claude (Sonnet + Haiku) |
| IA (imagem) | Fashn.ai (Virtual Try-On) |
| Auth | Clerk (Google, Email, Roles) |
| Database | Supabase PostgreSQL + Storage |
| Pagamentos | Mercado Pago (PIX, Cartão, Boleto) |
| Monitoramento | Sentry (erros) + PostHog (analytics) |
| Jobs | Inngest (pipeline assíncrono com retry) |
| Deploy | VPS (Node.js + PM2 + Nginx + SSL) |

## 📁 Estrutura

```
campanha-ia/
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Landing page
│   │   ├── layout.tsx                    # Root layout + SEO + WhatsApp
│   │   ├── loading.tsx                   # Loading global
│   │   ├── not-found.tsx                 # 404
│   │   ├── sitemap.ts                    # Sitemap dinâmico
│   │   ├── robots.ts                     # robots.txt
│   │   ├── manifest.ts                   # PWA manifest
│   │   ├── globals.css                   # Design system completo
│   │   ├── onboarding/page.tsx           # Wizard 3 steps
│   │   ├── sobre/page.tsx                # Sobre
│   │   ├── termos/page.tsx               # Termos de uso
│   │   ├── privacidade/page.tsx          # LGPD
│   │   ├── sign-in/                      # Login (Clerk)
│   │   ├── sign-up/                      # Cadastro (Clerk)
│   │   ├── (auth)/                       # Rotas autenticadas
│   │   │   ├── layout.tsx                # Sidebar + nav
│   │   │   ├── gerar/page.tsx            # Nova campanha
│   │   │   ├── gerar/demo/page.tsx       # Resultado da campanha
│   │   │   ├── historico/page.tsx        # Histórico
│   │   │   ├── modelo/page.tsx           # Modelo virtual
│   │   │   ├── configuracoes/page.tsx    # Configurações
│   │   │   └── plano/page.tsx            # Plano & billing
│   │   ├── admin/                        # Painel administrativo
│   │   │   ├── layout.tsx                # Layout admin + sidebar
│   │   │   ├── page.tsx                  # Dashboard (métricas)
│   │   │   ├── clientes/                 # Gestão de lojas
│   │   │   ├── campanhas/                # Campanhas geradas
│   │   │   ├── custos/                   # Custos de API
│   │   │   ├── logs/                     # Logs do sistema
│   │   │   ├── vitrine/                  # Upload antes/depois
│   │   │   └── configuracoes/            # Config do sistema
│   │   └── api/
│   │       ├── campaign/generate/        # Geração de campanha
│   │       ├── campaigns/                # CRUD campanhas
│   │       ├── checkout/                 # Mercado Pago checkout
│   │       ├── showcase/                 # Vitrine pública
│   │       ├── store/                    # Dados da loja
│   │       ├── inngest/                  # Webhook Inngest
│   │       ├── admin/showcase/           # Admin vitrine
│   │       └── webhooks/mercadopago/     # Webhook pagamentos
│   ├── lib/
│   │   ├── ai/                           # Pipeline IA
│   │   │   ├── anthropic.ts              # Client Anthropic
│   │   │   ├── prompts.ts                # Prompts (com plus size)
│   │   │   ├── pipeline.ts               # Orquestrador 5 etapas
│   │   │   └── mock-data.ts              # Dados demo
│   │   ├── db/index.ts                   # Queries Supabase
│   │   ├── fashn/                        # Virtual try-on
│   │   ├── payments/mercadopago.ts       # Planos & checkout
│   │   ├── analytics/posthog.tsx         # PostHog provider
│   │   ├── inngest/                      # Jobs assíncronos
│   │   ├── supabase/admin.ts             # Supabase service client
│   │   ├── rate-limit.ts                 # Rate limiter por IP
│   │   ├── schemas.ts                    # Zod schemas
│   │   └── utils.ts                      # Utilitários
│   ├── components/
│   │   ├── FloatingWhatsApp.tsx           # Botão WhatsApp
│   │   ├── ShowcaseSection.tsx            # Vitrine antes/depois
│   │   └── ui.tsx                         # Componentes base
│   ├── types/index.ts                     # TypeScript types
│   └── middleware.ts                      # Proteção de rotas (Clerk)
├── public/
│   ├── icon-192.png                       # PWA icon
│   ├── icon-512.png                       # PWA icon
│   └── zap-buton.png                      # WhatsApp icon
└── .env.local                             # Variáveis de ambiente
```

## 🔮 Pipeline de IA

```
📸 Foto da roupa
    ↓
🔍 Vision (Claude Sonnet) — Analisa produto, cor, material, mood, segmento
    ↓
🎯 Estrategista (Claude Sonnet) — Ângulo de venda, gatilho, tom, público
    ↓                                (+ contexto Plus Size se aplicável)
✍️ Copywriter (Claude Sonnet) — Textos para 4 canais
    ↓                            (linguagem body-positive se plus size)
✨ Refiner (Claude Haiku) — Polimento e naturalidade
    ↓
📊 Scorer (Claude Haiku) — Nota 0-100 + sugestões
    ↓
✅ Campanha pronta!
```

**Custo por campanha:** ~R$ 0,29 (apenas LLM)

## 🚀 Deploy (VPS)

```bash
# 1. Clonar
git clone https://github.com/Tibic4/Agencia-Fashion.git
cd Agencia-Fashion/campanha-ia

# 2. Instalar
npm install

# 3. Configurar variáveis
cp .env.example .env.local
# Preencher todas as variáveis (ver APIS_PLATAFORMAS.md)

# 4. Build
npm run build

# 5. Rodar com PM2
pm2 start npm --name "crialook" -- start
pm2 save
pm2 startup

# 6. Nginx (reverse proxy)
# Apontar domínio crialook.com.br → localhost:3000
# SSL com Certbot
```

## 🔒 Variáveis de Ambiente

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Anthropic (IA)
ANTHROPIC_API_KEY=

# Fashn.ai (Modelo Virtual)
FASHN_API_KEY=
FASHN_API_URL=

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# PostHog
POSTHOG_KEY=
POSTHOG_HOST=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Config
USD_BRL_EXCHANGE_RATE=5.80
NEXT_PUBLIC_APP_URL=https://crialook.com.br
```

## 📋 Status do Projeto

### ✅ Concluído
- [x] Landing page completa com design premium
- [x] Sistema de autenticação (Clerk + Google)
- [x] Onboarding wizard (3 steps)
- [x] Pipeline de IA (5 agentes Claude)
- [x] Geração de campanhas para 4 canais
- [x] Página de resultados dinâmica
- [x] Histórico de campanhas
- [x] Sistema de planos (Grátis → Agência)
- [x] Checkout Mercado Pago
- [x] Upload de imagens p/ Supabase Storage
- [x] Painel Admin (dashboard, clientes, campanhas, custos, logs)
- [x] Vitrine Antes/Depois (admin drag & drop → landing page)
- [x] WhatsApp flutuante (heartbeat pulse)
- [x] Rate limiting anti-abuso por IP
- [x] Suporte Plus Size (linguagem body-positive)
- [x] SEO (sitemap, robots, meta tags, Open Graph)
- [x] PWA (manifest + ícones)
- [x] Páginas legais (Termos, Privacidade, LGPD)
- [x] Monitoramento (Sentry + PostHog + Inngest)
- [x] Proteção de créditos (não cobra se falhar)

### 🔜 Próximos Passos
- [ ] Deploy na VPS (PM2 + Nginx + SSL)
- [ ] Configurar DNS crialook.com.br
- [ ] Criar planos de assinatura no Mercado Pago
- [ ] Configurar webhook Mercado Pago (IPN)
- [ ] Implementar "Regerar" campanha
- [ ] Implementar "Baixar PNG"
- [ ] Canal Reels/TikTok (script 15-30s)
- [ ] CI/CD (GitHub Actions → SSH deploy)

## 📚 Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `APIS_PLATAFORMAS.md` | Todas as APIs, chaves e configurações |
| `MONITORAMENTO_GUIA.md` | Guia prático Sentry, PostHog, Inngest |
| `01_ARQUITETURA_GERAL.md` | Arquitetura técnica do sistema |
| `02_BANCO_DE_DADOS.md` | Schema do banco Supabase |
| `03_PIPELINE_IA.md` | Detalhes do pipeline de IA |
| `05_PAINEL_ADMIN.md` | Especificação do painel admin |

## 📄 Licença

Proprietário — Todos os direitos reservados.
