-- ═══════════════════════════════════════════════════════════
-- ⚠️ OBSOLETO — DESDE 2026-04-30
--
-- Este script trazia os preços antigos (179/359/749) que não valem mais.
-- A última atualização de pricing está em:
--   supabase/migrations/20260430_180000_update_plan_pricing.sql
-- (Essencial 89 / Pro 179 / Business 379).
--
-- Mantido apenas pra histórico — NÃO rodar em prod.
-- Quando precisar fazer um seed completo do zero, gere um novo script
-- a partir de src/lib/plans.ts.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────
-- 1. ATUALIZAR PLANO ESSENCIAL
-- ─────────────────────────────────────
UPDATE plans SET 
  display_name = 'Essencial',
  price_monthly = 179.00,
  campaigns_per_month = 15,
  models_limit = 5,
  model_creations_per_month = 5,
  history_days = 30,
  support_channel = 'whatsapp',
  score_level = 'basic',
  has_preview_link = false,
  has_white_label = false,
  has_api_access = false
WHERE name = 'essencial';

-- ─────────────────────────────────────
-- 2. ATUALIZAR PLANO PRO
-- ─────────────────────────────────────
UPDATE plans SET 
  display_name = 'Pro',
  price_monthly = 359.00,
  campaigns_per_month = 40,
  models_limit = 15,
  model_creations_per_month = 15,
  history_days = 365,
  support_channel = 'whatsapp',
  score_level = 'advanced',
  has_preview_link = true,
  has_white_label = false,
  has_api_access = false
WHERE name = 'pro';

-- ─────────────────────────────────────
-- 3. ATUALIZAR PLANO BUSINESS
-- ─────────────────────────────────────
UPDATE plans SET 
  display_name = 'Business',
  price_monthly = 749.00,
  campaigns_per_month = 100,
  models_limit = 40,
  model_creations_per_month = 40,
  history_days = 0,  -- 0 = ilimitado
  support_channel = 'vip',
  score_level = 'advanced',
  has_preview_link = true,
  has_white_label = true,
  has_api_access = true
WHERE name = 'business';

-- ─────────────────────────────────────
-- 4. GARANTIR QUE PLANO GRÁTIS EXISTE
-- ─────────────────────────────────────
UPDATE plans SET 
  display_name = 'Gratuito',
  price_monthly = 0,
  campaigns_per_month = 0,
  models_limit = 0,
  model_creations_per_month = 0,
  history_days = 7,
  support_channel = 'email'
WHERE name = 'gratis';

-- ─────────────────────────────────────
-- 5. ATUALIZAR STORE_USAGE DOS USUÁRIOS ATUAIS
--    (reseta campaigns_limit para o novo valor do plano)
-- ─────────────────────────────────────
UPDATE store_usage su
SET campaigns_limit = p.campaigns_per_month
FROM stores s
JOIN plans p ON s.plan_id = p.id
WHERE su.store_id = s.id
  AND su.period_end >= CURRENT_DATE;

COMMIT;

-- ─────────────────────────────────────
-- 6. VERIFICAR RESULTADOS
-- ─────────────────────────────────────
SELECT 
  name,
  display_name,
  price_monthly,
  campaigns_per_month,
  models_limit,
  model_creations_per_month,
  history_days,
  support_channel
FROM plans 
ORDER BY price_monthly ASC;
