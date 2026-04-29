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
// Pose Bank — 12 poses (8 estáveis + 4 médias)
// ═══════════════════════════════════════

/**
 * Bank de poses curado por risco de alucinação.
 *
 * Tier ESTÁVEL (índices 0-7): mãos visíveis ancoradas (no quadril, no bolso)
 * ou ocultas com clareza (atrás das costas) — alucinam quase nunca.
 *
 * Tier MÉDIO (índices 8-11): introduzem complexidade (face em profile,
 * mão no peito, parede como prop) — usar com moderação.
 *
 * REMOVIDAS as 5 poses originalmente arriscadas: walking mid-stride
 * (motion blur), sitting on stool (oclusão de pernas), crouching (joelho +
 * equilíbrio), seated on ground (oclusão massiva), stepping off curb
 * (motion + cenário). Removida também "hands clasped at front" (clássica
 * AI-hands-fail por dedos entrelaçados).
 */
export const POSE_BANK: ReadonlyArray<string> = [
  // ════ TIER ESTÁVEL (0-7) ═══════════════════════════════
  "standing with a relaxed three-quarter turn (facing right), one hand resting on her hip, chin slightly tilted up",
  "hands in pockets, weight shifted to one leg, relaxed street-style stance, front-facing",
  "arms behind back with clasped hands, chest open, elegant confident posture, front-facing",
  "standing straight front-facing, arms relaxed at sides, calm neutral editorial expression",
  "both hands resting at hips (akimbo), weight on one leg, classic fashion 'attitude' stance, front-facing",
  "three-quarter turn facing left, both arms relaxed at sides, looking forward",
  "three-quarter turn facing right, both arms relaxed at sides, looking forward",
  "front-facing with subtle S-curve (one hip slightly out), hands relaxed at sides, magazine cover stance",

  // ════ TIER MÉDIO (8-11) ═════════════════════════════════
  "full side profile, body in side view, arms at sides, head turned slightly toward camera so face is partially visible",
  "leaning against a wall with one shoulder, weight on the back leg, one arm relaxed at side",
  "turning to look over her shoulder, three-quarter back view showing garment construction, face in soft profile",
  "one hand gently touching collar or lapel, the other relaxed at side, front-facing",
] as const;

export const POSE_BANK_STABLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const POSE_BANK_TOTAL = POSE_BANK.length; // 12

/** Cap do histórico de poses por loja. 6 = últimas 2 campanhas. */
export const POSE_HISTORY_CAP = 6;

// ═══════════════════════════════════════
// Pose Index helpers
// ═══════════════════════════════════════

/** Resolve indices em prose. Lança se índice inválido. */
export function resolvePoseIndices(indices: number[]): string[] {
  return indices.map((i) => {
    const pose = POSE_BANK[i];
    if (!pose) {
      throw new Error(
        `Pose index inválido: ${i} (válidos: 0-${POSE_BANK_TOTAL - 1})`,
      );
    }
    return pose;
  });
}

/**
 * Valida que os 3 indices: distintos + range correto + ≥2 do tier estável
 * + nenhum violando exclusão. Retorna [] se OK, ou erros pra logar/avisar.
 */
export function validatePoseIndices(
  indices: unknown,
  excluded: number[] = [],
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(indices)) return ["pose_indices não é array"];
  if (indices.length !== 3) {
    errors.push(`pose_indices precisa ter 3 itens, veio ${indices.length}`);
  }

  const set = new Set(indices);
  if (set.size !== indices.length) errors.push("pose_indices tem duplicado");

  for (const i of indices) {
    if (typeof i !== "number" || i < 0 || i >= POSE_BANK_TOTAL) {
      errors.push(`índice fora do range: ${i}`);
    }
  }

  const stableCount = indices.filter((i) =>
    (POSE_BANK_STABLE_INDICES as readonly number[]).includes(i as number),
  ).length;
  if (stableCount < 2) {
    errors.push(`apenas ${stableCount} pose(s) do tier estável — exigido ≥2`);
  }

  const violatesExclusion = indices.filter((i) =>
    excluded.includes(i as number),
  );
  if (violatesExclusion.length > 0) {
    errors.push(
      `indices proibidos selecionados: [${violatesExclusion.join(", ")}]`,
    );
  }

  return errors;
}

/**
 * Atualiza histórico de poses prependendo as novas e cortando no cap.
 * Mais novas no início (slot 0), oldest caem fora.
 */
export function updatePoseHistory(
  current: number[],
  newIndices: number[],
): number[] {
  return [...newIndices, ...current].slice(0, POSE_HISTORY_CAP);
}
