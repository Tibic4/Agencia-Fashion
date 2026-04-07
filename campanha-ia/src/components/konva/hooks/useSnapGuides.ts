"use client";

import { useCallback, useRef } from "react";
import { CANVAS_W } from "../constants";
import Konva from "konva";

const SNAP_THRESHOLD = 8; // px tolerance for snapping
const GUIDE_FADE_TIME = 700; // ms to hide guide after snapping

export interface SnapGuide {
  orientation: "vertical" | "horizontal";
  position: number; // x for vertical, y for horizontal
}

interface UseSnapGuidesResult {
  /**
   * P0-2: Checks snap alignment and returns corrected coords.
   * Also draws/hides guide lines directly on the given layer (bypassing React state).
   */
  handleSnapCheck: (x: number, y: number, canvasH: number, layer?: Konva.Layer | null) => { x: number; y: number };
  clearGuides: (layer?: Konva.Layer | null) => void;
}

const GUIDE_NAME = "__snap_guide__";

/**
 * P0-2: Rewritten to draw snap lines directly on Konva Layer via imperative API.
 * This avoids React re-renders on every dragmove frame.
 * Guide lines are Konva.Line nodes managed via refs, not React state.
 */
export function useSnapGuides(): UseSnapGuidesResult {
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGuides = useCallback((layer?: Konva.Layer | null) => {
    if (!layer) return;
    // Remove all guide lines from the layer
    const guides = layer.find(`.${GUIDE_NAME}`);
    guides.forEach((g) => g.destroy());
    layer.batchDraw();
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const handleSnapCheck = useCallback(
    (x: number, y: number, canvasH: number, layer?: Konva.Layer | null): { x: number; y: number } => {
      let snappedX = x;
      let snappedY = y;

      const centerX = CANVAS_W / 2;
      const centerY = canvasH / 2;

      // Snap points: center, left edge, right edge, top edge, bottom edge
      const verticalSnaps = [centerX, 60, CANVAS_W - 60];
      const horizontalSnaps = [centerY, 60, canvasH - 60];

      let vSnapped: number | null = null;
      let hSnapped: number | null = null;

      for (const vSnap of verticalSnaps) {
        if (Math.abs(x - vSnap) < SNAP_THRESHOLD) {
          snappedX = vSnap;
          vSnapped = vSnap;
          break;
        }
      }

      for (const hSnap of horizontalSnaps) {
        if (Math.abs(y - hSnap) < SNAP_THRESHOLD) {
          snappedY = hSnap;
          hSnapped = hSnap;
          break;
        }
      }

      // Draw guides directly on layer (no React state)
      if (layer) {
        // Clear previous guides
        layer.find(`.${GUIDE_NAME}`).forEach((g) => g.destroy());

        if (vSnapped !== null) {
          const line = new Konva.Line({
            name: GUIDE_NAME,
            points: [vSnapped, 0, vSnapped, canvasH],
            stroke: "#06b6d4",
            strokeWidth: 1,
            dash: [8, 4],
            opacity: 0.6,
            listening: false,
          });
          layer.add(line);
        }

        if (hSnapped !== null) {
          const line = new Konva.Line({
            name: GUIDE_NAME,
            points: [0, hSnapped, CANVAS_W, hSnapped],
            stroke: "#06b6d4",
            strokeWidth: 1,
            dash: [8, 4],
            opacity: 0.6,
            listening: false,
          });
          layer.add(line);
        }

        layer.batchDraw();

        // Auto-fade guides
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        if (vSnapped !== null || hSnapped !== null) {
          fadeTimerRef.current = setTimeout(() => {
            layer.find(`.${GUIDE_NAME}`).forEach((g) => g.destroy());
            layer.batchDraw();
          }, GUIDE_FADE_TIME);
        }
      }

      return { x: snappedX, y: snappedY };
    },
    []
  );

  return { handleSnapCheck, clearGuides };
}
