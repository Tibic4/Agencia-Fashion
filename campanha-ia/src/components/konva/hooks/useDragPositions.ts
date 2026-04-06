"use client";

import { useState, useEffect, useCallback } from "react";
import type { ElementPositions, ElementKey, KonvaDragEvent } from "../types";
import { getDefaultPositions } from "../constants";

interface UseDragPositionsResult {
  positions: ElementPositions;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  handleDragEnd: (key: ElementKey, e: KonvaDragEvent) => void;
  handleSelect: (key: ElementKey) => void;
  handleDeselect: () => void;
  handleReset: () => void;
  getDragStyle: (key: string) => {
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
  };
}

/**
 * Manages positions of draggable canvas elements with selection state.
 */
export function useDragPositions(canvasH: number): UseDragPositionsResult {
  const [positions, setPositions] = useState<ElementPositions>(() => getDefaultPositions(canvasH));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset positions on format/canvas height change
  useEffect(() => {
    setPositions(getDefaultPositions(canvasH));
  }, [canvasH]);

  const handleDragEnd = useCallback((key: ElementKey, e: KonvaDragEvent) => {
    const node = e.target;
    setPositions((prev) => ({
      ...prev,
      [key]: { x: node.x(), y: node.y() },
    }));
  }, []);

  const handleSelect = useCallback((key: ElementKey) => {
    setSelectedId(key);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleReset = useCallback(() => {
    setPositions(getDefaultPositions(canvasH));
    setSelectedId(null);
  }, [canvasH]);

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
    handleDragEnd,
    handleSelect,
    handleDeselect,
    handleReset,
    getDragStyle,
  };
}
