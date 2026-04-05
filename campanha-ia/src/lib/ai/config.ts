/**
 * Configuração centralizada de modelos de IA
 * 
 * Para trocar um modelo, basta alterar a variável no .env.local
 * Exemplo: AI_MODEL_SCORER=claude-3-5-haiku-20241022
 */

export const AI_MODELS = {
  /** Modelo para análise visual do produto */
  VISION:     process.env.AI_MODEL_VISION     || "claude-sonnet-4-20250514",
  /** Modelo para estratégia de campanha */
  STRATEGY:   process.env.AI_MODEL_STRATEGY   || "claude-sonnet-4-20250514",
  /** Modelo para geração de copy */
  COPYWRITER: process.env.AI_MODEL_COPYWRITER || "claude-sonnet-4-20250514",
  /** Modelo para refinamento de textos */
  REFINER:    process.env.AI_MODEL_REFINER    || "claude-sonnet-4-20250514",
  /** Modelo para scoring da campanha */
  SCORER:     process.env.AI_MODEL_SCORER     || "claude-sonnet-4-20250514",
} as const;

/** Tipos de produto disponíveis com categoria Fashn correspondente */
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
export type FashnCategory = "tops" | "bottoms" | "one-pieces" | "auto";

/** Mapear tipo de produto para categoria Fashn */
export function getCategory(productType: string): FashnCategory {
  const found = PRODUCT_TYPES.find(p => p.value === productType);
  return found?.category || "auto";
}
