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
import { useSnapGuides } from "./hooks/useSnapGuides";
import TemplateSelector from "./TemplateSelector";
import KonvaToolbar from "./KonvaToolbar";
import KonvaCanvas from "./KonvaCanvas";
import ImportPanel from "./ImportPanel";

/**
 * Orchestrator component — composes hooks + sub-components.
 * Supports format toggle (feed/story), undo/redo, and blob export.
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
  format: initialFormat = "feed",
  enableCustomElements = false,
}: KonvaCompositorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [activeTemplate, setActiveTemplate] = useState("elegant_dark");
  const [format, setFormat] = useState<"feed" | "story">(initialFormat);
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
    fontSizes,
    selectedId,
    setSelectedId,
    hiddenElements,
    toggleVisibility,
    handleDragEnd,
    handleSelect,
    handleDeselect,
    handleReset,
    handleUndo,
    handleRedo,
    updateFontSize,
    canUndo,
    canRedo,
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
    updateTransform,
    reorderElement,
  } = useCustomElements(CANVAS_H);
  const { guides: snapGuides } = useSnapGuides();

  // ═══════════════════════════════════════
  //  Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
  // ═══════════════════════════════════════
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

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
  //  Format toggle (Feed ↔ Story)
  // ═══════════════════════════════════════
  const handleFormatToggle = useCallback(() => {
    setFormat((f) => (f === "feed" ? "story" : "feed"));
  }, []);

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

  // ═══════════════════════════════════════
  //  P1-5: Export as Blob for API integration
  // ═══════════════════════════════════════
  const exportAsBlob = useCallback(async (): Promise<Blob | null> => {
    const stage = stageRef.current;
    if (!stage) return null;

    const savedScaleX = stage.scaleX();
    const savedScaleY = stage.scaleY();
    const savedWidth = stage.width();
    const savedHeight = stage.height();

    stage.scale({ x: 1, y: 1 });
    stage.width(CANVAS_W);
    stage.height(CANVAS_H);
    stage.batchDraw();

    const dataUrl = stage.toDataURL({
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

    // Convert data URL to Blob
    const res = await fetch(dataUrl);
    return res.blob();
  }, [CANVAS_H]);

  // Expose exportAsBlob on ref for parent components
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stage = stageRef.current as any;
    if (stage) {
      stage.__exportAsBlob = exportAsBlob;
    }
  }, [exportAsBlob]);

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
          hiddenElements={hiddenElements}
          onToggleVisibility={toggleVisibility}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onReset={handleReset}
          onDownload={handleDownloadClick}
          onFormatToggle={handleFormatToggle}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        <div
          ref={containerRef}
          className="flex items-center justify-center p-2 sm:p-4"
          style={{
            background: "var(--surface)",
            cursor: selectedId || selectedCustomId ? "move" : "default",
            overflow: "auto",
            touchAction: "none", // P2-7: prevents browser gesture conflicts with pinch-to-zoom
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
            hiddenElements={hiddenElements}
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
            onCustomTransformEnd={updateTransform}
            snapGuides={snapGuides}
            fontSizes={fontSizes}
            onFontSizeChange={updateFontSize}
            onToggleVisibility={toggleVisibility}
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
          ✋ Arraste textos para reposicionar · 🔍 Use −/+ para zoom · ↩ Resetar restaura o layout · ⌨ Ctrl+Z/Y desfazer/refazer
          {enableCustomElements && " · 📎 Importe logos e stickers"}
        </div>
      </div>
    </div>
  );
}
