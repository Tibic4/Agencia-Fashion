-- ═══════════════════════════════════════════════════════════
-- Mini Trial Beta — 50 vagas, 1 campanha completa grátis por user
--
-- Estratégia: limita 1 trial por clerk_user_id (não por store_id)
-- pra evitar que a pessoa crie várias contas/lojas e drene o pool.
-- Atomicidade total: reserva vaga + concede crédito numa só transação.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mini_trial_uses (
  clerk_user_id text PRIMARY KEY,
  store_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mini_trial_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.mini_trial_uses;
CREATE POLICY "service_role_full_access"
  ON public.mini_trial_uses
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text)
  WITH CHECK ((SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_mini_trial_uses_granted
  ON public.mini_trial_uses (granted_at DESC);

-- ═══════════════════════════════════════════════════════════
-- RPC atômica: tenta reivindicar o trial.
-- Retorna jsonb com status:
--   { granted: true, remaining: N }
--   { granted: false, reason: "already_used" }
--   { granted: false, reason: "slots_full", total_used: 50 }
--   { granted: false, reason: "killswitch" }
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_mini_trial(
  p_clerk_user_id text,
  p_store_id uuid,
  p_total_slots integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used_count integer;
  v_already_used boolean;
BEGIN
  -- Lock pra evitar race condition no slot 50
  PERFORM pg_advisory_xact_lock(hashtext('mini_trial_claim'));

  -- 1. Já usou?
  SELECT EXISTS (
    SELECT 1 FROM public.mini_trial_uses WHERE clerk_user_id = p_clerk_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_used');
  END IF;

  -- 2. Quantos foram concedidos?
  SELECT COUNT(*) INTO v_used_count FROM public.mini_trial_uses;

  IF v_used_count >= p_total_slots THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'slots_full',
      'total_used', v_used_count,
      'total_slots', p_total_slots
    );
  END IF;

  -- 3. Concede: registra uso + adiciona 1 crédito de campanha
  INSERT INTO public.mini_trial_uses (clerk_user_id, store_id)
  VALUES (p_clerk_user_id, p_store_id);

  UPDATE public.stores
  SET credit_campaigns = COALESCE(credit_campaigns, 0) + 1,
      updated_at = now()
  WHERE id = p_store_id;

  RETURN jsonb_build_object(
    'granted', true,
    'remaining', p_total_slots - (v_used_count + 1),
    'total_used', v_used_count + 1,
    'total_slots', p_total_slots
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mini_trial(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mini_trial(text, uuid, integer) TO service_role;

-- ═══════════════════════════════════════════════════════════
-- View pública pra contador da landing (anon pode ler)
-- Não expõe quem usou, só o total.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.mini_trial_counter AS
SELECT COUNT(*) AS total_used FROM public.mini_trial_uses;

GRANT SELECT ON public.mini_trial_counter TO anon, authenticated;

COMMENT ON TABLE public.mini_trial_uses IS
  'Beta mini-trial: 1 campanha grátis por clerk_user_id. Limite global em ENV MINI_TRIAL_TOTAL_SLOTS.';
