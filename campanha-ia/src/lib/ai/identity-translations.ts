/**
 * Traduções compartilhadas de ModelInfo (PT codes → English natural language).
 *
 * Usado por:
 *  - gemini-analyzer.ts → contexto da modelo no system prompt
 *  - gemini-vto-generator.ts → Identity Lock block no VTO prompt
 *
 * Manter em UM lugar evita drift entre as duas pontas (mesma modelo descrita
 * de forma diferente nos dois prompts = alucinação garantida).
 */

export interface ModelInfo {
  skinTone?: string;
  bodyType?: string;
  pose?: string;
  hairColor?: string;
  hairTexture?: string;
  hairLength?: string;
  ageRange?: string;
  style?: string;
  gender?: string;
}

// ═══════════════════════════════════════
// Traduções PT → EN
// ═══════════════════════════════════════

export const SKIN_TONE_MAP: Record<string, string> = {
  branca: "fair/light skin",
  morena_clara: "light-medium warm skin tone",
  morena: "medium-to-dark warm brown skin",
  negra: "deep rich dark skin",
};

export const BODY_MAP: Record<string, string> = {
  normal: "standard/slim body frame",
  media: "standard average build",
  medio: "standard average male build",
  magra: "slim/petite body frame",
  plus_size: "plus-size curvy body with full figure",
  plus: "plus-size curvy body with full figure",
  robusto: "robust/heavy-set male build with broad shoulders and stocky frame",
  atletico: "athletic muscular build",
};

/**
 * Cabelo + hex aproximado da cor (ancora muito mais que só "dark brown").
 * Hex é referência editorial, não cor pixel-exata — basta pra Gemini ancorar.
 */
export const HAIR_COLOR_MAP: Record<string, { label: string; hex: string }> = {
  preto: { label: "jet black hair", hex: "#0E0E0E" },
  castanho_escuro: { label: "dark brown hair", hex: "#3D2817" },
  castanho: { label: "medium brown hair", hex: "#6B4423" },
  ruivo: { label: "auburn/red hair", hex: "#8B3A1F" },
  loiro_escuro: { label: "dark blonde hair", hex: "#8B7355" },
  loiro: { label: "blonde hair", hex: "#D4A574" },
  platinado: { label: "platinum blonde hair", hex: "#E5DCC5" },
};

export const HAIR_TEXTURE_MAP: Record<string, string> = {
  liso: "straight",
  ondulado: "wavy",
  cacheado: "curly",
  crespo: "coily/afro-textured",
};

export const HAIR_LENGTH_MAP: Record<string, string> = {
  joaozinho: "pixie-cut short",
  chanel: "bob-cut chin-length",
  ombro: "shoulder-length",
  medio: "medium-length past shoulders",
  longo: "long flowing",
};

export const AGE_MAP: Record<string, string> = {
  jovem_18_25: "young person (18-25)",
  adulta_26_35: "adult woman (26-35)",
  adulto_26_35: "adult man (26-35)",
  madura_36_50: "mature woman (36-50)",
  maduro_36_50: "mature man (36-50)",
};

export function isMaleGender(gender?: string): boolean {
  return gender === "masculino" || gender === "male" || gender === "m";
}

// ═══════════════════════════════════════
// Identity Lock builder (usado pelo VTO)
// ═══════════════════════════════════════

/**
 * Bloco de texto pra injetar no topo do prompt VTO. Linguagem POSITIVA
 * (evita "do not change" — image models seguem afirmações concretas
 * melhor que negações).
 *
 * Retorna null se modelInfo não tem dados suficientes — caller cai no
 * fallback genérico ("preserve from IMAGE 1").
 */
export function buildIdentityLock(mi: ModelInfo | undefined): string | null {
  if (!mi) return null;
  const isMale = isMaleGender(mi.gender);

  const lines: string[] = [];

  // Cabelo: o ponto crítico que vinha alucinando.
  const hairColor = mi.hairColor ? HAIR_COLOR_MAP[mi.hairColor] : null;
  const hairTexture = mi.hairTexture ? HAIR_TEXTURE_MAP[mi.hairTexture] : null;
  const hairLength = mi.hairLength ? HAIR_LENGTH_MAP[mi.hairLength] : null;
  if (hairColor || hairTexture || hairLength) {
    const parts: string[] = [];
    if (hairColor) parts.push(`color is ${hairColor.label} (${hairColor.hex})`);
    if (hairTexture) parts.push(`texture is ${hairTexture}`);
    if (hairLength) parts.push(`length is ${hairLength}`);
    lines.push(`• Hair: ${parts.join(", ")}`);
  }

  if (mi.skinTone && SKIN_TONE_MAP[mi.skinTone]) {
    lines.push(`• Skin: ${SKIN_TONE_MAP[mi.skinTone]}`);
  }
  if (mi.bodyType && BODY_MAP[mi.bodyType]) {
    lines.push(`• Body: ${BODY_MAP[mi.bodyType]}`);
  }
  if (mi.ageRange && AGE_MAP[mi.ageRange]) {
    lines.push(`• Age: ${AGE_MAP[mi.ageRange]}`);
  }

  if (lines.length === 0) return null;

  return `🔒 IDENTITY LOCK (highest priority — overrides any scene description below):
The ${isMale ? "man" : "woman"} in IMAGE 1 has these FIXED attributes:
${lines.join("\n")}

These attributes are LOCKED. Reproduce them exactly in the output.
If the scene description below mentions hair, skin, eyes, or age — IGNORE that part.
The IDENTITY LOCK above always wins over scene description on identity traits.`;
}

