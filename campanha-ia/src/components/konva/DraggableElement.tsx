"use client";

import { Group } from "react-konva";
import type { ReactNode } from "react";
import type { ElementKey, ElementPositions, KonvaDragEvent } from "./types";
import { CANVAS_W } from "./constants";

interface DraggableElementProps {
  elementKey: ElementKey;
  positions: ElementPositions;
  onDragEnd: (key: ElementKey, e: KonvaDragEvent) => void;
  onSelect: (key: ElementKey) => void;
  selectedId: string | null;
  canvasH: number;
  children: ReactNode;
}

/**
 * Reusable wrapper that adds drag + select behavior to any canvas element.
 * dragBoundFunc prevents elements from being dragged outside the canvas.
 */
export default function DraggableElement({
  elementKey,
  positions,
  onDragEnd,
  onSelect,
  selectedId,
  canvasH,
  children,
}: DraggableElementProps) {
  const isSelected = selectedId === elementKey;
  const MARGIN = 40; // keep at least 40px visible inside canvas

  return (
    <Group
      x={positions[elementKey].x}
      y={positions[elementKey].y}
      draggable
      onDragEnd={(e) => onDragEnd(elementKey, e)}
      onClick={() => onSelect(elementKey)}
      onTap={() => onSelect(elementKey)}
      shadowColor={isSelected ? "#ec4899" : "transparent"}
      shadowBlur={isSelected ? 12 : 0}
      shadowOffsetX={0}
      shadowOffsetY={0}
      dragBoundFunc={(pos) => ({
        x: Math.max(MARGIN, Math.min(pos.x, CANVAS_W - MARGIN)),
        y: Math.max(MARGIN, Math.min(pos.y, canvasH - MARGIN)),
      })}
    >
      {children}
    </Group>
  );
}
