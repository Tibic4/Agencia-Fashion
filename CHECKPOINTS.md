# 📋 CriaLook — Checkpoints do Projeto

> Marcar com `[x]` conforme cada item for concluído.
> Última atualização: 2026-04-04

---

## FASE 0 — Setup Inicial ✅
- [x] Criar projeto Next.js 16 (App Router)
- [x] Configurar Tailwind CSS v4
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
- [x] Migration: tabela `showcase_items`
- [x] Configurar RLS em todas as tabelas (0 alertas segurança)
- [x] Criar Storage Buckets (product-photos, generated-images, store-logos, model-previews, showcase)
- [x] Seed: dados iniciais dos planos (5 planos)
- [x] Seed: admin_settings padrão (9 configs)
- [x] Renomear colunas Stripe → Mercado Pago
- [x] Triggers `updated_at`
- [x] Funções helper (`can_generate_campaign`, `increment_campaign_usage`)
- [x] Views (`v_store_dashboard`, `v_admin_metrics`)
- [x] Storage Policies

## FASE 2 — Auth (Clerk) ✅
- [x] Instalar @clerk/nextjs + @clerk/localizations
- [x] Configurar middleware de auth (rotas protegidas)
- [x] Criar pages de sign-in e sign-up (dark theme)
- [x] Proteger rotas autenticadas
- [ ] Configurar webhook Clerk → Supabase (criar store auto)
- [ ] Configurar role admin no Clerk Dashboard

## FASE 3 — Landing Page ✅
- [x] Layout público (header, footer)
- [x] Hero section com gradiente e animações
- [x] Seção de benefícios
- [x] Seção "Como funciona" (3 passos)
- [x] Demo interativa (mockup do app)
- [x] Vitrine Antes/Depois (dinâmica via admin)
- [x] Seção de pricing (4 planos com toggle)
- [x] CTA final
- [x] SEO (meta tags, Open Graph, sitemap, robots)
- [x] Responsivo mobile
- [x] WhatsApp flutuante (heartbeat pulse)

## FASE 4 — Onboarding ✅
- [x] Wizard etapa 1: dados da loja + segmento
- [x] Wizard etapa 2: modelo virtual
- [x] Wizard etapa 3: conclusão + redirect
- [x] Guard: redirecionar para onboarding se não completou
- [x] Salvar dados em `stores`

## FASE 5 — Pipeline de IA ✅
- [x] Implementar Vision Analyzer (Claude Sonnet)
- [x] Implementar Estrategista (Claude Sonnet)
- [x] Implementar Copywriter (Claude Sonnet)
- [x] Implementar Refinador (Claude Haiku)
- [x] Implementar Scorer (Claude Haiku)
- [x] Orquestrador do pipeline (`pipeline.ts`)
- [x] Validação com Zod Schemas
- [x] Mock pipeline para demo mode
- [x] Suporte Plus Size (linguagem body-positive)
- [ ] Log de custos em `api_cost_logs`
- [ ] Progresso em tempo real (SSE ou Supabase Realtime)

## FASE 6 — Geração de Campanha (UI) ✅
- [x] Tela de upload + preço (`/gerar`)
- [x] Verificação de cota antes de gerar
- [x] Tela de resultado com dados dinâmicos
- [x] Upload de imagem para Supabase Storage
- [x] Rate limiting por IP (anti-abuso)
- [x] Crédito protegido (não cobra se falhar)
- [ ] Copiar texto 1-clique
- [ ] Download de criativo (PNG) — botão "Em breve"
- [ ] Regeneração parcial — botão "Em breve"

## FASE 7 — Processamento de Imagem (Moda) 🔄
- [x] Integração Fashn.ai configurada (API key)
- [ ] Virtual Try-On funcional end-to-end
- [ ] Remoção de fundo
- [ ] Composição de criativo Feed 1:1
- [ ] Composição de criativo Stories 9:16

## FASE 8 — Modelo Virtual 🔄
- [x] Tela de criação da modelo (`/modelo`)
- [x] Função `getActiveModel` no banco
- [ ] Integração Fashn.ai Model Create
- [ ] Seleção + salvamento do modelo
- [ ] Preview na tela de geração

## FASE 9 — Pagamentos (Mercado Pago) 🔄
- [x] SDK instalado e configurado
- [x] Tela de planos (`/plano`) com dados reais
- [x] Checkout básico implementado
- [x] Verificação de limites em cada geração
- [ ] Criar planos de assinatura no painel Mercado Pago
- [ ] Webhook IPN → atualizar plano/créditos
- [ ] Créditos extras (pagamento avulso)
- [ ] Tela de bloqueio suave (cota esgotada)

## FASE 10 — Painel do Lojista ✅
- [x] Histórico de campanhas
- [x] Configurações da loja
- [x] Tela de plano e billing
- [x] Indicador de uso (X/Y campanhas)

## FASE 11 — Painel Admin ✅
- [x] Dashboard com cards de resumo
- [x] Lista de clientes com filtros
- [x] Campanhas (admin view)
- [x] Custos API por provider
- [x] Logs do sistema
- [x] Vitrine Antes/Depois (upload drag & drop)
- [x] Configurações
- [ ] Gráficos de campanhas/dia e custo/dia (chart library)
- [ ] KPIs de negócio detalhados

## FASE 12 — Polimento e Deploy 🔄
- [x] Tratamento de erros global
- [x] Loading states
- [x] Sentry configurado
- [x] PostHog analytics
- [x] Inngest (jobs assíncronos)
- [x] PWA (manifest + ícones)
- [x] Páginas legais (Termos, Privacidade)
- [x] Página Sobre
- [x] 404 personalizado
- [ ] Deploy VPS (PM2 + Nginx + SSL) ← **PRÓXIMO**
- [ ] DNS crialook.com.br
- [ ] CI/CD (GitHub Actions → SSH)

---

## 📊 Progresso Geral

| Fase | Status | Conclusão |
|------|--------|-----------|
| 0. Setup | ✅ | 100% |
| 1. Banco | ✅ | 100% |
| 2. Auth | ✅ | 90% |
| 3. Landing | ✅ | 100% |
| 4. Onboarding | ✅ | 100% |
| 5. Pipeline IA | ✅ | 90% |
| 6. Geração UI | ✅ | 85% |
| 7. Imagem | 🔄 | 20% |
| 8. Modelo Virtual | 🔄 | 30% |
| 9. Pagamentos | 🔄 | 50% |
| 10. Painel Lojista | ✅ | 100% |
| 11. Painel Admin | ✅ | 90% |
| 12. Deploy | 🔄 | 70% |

**MVP pronto para deploy. Funcionalidades de imagem/try-on e pagamentos completos vêm na v2.**
