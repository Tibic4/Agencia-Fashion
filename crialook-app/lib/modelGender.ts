/**
 * Gênero gramatical pra labels que dependem do modelo (Pt-BR usa concordância
 * obrigatória: "Sua/Seu modelo", "Ativa/Ativo"). Centraliza a decisão num
 * helper só pra os 3+ lugares (history card, model grid, bottom sheet,
 * gerar selector) ficarem consistentes — antes cada tela inferia gender
 * de um jeito (algumas erradas, ex.: bodyKey.startsWith('homem') que nunca
 * matchava porque os values reais são `atletico`/`medio`/`robusto`).
 */

export const MASC_BODY_TYPES = new Set([
  'atletico',
  'medio',
  'masculino',
  'robusto',
]);

/** Detecta gênero do modelo. Prefere o campo `gender` (canônico no DB);
    cai em body_type pra suporte a registros antigos sem gender. */
export function isMaleModel(model: { body_type?: string; gender?: string }): boolean {
  if (model.gender === 'masculino') return true;
  if (model.gender === 'feminino') return false;
  return model.body_type ? MASC_BODY_TYPES.has(model.body_type) : false;
}
