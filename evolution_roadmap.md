# CriaLook — Roadmap de Evolução Técnica e Produto

> Última atualização: 14/Abril/2026
> Status: MVP em produção — VPS 8GB, Next.js 15, Inngest, Supabase, Mercado Pago

---

## Estado Atual (Produção)

O app está funcional e pronto para lançamento. O pipeline completo roda de forma assíncrona via Inngest, pagamentos via Mercado Pago, e todas as jornadas de usuário foram auditadas e corrigidas.

### O que está em produção hoje

| Feature | Detalhe |
|---------|---------|
| Pipeline IA texto (7 etapas) | Vision → Strategy → Copy → Refiner → Scorer → VTO Mini-Vision → Campanha |
| Virtual Try-On com QA visual | Gemini Flash Image + CoT de verificação de fidelidade |
| Modelos virtuais personalizados | Upload de foto real → geração de avatar |
| Background jobs assíncronos | Inngest: geração desacoplada da request HTTP |
| Storage GC automático | Cron diário 03:00 UTC — purge imagens >25 dias não-favoritadas |
| Pagamentos (assinatura + avulso) | Mercado Pago PreApproval + Preferences |
| Trial R$ 19,90 | 3 campanhas + 1 modelo bônus — 1x por loja |
| Créditos avulsos | 6 packs: 3/10/20 campanhas, 3/10/25 modelos |
| Webhook com idempotência | Guard via `mercadopago_payment_id` em `credit_purchases` |
| Admin panel completo | Lojas, modelos, backdrops, GC manual, câmbio |
| Quota enforcement | 429 QUOTA_EXCEEDED antes de processar |
| Rate limiting por IP | Proteção contra abuso na geração |
| Guards de jornada | NO_STORE redirect, storeChecked anti-flash, polling pós-pagamento |
| Dark mode | Toggle em todas as páginas |
| Histórico por plano | Grátis=7d, Essencial=30d, Pro=365d, Business=ilimitado |

---

## Fase 1 — Retenção e Conversão (pós-lançamento, 0–500 usuários)

**Objetivo:** Reduzir churn, aumentar conversão Trial→Plano, maximizar LTV com o produto atual sem adicionar complexidade técnica.

### 1.1 Upsell automático via WhatsApp
Quando o usuário atinge 80% do limite de campanhas do mês, disparar mensagem via WhatsApp Business API:

> "Olá! Você já usou 12 das suas 15 campanhas. Que tal fazer upgrade para o Pro e ter 40 campanhas? Acesse crialook.com.br/plano"

- **Trigger:** `campaigns_generated / campaigns_limit >= 0.8`
- **Canal:** WhatsApp Business API (Twilio ou Z-API)
- **Impacto estimado:** +15% conversão Essencial→Pro

### 1.2 Programa de indicação
- Quem indica: +3 campanhas bônus (crédito automático)
- Quem chega via link: +2 campanhas bônus
- Link rastreável com `ref=` no signup
- **Impacto estimado:** CAC -40%, +20% crescimento orgânico

### 1.3 Relatório mensal automático por email
Email enviado todo dia 1º do mês com:
- Nº de campanhas geradas no mês
- Score médio de qualidade
- Canais mais usados
- Dica personalizada de melhoria
- CTA de upgrade se próximo do limite

- **Stack:** Resend / SendGrid + template React Email
- **Impacto estimado:** -10% churn (engajamento)

### 1.4 Plano anual com desconto
2 meses grátis = 17% de desconto:

| Plano | Mensal | Anual | Economia |
|-------|:------:|:-----:|:--------:|
| Essencial | R$ 179 | R$ 1.790/ano (R$ 149/mês) | 17% |
| Pro | R$ 359 | R$ 3.590/ano (R$ 299/mês) | 17% |
| Business | R$ 749 | R$ 7.490/ano (R$ 624/mês) | 17% |

- **Implementação:** Mercado Pago subscription com `reason` e frequência anual
- **Benefício:** Reduz churn, antecipa receita, aumenta LTV

---

## Fase 2 — Automação da Publicação (500–1.500 usuários)

**Objetivo:** Eliminar o último atrito da jornada — o lojista gera a campanha, mas ainda precisa baixar, copiar e postar manualmente.

