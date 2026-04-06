# ⚡ CAMPANHA IA — Guia Completo de Implementação

## Parte 1: Arquitetura Geral, Stack e Fluxo de Usuário

---

## 1. VISÃO GERAL DO PRODUTO

**Campanha IA** é um SaaS que transforma qualquer foto de produto em campanha de marketing completa em menos de 60 segundos.

**Público:** Lojistas de varejo físico brasileiro (classes B/C/D) que não entendem de marketing, design nem IA.

**Premissa:** O lojista tira uma foto, informa o preço — o sistema faz o resto. Cada campo a mais é uma desistência a mais.

---

## 2. STACK TECNOLÓGICO DEFINITIVO

### 2.1 Frontend & Backend

| Camada | Tecnologia | Versão | Justificativa |
|--------|-----------|--------|---------------|
| Frontend | Next.js (App Router) | 14+ | SSR nativo, performance, SEO, deploy Vercel em 1 clique |
| Estilo | Tailwind CSS + shadcn/ui | v4 + latest | Design system pronto, dark/light, acessível |
| Estado | Zustand | latest | Estado global leve sem boilerplate |
| Backend API | Next.js API Routes + Server Actions | - | Zero servidor separado no MVP |
| Banco de dados | Supabase (PostgreSQL) | - | RLS nativo, Storage de imagens, Realtime, SDK JS |
| Auth | Clerk | - | Login Google/Email/WhatsApp, gestão de planos, webhooks |
| Pagamentos | Stripe | - | Recorrência, PIX, cartão BR, portal self-service |
| Deploy | Vercel + Supabase Cloud | - | Zero DevOps, escala automática, CI/CD |
| Monitoramento | Vercel Analytics + Sentry + PostHog | - | Performance + erros + funil de conversão |
| Filas/Jobs | Inngest ou Vercel Cron | - | Pipeline assíncrono sem infraestrutura |

### 2.2 Pipeline de IA (Implementação Atual)

| Etapa | Tecnologia | Modelo/API | Custo estimado | Status |
|-------|-----------|------------|----------------|--------|
| Análise da imagem | Google Gemini | gemini-2.0-flash | ~R$ 0,02/req | ✅ Implementado |
| Geração de textos | Google Gemini | gemini-2.0-flash | ~R$ 0,03/req | ✅ Implementado |
| Headline + CTA | Google Gemini | gemini-2.0-flash | ~R$ 0,02/req | ✅ Implementado |
| Score da campanha | Google Gemini | gemini-2.0-flash | ~R$ 0,01/req | ✅ Implementado |
| Try-on moda | Fashn.ai | Product to Model | ~R$ 0,43/req | ✅ Implementado |
| Criativo final | Konva.js (Canvas) | Browser-side | R$ 0,00 | ✅ Implementado |
| **TOTAL por geração** | - | - | **~R$ 0,08–0,51** | - |

> 💡 **Decisão**: Usamos Google Gemini como LLM principal (custo ~5x menor que Anthropic). O Konva.js roda 100% no browser (custo zero de composição).

### 2.3 Fallbacks de Vendor

| Vendor principal | Fallback 1 | Fallback 2 |
|-----------------|------------|------------|
| Fashn.ai (try-on) | Kolors Virtual Try-On | IDM-VTON (self-hosted) |
| Google Gemini (LLM) | Anthropic Claude Sonnet | OpenAI GPT-4o |
| Konva.js (composição) | Server-side Canvas | Stability AI SDXL |

### 2.4 Compositor Interativo (Konva.js)

O compositor de criativos roda **100% client-side** usando `react-konva`, permitindo edição visual sem custos de API.

| Funcionalidade | Descrição |
|----------------|----------|
| **Drag & Drop** | Todos os textos (nome, preço, headline, CTA, badges) são arrastáveis |
| **5 Templates** | Normal (sem overlay), Elegante Escuro, Clean Claro, Rosa Vibrante, Gold Luxo |
| **Zoom −/+** | Controles para aumentar/diminuir o canvas no preview |
| **Export HD** | Download PNG em 1080×1350 (feed) ou 1080×1920 (story) com pixelRatio 2x |
| **Responsivo** | Scale dinâmico baseado na largura do container (funciona mobile e desktop) |
| **Reset** | Botão para restaurar posições originais dos elementos |

