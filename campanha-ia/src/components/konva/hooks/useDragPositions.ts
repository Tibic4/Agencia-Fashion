"use client";

import { useState, useEffect, useCallback } from "react";
import type { ElementPositions, ElementKey, KonvaDragEvent } from "../types";
import { getDefaultPositions } from "../constants";
import { useUndoRedo } from "./useUndoRedo";

interface UseDragPositionsResult {
  positions: ElementPositions;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  hiddenElements: Set<ElementKey>;
  toggleVisibility: (key: ElementKey) => void;
  handleDragEnd: (key: ElementKey, e: KonvaDragEvent) => void;
  handleSelect: (key: ElementKey) => void;
  handleDeselect: () => void;
  handleReset: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getDragStyle: (key: string) => {
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
  };
}

/**
 * Manages positions, selection, visibility, and undo/redo of draggable canvas elements.
 */
export function useDragPositions(canvasH: number): UseDragPositionsResult {
  const [positions, setPositions] = useState<ElementPositions>(() => getDefaultPositions(canvasH));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenElements, setHiddenElements] = useState<Set<ElementKey>>(new Set());
  const { pushState, undo, redo, canUndo, canRedo } = useUndoRedo(getDefaultPositions(canvasH));

  // Reset positions on format/canvas height change
  useEffect(() => {
    setPositions(getDefaultPositions(canvasH));
  }, [canvasH]);

  const handleDragEnd = useCallback((key: ElementKey, e: KonvaDragEvent) => {
    const node = e.target;
    setPositions((prev) => {
      const next = {
        ...prev,
        [key]: { x: node.x(), y: node.y() },
      };
      pushState(next);
      return next;
    });
  }, [pushState]);

  const handleSelect = useCallback((key: ElementKey) => {
    setSelectedId(key);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleReset = useCallback(() => {
    setPositions(getDefaultPositions(canvasH));
    setSelectedId(null);
    setHiddenElements(new Set());
  }, [canvasH]);

  const toggleVisibility = useCallback((key: ElementKey) => {
    setHiddenElements((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setSelectedId((sel) => (sel === key ? null : sel));
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) setPositions(prev);
  }, [undo]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) setPositions(next);
  }, [redo]);

  const getDragStyle = useCallback(
    (key: string) => ({
      shadowColor: selectedId === key ? "#ec4899" : "transparent",
      shadowBlur: selectedId === key ? 12 : 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    }),
    [selectedId]
  );

  return {
    positions,
    selectedId,
    setSelectedId,
    hiddenElements,
    toggleVisibility,
    handleDragEnd,
    handleSelect,
    handleDeselect,
    handleReset,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    getDragStyle,
  };
}

