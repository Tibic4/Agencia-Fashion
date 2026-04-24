# Supabase — Inventário do Schema (introspecção automática)

_Gerado em 2026-04-24T19:42:18.993Z_

Projeto: `emybirklqhonqodzyzet`

## RLS por tabela

| Tabela | RLS habilitado | Forçado |
|---|---|---|
| admin_settings | ✅ | — |
| api_cost_logs | ✅ | — |
| campaign_outputs | ✅ | — |
| campaign_scores | ✅ | — |
| campaigns | ✅ | — |
| credit_purchases | ✅ | — |
| fashion_facts | ✅ | — |
| model_bank | ✅ | — |
| plans | ✅ | — |
| showcase_items | ✅ | — |
| store_models | ✅ | — |
| store_usage | ✅ | — |
| stores | ✅ | — |

## Policies

- **admin_settings** · `Anyone can read admin settings` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `true`
- **admin_settings** · `Service role can modify settings` (ALL, PERMISSIVE)
  - roles: "{public}"
  - USING: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
  - WITH CHECK: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
- **api_cost_logs** · `service_role_full_access` (ALL, PERMISSIVE)
  - roles: "{public}"
  - USING: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
  - WITH CHECK: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
- **campaign_outputs** · `Users can read own outputs` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `(campaign_id IN ( SELECT campaigns.id
   FROM campaigns
  WHERE (campaigns.store_id IN ( SELECT stores.id
           FROM stores
          WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))))`
- **campaign_scores** · `Users can read own scores` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `(campaign_id IN ( SELECT campaigns.id
   FROM campaigns
  WHERE (campaigns.store_id IN ( SELECT stores.id
           FROM stores
          WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))))`
- **campaigns** · `Users can manage own campaigns` (ALL, PERMISSIVE)
  - roles: "{public}"
  - USING: `(store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))`
- **credit_purchases** · `Users can read own credits` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `(store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))`
- **fashion_facts** · `fashion_facts_admin_all` (ALL, PERMISSIVE)
  - roles: "{public}"
  - USING: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
  - WITH CHECK: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
- **fashion_facts** · `fashion_facts_read` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `true`
- **model_bank** · `model_bank_public_read` (SELECT, PERMISSIVE)
  - roles: "{anon,authenticated}"
  - USING: `(is_active = true)`
- **plans** · `Plans are publicly readable` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `true`
- **showcase_items** · `Service role can modify showcase` (ALL, PERMISSIVE)
  - roles: "{public}"
  - USING: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
  - WITH CHECK: `(( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)`
- **showcase_items** · `showcase_public_read` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `true`
- **store_models** · `Users can manage own models` (ALL, PERMISSIVE)
  - roles: "{public}"
  - USING: `(store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))`
- **store_usage** · `Users can read own usage` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `(store_id IN ( SELECT stores.id
   FROM stores
  WHERE (stores.clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))))`
- **stores** · `Service role can insert stores` (INSERT, PERMISSIVE)
  - roles: "{public}"
  - WITH CHECK: `((( SELECT (auth.jwt() ->> 'role'::text)) = 'service_role'::text) OR (( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text))`
- **stores** · `Users can read own store` (SELECT, PERMISSIVE)
  - roles: "{public}"
  - USING: `(clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))`
- **stores** · `Users can update own store` (UPDATE, PERMISSIVE)
  - roles: "{public}"
  - USING: `(clerk_user_id = ( SELECT (auth.jwt() ->> 'sub'::text)))`

## Funções (RPCs) no schema public

### `add_credits_atomic(p_store_id uuid, p_column text, p_quantity integer)` → integer
_Lang: plpgsql · Security: invoker_

```sql
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

```

### `can_generate_campaign(p_store_id uuid)` → boolean
_Lang: plpgsql · Security: definer_

```sql
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

```

### `consume_credit_atomic(p_store_id uuid, p_column text)` → integer
_Lang: plpgsql · Security: invoker_

```sql
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

```

### `increment_campaign_usage(p_store_id uuid)` → void
_Lang: plpgsql · Security: definer_

```sql
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

```

### `increment_campaigns_used(p_usage_id uuid)` → integer
_Lang: plpgsql · Security: invoker_

```sql
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

```

### `increment_regen_count(p_campaign_id uuid)` → integer
_Lang: plpgsql · Security: invoker_

```sql
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

```

### `set_campaign_sequence_number()` → trigger
_Lang: plpgsql · Security: invoker_

```sql
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

```

### `set_default_plan()` → trigger
_Lang: plpgsql · Security: invoker_

```sql
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

```

### `update_updated_at_column()` → trigger
_Lang: plpgsql · Security: invoker_

```sql
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

```

