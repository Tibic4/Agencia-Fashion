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
 */
function BeforeAfterSlider({ item }: { item: ShowcaseItem }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

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
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}
    >
      {/* Slider area */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden"
        style={{ height: "clamp(280px, 50vw, 500px)", cursor: isDragging ? "grabbing" : "grab" }}
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
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100vw",
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
            className="absolute inset-0 w-[3px]"
            style={{ background: "white", left: "50%", transform: "translateX(-50%)", boxShadow: "0 0 12px rgba(0,0,0,0.5)" }}
          />
          {/* Handle circular */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md"
            style={{
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              border: "2px solid white",
            }}
          >
            <span className="text-sm font-bold" style={{ color: "#333" }}>⟷</span>
          </div>
        </div>

        {/* Labels */}
        <span
          className="absolute bottom-4 left-4 text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm z-20 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.4)", color: "white" }}
        >
          📷 Antes
        </span>
        <span
          className="absolute bottom-4 right-4 text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm z-20 pointer-events-none"
          style={{ background: "var(--gradient-brand)", color: "white" }}
        >
          ✨ Depois
        </span>

        {/* Dica sutil */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium px-3 py-1 rounded-full backdrop-blur-sm z-20 pointer-events-none transition-opacity"
          style={{
            background: "rgba(0,0,0,0.3)",
            color: "rgba(255,255,255,0.7)",
            opacity: sliderPos === 50 ? 1 : 0,
          }}
        >
          ← arraste para comparar →
        </div>
      </div>

      {/* Caption */}
      {item.caption && (
        <div className="px-6 py-4 text-center" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
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

  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="text-center mb-12">
          <div className="badge badge-brand mb-4 inline-flex">Resultado Real</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Veja a <span className="gradient-text">transformação</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--muted)" }}>
            Arraste para comparar — foto real vs. modelo IA
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {items.map((item) => (
            <BeforeAfterSlider key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
