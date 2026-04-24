-- ═══════════════════════════════════════════════════════════
-- CriaLook — Schema Baseline (gerado por introspect-supabase.ts)
-- Gerado em 2026-04-24T19:42:18.996Z
-- Projeto: emybirklqhonqodzyzet
-- ═══════════════════════════════════════════════════════════

-- ── Tabela: admin_settings ──
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now()
);

-- ── Tabela: api_cost_logs ──
CREATE TABLE IF NOT EXISTS public.api_cost_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  campaign_id uuid,
  provider text NOT NULL,
  endpoint text,
  model_used text,
  action text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10,6) NOT NULL,
  cost_brl numeric(10,4) NOT NULL,
  exchange_rate numeric(10,4),
  response_time_ms integer,
  status_code integer,
  is_error boolean DEFAULT false,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  tokens_used integer DEFAULT 0
);

-- ── Tabela: campaign_outputs ──
CREATE TABLE IF NOT EXISTS public.campaign_outputs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  vision_analysis jsonb,
  strategy jsonb,
  headline_principal text,
  headline_variacao_1 text,
  headline_variacao_2 text,
  instagram_feed text,
  instagram_stories jsonb,
  whatsapp text,
  meta_ads jsonb,
  hashtags text[],
  product_image_clean_url text,
  model_image_url text,
  creative_feed_url text,
  creative_stories_url text,
  refinements jsonb,
  vision_cache_hash text,
  created_at timestamp with time zone DEFAULT now()
);

-- ── Tabela: campaign_scores ──
CREATE TABLE IF NOT EXISTS public.campaign_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  nota_geral integer NOT NULL,
  conversao integer NOT NULL,
  clareza integer NOT NULL,
  urgencia integer NOT NULL,
  naturalidade integer NOT NULL,
  aprovacao_meta integer NOT NULL,
  nivel_risco text NOT NULL,
  resumo text,
  pontos_fortes jsonb,
  melhorias jsonb,
  alertas_meta jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ── Tabela: campaigns ──
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_photo_url text NOT NULL,
  product_photo_storage_path text NOT NULL,
  price numeric(10,2) NOT NULL,
  target_audience text,
  objective text DEFAULT 'venda_imediata'::text,
  tone_override text,
  channels text[] DEFAULT '{instagram_feed,instagram_stories,whatsapp,meta_ads}'::text[],
  use_model boolean DEFAULT true,
  model_id uuid,
  status text DEFAULT 'pending'::text,
  pipeline_step text,
  pipeline_started_at timestamp with time zone,
  pipeline_completed_at timestamp with time zone,
  pipeline_duration_ms integer,
  error_message text,
  retry_count integer DEFAULT 0,
  generation_number integer DEFAULT 1,
  parent_campaign_id uuid,
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  product_type character varying(30),
  model_bank_id uuid,
  regen_count integer DEFAULT 0,
  preview_token text,
  is_favorited boolean NOT NULL DEFAULT false,
  output jsonb,
  title text,
  sequence_number integer
);

-- ── Tabela: credit_purchases ──
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  type text NOT NULL,
  quantity integer NOT NULL,
  price_brl numeric(10,2) NOT NULL,
  mercadopago_payment_id text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  consumed integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- ── Tabela: fashion_facts ──
CREATE TABLE IF NOT EXISTS public.fashion_facts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  emoji text NOT NULL DEFAULT '💡'::text,
  category text NOT NULL DEFAULT 'Dica'::text,
  text text NOT NULL,
  source text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── Tabela: model_bank ──
CREATE TABLE IF NOT EXISTS public.model_bank (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying(100) NOT NULL,
  body_type character varying(20) NOT NULL,
  skin_tone character varying(30) NOT NULL,
  pose character varying(50) NOT NULL DEFAULT 'standing'::character varying,
  image_url text NOT NULL,
  thumbnail_url text,
  fashn_job_id character varying(100),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  gender text NOT NULL DEFAULT 'feminino'::text,
  hair_texture text,
  hair_length text,
  hair_color text,
  age_range text,
  style text DEFAULT 'casual_natural'::text
);

-- ── Tabela: plans ──
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  price_monthly numeric(10,2) NOT NULL,
  mercadopago_plan_id text,
  campaigns_per_month integer NOT NULL,
  channels_per_campaign integer NOT NULL DEFAULT 4,
  models_limit integer NOT NULL DEFAULT 1,
  model_creations_per_month integer NOT NULL DEFAULT 1,
  regenerations_per_campaign integer NOT NULL DEFAULT 1,
  history_days integer NOT NULL DEFAULT 30,
  score_level text DEFAULT 'basic'::text,
  has_preview_link boolean DEFAULT false,
  has_white_label boolean DEFAULT false,
  has_api_access boolean DEFAULT false,
  support_channel text DEFAULT 'email'::text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- ── Tabela: showcase_items ──
