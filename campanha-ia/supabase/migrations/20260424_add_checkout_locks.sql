-- ═══════════════════════════════════════════════════════════
-- Migration: checkout_locks
-- Idempotência de /api/checkout para impedir
-- que 2 cliques em 100ms criem 2 PreApprovals no Mercado Pago
-- (cobrança dupla do cartão, subscription órfã).
--
-- Estratégia: UPSERT com unique (store_id, plan_id) + TTL de 60s.
-- Se o lock for encontrado ainda vivo, retorna erro 409.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.checkout_locks (
  store_id uuid NOT NULL,
  plan_id text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  PRIMARY KEY (store_id, plan_id)
);

ALTER TABLE public.checkout_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.checkout_locks;
CREATE POLICY "service_role_full_access"
  ON public.checkout_locks
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)
  WITH CHECK ((SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_checkout_locks_expires
  ON public.checkout_locks (expires_at);

-- RPC atômica: tenta adquirir o lock. Retorna true se obteve, false se outro está ativo.
CREATE OR REPLACE FUNCTION public.acquire_checkout_lock(
  p_store_id uuid,
  p_plan_id text,
  p_ttl_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_expires timestamptz;
BEGIN
  -- Remove locks expirados primeiro (cleanup lazy)
  DELETE FROM checkout_locks WHERE expires_at < now();

  SELECT expires_at INTO v_existing_expires
  FROM checkout_locks
  WHERE store_id = p_store_id AND plan_id = p_plan_id
  FOR UPDATE;

  IF FOUND AND v_existing_expires > now() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO checkout_locks (store_id, plan_id, locked_at, expires_at)
  VALUES (p_store_id, p_plan_id, now(), now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (store_id, plan_id) DO UPDATE
    SET locked_at = now(), expires_at = now() + make_interval(secs => p_ttl_seconds);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_checkout_lock(
  p_store_id uuid,
  p_plan_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM checkout_locks
  WHERE store_id = p_store_id AND plan_id = p_plan_id;
END;
$$;

COMMENT ON TABLE public.checkout_locks IS
  'Locks transitórios para impedir double-checkout. TTL padrão 60s.';