**Arquivo principal:** `src/components/KonvaCompositor.tsx`

**Pipeline de prompts Fashn.ai:**
- Instrução anti-etiqueta: remove automaticamente price tags, barcodes e etiquetas de loja
- Preserva acessórios funcionais (cintos, colares, relógios)
- Background neutro profissional (estúdio fotográfico)

**Arquivo de config:** `src/lib/fashn/client.ts`

---

## 3. FLUXO COMPLETO DO USUÁRIO

```
┌─────────────────────────────────────────────────────────────────┐
│                    JORNADA DO LOJISTA                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. LANDING PAGE ──→ CTA "Começar grátis"                       │
│        │                                                         │
│  2. CADASTRO (Clerk) ──→ Google / Email / WhatsApp              │
│        │                                                         │
│  3. ONBOARDING (1x, <2 min)                                     │
│     ├── 3.1 Dados da Loja (nome, segmento, cidade, logo)        │
│     ├── 3.2 Modelo Virtual (só moda) ──→ 4 opções, escolhe 1   │
│     └── 3.3 Concluído → "Gerar minha primeira campanha"        │
│        │                                                         │
│  4. GERAÇÃO DE CAMPANHA (toda vez)                               │
│     ├── 4.1 Upload foto + preço (+ público/objetivo opcionais)  │
│     ├── 4.2 Pipeline IA (25-40s com progresso em tempo real)    │
│     └── 4.3 Resultado em abas por canal                         │
│        │                                                         │
│  5. USO DO RESULTADO                                             │
│     ├── Copiar texto 1-clique                                    │
│     ├── Baixar criativo PNG                                      │
│     ├── Regerar copy ou imagem separadamente                     │
│     ├── Ver Score + alertas Meta                                 │
│     └── Salvar no histórico                                      │
│        │                                                         │
│  6. PAINEL DO LOJISTA                                            │
│     ├── Histórico de campanhas                                   │
│     ├── Modelo virtual (trocar/criar)                            │
│     ├── Dados da loja (editar)                                   │
│     └── Plano e faturamento (Stripe portal)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. PÁGINAS DO APLICATIVO

### 4.1 Páginas Públicas (sem auth)

| Rota | Página | Conteúdo |
|------|--------|----------|
| `/` | Landing Page | Hero, benefícios, demo, pricing, depoimentos, CTA |
| `/precos` | Pricing | 3 planos detalhados com comparação |
| `/sobre` | Sobre | Missão, equipe, contato |
| `/termos` | Termos de Uso | Jurídico |
| `/privacidade` | Política de Privacidade | LGPD |

### 4.2 Páginas Autenticadas (lojista)

| Rota | Página | Conteúdo |
|------|--------|----------|
| `/onboarding` | Onboarding | Wizard 3 etapas (dados, modelo, conclusão) |
| `/gerar` | Nova Campanha | Upload + preço + opções avançadas |
| `/gerar/[id]` | Resultado | Abas por canal + score + download |
| `/historico` | Histórico | Lista de campanhas com busca e filtros |
| `/modelo` | Modelo Virtual | Ver/trocar/criar modelo |
| `/configuracoes` | Configurações | Dados da loja, preferências |
| `/plano` | Plano & Faturamento | Stripe Customer Portal embed |

### 4.3 Páginas Admin (painel interno)

| Rota | Página | Conteúdo |
|------|--------|----------|
| `/admin` | Dashboard | Métricas gerais, receita, custos API |
| `/admin/clientes` | Clientes | Lista, busca, detalhes, campanhas por cliente |
| `/admin/custos` | Custos API | Gastos por provider, por dia, alertas |
| `/admin/campanhas` | Campanhas | Todas as gerações, filtros, detalhes |
| `/admin/planos` | Planos | Gestão de planos e limites |
| `/admin/logs` | Logs | Erros, falhas de pipeline, debug |

---

## 5. PLANOS, CUSTOS E MARGENS

### 5.1 Custo Real por Operação

| Operação | Detalhamento | Custo (R$) |
|----------|-------------|------------|
| **Campanha MODA** (com try-on) | Vision R$0,08 + Estrategista R$0,06 + Copywriter R$0,10 + Refinador R$0,03 + Scorer R$0,02 + Fashn try-on R$0,43 + Remoção fundo R$0,05 | **R$ 0,77** |
| **Campanha NÃO-MODA** (sem try-on) | Vision R$0,08 + Estrategista R$0,06 + Copywriter R$0,10 + Refinador R$0,03 + Scorer R$0,02 + Remoção fundo R$0,05 + Lifestyle DALL-E R$0,23 | **R$ 0,57** |
| **Média ponderada** (60% moda, 40% não-moda) | — | **R$ 0,69** |
| **Regeneração de copy** | Copywriter R$0,10 + Refinador R$0,03 + Scorer R$0,02 | **R$ 0,15** |
| **Regeneração de imagem** | Fashn/DALL-E R$0,23–0,43 + composição R$0 | **R$ 0,33** |
| **Regeneração completa** | Pipeline inteiro | **R$ 0,69** |
| **Criação de modelo** | Fashn.ai Model Create (4 samples) | **R$ 1,72** |

### 5.2 Planos Revisados (Margem Mínima 40% Garantida — modo A+ com modelo+fundo)

| Recurso | 🆓 Grátis | ⭐ Starter (R$ 59/mês) | 🚀 Pro (R$ 129/mês) | 🏢 Business (R$ 249/mês) | 🏆 Agência (R$ 499/mês) |
|---------|-----------|----------------------|--------------------|-----------------------|------------------------|
| Campanhas/mês | 3 | 15 | 40 | 85 | 170 |
| Canais por campanha | Feed + WhatsApp | Todos (4) | Todos (4) | Todos (4) | Todos (4) |
| Modelos virtuais | 0 (usa stock) | 1 | 2 | 3 | 5 |
| Criações de modelo/mês | 0 | 1 | 2 | 3 | 5 |
| Regenerações/campanha | 0 | 2 | 3 | 3 | 3 |
| Modelo + fundo profissional | ❌ | ✅ | ✅ | ✅ | ✅ |
| Histórico | 7 dias | 90 dias | 1 ano | Ilimitado | Ilimitado |
| Score + alertas Meta | Nota geral só | Completo | Completo | Completo | Completo |
| Link de prévia | ❌ | ❌ | ✅ | ✅ | ✅ |
| Marca branca | ❌ | ❌ | ❌ | ❌ | ✅ |
| API pública | ❌ | ❌ | ❌ | ❌ | ✅ |
| Suporte | — | Email | Email | WhatsApp | WhatsApp prioritário |

> ⚠️ **NENHUM plano é "ilimitado" em campanhas.** Para usar mais, o lojista compra créditos extras (seção 5.4).

### 5.3 Análise de Margem por Plano

**Cenário PIOR CASO: uso 100% do limite + TODAS as regenerações máximas**
**Fórmula:** custo = (campanhas × R$0,69) + (campanhas × regen/camp × R$0,15) + (modelos × R$1,72)

| Plano | Receita | Campanhas | Custo camp. | Regen máx | Custo regen | Modelos | Custo mod. | **Custo Total** | **Margem R$** | **Margem %** |
|-------|---------|-----------|-------------|----------|-------------|---------|-----------|----------------|--------------|-------------|
| 🆓 Grátis | R$ 0 | 3 | R$ 2,07 | 0 | R$ 0 | 0 | R$ 0 | **R$ 2,07** | **-R$ 2,07** | Loss leader |
| ⭐ Starter | R$ 59 | 15 | R$ 10,35 | 30 | R$ 4,50 | 1 | R$ 1,72 | **R$ 16,57** | **R$ 42,43** | **71,9%** ✅ |
| 🚀 Pro | R$ 129 | 40 | R$ 27,60 | 120 | R$ 18,00 | 2 | R$ 3,44 | **R$ 49,04** | **R$ 79,96** | **62,0%** ✅ |
| 🏢 Business | R$ 249 | 100 | R$ 69,00 | 500 | R$ 75,00 | 3 | R$ 5,16 | **R$ 149,16** | **R$ 99,84** | **40,1%** ✅ |
| 🏆 Agência | R$ 499 | 200 | R$ 138,00 | 1000 | R$ 150,00 | 5 | R$ 8,60 | **R$ 296,60** | **R$ 202,40** | **40,6%** ✅ |

> ✅ **Todos os planos pagos têm margem mínima ≥ 40% mesmo no pior cenário possível.**

**Cenário USO MÉDIO: 60% do limite + 20% das campanhas com 1 regeneração**

| Plano | Receita | Camp. usadas | Custo camp. | Regen | Custo regen | Modelos | Custo mod. | **Custo Total** | **Margem R$** | **Margem %** |
|-------|---------|-------------|-------------|-------|-------------|---------|-----------|----------------|--------------|-------------|
| 🆓 Grátis | R$ 0 | 2 | R$ 1,38 | 0 | R$ 0 | 0 | R$ 0 | **R$ 1,38** | **-R$ 1,38** | Loss leader |
| ⭐ Starter | R$ 59 | 9 | R$ 6,21 | 2 | R$ 0,30 | 0,5 | R$ 0,86 | **R$ 7,37** | **R$ 51,63** | **87,5%** |
| 🚀 Pro | R$ 129 | 24 | R$ 16,56 | 5 | R$ 0,75 | 1 | R$ 1,72 | **R$ 19,03** | **R$ 109,97** | **85,2%** |
| 🏢 Business | R$ 249 | 60 | R$ 41,40 | 12 | R$ 1,80 | 2 | R$ 3,44 | **R$ 46,64** | **R$ 202,36** | **81,3%** |
| 🏆 Agência | R$ 499 | 120 | R$ 82,80 | 24 | R$ 3,60 | 3 | R$ 5,16 | **R$ 91,56** | **R$ 407,44** | **81,7%** |

### 5.4 Créditos Extras (compra avulsa)

**Regra de ouro:** O preço avulso é **2x a 3x** mais caro por unidade que o valor do plano.
Isso incentiva o upgrade em vez da compra avulsa.

| Item avulso | Preço unitário | Comparação com plano |
|-------------|---------------|---------------------|
| **+5 campanhas** | R$ 14,90 (R$ 2,98/cada) | Starter: R$ 2,95/camp no plano — avulso é +1% mais caro |
| **+10 campanhas** | R$ 24,90 (R$ 2,49/cada) | Pro: R$ 2,15/camp no plano — avulso é +16% mais caro |
| **+25 campanhas** | R$ 49,90 (R$ 2,00/cada) | Business: R$ 1,66/camp no plano — avulso é +20% mais caro |
| **+1 modelo virtual** | R$ 9,90 | Custo real: R$ 1,72 — margem: R$ 8,18 (82%) |
| **+3 modelos virtuais** | R$ 19,90 | Custo real: R$ 5,16 — margem: R$ 14,74 (74%) |
| **+10 regenerações** | R$ 4,90 | Custo real: R$ 1,50 — margem: R$ 3,40 (69%) |

### 5.5 Lógica de Esgotamento de Cota

```
┌─ Lojista tenta gerar campanha ─────────────────────┐
│                                                      │
│  ✅ Cota disponível?                                 │
│  ├── SIM → Gera normalmente                         │
│  └── NÃO → Tela de bloqueio suave                   │
│       │                                              │
│       │  ┌──────────────────────────────────┐        │
│       │  │ 😮 Suas 20 campanhas do mês      │        │
│       │  │ acabaram! Mas calma...            │        │
│       │  │                                    │        │
│       │  │ 💡 OPÇÃO 1: Upgrade para Pro      │        │
│       │  │    R$ 129/mês → 60 campanhas      │        │
│       │  │    Economize R$ 1,66/campanha     │        │
│       │  │    [Fazer upgrade →]               │        │
│       │  │                                    │        │
│       │  │ ⚡ OPÇÃO 2: Comprar avulso         │        │
│       │  │    +5 por R$ 14,90                │        │
│       │  │    +10 por R$ 24,90               │        │
│       │  │    [Comprar créditos]              │        │
│       │  │                                    │        │
│       │  │ 📅 Sua cota renova em 12 dias     │        │
│       │  └──────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

