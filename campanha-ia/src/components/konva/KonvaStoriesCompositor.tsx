"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import Konva from "konva";
import { templateStyles } from "./templates";
import { CANVAS_W, STORY_H } from "./constants";
import { exportStageAsDataURL } from "./utils/exportStage";
import TemplateSelector from "./TemplateSelector";
import KonvaStorySlide, { getStoryDefaults } from "./KonvaStorySlide";
import type { SlideType, StoryPositions } from "./KonvaStorySlide";
import type { FontSizes } from "./hooks/useDragPositions";

/* ═══════════════════════════════════════
   Props
   ═══════════════════════════════════════ */
interface KonvaStoriesCompositorProps {
  productName: string;
  price: string;
  slideGancho?: string;
  slideProduto?: string;
  slideCTA?: string;
  productImageUrl?: string | null;
  modelImageUrl?: string | null;   // VTO model image
  storeName?: string;
  templateId?: string;
  onTemplateChange?: (id: string) => void;
}

/* ═══════════════════════════════════════
   Slide configs
   ═══════════════════════════════════════ */
const SLIDES: { type: SlideType; label: string; icon: string }[] = [
  { type: "gancho", label: "Gancho", icon: "⚡" },
  { type: "produto", label: "Produto", icon: "👗" },
  { type: "cta", label: "CTA", icon: "🚀" },
];

/* ═══════════════════════════════════════
   Element labels per slide (for visibility toggles)
   ═══════════════════════════════════════ */
const SLIDE_ELEMENTS: Record<SlideType, { key: string; label: string; icon: string }[]> = {
  gancho: [
    { key: "storeBadge", label: "Loja", icon: "🏷️" },
    { key: "mainText", label: "Texto", icon: "📝" },
    { key: "swipeHint", label: "Arraste", icon: "👆" },
  ],
  produto: [
    { key: "storeBadge", label: "Loja", icon: "🏷️" },
    { key: "productImage", label: "Foto", icon: "📸" },
    { key: "productText", label: "Texto", icon: "📝" },
    { key: "priceBadge", label: "Preço", icon: "💰" },
  ],
  cta: [
    { key: "ctaText", label: "Texto", icon: "📝" },
    { key: "ctaButton", label: "Botão", icon: "🔘" },
    { key: "storeName", label: "Loja", icon: "🏷️" },
    { key: "watermark", label: "Marca", icon: "💎" },
  ],
};

/* ═══════════════════════════════════════
   P1-6: Responsive preview scale using ResizeObserver
   Replaces window.addEventListener("resize") which misses
   container-level layout changes (sidebar collapse, etc.)
   ═══════════════════════════════════════ */
function useResponsiveScale() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w < 480) setScale(0.18);
      else if (w < 768) setScale(0.22);
      else if (w < 1024) setScale(0.24);
      else setScale(0.28);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { scale, containerRef };
}

/* ═══════════════════════════════════════
   P2-1: Simple undo/redo for story positions
   ═══════════════════════════════════════ */
const MAX_STORY_HISTORY = 20;

