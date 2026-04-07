"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { Stage, Layer, Image as KImage, Text, Rect, Group, Transformer, Circle } from "react-konva";
import Konva from "konva";
import type { TemplateStyle } from "./types";
import { CANVAS_W, STORY_H, truncateText, formatPrice } from "./constants";
import { useImageLoader } from "./hooks/useImageLoader";
import { useGradientOverlay } from "./hooks/useGradientOverlay";
import type { FontSizes } from "./hooks/useDragPositions";

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */
export type SlideType = "gancho" | "produto" | "cta";

interface StoryElementPos {
  x: number;
  y: number;
}

export interface StoryPositions {
  [key: string]: StoryElementPos;
}

interface KonvaStorySlideProps {
  stageRef?: React.RefObject<Konva.Stage | null>;
  slideType: SlideType;
  template: TemplateStyle;
  previewScale: number;

  /* Content */
  productName: string;
  price: string;
  storeName: string;
  slideText: string;          // Main text for this slide
  productImageUrl?: string | null;
  modelImageUrl?: string | null;   // VTO model image (priority over product)

  /* Interactivity */
  positions: StoryPositions;
  fontSizes: FontSizes;
  selectedId: string | null;
  hiddenElements: Set<string>;
  onDragEnd: (key: string, x: number, y: number) => void;
  onSelect: (key: string) => void;
  onDeselect: () => void;
  onFontSizeChange?: (key: string, size: number) => void;
  onToggleVisibility?: (key: string) => void;
}

/* ═══════════════════════════════════════
   Default positions per slide type
   ═══════════════════════════════════════ */
export function getStoryDefaults(slideType: SlideType): StoryPositions {
  const cx = CANVAS_W / 2;
  switch (slideType) {
    case "gancho":
      return {
        storeBadge:  { x: cx, y: 100 },
        mainText:    { x: cx, y: STORY_H / 2 },
        swipeHint:   { x: cx, y: STORY_H - 180 },
      };
    case "produto":
      return {
        storeBadge:    { x: cx, y: 100 },
        productImage:  { x: cx, y: 460 },
        productText:   { x: cx, y: 1120 },
        priceBadge:    { x: cx, y: 1320 },
      };
    case "cta":
      return {
        ctaText:     { x: cx, y: 700 },
        ctaButton:   { x: cx, y: 960 },
        storeName:   { x: cx, y: STORY_H - 320 },
        watermark:   { x: cx, y: STORY_H - 130 },
      };
  }
}

/* ═══════════════════════════════════════
   P2-6: DraggableGroup — reuses pattern from DraggableElement
   P1-2: Uses border stroke instead of expensive shadow for selection
   ═══════════════════════════════════════ */
function DraggableGroup({
  id,
  pos,
  isSelected,
  onDragEnd,
  onSelect,
  groupRef,
  children,
}: {
  id: string;
  pos: StoryElementPos;
  isSelected: boolean;
  onDragEnd: (key: string, x: number, y: number) => void;
  onSelect: (key: string) => void;
  groupRef?: (node: Konva.Group | null) => void;
  children: React.ReactNode;
}) {
  return (
    <Group
      ref={groupRef}
      x={pos.x}
      y={pos.y}
      draggable
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      onDragEnd={(e) => onDragEnd(id, e.target.x(), e.target.y())}
      // P1-2: Removed shadow-based selection indicator — Transformer handles visual feedback.
      // Shadows cause double-render internally and are 4× slower than stroke.
      dragBoundFunc={(p) => ({
        x: Math.max(40, Math.min(p.x, CANVAS_W - 40)),
        y: Math.max(40, Math.min(p.y, STORY_H - 40)),
      })}
    >
      {children}
    </Group>
  );
}

/* ═══════════════════════════════════════
   KonvaStorySlide — Main Component
   ═══════════════════════════════════════ */
