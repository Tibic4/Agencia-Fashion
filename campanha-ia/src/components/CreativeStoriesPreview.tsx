"use client";

import { useRef, useState, useEffect } from "react";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */
interface CreativeStoriesPreviewProps {
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
   Templates (same visual identity as Feed)
   ═══════════════════════════════════════ */
const templates = [
  {
    id: "modern_pink",
    label: "Rosa Moderno",
    icon: "🌸",
    bg: "linear-gradient(180deg, #fdf2f8 0%, #fce7f3 40%, #f9a8d4 100%)",
    accent: "#ec4899",
    textColor: "#1a1a2e",
    ctaBg: "linear-gradient(135deg, #ec4899, #a855f7)",
    ctaText: "#ffffff",
    badgeBg: "rgba(236,72,153,0.12)",
    badgeText: "#ec4899",
    priceColor: "#ec4899",
    overlayGradient: "linear-gradient(180deg, transparent 0%, rgba(253,242,248,0.9) 100%)",
  },
  {
    id: "bold_dark",
    label: "Dark Premium",
    icon: "🖤",
    bg: "linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 50%, #2d1b4e 100%)",
    accent: "#a855f7",
    textColor: "#ffffff",
    ctaBg: "linear-gradient(135deg, #a855f7, #ec4899)",
    ctaText: "#ffffff",
    badgeBg: "rgba(168,85,247,0.2)",
    badgeText: "#c084fc",
    priceColor: "#f0abfc",
    overlayGradient: "linear-gradient(180deg, transparent 0%, rgba(15,15,26,0.9) 100%)",
  },
  {
    id: "clean_white",
    label: "Clean Elegante",
    icon: "✨",
    bg: "linear-gradient(180deg, #ffffff 0%, #fafafa 50%, #f5f0ff 100%)",
    accent: "#7c3aed",
    textColor: "#111827",
    ctaBg: "#111827",
    ctaText: "#ffffff",
    badgeBg: "rgba(124,58,237,0.08)",
    badgeText: "#7c3aed",
    priceColor: "#7c3aed",
    overlayGradient: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.9) 100%)",
  },
];

