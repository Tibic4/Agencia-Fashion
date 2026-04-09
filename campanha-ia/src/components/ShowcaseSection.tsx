"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

interface ShowcaseItem {
  id: string;
  before_photo_url: string;
  after_photo_url: string;
  caption: string | null;
}

// ═══════════════════════════════════════
// BeforeAfterSlider — comparador interativo
// Mobile-first: touch events + thumb-zone handle
// ═══════════════════════════════════════

function BeforeAfterSlider({
  item,
  onInteract,
}: {
  item: ShowcaseItem;
  /** Callback quando o usuário interage (pausa autoplay) */
  onInteract?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [imgError, setImgError] = useState<"before" | "after" | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

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
    if (!hasInteracted) {
      setHasInteracted(true);
      onInteract?.();
    }
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    updatePosition(clientX);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}
    >
      {/* Slider area — 9:16 mobile-optimized */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden touch-none"
        style={{
          aspectRatio: "9 / 16",
          maxHeight: "min(65vh, 540px)",
          width: "100%",
          background: "#1a1a1a",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        {/* DEPOIS — full background */}
        <Image
          src={item.after_photo_url}
          alt="Depois — modelo IA"
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 768px"
          quality={75}
          className="object-contain"
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

        {/* ANTES — clipped by slider position */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <Image
            src={item.before_photo_url}
            alt="Antes — foto original"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 768px"
            quality={75}
            className="object-contain"
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
          {/* Draggable handle — 48px touch target (mobile-design minimum) */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "48px",
              height: "48px",
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
          className="absolute bottom-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full z-20 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.5)", color: "white", backdropFilter: "blur(8px)" }}
        >
          📷 Antes
        </span>
        <span
          className="absolute bottom-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full z-20 pointer-events-none"
          style={{ background: "var(--gradient-brand, linear-gradient(135deg, #A855F7, #EC4899))", color: "white", backdropFilter: "blur(8px)" }}
        >
          ✨ Depois
        </span>

        {/* Hint — only when untouched */}
        <div
          className="absolute left-1/2 -translate-x-1/2 text-[10px] font-medium px-3 py-1.5 rounded-full z-20 pointer-events-none transition-opacity duration-500"
          style={{
            top: "12px",
            background: "rgba(0,0,0,0.45)",
            color: "rgba(255,255,255,0.85)",
            opacity: hasInteracted ? 0 : 1,
            backdropFilter: "blur(8px)",
          }}
        >
          ← arraste para comparar →
        </div>
      </div>

      {/* Caption */}
      {item.caption && (
        <div className="px-4 py-3 text-center" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            {item.caption}
          </p>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════
// ShowcaseSection — vitrine com autoplay
// ═══════════════════════════════════════

const AUTOPLAY_INTERVAL = 5000; // 5s entre trocas

export default function ShowcaseSection() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch vitrine data
  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.length) setItems(d.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // ── Autoplay — troca a cada 5s, pausa ao interagir ──
  useEffect(() => {
    if (isPaused || items.length <= 1) return;

    autoplayRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, AUTOPLAY_INTERVAL);

    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [isPaused, items.length]);

  /** Pausa autoplay ao interagir e retoma após 15s */
  const handleUserInteraction = useCallback(() => {
    setIsPaused(true);
    // Retomar autoplay após 15s de inatividade
    const timeout = setTimeout(() => setIsPaused(false), 15000);
    return () => clearTimeout(timeout);
  }, []);

  const goTo = useCallback((i: number) => {
    setActiveIndex(Math.max(0, Math.min(items.length - 1, i)));
    handleUserInteraction();
  }, [items.length, handleUserInteraction]);

  // Não renderiza nada se não tem itens
  if (loaded && items.length === 0) return null;
  if (!loaded) return null;

  const activeItem = items[activeIndex];

  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        {/* Header */}
        <div className="text-center mb-6 md:mb-12">
          <div className="badge badge-brand mb-3 md:mb-4 inline-flex">Resultado Real</div>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-2 md:mb-4">
            Veja a <span className="gradient-text">transformação</span>
          </h2>
          <p className="text-sm md:text-lg max-w-xl mx-auto" style={{ color: "var(--muted)" }}>
            Arraste para comparar — foto real vs. modelo IA
          </p>
        </div>

        {/* Slider container */}
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

          {/* Navigation arrows (desktop only) */}
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

          {/* ONLY ONE SLIDER RENDERED AT A TIME */}
          {activeItem && (
            <BeforeAfterSlider
              key={activeItem.id}
              item={activeItem}
              onInteract={handleUserInteraction}
            />
          )}

          {/* ── Navigation dots (unified mobile + desktop) ── */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              {/* Prev button (mobile) */}
              <button
                onClick={() => goTo(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="md:hidden flex items-center justify-center transition-all disabled:opacity-20"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                aria-label="Anterior"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              {/* Dots — autoplay progress indicator */}
              <div className="flex items-center gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: i === activeIndex ? "24px" : "8px",
                      height: "8px",
                      minHeight: "8px",
                      background: i === activeIndex
                        ? "var(--brand-500, #A855F7)"
                        : "var(--border, #e5e5e5)",
                      opacity: i === activeIndex ? 1 : 0.4,
                    }}
                    aria-label={`Vitrine ${i + 1}`}
                  />
                ))}
              </div>

              {/* Next button (mobile) */}
              <button
                onClick={() => goTo(activeIndex + 1)}
                disabled={activeIndex === items.length - 1}
                className="md:hidden flex items-center justify-center transition-all disabled:opacity-20"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                aria-label="Próximo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Autoplay status indicator ── */}
          {items.length > 1 && !isPaused && (
            <div className="flex justify-center mt-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                ▶ Trocando automaticamente
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
