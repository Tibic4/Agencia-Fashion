"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KImage, Text, Rect, Group } from "react-konva";
import Konva from "konva";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */
interface KonvaCompositorProps {
  modelImageUrl: string | null;
  productImageUrl?: string | null;
  productName: string;
  price: string;
  headline?: string;
  cta?: string;
  storeName?: string;
  score?: number;
  format?: "feed" | "story";
}

/* ═══════════════════════════════════════
   Template Styles
   ═══════════════════════════════════════ */
interface TemplateStyle {
  id: string;
  label: string;
  icon: string;
  gradientColors: [string, string, string, string]; // 4 stops
  textColor: string;
  priceColor: string;
  ctaBg: string;
  ctaText: string;
  badgeBg: string;
  badgeText: string;
  headlineColor: string;
}

const templateStyles: TemplateStyle[] = [
  {
    id: "elegant_dark",
    label: "Elegante Escuro",
    icon: "🖤",
    gradientColors: ["rgba(10,10,20,0)", "rgba(10,10,20,0.55)", "rgba(10,10,20,0.8)", "rgba(10,10,20,0.95)"],
    textColor: "#ffffff",
    priceColor: "#f9a8d4",
    ctaBg: "#ec4899",
    ctaText: "#ffffff",
    badgeBg: "rgba(255,255,255,0.15)",
    badgeText: "#ffffff",
    headlineColor: "rgba(255,255,255,0.75)",
  },
  {
    id: "clean_light",
    label: "Clean Claro",
    icon: "✨",
    gradientColors: ["rgba(255,255,255,0)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0.9)", "rgba(255,255,255,0.98)"],
    textColor: "#111827",
    priceColor: "#7c3aed",
    ctaBg: "#111827",
    ctaText: "#ffffff",
    badgeBg: "rgba(124,58,237,0.1)",
    badgeText: "#7c3aed",
    headlineColor: "rgba(17,24,39,0.7)",
  },
  {
    id: "vibrant_pink",
    label: "Rosa Vibrante",
    icon: "💖",
    gradientColors: ["rgba(157,23,77,0)", "rgba(157,23,77,0.5)", "rgba(157,23,77,0.85)", "rgba(157,23,77,0.95)"],
    textColor: "#ffffff",
    priceColor: "#fce7f3",
    ctaBg: "#ffffff",
    ctaText: "#9d174d",
    badgeBg: "rgba(255,255,255,0.2)",
    badgeText: "#ffffff",
    headlineColor: "rgba(255,255,255,0.8)",
  },
  {
    id: "golden_luxury",
    label: "Gold Luxo",
    icon: "👑",
    gradientColors: ["rgba(20,15,5,0)", "rgba(20,15,5,0.5)", "rgba(20,15,5,0.8)", "rgba(20,15,5,0.95)"],
    textColor: "#fef3c7",
    priceColor: "#fbbf24",
    ctaBg: "#d4a574",
    ctaText: "#1a1a1a",
    badgeBg: "rgba(212,165,116,0.2)",
    badgeText: "#fbbf24",
    headlineColor: "rgba(254,243,199,0.7)",
  },
];

/* ═══════════════════════════════════════
   Element positions state
   ═══════════════════════════════════════ */
interface ElementPos {
  x: number;
  y: number;
}

interface ElementPositions {
  badge: ElementPos;
  productName: ElementPos;
  headline: ElementPos;
  price: ElementPos;
  cta: ElementPos;
  score: ElementPos;
  watermark: ElementPos;
}

/* ═══════════════════════════════════════
   Canvas dimensions
   ═══════════════════════════════════════ */
const CANVAS_W = 1080;
const FEED_H = 1350;
const STORY_H = 1920;
const PREVIEW_SCALE = 0.42;

