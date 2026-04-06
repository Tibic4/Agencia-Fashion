"use client";

import type { TemplateStyle } from "./types";
import { MIN_PREVIEW_SCALE, MAX_PREVIEW_SCALE } from "./constants";

interface KonvaToolbarProps {
  format: "feed" | "story";
  template: TemplateStyle;
  hasModelImage: boolean;
  previewScale: number;
  zoomPercent: number;
  downloading: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onReset: () => void;
  onDownload: () => void;
}

/**
 * Toolbar with format info, zoom controls, reset, and download button.
 */
export default function KonvaToolbar({
  format,
  template,
  hasModelImage,
  previewScale,
  zoomPercent,
  downloading,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onReset,
  onDownload,
}: KonvaToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
    >
      {/* Left: info badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          {format === "story" ? "Story 1080×1920" : "Feed 1080×1350"}
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
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
  );
}
