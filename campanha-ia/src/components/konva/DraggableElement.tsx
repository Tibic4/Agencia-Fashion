"use client";

import { forwardRef } from "react";
import { Group } from "react-konva";
import type { ReactNode } from "react";
import type Konva from "konva";
import type { ElementKey, ElementPositions, KonvaDragEvent } from "./types";
import { CANVAS_W } from "./constants";

interface DraggableElementProps {
  elementKey: ElementKey;
  positions: ElementPositions;
  onDragEnd: (key: ElementKey, e: KonvaDragEvent) => void;
  onSelect: (key: ElementKey) => void;
  selectedId: string | null;
  canvasH: number;
  onTransformEnd?: (key: ElementKey, e: Konva.KonvaEventObject<Event>) => void;
  children: ReactNode;
}

/**
 * Reusable wrapper that adds drag + select + transform behavior to any canvas element.
 * Forwards ref to the outer Group so Transformer can attach to it.
 */
const DraggableElement = forwardRef<Konva.Group, DraggableElementProps>(function DraggableElement(
  {
    elementKey,
    positions,
    onDragEnd,
    onSelect,
    selectedId,
    canvasH,
    onTransformEnd,
    children,
  },
  ref
) {
  const isSelected = selectedId === elementKey;
  const MARGIN = 40;

  return (
    <Group
      ref={ref}
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
      onTransformEnd={onTransformEnd ? (e) => onTransformEnd(elementKey, e) : undefined}
    >
      {children}
    </Group>
  );
});

export default DraggableElement;
