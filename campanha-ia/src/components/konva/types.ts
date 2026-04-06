import Konva from "konva";

/* ═══════════════════════════════════════
   Component Props
   ═══════════════════════════════════════ */
export interface KonvaCompositorProps {
  modelImageUrl: string | null;
  productImageUrl?: string | null;
  productName: string;
  price: string;
  headline?: string;
  cta?: string;
  storeName?: string;
  score?: number;
  format?: "feed" | "story";
  /** Allow importing custom images (logos, stickers, badges) */
  enableCustomElements?: boolean;
}

/* ═══════════════════════════════════════
   Custom Imported Elements
   ═══════════════════════════════════════ */
export interface CustomElement {
  id: string;
  name: string;
  imageUrl: string;
  loadedImg: HTMLImageElement | null;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  rotation: number;
  opacity: number;
  /** Whether this element is circular (e.g. logo) */
  circular: boolean;
}

export const MIN_IMPORT_SIZE = 128;  // Minimum 128×128px for quality
export const MAX_IMPORT_SIZE = 4096; // Maximum dimension
export const DEFAULT_ELEMENT_SIZE = 200; // Default display size on canvas

export interface ImportValidation {
  valid: boolean;
  error?: string;
  width: number;
  height: number;
}

/* ═══════════════════════════════════════
   Template Style
   ═══════════════════════════════════════ */
export interface TemplateStyle {
  id: string;
  label: string;
  icon: string;
  hasGradient: boolean;
  gradientColors: [string, string, string, string];
  textColor: string;
  priceColor: string;
  ctaBg: string;
  ctaText: string;
  badgeBg: string;
  badgeText: string;
  headlineColor: string;
}

/* ═══════════════════════════════════════
   Element Positions
   ═══════════════════════════════════════ */
export interface ElementPos {
  x: number;
  y: number;
}

export interface ElementPositions {
  badge: ElementPos;
  productName: ElementPos;
  headline: ElementPos;
  price: ElementPos;
  cta: ElementPos;
  score: ElementPos;
  watermark: ElementPos;
}

export type ElementKey = keyof ElementPositions;

/* ═══════════════════════════════════════
   Image Crop Config
   ═══════════════════════════════════════ */
export interface CropConfig {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

/* ═══════════════════════════════════════
   Konva Event Types (eliminates `any`)
   ═══════════════════════════════════════ */
export type KonvaDragEvent = Konva.KonvaEventObject<DragEvent>;
export type KonvaMouseEvent = Konva.KonvaEventObject<MouseEvent>;
