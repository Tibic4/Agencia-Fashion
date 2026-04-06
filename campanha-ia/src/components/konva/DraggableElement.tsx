"use client";

import { Group } from "react-konva";
import type { ReactNode } from "react";
import type { ElementKey, ElementPositions, KonvaDragEvent } from "./types";

interface DraggableElementProps {
  elementKey: ElementKey;
  positions: ElementPositions;
  onDragEnd: (key: ElementKey, e: KonvaDragEvent) => void;
  onSelect: (key: ElementKey) => void;
  selectedId: string | null;
  children: ReactNode;
}

/**
 * Reusable wrapper that adds drag + select behavior to any canvas element.
 * Eliminates the repeated draggable/onClick/onTap/getDragStyle pattern.
 */
export default function DraggableElement({
  elementKey,
  positions,
  onDragEnd,
  onSelect,
  selectedId,
  children,
}: DraggableElementProps) {
  const isSelected = selectedId === elementKey;

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
    >
      {children}
    </Group>
  );
}
