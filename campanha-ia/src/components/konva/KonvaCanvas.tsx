"use client";

import { useMemo, useCallback, useEffect, useRef } from "react";
import { Stage, Layer, Image as KImage, Text, Rect } from "react-konva";
import Konva from "konva";
import type {
  TemplateStyle,
  ElementPositions,
  ElementKey,
  KonvaDragEvent,
  CropConfig,
} from "./types";
import DraggableElement from "./DraggableElement";
import { CANVAS_W, LAYOUT, truncateText, formatPrice } from "./constants";

interface KonvaCanvasProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  canvasH: number;
  previewScale: number;
  template: TemplateStyle;
  loadedImg: HTMLImageElement | null;
  imgError: boolean;
  imgLoading: boolean;
  gradientImg: HTMLImageElement | null;
  positions: ElementPositions;
  selectedId: string | null;
  productName: string;
  price: string;
  headline?: string;
  cta: string;
  storeName: string;
  score?: number;
  modelImageUrl: string | null;
  onDragEnd: (key: ElementKey, e: KonvaDragEvent) => void;
  onSelect: (key: ElementKey) => void;
  onDeselect: () => void;
}

/**
 * Pure rendering component — draws the Konva Stage with all visual layers.
 * Contains zero state management; everything comes from props.
 */
