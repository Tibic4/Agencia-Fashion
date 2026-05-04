-- ═══════════════════════════════════════════════════════════
-- Phase 4 / 04-01 — D-18: REVOKE FROM PUBLIC/anon/authenticated; GRANT to service_role
-- Mirrors the pattern established in 20260424_harden_rpcs_and_constraints.sql.
-- These four RPCs were missed in the original hardening pass.
-- ═══════════════════════════════════════════════════════════

-- ─── acquire_checkout_lock(p_store_id uuid, p_plan_id text, p_ttl_seconds integer) ───
REVOKE ALL ON FUNCTION public.acquire_checkout_lock(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_checkout_lock(uuid, text, integer) TO service_role;

-- ─── release_checkout_lock(p_store_id uuid, p_plan_id text) ───
REVOKE ALL ON FUNCTION public.release_checkout_lock(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_checkout_lock(uuid, text) TO service_role;

-- ─── can_generate_campaign(p_store_id uuid) ───
REVOKE ALL ON FUNCTION public.can_generate_campaign(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_generate_campaign(uuid) TO service_role;

-- ─── increment_campaign_usage(p_store_id uuid) ───
REVOKE ALL ON FUNCTION public.increment_campaign_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_usage(uuid) TO service_role;