function useStoryUndoRedo(initialPositions: StoryPositions[]) {
  const historyRef = useRef<StoryPositions[][]>([initialPositions]);
  const indexRef = useRef(0);
  const [, forceRender] = useState(0);

  const pushState = useCallback((state: StoryPositions[]) => {
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(state);
    if (historyRef.current.length > MAX_STORY_HISTORY) {
      historyRef.current.shift();
    } else {
      indexRef.current++;
    }
    forceRender((n) => n + 1);
  }, []);

  const undo = useCallback((): StoryPositions[] | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    forceRender((n) => n + 1);
    return historyRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): StoryPositions[] | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    indexRef.current++;
    forceRender((n) => n + 1);
    return historyRef.current[indexRef.current];
  }, []);

  return {
    pushState,
    undo,
    redo,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < historyRef.current.length - 1,
  };
}

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
export default function KonvaStoriesCompositor({
  productName,
  price,
  slideGancho = "Você precisa ver isso! ✨",
  slideProduto,
  slideCTA = "Corre que é só hoje! 🔥",
  productImageUrl,
  modelImageUrl,
  storeName = "CriaLook",
  templateId = "elegant_dark",
  onTemplateChange,
}: KonvaStoriesCompositorProps) {
  // P3-5: Stable individual refs for each stage
  const stageRef0 = useRef<Konva.Stage>(null);
  const stageRef1 = useRef<Konva.Stage>(null);
  const stageRef2 = useRef<Konva.Stage>(null);
  const stageRefs = useMemo(() => [stageRef0, stageRef1, stageRef2], []);

  const [activeTemplate, setActiveTemplate] = useState(templateId);
  const [activeSlide, setActiveSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const { scale: previewScale, containerRef: scaleContainerRef } = useResponsiveScale();

  // P0-1: Track thumbnail snapshots for inactive slides
  const [thumbnails, setThumbnails] = useState<(string | null)[]>([null, null, null]);

  const t = templateStyles.find((s) => s.id === activeTemplate) || templateStyles[0];
  const hasPrice = price && price.trim().length > 0;
  const productText = slideProduto || (hasPrice ? `${productName} por apenas ${price.includes("R$") ? price : `R$ ${price}`}` : productName);

  useEffect(() => { setActiveTemplate(templateId); }, [templateId]);
  const handleTemplateSwitch = (id: string) => {
    setActiveTemplate(id);
    onTemplateChange?.(id);
  };

  // Per-slide state
  const initialPositions = useMemo(() => SLIDES.map((s) => getStoryDefaults(s.type)), []);
  const [positions, setPositions] = useState<StoryPositions[]>(() =>
    SLIDES.map((s) => getStoryDefaults(s.type))
  );
  const [fontSizes, setFontSizes] = useState<FontSizes[]>([{}, {}, {}]);
  const [selectedIds, setSelectedIds] = useState<(string | null)[]>([null, null, null]);
  const [hiddenSets, setHiddenSets] = useState<Set<string>[]>([new Set(), new Set(), new Set()]);

  // P2-1: Undo/redo for story positions
  const { pushState, undo, redo, canUndo, canRedo } = useStoryUndoRedo(initialPositions);

  // Slide contents
  const slideTexts = useMemo(() => [slideGancho, productText, slideCTA], [slideGancho, productText, slideCTA]);

  // P0-1: Capture thumbnail of active slide before switching away
  const captureActiveThumbnail = useCallback(() => {
    const stage = stageRefs[activeSlide].current;
    if (!stage) return;
    try {
      const thumb = stage.toDataURL({
        pixelRatio: 0.3,  // Low res for thumbnail — saves memory
        mimeType: "image/jpeg",
        quality: 0.6,
      });
      setThumbnails((prev) => {
        const next = [...prev];
        next[activeSlide] = thumb;
        return next;
      });
    } catch { /* CORS or canvas tainted — fallback to placeholder */ }
  }, [activeSlide]);

  // P0-1: Capture thumbnail before switching slides
  const handleSlideSwitch = useCallback((idx: number) => {
    if (idx === activeSlide) return;
    captureActiveThumbnail();
    setActiveSlide(idx);
  }, [activeSlide, captureActiveThumbnail]);

  // Handlers — scoped per slide
  const handleDragEnd = useCallback((slideIdx: number, key: string, x: number, y: number) => {
    setPositions((prev) => {
      const next = [...prev];
      next[slideIdx] = { ...next[slideIdx], [key]: { x, y } };
      pushState(next);
      return next;
    });
  }, [pushState]);

  const handleSelect = useCallback((slideIdx: number, key: string) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      // Deselect all other slides
      next.fill(null);
      next[slideIdx] = key;
      return next;
    });
    setActiveSlide(slideIdx);
  }, []);

  const handleDeselect = useCallback((slideIdx: number) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      next[slideIdx] = null;
      return next;
    });
  }, []);

  const handleFontSizeChange = useCallback((slideIdx: number, key: string, size: number) => {
    setFontSizes((prev) => {
      const next = [...prev];
      next[slideIdx] = { ...next[slideIdx], [key]: Math.round(Math.max(12, Math.min(120, size))) };
      return next;
    });
  }, []);

  const handleToggleVisibility = useCallback((slideIdx: number, key: string) => {
    setHiddenSets((prev) => {
      const next = [...prev];
      const set = new Set(next[slideIdx]);
      if (set.has(key)) set.delete(key);
      else {
        set.add(key);
        // Deselect if hiding selected
        setSelectedIds((sel) => {
          const s = [...sel];
          if (s[slideIdx] === key) s[slideIdx] = null;
          return s;
        });
      }
      next[slideIdx] = set;
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setPositions(SLIDES.map((s) => getStoryDefaults(s.type)));
    setFontSizes([{}, {}, {}]);
    setSelectedIds([null, null, null]);
    setHiddenSets([new Set(), new Set(), new Set()]);
  }, []);

  // P2-1: Undo/redo handlers
  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) setPositions(prev);
  }, [undo]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) setPositions(next);
  }, [redo]);

  // P2-1: Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  /* ═══ Download ═══ */
  // P0-3: pixelRatio: 2 (was 1) — matches Feed quality
  // P0-4: Uses consolidated exportStageAsDataURL utility
  // P3-6: stageRefsArray properly in deps (no eslint-disable needed)
  const downloadSlide = useCallback(async (slideIdx: number) => {
    // P0-1: If downloading an inactive slide, we need to temporarily mount it
    // For now, capture thumbnail and switch, download, switch back
    const prevActiveSlide = activeSlide;
    if (slideIdx !== activeSlide) {
      captureActiveThumbnail();
      setActiveSlide(slideIdx);
      // Wait for React to mount the slide
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    const stage = stageRefs[slideIdx].current;
    if (!stage) return;

    // Deselect for clean export
    setSelectedIds((prev) => {
      const next = [...prev];
      next[slideIdx] = null;
      return next;
    });

    // P3-3: double-rAF instead of arbitrary setTimeout(400)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // P0-4: Use consolidated export utility
    // P0-3: pixelRatio: 2 (was 1) — Stories now export at 2160×3840
    const uri = exportStageAsDataURL(stage, {
      width: CANVAS_W,
      height: STORY_H,
      pixelRatio: 2,
    });

    const link = document.createElement("a");
    const safeName = productName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    link.download = `crialook-story-${SLIDES[slideIdx].type}-${safeName}.png`;
    link.href = uri;
    link.click();

    // Restore active slide if we switched
    if (slideIdx !== prevActiveSlide) {
      setActiveSlide(prevActiveSlide);
    }
  }, [productName, activeSlide, captureActiveThumbnail]);

  // P3-3: downloadAllSlides uses double-rAF instead of setTimeout(400)
  const downloadAllSlides = useCallback(async () => {
    setDownloadingAll(true);
    try {
      for (let i = 0; i < 3; i++) {
        // Temporarily mount each slide for export
        captureActiveThumbnail();
        setActiveSlide(i);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const stage = stageRefs[i].current;
        if (!stage) continue;

        setSelectedIds((prev) => {
          const next = [...prev];
          next[i] = null;
          return next;
        });

        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const uri = exportStageAsDataURL(stage, {
          width: CANVAS_W,
          height: STORY_H,
          pixelRatio: 2,
        });

        const link = document.createElement("a");
        const safeName = productName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        link.download = `crialook-story-${SLIDES[i].type}-${safeName}.png`;
        link.href = uri;
        link.click();

        // P3-3: double-rAF between downloads (replaces setTimeout(400))
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
    } finally {
      setDownloadingAll(false);
    }
  }, [captureActiveThumbnail, productName]);

  const handleSingleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadSlide(activeSlide);
    } finally {
      setDownloading(false);
    }
  }, [activeSlide, downloadSlide]);

  const currentSlide = SLIDES[activeSlide];
  const currentElements = SLIDE_ELEMENTS[currentSlide.type];

  // P3-5: stageRefs are now stable individual useRef instances — no setter needed

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📱</span>
          <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            Stories Interativo
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-2xs font-bold"
            style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}
          >
            3 slides · Konva
          </span>
        </div>
      </div>

      {/* Template selector */}
      <TemplateSelector activeTemplate={activeTemplate} onSelect={handleTemplateSwitch} />

      {/* Main container */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>

        {/* Toolbar */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 py-2 gap-2"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
        >
          {/* Slide tabs */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.type}
                onClick={() => handleSlideSwitch(i)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: activeSlide === i ? "var(--brand-100)" : "transparent",
                  color: activeSlide === i ? "var(--brand-700)" : "var(--muted)",
                  border: activeSlide === i ? "1px solid var(--brand-200)" : "1px solid transparent",
                }}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}

            {/* P2-1: Undo/Redo buttons */}
            <div
              className="flex items-center gap-0.5 rounded-lg overflow-hidden ml-2"
              role="group"
              aria-label="Desfazer e refazer"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            >
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="px-2 py-1.5 text-xs hover:opacity-70 transition-opacity disabled:opacity-30"
                style={{ color: "var(--foreground)" }}
                title="Desfazer (Ctrl+Z)"
                aria-label="Desfazer"
              >
                ↶
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="px-2 py-1.5 text-xs hover:opacity-70 transition-opacity disabled:opacity-30"
                style={{ color: "var(--foreground)", borderLeft: "1px solid var(--border)" }}
                title="Refazer (Ctrl+Y)"
                aria-label="Refazer"
              >
                ↷
              </button>
            </div>
          </div>

          {/* Download buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSingleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
              style={{
                background: "var(--surface)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                opacity: downloading ? 0.6 : 1,
              }}
            >
              {downloading ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-brand-300 border-t-brand-600 rounded-full" />
                  Gerando...
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Slide {activeSlide + 1}
                </>
              )}
            </button>
            <button
              onClick={downloadAllSlides}
              disabled={downloadingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
              style={{
                background: "var(--gradient-brand)",
                color: "white",
                opacity: downloadingAll ? 0.6 : 1,
              }}
            >
              {downloadingAll ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                  Baixando...
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  3 PNGs
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80 min-h-tap sm:min-h-0"
              style={{
                background: "var(--surface)",
                color: "var(--muted)",
                border: "1px solid var(--border)",
              }}
              title="Resetar posições"
            >
              ↩ Reset
            </button>
          </div>
        </div>

        {/* Element visibility toggles */}
        <div
          className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", WebkitOverflowScrolling: "touch" }}
        >
          <span className="text-2xs font-medium mr-1 shrink-0" style={{ color: "var(--muted)" }}>
            👁️ Elementos:
          </span>
          {currentElements.map(({ key, label, icon }) => {
            const isHidden = hiddenSets[activeSlide].has(key);
            return (
              <button
                key={key}
                onClick={() => handleToggleVisibility(activeSlide, key)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[36px]"
                style={{
                  background: isHidden ? "var(--border)" : "var(--background)",
                  color: isHidden ? "var(--muted)" : "var(--foreground)",
                  opacity: isHidden ? 0.5 : 1,
                  border: "1px solid var(--border)",
                  textDecoration: isHidden ? "line-through" : "none",
                }}
                title={isHidden ? `Mostrar ${label}` : `Esconder ${label}`}
              >
                <span>{icon}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* Selected element control bar */}
        {selectedIds[activeSlide] && (() => {
          const selId = selectedIds[activeSlide]!;
          const elDef = currentElements.find((e) => e.key === selId);
          const selLabel = elDef?.label ?? selId;
          const selIcon = elDef?.icon ?? "📦";
          const curFont = (fontSizes[activeSlide] as Record<string, number>)[selId] ?? 40;
          return (
            <div
              className="flex items-center gap-2 px-3 py-2 overflow-x-auto"
              style={{
                borderBottom: "1px solid var(--border)",
                background: "linear-gradient(to right, rgba(139,92,246,0.06), rgba(139,92,246,0.02))",
              }}
            >
              {/* Element name */}
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
                style={{
                  background: "var(--brand-100)",
                  color: "var(--brand-600)",
                  whiteSpace: "nowrap",
                }}
              >
                {selIcon} {selLabel}
              </span>

              {/* Font size controls */}
              <div
                className="flex items-center gap-0.5 rounded-lg overflow-hidden shrink-0"
                style={{ border: "1px solid var(--border)", background: "var(--background)" }}
              >
                <button
                  onClick={() => handleFontSizeChange(activeSlide, selId, curFont - 2)}
                  className="px-2.5 py-1 text-sm font-bold hover:opacity-70 transition-opacity"
                  style={{ color: "var(--foreground)" }}
                  title="Diminuir fonte"
                >
                  A−
                </button>
                <span
                  className="px-2 py-1 text-2xs font-medium"
                  style={{
                    color: "var(--muted)",
                    borderLeft: "1px solid var(--border)",
                    borderRight: "1px solid var(--border)",
                    minWidth: "32px",
                    textAlign: "center",
                  }}
                >
                  {curFont}px
                </span>
                <button
                  onClick={() => handleFontSizeChange(activeSlide, selId, curFont + 2)}
                  className="px-2.5 py-1 text-sm font-bold hover:opacity-70 transition-opacity"
                  style={{ color: "var(--foreground)" }}
                  title="Aumentar fonte"
                >
                  A+
                </button>
              </div>

              {/* Delete (hide) */}
              <button
                onClick={() => handleToggleVisibility(activeSlide, selId)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80 shrink-0"
                style={{
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  whiteSpace: "nowrap",
                }}
                title="Esconder elemento"
              >
                ✕ Esconder
              </button>
            </div>
          );
        })()}

        {/* P0-1: Preview area — render only active slide as live Stage.
            Inactive slides show static thumbnail images (~0.3x resolution).
            This reduces VRAM from ~47MB (3 Stages) to ~16MB (1 Stage + 2 JPEGs). */}
        <div
          ref={scaleContainerRef}
          className="flex items-start gap-3 p-3 sm:p-4 overflow-x-auto snap-x snap-mandatory sm:justify-center"
          style={{
            background: "var(--surface)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {SLIDES.map((slide, i) => {
            const isActive = activeSlide === i;

            return (
              <div
                key={slide.type}
                className="snap-center shrink-0 cursor-pointer transition-all duration-200"
                onClick={() => handleSlideSwitch(i)}
                style={{
                  transform: isActive ? "scale(1.02)" : "scale(0.95)",
                  opacity: isActive ? 1 : 0.45,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: isActive ? `2px solid ${t.ctaBg}` : "2px solid transparent",
                  boxShadow: isActive ? `0 12px 40px ${t.ctaBg}25` : "none",
                }}
              >
                {/* P0-1: Only mount the live KonvaStorySlide for the active slide.
                    Inactive slides render a static thumbnail image. */}
                {isActive ? (
                  <KonvaStorySlide
                    stageRef={stageRefs[i]}
                    slideType={slide.type}
                    template={t}
                    previewScale={previewScale}
                    productName={productName}
                    price={price}
                    storeName={storeName}
                    slideText={slideTexts[i]}
                    productImageUrl={productImageUrl}
                    modelImageUrl={modelImageUrl}
                    positions={positions[i]}
                    fontSizes={fontSizes[i]}
                    selectedId={selectedIds[i]}
                    hiddenElements={hiddenSets[i]}
                    onDragEnd={(key, x, y) => handleDragEnd(i, key, x, y)}
                    onSelect={(key) => handleSelect(i, key)}
                    onDeselect={() => handleDeselect(i)}
                    onFontSizeChange={(key, size) => handleFontSizeChange(i, key, size)}
                    onToggleVisibility={(key) => handleToggleVisibility(i, key)}
                  />
                ) : (
                  /* P0-1: Static thumbnail for inactive slides — saves ~31MB VRAM */
                  <div
                    style={{
                      width: CANVAS_W * previewScale,
                      height: STORY_H * previewScale,
                      background: thumbnails[i]
                        ? `url(${thumbnails[i]}) center/cover`
                        : `linear-gradient(135deg, ${t.gradientColors[3] || '#1a1a2e'}, ${t.ctaBg}30)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {!thumbnails[i] && (
                      <span style={{ fontSize: 28, opacity: 0.5 }}>{slide.icon}</span>
                    )}
                  </div>
                )}
                {/* Slide label */}
                <div
                  style={{
                    background: isActive ? t.ctaBg : "var(--border)",
                    color: isActive ? "white" : "var(--muted)",
                    fontSize: 9,
                    fontWeight: 700,
                    textAlign: "center",
                    padding: "5px 0",
                    letterSpacing: "0.5px",
                  }}
                >
                  {slide.icon} {slide.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Help text */}
        <div
          className="px-3 py-2 text-center text-2xs"
          style={{
            background: "var(--background)",
            borderTop: "1px solid var(--border)",
            color: "var(--muted)",
          }}
        >
          ✋ Arraste textos · 🔲 Puxe os cantos para redimensionar · ↶↷ Ctrl+Z/Y desfazer/refazer · ↩ Reset restaura tudo
        </div>
      </div>
    </div>
  );
}