export default function KonvaCanvas({
  stageRef,
  canvasH,
  previewScale,
  template: t,
  loadedImg,
  imgError,
  imgLoading,
  gradientImg,
  positions,
  selectedId,
  productName,
  price,
  headline,
  cta,
  storeName,
  score,
  modelImageUrl,
  onDragEnd,
  onSelect,
  onDeselect,
}: KonvaCanvasProps) {
  const fontLoadedRef = useRef(false);

  // Ensure fonts are loaded before drawing
  useEffect(() => {
    if (fontLoadedRef.current) return;
    document.fonts.ready.then(() => {
      fontLoadedRef.current = true;
      stageRef.current?.batchDraw();
    });
  }, [stageRef]);

  const displayPrice = useMemo(() => formatPrice(price), [price]);
  const S = previewScale;

  // Image crop (object-fit: cover)
  const crop: CropConfig | null = useMemo(() => {
    if (!loadedImg) return null;
    const imgRatio = loadedImg.width / loadedImg.height;
    const canvasRatio = CANVAS_W / canvasH;
    let cropX = 0,
      cropY = 0,
      cropW = loadedImg.width,
      cropH = loadedImg.height;

    if (imgRatio > canvasRatio) {
      cropW = loadedImg.height * canvasRatio;
      cropX = (loadedImg.width - cropW) / 2;
    } else {
      cropH = loadedImg.width / canvasRatio;
      cropY = (loadedImg.height - cropH) / 2;
    }
    return { cropX, cropY, cropW, cropH };
  }, [loadedImg, canvasH]);

  // Dynamic badge width based on storeName length
  const badgeWidth = useMemo(
    () => Math.max(LAYOUT.BADGE_WIDTH, storeName.length * 14 + 50),
    [storeName]
  );

  // Dynamic price width
  const priceWidth = useMemo(
    () => Math.min(CANVAS_W - LAYOUT.TEXT_PADDING, Math.max(300, displayPrice.length * 60)),
    [displayPrice]
  );

  // Product name font size
  const productFontSize = useMemo(() => {
    if (productName.length > 25) return 36;
    if (productName.length > 15) return 44;
    return 52;
  }, [productName]);

  // Stage click handler (deselect)
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage()) {
        onDeselect();
      }
    },
    [onDeselect]
  );

  // Keyboard navigation for dragged elements
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onDeselect();
      }
    },
    [onDeselect]
  );

  const textW = CANVAS_W - LAYOUT.TEXT_PADDING;
  const headlineW = CANVAS_W - LAYOUT.HEADLINE_PADDING;

  return (
    <div
      role="img"
      aria-label={`Criativo de moda: ${productName} por ${displayPrice}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: "none" }}
    >
      {/* Loading skeleton */}
      {imgLoading && modelImageUrl && (
        <div
          className="animate-pulse"
          style={{
            width: CANVAS_W * S,
            height: canvasH * S,
            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
            backgroundSize: "200% 100%",
            borderRadius: 12,
          }}
        />
      )}

      {/* Error state */}
      {imgError && (
        <div
          style={{
            width: CANVAS_W * S,
            height: canvasH * S,
            background: "#fef2f2",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 32 }}>⚠️</span>
          <span style={{ fontSize: 13, color: "#991b1b" }}>Não foi possível carregar a imagem</span>
        </div>
      )}

      {/* Canvas */}
      {!imgLoading && (
        <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
          <Stage
            ref={stageRef}
            width={CANVAS_W * S}
            height={canvasH * S}
            scaleX={S}
            scaleY={S}
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            <Layer>
              {/* 1. Background */}
              <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#f5f5f5" />

              {/* 2. Model image (cover) */}
              {loadedImg && crop && (
                <KImage
                  image={loadedImg}
                  x={0}
                  y={0}
                  width={CANVAS_W}
                  height={canvasH}
                  crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropW, height: crop.cropH }}
                />
              )}

              {/* 3. Gradient overlay */}
              {gradientImg && t.hasGradient && (
                <KImage image={gradientImg} x={0} y={0} width={CANVAS_W} height={canvasH} listening={false} />
              )}

              {/* 4. Store badge */}
              <DraggableElement
                elementKey="badge"
                positions={positions}
                onDragEnd={onDragEnd}
                onSelect={onSelect}
                selectedId={selectedId}
              >
                <Rect
                  offsetX={badgeWidth / 2}
                  offsetY={LAYOUT.BADGE_HEIGHT / 2}
                  width={badgeWidth}
                  height={LAYOUT.BADGE_HEIGHT}
                  fill={t.badgeBg}
                  cornerRadius={LAYOUT.BADGE_RADIUS}
                />
                <Text
                  text={`✨ ${storeName}`}
                  fontSize={20}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontStyle="600"
                  fill={t.badgeText}
                  align="center"
                  width={badgeWidth}
                  offsetX={badgeWidth / 2}
                  offsetY={10}
                />
              </DraggableElement>

              {/* 5. Product name */}
              <DraggableElement
                elementKey="productName"
                positions={positions}
                onDragEnd={onDragEnd}
                onSelect={onSelect}
                selectedId={selectedId}
              >
                <Text
                  text={productName}
                  fontSize={productFontSize}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontStyle="800"
                  fill={t.textColor}
                  align="center"
                  width={textW}
                  offsetX={textW / 2}
                />
              </DraggableElement>

              {/* 6. Headline */}
              {headline && (
                <DraggableElement
                  elementKey="headline"
                  positions={positions}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  selectedId={selectedId}
                >
                  <Text
                    text={truncateText(headline, 55)}
                    fontSize={26}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontStyle="500"
                    fill={t.headlineColor}
                    align="center"
                    width={headlineW}
                    offsetX={headlineW / 2}
                  />
                </DraggableElement>
              )}

              {/* 7. Price */}
              <DraggableElement
                elementKey="price"
                positions={positions}
                onDragEnd={onDragEnd}
                onSelect={onSelect}
                selectedId={selectedId}
              >
                <Text
                  text={displayPrice}
                  fontSize={68}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontStyle="900"
                  fill={t.priceColor}
                  align="center"
                  width={priceWidth}
                  offsetX={priceWidth / 2}
                />
              </DraggableElement>

              {/* 8. CTA Button */}
              <DraggableElement
                elementKey="cta"
                positions={positions}
                onDragEnd={onDragEnd}
                onSelect={onSelect}
                selectedId={selectedId}
              >
                <Rect
                  offsetX={LAYOUT.CTA_WIDTH / 2}
                  offsetY={LAYOUT.CTA_HEIGHT / 2}
                  width={LAYOUT.CTA_WIDTH}
                  height={LAYOUT.CTA_HEIGHT}
                  fill={t.ctaBg}
                  cornerRadius={LAYOUT.CTA_RADIUS}
                  shadowColor={`${t.ctaBg}80`}
                  shadowBlur={16}
                  shadowOffsetY={6}
                />
                <Text
                  text={`${cta} 💕`}
                  fontSize={26}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontStyle="bold"
                  fill={t.ctaText}
                  align="center"
                  width={LAYOUT.CTA_WIDTH}
                  offsetX={LAYOUT.CTA_WIDTH / 2}
                  offsetY={13}
                />
              </DraggableElement>

              {/* 9. Score badge */}
              {score && score > 0 && (
                <DraggableElement
                  elementKey="score"
                  positions={positions}
                  onDragEnd={onDragEnd}
                  onSelect={onSelect}
                  selectedId={selectedId}
                >
                  <Rect
                    offsetX={LAYOUT.SCORE_WIDTH / 2}
                    offsetY={LAYOUT.SCORE_HEIGHT / 2}
                    width={LAYOUT.SCORE_WIDTH}
                    height={LAYOUT.SCORE_HEIGHT}
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
                    width={LAYOUT.SCORE_WIDTH}
                    offsetX={LAYOUT.SCORE_WIDTH / 2}
                    offsetY={8}
                  />
                </DraggableElement>
              )}

              {/* 10. Watermark */}
              <DraggableElement
                elementKey="watermark"
                positions={positions}
                onDragEnd={onDragEnd}
                onSelect={onSelect}
                selectedId={selectedId}
              >
                <Text
                  text="Feito com CriaLook"
                  fontSize={16}
                  fontFamily="system-ui, sans-serif"
                  fontStyle="500"
                  fill={t.textColor}
                  opacity={0.3}
                  align="center"
                  width={LAYOUT.WATERMARK_WIDTH}
                  offsetX={LAYOUT.WATERMARK_WIDTH / 2}
                />
              </DraggableElement>
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