## Índices

- `admin_settings_pkey` em `admin_settings`
  `CREATE UNIQUE INDEX admin_settings_pkey ON public.admin_settings USING btree (key)`
- `api_cost_logs_pkey` em `api_cost_logs`
  `CREATE UNIQUE INDEX api_cost_logs_pkey ON public.api_cost_logs USING btree (id)`
- `idx_costs_campaign` em `api_cost_logs`
  `CREATE INDEX idx_costs_campaign ON public.api_cost_logs USING btree (campaign_id)`
- `idx_costs_created` em `api_cost_logs`
  `CREATE INDEX idx_costs_created ON public.api_cost_logs USING btree (created_at)`
- `idx_costs_date_provider` em `api_cost_logs`
  `CREATE INDEX idx_costs_date_provider ON public.api_cost_logs USING btree (created_at, provider)`
- `idx_costs_provider` em `api_cost_logs`
  `CREATE INDEX idx_costs_provider ON public.api_cost_logs USING btree (provider)`
- `idx_costs_store` em `api_cost_logs`
  `CREATE INDEX idx_costs_store ON public.api_cost_logs USING btree (store_id)`
- `campaign_outputs_pkey` em `campaign_outputs`
  `CREATE UNIQUE INDEX campaign_outputs_pkey ON public.campaign_outputs USING btree (id)`
- `idx_outputs_campaign` em `campaign_outputs`
  `CREATE INDEX idx_outputs_campaign ON public.campaign_outputs USING btree (campaign_id)`
- `campaign_scores_pkey` em `campaign_scores`
  `CREATE UNIQUE INDEX campaign_scores_pkey ON public.campaign_scores USING btree (id)`
- `idx_scores_campaign` em `campaign_scores`
  `CREATE INDEX idx_scores_campaign ON public.campaign_scores USING btree (campaign_id)`
- `campaigns_pkey` em `campaigns`
  `CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id)`
- `idx_campaigns_created` em `campaigns`
  `CREATE INDEX idx_campaigns_created ON public.campaigns USING btree (created_at DESC)`
- `idx_campaigns_favorites` em `campaigns`
  `CREATE INDEX idx_campaigns_favorites ON public.campaigns USING btree (store_id, is_favorited) WHERE (is_favorited = true)`
- `idx_campaigns_gc_candidates` em `campaigns`
  `CREATE INDEX idx_campaigns_gc_candidates ON public.campaigns USING btree (created_at) WHERE ((is_favorited = false) AND (status = ANY (ARRAY['completed'::text, 'failed'::text])))`
- `idx_campaigns_model_bank_id` em `campaigns`
  `CREATE INDEX idx_campaigns_model_bank_id ON public.campaigns USING btree (model_bank_id)`
- `idx_campaigns_model_id` em `campaigns`
  `CREATE INDEX idx_campaigns_model_id ON public.campaigns USING btree (model_id)`
- `idx_campaigns_parent_id` em `campaigns`
  `CREATE INDEX idx_campaigns_parent_id ON public.campaigns USING btree (parent_campaign_id)`
- `idx_campaigns_status` em `campaigns`
  `CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status)`
- `idx_campaigns_store` em `campaigns`
  `CREATE INDEX idx_campaigns_store ON public.campaigns USING btree (store_id)`
- `credit_purchases_pkey` em `credit_purchases`
  `CREATE UNIQUE INDEX credit_purchases_pkey ON public.credit_purchases USING btree (id)`
- `idx_credit_purchases_store` em `credit_purchases`
  `CREATE INDEX idx_credit_purchases_store ON public.credit_purchases USING btree (store_id)`
- `fashion_facts_pkey` em `fashion_facts`
  `CREATE UNIQUE INDEX fashion_facts_pkey ON public.fashion_facts USING btree (id)`
- `idx_fashion_facts_active` em `fashion_facts`
  `CREATE INDEX idx_fashion_facts_active ON public.fashion_facts USING btree (is_active, priority DESC)`
- `idx_model_bank_body_type` em `model_bank`
  `CREATE INDEX idx_model_bank_body_type ON public.model_bank USING btree (body_type) WHERE (is_active = true)`
- `model_bank_pkey` em `model_bank`
  `CREATE UNIQUE INDEX model_bank_pkey ON public.model_bank USING btree (id)`
- `plans_name_key` em `plans`
  `CREATE UNIQUE INDEX plans_name_key ON public.plans USING btree (name)`
- `plans_pkey` em `plans`
  `CREATE UNIQUE INDEX plans_pkey ON public.plans USING btree (id)`
- `showcase_items_pkey` em `showcase_items`
  `CREATE UNIQUE INDEX showcase_items_pkey ON public.showcase_items USING btree (id)`
