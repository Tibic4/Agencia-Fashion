# 📋 CAMPANHA IA — Checkpoints do Projeto

> Marcar com `[x]` conforme cada item for concluído.
> Última atualização: 2026-04-04 (DB completo + Mercado Pago)

---

## FASE 0 — Setup Inicial ✅
- [x] Criar projeto Next.js 16 (App Router)
- [x] Configurar Tailwind CSS v4
- [ ] Instalar shadcn/ui
- [x] Configurar Supabase SDK (client, server, admin)
- [x] Configurar variáveis de ambiente (.env.local)
- [x] Criar estrutura de pastas (src/app, lib, components)
- [x] Configurar ESLint

## FASE 1 — Banco de Dados (Supabase) ✅
- [x] Migration: tabela `plans`
- [x] Migration: tabela `stores`
- [x] Migration: tabela `store_models`
- [x] Migration: tabela `campaigns`
- [x] Migration: tabela `campaign_outputs`
- [x] Migration: tabela `campaign_scores`
- [x] Migration: tabela `store_usage`
- [x] Migration: tabela `api_cost_logs`
- [x] Migration: tabela `admin_settings`
- [x] Migration: tabela `credit_purchases`
- [x] Configurar RLS em todas as tabelas (0 alertas segurança)
- [x] Criar Storage Buckets (product-photos, generated-images, store-logos, model-previews)
- [x] Seed: dados iniciais dos planos (5 planos)
- [x] Seed: admin_settings padrão (9 configs)
- [x] Renomear colunas Stripe → Mercado Pago
- [x] Triggers `updated_at` (stores, campaigns)
- [x] Funções helper (`can_generate_campaign`, `increment_campaign_usage`)
- [x] Views (`v_store_dashboard`, `v_admin_metrics`)
- [x] Storage Policies (upload, view, delete por bucket)
- [x] TypeScript types gerados (`database.types.ts`)

## FASE 2 — Auth (Clerk) 🔄
- [x] Instalar @clerk/nextjs + @clerk/localizations
- [x] Configurar middleware de auth (rotas protegidas)
- [x] Criar pages de sign-in e sign-up (dark theme)
- [ ] Configurar webhook Clerk → Supabase (criar store)
- [x] Proteger rotas autenticadas
- [ ] Configurar role admin

## FASE 3 — Landing Page
- [ ] Layout público (header, footer)
- [ ] Hero section
- [ ] Seção de benefícios
- [ ] Seção de como funciona (3 passos)
- [ ] Demo interativa / antes-depois
- [ ] Seção de pricing (5 planos)
- [ ] Seção de depoimentos
- [ ] CTA final
- [ ] SEO (meta tags, Open Graph)
- [ ] Responsivo mobile

## FASE 4 — Onboarding
- [ ] Wizard etapa 1: dados da loja
- [ ] Seletor de segmento com ícones
- [ ] Upload de logo para Supabase Storage
- [ ] Wizard etapa 2: modelo virtual (moda apenas)
- [ ] Wizard etapa 3: conclusão + redirect
- [ ] Guard: redirecionar para onboarding se não completou
- [ ] Salvar dados em `stores`

## FASE 5 — Pipeline de IA
- [ ] Implementar Skill 0: Vision Analyzer
- [ ] Implementar Skill 1: Estrategista
- [ ] Implementar Skill 2: Copywriter
- [ ] Implementar Skill 3: Refinador
- [ ] Implementar Skill 4: Scorer + Meta Compliance
- [ ] Orquestrador do pipeline (`pipeline.ts`)
- [ ] Validação com Zod Schemas em cada etapa
- [ ] Sistema de retry com backoff
- [ ] Log de custos em `api_cost_logs`
- [ ] Progresso em tempo real (SSE ou Supabase Realtime)

## FASE 6 — Geração de Campanha (UI)
- [ ] Tela de upload + preço (`/gerar`)
- [ ] Opções avançadas colapsáveis
- [ ] Verificação de cota antes de gerar
- [ ] Tela de progresso com steps animados
- [ ] Tela de resultado com abas por canal
- [ ] Copiar texto 1-clique
- [ ] Download de criativo (PNG)
- [ ] Aba de Score com barras visuais
- [ ] Sistema de alertas Meta Ads
- [ ] Regeneração parcial (copy ou imagem)

## FASE 7 — Processamento de Imagem (Moda)
- [ ] Integração Fashn.ai (try-on) ⭐ CORE
- [ ] Integração Stability AI (remoção de fundo)
- [ ] Composição de criativo Feed 1:1 (Konva.js)
- [ ] Composição de criativo Stories 9:16 (Konva.js)
- [ ] Overlay de texto + preço + logo nos criativos

## FASE 8 — Modelo Virtual
- [ ] Tela de criação da modelo (`/modelo`)
- [ ] Integração Fashn.ai Model Create (4 variações)
- [ ] Seleção + salvamento do modelo escolhido
- [ ] Gestão de múltiplos modelos (planos Pro+)
- [ ] Preview do modelo na tela de geração

## FASE 9 — Pagamentos (Mercado Pago)
- [ ] Criar planos de assinatura no Mercado Pago
- [ ] Checkout Pro para upgrade de plano
- [ ] Pagamento avulso para créditos extras (PIX/Cartão)
- [ ] Webhook IPN Mercado Pago → atualizar plano/créditos
- [ ] Tela de gestão de plano (`/plano`)
- [x] Verificação de limites em cada geração (função `can_generate_campaign`)
- [ ] Tela de bloqueio suave (cota esgotada)
- [ ] Configurar MCP Server Mercado Pago no IDE

## FASE 10 — Painel do Lojista
- [ ] Histórico de campanhas com filtros
- [ ] Configurações da loja (editar dados)
- [ ] Tela de plano e faturamento
- [ ] Indicador de uso (X/Y campanhas usadas)

## FASE 11 — Painel Admin
- [ ] Dashboard com cards de resumo
- [ ] Gráficos de campanhas/dia e custo/dia
- [ ] Lista de clientes com filtros
- [ ] Detalhe do cliente
- [ ] Controle de custos API por provider
- [ ] Configurações de budget e alertas
- [ ] Lista de campanhas (admin view)
- [ ] Logs e debug de erros
- [ ] KPIs de negócio e produto

## FASE 12 — Polimento e Deploy
- [ ] Testes E2E (fluxos críticos)
- [ ] Tratamento de erros global
- [ ] Loading states e skeletons
- [ ] Sentry configurado
- [ ] PostHog eventos de funil
- [ ] Deploy Vercel (produção)
- [ ] Domínio customizado
- [ ] Health check endpoint

---

**Total: ~95 checkpoints em 13 fases**
