# ✅ CriaLook — Checkpoints do Projeto

> **Atualizado:** 06/04/2026 — Baseado no código real + banco de dados + commits

---

## Fase 1: Fundação ✅ 100%
- [x] Projeto Next.js inicializado (App Router)
- [x] Tailwind CSS v4 configurado
- [x] Supabase conectado (browser + server + admin clients)
- [x] TypeScript configurado
- [x] Estrutura de pastas definida

## Fase 2: Autenticação ✅ 100%
- [x] Clerk integrado (@clerk/nextjs v7)
- [x] Páginas /sign-in e /sign-up
- [x] Middleware de proteção de rotas (auth group)
- [x] Roles admin via Clerk metadata
- [x] Webhook Clerk → criar store no Supabase

## Fase 3: Banco de Dados ✅ 100%
- [x] Schema completo (12 tabelas)
- [x] 20 migrations aplicadas no Supabase produção
- [x] RLS ativado em todas as tabelas
- [x] Políticas RLS: owner (read/write own data) + admin (read all)
- [x] Tabela `plans` populada (5 planos, free desativado)
- [x] Tabela `model_bank` populada (20 modelos: 10 normal + 10 plus_size)
- [x] Tabela `admin_settings` populada (16 configurações)
- [x] Storage buckets criados (product-photos, model-previews)
- [x] ✅ Fix: policy `showcase_admin_all` corrigida → restrita a `service_role`

## Fase 4: Landing Page ✅ 100%
- [x] Hero section com CTA
- [x] Seção de planos/preços
- [x] Showcase antes/depois (vitrine)
- [x] Botão WhatsApp flutuante (heartbeat pulse)
- [x] SEO: meta tags, robots.txt, sitemap.ts, manifest.ts
- [x] Favicon/PWA icons
- [x] Páginas /sobre, /termos, /privacidade
- [x] Responsivo mobile

## Fase 5: Pipeline de IA ✅ 100%
- [x] Vision Analyzer (Claude Sonnet Vision)
- [x] Estrategista de Varejo BR
- [x] Copywriter de Varejo BR
- [x] Refinador de Conversão
- [x] Scorer + Meta Compliance
- [x] System prompts otimizados para moda
- [x] JSON parsing robusto (remove markdown wrappers)
- [x] Retry com backoff (2x por step)
- [x] Auto-retry quando score < 40
- [x] Log de custos por etapa (api_cost_logs)
- [x] Suporte a múltiplas fotos (close-up, conjunto)
- [x] Suporte plus size no pipeline

## Fase 6: Imagem & Try-on ✅ 100%
- [x] Fashn.ai integrado (virtual try-on) — core
- [x] fal.ai IDM-VTON integrado — fallback
- [x] Model bank (20 modelos stock)
- [x] Store models (modelos customizados por loja)
- [x] Categorias de produto mapeadas (tops/bottoms/one-pieces)
- [x] Materiais/tecidos configuráveis

## Fase 7: Compositor Visual (Konva.js) ✅ 100%
- [x] KonvaCompositor component (25KB)
- [x] Templates: com overlay e "Normal" (sem overlay)
- [x] Zoom controls
- [x] Export HD (browser-side)
- [x] Drag & drop de elementos
- [x] Responsivo

## Fase 8: Funcionalidades Core ✅ 100%
- [x] Página /gerar (formulário de campanha)
- [x] Página /historico (lista de campanhas)
- [x] Página /modelo (gestão de modelos)
- [x] Página /plano (planos + créditos avulsos)
- [x] Página /configuracoes
- [x] Regerar campanha (copy, image, full)
- [x] Download PNG e textos .txt
- [x] Tracking de uso (store_usage)

## Fase 9: Pagamentos (Mercado Pago) 🔶 80%
- [x] SDK Mercado Pago integrado
- [x] Checkout de assinatura
- [x] Checkout de créditos avulsos
- [x] Webhook IPN implementado (/api/webhooks/mercadopago)
- [x] Lógica backend: atualizar plan_id, store_usage, credit_*
- [ ] Criar planos de assinatura no painel Mercado Pago
- [ ] Testar fluxo completo end-to-end em produção
- [ ] Configurar URL webhook no painel Mercado Pago

## Fase 10: Admin Dashboard ✅ 100%
- [x] Página /admin com gráficos Recharts
- [x] Métricas: stores, campanhas, revenue, custos API
- [x] Admin settings editável
- [x] Toggle Fashn.ai on/off
- [x] Proteção por role admin (Clerk)

## Fase 11: Monitoramento ✅ 100%
- [x] Sentry configurado (erros + source maps)
- [x] PostHog configurado (eventos, funil)
- [x] Health check endpoint (/api/health)
- [x] Rate limiting por IP
- [x] Credit safety (não debita se pipeline falhar)

## Fase 12: Deploy Produção 🔶 80%
- [x] VPS KingHost configurada
- [x] PM2 instalado
- [x] Nginx configurado como reverse proxy
- [x] Build otimizado (sem turbopack, CPU limit)
- [x] Script de deploy criado
- [x] SSL/Certbot instalado e funcionando (HTTPS ativo)
- [ ] ❌ Resolver 502 Bad Gateway (PM2/Next.js não está rodando)
- [ ] Configurar webhooks externos (MP, Clerk, Inngest)
- [ ] Configurar .env.local na VPS com keys de produção

---

## Resumo de Progresso

| Fase | Status | Progresso |
|------|--------|-----------|
| Fundação | ✅ | 100% |
| Auth | ✅ | 100% |
| Banco | ✅ | 98% (1 fix RLS) |
| Landing | ✅ | 100% |
| Pipeline IA | ✅ | 100% |
| Imagem/Try-on | ✅ | 100% |
| Compositor | ✅ | 100% |
| Core Features | ✅ | 100% |
| Pagamentos | 🔶 | 80% |
| Admin | ✅ | 100% |
| Monitoramento | ✅ | 100% |
| Deploy | 🔶 | 70% |
| **TOTAL** | | **~95%** |