**Se esgotou MODELOS:**
```
┌──────────────────────────────────────────┐
│ Você já criou 1 modelo este mês.         │
│                                          │
│ 💡 Upgrade para Pro → 2 modelos/mês     │
│    [Fazer upgrade →]                     │
│                                          │
│ ⚡ Ou compre avulso:                     │
│    +1 modelo por R$ 9,90                │
│    [Comprar modelo extra]               │
│                                          │
│ ℹ️ Modelos já criados continuam         │
│    disponíveis — não expiram!            │
└──────────────────────────────────────────┘
```

### 5.6 Regras de Upgrade/Downgrade

| Ação | O que acontece |
|------|---------------|
| **Upgrade imediato** | Stripe pro-rata: cobra proporcional ao tempo restante do mês. Novo limite ativo IMEDIATAMENTE. Campanhas já usadas são mantidas no contador. |
| **Downgrade** | Efetivo no PRÓXIMO ciclo de faturamento. Mantém acesso atual até o fim do período pago. Se tinha 3 modelos e vai para plano de 1, os 3 modelos continuam existindo, mas não pode criar novos até estar abaixo do limite. |
| **Cancelamento** | Downgrade para Grátis no fim do ciclo. Histórico além de 7 dias fica inacessível (não deletado). Modelos ficam salvos por 90 dias. |
| **Créditos avulsos** | Pagamento único via Stripe Checkout. Não renovam — são consumíveis. Expiram no fim do mês de compra. Não acumulam para o mês seguinte. |

