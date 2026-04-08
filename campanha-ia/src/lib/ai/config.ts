/**
 * Configuração centralizada de modelos de IA
 *
 * v3.0 — Pipeline otimizado (4 steps, sem Refiner)
 *
 * Modelo por step (defaults no código, override via .env.local):
 *   AI_MODEL_VISION=gemini-3-flash-preview
 *   AI_MODEL_STRATEGY=gemini-3-flash-preview
 *   AI_MODEL_COPYWRITER=claude-sonnet-4-6
 *   AI_MODEL_SCORER=gemini-3.1-flash-lite-preview
 *   Imagem: gemini-3-pro-image-preview (Nano Banana Pro)
 *
 * Para forçar tudo Claude: não setar GOOGLE_AI_API_KEY
 * Para forçar tudo Gemini: não setar ANTHROPIC_API_KEY
 */

/** Tipos de produto disponíveis com categoria de peça correspondente */
export const PRODUCT_TYPES = [
  { value: "blusa",     label: "👚 Blusa / Regata / Top",     category: "tops" as const },
  { value: "saia",      label: "👗 Saia",                     category: "bottoms" as const },
  { value: "calca",     label: "👖 Calça / Shorts",           category: "bottoms" as const },
  { value: "vestido",   label: "👗 Vestido",                  category: "one-pieces" as const },
  { value: "macacao",   label: "🩱 Macacão / Culotte",        category: "one-pieces" as const },
  { value: "conjunto",  label: "🎀 Conjunto (vendido junto)",  category: "one-pieces" as const },
  { value: "jaqueta",   label: "🧥 Jaqueta / Casaco",         category: "tops" as const },
  { value: "acessorio", label: "💎 Acessório",                category: "auto" as const },
] as const;

/** Materiais/tecidos disponíveis (opcional no formulário) */
export const MATERIALS = [
  { value: "viscose",   label: "Viscose" },
  { value: "algodao",   label: "Algodão" },
  { value: "linho",     label: "Linho" },
  { value: "crepe",     label: "Crepe" },
  { value: "malha",     label: "Malha" },
  { value: "jeans",     label: "Jeans / Denim" },
  { value: "trico",     label: "Tricô" },
  { value: "seda",      label: "Seda / Cetim" },
  { value: "couro",     label: "Couro / Couro Sintético" },
  { value: "moletom",   label: "Moletom" },
  { value: "chiffon",   label: "Chiffon / Musseline" },
  { value: "outro",     label: "Outro" },
] as const;

export type ProductType = typeof PRODUCT_TYPES[number]["value"];
export type GarmentCategory = "tops" | "bottoms" | "one-pieces" | "auto";

/** Mapear tipo de produto para categoria de peça */
export function getCategory(productType: string): GarmentCategory {
  const found = PRODUCT_TYPES.find(p => p.value === productType);
  return found?.category || "auto";
}
