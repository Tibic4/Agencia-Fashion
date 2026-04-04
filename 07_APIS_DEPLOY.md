# ⚡ CAMPANHA IA — APIs, Webhooks e Implementação Técnica

## Parte 7: Rotas API, Webhooks, Env Vars e Checklist de Deploy

---

## 1. ROTAS API DETALHADAS

### 1.1 Campaign Routes

#### `POST /api/campaign/generate`
**Auth:** Clerk JWT obrigatório
**Rate limit:** 1 req/10s por user (evitar spam)
**Body:**
```json
{
  "photo": "File (multipart) ou base64",
  "price": 89.90,
  "audience": "mulheres_25_40",        // opcional
  "objective": "venda_imediata",        // opcional
  "tone": "casual_energetico",          // opcional
  "channels": ["instagram_feed", "instagram_stories", "whatsapp", "meta_ads"],
  "use_model": true,                    // opcional
  "model_id": "uuid"                    // opcional
}
```
**Fluxo interno:**
1. Verificar limites do plano (store_usage)
2. Upload foto → Supabase Storage `product-photos`
3. Criar `campaign` com status `processing`
4. Disparar pipeline assíncrono (Inngest ou background job)
5. Retornar `{ campaign_id, status: "processing" }`

**Response:** `201 Created`
```json
{
  "campaign_id": "uuid",
  "status": "processing",
  "estimated_time_seconds": 35
}
```

---

#### `GET /api/campaign/[id]`
**Auth:** Clerk JWT + ownership check
**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "completed",
  "pipeline_step": "done",
  "duration_ms": 32400,
  "outputs": {
    "headline_principal": "...",
    "instagram_feed": "...",
    "instagram_stories": {...},
    "whatsapp": "...",
    "meta_ads": {...},
    "hashtags": [...],
    "images": {
      "product_clean": "url",
      "model": "url",
      "creative_feed": "url",
      "creative_stories": "url"
    }
  },
  "score": {
    "nota_geral": 87,
    "conversao": 85,
    "clareza": 90,
    "urgencia": 70,
    "naturalidade": 88,
    "aprovacao_meta": 95,
    "nivel_risco": "baixo",
    "alertas_meta": null
  },
  "strategy": {
    "angulo": "...",
    "gatilho": "...",
    "tom": "..."
  }
}
```

---

#### `POST /api/campaign/regenerate`
**Auth:** Clerk JWT + ownership
**Body:**
```json
{
  "campaign_id": "uuid",
  "type": "copy" | "image" | "full",
  "feedback": "quero tom mais urgente"  // opcional
}
```
**Fluxo:**
1. Verificar limites de regeneração (plan)
2. Se `type: "copy"` → Re-executar Copywriter + Refinador + Scorer
3. Se `type: "image"` → Re-executar Image Generation + Composição
4. Se `type: "full"` → Re-executar pipeline completo
5. Criar nova campanha com `parent_campaign_id` e `generation_number + 1`

---

### 1.2 Model Routes

#### `POST /api/model/create`
**Auth:** Clerk JWT
**Body:**
```json
{
  "skin_tone": "morena",
  "hair_style": "cacheado",
  "body_type": "media",
  "style": "casual_natural",
  "age_range": "adulta_26_35",
  "eye_color": "castanho",
  "name": "Ana"
}
```
**Fluxo:**
1. Verificar limite de modelos (plan)
2. Chamar Fashn.ai Model Create com `num_samples: 4`
3. Upload das 4 previews em `model-previews`
4. Retornar URLs das 4 opções + IDs temporários

**Response:** `201`
```json
{
  "previews": [
    { "id": "temp_1", "url": "..." },
    { "id": "temp_2", "url": "..." },
    { "id": "temp_3", "url": "..." },
    { "id": "temp_4", "url": "..." }
  ]
}
```

#### `POST /api/model/select`
**Body:** `{ "preview_id": "temp_2" }`
**Fluxo:** Salvar em `store_models` com `is_active = true`, desativar modelo anterior

---

### 1.3 Webhook Routes

#### `POST /api/webhook/clerk`
**Auth:** Clerk webhook signature verification
**Eventos tratados:**
| Evento | Ação |
|--------|------|
| `user.created` | Criar `store` com dados básicos |
| `user.deleted` | Soft delete (marcar inativo) |
| `session.created` | Log de acesso |

#### `POST /api/webhook/stripe`
**Auth:** Stripe webhook signature verification
**Eventos tratados:**
| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Ativar plano, criar store_usage |
| `invoice.paid` | Renovar store_usage para o mês |
| `invoice.payment_failed` | Email de alerta, dar 3 dias de grace |
| `customer.subscription.updated` | Atualizar plan_id na store |
| `customer.subscription.deleted` | Downgrade para plano grátis |

---

### 1.4 Admin Routes

#### `GET /api/admin/stats`
**Auth:** Admin only
**Response:**
```json
{
  "total_stores": 127,
  "new_stores_7d": 12,
  "total_campaigns": 1847,
  "campaigns_today": 87,
  "mrr": 8430.00,
  "api_cost_month": 1290.47,
  "margin_percent": 84.7,
  "avg_score": 82,
  "pipeline_success_rate": 98.2,
  "avg_generation_time_ms": 32400
}
```

#### `GET /api/admin/costs?period=30d&group_by=provider`
**Response:**
```json
{
  "total": 1290.47,
  "budget": 2000.00,
  "projection": 1720.00,
  "by_provider": [
    { "provider": "anthropic", "cost": 680, "requests": 8234 },
    { "provider": "fashn", "cost": 412, "requests": 1847 }
  ],
  "by_day": [
    { "date": "2026-04-01", "cost": 42.30 },
    { "date": "2026-04-02", "cost": 38.90 }
  ]
}
```

#### `GET /api/admin/clients?page=1&plan=pro&sort=campaigns`
#### `GET /api/admin/clients/[id]`
#### `GET /api/admin/campaigns?status=failed&period=today`
#### `GET /api/admin/logs?type=error&provider=anthropic`

---

## 2. VARIÁVEIS DE AMBIENTE

```env
# ═══ App ═══
NEXT_PUBLIC_APP_URL=https://campanha.ia
NEXT_PUBLIC_APP_NAME=Campanha IA

