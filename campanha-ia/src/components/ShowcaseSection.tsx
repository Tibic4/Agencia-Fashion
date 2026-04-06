"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ShowcaseItem {
  id: string;
  before_photo_url: string;
  after_photo_url: string;
  caption: string | null;
}

/**
 * Componente de comparação interativa antes/depois com slider arrastável
 * Corrigido: aspect-ratio fixo, labels responsivos, handle centralizado
 */
function BeforeAfterSlider({ item, isActive }: { item: ShowcaseItem; isActive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track container width for "before" image sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      updatePosition(clientX);
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, [isDragging, updatePosition]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    updatePosition(clientX);
  };

  return (
    <div
      className="rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-500"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: isActive
          ? "0 12px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(168,85,247,0.1)"
          : "0 4px 16px rgba(0,0,0,0.08)",
        transform: isActive ? "scale(1)" : "scale(0.92)",
        opacity: isActive ? 1 : 0.5,
        pointerEvents: isActive ? "auto" : "none",
      }}
    >
      {/* Slider area — aspect ratio based height */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden"
        style={{
          aspectRatio: "4 / 5",
          maxHeight: "min(70vh, 600px)",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        {/* DEPOIS — imagem de fundo (100% largura) */}
        <img
          src={item.after_photo_url}
          alt="Depois — modelo IA"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* ANTES — imagem cortada pelo slider */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={item.before_photo_url}
            alt="Antes — foto original"
            className="absolute inset-0 h-full object-cover"
            style={{
              width: containerWidth > 0 ? `${containerWidth}px` : "100vw",
              maxWidth: "none",
            }}
            draggable={false}
          />
        </div>

        {/* Linha divisória + handle */}
        <div
          className="absolute top-0 bottom-0 z-10"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          {/* Linha */}
          <div
            className="absolute inset-0"
            style={{
              width: "2px",
              background: "white",
              left: "50%",
              transform: "translateX(-50%)",
              boxShadow: "0 0 16px rgba(0,0,0,0.4)",
            }}
          />
          {/* Handle circular — ALWAYS centered vertically */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center backdrop-blur-md"
            style={{
              top: "50%",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              border: "3px solid white",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 6-6 6 6 6" />
              <path d="m16 6 6 6-6 6" />
            </svg>
          </div>
        </div>

        {/* Labels — responsive */}
        <span
          className="absolute bottom-3 left-3 md:bottom-5 md:left-5 text-xs md:text-sm font-bold px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full backdrop-blur-md z-20 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.5)", color: "white" }}
        >
          📷 Antes
        </span>
        <span
          className="absolute bottom-3 right-3 md:bottom-5 md:right-5 text-xs md:text-sm font-bold px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full backdrop-blur-md z-20 pointer-events-none"
          style={{ background: "var(--gradient-brand)", color: "white" }}
        >
          ✨ Depois
        </span>

        {/* Dica sutil — desaparece ao interagir */}
        <div
          className="absolute top-3 md:top-5 left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-md z-20 pointer-events-none transition-opacity duration-500"
          style={{
            background: "rgba(0,0,0,0.4)",
            color: "rgba(255,255,255,0.8)",
            opacity: sliderPos === 50 ? 1 : 0,
          }}
        >
          ← arraste para comparar →
        </div>
      </div>

      {/* Caption */}
      {item.caption && (
        <div className="px-4 py-3 md:px-6 md:py-4 text-center" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs md:text-sm font-medium" style={{ color: "var(--muted)" }}>
            {item.caption}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Indicador de navegação por pontos
 */
function DotIndicator({
  total,
  active,
  onSelect,
}: {
  total: number;
  active: number;
  onSelect: (i: number) => void;
}) {
  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6 md:mt-8">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className="transition-all duration-300 rounded-full"
          style={{
            width: i === active ? "24px" : "8px",
            height: "8px",
            background: i === active
              ? "var(--brand-500, #A855F7)"
              : "var(--border, #e5e5e5)",
            opacity: i === active ? 1 : 0.5,
          }}
          aria-label={`Ir para vitrine ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function ShowcaseSection() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.length) setItems(d.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Swipe gesture for carousel (only when not dragging slider)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    const threshold = 80; // px min for swipe
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && activeIndex < items.length - 1) {
        setActiveIndex((prev) => prev + 1);
      } else if (diff < 0 && activeIndex > 0) {
        setActiveIndex((prev) => prev - 1);
      }
    }
    setTouchStart(null);
  };

  const goTo = (i: number) => {
    setActiveIndex(Math.max(0, Math.min(items.length - 1, i)));
  };

  // Não renderiza nada se não tem itens
  if (loaded && items.length === 0) return null;
  if (!loaded) return null;

  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="badge badge-brand mb-4 inline-flex">Resultado Real</div>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 md:mb-4">
            Veja a <span className="gradient-text">transformação</span>
          </h2>
          <p className="text-sm md:text-lg max-w-xl mx-auto" style={{ color: "var(--muted)" }}>
            Arraste para comparar — foto real vs. modelo IA
          </p>
        </div>

        {/* Carousel container */}
        <div
          ref={showcaseRef}
          className="relative max-w-2xl mx-auto"
          onTouchStart={items.length > 1 ? handleTouchStart : undefined}
          onTouchEnd={items.length > 1 ? handleTouchEnd : undefined}
        >
          {/* Navigation arrows (desktop, multiple items) */}
          {items.length > 1 && (
            <>
              <button
                onClick={() => goTo(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full hidden md:flex items-center justify-center z-20 transition-all disabled:opacity-20"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                  marginLeft: "-12px",
                }}
                aria-label="Anterior"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={() => goTo(activeIndex + 1)}
                disabled={activeIndex === items.length - 1}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full hidden md:flex items-center justify-center z-20 transition-all disabled:opacity-20"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                  marginRight: "-12px",
                }}
                aria-label="Próximo"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          {/* Slider stack — only active is visible/interactive */}
          <div className="relative">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="transition-all duration-500"
                style={{
                  display: Math.abs(index - activeIndex) > 1 ? "none" : "block",
                  position: index === activeIndex ? "relative" : "absolute",
                  inset: index === activeIndex ? undefined : 0,
                  zIndex: index === activeIndex ? 1 : 0,
                }}
              >
                <BeforeAfterSlider item={item} isActive={index === activeIndex} />
              </div>
            ))}
          </div>

          {/* Counter badge */}
          {items.length > 1 && (
            <div
              className="absolute -top-3 right-2 md:right-0 text-[11px] font-bold px-3 py-1 rounded-full z-30"
              style={{
                background: "var(--brand-500, #A855F7)",
                color: "white",
                boxShadow: "0 2px 8px rgba(168, 85, 247, 0.3)",
              }}
            >
              {activeIndex + 1} / {items.length}
            </div>
          )}
        </div>

        {/* Dot indicators */}
        <DotIndicator total={items.length} active={activeIndex} onSelect={goTo} />
      </div>
    </section>
  );
}
