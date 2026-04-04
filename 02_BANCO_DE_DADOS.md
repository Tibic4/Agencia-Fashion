# ⚡ CAMPANHA IA — Banco de Dados Completo

## Parte 2: Schema PostgreSQL (Supabase)

---

## 1. DIAGRAMA ENTIDADE-RELACIONAMENTO

```
stores ──< campaigns ──< campaign_outputs
  │                          │
  ├── store_models           ├── campaign_scores
  │                          │
  ├── store_settings         └── campaign_alerts
  │
  └── store_usage ──< api_cost_logs

users (Clerk) ──< stores

admin_users
plans ──< plan_limits
```

---

## 2. TABELAS

### 2.1 stores (Lojas)

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  segment_primary TEXT NOT NULL,
  segments_secondary TEXT[] DEFAULT '{}',
  city TEXT,
  state TEXT,
  logo_url TEXT,
  instagram_handle TEXT,
  brand_colors JSONB DEFAULT '{}',
  plan_id UUID REFERENCES plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Segmentos válidos:
-- moda_feminina, moda_masculina, moda_infantil, calcados,
-- acessorios, alimentos, bebidas, eletronicos, casa_decoracao,
-- beleza_cosmeticos, saude_suplementos, pet, papelaria, outro
```

### 2.2 store_models (Modelos Virtuais)

```sql
CREATE TABLE store_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Modelo Principal',
  skin_tone TEXT NOT NULL,           -- clara, media, morena, negra
  hair_style TEXT NOT NULL,          -- liso_preto, liso_castanho, liso_loiro, ondulado, cacheado
  body_type TEXT DEFAULT 'media',    -- magra, media, plus_size, curvilinea
  style TEXT NOT NULL,               -- casual_natural, sofisticado, jovem_descolada, classico
  age_range TEXT NOT NULL,           -- jovem_18_25, adulta_26_35, madura_36_45
  eye_color TEXT DEFAULT 'castanho', -- castanho, verde, azul, mel
  fashn_model_id TEXT,               -- ID retornado pela Fashn.ai
  preview_url TEXT,                  -- URL da imagem de preview da modelo
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_store_models_store ON store_models(store_id);
```

### 2.3 campaigns (Campanhas)

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Input do lojista
  product_photo_url TEXT NOT NULL,
  product_photo_storage_path TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  target_audience TEXT,              -- mulheres_25_40, jovens_18_25, etc.
  objective TEXT DEFAULT 'venda_imediata', -- venda_imediata, lancamento, promocao, engajamento
  
  -- Opções avançadas (se preenchidas)
  tone_override TEXT,                -- animado, sofisticado, urgente, acolhedor, divertido
  channels TEXT[] DEFAULT '{instagram_feed,instagram_stories,whatsapp,meta_ads}',
  use_model BOOLEAN DEFAULT TRUE,
  model_id UUID REFERENCES store_models(id),
  
  -- Status do pipeline
  status TEXT DEFAULT 'pending',     -- pending, processing, completed, failed, partial
  pipeline_step TEXT,                -- vision, strategist, copywriter, refiner, scorer, image, compose
  pipeline_started_at TIMESTAMPTZ,
  pipeline_completed_at TIMESTAMPTZ,
  pipeline_duration_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadados
  generation_number INTEGER DEFAULT 1,  -- 1 = original, 2+ = regeneração
  parent_campaign_id UUID REFERENCES campaigns(id),
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_store ON campaigns(store_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_created ON campaigns(created_at DESC);
```

### 2.4 campaign_outputs (Outputs por Canal)

```sql
CREATE TABLE campaign_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Análise do Vision
  vision_analysis JSONB,
  
  -- Output do Estrategista
  strategy JSONB,
  
  -- Output do Copywriter (por canal)
  headline_principal TEXT,
  headline_variacao_1 TEXT,
  headline_variacao_2 TEXT,
  instagram_feed TEXT,
  instagram_stories JSONB,          -- {slide_1_gancho, slide_2_produto, slide_3_cta}
  whatsapp TEXT,
  meta_ads JSONB,                   -- {headline, texto_primario, cta_button}
  
  -- Hashtags
  hashtags TEXT[],
  
  -- Imagens geradas
  product_image_clean_url TEXT,      -- Foto com fundo removido
  model_image_url TEXT,              -- Foto com modelo (try-on)
  lifestyle_image_url TEXT,          -- Imagem lifestyle (não-moda)
  creative_feed_url TEXT,            -- Criativo final 1:1
  creative_stories_url TEXT,         -- Criativo final 9:16
  
  -- Refinamentos aplicados
  refinements JSONB,                 -- Array de mudanças do refinador
  
  -- Cache da análise Vision (reutilizar se mesma foto)
  vision_cache_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outputs_campaign ON campaign_outputs(campaign_id);
```

### 2.5 campaign_scores (Scores e Alertas)

```sql
CREATE TABLE campaign_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Notas (0-100)
  nota_geral INTEGER NOT NULL,
  conversao INTEGER NOT NULL,
  clareza INTEGER NOT NULL,
  urgencia INTEGER NOT NULL,
  naturalidade INTEGER NOT NULL,
  aprovacao_meta INTEGER NOT NULL,
  
  -- Risco
  nivel_risco TEXT NOT NULL,         -- baixo, medio, alto, critico
  
  -- Detalhes
  resumo TEXT,
  pontos_fortes JSONB,               -- Array de strings
  melhorias JSONB,                    -- Array de {campo, problema, sugestao}
  alertas_meta JSONB,                -- Array de {trecho, politica, nivel, correcao} ou null
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scores_campaign ON campaign_scores(campaign_id);
```