# ═══ Supabase ═══
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# ═══ Clerk ═══
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# ═══ Stripe ═══
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCIA=price_...

# ═══ Anthropic (LLM) ═══
ANTHROPIC_API_KEY=sk-ant-...

# ═══ OpenAI (DALL-E) ═══
OPENAI_API_KEY=sk-...

# ═══ Fashn.ai (Try-on) ═══
FASHN_API_KEY=fsh_...
FASHN_API_URL=https://api.fashn.ai/v1

# ═══ Stability AI (Remoção fundo) ═══
STABILITY_API_KEY=sk-...

# ═══ Fallback flags ═══
ENABLE_FASHN=true
ENABLE_STABILITY=true
ENABLE_DALLE=true

# ═══ Admin ═══
ADMIN_EMAILS=beatriz@modas.com
API_BUDGET_MONTHLY_BRL=2000
USD_BRL_RATE=5.50

# ═══ Sentry ═══
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...

# ═══ PostHog ═══
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# ═══ Inngest (Jobs) ═══
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

---

## 3. DEPENDÊNCIAS NPM

```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.3",
    "react-dom": "^18.3",
    "@supabase/supabase-js": "^2.45",
    "@supabase/ssr": "^0.5",
    "@clerk/nextjs": "^5",
    "stripe": "^16",
    "@stripe/stripe-js": "^4",
    "@anthropic-ai/sdk": "^0.30",
    "openai": "^4.60",
    "konva": "^9.3",
    "react-konva": "^18.2",
    "zustand": "^4.5",
    "inngest": "^3",
    "zod": "^3.23",
    "lucide-react": "^0.440",
    "@radix-ui/themes": "^3",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "sentry/nextjs": "^8",
    "posthog-js": "^1.160",
    "recharts": "^2.12",
    "date-fns": "^3"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "@types/react": "^18",
    "tailwindcss": "^4",
    "eslint": "^9",
    "prettier": "^3"
  }
}
```

---

## 4. VALIDAÇÃO COM ZOD SCHEMAS

