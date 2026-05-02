"use client";

import { useRef } from "react";
import type { CustomElement } from "./types";

interface ImportPanelProps {
  elements: CustomElement[];
  selectedCustomId: string | null;
  onImport: (file: File, options?: { circular?: boolean; name?: string }) => Promise<string | null>;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
  onUpdateOpacity: (id: string, opacity: number) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
}

/**
 * UI panel for importing and managing custom elements (logos, stickers).
 * Renders below the template selector as a collapsible section.
 */
export default function ImportPanel({
  elements,
  selectedCustomId,
  onImport,
  onRemove,
  onSelect,
  onUpdateOpacity,
  onReorder,
}: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await onImport(files[i]);
    }

    // Reset input so same file can be imported again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectedElement = elements.find((el) => el.id === selectedCustomId);

  return (
    <div
      className="mb-4 rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--background)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: elements.length > 0 ? "1px solid var(--border)" : "none" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            📎 Elementos importados
          </span>
          {elements.length > 0 && (
            <span
              className="text-2xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
            >
              {elements.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Import button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: "var(--gradient-brand)",
              color: "white",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Logo / Sticker
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Importar logo ou sticker"
          />
        </div>
      </div>

      {/* Element list */}
      {elements.length > 0 && (
        <div className="px-3 py-2 space-y-1.5">
          {elements.map((el, idx) => {
            const isSelected = selectedCustomId === el.id;
            return (
              <div
                key={el.id}
                onClick={() => onSelect(isSelected ? null : el.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                style={{
                  background: isSelected ? "var(--brand-50)" : "var(--surface)",
                  border: isSelected ? "1px solid var(--brand-300)" : "1px solid transparent",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: el.circular ? "50%" : 4,
                    overflow: "hidden",
                    background: "#f0f0f0",
                    flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={el.imageUrl}
                    alt={el.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {el.name}
                  </p>
                  <p className="text-2xs" style={{ color: "var(--muted)" }}>
                    {el.originalWidth}×{el.originalHeight}px · {Math.round(el.opacity * 100)}%
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {/* Layer order */}
                  <button
                    onClick={() => onReorder(el.id, "up")}
                    disabled={idx === elements.length - 1}
                    className="p-1 rounded text-2xs hover:opacity-70 disabled:opacity-20"
                    title="Mover para frente"
                    aria-label="Mover para frente"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => onReorder(el.id, "down")}
                    disabled={idx === 0}
                    className="p-1 rounded text-2xs hover:opacity-70 disabled:opacity-20"
                    title="Mover para trás"
                    aria-label="Mover para trás"
                  >
                    ↓
                  </button>
                  {/* Remove */}
                  <button
                    onClick={() => onRemove(el.id)}
                    className="p-1 rounded text-2xs hover:opacity-70 transition-opacity"
                    style={{ color: "#ef4444" }}
                    title="Remover elemento"
                    aria-label={`Remover ${el.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}

          {/* Selected element controls */}
          {selectedElement && (
            <div
              className="mt-2 pt-2 flex items-center gap-3"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <label className="flex items-center gap-1.5 text-2xs" style={{ color: "var(--muted)" }}>
                Opacidade
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(selectedElement.opacity * 100)}
                  onChange={(e) => onUpdateOpacity(selectedElement.id, Number(e.target.value) / 100)}
                  className="w-20 h-1 accent-pink-500"
                  aria-label="Opacidade do elemento"
                />
                <span className="font-semibold w-7 text-right">{Math.round(selectedElement.opacity * 100)}%</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {elements.length === 0 && (
        <div className="px-3 py-3 text-center">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Importe logos, selos ou stickers para personalizar o criativo.
          </p>
          <p className="text-2xs mt-1" style={{ color: "var(--muted)", opacity: 0.6 }}>
            PNG/JPEG/WebP · Mín 128×128px · Máx 10MB
          </p>
        </div>
      )}
    </div>
  );
}