function getDefaultPositions(h: number): ElementPositions {
  return {
    badge: { x: CANVAS_W / 2, y: 52 },
    productName: { x: CANVAS_W / 2, y: h - 280 },
    headline: { x: CANVAS_W / 2, y: h - 220 },
    price: { x: CANVAS_W / 2, y: h - 155 },
    cta: { x: CANVAS_W / 2, y: h - 90 },
    score: { x: CANVAS_W - 70, y: h - 40 },
    watermark: { x: CANVAS_W / 2, y: h - 22 },
  };
}

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
  const stageRef = useRef<Konva.Stage>(null);
  const [activeTemplate, setActiveTemplate] = useState("elegant_dark");
  const [downloading, setDownloading] = useState(false);
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const CANVAS_H = format === "story" ? STORY_H : FEED_H;
  const [positions, setPositions] = useState<ElementPositions>(() => getDefaultPositions(CANVAS_H));

  const t = templateStyles.find((s) => s.id === activeTemplate) || templateStyles[0];
  const displayPrice = price.includes("R$") ? price : `R$ ${price}`;
  const imageUrl = modelImageUrl || productImageUrl;

  // Load image
  useEffect(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLoadedImg(img);
    img.onerror = () => setLoadedImg(null);
    img.src = imageUrl;
  }, [imageUrl]);

  // Reset positions on format change
  useEffect(() => {
    setPositions(getDefaultPositions(CANVAS_H));
  }, [CANVAS_H]);

  // Image crop helpers (object-fit: cover)
  const getCropConfig = useCallback(() => {
    if (!loadedImg) return null;
    const imgRatio = loadedImg.width / loadedImg.height;
    const canvasRatio = CANVAS_W / CANVAS_H;
    let cropX = 0, cropY = 0, cropW = loadedImg.width, cropH = loadedImg.height;

    if (imgRatio > canvasRatio) {
      cropW = loadedImg.height * canvasRatio;
      cropX = (loadedImg.width - cropW) / 2;
    } else {
      cropH = loadedImg.width / canvasRatio;
      cropY = (loadedImg.height - cropH) / 2;
    }
    return { cropX, cropY, cropW, cropH };
  }, [loadedImg, CANVAS_H]);

  // Handle drag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = (key: keyof ElementPositions, e: any) => {
    const node = e.target;
    setPositions((prev) => ({
      ...prev,
      [key]: { x: node.x(), y: node.y() },
    }));
  };

  // Deselect on stage click
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStageClick = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  // Reset positions
  const handleReset = () => {
    setPositions(getDefaultPositions(CANVAS_H));
    setSelectedId(null);
  };

  // Download full-res
  const handleDownload = useCallback(() => {
    if (!stageRef.current) return;
    setDownloading(true);
    setSelectedId(null); // remove selection highlight

    setTimeout(() => {
      try {
        const stage = stageRef.current!;
        const oldScale = { x: stage.scaleX(), y: stage.scaleY() };
        const oldSize = { w: stage.width(), h: stage.height() };

        // Scale to full res
        stage.scale({ x: 1 / PREVIEW_SCALE, y: 1 / PREVIEW_SCALE });
        stage.width(CANVAS_W);
        stage.height(CANVAS_H);

        const uri = stage.toDataURL({ pixelRatio: 1, mimeType: "image/png" });

        // Restore preview size
        stage.scale(oldScale);
        stage.width(oldSize.w);
        stage.height(oldSize.h);
        stage.batchDraw();

        const link = document.createElement("a");
        const safeName = productName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        link.download = `crialook-${safeName}-${activeTemplate}.png`;
        link.href = uri;
        link.click();
      } catch (err) {
        console.error("Download error:", err);
      } finally {
        setDownloading(false);
      }
    }, 100);
  }, [productName, activeTemplate, CANVAS_H]);

  // Scale coords for preview
  const S = PREVIEW_SCALE;
  const crop = getCropConfig();

  // Gradient overlay canvas
  const [gradientImg, setGradientImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const overlayH = CANVAS_H * 0.55;
    const grd = ctx.createLinearGradient(0, CANVAS_H - overlayH, 0, CANVAS_H);
    const colors = t.gradientColors;
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(0.3, colors[1]);
    grd.addColorStop(0.6, colors[2]);
    grd.addColorStop(1, colors[3]);

    ctx.fillStyle = grd;
    ctx.fillRect(0, CANVAS_H - overlayH, CANVAS_W, overlayH);

    const img = new window.Image();
    img.src = canvas.toDataURL();
    img.onload = () => setGradientImg(img);
  }, [t, CANVAS_H]);

  // Drag style
  const getDragStyle = (key: string) => ({
    shadowColor: selectedId === key ? "#ec4899" : "transparent",
    shadowBlur: selectedId === key ? 12 : 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  });

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
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
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
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#fef3c7", color: "#92400e" }}
            >
              ✋ Arraste os textos
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
              style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}
            >
              ↩ Resetar
            </button>
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
                  Baixar PNG 1080px
                </>
              )}
            </button>
          </div>
        </div>

        {/* Konva Stage */}
        <div
          className="flex items-center justify-center p-4"
          style={{ background: "var(--surface)", cursor: selectedId ? "move" : "default" }}
        >
          <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
            <Stage
              ref={stageRef}
              width={CANVAS_W * S}
              height={CANVAS_H * S}
              scaleX={S}
              scaleY={S}
              onClick={handleStageClick}
              onTap={handleStageClick}
            >
              <Layer>
                {/* ── 1. Background ── */}
                <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#f5f5f5" />

                {/* ── 2. Model image (cover) ── */}
                {loadedImg && crop && (
                  <KImage
                    image={loadedImg}
                    x={0}
                    y={0}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropW, height: crop.cropH }}
                  />
                )}

                {/* ── 3. Gradient overlay ── */}
                {gradientImg && (
                  <KImage image={gradientImg} x={0} y={0} width={CANVAS_W} height={CANVAS_H} listening={false} />
                )}

                {/* ── 4. Store badge (draggable) ── */}
                <Group
                  x={positions.badge.x}
                  y={positions.badge.y}
                  draggable
                  onDragEnd={(e) => handleDragEnd("badge", e)}
                  onClick={() => setSelectedId("badge")}
                  onTap={() => setSelectedId("badge")}
                  {...getDragStyle("badge")}
                >
                  <Rect
                    offsetX={80}
                    offsetY={16}
                    width={160}
                    height={32}
                    fill={t.badgeBg}
                    cornerRadius={16}
                  />
                  <Text
                    text={`✨ ${storeName}`}
                    fontSize={20}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="600"
                    fill={t.badgeText}
                    align="center"
                    width={160}
                    offsetX={80}
                    offsetY={10}
                  />
                </Group>

                {/* ── 5. Product name (draggable) ── */}
                <Text
                  x={positions.productName.x}
                  y={positions.productName.y}
                  text={productName}
                  fontSize={productName.length > 25 ? 36 : productName.length > 15 ? 44 : 52}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontStyle="800"
                  fill={t.textColor}
                  align="center"
                  width={CANVAS_W - 100}
                  offsetX={(CANVAS_W - 100) / 2}
                  draggable
                  onDragEnd={(e) => handleDragEnd("productName", e)}
                  onClick={() => setSelectedId("productName")}
                  onTap={() => setSelectedId("productName")}
                  {...getDragStyle("productName")}
                />

                {/* ── 6. Headline (draggable) ── */}
                {headline && (
                  <Text
                    x={positions.headline.x}
                    y={positions.headline.y}
                    text={headline.length > 50 ? headline.slice(0, 50) + "…" : headline}
                    fontSize={24}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="500"
                    fill={t.headlineColor}
                    align="center"
                    width={CANVAS_W - 120}
                    offsetX={(CANVAS_W - 120) / 2}
                    draggable
                    onDragEnd={(e) => handleDragEnd("headline", e)}
                    onClick={() => setSelectedId("headline")}
                    onTap={() => setSelectedId("headline")}
                    {...getDragStyle("headline")}
                  />
                )}

                {/* ── 7. Price (draggable) ── */}
                <Text
                  x={positions.price.x}
                  y={positions.price.y}
                  text={displayPrice}
                  fontSize={64}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontStyle="900"
                  fill={t.priceColor}
                  align="center"
                  width={500}
                  offsetX={250}
                  draggable
                  onDragEnd={(e) => handleDragEnd("price", e)}
                  onClick={() => setSelectedId("price")}
                  onTap={() => setSelectedId("price")}
                  {...getDragStyle("price")}
                />

                {/* ── 8. CTA Button (draggable) ── */}
                <Group
                  x={positions.cta.x}
                  y={positions.cta.y}
                  draggable
                  onDragEnd={(e) => handleDragEnd("cta", e)}
                  onClick={() => setSelectedId("cta")}
                  onTap={() => setSelectedId("cta")}
                  {...getDragStyle("cta")}
                >
                  <Rect
                    offsetX={130}
                    offsetY={25}
                    width={260}
                    height={50}
                    fill={t.ctaBg}
                    cornerRadius={25}
                    shadowColor={`${t.ctaBg}80`}
                    shadowBlur={16}
                    shadowOffsetY={6}
                  />
                  <Text
                    text={`${cta} 💕`}
                    fontSize={24}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="bold"
                    fill={t.ctaText}
                    align="center"
                    width={260}
                    offsetX={130}
                    offsetY={12}
                  />
                </Group>

                {/* ── 9. Score badge (draggable) ── */}
                {score && score > 0 && (
                  <Group
                    x={positions.score.x}
                    y={positions.score.y}
                    draggable
                    onDragEnd={(e) => handleDragEnd("score", e)}
                    onClick={() => setSelectedId("score")}
                    onTap={() => setSelectedId("score")}
                    {...getDragStyle("score")}
                  >
                    <Rect
                      offsetX={48}
                      offsetY={13}
                      width={96}
                      height={26}
                      fill="rgba(0,0,0,0.3)"
                      cornerRadius={13}
                    />
                    <Text
                      text={`⭐ ${score}/100`}
                      fontSize={16}
                      fontFamily="system-ui, sans-serif"
                      fontStyle="600"
                      fill="rgba(255,255,255,0.9)"
                      align="center"
                      width={96}
                      offsetX={48}
                      offsetY={8}
                    />
                  </Group>
                )}

                {/* ── 10. Watermark (draggable) ── */}
                <Text
                  x={positions.watermark.x}
                  y={positions.watermark.y}
                  text="Feito com CriaLook"
                  fontSize={16}
                  fontFamily="system-ui, sans-serif"
                  fontStyle="500"
                  fill={t.textColor}
                  opacity={0.3}
                  align="center"
                  width={200}
                  offsetX={100}
                  draggable
                  onDragEnd={(e) => handleDragEnd("watermark", e)}
                  onClick={() => setSelectedId("watermark")}
                  onTap={() => setSelectedId("watermark")}
                  {...getDragStyle("watermark")}
                />
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Help footer */}
        <div
          className="px-4 py-2 text-center text-[11px]"
          style={{ background: "var(--background)", borderTop: "1px solid var(--border)", color: "var(--muted)" }}
        >
          ✋ Clique e arraste qualquer texto para reposicionar · Clique em &quot;Resetar&quot; para voltar ao layout padrão
        </div>
      </div>
    </div>
  );
}
