"use client";

import { useState, useEffect, useCallback } from "react";
import type { ElementPositions, ElementKey, KonvaDragEvent } from "../types";
import { getDefaultPositions } from "../constants";
import { useUndoRedo } from "./useUndoRedo";

export type FontSizes = Partial<Record<ElementKey, number>>;
export type WidthOverrides = Partial<Record<ElementKey, number>>;

const DEFAULT_ORDER: ElementKey[] = [
  "badge", "productName", "headline", "price", "cta", "score", "watermark",
];

interface UseDragPositionsResult {
  positions: ElementPositions;
  fontSizes: FontSizes;
  widthOverrides: WidthOverrides;
  elementOrder: ElementKey[];
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
  updateFontSize: (key: ElementKey, size: number) => void;
  updateWidthOverride: (key: ElementKey, width: number) => void;
  moveElementUp: (key: ElementKey) => void;
  moveElementDown: (key: ElementKey) => void;
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
 * Manages positions, font sizes, selection, visibility, and undo/redo of draggable canvas elements.
 */
export function useDragPositions(canvasH: number): UseDragPositionsResult {
  const [positions, setPositions] = useState<ElementPositions>(() => getDefaultPositions(canvasH));
  const [fontSizes, setFontSizes] = useState<FontSizes>({});
  const [widthOverrides, setWidthOverrides] = useState<WidthOverrides>({});
  const [elementOrder, setElementOrder] = useState<ElementKey[]>([...DEFAULT_ORDER]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenElements, setHiddenElements] = useState<Set<ElementKey>>(new Set());
  const { pushState, undo, redo, canUndo, canRedo } = useUndoRedo(getDefaultPositions(canvasH));

  // Reset positions on format/canvas height change
  useEffect(() => {
    setPositions(getDefaultPositions(canvasH));
    setFontSizes({});
    setWidthOverrides({});
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
    setFontSizes({});
    setWidthOverrides({});
    setElementOrder([...DEFAULT_ORDER]);
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

  const updateFontSize = useCallback((key: ElementKey, size: number) => {
    setFontSizes((prev) => ({ ...prev, [key]: Math.round(Math.max(12, Math.min(200, size))) }));
  }, []);

  const updateWidthOverride = useCallback((key: ElementKey, width: number) => {
    setWidthOverrides((prev) => ({ ...prev, [key]: Math.round(Math.max(100, Math.min(1060, width))) }));
  }, []);

  const moveElementUp = useCallback((key: ElementKey) => {
    setElementOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const moveElementDown = useCallback((key: ElementKey) => {
    setElementOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
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
    fontSizes,
    widthOverrides,
    elementOrder,
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
    updateFontSize,
    updateWidthOverride,
    moveElementUp,
    moveElementDown,
    canUndo,
    canRedo,
    getDragStyle,
  };
}

