"use client";

import type { TemplateStyle, ElementKey } from "./types";
import { MIN_PREVIEW_SCALE, MAX_PREVIEW_SCALE } from "./constants";

const TOGGLEABLE_ELEMENTS: { key: ElementKey; label: string; icon: string }[] = [
  { key: "badge", label: "Loja", icon: "🏷️" },
  { key: "productName", label: "Nome", icon: "📝" },
  { key: "headline", label: "Headline", icon: "💬" },
  { key: "price", label: "Preço", icon: "💰" },
  { key: "cta", label: "CTA", icon: "🔘" },
  { key: "score", label: "Score", icon: "⭐" },
  { key: "watermark", label: "Marca", icon: "©️" },
];

interface KonvaToolbarProps {
  format: "feed" | "story";
  template: TemplateStyle;
  hasModelImage: boolean;
  previewScale: number;
  zoomPercent: number;
  downloading: boolean;
  hiddenElements: Set<ElementKey>;
  onToggleVisibility: (key: ElementKey) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onReset: () => void;
  onDownload: () => void;
  onFormatToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Toolbar with format toggle, zoom, undo/redo, element visibility toggles, reset, and download.
 */
export default function KonvaToolbar({
  format,
  template,
  hasModelImage,
  previewScale,
  zoomPercent,
  downloading,
  hiddenElements,
  onToggleVisibility,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onReset,
  onDownload,
  onFormatToggle,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: KonvaToolbarProps) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
      {/* Main toolbar row */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
        {/* Left: info badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Format toggle */}
          <button
            onClick={onFormatToggle}
            className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--brand-100)", color: "var(--brand-600)", border: "1px solid var(--brand-200, var(--border))" }}
            title={format === "feed" ? "Mudar para Story 1080×1920" : "Mudar para Feed 1080×1350"}
          >
            {format === "story" ? "📱 Story" : "📐 Feed"}
          </button>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}
          >
            {template.label}
          </span>
          {hasModelImage && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#dcfce7", color: "#166534" }}
            >
              📸 Modelo IA
            </span>
          )}
        </div>

        {/* Right: zoom + actions */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div
            className="flex items-center gap-0.5 rounded-lg overflow-hidden"
            role="group"
            aria-label="Controles de zoom"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <button
              onClick={onZoomOut}
              disabled={previewScale <= MIN_PREVIEW_SCALE}
              className="px-2 py-1.5 text-xs font-bold hover:opacity-70 transition-opacity disabled:opacity-30"
              style={{ color: "var(--foreground)" }}
              title="Diminuir zoom"
              aria-label="Diminuir zoom"
            >
              −
            </button>
            <button
              onClick={onZoomReset}
              className="px-2 py-1.5 text-[10px] font-semibold hover:opacity-70"
              style={{
                color: "var(--muted)",
                borderLeft: "1px solid var(--border)",
                borderRight: "1px solid var(--border)",
              }}
              title="Resetar zoom"
              aria-label={`Zoom atual: ${zoomPercent}%. Clique para resetar.`}
            >
              {zoomPercent}%
            </button>
            <button
              onClick={onZoomIn}
              disabled={previewScale >= MAX_PREVIEW_SCALE}
              className="px-2 py-1.5 text-xs font-bold hover:opacity-70 transition-opacity disabled:opacity-30"
              style={{ color: "var(--foreground)" }}
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
            >
              +
            </button>
          </div>

          {/* Undo/Redo */}
          <div
            className="flex items-center gap-0.5 rounded-lg overflow-hidden"
            role="group"
            aria-label="Desfazer e refazer"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="px-2 py-1.5 text-xs hover:opacity-70 transition-opacity disabled:opacity-30"
              style={{ color: "var(--foreground)" }}
              title="Desfazer (Ctrl+Z)"
              aria-label="Desfazer"
            >
              ↶
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="px-2 py-1.5 text-xs hover:opacity-70 transition-opacity disabled:opacity-30"
              style={{ color: "var(--foreground)", borderLeft: "1px solid var(--border)" }}
              title="Refazer (Ctrl+Y)"
              aria-label="Refazer"
            >
              ↷
            </button>
          </div>

          {/* Reset */}
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}
            aria-label="Resetar posições dos elementos"
          >
            ↩ Resetar
          </button>

          {/* Download */}
          <button
            onClick={onDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
            style={{
              background: "var(--gradient-brand)",
              color: "white",
              opacity: downloading ? 0.6 : 1,
            }}
            aria-label={downloading ? "Gerando imagem HD..." : "Baixar imagem em PNG HD"}
          >
            {downloading ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                Gerando HD...
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar PNG HD
              </>
            )}
          </button>
        </div>
      </div>

      {/* Element visibility toggles */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <span className="text-[10px] font-medium mr-1" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
          👁️ Elementos:
        </span>
        {TOGGLEABLE_ELEMENTS.map(({ key, label, icon }) => {
          const isHidden = hiddenElements.has(key);
          return (
            <button
              key={key}
              onClick={() => onToggleVisibility(key)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
              style={{
                background: isHidden ? "var(--border)" : "var(--background)",
                color: isHidden ? "var(--muted)" : "var(--foreground)",
                opacity: isHidden ? 0.5 : 1,
                border: "1px solid var(--border)",
                textDecoration: isHidden ? "line-through" : "none",
                whiteSpace: "nowrap",
              }}
              title={isHidden ? `Mostrar ${label}` : `Esconder ${label}`}
            >
              <span>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
