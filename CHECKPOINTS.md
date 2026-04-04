# 📋 CAMPANHA IA — Checkpoints do Projeto

> Marcar com `[x]` conforme cada item for concluído.
> Última atualização: 2026-04-04

---

## FASE 0 — Setup Inicial
- [ ] Criar projeto Next.js 14 (App Router)
- [ ] Configurar Tailwind CSS v4
- [ ] Instalar shadcn/ui
- [ ] Configurar Supabase SDK
- [ ] Configurar variáveis de ambiente (.env.local)
- [ ] Criar estrutura de pastas (src/app, lib, components)
- [ ] Configurar ESLint + Prettier

## FASE 1 — Banco de Dados (Supabase)
- [ ] Migration: tabela `plans`
- [ ] Migration: tabela `stores`
- [ ] Migration: tabela `store_models`
- [ ] Migration: tabela `campaigns`
- [ ] Migration: tabela `campaign_outputs`
- [ ] Migration: tabela `campaign_scores`
- [ ] Migration: tabela `store_usage`
- [ ] Migration: tabela `api_cost_logs`
- [ ] Migration: tabela `admin_settings`
- [ ] Migration: tabela `credit_purchases`
- [ ] Configurar RLS em todas as tabelas
- [ ] Criar Storage Buckets (product-photos, generated-images, store-logos, model-previews)
- [ ] Seed: dados iniciais dos planos
- [ ] Seed: admin_settings padrão

## FASE 2 — Auth (Clerk)
- [ ] Instalar @clerk/nextjs
- [ ] Configurar middleware de auth
- [ ] Criar pages de sign-in e sign-up
- [ ] Configurar webhook Clerk → Supabase (criar store)
- [ ] Proteger rotas autenticadas
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

## FASE 7 — Processamento de Imagem
- [ ] Integração Fashn.ai (try-on)
- [ ] Integração Stability AI (remoção de fundo)
- [ ] Integração DALL-E 3 (lifestyle)
- [ ] Composição de criativo Feed 1:1 (Konva.js)
- [ ] Composição de criativo Stories 9:16 (Konva.js)
- [ ] Overlay de texto + preço + logo nos criativos

## FASE 8 — Modelo Virtual
- [ ] Tela de criação da modelo (`/modelo`)
- [ ] Integração Fashn.ai Model Create (4 variações)
- [ ] Seleção + salvamento do modelo escolhido
- [ ] Gestão de múltiplos modelos (planos Pro+)
- [ ] Preview do modelo na tela de geração

## FASE 9 — Pagamentos (Stripe)
- [ ] Criar produtos e preços no Stripe
- [ ] Checkout para upgrade de plano
- [ ] Checkout para créditos extras
- [ ] Webhook Stripe → atualizar plano/créditos
- [ ] Customer Portal embed (`/plano`)
- [ ] Verificação de limites em cada geração
- [ ] Tela de bloqueio suave (cota esgotada)

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
