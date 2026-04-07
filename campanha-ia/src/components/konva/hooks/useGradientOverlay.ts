"use client";

import { useState, useEffect, useRef } from "react";
import type { TemplateStyle } from "../types";
import { CANVAS_W } from "../constants";

/**
 * P1-5: Generates gradient overlay canvases for templates with caching.
 * Uses HTMLCanvasElement directly as the image source instead of the
 * expensive toDataURL() → base64 → Image roundtrip.
 */
export function useGradientOverlay(
  template: TemplateStyle,
  canvasH: number
): HTMLCanvasElement | HTMLImageElement | null {
  const [gradientSrc, setGradientSrc] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const cache = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    const key = `${template.id}-${canvasH}`;

    // Return from cache if available
    if (cache.current.has(key)) {
      setGradientSrc(cache.current.get(key)!);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (template.hasGradient) {
      const overlayH = canvasH * 0.55;
      const grd = ctx.createLinearGradient(0, canvasH - overlayH, 0, canvasH);
      const colors = template.gradientColors;
      grd.addColorStop(0, colors[0]);
      grd.addColorStop(0.3, colors[1]);
      grd.addColorStop(0.6, colors[2]);
      grd.addColorStop(1, colors[3]);
      ctx.fillStyle = grd;
      ctx.fillRect(0, canvasH - overlayH, CANVAS_W, overlayH);
    }
    // else: transparent canvas = no gradient

    // P1-5: Use the canvas element directly — Konva accepts CanvasImageSource.
    // Avoids the CPU-blocking PNG encode → base64 → decode roundtrip (~5-15ms saved).
    cache.current.set(key, canvas);
    setGradientSrc(canvas);
  }, [template, canvasH]);

  return gradientSrc;
}