```typescript
// schemas/campaign.ts
import { z } from 'zod';

export const CampaignInputSchema = z.object({
  price: z.number().positive().max(999999),
  audience: z.enum(['mulheres_25_40', 'jovens_18_25', 'homens_25_45',
    'maes', 'publico_geral', 'premium']).optional(),
  objective: z.enum(['venda_imediata', 'lancamento', 'promocao',
    'engajamento']).default('venda_imediata'),
  tone: z.enum(['casual_energetico', 'sofisticado', 'urgente',
    'acolhedor', 'divertido']).optional(),
  channels: z.array(z.enum(['instagram_feed', 'instagram_stories',
    'whatsapp', 'meta_ads'])).default(['instagram_feed', 'instagram_stories',
    'whatsapp', 'meta_ads']),
  use_model: z.boolean().default(true),
  model_id: z.string().uuid().optional(),
});

export const VisionOutputSchema = z.object({
  produto: z.object({
    nome_generico: z.string(),
    categoria: z.string(),
    subcategoria: z.string(),
  }),
  segmento: z.string(),
  atributos_visuais: z.object({
    cor_principal: z.string(),
    cor_secundaria: z.string().optional(),
    material_aparente: z.string(),
    estampa: z.string(),
  }),
  qualidade_foto: z.object({
    resolucao: z.enum(['boa', 'media', 'baixa']),
    necessita_tratamento: z.boolean(),
  }),
  nicho_sensivel: z.union([z.literal(false), z.object({
    tipo: z.string(),
    alerta: z.string(),
  })]),
  mood: z.array(z.string()).length(3),
});

export const ScoreOutputSchema = z.object({
  nota_geral: z.number().min(0).max(100),
  conversao: z.number().min(0).max(100),
  clareza: z.number().min(0).max(100),
  urgencia: z.number().min(0).max(100),
  naturalidade: z.number().min(0).max(100),
  aprovacao_meta: z.number().min(0).max(100),
  nivel_risco: z.enum(['baixo', 'medio', 'alto', 'critico']),
  resumo: z.string(),
  pontos_fortes: z.array(z.string()),
  melhorias: z.array(z.object({
    campo: z.string(),
    problema: z.string(),
    sugestao: z.string(),
  })),
  alertas_meta: z.array(z.object({
    trecho: z.string(),
    politica: z.string(),
    nivel: z.string(),
    correcao: z.string(),
  })).nullable(),
});
```

---

## 5. TRATAMENTO DE ERROS DO PIPELINE

| Erro | Retry? | Fallback | Ação |
|------|--------|----------|------|
| LLM retorna JSON inválido | Sim (2x) | Pedir JSON sem markdown | Log + retry |
| LLM timeout > 30s | Sim (1x) | Trocar para Haiku se Sonnet | Log + retry |
| Fashn.ai indisponível | Não | Usar produto com fundo removido | Alerta + degradação |
| Stability AI 500 | Sim (1x) | fal.ai como fallback | Log + fallback |
| DALL-E rate limit | Aguardar 5s + retry | Stability SDXL | Log + fallback |
| Upload falha | Sim (2x) | - | Erro para o usuário |
| Score < 40 | Não | Re-executar Copywriter+Refinador | Auto-retry pipeline |

**Política de retry:**
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logError({ attempt, error, maxRetries });
      if (attempt === maxRetries) throw error;
      await sleep(1000 * (attempt + 1)); // backoff
    }
  }
}
```

---

## 6. CHECKLIST PRÉ-DEPLOY

### 6.1 Supabase
- [ ] Todas as tabelas criadas via migrations
- [ ] RLS ativado em TODAS as tabelas
- [ ] Políticas RLS testadas (owner, admin)
- [ ] Storage buckets criados com políticas
- [ ] Índices criados para queries frequentes
- [ ] Função `auth.jwt()` disponível para RLS

### 6.2 Clerk
- [ ] Auth configurado (Google, Email)
- [ ] Webhook endpoint registrado
- [ ] Role `admin` configurado
- [ ] Redirect URLs configuradas

### 6.3 Stripe
- [ ] Produtos e preços criados
- [ ] Webhook endpoint registrado
- [ ] Customer portal ativado
- [ ] Modo teste validado
- [ ] PIX ativado nas configurações

### 6.4 APIs de IA
- [ ] Anthropic API key com billing
- [ ] OpenAI API key com billing
- [ ] Fashn.ai conta e créditos
- [ ] Stability AI conta e créditos
- [ ] Rate limits verificados por provider
- [ ] Fallbacks testados

### 6.5 Vercel
- [ ] Todas as env vars configuradas
- [ ] Domínio customizado
- [ ] Edge functions timeout (60s min para pipeline)
- [ ] Sentry integrado
- [ ] Proteção CSRF ativada

### 6.6 Monitoramento
- [ ] Sentry configurado com source maps
- [ ] PostHog eventos: signup, onboarding, generate, download
- [ ] Alertas de custo API configurados
- [ ] Health check endpoint `/api/health`
