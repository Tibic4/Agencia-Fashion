/**
 * Phase 1 / C-1: canonical mapping from Play Store SKU IDs to internal
 * plans.name slugs. Used by /api/billing/rtdn and /api/billing/restore so
 * updateStorePlan(storeId, slug) gets a slug that exists in the plans table.
 *
 * Free plan slug is "gratis" (per baseline schema), NOT "free".
 *
 * The existing planFromSku() in google-play.ts already returns canonical DB
 * slugs ("essencial" | "pro" | "business"). This module wraps it so callers
 * can defensively coerce unknown/null SKUs to the free plan, and exports the
 * shared FREE_PLAN_SLUG constant so handlers don't hardcode the literal.
 */

import { planFromSku, isValidSku, type ValidSku } from "@/lib/payments/google-play";

export const FREE_PLAN_SLUG = "gratis";

/**
 * Resolve a Play Store SKU to the internal plans.name slug.
 *
 * - Returns the canonical plan slug for known SKUs (e.g. "pro_mensal" → "pro").
 * - Returns FREE_PLAN_SLUG for null/undefined/unknown SKUs — defensive default
 *   so RTDN handlers can pass whatever they got from Google without an
 *   explicit isValidSku check.
 */
export function skuToPlanSlug(sku: string | null | undefined): string {
  if (!sku) return FREE_PLAN_SLUG;
  if (!isValidSku(sku)) return FREE_PLAN_SLUG;
  return planFromSku(sku as ValidSku);
}
