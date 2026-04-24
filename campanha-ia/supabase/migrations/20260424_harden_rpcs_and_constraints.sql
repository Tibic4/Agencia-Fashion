-- ═══════════════════════════════════════════════════════════
-- FASE 2 — Blindagem das RPCs + UNIQUE constraints faltantes
-- ═══════════════════════════════════════════════════════════

-- ─── 2.6 add_credits_atomic: SECURITY DEFINER + search_path + GRANT restrito ───
CREATE OR REPLACE FUNCTION public.add_credits_atomic(p_store_id uuid, p_column text, p_quantity integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  new_val INTEGER;
BEGIN
  IF p_column NOT IN ('credit_campaigns', 'credit_models', 'credit_regenerations') THEN
    RAISE EXCEPTION 'Coluna inválida: %', p_column;
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 THEN
    RAISE EXCEPTION 'quantity fora do range (1-10000): %', p_quantity;
  END IF;

  EXECUTE format(
    'UPDATE public.stores SET %I = COALESCE(%I, 0) + $1 WHERE id = $2 RETURNING %I',
    p_column, p_column, p_column
  )
  INTO new_val
  USING p_quantity, p_store_id;

  RETURN new_val;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_credits_atomic(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits_atomic(uuid, text, integer) TO service_role;

-- ─── 2.2 consume_credit_atomic: SECURITY DEFINER ───
CREATE OR REPLACE FUNCTION public.consume_credit_atomic(p_store_id uuid, p_column text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  current_val int;
  new_val int;
BEGIN
  IF p_column = 'credit_campaigns' THEN
    SELECT credit_campaigns INTO current_val FROM public.stores WHERE id = p_store_id FOR UPDATE;
    IF current_val IS NULL OR current_val <= 0 THEN RETURN -1; END IF;
    UPDATE public.stores SET credit_campaigns = credit_campaigns - 1 WHERE id = p_store_id RETURNING credit_campaigns INTO new_val;
  ELSIF p_column = 'credit_models' THEN
    SELECT credit_models INTO current_val FROM public.stores WHERE id = p_store_id FOR UPDATE;
    IF current_val IS NULL OR current_val <= 0 THEN RETURN -1; END IF;
    UPDATE public.stores SET credit_models = credit_models - 1 WHERE id = p_store_id RETURNING credit_models INTO new_val;
  ELSIF p_column = 'credit_regenerations' THEN
    SELECT credit_regenerations INTO current_val FROM public.stores WHERE id = p_store_id FOR UPDATE;
    IF current_val IS NULL OR current_val <= 0 THEN RETURN -1; END IF;
    UPDATE public.stores SET credit_regenerations = credit_regenerations - 1 WHERE id = p_store_id RETURNING credit_regenerations INTO new_val;
  ELSE
    RETURN -1;
  END IF;
  RETURN COALESCE(new_val, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_credit_atomic(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credit_atomic(uuid, text) TO service_role;

-- ─── 2.3 increment_campaigns_used: SECURITY DEFINER ───
CREATE OR REPLACE FUNCTION public.increment_campaigns_used(p_usage_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  new_val int;
BEGIN
  UPDATE public.store_usage
  SET campaigns_generated = campaigns_generated + 1
  WHERE id = p_usage_id
  RETURNING campaigns_generated INTO new_val;
  RETURN COALESCE(new_val, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_campaigns_used(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaigns_used(uuid) TO service_role;

-- ─── 2.5 decrement_campaigns_used (NOVA) — para refund atômico ───
CREATE OR REPLACE FUNCTION public.decrement_campaigns_used(p_usage_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  new_val int;
BEGIN
  UPDATE public.store_usage
  SET campaigns_generated = GREATEST(0, campaigns_generated - 1)
  WHERE id = p_usage_id
  RETURNING campaigns_generated INTO new_val;
  RETURN COALESCE(new_val, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.decrement_campaigns_used(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_campaigns_used(uuid) TO service_role;

-- ─── 2.4 increment_regen_count: SECURITY DEFINER + valida store_id (anti-IDOR) ───
CREATE OR REPLACE FUNCTION public.increment_regen_count(p_campaign_id uuid, p_store_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  new_val int;
BEGIN
  UPDATE public.campaigns
  SET regen_count = COALESCE(regen_count, 0) + 1
  WHERE id = p_campaign_id AND store_id = p_store_id
  RETURNING regen_count INTO new_val;
  IF new_val IS NULL THEN
    RAISE EXCEPTION 'Campaign não encontrada ou não pertence à store';
  END IF;
  RETURN new_val;
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_regen_count(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_regen_count(uuid, uuid) TO service_role;

-- Mantém a antiga assinatura para compat (deprecated)
CREATE OR REPLACE FUNCTION public.increment_regen_count(p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  new_val int;
BEGIN
  UPDATE public.campaigns
  SET regen_count = COALESCE(regen_count, 0) + 1
  WHERE id = p_campaign_id
  RETURNING regen_count INTO new_val;
  RETURN COALESCE(new_val, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_regen_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_regen_count(uuid) TO service_role;

-- ─── 2.9 UNIQUE em credit_purchases(mercadopago_payment_id, type) ───
-- Evita que o webhook MP credite 2x o mesmo pagamento se houver race condition
-- entre o check idempotente e o INSERT.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_purchases_mp_payment_type
  ON public.credit_purchases (mercadopago_payment_id, type)
  WHERE mercadopago_payment_id IS NOT NULL;

-- ─── 2.11 UNIQUE em campaigns(store_id, sequence_number) ───
-- Corrige race condition no trigger set_campaign_sequence_number
-- (dois inserts simultâneos no mesmo store pegavam o mesmo MAX).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_campaigns_store_sequence
  ON public.campaigns (store_id, sequence_number)
  WHERE sequence_number IS NOT NULL;

-- ─── 2.12 Índices extras para performance do admin dashboard ───
CREATE INDEX IF NOT EXISTS idx_campaigns_status_created
  ON public.campaigns (status, created_at DESC)
  WHERE status IN ('completed', 'failed');

CREATE INDEX IF NOT EXISTS idx_credit_purchases_store_created
  ON public.credit_purchases (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stores_created
  ON public.stores (created_at DESC);
