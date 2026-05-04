-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — D-02: backfill subscription_status from mp_status + sub_id + period_end
-- Single SQL statement, idempotent (re-runnable). Mirrors cron/downgrade-expired logic.
-- ═══════════════════════════════════════════════════════════

UPDATE public.stores SET subscription_status = CASE
  -- Free plan or never subscribed → 'expired' (no premium to lose)
  WHEN plan_id = (SELECT id FROM public.plans WHERE name = 'gratis') THEN 'expired'::public.subscription_status
  -- Has active sub_id → 'active'
  WHEN mercadopago_subscription_id IS NOT NULL THEN 'active'::public.subscription_status
  -- No sub_id but premium plan with valid period → 'cancelled' (in grace/until-period_end)
  WHEN EXISTS (
    SELECT 1 FROM public.store_usage u
    WHERE u.store_id = stores.id
      AND u.period_end >= CURRENT_DATE
  ) THEN 'cancelled'::public.subscription_status
  -- Premium plan, no sub_id, period expired → 'expired'
  ELSE 'expired'::public.subscription_status
END
WHERE TRUE; -- explicit: backfill every row idempotently
