"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import Konva from "konva";
import { templateStyles } from "./templates";
import { CANVAS_W, STORY_H } from "./constants";
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
   Responsive preview scale
   ═══════════════════════════════════════ */
function useResponsiveScale() {
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      if (w < 480) setScale(0.18);      // Mobile small — 1 slide visible
      else if (w < 768) setScale(0.22); // Mobile — 1-2 slides
      else if (w < 1024) setScale(0.24);
      else setScale(0.28);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return scale;
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
  storeName = "CriaLook",
  templateId = "elegant_dark",
  onTemplateChange,
}: KonvaStoriesCompositorProps) {
  const stageRefs = [
    useRef<Konva.Stage>(null),
    useRef<Konva.Stage>(null),
    useRef<Konva.Stage>(null),
  ];

  const [activeTemplate, setActiveTemplate] = useState(templateId);
  const [activeSlide, setActiveSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const previewScale = useResponsiveScale();

  const t = templateStyles.find((s) => s.id === activeTemplate) || templateStyles[0];
  const hasPrice = price && price.trim().length > 0;
  const productText = slideProduto || (hasPrice ? `${productName} por apenas ${price.includes("R$") ? price : `R$ ${price}`}` : productName);

  useEffect(() => { setActiveTemplate(templateId); }, [templateId]);
  const handleTemplateSwitch = (id: string) => {
    setActiveTemplate(id);
    onTemplateChange?.(id);
  };

  // Per-slide state
  const [positions, setPositions] = useState<StoryPositions[]>(() =>
    SLIDES.map((s) => getStoryDefaults(s.type))
  );
  const [fontSizes, setFontSizes] = useState<FontSizes[]>([{}, {}, {}]);
  const [selectedIds, setSelectedIds] = useState<(string | null)[]>([null, null, null]);
  const [hiddenSets, setHiddenSets] = useState<Set<string>[]>([new Set(), new Set(), new Set()]);

  // Slide contents
  const slideTexts = useMemo(() => [slideGancho, productText, slideCTA], [slideGancho, productText, slideCTA]);

  // Handlers — scoped per slide
  const handleDragEnd = useCallback((slideIdx: number, key: string, x: number, y: number) => {
    setPositions((prev) => {
      const next = [...prev];
      next[slideIdx] = { ...next[slideIdx], [key]: { x, y } };
      return next;
    });
  }, []);

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

  /* ═══ Download ═══ */
  const downloadSlide = useCallback(async (slideIdx: number) => {
    const stage = stageRefs[slideIdx]?.current;
    if (!stage) return;

    // Deselect for clean export
    setSelectedIds((prev) => {
      const next = [...prev];
      next[slideIdx] = null;
      return next;
    });

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const savedSX = stage.scaleX();
    const savedSY = stage.scaleY();
    const savedW = stage.width();
    const savedH = stage.height();

    stage.scale({ x: 1, y: 1 });
    stage.width(CANVAS_W);
    stage.height(STORY_H);
    stage.batchDraw();

    const uri = stage.toDataURL({ pixelRatio: 1, mimeType: "image/png", x: 0, y: 0, width: CANVAS_W, height: STORY_H });

    stage.scale({ x: savedSX, y: savedSY });
    stage.width(savedW);
    stage.height(savedH);
    stage.batchDraw();

    const link = document.createElement("a");
    const safeName = productName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    link.download = `crialook-story-${SLIDES[slideIdx].type}-${safeName}.png`;
    link.href = uri;
    link.click();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName]);

  const downloadAllSlides = useCallback(async () => {
    setDownloadingAll(true);
    try {
      for (let i = 0; i < 3; i++) {
        await downloadSlide(i);
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setDownloadingAll(false);
    }
  }, [downloadSlide]);

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
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
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
                onClick={() => setActiveSlide(i)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
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
          </div>

          {/* Download buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSingleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:opacity-90"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:opacity-90"
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:opacity-80"
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
          className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <span className="text-[10px] font-medium mr-1 shrink-0" style={{ color: "var(--muted)" }}>
            👁️ Elementos:
          </span>
          {currentElements.map(({ key, label, icon }) => {
            const isHidden = hiddenSets[activeSlide].has(key);
            return (
              <button
                key={key}
                onClick={() => handleToggleVisibility(activeSlide, key)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0"
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

        {/* Preview area — horizontal scroll on mobile */}
        <div
          className="flex items-start gap-3 p-3 sm:p-4 overflow-x-auto snap-x snap-mandatory sm:justify-center"
          style={{
            background: "var(--surface)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.type}
              className="snap-center shrink-0 cursor-pointer transition-all duration-200"
              onClick={() => setActiveSlide(i)}
              style={{
                transform: activeSlide === i ? "scale(1.02)" : "scale(0.95)",
                opacity: activeSlide === i ? 1 : 0.45,
                borderRadius: 14,
                overflow: "hidden",
                border: activeSlide === i ? `2px solid ${t.ctaBg}` : "2px solid transparent",
                boxShadow: activeSlide === i ? `0 12px 40px ${t.ctaBg}25` : "none",
              }}
            >
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
              {/* Slide label */}
              <div
                style={{
                  background: activeSlide === i ? t.ctaBg : "var(--border)",
                  color: activeSlide === i ? "white" : "var(--muted)",
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
          ))}
        </div>

        {/* Help text */}
        <div
          className="px-3 py-2 text-center text-[10px]"
          style={{
            background: "var(--background)",
            borderTop: "1px solid var(--border)",
            color: "var(--muted)",
          }}
        >
          ✋ Arraste textos · 🔲 Puxe os cantos para redimensionar · ✕ Exclua com o botão vermelho · ↩ Reset restaura tudo
        </div>
      </div>
    </div>
  );
}