### 2.6 plans (Planos)

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                 -- gratis, starter, pro, agencia
  display_name TEXT NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  stripe_price_id TEXT,
  
  -- Limites
  campaigns_per_month INTEGER NOT NULL,
  channels_per_campaign INTEGER NOT NULL DEFAULT 4,
  models_limit INTEGER NOT NULL DEFAULT 1,
  regenerations_per_campaign INTEGER NOT NULL DEFAULT 1,
  history_days INTEGER NOT NULL DEFAULT 30,
  score_level TEXT DEFAULT 'basic',   -- basic, complete
  has_preview_link BOOLEAN DEFAULT FALSE,
  has_white_label BOOLEAN DEFAULT FALSE,
  support_channel TEXT DEFAULT 'email', -- email, whatsapp, whatsapp_priority
  
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.7 store_usage (Uso Mensal por Loja)

```sql
CREATE TABLE store_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,         -- Primeiro dia do mês
  period_end DATE NOT NULL,           -- Último dia do mês
  
  campaigns_generated INTEGER DEFAULT 0,
  campaigns_limit INTEGER NOT NULL,
  regenerations_used INTEGER DEFAULT 0,
  models_created INTEGER DEFAULT 0,
  
  -- Custos reais de API (para o admin)
  total_api_cost DECIMAL(10,4) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(store_id, period_start)
);

CREATE INDEX idx_usage_store_period ON store_usage(store_id, period_start);
```

### 2.8 api_cost_logs (Log de Custos de API)

```sql
CREATE TABLE api_cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  campaign_id UUID REFERENCES campaigns(id),
  
  provider TEXT NOT NULL,             -- anthropic, fashn, stability, openai, remove_bg
  endpoint TEXT NOT NULL,             -- ex: messages, model-create, generate
  model TEXT,                         -- ex: claude-sonnet-4-20250514
  pipeline_step TEXT,                 -- vision, strategist, copywriter, refiner, scorer, image
  
  -- Tokens (para LLMs)
  input_tokens INTEGER,
  output_tokens INTEGER,
  
  -- Custos
  cost_usd DECIMAL(10,6) NOT NULL,
  cost_brl DECIMAL(10,4) NOT NULL,
  exchange_rate DECIMAL(10,4),        -- USD/BRL do momento
  
  -- Resposta
  response_time_ms INTEGER,
  status_code INTEGER,
  is_error BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_costs_store ON api_cost_logs(store_id);
CREATE INDEX idx_costs_campaign ON api_cost_logs(campaign_id);
CREATE INDEX idx_costs_provider ON api_cost_logs(provider);
CREATE INDEX idx_costs_created ON api_cost_logs(created_at);
CREATE INDEX idx_costs_date_provider ON api_cost_logs(created_at, provider);
```

### 2.9 admin_settings (Configurações Globais)

```sql
CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Valores iniciais:
INSERT INTO admin_settings (key, value, description) VALUES
('usd_brl_rate', '5.50', 'Taxa de câmbio USD/BRL'),
('api_budget_monthly_alert', '500', 'Alerta quando custo mensal API atinge R$ X'),
('api_budget_monthly_limit', '2000', 'Limite hard de custo mensal API em R$'),
('fashn_enabled', 'true', 'Habilitar Fashn.ai para try-on'),
('stability_enabled', 'true', 'Habilitar Stability AI'),
('maintenance_mode', 'false', 'Modo manutenção global'),
('max_retries_pipeline', '2', 'Tentativas máximas por etapa do pipeline');
```

---

## 3. ROW LEVEL SECURITY (RLS)

```sql
-- stores: lojista vê apenas sua loja
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_owner ON stores
  FOR ALL USING (clerk_user_id = auth.jwt()->>'sub');

-- campaigns: lojista vê apenas suas campanhas
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_owner ON campaigns
  FOR ALL USING (store_id IN (
    SELECT id FROM stores WHERE clerk_user_id = auth.jwt()->>'sub'
  ));

-- Mesma lógica para: campaign_outputs, campaign_scores,
-- store_models, store_usage

-- api_cost_logs: apenas admin
ALTER TABLE api_cost_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_only ON api_cost_logs
  FOR ALL USING (auth.jwt()->>'role' = 'admin');
```

---

## 4. SUPABASE STORAGE BUCKETS

```sql
-- Bucket para fotos de produtos (upload do lojista)
INSERT INTO storage.buckets (id, name, public) VALUES
('product-photos', 'product-photos', false);

-- Bucket para imagens geradas (criativos, try-on, etc)
INSERT INTO storage.buckets (id, name, public) VALUES
('generated-images', 'generated-images', true);

-- Bucket para logos das lojas
INSERT INTO storage.buckets (id, name, public) VALUES
('store-logos', 'store-logos', true);

-- Bucket para previews de modelos virtuais
INSERT INTO storage.buckets (id, name, public) VALUES
('model-previews', 'model-previews', true);
```
