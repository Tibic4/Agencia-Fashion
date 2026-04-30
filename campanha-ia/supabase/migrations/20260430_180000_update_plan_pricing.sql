-- Atualização de pricing — corte ~50% nos planos e packs avulsos.
--
-- Mantém quantidades (15/40/100 camp/mês, packs 3/10/20). Só os preços
-- caem; margem segue acima de 70% em todos.
--
-- Run no Supabase SQL Editor antes de promover o deploy do código —
-- src/lib/plans.ts já está nos valores novos.

BEGIN;

UPDATE plans SET price_monthly = 89.00  WHERE name = 'essencial';
UPDATE plans SET price_monthly = 179.00 WHERE name = 'pro';
UPDATE plans SET price_monthly = 379.00 WHERE name = 'business';

COMMIT;

SELECT name, display_name, price_monthly, campaigns_per_month
FROM plans
ORDER BY price_monthly ASC;
