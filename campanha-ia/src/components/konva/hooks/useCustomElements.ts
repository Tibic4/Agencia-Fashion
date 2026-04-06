"use client";

import { useState, useCallback } from "react";
import type { CustomElement, ImportValidation } from "../types";
import { MIN_IMPORT_SIZE, MAX_IMPORT_SIZE, DEFAULT_ELEMENT_SIZE } from "../types";
import { CANVAS_W } from "../constants";

/**
 * Manages custom imported elements (logos, stickers, badges).
 * Handles validation, loading, positioning, and removal.
 */
export function useCustomElements(canvasH: number) {
  const [elements, setElements] = useState<CustomElement[]>([]);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);

  /**
   * Validates an image file before import.
   * Returns dimensions and whether it meets quality requirements.
   */
  const validateImage = useCallback(
    (file: File): Promise<ImportValidation> => {
      return new Promise((resolve) => {
        // Check file type
        if (!file.type.startsWith("image/")) {
          resolve({ valid: false, error: "Arquivo não é uma imagem", width: 0, height: 0 });
          return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          resolve({ valid: false, error: "Imagem muito grande (máx 10MB)", width: 0, height: 0 });
          return;
        }

        const img = new window.Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(url);
          const w = img.naturalWidth;
          const h = img.naturalHeight;

          if (w < MIN_IMPORT_SIZE || h < MIN_IMPORT_SIZE) {
            resolve({
              valid: false,
              error: `Resolução muito baixa (${w}×${h}). Mínimo: ${MIN_IMPORT_SIZE}×${MIN_IMPORT_SIZE}px`,
              width: w,
              height: h,
            });
            return;
          }

          if (w > MAX_IMPORT_SIZE || h > MAX_IMPORT_SIZE) {
            resolve({
              valid: false,
              error: `Imagem muito grande (${w}×${h}). Máximo: ${MAX_IMPORT_SIZE}×${MAX_IMPORT_SIZE}px`,
              width: w,
              height: h,
            });
            return;
          }

          resolve({ valid: true, width: w, height: h });
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({ valid: false, error: "Não foi possível ler a imagem", width: 0, height: 0 });
        };

        img.src = url;
      });
    },
    []
  );

  /**
   * Imports an image file as a custom element.
   * Validates, loads, and positions it at the center of the canvas.
   */
  const importElement = useCallback(
    async (file: File, options?: { circular?: boolean; name?: string }): Promise<string | null> => {
      const validation = await validateImage(file);
      if (!validation.valid) {
        alert(`⚠️ ${validation.error}`);
        return null;
      }

      return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        const url = URL.createObjectURL(file);

        img.onload = () => {
          // Calculate display size maintaining aspect ratio
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          let displayW = DEFAULT_ELEMENT_SIZE;
          let displayH = DEFAULT_ELEMENT_SIZE;

          if (aspectRatio > 1) {
            displayH = displayW / aspectRatio;
          } else {
            displayW = displayH * aspectRatio;
          }

          const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const name = options?.name || file.name.replace(/\.[^.]+$/, "");

          const newElement: CustomElement = {
            id,
            name,
            imageUrl: url,
            loadedImg: img,
            x: CANVAS_W / 2,
            y: canvasH / 2,
            width: displayW,
            height: displayH,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight,
            rotation: 0,
            opacity: 1,
            circular: options?.circular ?? false,
          };

          setElements((prev) => [...prev, newElement]);
          setSelectedCustomId(id);
          resolve(id);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          alert("⚠️ Erro ao carregar a imagem");
          resolve(null);
        };

        img.src = url;
      });
    },
    [validateImage, canvasH]
  );

  /**
   * Updates position of a custom element after drag.
   */
  const updatePosition = useCallback((id: string, x: number, y: number) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, x, y } : el))
    );
  }, []);

  /**
   * Updates size of a custom element.
   */
  const updateSize = useCallback((id: string, width: number, height: number) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, width, height } : el))
    );
  }, []);

  /**
   * Updates opacity of a custom element.
   */
  const updateOpacity = useCallback((id: string, opacity: number) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, opacity } : el))
    );
  }, []);

  /**
   * Removes a custom element and revokes its object URL.
   */
  const removeElement = useCallback((id: string) => {
    setElements((prev) => {
      const el = prev.find((e) => e.id === id);
      if (el) URL.revokeObjectURL(el.imageUrl);
      return prev.filter((e) => e.id !== id);
    });
    setSelectedCustomId((prev) => (prev === id ? null : prev));
  }, []);

  /**
   * Moves element up/down in the layer order.
   */
  const reorderElement = useCallback((id: string, direction: "up" | "down") => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const targetIdx = direction === "up" ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  }, []);

  return {
    elements,
    selectedCustomId,
    setSelectedCustomId,
    importElement,
    removeElement,
    updatePosition,
    updateSize,
    updateOpacity,
    reorderElement,
    validateImage,
  };
}