CREATE TABLE IF NOT EXISTS public.showcase_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  before_photo_url text NOT NULL,
  after_photo_url text NOT NULL,
  caption text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  use_in_tips boolean DEFAULT false
);

-- ── Tabela: store_models ──
CREATE TABLE IF NOT EXISTS public.store_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text DEFAULT 'Modelo Principal'::text,
  skin_tone text NOT NULL,
  hair_style text NOT NULL,
  body_type text DEFAULT 'media'::text,
  style text NOT NULL,
  age_range text NOT NULL,
  eye_color text DEFAULT 'castanho'::text,
  fashn_model_id text,
  preview_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  reference_photos text[] DEFAULT '{}'::text[],
  face_ref_url text,
  hair_texture text DEFAULT 'ondulado'::text,
  hair_length text DEFAULT 'ombro'::text,
  hair_color text DEFAULT 'castanho'::text,
  gender text NOT NULL DEFAULT 'feminino'::text
);

-- ── Tabela: store_usage ──
CREATE TABLE IF NOT EXISTS public.store_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  campaigns_generated integer DEFAULT 0,
  campaigns_limit integer NOT NULL,
  regenerations_used integer DEFAULT 0,
  models_created integer DEFAULT 0,
  total_api_cost numeric(10,4) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- ── Tabela: stores ──
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  name text NOT NULL,
  segment_primary text NOT NULL,
  segments_secondary text[] DEFAULT '{}'::text[],
  city text,
  state text,
  logo_url text,
  instagram_handle text,
  brand_colors jsonb DEFAULT '{}'::jsonb,
  plan_id uuid,
  mercadopago_customer_id text,
  mercadopago_subscription_id text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  credit_campaigns integer DEFAULT 0,
  credit_models integer DEFAULT 0,
  credit_regenerations integer DEFAULT 0,
  backdrop_ref_url text,
  backdrop_color text,
  backdrop_updated_at timestamp with time zone
);


-- ══ Índices ══
CREATE INDEX idx_costs_campaign ON public.api_cost_logs USING btree (campaign_id);
CREATE INDEX idx_costs_created ON public.api_cost_logs USING btree (created_at);
CREATE INDEX idx_costs_date_provider ON public.api_cost_logs USING btree (created_at, provider);
CREATE INDEX idx_costs_provider ON public.api_cost_logs USING btree (provider);
CREATE INDEX idx_costs_store ON public.api_cost_logs USING btree (store_id);
CREATE INDEX idx_outputs_campaign ON public.campaign_outputs USING btree (campaign_id);
CREATE INDEX idx_scores_campaign ON public.campaign_scores USING btree (campaign_id);
CREATE INDEX idx_campaigns_created ON public.campaigns USING btree (created_at DESC);
CREATE INDEX idx_campaigns_favorites ON public.campaigns USING btree (store_id, is_favorited) WHERE (is_favorited = true);
CREATE INDEX idx_campaigns_gc_candidates ON public.campaigns USING btree (created_at) WHERE ((is_favorited = false) AND (status = ANY (ARRAY['completed'::text, 'failed'::text])));
CREATE INDEX idx_campaigns_model_bank_id ON public.campaigns USING btree (model_bank_id);
CREATE INDEX idx_campaigns_model_id ON public.campaigns USING btree (model_id);
CREATE INDEX idx_campaigns_parent_id ON public.campaigns USING btree (parent_campaign_id);
CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);
CREATE INDEX idx_campaigns_store ON public.campaigns USING btree (store_id);
CREATE INDEX idx_credit_purchases_store ON public.credit_purchases USING btree (store_id);
CREATE INDEX idx_fashion_facts_active ON public.fashion_facts USING btree (is_active, priority DESC);
CREATE INDEX idx_model_bank_body_type ON public.model_bank USING btree (body_type) WHERE (is_active = true);
CREATE UNIQUE INDEX plans_name_key ON public.plans USING btree (name);
CREATE INDEX idx_store_models_store ON public.store_models USING btree (store_id);
CREATE INDEX idx_usage_store_period ON public.store_usage USING btree (store_id, period_start);
CREATE UNIQUE INDEX store_usage_store_id_period_start_key ON public.store_usage USING btree (store_id, period_start);
CREATE INDEX idx_stores_clerk ON public.stores USING btree (clerk_user_id);
CREATE INDEX idx_stores_plan ON public.stores USING btree (plan_id);
CREATE UNIQUE INDEX stores_clerk_user_id_key ON public.stores USING btree (clerk_user_id);

-- ══ RLS ══
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_cost_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fashion_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showcase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- ══ Policies ══
-- policy Anyone can read admin settings on admin_settings
DROP POLICY IF EXISTS "Anyone can read admin settings" ON public.admin_settings;
CREATE POLICY "Anyone can read admin settings" ON public.admin_settings AS PERMISSIVE FOR SELECT TO public USING (true);