const slideLabels = [
  { id: "gancho", label: "Slide 1 — Gancho", icon: "🎬" },
  { id: "produto", label: "Slide 2 — Produto", icon: "📸" },
  { id: "cta", label: "Slide 3 — CTA", icon: "📲" },
];

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */
export default function CreativeStoriesPreview({
  productName,
  price,
  slideGancho = "Olha o que acabou de chegar! 😍",
  slideProduto = "",
  slideCTA = "Chama no direct! 💬",
  productImageUrl,
  storeName = "CriaLook",
  templateId = "modern_pink",
  onTemplateChange,
}: CreativeStoriesPreviewProps) {
  const slideRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(templateId);
  const [activeSlide, setActiveSlide] = useState(0);
  const [hiddenEls, setHiddenEls] = useState<Set<string>>(new Set());

  const toggleEl = (key: string) => {
    setHiddenEls((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const t = templates.find((tpl) => tpl.id === activeTemplate) || templates[0];

  useEffect(() => {
    setActiveTemplate(templateId);
  }, [templateId]);

  const handleTemplateSwitch = (id: string) => {
    setActiveTemplate(id);
    onTemplateChange?.(id);
  };

  const hasPrice = price && price.trim().length > 0;
  const displayPrice = hasPrice ? (price.includes("R$") ? price : `R$ ${price}`) : "";
  const productText = slideProduto || (hasPrice ? `${productName} por apenas ${displayPrice}` : productName);

  /* ── Download single slide ── */
  const downloadSlide = async (slideIndex: number) => {
    const ref = slideRefs[slideIndex]?.current;
    if (!ref) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(ref, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: 270,
        height: 480,
      });

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = 1080;
      finalCanvas.height = 1920;
      const ctx = finalCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, 1080, 1920);
      }

      const link = document.createElement("a");
      const slideNames = ["gancho", "produto", "cta"];
      link.download = `crialook-story-${slideNames[slideIndex]}-${productName.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = finalCanvas.toDataURL("image/png", 1.0);
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  /* ── Download all 3 slides ── */
  const downloadAllSlides = async () => {
    setDownloadingAll(true);
    try {
      for (let i = 0; i < 3; i++) {
        await downloadSlide(i);
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  /* ═══════════════════════════════════════
     Slide 1 — GANCHO (max 8 words)
     ═══════════════════════════════════════ */
  const renderSlideGancho = () => (
    <div
      ref={slideRefs[0]}
      style={{
        width: 270,
        height: 480,
        background: t.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Decorative elements */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: t.accent,
          opacity: 0.1,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: -30,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: t.accent,
          opacity: 0.07,
        }}
      />

      {/* Store badge */}
      {!hiddenEls.has("storeName") && (
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: t.badgeBg,
          color: t.badgeText,
          fontSize: 8,
          fontWeight: 700,
          padding: "3px 12px",
          borderRadius: 14,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        ✨ {storeName}
      </div>
      )}

      {/* Main gancho text — centered */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 16,
          right: 16,
          transform: "translateY(-50%)",
          textAlign: "center",
          fontSize: slideGancho.length > 40 ? 18 : slideGancho.length > 25 ? 22 : 28,
          fontWeight: 900,
          color: t.textColor,
          lineHeight: 1.25,
          letterSpacing: "-0.5px",
          overflow: "hidden",
          wordBreak: "break-word" as const,
          maxHeight: 160,
        }}
      >
        {slideGancho.length > 45 ? slideGancho.slice(0, 45) + "…" : slideGancho}
      </div>

      {/* "Arraste para cima" hint */}
      {!hiddenEls.has("swipeHint") && (
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 16,
            color: t.accent,
            marginBottom: 4,
            animation: "none",
          }}
        >
          ▲
        </div>
        <div
          style={{
            fontSize: 7,
            fontWeight: 600,
            color: t.textColor,
            opacity: 0.4,
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Arraste
        </div>
      </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════
     Slide 2 — PRODUTO (image + max 12 words + price)
     ═══════════════════════════════════════ */
  const renderSlideProduto = () => (
    <div
      ref={slideRefs[1]}
      style={{
        width: 270,
        height: 480,
        background: t.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Decorative */}
      <div
        style={{
          position: "absolute",
          top: -30,
          left: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: t.accent,
          opacity: 0.08,
        }}
      />

      {/* Store badge */}
      {!hiddenEls.has("storeName") && (
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: t.badgeBg,
          color: t.badgeText,
          fontSize: 7,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: 14,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {storeName}
      </div>
      )}

      {/* Product image */}
      {productImageUrl ? (
        <div
          style={{
            position: "absolute",
            top: 44,
            left: "50%",
            transform: "translateX(-50%)",
            width: 200,
            height: 220,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
            border: `2px solid ${t.accent}22`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImageUrl}
            alt={productName}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            top: 44,
            left: "50%",
            transform: "translateX(-50%)",
            width: 200,
            height: 220,
            borderRadius: 16,
            background: `${t.accent}10`,
            border: `2px dashed ${t.accent}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          👗
        </div>
      )}

      {/* Product description text */}
      {!hiddenEls.has("productName") && (
      <div
        style={{
          position: "absolute",
          top: 280,
          left: 16,
          right: 16,
          textAlign: "center",
          fontSize: productText.length > 50 ? 10 : 12,
          fontWeight: 600,
          color: t.textColor,
          lineHeight: 1.35,
          overflow: "hidden",
          wordBreak: "break-word" as const,
          maxHeight: 40,
        }}
      >
        {productText.length > 55 ? productText.slice(0, 55) + "…" : productText}
      </div>
      )}

      {/* Price badge — only if price exists */}
      {hasPrice && !hiddenEls.has("price") && (
      <div
        style={{
          position: "absolute",
          top: 330,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <div
          style={{
            background: t.badgeBg,
            borderRadius: 16,
            padding: "8px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: t.priceColor,
              letterSpacing: "-0.8px",
            }}
          >
            {displayPrice}
          </div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 500,
              color: t.textColor,
              opacity: 0.5,
              marginTop: 2,
            }}
          >
            à vista no PIX
          </div>
        </div>
      </div>
      )}

      {/* Swipe hint */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 7,
          fontWeight: 500,
          color: t.textColor,
          opacity: 0.3,
          letterSpacing: "0.5px",
        }}
      >
        Feito com CriaLook
      </div>
    </div>
  );

  /* ═══════════════════════════════════════
     Slide 3 — CTA (max 6 words + button + logo)
     ═══════════════════════════════════════ */
  const renderSlideCTA = () => (
    <div
      ref={slideRefs[2]}
      style={{
        width: 270,
        height: 480,
        background: t.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Decorative */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: t.accent,
          opacity: 0.05,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -50,
          right: -50,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: t.accent,
          opacity: 0.08,
        }}
      />

      {/* CTA text — centered */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: 16,
          right: 16,
          transform: "translateY(-50%)",
          textAlign: "center",
          fontSize: slideCTA.length > 30 ? 18 : slideCTA.length > 20 ? 22 : 26,
          fontWeight: 900,
          color: t.textColor,
          lineHeight: 1.25,
          letterSpacing: "-0.3px",
          overflow: "hidden",
          wordBreak: "break-word" as const,
          maxHeight: 120,
        }}
      >
        {slideCTA.length > 35 ? slideCTA.slice(0, 35) + "…" : slideCTA}
      </div>

      {/* CTA button */}
      {!hiddenEls.has("ctaButton") && (
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "50%",
          transform: "translateX(-50%)",
          background: t.ctaBg,
          color: t.ctaText,
          fontSize: 12,
          fontWeight: 700,
          padding: "10px 24px",
          borderRadius: 28,
          boxShadow: `0 8px 30px ${t.accent}40`,
          letterSpacing: "0.3px",
          whiteSpace: "nowrap",
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
        }}
      >
        Manda no WhatsApp 💬
      </div>
      )}

      {/* Store name / logo area */}
      {!hiddenEls.has("storeName") && (
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: t.textColor,
            opacity: 0.8,
            letterSpacing: "-0.3px",
          }}
        >
          {storeName}
        </div>
        <div
          style={{
            fontSize: 7,
            fontWeight: 500,
            color: t.textColor,
            opacity: 0.35,
            marginTop: 4,
          }}
        >
          Feito com CriaLook
        </div>
      </div>
      )}
    </div>
  );

  const renderSlides = [renderSlideGancho, renderSlideProduto, renderSlideCTA];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          📱 Stories 1080×1920
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
        >
          3 slides
        </span>
      </div>

      {/* Template selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handleTemplateSwitch(tpl.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: activeTemplate === tpl.id ? "var(--gradient-brand)" : "var(--surface)",
              color: activeTemplate === tpl.id ? "white" : "var(--muted)",
              border: activeTemplate === tpl.id ? "none" : "1px solid var(--border)",
              transform: activeTemplate === tpl.id ? "scale(1.02)" : "scale(1)",
            }}
          >
            <span>{tpl.icon}</span>
            {tpl.label}
          </button>
        ))}
      </div>

      {/* Main container */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
        >
          <div className="flex items-center gap-2">
            {slideLabels.map((s, i) => (
              <button
                key={s.id}
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
          <div className="flex gap-2">
            <button
              onClick={() => downloadSlide(activeSlide)}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
              style={{
                background: "var(--gradient-brand)",
                color: "white",
                opacity: downloadingAll ? 0.6 : 1,
              }}
            >
              {downloadingAll ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                  Baixando 3...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Baixar 3 PNGs
                </>
              )}
            </button>
          </div>
        </div>

        {/* Element visibility toggles */}
        <div
          className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <span className="text-[10px] font-medium mr-1" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
            👁️ Elementos:
          </span>
          {[
            { key: "storeName", label: "Loja", icon: "🏷️" },
            { key: "productName", label: "Nome", icon: "📝" },
            { key: "price", label: "Preço", icon: "💰" },
            { key: "ctaButton", label: "CTA", icon: "🔘" },
            { key: "swipeHint", label: "Swipe", icon: "👆" },
          ].map(({ key, label, icon }) => {
            const isHidden = hiddenEls.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleEl(key)}
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

        {/* Preview area — shows all 3 slides side by side, highlights active */}
        <div
          className="flex items-start justify-center gap-4 p-6"
          style={{ background: "var(--surface)" }}
        >
          {renderSlides.map((renderFn, i) => (
            <div
              key={i}
              onClick={() => setActiveSlide(i)}
              className="cursor-pointer transition-all"
              style={{
                transform: activeSlide === i ? "scale(1.03)" : "scale(0.95)",
                opacity: activeSlide === i ? 1 : 0.5,
                boxShadow: activeSlide === i ? `0 12px 40px ${t.accent}25` : "none",
                borderRadius: 12,
                overflow: "hidden",
                border: activeSlide === i ? `2px solid ${t.accent}` : "2px solid transparent",
              }}
            >
              {renderFn()}
              {/* Slide label */}
              <div
                style={{
                  background: activeSlide === i ? t.accent : "var(--border)",
                  color: activeSlide === i ? "white" : "var(--muted)",
                  fontSize: 9,
                  fontWeight: 700,
                  textAlign: "center",
                  padding: "4px 0",
                  letterSpacing: "0.5px",
                }}
              >
                {slideLabels[i].icon} {slideLabels[i].label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
