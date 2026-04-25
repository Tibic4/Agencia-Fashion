-- ═══════════════════════════════════════════════════════════
-- Migration: plan_payments_applied
-- Idempotência do webhook MP para planos recorrentes.
-- Garante que o mesmo payment_id do Mercado Pago não seja aplicado
-- duas vezes (evita reset múltiplo de quota do plano).
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.plan_payments_applied (
  payment_id text PRIMARY KEY,
  store_id uuid NOT NULL,
  plan_id text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Habilita RLS (service role bypassa; policy restritiva para usuários)
ALTER TABLE public.plan_payments_applied ENABLE ROW LEVEL SECURITY;

-- Apenas service role acessa (webhook handler)
DROP POLICY IF EXISTS "service_role_full_access" ON public.plan_payments_applied;
CREATE POLICY "service_role_full_access"
  ON public.plan_payments_applied
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (
    (SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text
  )
  WITH CHECK (
    (SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text
  );

-- Índice para consultas históricas de pagamentos por loja
CREATE INDEX IF NOT EXISTS idx_plan_payments_store
  ON public.plan_payments_applied (store_id, applied_at DESC);

COMMENT ON TABLE public.plan_payments_applied IS
  'Idempotência: registra cada MP payment_id aplicado a um plano recorrente.
   Evita que retries do webhook causem double-reset de quota.';
