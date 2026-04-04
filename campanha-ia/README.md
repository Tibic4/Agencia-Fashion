# 🎯 Campanha IA — Marketing de Moda com IA

> Transforme fotos de roupa em campanhas de marketing prontas em 60 segundos.

SaaS para lojistas de moda brasileiros que automatiza a criação de campanhas para Instagram, WhatsApp e Meta Ads usando Inteligência Artificial.

## ✨ Features

- 📸 **Upload & Go** — Tire a foto da peça, a IA faz o resto
- 🤖 **Pipeline de 5 agentes IA** — Vision → Estratégia → Copy → Refinamento → Score
- 📱 **4 canais** — Instagram Feed, Stories, WhatsApp e Meta Ads
- 👩 **Modelo Virtual** — IA veste a roupa em uma modelo digital
- 📊 **Score de qualidade** — Nota 0-100 com sugestões de melhoria
- 💰 **Freemium** — 3 campanhas/mês grátis

## 🛠️ Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router + Turbopack) |
| Linguagem | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| IA | Anthropic Claude (Vision + Text) |
| Auth | Clerk (a configurar) |
| Database | Supabase (a configurar) |
| Pagamentos | Stripe (a configurar) |
| Deploy | Vercel |

## 📁 Estrutura

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout + SEO
│   ├── loading.tsx                 # Loading global
│   ├── not-found.tsx               # 404
│   ├── sitemap.ts                  # Sitemap dinâmico
│   ├── robots.ts                   # robots.txt
│   ├── manifest.ts                 # PWA manifest
│   ├── globals.css                 # Design system
│   ├── login/page.tsx              # Login
│   ├── cadastro/page.tsx           # Registro
│   ├── onboarding/page.tsx         # Wizard 3 steps
│   ├── sobre/page.tsx              # Sobre
│   ├── termos/page.tsx             # Termos de uso
│   ├── privacidade/page.tsx        # LGPD
│   ├── (auth)/                     # Rotas autenticadas
│   │   ├── layout.tsx              # Sidebar + nav
│   │   ├── gerar/page.tsx          # Nova campanha
│   │   ├── gerar/demo/page.tsx     # Resultado
│   │   ├── historico/page.tsx      # Histórico
│   │   ├── modelo/page.tsx         # Modelo virtual
│   │   ├── configuracoes/page.tsx  # Configurações
│   │   └── plano/page.tsx          # Plano & billing
│   └── api/
│       └── campaign/generate/route.ts  # API de geração
├── lib/
│   ├── ai/
│   │   ├── anthropic.ts            # Client Anthropic
│   │   ├── prompts.ts              # 5 prompts do pipeline
│   │   └── pipeline.ts             # Orquestrador
│   ├── schemas.ts                  # Zod schemas
│   └── utils.ts                    # Utilitários
├── hooks/
│   └── useGenerateCampaign.ts      # Hook de geração
├── components/
│   └── ui.tsx                      # Componentes reutilizáveis
├── types/
│   └── index.ts                    # TypeScript types
└── middleware.ts                   # Proteção de rotas
```

## 🚀 Começando

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env.local

# Preencher ANTHROPIC_API_KEY em .env.local

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build
```

## 🔮 Pipeline de IA

```
📸 Foto da roupa
    ↓
🔍 Vision (Claude) — Analisa produto, cor, material, mood
    ↓
🎯 Estrategista — Define ângulo, gatilho, tom, público
    ↓
✍️ Copywriter — Gera textos para 4 canais
    ↓
✨ Refiner — Polimento e naturalidade
    ↓
📊 Scorer — Nota 0-100 + sugestões
    ↓
✅ Campanha pronta!
```

## 📋 TODO

- [ ] Configurar Clerk (auth)
- [ ] Configurar Supabase (banco)
- [ ] Integrar Stripe (pagamentos)
- [ ] Integrar Fashn.ai (modelo virtual)
- [ ] Deploy na Vercel

## 📄 Licença

Proprietário — Todos os direitos reservados.
