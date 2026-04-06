"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Konva from "konva";
import type { KonvaCompositorProps } from "./types";
import { templateStyles } from "./templates";
import { CANVAS_W, FEED_H, STORY_H } from "./constants";
import { useImageLoader } from "./hooks/useImageLoader";
import { useGradientOverlay } from "./hooks/useGradientOverlay";
import { useDragPositions } from "./hooks/useDragPositions";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCustomElements } from "./hooks/useCustomElements";
import TemplateSelector from "./TemplateSelector";
import KonvaToolbar from "./KonvaToolbar";
import KonvaCanvas from "./KonvaCanvas";
import ImportPanel from "./ImportPanel";

/**
 * Orchestrator component — composes hooks + sub-components.
 * Now supports custom element imports (logos, stickers, badges).
 */
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
  enableCustomElements = false,
}: KonvaCompositorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [activeTemplate, setActiveTemplate] = useState("elegant_dark");
  const [downloading, setDownloading] = useState(false);
  const [pendingDownload, setPendingDownload] = useState(false);

  const CANVAS_H = format === "story" ? STORY_H : FEED_H;
  const imageUrl = modelImageUrl || productImageUrl || null;
  const t = templateStyles.find((s) => s.id === activeTemplate) || templateStyles[0];

  // Hooks
  const { loadedImg, imgError, imgLoading } = useImageLoader(imageUrl);
  const gradientImg = useGradientOverlay(t, CANVAS_H);
  const {
    positions,
    selectedId,
    setSelectedId,
    handleDragEnd,
    handleSelect,
    handleDeselect,
    handleReset,
  } = useDragPositions(CANVAS_H);
  const {
    previewScale,
    zoomPercent,
    containerRef,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
  } = useCanvasZoom();
  const {
    elements: customElements,
    selectedCustomId,
    setSelectedCustomId,
    importElement,
    removeElement,
    updatePosition,
    updateOpacity,
    reorderElement,
  } = useCustomElements(CANVAS_H);

  // ═══════════════════════════════════════
  //  Deselect coordination (text ↔ custom)
  // ═══════════════════════════════════════
  const handleDeselectAll = useCallback(() => {
    handleDeselect();
    setSelectedCustomId(null);
  }, [handleDeselect, setSelectedCustomId]);

  const handleSelectText = useCallback(
    (key: Parameters<typeof handleSelect>[0]) => {
      setSelectedCustomId(null);
      handleSelect(key);
    },
    [handleSelect, setSelectedCustomId]
  );

  const handleSelectCustom = useCallback(
    (id: string | null) => {
      setSelectedId(null);
      setSelectedCustomId(id);
    },
    [setSelectedId, setSelectedCustomId]
  );

  // ═══════════════════════════════════════
  //  Download — reactive approach (no setTimeout hack)
  // ═══════════════════════════════════════
  const handleDownloadClick = useCallback(() => {
    setSelectedId(null);
    setSelectedCustomId(null);
    setPendingDownload(true);
    setDownloading(true);
  }, [setSelectedId, setSelectedCustomId]);

  useEffect(() => {
    if (!pendingDownload || selectedId !== null) return;

    const performExport = () => {
      try {
        const stage = stageRef.current;
        if (!stage) return;

        const savedScaleX = stage.scaleX();
        const savedScaleY = stage.scaleY();
        const savedWidth = stage.width();
        const savedHeight = stage.height();

        stage.scale({ x: 1, y: 1 });
        stage.width(CANVAS_W);
        stage.height(CANVAS_H);
        stage.batchDraw();

        const uri = stage.toDataURL({
          pixelRatio: 2,
          mimeType: "image/png",
          x: 0,
          y: 0,
          width: CANVAS_W,
          height: CANVAS_H,
        });

        stage.scale({ x: savedScaleX, y: savedScaleY });
        stage.width(savedWidth);
        stage.height(savedHeight);
        stage.batchDraw();

        const link = document.createElement("a");
        const safeName = productName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        link.download = `crialook-${safeName}-${activeTemplate}.png`;
        link.href = uri;
        link.click();
      } catch (err) {
        console.error("Download error:", err);
      } finally {
        setDownloading(false);
        setPendingDownload(false);
      }
    };

    requestAnimationFrame(performExport);
  }, [pendingDownload, selectedId, productName, activeTemplate, CANVAS_H]);

  return (
    <div>
      {/* Template selector */}
      <TemplateSelector activeTemplate={activeTemplate} onSelect={setActiveTemplate} />

      {/* Custom elements import panel */}
      {enableCustomElements && (
        <ImportPanel
          elements={customElements}
          selectedCustomId={selectedCustomId}
          onImport={importElement}
          onRemove={removeElement}
          onSelect={handleSelectCustom}
          onUpdateOpacity={updateOpacity}
          onReorder={reorderElement}
        />
      )}

      {/* Preview + toolbar */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <KonvaToolbar
          format={format}
          template={t}
          hasModelImage={!!modelImageUrl}
          previewScale={previewScale}
          zoomPercent={zoomPercent}
          downloading={downloading}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onReset={handleReset}
          onDownload={handleDownloadClick}
        />

        <div
          ref={containerRef}
          className="flex items-center justify-center p-2 sm:p-4"
          style={{
            background: "var(--surface)",
            cursor: selectedId || selectedCustomId ? "move" : "default",
            overflow: "auto",
          }}
        >
          <KonvaCanvas
            stageRef={stageRef}
            canvasH={CANVAS_H}
            previewScale={previewScale}
            template={t}
            loadedImg={loadedImg}
            imgError={imgError}
            imgLoading={imgLoading}
            gradientImg={gradientImg}
            positions={positions}
            selectedId={selectedId}
            productName={productName}
            price={price}
            headline={headline}
            cta={cta}
            storeName={storeName}
            score={score}
            modelImageUrl={modelImageUrl}
            onDragEnd={handleDragEnd}
            onSelect={handleSelectText}
            onDeselect={handleDeselectAll}
            /* Custom elements */
            customElements={customElements}
            selectedCustomId={selectedCustomId}
            onCustomDragEnd={updatePosition}
            onCustomSelect={handleSelectCustom}
          />
        </div>

        <div
          className="px-4 py-2 text-center text-[11px]"
          style={{
            background: "var(--background)",
            borderTop: "1px solid var(--border)",
            color: "var(--muted)",
          }}
        >
          ✋ Arraste textos para reposicionar · 🔍 Use −/+ para zoom · ↩ Resetar restaura o layout
          {enableCustomElements && " · 📎 Importe logos e stickers"}
        </div>
      </div>
    </div>
  );
}
