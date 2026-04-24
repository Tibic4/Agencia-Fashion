"use client";

import { useMemo, useCallback, useEffect, useRef } from "react";
import { Stage, Layer, Image as KImage, Text, Rect, Group, Transformer } from "react-konva";
import Konva from "konva";
import type {
  TemplateStyle,
  ElementPositions,
  ElementKey,
  KonvaDragEvent,
  CropConfig,
  CustomElement,
} from "./types";
import DraggableElement from "./DraggableElement";
import { CANVAS_W, LAYOUT, truncateText, formatPrice } from "./constants";
import type { FontSizes, WidthOverrides } from "./hooks/useDragPositions";

interface KonvaCanvasProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  canvasH: number;
  previewScale: number;
  template: TemplateStyle;
  loadedImg: HTMLImageElement | null;
  imgError: boolean;
  imgLoading: boolean;
  gradientImg: HTMLCanvasElement | HTMLImageElement | null;
  positions: ElementPositions;
  selectedId: string | null;
  hiddenElements: Set<ElementKey>;
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
  /* Custom elements */
  customElements?: CustomElement[];
  selectedCustomId?: string | null;
  onCustomDragEnd?: (id: string, x: number, y: number) => void;
  onCustomSelect?: (id: string | null) => void;
  onCustomTransformEnd?: (id: string, x: number, y: number, w: number, h: number, rotation: number) => void;
  /* P0-2: Snap guide handlers (imperative — no React state) */
  onSnapCheck?: (x: number, y: number, canvasH: number, layer: Konva.Layer | null) => { x: number; y: number };
  onSnapClear?: (layer: Konva.Layer | null) => void;
  /* Font size overrides & element controls */
  fontSizes?: FontSizes;
  widthOverrides?: WidthOverrides;
  elementOrder?: ElementKey[];
  onFontSizeChange?: (key: ElementKey, size: number) => void;
  onWidthChange?: (key: ElementKey, width: number) => void;
  onToggleVisibility?: (key: ElementKey) => void;
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
  hiddenElements,
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
  customElements = [],
  selectedCustomId,
  onCustomDragEnd,
  onCustomSelect,
  onCustomTransformEnd,
  onSnapCheck,
  onSnapClear,
  fontSizes = {},
  widthOverrides = {},
  elementOrder = ["badge", "productName", "headline", "price", "cta", "score", "watermark"],
  onFontSizeChange,
  onWidthChange,
  onToggleVisibility,
}: KonvaCanvasProps) {
  const fontLoadedRef = useRef(false);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textTransformerRef = useRef<Konva.Transformer>(null);
  const textGroupRefs = useRef<Map<string, Konva.Group>>(new Map());
  const customGroupRefs = useRef<Map<string, Konva.Group>>(new Map());
  const modelImgRef = useRef<Konva.Image>(null);
  const gradientRef = useRef<Konva.Image>(null);

  // Ensure fonts are loaded before drawing
  useEffect(() => {
    if (fontLoadedRef.current) return;
    document.fonts.ready.then(() => {
      fontLoadedRef.current = true;
      stageRef.current?.batchDraw();
    });
  }, [stageRef]);

  // Cache static elements (pre-rasterize for faster redraws during drag)
  useEffect(() => {
    // Cache model image — doesn't change during interactions
    if (modelImgRef.current && loadedImg) {
      try {
        modelImgRef.current.cache();
        modelImgRef.current.getLayer()?.batchDraw();
      } catch { /* cache may fail on cross-origin without proper CORS */ }
    }
  }, [loadedImg, canvasH]);

  useEffect(() => {
    // Cache gradient overlay — only changes when template switches
    if (gradientRef.current && gradientImg) {
      try {
        gradientRef.current.cache();
        gradientRef.current.getLayer()?.batchDraw();
      } catch { /* safe fallback */ }
    }
  }, [gradientImg]);

  // P1-6: Attach Transformer to selected custom element
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (selectedCustomId) {
      const node = customGroupRefs.current.get(selectedCustomId);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedCustomId]);

  const hasPrice = useMemo(() => price && price.trim().length > 0, [price]);
  const displayPrice = useMemo(() => hasPrice ? formatPrice(price) : "", [price, hasPrice]);
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

  // Attach text Transformer to selected text element
  useEffect(() => {
    const tr = textTransformerRef.current;
    if (!tr) return;
    if (selectedId && textGroupRefs.current.has(selectedId)) {
      const node = textGroupRefs.current.get(selectedId)!;
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  // Default font sizes per element
  const defaultFontSizeMap: Record<string, number> = useMemo(() => ({
    badge: 20,
    productName: productFontSize,
    headline: 26,
    price: 68,
    cta: 26,
    score: 16,
    watermark: 16,
  }), [productFontSize]);

  const getFontSize = useCallback((key: ElementKey) =>
    fontSizes[key] ?? defaultFontSizeMap[key] ?? 26
  , [fontSizes, defaultFontSizeMap]);

  // Default widths per element
  const defaultWidthMap: Record<string, number> = useMemo(() => ({
    badge: badgeWidth,
    productName: textW,
    headline: headlineW,
    price: priceWidth,
    cta: LAYOUT.CTA_WIDTH,
    score: LAYOUT.SCORE_WIDTH,
    watermark: LAYOUT.WATERMARK_WIDTH,
  }), [badgeWidth, textW, headlineW, priceWidth]);

  const getWidth = useCallback((key: ElementKey) =>
    widthOverrides[key] ?? defaultWidthMap[key] ?? textW
  , [widthOverrides, defaultWidthMap, textW]);

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

      {/* Canvas — role=img com aria-label descrevendo o conteúdo visual */}
      {!imgLoading && (
        <div
          role="img"
          aria-label="Pré-visualização da campanha. Use os controles abaixo para editar."
          style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_W * S}
            height={canvasH * S}
            scaleX={S}
            scaleY={S}
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            {/* ═══ Static Layer — only redraws on load/template switch ═══ */}
            <Layer listening={false}>
              {/* 1. Background */}
              <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#f5f5f5" />

              {/* 2. Model image (cover) — cached for performance */}
              {loadedImg && crop && (
                <KImage
                  ref={modelImgRef}
                  image={loadedImg}
                  x={0}
                  y={0}
                  width={CANVAS_W}
                  height={canvasH}
                  crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropW, height: crop.cropH }}
                />
              )}

              {/* 3. Gradient overlay — cached for performance */}
              {gradientImg && t.hasGradient && (
                <KImage
                  ref={gradientRef}
                  image={gradientImg}
                  x={0}
                  y={0}
                  width={CANVAS_W}
                  height={canvasH}
                />
              )}
            </Layer>

            {/* ═══ Interactive Layer — redraws on drag/selection ═══ */}
            <Layer>

              {/* 3.5 Custom imported elements (between gradient and text) */}
              {customElements.map((el) => (
                <Group
                  key={el.id}
                  ref={(node) => {
                    if (node) {
                      customGroupRefs.current.set(el.id, node);
                    } else {
                      customGroupRefs.current.delete(el.id);
                    }
                  }}
                  x={el.x}
                  y={el.y}
                  offsetX={el.width / 2}
                  offsetY={el.height / 2}
                  rotation={el.rotation}
                  opacity={el.opacity}
                  draggable
                  onClick={() => {
                    onDeselect();
                    onCustomSelect?.(el.id);
                  }}
                  onTap={() => {
                    onDeselect();
                    onCustomSelect?.(el.id);
                  }}
                  onDragEnd={(e) => {
                    const node = e.target;
                    onCustomDragEnd?.(el.id, node.x(), node.y());
                  }}
                  onDragStart={() => {
                    onCustomSelect?.(el.id);
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    // Reset scale — apply to width/height instead
                    node.scaleX(1);
                    node.scaleY(1);
                    onCustomTransformEnd?.(
                      el.id,
                      node.x(),
                      node.y(),
                      Math.max(20, el.width * scaleX),
                      Math.max(20, el.height * scaleY),
                      node.rotation()
                    );
                  }}
                >
                  <KImage
                    image={el.loadedImg!}
                    width={el.width}
                    height={el.height}
                    cornerRadius={el.circular ? el.width / 2 : 0}
                  />
                </Group>
              ))}

              {/* P1-6: Transformer for selected custom element */}
              <Transformer
                ref={transformerRef}
                anchorSize={10}
                anchorStroke="#ec4899"
                anchorFill="#fff"
                borderStroke="#ec4899"
                borderDash={[4, 3]}
                rotateAnchorOffset={24}
                enabledAnchors={[
                  "top-left", "top-right",
                  "bottom-left", "bottom-right",
                ]}
                boundBoxFunc={(oldBox, newBox) => {
                  // Min size guard
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />

              {/* ═══ Dynamic ordered elements ═══ */}
              {elementOrder.map((elKey) => {
                switch (elKey) {
                  case "badge":
                    if (hiddenElements.has("badge")) return null;
                    return (
                      <DraggableElement
                        key="badge"
                        ref={(node: import("konva/lib/Group").Group | null) => {
                          if (node) textGroupRefs.current.set("badge", node);
                          else textGroupRefs.current.delete("badge");
                        }}
                        elementKey="badge"
                        positions={positions}
                        onDragEnd={onDragEnd}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        canvasH={canvasH}
                        onSnapCheck={onSnapCheck}
                        onSnapClear={onSnapClear}
                      >
                        <Rect
                          offsetX={getWidth("badge") / 2}
                          offsetY={LAYOUT.BADGE_HEIGHT / 2}
                          width={getWidth("badge")}
                          height={LAYOUT.BADGE_HEIGHT}
                          fill={t.badgeBg}
                          cornerRadius={LAYOUT.BADGE_RADIUS}
                        />
                        <Text
                          text={`✨ ${storeName}`}
                          fontSize={getFontSize("badge")}
                          fontFamily="Inter, system-ui, sans-serif"
                          fontStyle="600"
                          fill={t.badgeText}
                          align="center"
                          width={getWidth("badge")}
                          offsetX={getWidth("badge") / 2}
                          offsetY={10}
                          perfectDrawEnabled={false}
                        />
                      </DraggableElement>
                    );

                  case "productName":
                    if (hiddenElements.has("productName")) return null;
                    return (
                      <DraggableElement
                        key="productName"
                        ref={(node: import("konva/lib/Group").Group | null) => {
                          if (node) textGroupRefs.current.set("productName", node);
                          else textGroupRefs.current.delete("productName");
                        }}
                        elementKey="productName"
                        positions={positions}
                        onDragEnd={onDragEnd}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        canvasH={canvasH}
                        onSnapCheck={onSnapCheck}
                        onSnapClear={onSnapClear}
                      >
                        <Text
                          text={productName}
                          fontSize={getFontSize("productName")}
                          fontFamily="Inter, system-ui, sans-serif"
                          fontStyle="800"
                          fill={t.textColor}
                          align="center"
                          width={getWidth("productName")}
                          offsetX={getWidth("productName") / 2}
                          perfectDrawEnabled={false}
                        />
                      </DraggableElement>
                    );

                  case "headline":
                    if (!headline || hiddenElements.has("headline")) return null;
                    return (
                      <DraggableElement
                        key="headline"
                        ref={(node: import("konva/lib/Group").Group | null) => {
                          if (node) textGroupRefs.current.set("headline", node);
                          else textGroupRefs.current.delete("headline");
                        }}
                        elementKey="headline"
                        positions={positions}
                        onDragEnd={onDragEnd}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        canvasH={canvasH}
                        onSnapCheck={onSnapCheck}
                        onSnapClear={onSnapClear}
                      >
                        <Text
                          text={truncateText(headline, 55)}
                          fontSize={getFontSize("headline")}
                          fontFamily="Inter, system-ui, sans-serif"
                          fontStyle="500"
                          fill={t.headlineColor}
                          align="center"
                          width={getWidth("headline")}
                          offsetX={getWidth("headline") / 2}
                          perfectDrawEnabled={false}
                        />
                      </DraggableElement>
                    );

                  case "price":
                    if (!hasPrice || hiddenElements.has("price")) return null;
                    return (
                      <DraggableElement
                        key="price"
                        ref={(node: import("konva/lib/Group").Group | null) => {
                          if (node) textGroupRefs.current.set("price", node);
                          else textGroupRefs.current.delete("price");
                        }}
                        elementKey="price"
                        positions={positions}
                        onDragEnd={onDragEnd}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        canvasH={canvasH}
                        onSnapCheck={onSnapCheck}
                        onSnapClear={onSnapClear}
                      >
                        <Text
                          text={displayPrice}
                          fontSize={getFontSize("price")}
                          fontFamily="Inter, system-ui, sans-serif"
                          fontStyle="900"
                          fill={t.priceColor}
                          align="center"
                          width={getWidth("price")}
                          offsetX={getWidth("price") / 2}
                          perfectDrawEnabled={false}
                        />
                      </DraggableElement>
                    );

                  case "cta":
                    if (hiddenElements.has("cta")) return null;
                    return (
                      <DraggableElement
                        key="cta"
                        ref={(node: import("konva/lib/Group").Group | null) => {
                          if (node) textGroupRefs.current.set("cta", node);
                          else textGroupRefs.current.delete("cta");
                        }}
                        elementKey="cta"
                        positions={positions}
                        onDragEnd={onDragEnd}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        canvasH={canvasH}
                        onSnapCheck={onSnapCheck}
                        onSnapClear={onSnapClear}
                      >
                        {/* P1-2: shadowForStrokeEnabled=false prevents double-render */}
                        <Rect
                          offsetX={getWidth("cta") / 2}
                          offsetY={LAYOUT.CTA_HEIGHT / 2}
                          width={getWidth("cta")}
                          height={LAYOUT.CTA_HEIGHT}
                          fill={t.ctaBg}
                          cornerRadius={LAYOUT.CTA_RADIUS}
                          shadowColor={`${t.ctaBg}80`}
                          shadowBlur={16}
                          shadowOffsetY={6}
                          shadowForStrokeEnabled={false}
                        />
                        <Text
                          text={`${cta} 💕`}
                          fontSize={getFontSize("cta")}
                          fontFamily="Inter, system-ui, sans-serif"
                          fontStyle="bold"
                          fill={t.ctaText}
                          align="center"
                          width={getWidth("cta")}
                          offsetX={getWidth("cta") / 2}
                          offsetY={13}
                          perfectDrawEnabled={false}
                        />
                      </DraggableElement>
                    );

                  case "score":
                    if (!score || score <= 0 || hiddenElements.has("score")) return null;
                    return (
                      <DraggableElement
                        key="score"
                        ref={(node: import("konva/lib/Group").Group | null) => {
                          if (node) textGroupRefs.current.set("score", node);
                          else textGroupRefs.current.delete("score");
                        }}
                        elementKey="score"
                        positions={positions}
                        onDragEnd={onDragEnd}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        canvasH={canvasH}
                        onSnapCheck={onSnapCheck}
                        onSnapClear={onSnapClear}
                      >
                        <Rect
                          offsetX={getWidth("score") / 2}
                          offsetY={LAYOUT.SCORE_HEIGHT / 2}
                          width={getWidth("score")}
                          height={LAYOUT.SCORE_HEIGHT}
                          fill="rgba(0,0,0,0.3)"
                          cornerRadius={13}
                        />
                        <Text
                          text={`⭐ ${score}/100`}
                          fontSize={getFontSize("score")}
                          fontFamily="system-ui, sans-serif"
                          fontStyle="600"
                          fill="rgba(255,255,255,0.9)"
                          align="center"
                          width={getWidth("score")}
                          offsetX={getWidth("score") / 2}
                          offsetY={8}
                          perfectDrawEnabled={false}
                        />
                      </DraggableElement>
                    );

                  case "watermark":
                    if (hiddenElements.has("watermark")) return null;
                    return (
                      <DraggableElement
                        key="watermark"
                        ref={(node: import("konva/lib/Group").Group | null) => {
                          if (node) textGroupRefs.current.set("watermark", node);
                          else textGroupRefs.current.delete("watermark");
                        }}
                        elementKey="watermark"
                        positions={positions}
                        onDragEnd={onDragEnd}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        canvasH={canvasH}
                        onSnapCheck={onSnapCheck}
                        onSnapClear={onSnapClear}
                      >
                        <Text
                          text="Feito com CriaLook"
                          fontSize={getFontSize("watermark")}
                          fontFamily="system-ui, sans-serif"
                          fontStyle="500"
                          fill={t.textColor}
                          opacity={0.3}
                          align="center"
                          width={getWidth("watermark")}
                          offsetX={getWidth("watermark") / 2}
                          perfectDrawEnabled={false}
                        />
                      </DraggableElement>
                    );

                  default:
                    return null;
                }
              })}

              {/* Text Transformer — resize handles for text elements */}
              <Transformer
                ref={textTransformerRef}
                anchorSize={12}
                anchorStroke="#8b5cf6"
                anchorFill="#fff"
                borderStroke="#8b5cf6"
                borderDash={[4, 3]}
                rotateEnabled={false}
                enabledAnchors={[
                  "top-left", "top-right", "bottom-left", "bottom-right",
                  "middle-left", "middle-right", "middle-top", "middle-bottom",
                ]}
                keepRatio={false}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 20 || newBox.height < 12) return oldBox;
                  return newBox;
                }}
              />

              {/* P0-2: Snap guides are now drawn imperatively on the Layer */}
              {/* via onSnapCheck/onSnapClear — no React state re-renders */}
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