-- policy Service role can modify settings on admin_settings
DROP POLICY IF EXISTS "Service role can modify settings" ON public.admin_settings;
CREATE POLICY "Service role can modify settings" ON public.admin_settings AS PERMISSIVE FOR ALL TO public USING ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)) WITH CHECK ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text));

-- policy service_role_full_access on api_cost_logs
DROP POLICY IF EXISTS "service_role_full_access" ON public.api_cost_logs;
CREATE POLICY "service_role_full_access" ON public.api_cost_logs AS PERMISSIVE FOR ALL TO public USING ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)) WITH CHECK ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text));

-- policy Users can read own outputs on campaign_outputs
DROP POLICY IF EXISTS "Users can read own outputs" ON public.campaign_outputs;
CREATE POLICY "Users can read own outputs" ON public.campaign_outputs AS PERMISSIVE FOR SELECT TO public USING ((campaign_id IN ( SELECT campaigns.id
   FROM campaigns
  WHERE (campaigns.store_id IN ( SELECT stores.id
           FROM stores
          WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))))))));

-- policy Users can read own scores on campaign_scores
DROP POLICY IF EXISTS "Users can read own scores" ON public.campaign_scores;
CREATE POLICY "Users can read own scores" ON public.campaign_scores AS PERMISSIVE FOR SELECT TO public USING ((campaign_id IN ( SELECT campaigns.id
   FROM campaigns
  WHERE (campaigns.store_id IN ( SELECT stores.id
           FROM stores
          WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))))))));

-- policy Users can manage own campaigns on campaigns
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.campaigns;
CREATE POLICY "Users can manage own campaigns" ON public.campaigns AS PERMISSIVE FOR ALL TO public USING ((store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))))));

-- policy Users can read own credits on credit_purchases
DROP POLICY IF EXISTS "Users can read own credits" ON public.credit_purchases;
CREATE POLICY "Users can read own credits" ON public.credit_purchases AS PERMISSIVE FOR SELECT TO public USING ((store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))))));

-- policy fashion_facts_admin_all on fashion_facts
DROP POLICY IF EXISTS "fashion_facts_admin_all" ON public.fashion_facts;
CREATE POLICY "fashion_facts_admin_all" ON public.fashion_facts AS PERMISSIVE FOR ALL TO public USING ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)) WITH CHECK ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text));

-- policy fashion_facts_read on fashion_facts
DROP POLICY IF EXISTS "fashion_facts_read" ON public.fashion_facts;
CREATE POLICY "fashion_facts_read" ON public.fashion_facts AS PERMISSIVE FOR SELECT TO public USING (true);

-- policy model_bank_public_read on model_bank
DROP POLICY IF EXISTS "model_bank_public_read" ON public.model_bank;
CREATE POLICY "model_bank_public_read" ON public.model_bank AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));

-- policy Plans are publicly readable on plans
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
CREATE POLICY "Plans are publicly readable" ON public.plans AS PERMISSIVE FOR SELECT TO public USING (true);

-- policy Service role can modify showcase on showcase_items
DROP POLICY IF EXISTS "Service role can modify showcase" ON public.showcase_items;
CREATE POLICY "Service role can modify showcase" ON public.showcase_items AS PERMISSIVE FOR ALL TO public USING ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)) WITH CHECK ((( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text));

-- policy showcase_public_read on showcase_items
DROP POLICY IF EXISTS "showcase_public_read" ON public.showcase_items;
CREATE POLICY "showcase_public_read" ON public.showcase_items AS PERMISSIVE FOR SELECT TO public USING (true);

-- policy Users can manage own models on store_models
DROP POLICY IF EXISTS "Users can manage own models" ON public.store_models;
CREATE POLICY "Users can manage own models" ON public.store_models AS PERMISSIVE FOR ALL TO public USING ((store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))))));

-- policy Users can read own usage on store_usage
DROP POLICY IF EXISTS "Users can read own usage" ON public.store_usage;
CREATE POLICY "Users can read own usage" ON public.store_usage AS PERMISSIVE FOR SELECT TO public USING ((store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))))));

-- policy Service role can insert stores on stores
DROP POLICY IF EXISTS "Service role can insert stores" ON public.stores;
CREATE POLICY "Service role can insert stores" ON public.stores AS PERMISSIVE FOR INSERT TO public WITH CHECK (((( SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text) OR (( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)));

-- policy Users can read own store on stores
DROP POLICY IF EXISTS "Users can read own store" ON public.stores;
CREATE POLICY "Users can read own store" ON public.stores AS PERMISSIVE FOR SELECT TO public USING ((clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))));

