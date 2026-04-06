"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */
interface KonvaCompositorProps {
  /** URL da imagem do modelo (Fashn output) */
  modelImageUrl: string | null;
  /** URL da imagem do produto original (fallback) */
  productImageUrl?: string | null;
  /** Nome do produto */
  productName: string;
  /** Preço (ex: "89,90" ou "R$ 89,90") */
  price: string;
  /** Headline principal */
  headline?: string;
  /** CTA */
  cta?: string;
  /** Nome da loja */
  storeName?: string;
  /** Score da campanha */
  score?: number;
  /** Formato: feed (1080x1080) ou story (1080x1920) */
  format?: "feed" | "story";
}

/* ═══════════════════════════════════════
   Template Styles
   ═══════════════════════════════════════ */
interface TemplateStyle {
  id: string;
  label: string;
  icon: string;
  overlayGradient: string;
  accentColor: string;
  textColor: string;
  priceColor: string;
  ctaBg: string;
  ctaText: string;
  badgeBg: string;
  badgeText: string;
  overlayOpacity: number;
}

const templateStyles: TemplateStyle[] = [
  {
    id: "elegant_dark",
    label: "Elegante Escuro",
    icon: "🖤",
    overlayGradient: "linear-gradient(to top, rgba(10,10,20,0.95) 0%, rgba(10,10,20,0.6) 35%, rgba(0,0,0,0) 65%)",
    accentColor: "#ec4899",
    textColor: "#ffffff",
    priceColor: "#f9a8d4",
    ctaBg: "linear-gradient(135deg, #ec4899, #a855f7)",
    ctaText: "#ffffff",
    badgeBg: "rgba(255,255,255,0.15)",
    badgeText: "#ffffff",
    overlayOpacity: 1,
  },
  {
    id: "clean_light",
    label: "Clean Claro",
    icon: "✨",
    overlayGradient: "linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.75) 30%, rgba(255,255,255,0) 60%)",
    accentColor: "#7c3aed",
    textColor: "#111827",
    priceColor: "#7c3aed",
    ctaBg: "#111827",
    ctaText: "#ffffff",
    badgeBg: "rgba(124,58,237,0.1)",
    badgeText: "#7c3aed",
    overlayOpacity: 1,
  },
  {
    id: "vibrant_pink",
    label: "Rosa Vibrante",
    icon: "💖",
    overlayGradient: "linear-gradient(to top, rgba(157,23,77,0.95) 0%, rgba(157,23,77,0.5) 30%, rgba(0,0,0,0) 60%)",
    accentColor: "#f472b6",
    textColor: "#ffffff",
    priceColor: "#fce7f3",
    ctaBg: "#ffffff",
    ctaText: "#9d174d",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
    overlayOpacity: 1,
  },
  {
    id: "golden_luxury",
    label: "Gold Luxo",
    icon: "👑",
    overlayGradient: "linear-gradient(to top, rgba(20,15,5,0.95) 0%, rgba(20,15,5,0.55) 35%, rgba(0,0,0,0) 65%)",
    accentColor: "#d4a574",
    textColor: "#fef3c7",
    priceColor: "#fbbf24",
    ctaBg: "linear-gradient(135deg, #d4a574, #b8860b)",
    ctaText: "#1a1a1a",
    badgeBg: "rgba(212,165,116,0.2)",
    badgeText: "#fbbf24",
    overlayOpacity: 1,
  },
];

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */
export default function KonvaCompositor({
  modelImageUrl,
  productImageUrl,
  productName,
  price,
  headline,
  cta = "Compre agora",
  storeName = "CriaLook",
  score,
  format = "feed",
}: KonvaCompositorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTemplate, setActiveTemplate] = useState("elegant_dark");
  const [downloading, setDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);

  const t = templateStyles.find((s) => s.id === activeTemplate) || templateStyles[0];

  // Canvas dimensions
  const CANVAS_W = 1080;
  const CANVAS_H = format === "story" ? 1920 : 1350; // 4:5 for feed (Instagram optimal)
  const PREVIEW_SCALE = 0.42; // Preview size

  const displayPrice = price.includes("R$") ? price : `R$ ${price}`;
  const imageUrl = modelImageUrl || productImageUrl;

  // Load image
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLoadedImg(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      setImageLoaded(false);
      setLoadedImg(null);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Paint canvas
  const paintCanvas = useCallback(
    (canvas: HTMLCanvasElement, scale = 1) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = CANVAS_W * scale;
      const H = CANVAS_H * scale;
      canvas.width = W;
      canvas.height = H;

      ctx.save();
      ctx.scale(scale, scale);

      // ── 1. Background ──
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // ── 2. Model/Product Image (cover) ──
      if (loadedImg) {
        const imgRatio = loadedImg.width / loadedImg.height;
        const canvasRatio = CANVAS_W / CANVAS_H;
        let sx = 0, sy = 0, sw = loadedImg.width, sh = loadedImg.height;

        if (imgRatio > canvasRatio) {
          sw = loadedImg.height * canvasRatio;
          sx = (loadedImg.width - sw) / 2;
        } else {
          sh = loadedImg.width / canvasRatio;
          sy = (loadedImg.height - sh) / 2;
        }

        ctx.drawImage(loadedImg, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
      } else {
        // Placeholder
        ctx.fillStyle = "#e5e7eb";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#9ca3af";
        ctx.font = "bold 80px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("👗", CANVAS_W / 2, CANVAS_H / 2 - 40);
        ctx.font = "24px system-ui";
        ctx.fillText("Imagem da modelo", CANVAS_W / 2, CANVAS_H / 2 + 30);
      }

      // ── 3. Gradient overlay ──
      const overlayH = CANVAS_H * 0.55;
      const grd = ctx.createLinearGradient(0, CANVAS_H - overlayH, 0, CANVAS_H);

      if (t.id === "clean_light") {
        grd.addColorStop(0, "rgba(255,255,255,0)");
        grd.addColorStop(0.3, "rgba(255,255,255,0.7)");
        grd.addColorStop(0.5, "rgba(255,255,255,0.9)");
        grd.addColorStop(1, "rgba(255,255,255,0.98)");
      } else if (t.id === "vibrant_pink") {
        grd.addColorStop(0, "rgba(157,23,77,0)");
        grd.addColorStop(0.3, "rgba(157,23,77,0.5)");
        grd.addColorStop(0.6, "rgba(157,23,77,0.85)");
        grd.addColorStop(1, "rgba(157,23,77,0.95)");
      } else if (t.id === "golden_luxury") {
        grd.addColorStop(0, "rgba(20,15,5,0)");
        grd.addColorStop(0.3, "rgba(20,15,5,0.5)");
        grd.addColorStop(0.6, "rgba(20,15,5,0.8)");
        grd.addColorStop(1, "rgba(20,15,5,0.95)");
      } else {
        // elegant_dark
        grd.addColorStop(0, "rgba(10,10,20,0)");
        grd.addColorStop(0.3, "rgba(10,10,20,0.55)");
        grd.addColorStop(0.6, "rgba(10,10,20,0.8)");
        grd.addColorStop(1, "rgba(10,10,20,0.95)");
      }

      ctx.fillStyle = grd;
      ctx.fillRect(0, CANVAS_H - overlayH, CANVAS_W, overlayH);

      // ── 4. Store badge (top) ──
      ctx.save();
      const badgeText = `✨ ${storeName}`;
      ctx.font = "600 22px 'Inter', system-ui, sans-serif";
      const badgeW = ctx.measureText(badgeText).width + 40;
      const badgeX = (CANVAS_W - badgeW) / 2;

      // Badge background
      ctx.beginPath();
      roundRect(ctx, badgeX, 32, badgeW, 40, 20);
      ctx.fillStyle = t.badgeBg;
      ctx.fill();

      // Badge text
      ctx.fillStyle = t.badgeText;
      ctx.textAlign = "center";
      ctx.fillText(badgeText, CANVAS_W / 2, 59);
      ctx.restore();

      // ── 5. Content block (bottom) ──
      const contentBottom = CANVAS_H - 56;
      let yPos = contentBottom;

      // CTA Button
      ctx.save();
      const ctaText = `${cta} 💕`;
      ctx.font = "bold 28px 'Inter', system-ui, sans-serif";
      const ctaW = Math.min(ctx.measureText(ctaText).width + 80, CANVAS_W - 100);
      const ctaX = (CANVAS_W - ctaW) / 2;
      const ctaH = 60;
      yPos -= ctaH;

      // CTA bg
      ctx.beginPath();
      roundRect(ctx, ctaX, yPos, ctaW, ctaH, 30);
      if (t.ctaBg.includes("gradient")) {
        const ctaGrd = ctx.createLinearGradient(ctaX, yPos, ctaX + ctaW, yPos + ctaH);
        ctaGrd.addColorStop(0, "#ec4899");
        ctaGrd.addColorStop(1, "#a855f7");
        ctx.fillStyle = ctaGrd;
      } else {
        ctx.fillStyle = t.ctaBg;
      }
      ctx.fill();

      // CTA shadow
      ctx.shadowColor = `${t.accentColor}60`;
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // CTA text
      ctx.fillStyle = t.ctaText;
      ctx.textAlign = "center";
      ctx.fillText(ctaText, CANVAS_W / 2, yPos + 40);
      ctx.restore();

      yPos -= 32;

      // Price
      ctx.save();
      ctx.font = "900 64px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = t.priceColor;
      ctx.textAlign = "center";
      ctx.fillText(displayPrice, CANVAS_W / 2, yPos);
      ctx.restore();

      yPos -= 16;

      // Headline (if exists)
      if (headline) {
        ctx.save();
        const headlineDisplay = headline.length > 50 ? headline.slice(0, 50) + "…" : headline;
        ctx.font = "500 24px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = t.textColor;
        ctx.globalAlpha = 0.8;
        ctx.textAlign = "center";

        // Word wrap
        const lines = wrapText(ctx, headlineDisplay, CANVAS_W - 120);
        const lineH = 32;
        yPos -= lines.length * lineH;
        lines.forEach((line, i) => {
          ctx.fillText(line, CANVAS_W / 2, yPos + i * lineH + lineH);
        });
        ctx.restore();

        yPos -= 8;
      }

      // Product name
      ctx.save();
      const nameFontSize = productName.length > 25 ? 36 : productName.length > 15 ? 44 : 52;
      ctx.font = `800 ${nameFontSize}px 'Inter', system-ui, sans-serif`;
      ctx.fillStyle = t.textColor;
      ctx.textAlign = "center";

      const nameLines = wrapText(ctx, productName, CANVAS_W - 100);
      const nameLineH = nameFontSize * 1.2;
      yPos -= nameLines.length * nameLineH;
      nameLines.forEach((line, i) => {
        ctx.fillText(line, CANVAS_W / 2, yPos + i * nameLineH + nameLineH);
      });
      ctx.restore();

      // ── 6. Score badge (optional, bottom-right) ──
      if (score && score > 0) {
        ctx.save();
        const scoreText = `⭐ ${score}/100`;
        ctx.font = "600 18px system-ui, sans-serif";
        const sw2 = ctx.measureText(scoreText).width + 24;

        ctx.beginPath();
        roundRect(ctx, CANVAS_W - sw2 - 24, CANVAS_H - 44, sw2, 32, 16);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "center";
        ctx.fillText(scoreText, CANVAS_W - sw2 / 2 - 24, CANVAS_H - 22);
        ctx.restore();
      }

      // ── 7. Watermark ──
      ctx.save();
      ctx.font = "500 16px system-ui, sans-serif";
      ctx.fillStyle = t.textColor;
      ctx.globalAlpha = 0.3;
      ctx.textAlign = "center";
      ctx.fillText("Feito com CriaLook", CANVAS_W / 2, CANVAS_H - 18);
      ctx.restore();

      ctx.restore(); // undo scale
    },
    [loadedImg, t, CANVAS_W, CANVAS_H, displayPrice, headline, cta, productName, storeName, score]
  );

  // Re-paint preview whenever state changes
  useEffect(() => {
    if (!canvasRef.current) return;
    paintCanvas(canvasRef.current, PREVIEW_SCALE);
  }, [paintCanvas, PREVIEW_SCALE]);

  // Download full-res
  const handleDownload = useCallback(() => {
    setDownloading(true);
    try {
      const exportCanvas = document.createElement("canvas");
      paintCanvas(exportCanvas, 1);

      const link = document.createElement("a");
      const safeName = productName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      link.download = `crialook-${safeName}-${activeTemplate}.png`;
      link.href = exportCanvas.toDataURL("image/png", 1.0);
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  }, [paintCanvas, productName, activeTemplate]);

  return (
    <div>
      {/* Template selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {templateStyles.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => setActiveTemplate(tpl.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: activeTemplate === tpl.id ? "var(--gradient-brand)" : "var(--surface)",
              color: activeTemplate === tpl.id ? "white" : "var(--muted)",
              border: activeTemplate === tpl.id ? "none" : "1px solid var(--border)",
              transform: activeTemplate === tpl.id ? "scale(1.05)" : "scale(1)",
            }}
          >
            <span>{tpl.icon}</span>
            {tpl.label}
          </button>
        ))}
      </div>

      {/* Preview + toolbar */}
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
              {format === "story" ? "Story 1080×1920" : "Feed 1080×1350"}
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
            >
              {t.label}
            </span>
            {modelImageUrl && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "#dcfce7", color: "#166534" }}
              >
                📸 Modelo IA
              </span>
            )}
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

        {/* Canvas preview */}
        <div
          className="flex items-center justify-center p-4"
          style={{ background: "var(--surface)" }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: CANVAS_W * PREVIEW_SCALE,
              height: CANVAS_H * PREVIEW_SCALE,
              borderRadius: 12,
              boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}
