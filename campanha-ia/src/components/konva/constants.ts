import type { ElementPositions } from "./types";

/* ═══════════════════════════════════════
   Canvas dimensions
   ═══════════════════════════════════════ */
export const CANVAS_W = 1080;
export const FEED_H = 1350;
export const STORY_H = 1920;

/* ═══════════════════════════════════════
   Zoom
   ═══════════════════════════════════════ */
export const DEFAULT_PREVIEW_SCALE = 0.42;
export const MIN_PREVIEW_SCALE = 0.22;
export const MAX_PREVIEW_SCALE = 0.65;
export const ZOOM_STEP = 0.04;

/* ═══════════════════════════════════════
   Layout offsets (replaces magic numbers)
   ═══════════════════════════════════════ */
export const LAYOUT = {
  BADGE_TOP: 52,
  BADGE_WIDTH: 160,
  BADGE_HEIGHT: 32,
  BADGE_RADIUS: 16,

  PRODUCT_NAME_BOTTOM_OFFSET: 310,
  HEADLINE_BOTTOM_OFFSET: 245,
  PRICE_BOTTOM_OFFSET: 170,
  CTA_BOTTOM_OFFSET: 85,

  CTA_WIDTH: 280,
  CTA_HEIGHT: 54,
  CTA_RADIUS: 27,

  SCORE_RIGHT_OFFSET: 70,
  SCORE_BOTTOM_OFFSET: 35,
  SCORE_WIDTH: 96,
  SCORE_HEIGHT: 26,

  WATERMARK_BOTTOM_OFFSET: 18,
  WATERMARK_WIDTH: 200,

  TEXT_PADDING: 100,
  HEADLINE_PADDING: 120,
} as const;

/* ═══════════════════════════════════════
   Default positions calculator
   ═══════════════════════════════════════ */
export function getDefaultPositions(h: number): ElementPositions {
  return {
    badge: { x: CANVAS_W / 2, y: LAYOUT.BADGE_TOP },
    productName: { x: CANVAS_W / 2, y: h - LAYOUT.PRODUCT_NAME_BOTTOM_OFFSET },
    headline: { x: CANVAS_W / 2, y: h - LAYOUT.HEADLINE_BOTTOM_OFFSET },
    price: { x: CANVAS_W / 2, y: h - LAYOUT.PRICE_BOTTOM_OFFSET },
    cta: { x: CANVAS_W / 2, y: h - LAYOUT.CTA_BOTTOM_OFFSET },
    score: { x: CANVAS_W - LAYOUT.SCORE_RIGHT_OFFSET, y: h - LAYOUT.SCORE_BOTTOM_OFFSET },
    watermark: { x: CANVAS_W / 2, y: h - LAYOUT.WATERMARK_BOTTOM_OFFSET },
  };
}

/* ═══════════════════════════════════════
   Utility: format price
   ═══════════════════════════════════════ */
export function formatPrice(price: string): string {
  return price.includes("R$") ? price : `R$ ${price}`;
}

/* ═══════════════════════════════════════
   Utility: truncate text
   ═══════════════════════════════════════ */
export function truncateText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/* ═══════════════════════════════════════
   Utility: extract price from text (regex)
   ═══════════════════════════════════════ */
export function extractPrice(text?: string): string {
  return text?.match(/R\$\s*[\d.,]+/)?.[0] ?? "";
}
