-- recent_pose_indices: histórico curto das poses usadas em campanhas recentes,
-- pra evitar repetição entre campanhas próximas (anti-monotonia).
--
-- Cap em 6 = últimas 2 campanhas (3 poses cada). A coluna armazena os indices
-- do POSE_BANK em src/lib/ai/identity-translations.ts. Lê antes de cada
-- Analyzer call e bloqueia esses indices na escolha; escreve após VTO bem
-- sucedido.
--
-- Range válido: 0..(POSE_BANK_TOTAL-1). Atualmente bank tem 12 poses (0..11).

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS recent_pose_indices INTEGER[] DEFAULT '{}'::INTEGER[];

COMMENT ON COLUMN stores.recent_pose_indices IS
  'Últimos 6 indices de pose usados em campanhas. Cap = ~2 campanhas. Bloqueia na próxima geração para evitar repetição. Indices referem ao POSE_BANK em src/lib/ai/identity-translations.ts.';
