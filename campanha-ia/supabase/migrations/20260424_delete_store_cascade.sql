-- ═══════════════════════════════════════════════════════════
-- FASE M.3 — RPC para deletar loja em cascata (transacional).
-- Substitui o loop N-queries em /api/admin/stores DELETE,
-- garantindo atomicidade (ou tudo apaga ou nada).
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_store_cascade(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_ids uuid[];
  v_deleted jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  -- Coleta campaign ids upfront para children
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_campaign_ids
  FROM public.campaigns WHERE store_id = p_store_id;

  -- Children de campaigns
  DELETE FROM public.campaign_outputs WHERE campaign_id = ANY(v_campaign_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{campaign_outputs}', to_jsonb(v_count));

  DELETE FROM public.campaign_scores WHERE campaign_id = ANY(v_campaign_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{campaign_scores}', to_jsonb(v_count));

  -- Tabelas filhas diretas
  DELETE FROM public.campaigns WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{campaigns}', to_jsonb(v_count));

  DELETE FROM public.store_models WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{store_models}', to_jsonb(v_count));

  DELETE FROM public.credit_purchases WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{credit_purchases}', to_jsonb(v_count));

  DELETE FROM public.store_usage WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{store_usage}', to_jsonb(v_count));

  DELETE FROM public.api_cost_logs WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{api_cost_logs}', to_jsonb(v_count));

  -- plan_payments_applied pode não existir em ambientes antigos; tenta ignorar erro.
  BEGIN
    DELETE FROM public.plan_payments_applied WHERE store_id = p_store_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := jsonb_set(v_deleted, '{plan_payments_applied}', to_jsonb(v_count));
  EXCEPTION WHEN undefined_table THEN
    v_deleted := jsonb_set(v_deleted, '{plan_payments_applied}', '0'::jsonb);
  END;

  -- Por último, a store
  DELETE FROM public.stores WHERE id = p_store_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := jsonb_set(v_deleted, '{stores}', to_jsonb(v_count));

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_store_cascade(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_store_cascade(uuid) TO service_role;