// ═══════════════════════════════════════
// Pose Bank — 8 poses estáveis (foto única universal)
// ═══════════════════════════════════════

/**
 * Bank de poses curado pra mínima alucinação. Mãos visíveis ancoradas (no
 * quadril, no bolso) ou ocultas com clareza (atrás das costas) — bate de
 * frente com os modos de falha documentados em `gemini-vto-generator.ts`
 * (HANDS & FINGERS, IDENTITY DRIFT, full-body framing).
 *
 * REMOVIDO o tier médio anterior (perfil lateral, encostada na parede,
 * back-view, mão na lapela): cada uma batia num warning específico do VTO
 * (face em perfil = identity drift, prop não-controlado, dedos no tecido).
 */
export const POSE_BANK: ReadonlyArray<string> = [
  "standing with a relaxed three-quarter turn (facing right), one hand resting on her hip, chin slightly tilted up",
  "hands in pockets, weight shifted to one leg, relaxed street-style stance, front-facing",
  "arms behind back with clasped hands, chest open, elegant confident posture, front-facing",
  "standing straight front-facing, arms relaxed at sides, calm neutral editorial expression",
  "both hands resting at hips (akimbo), weight on one leg, classic fashion 'attitude' stance, front-facing",
  "three-quarter turn facing left, both arms relaxed at sides, looking forward",
  "three-quarter turn facing right, both arms relaxed at sides, looking forward",
  "front-facing with subtle S-curve (one hip slightly out), hands relaxed at sides, magazine cover stance",
] as const;

export const POSE_BANK_TOTAL = POSE_BANK.length; // 8

/**
 * Cap do histórico de poses por loja. 3 = janela pra detectar streak de
 * 3 usos consecutivos da mesma pose. Não é mais "últimas N bloqueadas":
 * agora o histórico só serve pra `getStreakBlockedPose()` decidir quando
 * forçar mudança.
 */
export const POSE_HISTORY_CAP = 3;

// ═══════════════════════════════════════
// Pose Index helpers
// ═══════════════════════════════════════

/** Resolve um índice em prose. Lança se índice inválido. */
export function resolvePoseIndex(index: number): string {
  const pose = POSE_BANK[index];
  if (!pose) {
    throw new Error(
      `Pose index inválido: ${index} (válidos: 0-${POSE_BANK_TOTAL - 1})`,
    );
  }
  return pose;
}

/** Valida um único índice contra o range do bank. Retorna [] se OK. */
export function validatePoseIndex(
  index: unknown,
  blocked: number | null = null,
): string[] {
  const errors: string[] = [];
  if (typeof index !== "number" || !Number.isInteger(index)) {
    errors.push(`pose_index precisa ser inteiro, veio ${typeof index}`);
    return errors;
  }
  if (index < 0 || index >= POSE_BANK_TOTAL) {
    errors.push(`pose_index fora do range: ${index} (válido 0-${POSE_BANK_TOTAL - 1})`);
  }
  if (blocked !== null && index === blocked) {
    errors.push(`pose_index ${index} está bloqueado por streak de 3 usos consecutivos`);
  }
  return errors;
}

/**
 * Detecta a pose bloqueada por regra de "no máximo 3 usos seguidos".
 * Recebe o histórico (mais recente no slot 0). Se TODOS os slots forem
 * iguais e o histórico tiver atingido o cap, devolve esse índice — o
 * Analyzer NÃO pode escolhê-lo na próxima campanha. Caso contrário, `null`.
 *
 * Exemplos com cap=3:
 *  []           → null (livre)
 *  [4]          → null
 *  [4, 4]       → null (ainda permitido subir pra 3)
 *  [4, 4, 4]    → 4   (streak completo, força mudar)
 *  [4, 4, 1]    → null
 */
export function getStreakBlockedPose(history: number[]): number | null {
  if (history.length < POSE_HISTORY_CAP) return null;
  const candidate = history[0];
  for (let i = 1; i < POSE_HISTORY_CAP; i++) {
    if (history[i] !== candidate) return null;
  }
  return candidate;
}

/**
 * Atualiza histórico prependendo a pose nova e cortando no cap.
 * Mais nova no slot 0, mais velhas caem fora quando estouram o cap.
 */
export function updatePoseHistory(
  current: number[],
  newIndex: number,
): number[] {
  return [newIndex, ...current].slice(0, POSE_HISTORY_CAP);
}