-- policy Users can update own store on stores
DROP POLICY IF EXISTS "Users can update own store" ON public.stores;
CREATE POLICY "Users can update own store" ON public.stores AS PERMISSIVE FOR UPDATE TO public USING ((clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text))));


-- ══ RPCs / Functions ══
CREATE OR REPLACE FUNCTION public.add_credits_atomic(p_store_id uuid, p_column text, p_quantity integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_val INTEGER;
BEGIN
  IF p_column NOT IN ('credit_campaigns', 'credit_models', 'credit_regenerations') THEN
    RAISE EXCEPTION 'Coluna inválida: %', p_column;
  END IF;

  EXECUTE format(
    'UPDATE stores SET %I = COALESCE(%I, 0) + $1 WHERE id = $2 RETURNING %I',
    p_column, p_column, p_column
  )
  INTO new_val
  USING p_quantity, p_store_id;

  RETURN new_val;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_generate_campaign(p_store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaigns_used INTEGER;
  v_campaigns_limit INTEGER;
  v_credits_available INTEGER;
BEGIN
  -- Pegar uso do mês atual
  SELECT COALESCE(campaigns_generated, 0), campaigns_limit
  INTO v_campaigns_used, v_campaigns_limit
  FROM public.store_usage
  WHERE store_id = p_store_id
    AND period_start = date_trunc('month', CURRENT_DATE)::date;

  -- Se não tem registro de uso, pode gerar (será criado na geração)
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Verificar créditos extras disponíveis
  SELECT COALESCE(SUM(quantity - consumed), 0)
  INTO v_credits_available
  FROM public.credit_purchases
  WHERE store_id = p_store_id
    AND type = 'campaign'
    AND period_end >= CURRENT_DATE
    AND consumed < quantity;

  -- Pode gerar se está dentro do limite OU tem créditos extras
  RETURN (v_campaigns_used < v_campaigns_limit) OR (v_credits_available > 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_credit_atomic(p_store_id uuid, p_column text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_val int;
  new_val int;
BEGIN
  -- Lock a row for update to prevent race conditions
  IF p_column = 'credit_campaigns' THEN
    SELECT credit_campaigns INTO current_val FROM stores WHERE id = p_store_id FOR UPDATE;
    IF current_val IS NULL OR current_val <= 0 THEN RETURN -1; END IF;
    UPDATE stores SET credit_campaigns = credit_campaigns - 1 WHERE id = p_store_id RETURNING credit_campaigns INTO new_val;
  ELSIF p_column = 'credit_models' THEN
    SELECT credit_models INTO current_val FROM stores WHERE id = p_store_id FOR UPDATE;
    IF current_val IS NULL OR current_val <= 0 THEN RETURN -1; END IF;
    UPDATE stores SET credit_models = credit_models - 1 WHERE id = p_store_id RETURNING credit_models INTO new_val;
  ELSIF p_column = 'credit_regenerations' THEN
    SELECT credit_regenerations INTO current_val FROM stores WHERE id = p_store_id FOR UPDATE;
    IF current_val IS NULL OR current_val <= 0 THEN RETURN -1; END IF;
    UPDATE stores SET credit_regenerations = credit_regenerations - 1 WHERE id = p_store_id RETURNING credit_regenerations INTO new_val;
  ELSE
    RETURN -1;
  END IF;
  RETURN COALESCE(new_val, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_campaign_usage(p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_limit INTEGER;
BEGIN
  -- Pegar limite do plano da loja
  SELECT p.campaigns_per_month INTO v_plan_limit
  FROM public.stores s
  JOIN public.plans p ON s.plan_id = p.id
  WHERE s.id = p_store_id;

  -- Upsert no store_usage
  INSERT INTO public.store_usage (store_id, period_start, period_end, campaigns_generated, campaigns_limit)
  VALUES (
    p_store_id,
    date_trunc('month', CURRENT_DATE)::date,
    (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date,
    1,
    COALESCE(v_plan_limit, 3)
  )
  ON CONFLICT (store_id, period_start)
  DO UPDATE SET campaigns_generated = public.store_usage.campaigns_generated + 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_campaigns_used(p_usage_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_val int;
BEGIN
  UPDATE store_usage
  SET campaigns_generated = campaigns_generated + 1
  WHERE id = p_usage_id
  RETURNING campaigns_generated INTO new_val;
  RETURN COALESCE(new_val, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_regen_count(p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_val int;
BEGIN
  UPDATE campaigns
  SET regen_count = COALESCE(regen_count, 0) + 1
  WHERE id = p_campaign_id
  RETURNING regen_count INTO new_val;
  RETURN COALESCE(new_val, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_campaign_sequence_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.sequence_number IS NULL THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1
    INTO NEW.sequence_number
    FROM campaigns
    WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_default_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.plan_id IS NULL THEN
    NEW.plan_id := (SELECT id FROM public.plans WHERE name = 'gratis' LIMIT 1);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
