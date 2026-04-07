"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

interface ShowcaseItem {
  id: string;
  before_photo_url: string;
  after_photo_url: string;
  caption: string | null;
}

/**
 * Componente de comparação interativa antes/depois com slider arrastável.
 * Usa height fixa baseada em viewport para garantir consistência.
 */
function BeforeAfterSlider({ item }: { item: ShowcaseItem }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [imgError, setImgError] = useState<"before" | "after" | null>(null);

  // Track container width via ResizeObserver
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
    const percent = Math.max(3, Math.min(97, (x / rect.width) * 100));
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
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
      }}
    >
      {/* Slider area */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden"
        style={{
          height: "clamp(320px, 55vw, 560px)",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        {/* DEPOIS — full background image */}
        <Image
          src={item.after_photo_url}
          alt="Depois — modelo IA"
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          draggable={false}
          onError={() => setImgError("after")}
        />

        {/* Fallback se imagem "depois" falhar */}
        {imgError === "after" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--surface)" }}>
            <div className="text-center">
              <span className="text-3xl block mb-2">⚠️</span>
              <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>Imagem não carregada</p>
            </div>
          </div>
        )}

        {/* ANTES — imagem cortada pelo slider position */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <Image
            src={item.before_photo_url}
            alt="Antes — foto original"
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            style={{
              width: containerWidth > 0 ? `${containerWidth}px` : "100%",
              maxWidth: "none",
            }}
            draggable={false}
            onError={() => setImgError("before")}
          />
        </div>

        {/* Divider line + handle */}
        <div
          className="absolute top-0 bottom-0 z-10"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          {/* Vertical line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "2px",
              background: "white",
              boxShadow: "0 0 12px rgba(0,0,0,0.4)",
            }}
          />
          {/* Draggable handle — always vertically centered */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              border: "3px solid white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 6-6 6 6 6" />
              <path d="m16 6 6 6-6 6" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <span
          className="absolute bottom-3 left-3 md:bottom-4 md:left-4 text-[11px] md:text-sm font-bold px-2.5 py-1 md:px-3 md:py-1.5 rounded-full z-20 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.5)", color: "white", backdropFilter: "blur(8px)" }}
        >
          📷 Antes
        </span>
        <span
          className="absolute bottom-3 right-3 md:bottom-4 md:right-4 text-[11px] md:text-sm font-bold px-2.5 py-1 md:px-3 md:py-1.5 rounded-full z-20 pointer-events-none"
          style={{ background: "var(--gradient-brand, linear-gradient(135deg, #A855F7, #EC4899))", color: "white", backdropFilter: "blur(8px)" }}
        >
          ✨ Depois
        </span>

        {/* Hint — disappears when user interacts */}
        <div
          className="absolute left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-medium px-3 py-1.5 rounded-full z-20 pointer-events-none transition-opacity duration-500"
          style={{
            top: "12px",
            background: "rgba(0,0,0,0.4)",
            color: "rgba(255,255,255,0.8)",
            opacity: sliderPos === 50 ? 1 : 0,
            backdropFilter: "blur(8px)",
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

export default function ShowcaseSection() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.length) setItems(d.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Não renderiza nada se não tem itens
  if (loaded && items.length === 0) return null;
  if (!loaded) return null;

  const goTo = (i: number) => {
    setActiveIndex(Math.max(0, Math.min(items.length - 1, i)));
  };

  const activeItem = items[activeIndex];

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

        {/* Single active slider — NO STACKING */}
        <div className="max-w-3xl mx-auto relative">
          {/* Counter badge (multiple items) */}
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

          {/* Navigation arrows (desktop) */}
          {items.length > 1 && (
            <>
              <button
                onClick={() => goTo(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="hidden md:flex absolute -left-16 top-1/2 -translate-y-1/2 items-center justify-center z-20 transition-all disabled:opacity-20 hover:scale-110"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
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
                className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 items-center justify-center z-20 transition-all disabled:opacity-20 hover:scale-110"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                }}
                aria-label="Próximo"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          {/* ONLY ONE SLIDER RENDERED AT A TIME — prevents stacking */}
          {activeItem && (
            <BeforeAfterSlider key={activeItem.id} item={activeItem} />
          )}

          {/* Mobile navigation (below slider) */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6 md:hidden">
              <button
                onClick={() => goTo(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="flex items-center justify-center transition-all disabled:opacity-20"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                aria-label="Anterior"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              {/* Dots */}
              <div className="flex items-center gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: i === activeIndex ? "20px" : "8px",
                      height: "8px",
                      background: i === activeIndex
                        ? "var(--brand-500, #A855F7)"
                        : "var(--border, #e5e5e5)",
                      opacity: i === activeIndex ? 1 : 0.4,
                    }}
                    aria-label={`Vitrine ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => goTo(activeIndex + 1)}
                disabled={activeIndex === items.length - 1}
                className="flex items-center justify-center transition-all disabled:opacity-20"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                aria-label="Próximo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          )}

          {/* Desktop dots */}
          {items.length > 1 && (
            <div className="hidden md:flex items-center justify-center gap-2 mt-6">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: i === activeIndex ? "24px" : "8px",
                    height: "8px",
                    background: i === activeIndex
                      ? "var(--brand-500, #A855F7)"
                      : "var(--border, #e5e5e5)",
                    opacity: i === activeIndex ? 1 : 0.4,
                  }}
                  aria-label={`Vitrine ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