> O produto real não é a imagem — é **Postar e Vender**.

### 2.1 Publicação direta no Instagram (Meta Graph API)
Disponível no plano Pro e Business.

**Fluxo:**
1. Campanha gerada com sucesso
2. Botão CTA: "Publicar agora no Instagram" ou "Agendar para sexta"
3. OAuth com conta Meta Business do lojista
4. Post publicado com imagem + legenda gerada pela IA

- **API:** Meta Graph API v20+ (`/me/media` + `/me/media_publish`)
- **Agendamento:** Fila Inngest com delay configurável
- **Monetização:** Feature exclusiva Pro/Business — aumenta percepção de valor

### 2.2 Compartilhamento WhatsApp 1-click
Botão na tela de resultado que abre WhatsApp com a imagem e legenda pré-carregados para grupos VIP de clientes da loja.

- **Implementação:** `https://wa.me/?text=` + deep link para imagem
- **Versão avançada:** WhatsApp Business API para grupos (plano Business)

### 2.3 Agendamento de posts
Calendário visual para planejar posts da semana/mês:
- Arrastar campanhas para datas
- Publicação automática no horário agendado
- Preview do feed antes de publicar

---

## Fase 3 — Expansão de Formato (1.500–5.000 usuários)

**Objetivo:** Suportar os formatos que os algoritmos do Meta privilegiam — carrosséis, reels, stories — sem aumentar o custo por campanha proporcionalmente.

### 3.1 Carrossel Inteligente (Smart Batching)
Lojista arrasta 3 fotos de cabide de uma peça → o pipeline processa:
- Foto 1 (frente): passa pelo VTO completo
- Fotos 2 e 3 (zoom, costas): processadas como painéis de detalhe
- Layout final: carrossel com imagem VTO + detalhes + copy distribuída nos slides

**Economia:** Apenas 1 VTO por carrossel (vs 3 individuais).

### 3.2 Canvas Editor Nativo (Fabric.js)
Após o Try-On retornar a imagem, camada de edição web abre para o lojista:
- Adicionar preço no canto ("R$ 89,90")
- Colar selo exclusivo ("Promoção de Sexta")
- Adicionar marca d'água da loja
- Ajustar posição do modelo na arte

**Resultado:** Lojista nunca precisa sair do CriaLook para o Canva.

### 3.3 Templates de Campanha por Nicho
Biblioteca de templates pré-construídos:
- Moda feminina casual
- Moda praia / verão
- Moda íntima
- Plus size
- Moda masculina
- Kids / infantil

Cada template ajusta o prompt de Strategy automaticamente.

---

## Fase 4 — Plataforma e Ecossistema (5.000–10.000 usuários)

**Objetivo:** Transformar o CriaLook de ferramenta em plataforma — com API, marketplace e integrações que criam lock-in competitivo.

### 4.1 API Pública (Integrações)
REST API para integrar com plataformas de e-commerce:

| Integração | Funcionalidade |
|-----------|----------------|
| Nuvemshop | Sync de produtos → gerar campanha ao cadastrar produto |
| Shopify | Publicar foto VTO direto no catálogo |
| WooCommerce | Webhook de novo produto → campanha automática |
| Bling / Tiny | Sync de catálogo |

**Monetização:** Plano Business inclui API. Planos menores pagam add-on.

### 4.2 Marketplace de Modelos Virtuais
Modelos criados pela comunidade, disponíveis para todos os lojistas:

| Tier | Acesso |
|------|--------|
| Grátis | Modelos básicos do marketplace |
| Pro | Modelos premium inclusos no plano |
| Business | Modelos exclusivos + upload de modelo próprio |

**Moat competitivo:** Quanto mais modelos no marketplace, mais valioso o produto para novos usuários.

### 4.3 Casting Manager (Identidade Visual Consistente)
Lojistas podem salvar "modelos fixas" da marca (ex: "Isabella" e "Marina") com traits faciais específicos (tom de pele, estrutura facial) e rotacionar automaticamente entre campanhas.

**Resultado:** Clientes do Instagram reconhecem as modelos da loja — cria familiaridade e identidade visual consistente.