- `idx_store_models_store` em `store_models`
  `CREATE INDEX idx_store_models_store ON public.store_models USING btree (store_id)`
- `store_models_pkey` em `store_models`
  `CREATE UNIQUE INDEX store_models_pkey ON public.store_models USING btree (id)`
- `idx_usage_store_period` em `store_usage`
  `CREATE INDEX idx_usage_store_period ON public.store_usage USING btree (store_id, period_start)`
- `store_usage_pkey` em `store_usage`
  `CREATE UNIQUE INDEX store_usage_pkey ON public.store_usage USING btree (id)`
- `store_usage_store_id_period_start_key` em `store_usage`
  `CREATE UNIQUE INDEX store_usage_store_id_period_start_key ON public.store_usage USING btree (store_id, period_start)`
- `idx_stores_clerk` em `stores`
  `CREATE INDEX idx_stores_clerk ON public.stores USING btree (clerk_user_id)`
- `idx_stores_plan` em `stores`
  `CREATE INDEX idx_stores_plan ON public.stores USING btree (plan_id)`
- `stores_clerk_user_id_key` em `stores`
  `CREATE UNIQUE INDEX stores_clerk_user_id_key ON public.stores USING btree (clerk_user_id)`
- `stores_pkey` em `stores`
  `CREATE UNIQUE INDEX stores_pkey ON public.stores USING btree (id)`

## Constraints

