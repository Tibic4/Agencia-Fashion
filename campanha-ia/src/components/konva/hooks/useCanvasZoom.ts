"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CANVAS_W,
  DEFAULT_PREVIEW_SCALE,
  MIN_PREVIEW_SCALE,
  MAX_PREVIEW_SCALE,
  ZOOM_STEP,
} from "../constants";

interface UseCanvasZoomResult {
  previewScale: number;
  zoomPercent: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
}

/**
 * Manages responsive zoom with ResizeObserver.
 * ResizeObserver only auto-fits on initial load; manual zoom is preserved.
 */
export function useCanvasZoom(): UseCanvasZoomResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(DEFAULT_PREVIEW_SCALE);
  const [maxAutoScale, setMaxAutoScale] = useState(DEFAULT_PREVIEW_SCALE);
  const userZoomedRef = useRef(false);

  // Auto-fit on mount and resize (only if user hasn't manually zoomed)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const containerW = entries[0].contentRect.width - 32;
      const idealScale = containerW / CANVAS_W;
      const clamped = Math.max(MIN_PREVIEW_SCALE, Math.min(DEFAULT_PREVIEW_SCALE, idealScale));
      setMaxAutoScale(clamped);
      // Only auto-set scale if the user hasn't manually zoomed
      if (!userZoomedRef.current) {
        setPreviewScale(clamped);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleZoomIn = useCallback(() => {
    userZoomedRef.current = true;
    setPreviewScale((s) => Math.min(MAX_PREVIEW_SCALE, +(s + ZOOM_STEP).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    userZoomedRef.current = true;
    setPreviewScale((s) => Math.max(MIN_PREVIEW_SCALE, +(s - ZOOM_STEP).toFixed(2)));
  }, []);

  const handleZoomReset = useCallback(() => {
    userZoomedRef.current = false;
    setPreviewScale(maxAutoScale);
  }, [maxAutoScale]);

  const zoomPercent = Math.round((previewScale / DEFAULT_PREVIEW_SCALE) * 100);

  return {
    previewScale,
    zoomPercent,
    containerRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  };
}