### 4.4 App Mobile (React Native / Expo)
- Upload de foto do produto direto da câmera
- Receber push notification quando campanha ficar pronta
- Publicar no Instagram em 1 toque
- Gerenciar histórico e favoritos

---

## Fase 5 — Enterprise e Multi-região (10.000+ usuários)

### 5.1 Plano Enterprise

| Item | Detalhe |
|------|---------|
| Preço | Sob consulta (R$ 1.500+/mês) |
| Campanhas | Ilimitadas |
| Modelos | Ilimitados + upload próprio |
| Suporte | Dedicado + WhatsApp direto com dev |
| SLA | 99.9% uptime |
| API | Acesso completo + rate limits maiores |
| White-label | Remover marca CriaLook, domínio próprio |
| SAML SSO | Para redes de lojas com múltiplos usuários |

### 5.2 White-label para Agências
Agências de marketing podem oferecer CriaLook como produto próprio para seus clientes:
- Dashboard separado por cliente
- Domínio personalizado
- Preços personalizados (agência define margin)

### 5.3 Expansão LATAM
Adaptações para México, Argentina, Colômbia:
- Integração com gateways de pagamento locais (Conekta, PayU)
- Modelos de linguagem para copy em espanhol
- Adaptação de VTO para diversidade étnica regional

---

## Evolução da Infraestrutura

### Da VPS ao Kubernetes

```
Hoje (VPS 8GB)
├── Next.js 15 (processo único)
├── Inngest Worker (jobs assíncronos)
├── Docker Compose
└── Supabase managed (externo)

Marco 1–2 (VPS 16GB)
├── Next.js (PM2 cluster mode)
├── Inngest Worker
├── Cloudflare CDN na frente
├── Redis para cache de câmbio e rate limiting
└── Supabase Pro + compute addon

Marco 3+ (Kubernetes)
├── Next.js Deployment (3+ réplicas, auto-scale)
├── Inngest Worker Deployment (escala por fila)
├── Redis Cluster (ElastiCache / Upstash)
├── Supabase Team (dedicated compute)
└── CDN global (Cloudflare Business)
```

### Otimizações de Custo de API (implementar em ordem)

| Otimização | Redução estimada | Quando implementar |
|-----------|:----------------:|-------------------|
| Batch API Gemini (steps de texto) | -50% custo texto | Marco 1 (500 users) |
| Cache de Strategy por produto similar | -20% custo total | Marco 2 (1.500 users) |
| Testar Gemini 2.5 Flash Image vs 3.1 | -30% custo VTO | Marco 2 |
| Negociar volume com Google/Anthropic | -15% a -30% | Marco 3 (5.000 users) |
| Fine-tuning do Copywriter em modelo menor | -60% custo copy | Marco 3 |

---

## Decisões Técnicas para o Futuro

### Por que manter Claude para Copywriter?
O Copywriter (etapa 3) é o diferencial de qualidade percebida pelo lojista — é a legenda que ele vai postar. Claude Sonnet 4.6 produz copy significativamente mais natural e persuasiva do que Gemini para português brasileiro. O custo extra (~R$ 0,22 por campanha) é justificado pela retenção.

**Fallback:** Se o Claude ficar indisponível, o sistema pode cair para Gemini 2.5 Pro com prompt ajustado. Implementar quando chegar a 1.000 usuários.

### Por que Inngest e não BullMQ/Redis?
- Inngest é managed — zero infraestrutura de fila para gerenciar na VPS
- Dashboard nativo para debug de jobs
- Retry com backoff exponencial out-of-the-box
- Limites gratuitos suficientes para os primeiros 500 usuários

**Quando migrar:** Nunca — escalar o plano Inngest é mais barato do que operar BullMQ próprio até o Marco 4.

### Por que Mercado Pago e não Stripe?
- 95%+ dos lojistas brasileiros têm conta MP
- PIX nativo (conversão maior que cartão para esse público)
- Checkout familiar reduz abandono
- Taxas similares ao Stripe para o volume atual

**Quando revisar:** Marco 3 (5.000 users) — negociar taxa customizada com MP ou adicionar Stripe para clientes internacionais (LATAM).

---

*Documento vivo — atualizar a cada marco atingido e decisão técnica relevante.*
*Base técnica atual auditada em 14/04/2026.*
