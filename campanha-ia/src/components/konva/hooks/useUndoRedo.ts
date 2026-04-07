"use client";

import { useState, useCallback, useRef } from "react";
import type { ElementPositions } from "../types";

const MAX_HISTORY = 30;

interface UseUndoRedoResult {
  pushState: (state: ElementPositions) => void;
  undo: () => ElementPositions | null;
  redo: () => ElementPositions | null;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Generic undo/redo for element positions.
 * Stores a linear history stack with configurable max depth.
 */
export function useUndoRedo(initialState: ElementPositions): UseUndoRedoResult {
  const historyRef = useRef<ElementPositions[]>([initialState]);
  const indexRef = useRef(0);
  const [, forceRender] = useState(0);

  const pushState = useCallback((state: ElementPositions) => {
    // Truncate any "redo" entries ahead of current index
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(state);
    // Trim oldest if over limit
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      indexRef.current++;
    }
    forceRender((n) => n + 1);
  }, []);

  const undo = useCallback((): ElementPositions | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    forceRender((n) => n + 1);
    return historyRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): ElementPositions | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current++;
    forceRender((n) => n + 1);
    return historyRef.current[indexRef.current];
  }, []);

  return {
    pushState,
    undo,
    redo,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < historyRef.current.length - 1,
  };
}