- `admin_settings` · CHECK `2200_17741_1_not_null` (null)
- `admin_settings` · CHECK `2200_17741_2_not_null` (null)
- `admin_settings` · PRIMARY KEY `admin_settings_pkey` (key)
- `api_cost_logs` · CHECK `2200_17700_10_not_null` (null)
- `api_cost_logs` · CHECK `2200_17700_11_not_null` (null)
- `api_cost_logs` · CHECK `2200_17700_1_not_null` (null)
- `api_cost_logs` · CHECK `2200_17700_4_not_null` (null)
- `api_cost_logs` · FOREIGN KEY `api_cost_logs_campaign_id_fkey` (campaign_id) → campaigns(id)
- `api_cost_logs` · FOREIGN KEY `api_cost_logs_store_id_fkey` (store_id) → stores(id)
- `api_cost_logs` · PRIMARY KEY `api_cost_logs_pkey` (id)
- `campaign_outputs` · CHECK `2200_17651_1_not_null` (null)
- `campaign_outputs` · CHECK `2200_17651_2_not_null` (null)
- `campaign_outputs` · FOREIGN KEY `campaign_outputs_campaign_id_fkey` (campaign_id) → campaigns(id)
- `campaign_outputs` · PRIMARY KEY `campaign_outputs_pkey` (id)
- `campaign_scores` · CHECK `2200_17666_1_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_2_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_3_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_4_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_5_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_6_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_7_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_8_not_null` (null)
- `campaign_scores` · CHECK `2200_17666_9_not_null` (null)
- `campaign_scores` · FOREIGN KEY `campaign_scores_campaign_id_fkey` (campaign_id) → campaigns(id)
- `campaign_scores` · PRIMARY KEY `campaign_scores_pkey` (id)
- `campaigns` · CHECK `2200_17615_1_not_null` (null)
- `campaigns` · CHECK `2200_17615_28_not_null` (null)
- `campaigns` · CHECK `2200_17615_2_not_null` (null)
- `campaigns` · CHECK `2200_17615_3_not_null` (null)
- `campaigns` · CHECK `2200_17615_4_not_null` (null)
- `campaigns` · CHECK `2200_17615_5_not_null` (null)
- `campaigns` · FOREIGN KEY `campaigns_model_bank_id_fkey` (model_bank_id) → model_bank(id)
- `campaigns` · FOREIGN KEY `campaigns_model_id_fkey` (model_id) → store_models(id)
- `campaigns` · FOREIGN KEY `campaigns_parent_campaign_id_fkey` (parent_campaign_id) → campaigns(id)
- `campaigns` · FOREIGN KEY `campaigns_store_id_fkey` (store_id) → stores(id)
- `campaigns` · PRIMARY KEY `campaigns_pkey` (id)
- `credit_purchases` · CHECK `2200_17725_1_not_null` (null)
- `credit_purchases` · CHECK `2200_17725_2_not_null` (null)
- `credit_purchases` · CHECK `2200_17725_3_not_null` (null)
- `credit_purchases` · CHECK `2200_17725_4_not_null` (null)
- `credit_purchases` · CHECK `2200_17725_5_not_null` (null)
- `credit_purchases` · CHECK `2200_17725_7_not_null` (null)
- `credit_purchases` · CHECK `2200_17725_8_not_null` (null)
- `credit_purchases` · FOREIGN KEY `credit_purchases_store_id_fkey` (store_id) → stores(id)
- `credit_purchases` · PRIMARY KEY `credit_purchases_pkey` (id)
- `fashion_facts` · CHECK `2200_19033_1_not_null` (null)
- `fashion_facts` · CHECK `2200_19033_2_not_null` (null)
- `fashion_facts` · CHECK `2200_19033_3_not_null` (null)
- `fashion_facts` · CHECK `2200_19033_4_not_null` (null)
- `fashion_facts` · CHECK `2200_19033_6_not_null` (null)
- `fashion_facts` · CHECK `2200_19033_7_not_null` (null)
- `fashion_facts` · CHECK `2200_19033_8_not_null` (null)
- `fashion_facts` · CHECK `2200_19033_9_not_null` (null)
- `fashion_facts` · PRIMARY KEY `fashion_facts_pkey` (id)
- `model_bank` · CHECK `2200_17839_12_not_null` (null)
- `model_bank` · CHECK `2200_17839_1_not_null` (null)
- `model_bank` · CHECK `2200_17839_2_not_null` (null)
- `model_bank` · CHECK `2200_17839_3_not_null` (null)
- `model_bank` · CHECK `2200_17839_4_not_null` (null)
- `model_bank` · CHECK `2200_17839_5_not_null` (null)
- `model_bank` · CHECK `2200_17839_6_not_null` (null)
- `model_bank` · CHECK `model_bank_body_type_check` (null)
- `model_bank` · PRIMARY KEY `model_bank_pkey` (id)
- `plans` · CHECK `2200_17548_10_not_null` (null)
- `plans` · CHECK `2200_17548_11_not_null` (null)
- `plans` · CHECK `2200_17548_1_not_null` (null)
- `plans` · CHECK `2200_17548_2_not_null` (null)
- `plans` · CHECK `2200_17548_3_not_null` (null)
- `plans` · CHECK `2200_17548_4_not_null` (null)
- `plans` · CHECK `2200_17548_6_not_null` (null)
- `plans` · CHECK `2200_17548_7_not_null` (null)
- `plans` · CHECK `2200_17548_8_not_null` (null)
- `plans` · CHECK `2200_17548_9_not_null` (null)
- `plans` · PRIMARY KEY `plans_pkey` (id)
- `plans` · UNIQUE `plans_name_key` (name)
- `showcase_items` · CHECK `2200_17801_1_not_null` (null)
- `showcase_items` · CHECK `2200_17801_2_not_null` (null)
- `showcase_items` · CHECK `2200_17801_3_not_null` (null)
- `showcase_items` · PRIMARY KEY `showcase_items_pkey` (id)
- `store_models` · CHECK `2200_17596_19_not_null` (null)
- `store_models` · CHECK `2200_17596_1_not_null` (null)
- `store_models` · CHECK `2200_17596_2_not_null` (null)
- `store_models` · CHECK `2200_17596_4_not_null` (null)
- `store_models` · CHECK `2200_17596_5_not_null` (null)
- `store_models` · CHECK `2200_17596_7_not_null` (null)
- `store_models` · CHECK `2200_17596_8_not_null` (null)
- `store_models` · CHECK `store_models_gender_check` (null)
- `store_models` · FOREIGN KEY `store_models_store_id_fkey` (store_id) → stores(id)
- `store_models` · PRIMARY KEY `store_models_pkey` (id)
- `store_usage` · CHECK `2200_17681_1_not_null` (null)
- `store_usage` · CHECK `2200_17681_2_not_null` (null)
- `store_usage` · CHECK `2200_17681_3_not_null` (null)
- `store_usage` · CHECK `2200_17681_4_not_null` (null)
- `store_usage` · CHECK `2200_17681_6_not_null` (null)
- `store_usage` · FOREIGN KEY `store_usage_store_id_fkey` (store_id) → stores(id)
- `store_usage` · PRIMARY KEY `store_usage_pkey` (id)
- `store_usage` · UNIQUE `store_usage_store_id_period_start_key` (store_id, store_id, period_start, period_start)
- `stores` · CHECK `2200_17572_1_not_null` (null)
- `stores` · CHECK `2200_17572_2_not_null` (null)
- `stores` · CHECK `2200_17572_3_not_null` (null)
- `stores` · CHECK `2200_17572_4_not_null` (null)
- `stores` · FOREIGN KEY `stores_plan_id_fkey` (plan_id) → plans(id)
- `stores` · PRIMARY KEY `stores_pkey` (id)
- `stores` · UNIQUE `stores_clerk_user_id_key` (clerk_user_id)