export default function KonvaStorySlide({
  stageRef: externalRef,
  slideType,
  template: t,
  previewScale: S,
  productName,
  price,
  storeName,
  slideText,
  productImageUrl,
  modelImageUrl,
  positions,
  fontSizes,
  selectedId,
  hiddenElements,
  onDragEnd,
  onSelect,
  onDeselect,
  onFontSizeChange,
  onToggleVisibility,
}: KonvaStorySlideProps) {
  const internalRef = useRef<Konva.Stage>(null);
  const stageRef = externalRef || internalRef;
  const textTransformerRef = useRef<Konva.Transformer>(null);
  const textGroupRefs = useRef<Map<string, Konva.Group>>(new Map());
  // P1-1: Refs for caching static elements
  const modelImgRef = useRef<Konva.Image>(null);
  const gradientRef = useRef<Konva.Image>(null);
  // P3-2: Font loading check
  const fontLoadedRef = useRef(false);

  // Prefer VTO model image, fallback to product image
  const bgImageSrc = slideType === "produto" ? (modelImageUrl || productImageUrl || null) : null;
  const { loadedImg } = useImageLoader(bgImageSrc);
  const gradientImg = useGradientOverlay(t, STORY_H);

  const hasPrice = price && price.trim().length > 0;
  const displayPrice = hasPrice ? formatPrice(price) : "";
  const textW = CANVAS_W - 160;

  // P3-2: Ensure fonts are loaded before drawing (mirrors KonvaCanvas pattern)
  useEffect(() => {
    if (fontLoadedRef.current) return;
    document.fonts.ready.then(() => {
      fontLoadedRef.current = true;
      stageRef.current?.batchDraw();
    });
  }, [stageRef]);

  // P1-1: Cache model image — doesn't change during interactions
  useEffect(() => {
    if (modelImgRef.current && loadedImg) {
      try {
        modelImgRef.current.cache();
        modelImgRef.current.getLayer()?.batchDraw();
      } catch { /* cache may fail on cross-origin without proper CORS */ }
    }
  }, [loadedImg]);

  // P1-1: Cache gradient overlay — only changes when template switches
  useEffect(() => {
    if (gradientRef.current && gradientImg) {
      try {
        gradientRef.current.cache();
        gradientRef.current.getLayer()?.batchDraw();
      } catch { /* safe fallback */ }
    }
  }, [gradientImg]);

  // Font size helper
  const getFontSize = useCallback(
    (key: string, fallback: number) => (fontSizes as Record<string, number>)[key] ?? fallback,
    [fontSizes]
  );

  // Attach Transformer to selected
  useEffect(() => {
    const tr = textTransformerRef.current;
    if (!tr) return;
    if (selectedId && textGroupRefs.current.has(selectedId)) {
      tr.nodes([textGroupRefs.current.get(selectedId)!]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  // Stage click deselect
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage()) onDeselect();
    },
    [onDeselect]
  );

  // P2-4: Stable ref setter using useMemo to avoid creating new functions per render
  const refSetters = useMemo(() => {
    const keys = [
      "storeBadge", "mainText", "swipeHint",
      "productImage", "productText", "priceBadge",
      "ctaText", "ctaButton", "storeName", "watermark",
    ];
    const map: Record<string, (node: Konva.Group | null) => void> = {};
    for (const key of keys) {
      map[key] = (node: Konva.Group | null) => {
        if (node) textGroupRefs.current.set(key, node);
        else textGroupRefs.current.delete(key);
      };
    }
    return map;
  }, []);

  // Computed text sizes for gancho
  const ganchoFontBase = slideText.length > 60 ? 52 : slideText.length > 35 ? 64 : 80;
  const produtoFontBase = slideText.length > 60 ? 32 : 40;

  /* ═══════════════════════════════════════
     Product image crop
     ═══════════════════════════════════════ */
  const imgCrop = useMemo(() => {
    if (!loadedImg) return null;
    const nat = loadedImg.naturalWidth / loadedImg.naturalHeight;
    const target = 720 / 800; // product image area ratio
    let cropX = 0, cropY = 0, cropW = loadedImg.naturalWidth, cropH = loadedImg.naturalHeight;
    if (nat > target) {
      cropW = loadedImg.naturalHeight * target;
      cropX = (loadedImg.naturalWidth - cropW) / 2;
    } else {
      cropH = loadedImg.naturalWidth / target;
      cropY = (loadedImg.naturalHeight - cropH) / 2;
    }
    return { cropX, cropY, cropW, cropH };
  }, [loadedImg]);

  const isVisible = (key: string) => !hiddenElements.has(key);

  // P3-1: Handle transform end — reset scale to width/height (prevents distortion)
  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      // Reset scale to 1 — the visual resize is baked into the node dimensions
      node.scaleX(1);
      node.scaleY(1);
      // If this is a text group and font scaling is desired, propagate scale
      // to fontSize via the callback (matches KonvaCanvas pattern)
      if (onFontSizeChange && scaleY !== 1) {
        const parent = node.parent;
        const id = parent?.name?.() || node.name?.();
        if (id) {
          const currentSize = getFontSize(id, 40);
          const newSize = Math.round(currentSize * Math.max(scaleX, scaleY));
          onFontSizeChange(id, Math.max(12, Math.min(200, newSize)));
        }
      }
    },
    [onFontSizeChange, getFontSize]
  );

  return (
    <div
      style={{ borderRadius: 12, overflow: "hidden", touchAction: "none" }}
    >
      <Stage
        ref={stageRef}
        width={CANVAS_W * S}
        height={STORY_H * S}
        scaleX={S}
        scaleY={S}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        {/* ═══ Background Layer ═══ */}
        <Layer listening={false}>
          <Rect x={0} y={0} width={CANVAS_W} height={STORY_H} fill="#f5f5f5" />

          {/* Slide "produto" — product image as background */}
          {slideType === "produto" && loadedImg && imgCrop && (
            <KImage
              ref={modelImgRef}
              image={loadedImg}
              x={0}
              y={0}
              width={CANVAS_W}
              height={STORY_H}
              crop={{ x: imgCrop.cropX, y: imgCrop.cropY, width: imgCrop.cropW, height: imgCrop.cropH }}
            />
          )}

          {/* Gradient overlay — P1-1: cached for performance */}
          {gradientImg && t.hasGradient && (
            <KImage ref={gradientRef} image={gradientImg} x={0} y={0} width={CANVAS_W} height={STORY_H} />
          )}

          {/* Solid overlay for gancho / cta when no image */}
          {(slideType === "gancho" || slideType === "cta") && (
            <Rect
              x={0}
              y={0}
              width={CANVAS_W}
              height={STORY_H}
              fill={t.id.includes("dark") || t.id.includes("elegant") ? "#0f0f1a" : "#fdf2f8"}
              opacity={0.95}
            />
          )}

          {/* Decorative circles */}
          <Circle
            x={-40}
            y={-40}
            radius={180}
            fill={t.ctaBg}
            opacity={0.06}
          />
          <Circle
            x={CANVAS_W + 40}
            y={STORY_H + 40}
            radius={220}
            fill={t.ctaBg}
            opacity={0.04}
          />
        </Layer>

        {/* ═══ Interactive Layer ═══ */}
        <Layer>
          {/* ═══ GANCHO SLIDE ═══ */}
          {slideType === "gancho" && (
            <>
              {/* Store badge */}
              {isVisible("storeBadge") && positions.storeBadge && (
                <DraggableGroup
                  id="storeBadge"
                  pos={positions.storeBadge}
                  isSelected={selectedId === "storeBadge"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.storeBadge}
                >
                  <Rect
                    offsetX={220 / 2}
                    offsetY={22}
                    width={220}
                    height={44}
                    fill={t.badgeBg}
                    cornerRadius={22}
                  />
                  <Text
                    text={`✨ ${storeName}`}
                    fontSize={getFontSize("storeBadge", 28)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="700"
                    fill={t.badgeText}
                    align="center"
                    width={220}
                    offsetX={110}
                    offsetY={14}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* Main gancho text */}
              {isVisible("mainText") && positions.mainText && (
                <DraggableGroup
                  id="mainText"
                  pos={positions.mainText}
                  isSelected={selectedId === "mainText"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.mainText}
                >
                  <Text
                    text={truncateText(slideText, 80)}
                    fontSize={getFontSize("mainText", ganchoFontBase)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="900"
                    fill={t.textColor}
                    align="center"
                    width={textW}
                    offsetX={textW / 2}
                    lineHeight={1.2}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* Swipe hint */}
              {isVisible("swipeHint") && positions.swipeHint && (
                <DraggableGroup
                  id="swipeHint"
                  pos={positions.swipeHint}
                  isSelected={selectedId === "swipeHint"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.swipeHint}
                >
                  <Text
                    text="▲"
                    fontSize={getFontSize("swipeHint", 48)}
                    fill={t.ctaBg}
                    align="center"
                    width={100}
                    offsetX={50}
                    offsetY={30}
                    perfectDrawEnabled={false}
                  />
                  <Text
                    text="ARRASTE"
                    fontSize={20}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="600"
                    fill={t.textColor}
                    opacity={0.4}
                    align="center"
                    letterSpacing={3}
                    width={200}
                    offsetX={100}
                    offsetY={-10}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}
            </>
          )}

          {/* ═══ PRODUTO SLIDE ═══ */}
          {slideType === "produto" && (
            <>
              {/* Store badge */}
              {isVisible("storeBadge") && positions.storeBadge && (
                <DraggableGroup
                  id="storeBadge"
                  pos={positions.storeBadge}
                  isSelected={selectedId === "storeBadge"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.storeBadge}
                >
                  <Rect
                    offsetX={200 / 2}
                    offsetY={18}
                    width={200}
                    height={36}
                    fill={t.badgeBg}
                    cornerRadius={18}
                  />
                  <Text
                    text={storeName}
                    fontSize={getFontSize("storeBadge", 24)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="700"
                    fill={t.badgeText}
                    align="center"
                    width={200}
                    offsetX={100}
                    offsetY={12}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* Product image placeholder */}
              {isVisible("productImage") && positions.productImage && !loadedImg && (
                <DraggableGroup
                  id="productImage"
                  pos={positions.productImage}
                  isSelected={selectedId === "productImage"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.productImage}
                >
                  <Rect
                    offsetX={360}
                    offsetY={400}
                    width={720}
                    height={800}
                    fill={`${t.ctaBg}10`}
                    cornerRadius={28}
                    stroke={`${t.ctaBg}30`}
                    strokeWidth={3}
                    dash={[10, 6]}
                  />
                  <Text
                    text="👗"
                    fontSize={120}
                    align="center"
                    width={720}
                    offsetX={360}
                    offsetY={60}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* Product description */}
              {isVisible("productText") && positions.productText && (
                <DraggableGroup
                  id="productText"
                  pos={positions.productText}
                  isSelected={selectedId === "productText"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.productText}
                >
                  <Text
                    text={truncateText(slideText, 80)}
                    fontSize={getFontSize("productText", produtoFontBase)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="600"
                    fill={t.textColor}
                    align="center"
                    width={textW}
                    offsetX={textW / 2}
                    lineHeight={1.3}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* Price badge */}
              {hasPrice && isVisible("priceBadge") && positions.priceBadge && (
                <DraggableGroup
                  id="priceBadge"
                  pos={positions.priceBadge}
                  isSelected={selectedId === "priceBadge"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.priceBadge}
                >
                  <Rect
                    offsetX={200}
                    offsetY={45}
                    width={400}
                    height={90}
                    fill={t.badgeBg}
                    cornerRadius={24}
                  />
                  <Text
                    text={displayPrice}
                    fontSize={getFontSize("priceBadge", 72)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="900"
                    fill={t.priceColor}
                    align="center"
                    width={400}
                    offsetX={200}
                    offsetY={36}
                    letterSpacing={-1}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}
            </>
          )}

          {/* ═══ CTA SLIDE ═══ */}
          {slideType === "cta" && (
            <>
              {/* CTA heading text */}
              {isVisible("ctaText") && positions.ctaText && (
                <DraggableGroup
                  id="ctaText"
                  pos={positions.ctaText}
                  isSelected={selectedId === "ctaText"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.ctaText}
                >
                  <Text
                    text={truncateText(slideText, 50)}
                    fontSize={getFontSize("ctaText", slideText.length > 30 ? 56 : 72)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="900"
                    fill={t.textColor}
                    align="center"
                    width={textW}
                    offsetX={textW / 2}
                    lineHeight={1.2}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* CTA button — P1-4: shadowForStrokeEnabled=false for performance */}
              {isVisible("ctaButton") && positions.ctaButton && (
                <DraggableGroup
                  id="ctaButton"
                  pos={positions.ctaButton}
                  isSelected={selectedId === "ctaButton"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.ctaButton}
                >
                  <Rect
                    offsetX={220}
                    offsetY={36}
                    width={440}
                    height={72}
                    fill={t.ctaBg}
                    cornerRadius={36}
                    shadowColor={`${t.ctaBg}80`}
                    shadowBlur={20}
                    shadowOffsetY={8}
                    shadowForStrokeEnabled={false}
                  />
                  <Text
                    text="Manda no WhatsApp 💬"
                    fontSize={getFontSize("ctaButton", 34)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="bold"
                    fill={t.ctaText}
                    align="center"
                    width={440}
                    offsetX={220}
                    offsetY={17}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* Store name */}
              {isVisible("storeName") && positions.storeName && (
                <DraggableGroup
                  id="storeName"
                  pos={positions.storeName}
                  isSelected={selectedId === "storeName"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.storeName}
                >
                  <Text
                    text={storeName}
                    fontSize={getFontSize("storeName", 48)}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="800"
                    fill={t.textColor}
                    align="center"
                    width={600}
                    offsetX={300}
                    opacity={0.8}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}

              {/* Watermark */}
              {isVisible("watermark") && positions.watermark && (
                <DraggableGroup
                  id="watermark"
                  pos={positions.watermark}
                  isSelected={selectedId === "watermark"}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  groupRef={refSetters.watermark}
                >
                  <Text
                    text="Feito com CriaLook"
                    fontSize={getFontSize("watermark", 22)}
                    fontFamily="system-ui, sans-serif"
                    fontStyle="500"
                    fill={t.textColor}
                    opacity={0.3}
                    align="center"
                    width={300}
                    offsetX={150}
                    perfectDrawEnabled={false}
                  />
                </DraggableGroup>
              )}
            </>
          )}

          {/* Text Transformer — P3-1: onTransformEnd resets scale to prevent distortion */}
          <Transformer
            ref={textTransformerRef}
            anchorSize={14}
            anchorStroke="#8b5cf6"
            anchorFill="#fff"
            borderStroke="#8b5cf6"
            borderDash={[4, 3]}
            rotateEnabled={false}
            enabledAnchors={[
              "top-left", "top-center", "top-right",
              "middle-left", "middle-right",
              "bottom-left", "bottom-center", "bottom-right",
            ]}
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 12) return oldBox;
              return newBox;
            }}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>
    </div>
  );
}