### 5.7 Tabela no Banco (plan extras)

```sql
CREATE TABLE credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  type TEXT NOT NULL,              -- 'campaigns' | 'models' | 'regenerations'
  quantity INTEGER NOT NULL,       -- 5, 10, 25, 1, 3, 10
  price_brl DECIMAL(10,2) NOT NULL,
  stripe_payment_id TEXT,
  period_start DATE NOT NULL,      -- Mês de validade
  period_end DATE NOT NULL,
  consumed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. ESTRUTURA DE PASTAS DO PROJETO

```
campanha-ia/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (public)/                 # Páginas públicas
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── precos/page.tsx
│   │   │   └── sobre/page.tsx
│   │   ├── (auth)/                   # Páginas autenticadas
│   │   │   ├── onboarding/
│   │   │   ├── gerar/
│   │   │   │   ├── page.tsx          # Nova campanha
│   │   │   │   └── [id]/page.tsx     # Resultado
│   │   │   ├── historico/page.tsx
│   │   │   ├── modelo/page.tsx
│   │   │   ├── configuracoes/page.tsx
│   │   │   └── plano/page.tsx
│   │   ├── admin/                    # Painel admin
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── clientes/page.tsx
│   │   │   ├── custos/page.tsx
│   │   │   ├── campanhas/page.tsx
│   │   │   └── logs/page.tsx
│   │   ├── api/                      # API Routes
│   │   │   ├── campaign/
│   │   │   │   ├── generate/route.ts
│   │   │   │   ├── regenerate/route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── model/
│   │   │   │   ├── create/route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── webhook/
│   │   │   │   ├── clerk/route.ts
│   │   │   │   └── stripe/route.ts
│   │   │   └── admin/
│   │   │       ├── stats/route.ts
│   │   │       └── costs/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── campaign/                 # Componentes de campanha
│   │   ├── onboarding/               # Componentes de onboarding
│   │   ├── admin/                    # Componentes admin
│   │   └── shared/                   # Componentes compartilhados
│   ├── lib/
│   │   ├── ai/                       # Pipeline de IA
│   │   │   ├── vision.ts
│   │   │   ├── strategist.ts
│   │   │   ├── copywriter.ts
│   │   │   ├── refiner.ts
│   │   │   ├── scorer.ts
│   │   │   └── pipeline.ts           # Orquestrador
│   │   ├── image/                    # Processamento de imagem
│   │   │   ├── fashn.ts
│   │   │   ├── stability.ts
│   │   │   └── compose.ts
│   │   ├── db/                       # Supabase client & queries
│   │   │   ├── client.ts
│   │   │   └── queries.ts
│   │   ├── stripe/                   # Stripe helpers
│   │   ├── clerk/                    # Clerk helpers
│   │   └── utils/                    # Utilitários gerais
│   ├── hooks/                        # React hooks customizados
│   ├── stores/                       # Zustand stores
│   └── types/                        # TypeScript types
├── supabase/
│   └── migrations/                   # SQL migrations
├── public/
│   ├── fonts/
│   └── images/
├── .env.local
├── next.config.ts
├── tailwind.config.ts
└── package.json
```
