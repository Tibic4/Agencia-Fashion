"use client";

import { useRef, useState, useEffect } from "react";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */
interface CreativePreviewProps {
  productName: string;
  price: string;
  headline?: string;
  cta?: string;
  productImageUrl?: string | null;
  storeName?: string;
  templateId?: string;
  onTemplateChange?: (id: string) => void;
}

/* ═══════════════════════════════════════
   Templates Configuration
   ═══════════════════════════════════════ */
const templates = [
  {
    id: "modern_pink",
    label: "Rosa Moderno",
    icon: "🌸",
    bg: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 40%, #f5f3ff 100%)",
    accent: "#ec4899",
    textColor: "#1a1a2e",
    ctaBg: "linear-gradient(135deg, #ec4899, #a855f7)",
    ctaText: "#ffffff",
    badgeBg: "rgba(236,72,153,0.12)",
    badgeText: "#ec4899",
    priceColor: "#ec4899",
  },
  {
    id: "bold_dark",
    label: "Dark Premium",
    icon: "🖤",
    bg: "linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 50%, #2d1b4e 100%)",
    accent: "#a855f7",
    textColor: "#ffffff",
    ctaBg: "linear-gradient(135deg, #a855f7, #ec4899)",
    ctaText: "#ffffff",
    badgeBg: "rgba(168,85,247,0.2)",
    badgeText: "#c084fc",
    priceColor: "#f0abfc",
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
  },
];

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */
export default function CreativePreview({
  productName,
  price,
  headline,
  cta = "Comprar agora",
  productImageUrl,
  storeName = "CriaLook",
  templateId = "modern_pink",
  onTemplateChange,
}: CreativePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(templateId);
  const [imageLoaded, setImageLoaded] = useState(false);

  const t = templates.find((tpl) => tpl.id === activeTemplate) || templates[0];

  useEffect(() => {
    setActiveTemplate(templateId);
  }, [templateId]);

  const handleTemplateSwitch = (id: string) => {
    setActiveTemplate(id);
    onTemplateChange?.(id);
  };

  const handleDownload = async () => {
    if (!previewRef.current) return;
    setDownloading(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: 540,
        height: 540,
      });

      // Scale to 1080x1080
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = 1080;
      finalCanvas.height = 1080;
      const ctx = finalCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, 1080, 1080);
      }

      const link = document.createElement("a");
      link.download = `crialook-${productName.toLowerCase().replace(/\s+/g, "-")}-${activeTemplate}.png`;
      link.href = finalCanvas.toDataURL("image/png", 1.0);
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const displayPrice = price.includes("R$") ? price : `R$ ${price}`;

  return (
    <div>
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

      {/* Live preview */}
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
            <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              Criativo 1080×1080
            </span>
            <span
              className="text-2xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
            >
              {t.label}
            </span>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
            style={{
              background: "var(--gradient-brand)",
              color: "white",
              opacity: downloading ? 0.6 : 1,
            }}
          >
            {downloading ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                Gerando...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Baixar PNG
              </>
            )}
          </button>
        </div>

        {/* Creative canvas — 540x540 preview (exports as 1080x1080) */}
        <div className="flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
          <div
            ref={previewRef}
            style={{
              width: 540,
              height: 540,
              background: t.bg,
              position: "relative",
              overflow: "hidden",
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            }}
          >
            {/* Decorative circles */}
            <div
              style={{
                position: "absolute",
                top: -60,
                right: -60,
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: t.accent,
                opacity: 0.08,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -80,
                left: -40,
                width: 250,
                height: 250,
                borderRadius: "50%",
                background: t.accent,
                opacity: 0.06,
              }}
            />

            {/* Top badge - store name */}
            <div
              style={{
                position: "absolute",
                top: 24,
                left: "50%",
                transform: "translateX(-50%)",
                background: t.badgeBg,
                color: t.badgeText,
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 16px",
                borderRadius: 20,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              ✨ {storeName}
            </div>

            {/* Product image */}
            {productImageUrl ? (
              <div
                style={{
                  position: "absolute",
                  top: 60,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 260,
                  height: 260,
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
                  border: `2px solid ${t.accent}22`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImageUrl}
                  alt={productName}
                  onLoad={() => setImageLoaded(true)}
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
                  top: 60,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 260,
                  height: 260,
                  borderRadius: 20,
                  background: `${t.accent}10`,
                  border: `2px dashed ${t.accent}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 64,
                }}
              >
                👗
              </div>
            )}

            {/* Headline */}
            {headline && (
              <div
                style={{
                  position: "absolute",
                  top: 336,
                  left: 30,
                  right: 30,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 500,
                  color: t.textColor,
                  opacity: 0.7,
                  lineHeight: 1.4,
                }}
              >
                {headline.length > 60 ? headline.slice(0, 60) + "…" : headline}
              </div>
            )}

            {/* Product name */}
            <div
              style={{
                position: "absolute",
                top: headline ? 362 : 340,
                left: 20,
                right: 20,
                textAlign: "center",
                fontSize: productName.length > 20 ? 22 : 28,
                fontWeight: 800,
                color: t.textColor,
                lineHeight: 1.2,
                letterSpacing: "-0.5px",
              }}
            >
              {productName}
            </div>

            {/* Price */}
            <div
              style={{
                position: "absolute",
                top: headline ? 400 : 380,
                left: 20,
                right: 20,
                textAlign: "center",
                fontSize: 36,
                fontWeight: 900,
                color: t.priceColor,
                letterSpacing: "-1px",
              }}
            >
              {displayPrice}
            </div>

            {/* CTA button */}
            <div
              style={{
                position: "absolute",
                bottom: 50,
                left: "50%",
                transform: "translateX(-50%)",
                background: t.ctaBg,
                color: t.ctaText,
                fontSize: 15,
                fontWeight: 700,
                padding: "14px 44px",
                borderRadius: 30,
                boxShadow: `0 8px 30px ${t.accent}40`,
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              {cta} 💕
            </div>

            {/* Bottom watermark */}
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 9,
                fontWeight: 500,
                color: t.textColor,
                opacity: 0.3,
                letterSpacing: "0.5px",
              }}
            >
              Feito com CriaLook
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
