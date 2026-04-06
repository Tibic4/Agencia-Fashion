# 📝 CriaLook — TODO (Go-Live)

> **Atualizado:** 06/04/2026

---

## 🔴 URGENTE (bloqueiam o lançamento)

- [ ] **Resolver 502 Bad Gateway** em crialook.com.br
  - Verificar `pm2 status` na VPS
  - Verificar `pm2 logs crialook`
  - Verificar `/var/log/nginx/error.log`
  - Confirmar que o build passou (`npm run build`)

- [ ] **Configurar .env.local na VPS** com keys de produção
  - Anthropic API key
  - Fashn.ai API key
  - Mercado Pago Access Token + Public Key + Webhook Secret
  - Clerk keys (live, não test)
  - Sentry DSN
  - PostHog key

- [ ] **Configurar webhooks externos no painel de cada serviço:**
  - Mercado Pago IPN → `https://crialook.com.br/api/webhooks/mercadopago`
  - Clerk → `https://crialook.com.br/api/webhooks/clerk`
  - Inngest → `https://crialook.com.br/api/inngest`

- [ ] **Criar planos de assinatura no Mercado Pago** (Starter, Pro, Business, Agência)

- [ ] **SSL/HTTPS** — verificar Certbot + renovação automática

## 🟡 IMPORTANTE (pré-lançamento)

- [ ] Testar fluxo completo de pagamento (PIX + cartão) em sandbox
- [ ] Testar geração de campanha em produção (foto real)
- [ ] Configurar admin user no Clerk (role = admin)
- [ ] Fix: policy RLS `showcase_admin_all` em `showcase_items` (restringir para admin)
- [ ] Remover arquivo `senha` da raiz + rotacionar credenciais
- [ ] Remover arquivos temporários: `out.txt`, `extract_docx.py`, `campanha_extracted.txt`

## 🟢 PÓS-LANÇAMENTO

- [ ] Upload de fotos na vitrine showcase (antes/depois reais)
- [ ] Primeiro teste com produto real de loja
- [ ] Monitorar custos API nos primeiros 7 dias (dashboard admin)
- [ ] Configurar alertas de custo (threshold no admin_settings)
- [ ] Documentar processo de onboarding para primeiro cliente