"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";

// Brand colors palette
const BRAND_COLORS = [
  "#FFFFFF", "#000000",
  "#D946EF", "#A21CAF", // fuchsia / brand
  "#EC4899", "#BE185D", // pink
  "#8B5CF6", "#6D28D9", // violet
  "#F59E0B", "#D97706", // amber
  "#10B981", "#059669", // emerald
  "#F87171", "#DC2626", // red
  "#60A5FA", "#2563EB", // blue
];

const FONT_SIZES = [18, 24, 32, 40, 52, 64, 80, 96];

// Canvas dimensions (export resolution)
const CANVAS_W = 1080;
const FEED_H = 1350;
const STORY_H = 1920;

interface TextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontStyle: string; // "normal" | "bold" | "italic" | "bold italic"
  align: "left" | "center" | "right";
  shadowEnabled: boolean;
  width: number;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Inner editor — only renders client-side (no SSR) ───────────────────────
function EditorInner() {
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [mode, setMode] = useState<"single" | "split">("single");
  const [photo1, setPhoto1] = useState<string | null>(null);
  const [photo2, setPhoto2] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dividerStyle, setDividerStyle] = useState<"line" | "gradient" | "none">("gradient");
  const [downloading, setDownloading] = useState(false);

  // Edit-in-place textarea
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const stageRef = useRef<import("konva").Stage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const canvasH = format === "feed" ? FEED_H : STORY_H;

  // Dynamically import Konva components
  const [KonvaComponents, setKonvaComponents] = useState<{
    Stage: React.ComponentType<import("react-konva").StageProps>;
    Layer: React.ComponentType<import("react-konva").LayerProps>;
    Image: React.ComponentType<import("react-konva").ImageProps>;
    Text: React.ComponentType<import("react-konva").TextProps>;
    Rect: React.ComponentType<import("react-konva").RectProps>;
    Line: React.ComponentType<import("react-konva").LineProps>;
    Transformer: React.ComponentType<import("react-konva").TransformerProps>;
  } | null>(null);

  useEffect(() => {
    import("react-konva").then((rk) => {
      setKonvaComponents({
        Stage: rk.Stage,
        Layer: rk.Layer,
        Image: rk.Image as React.ComponentType<import("react-konva").ImageProps>,
        Text: rk.Text,
        Rect: rk.Rect,
        Line: rk.Line,
        Transformer: rk.Transformer,
      });
    });
  }, []);

  // Recalculate scale on resize
  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      const maxW = containerRef.current.clientWidth - 2;
      setScale(Math.min(maxW / CANVAS_W, 0.45));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Load images into HTMLImageElement for Konva
  const [img1, setImg1] = useState<HTMLImageElement | null>(null);
  const [img2, setImg2] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!photo1) { setImg1(null); return; }
    const el = new window.Image();
    el.src = photo1;
    el.onload = () => setImg1(el);
  }, [photo1]);

  useEffect(() => {
    if (!photo2) { setImg2(null); return; }
    const el = new window.Image();
    el.src = photo2;
    el.onload = () => setImg2(el);
  }, [photo2]);

  // Transformer ref
  const transformerRef = useRef<import("konva").Transformer | null>(null);
  const textNodesRef = useRef<Map<string, import("konva").Text>>(new Map());

  useEffect(() => {
    if (!transformerRef.current) return;
    if (selectedId && textNodesRef.current.has(selectedId)) {
      transformerRef.current.nodes([textNodesRef.current.get(selectedId)!]);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId]);

  // Compute image fit/fill for each half
  function getImageProps(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const nw = img.naturalWidth * scale;
    const nh = img.naturalHeight * scale;
    return {
      x: x + (w - nw) / 2,
      y: y + (h - nh) / 2,
      width: nw,
      height: nh,
    };
  }

  // File upload handler
  function handleFileUpload(slot: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (slot === 1) setPhoto1(url);
    else setPhoto2(url);
  }

  // Add text
  function addText() {
    const newText: TextItem = {
      id: generateId(),
      text: "Toque para editar",
      x: CANVAS_W / 2 - 300,
      y: canvasH * 0.1,
      fontSize: 64,
      fill: "#FFFFFF",
      fontStyle: "bold",
      align: "center",
      shadowEnabled: true,
      width: 600,
    };
    setTexts(prev => [...prev, newText]);
    setSelectedId(newText.id);
  }

  // Update selected text property
  function updateSelected(patch: Partial<TextItem>) {
    if (!selectedId) return;
    setTexts(prev => prev.map(t => t.id === selectedId ? { ...t, ...patch } : t));
  }

  // Delete selected
  function deleteSelected() {
    if (!selectedId) return;
    setTexts(prev => prev.filter(t => t.id !== selectedId));
    setSelectedId(null);
  }

  // Double-click to edit text inline
  function startEdit(item: TextItem) {
    const node = textNodesRef.current.get(item.id);
    if (!node || !stageRef.current) return;
    setEditing(item.id);
    setEditValue(item.text);
    setSelectedId(null);
  }

  function commitEdit() {
    if (!editing) return;
    updateTextById(editing, { text: editValue || " " });
    setEditing(null);
  }

  function updateTextById(id: string, patch: Partial<TextItem>) {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  // Get textarea position for in-place editing
  function getTextareaStyle(item: TextItem): React.CSSProperties {
    if (!stageRef.current || !containerRef.current) return {};
    const stageBox = stageRef.current.container().getBoundingClientRect();
    const containerBox = containerRef.current.getBoundingClientRect();
    return {
      position: "absolute",
      top: stageBox.top - containerBox.top + item.y * scale,
      left: stageBox.left - containerBox.left + item.x * scale,
      width: item.width * scale,
      fontSize: item.fontSize * scale,
      fontWeight: item.fontStyle.includes("bold") ? "bold" : "normal",
      fontStyle: item.fontStyle.includes("italic") ? "italic" : "normal",
      textAlign: item.align,
      color: item.fill,
      background: "rgba(0,0,0,0.4)",
      border: "2px solid #D946EF",
      outline: "none",
      padding: "4px",
      borderRadius: 4,
      resize: "none",
      overflow: "hidden",
      lineHeight: 1.2,
      zIndex: 50,
      fontFamily: "Inter, system-ui, sans-serif",
    };
  }

  // Export PNG
  async function handleDownload() {
    if (!stageRef.current) return;
    setDownloading(true);
    setSelectedId(null);
    setEditing(null);
    await new Promise(r => setTimeout(r, 100));
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `crialook-${format}-${Date.now()}.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  const selected = texts.find(t => t.id === selectedId) ?? null;
  const editingItem = texts.find(t => t.id === editing) ?? null;

  if (!KonvaComponents) {
    return (
      <div className="flex items-center justify-center h-64 text-[#A1A1AA]">
        Carregando editor…
      </div>
    );
  }

  const { Stage, Layer, Image: KImage, Text: KText, Rect, Line, Transformer } = KonvaComponents;

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* ── Canvas area ── */}
      <div className="flex-1 flex flex-col items-center gap-4">
        {/* Format / Mode toggles */}
        <div className="flex gap-3 flex-wrap justify-center">
          <div className="flex bg-[#121212] rounded-xl border border-white/10 p-1 gap-1">
            {(["feed", "story"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${format === f ? "bg-white/10 text-white" : "text-[#71717A] hover:text-white"}`}
              >
                {f === "feed" ? "Feed 4:5" : "Stories 9:16"}
              </button>
            ))}
          </div>
          <div className="flex bg-[#121212] rounded-xl border border-white/10 p-1 gap-1">
            {(["single", "split"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === m ? "bg-white/10 text-white" : "text-[#71717A] hover:text-white"}`}
              >
                {m === "single" ? "1 Foto" : "Antes / Depois"}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas preview */}
        <div
          ref={containerRef}
          className="relative w-full max-w-[500px] select-none"
          style={{ touchAction: "none" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_W * scale}
            height={canvasH * scale}
            scaleX={scale}
            scaleY={scale}
            style={{ borderRadius: 12, overflow: "hidden", cursor: "default" }}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#111111" />

              {/* Photo(s) */}
              {mode === "single" && img1 && (() => {
                const props = getImageProps(img1, 0, 0, CANVAS_W, canvasH);
                return <KImage image={img1} {...props} />;
              })()}

              {mode === "split" && img1 && (() => {
                const halfW = CANVAS_W / 2;
                const props = getImageProps(img1, 0, 0, halfW, canvasH);
                return (
                  <KImage
                    image={img1}
                    {...props}
                    clipX={0} clipY={0} clipWidth={halfW} clipHeight={canvasH}
                  />
                );
              })()}

              {mode === "split" && img2 && (() => {
                const halfW = CANVAS_W / 2;
                const props = getImageProps(img2, halfW, 0, halfW, canvasH);
                return (
                  <KImage
                    image={img2}
                    {...props}
                    clipX={halfW} clipY={0} clipWidth={halfW} clipHeight={canvasH}
                  />
                );
              })()}

              {/* Divider */}
              {mode === "split" && dividerStyle === "line" && (
                <Line
                  points={[CANVAS_W / 2, 0, CANVAS_W / 2, canvasH]}
                  stroke="white"
                  strokeWidth={4}
                  opacity={0.8}
                />
              )}
              {mode === "split" && dividerStyle === "gradient" && (
                <>
                  <Rect
                    x={CANVAS_W / 2 - 40}
                    y={0}
                    width={80}
                    height={canvasH}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: 80, y: 0 }}
                    fillLinearGradientColorStops={[0, "rgba(0,0,0,0.4)", 0.5, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.4)"]}
                  />
                  <Line
                    points={[CANVAS_W / 2, canvasH * 0.1, CANVAS_W / 2, canvasH * 0.9]}
                    stroke="white"
                    strokeWidth={3}
                    opacity={0.6}
                  />
                </>
              )}

              {/* Texts */}
              {texts.map((item) => (
                editing === item.id ? null : (
                  <KText
                    key={item.id}
                    ref={(node) => {
                      if (node) textNodesRef.current.set(item.id, node);
                      else textNodesRef.current.delete(item.id);
                    }}
                    x={item.x}
                    y={item.y}
                    text={item.text}
                    fontSize={item.fontSize}
                    fill={item.fill}
                    fontFamily="Inter, Arial, sans-serif"
                    fontStyle={item.fontStyle}
                    align={item.align}
                    width={item.width}
                    draggable
                    shadowEnabled={item.shadowEnabled}
                    shadowColor="rgba(0,0,0,0.8)"
                    shadowBlur={12}
                    shadowOffsetX={2}
                    shadowOffsetY={2}
                    onClick={() => setSelectedId(item.id)}
                    onTap={() => setSelectedId(item.id)}
                    onDblClick={() => startEdit(item)}
                    onDblTap={() => startEdit(item)}
                    onDragEnd={(e) => updateTextById(item.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      updateTextById(item.id, {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(50, node.width() * node.scaleX()),
                        fontSize: Math.max(12, Math.round(item.fontSize * node.scaleY())),
                      });
                      node.scaleX(1);
                      node.scaleY(1);
                    }}
                  />
                )
              ))}

              {/* Transformer */}
              <Transformer
                ref={transformerRef}
                enabledAnchors={["middle-left", "middle-right", "top-center", "bottom-center"]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 50) return oldBox;
                  return newBox;
                }}
                borderStroke="#D946EF"
                anchorStroke="#D946EF"
                anchorFill="#fff"
                anchorSize={10}
              />
            </Layer>
          </Stage>

          {/* Inline text editor textarea */}
          {editing && editingItem && (
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") commitEdit();
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitEdit();
              }}
              style={getTextareaStyle(editingItem)}
              rows={3}
            />
          )}
        </div>
      </div>

      {/* ── Controls panel ── */}
      <div className="xl:w-72 flex flex-col gap-4">

        {/* Upload slots */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 space-y-3">
          <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">
            {mode === "single" ? "Foto de fundo" : "Fotos"}
          </p>
          <UploadSlot label={mode === "split" ? "Esquerda (manequim)" : "Foto"} preview={photo1} onChange={(e) => handleFileUpload(1, e)} onClear={() => setPhoto1(null)} />
          {mode === "split" && (
            <UploadSlot label="Direita (modelo)" preview={photo2} onChange={(e) => handleFileUpload(2, e)} onClear={() => setPhoto2(null)} />
          )}
        </div>

        {/* Divider style (split mode) */}
        {mode === "split" && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-3">Divisória</p>
            <div className="flex gap-2">
              {(["none", "line", "gradient"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDividerStyle(d)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition ${dividerStyle === d ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border border-transparent"}`}
                >
                  {d === "none" ? "Nenhuma" : d === "line" ? "Linha" : "Gradiente"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text controls */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">Textos</p>
            <button
              onClick={addText}
              className="px-3 py-1.5 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 text-[11px] font-bold hover:bg-fuchsia-500/30 transition border border-fuchsia-500/30"
            >
              + Adicionar
            </button>
          </div>

          {texts.length === 0 && (
            <p className="text-[11px] text-[#52525B] text-center py-3">Nenhum texto ainda</p>
          )}

          {/* Text list */}
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {texts.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                onDoubleClick={() => startEdit(t)}
                className={`w-full text-left px-3 py-2 rounded-xl text-[12px] truncate transition ${selectedId === t.id ? "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30" : "bg-white/5 text-[#A1A1AA] hover:text-white border border-transparent"}`}
              >
                {t.text}
              </button>
            ))}
          </div>

          {/* Selected text properties */}
          {selected && (
            <div className="border-t border-white/5 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#71717A]">Selecionado</span>
                <button onClick={deleteSelected} className="text-[11px] text-red-400 hover:text-red-300 font-bold transition">
                  Deletar
                </button>
              </div>

              {/* Font size */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Tamanho: {selected.fontSize}px</p>
                <div className="flex gap-1 flex-wrap">
                  {FONT_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateSelected({ fontSize: s })}
                      className={`w-9 h-7 rounded-lg text-[11px] font-bold transition ${selected.fontSize === s ? "bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Estilo</p>
                <div className="flex gap-1.5">
                  {(["normal", "bold", "italic", "bold italic"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => updateSelected({ fontStyle: s })}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition ${selected.fontStyle === s ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border border-transparent"}`}
                    >
                      {s === "normal" ? "Aa" : s === "bold" ? "B" : s === "italic" ? "I" : "BI"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alignment */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Alinhamento</p>
                <div className="flex gap-1.5">
                  {(["left", "center", "right"] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => updateSelected({ align: a })}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition ${selected.align === a ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border border-transparent"}`}
                    >
                      {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow toggle */}
              <button
                onClick={() => updateSelected({ shadowEnabled: !selected.shadowEnabled })}
                className={`w-full py-2 rounded-xl text-[11px] font-bold transition border ${selected.shadowEnabled ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-white/5 text-[#71717A] border-transparent hover:text-white"}`}
              >
                {selected.shadowEnabled ? "✓ Sombra ativada" : "Sombra"}
              </button>

              {/* Colors */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Cor do texto</p>
                <div className="flex flex-wrap gap-1.5">
                  {BRAND_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateSelected({ fill: c })}
                      title={c}
                      className={`w-7 h-7 rounded-lg transition ${selected.fill === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : "hover:scale-110"}`}
                      style={{ background: c, border: c === "#FFFFFF" ? "1px solid rgba(255,255,255,0.15)" : undefined }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading || (!photo1 && texts.length === 0)}
          className="w-full py-4 rounded-2xl font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #D946EF, #8B5CF6)", color: "white", boxShadow: "0 4px 20px rgba(217,70,239,0.3)" }}
        >
          {downloading ? "Gerando…" : `Baixar ${format === "feed" ? "Feed (1080×1350)" : "Stories (1080×1920)"}`}
        </button>

        <p className="text-[10px] text-[#52525B] text-center">
          Duplo clique no texto para editar · Arraste para mover
        </p>
      </div>
    </div>
  );
}

// ─── Upload slot component ───────────────────────────────────────────────────
function UploadSlot({
  label,
  preview,
  onChange,
  onClear,
}: {
  label: string;
  preview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-[10px] text-[#71717A] mb-1.5">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden h-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <button
            onClick={onClear}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-20 rounded-xl border-2 border-dashed border-white/10 text-[#52525B] text-xs flex flex-col items-center justify-center gap-1 hover:border-fuchsia-500/40 hover:text-[#A1A1AA] transition"
        >
          <span className="text-xl">📷</span>
          Clique para enviar
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}

// ─── Default export wrapped in dynamic (no SSR) ─────────────────────────────
export default function InstagramEditor() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return (
    <div className="flex items-center justify-center h-64 text-[#A1A1AA] text-sm">
      Carregando editor…
    </div>
  );
  return <EditorInner />;
}
