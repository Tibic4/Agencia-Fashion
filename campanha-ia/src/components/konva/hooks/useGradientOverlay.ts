"use client";

import { useState, useEffect, useRef } from "react";
import type { TemplateStyle } from "../types";
import { CANVAS_W } from "../constants";

/**
 * Generates gradient overlay images for templates with caching.
 * Instead of recreating the offscreen canvas + base64 roundtrip on every
 * template switch, it caches each generated gradient by key.
 */
export function useGradientOverlay(
  template: TemplateStyle,
  canvasH: number
): HTMLImageElement | null {
  const [gradientImg, setGradientImg] = useState<HTMLImageElement | null>(null);
  const cache = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const key = `${template.id}-${canvasH}`;

    // Return from cache if available
    if (cache.current.has(key)) {
      setGradientImg(cache.current.get(key)!);
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

    const img = new window.Image();
    img.src = canvas.toDataURL();
    img.onload = () => {
      cache.current.set(key, img);
      setGradientImg(img);
    };
  }, [template, canvasH]);

  return gradientImg;
}
