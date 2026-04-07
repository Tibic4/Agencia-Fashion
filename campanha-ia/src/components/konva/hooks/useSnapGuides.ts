"use client";

import { useState, useCallback, useRef } from "react";
import { CANVAS_W } from "../constants";

const SNAP_THRESHOLD = 8; // px tolerance for snapping
const GUIDE_FADE_TIME = 700; // ms to hide guide after snapping

export interface SnapGuide {
  orientation: "vertical" | "horizontal";
  position: number; // x for vertical, y for horizontal
}

interface UseSnapGuidesResult {
  guides: SnapGuide[];
  handleSnapCheck: (x: number, y: number, canvasH: number) => { x: number; y: number };
  clearGuides: () => void;
}

/**
 * P2-9: Snap magnético — generates alignment guides when elements approach
 * the canvas center (horizontal/vertical) or edges.
 * Returns snapped coordinates and visual guides to render.
 */
export function useSnapGuides(): UseSnapGuidesResult {
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGuides = useCallback(() => {
    setGuides([]);
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const handleSnapCheck = useCallback(
    (x: number, y: number, canvasH: number): { x: number; y: number } => {
      const newGuides: SnapGuide[] = [];
      let snappedX = x;
      let snappedY = y;

      const centerX = CANVAS_W / 2;
      const centerY = canvasH / 2;

      // Snap points: center, left edge, right edge, top edge, bottom edge
      const verticalSnaps = [centerX, 60, CANVAS_W - 60];
      const horizontalSnaps = [centerY, 60, canvasH - 60];

      for (const vSnap of verticalSnaps) {
        if (Math.abs(x - vSnap) < SNAP_THRESHOLD) {
          snappedX = vSnap;
          newGuides.push({ orientation: "vertical", position: vSnap });
          break;
        }
      }

      for (const hSnap of horizontalSnaps) {
        if (Math.abs(y - hSnap) < SNAP_THRESHOLD) {
          snappedY = hSnap;
          newGuides.push({ orientation: "horizontal", position: hSnap });
          break;
        }
      }

      setGuides(newGuides);

      // Auto-fade guides
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (newGuides.length > 0) {
        fadeTimerRef.current = setTimeout(() => {
          setGuides([]);
        }, GUIDE_FADE_TIME);
      }

      return { x: snappedX, y: snappedY };
    },
    []
  );

  return { guides, handleSnapCheck, clearGuides };
}
