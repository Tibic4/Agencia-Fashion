"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Konva from "konva";
import {
  Stage, Layer, Image as KImage, Text as KText, Rect, Line,
  Group, Transformer, TextPath,
} from "react-konva";

// ─── Constantes ──────────────────────────────────────────────────────────────
const BRAND_COLORS = [
  "#FFFFFF", "#000000",
  "#D946EF", "#A21CAF", "#EC4899", "#BE185D",
  "#8B5CF6", "#6D28D9", "#F59E0B", "#D97706",
  "#10B981", "#059669", "#F87171", "#DC2626",
  "#60A5FA", "#2563EB", "#FAFAFA", "#71717A",
];
const FONT_SIZES = [18, 24, 32, 40, 52, 64, 80, 96];
const CANVAS_W = 1080;
const FEED_H = 1350;
const STORY_H = 1920;

const FONTS = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', cursive" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Playfair", value: "'Playfair Display', serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Bangers", value: "'Bangers', cursive" },
  { label: "Permanent Marker", value: "'Permanent Marker', cursive" },
];

const PRESET_PHRASES = [
  { text: "ANTES vs DEPOIS", fontSize: 56 },
  { text: "RESULTADO REAL", fontSize: 52 },
  { text: "PROVA QUE FUNCIONA", fontSize: 48 },
  { text: "LOTE ESGOTANDO", fontSize: 52 },
  { text: "ÚLTIMAS UNIDADES", fontSize: 48 },
  { text: "TRANSFORMAÇÃO", fontSize: 56 },
  { text: "50% OFF", fontSize: 80, bgColor: "#DC2626" },
  { text: "LANÇAMENTO", fontSize: 52, bgColor: "#D946EF" },
  { text: "FRETE GRÁTIS", fontSize: 48, bgColor: "#059669" },
  { text: "COMPRE AGORA", fontSize: 48, bgColor: "#D946EF" },
  { text: "ARRASTE →", fontSize: 40 },
  { text: "VEJA O DEPOIMENTO", fontSize: 40 },
  { text: "SÓ HOJE", fontSize: 64, bgColor: "#DC2626" },
  { text: "QUEIMA DE ESTOQUE", fontSize: 48, bgColor: "#F59E0B" },
  { text: "NOVIDADE", fontSize: 52, bgColor: "#8B5CF6" },
];

const STICKER_EMOJIS = ["🔥", "⭐", "✅", "💎", "🏷️", "➡️", "❤️", "💰", "🎯", "⚡", "👆", "🛒", "💥", "✨", "🚀"];

type Overlay = "none" | "gradient-bottom" | "gradient-top" | "vignette" | "brand-warm" | "brand-cool";
type Frame = "none" | "thin" | "thick" | "double";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface TextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontStyle: string;
  fontFamily: string;
  align: "left" | "center" | "right";
  shadowEnabled: boolean;
  width: number;
  stroke: string;
  strokeWidth: number;
  bgColor: string;
  bgPadding: number;
  bgRadius: number;
  curved: boolean;
  curveAmount: number;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function makeText(partial: Partial<TextItem> & { text: string }, canvasH: number, idx: number): TextItem {
  return {
    id: uid(),
    x: CANVAS_W / 2 - 300,
    y: canvasH * 0.08 + idx * 90,
    fontSize: 64,
    fill: "#FFFFFF",
    fontStyle: "bold",
    fontFamily: "Inter, sans-serif",
    align: "center",
    shadowEnabled: true,
    width: 600,
    stroke: "",
    strokeWidth: 0,
    bgColor: "",
    bgPadding: 16,
    bgRadius: 12,
    curved: false,
    curveAmount: 60,
    ...partial,
  };
}

function arcPath(w: number, amt: number): string {
  const h = Math.abs(amt);
  if (amt >= 0) return `M 0,${h} Q ${w / 2},${-h} ${w},${h}`;
  return `M 0,0 Q ${w / 2},${h * 2} ${w},0`;
}

function estimateTextHeight(item: TextItem): number {
  const charW = item.fontSize * 0.5;
  const charsPerLine = Math.max(1, Math.floor(item.width / charW));
  const lines = item.text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil((line.length || 1) / charsPerLine)), 0);
  return lines * item.fontSize * 1.2;
}

// ─── Templates ───────────────────────────────────────────────────────────────
interface Template {
  name: string;
  icon: string;
  mode: "single" | "split";
  format: "feed" | "story";
  overlay: Overlay;
  frame: Frame;
  frameColor: string;
  texts: Array<Partial<TextItem> & { text: string }>;
}

const TEMPLATES: Template[] = [
  {
    name: "Antes vs Depois",
    icon: "🔀",
    mode: "split", format: "feed", overlay: "gradient-bottom", frame: "none", frameColor: "#FFFFFF",
    texts: [
      { text: "ANTES", x: 120, y: 60, fontSize: 52, bgColor: "#000000", bgPadding: 14, align: "center", width: 300 },
      { text: "DEPOIS", x: 660, y: 60, fontSize: 52, bgColor: "#D946EF", bgPadding: 14, align: "center", width: 300 },
      { text: "RESULTADO REAL\nEM 5 MINUTOS", x: 190, y: 1120, fontSize: 64, align: "center", width: 700 },
    ],
  },
  {
    name: "Promo Feed",
    icon: "🏷️",
    mode: "single", format: "feed", overlay: "gradient-bottom", frame: "thick", frameColor: "#D946EF",
    texts: [
      { text: "QUEIMA\nDE ESTOQUE", x: 140, y: 100, fontSize: 96, fontFamily: "'Bebas Neue', cursive", align: "center", width: 800 },
      { text: "50% OFF", x: 240, y: 1050, fontSize: 80, bgColor: "#DC2626", bgPadding: 20, bgRadius: 16, align: "center", width: 600 },
      { text: "SÓ HOJE · LINK NA BIO", x: 190, y: 1220, fontSize: 36, fill: "#A1A1AA", align: "center", width: 700 },
    ],
  },
  {
    name: "Stories CTA",
    icon: "📱",
    mode: "single", format: "story", overlay: "gradient-top", frame: "none", frameColor: "#FFFFFF",
    texts: [
      { text: "NOVIDADE", x: 290, y: 120, fontSize: 48, bgColor: "#D946EF", bgPadding: 14, align: "center", width: 500 },
      { text: "ARRASTE\nPARA CIMA", x: 190, y: 1650, fontSize: 64, align: "center", width: 700, fontFamily: "'Oswald', sans-serif" },
    ],
  },
  {
    name: "Depoimento",
    icon: "💬",
    mode: "single", format: "feed", overlay: "vignette", frame: "thin", frameColor: "#FFFFFF",
    texts: [
      { text: "\"Melhor investimento\nque já fiz!\"", x: 90, y: 900, fontSize: 56, fontFamily: "'Playfair Display', serif", fontStyle: "italic", align: "center", width: 900 },
      { text: "— @cliente_real", x: 290, y: 1150, fontSize: 32, fill: "#A1A1AA", align: "center", width: 500 },
    ],
  },
  {
    name: "Resultado",
    icon: "📊",
    mode: "split", format: "feed", overlay: "gradient-bottom", frame: "none", frameColor: "#FFFFFF",
    texts: [
      { text: "MANEQUIM", x: 120, y: 1100, fontSize: 36, bgColor: "rgba(0,0,0,0.6)", bgPadding: 10, align: "center", width: 300 },
      { text: "MODELO IA", x: 660, y: 1100, fontSize: 36, bgColor: "#D946EF", bgPadding: 10, align: "center", width: 300 },
      { text: "QUAL VENDE MAIS?", x: 140, y: 1220, fontSize: 56, align: "center", width: 800, fontFamily: "'Oswald', sans-serif" },
    ],
  },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function InstagramEditor() {
  // Canvas
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [mode, setMode] = useState<"single" | "split">("single");
  const [photo1, setPhoto1] = useState<string | null>(null);
  const [photo2, setPhoto2] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dividerStyle, setDividerStyle] = useState<"line" | "gradient" | "none">("gradient");

  // Visual
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [frame, setFrame] = useState<Frame>("none");
  const [frameColor, setFrameColor] = useState("#FFFFFF");
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState<"tl" | "tr" | "bl" | "br">("br");
  const [logoOpacity, setLogoOpacity] = useState(0.8);
  const [logoScale, setLogoScale] = useState(0.15);

  // UI
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(0.35);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<"text" | "visual" | "templates">("text");

  // Refs
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textNodesRef = useRef<Map<string, Konva.Text>>(new Map());
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const textsRef = useRef(texts);
  textsRef.current = texts;

  // Undo/Redo
  const historyRef = useRef<{ states: TextItem[][]; idx: number }>({ states: [[]], idx: 0 });

  function pushHistory(newTexts: TextItem[]) {
    const h = historyRef.current;
    h.states = [...h.states.slice(0, h.idx + 1), JSON.parse(JSON.stringify(newTexts))];
    h.idx = h.states.length - 1;
    setTexts(newTexts);
  }
  function undo() {
    const h = historyRef.current;
    if (h.idx <= 0) return;
    h.idx--;
    setTexts(JSON.parse(JSON.stringify(h.states[h.idx])));
  }
  function redo() {
    const h = historyRef.current;
    if (h.idx >= h.states.length - 1) return;
    h.idx++;
    setTexts(JSON.parse(JSON.stringify(h.states[h.idx])));
  }

  const canvasH = format === "feed" ? FEED_H : STORY_H;

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Load Google Fonts
  useEffect(() => {
    if (document.getElementById("editor-gfonts")) return;
    const link = document.createElement("link");
    link.id = "editor-gfonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Montserrat:wght@400;700;900&family=Poppins:wght@400;700&family=Bangers&family=Permanent+Marker&display=swap";
    document.head.appendChild(link);
  }, []);

  // Scale
  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    setScale((containerRef.current.clientWidth - 2) / CANVAS_W);
  }, []);
  useEffect(() => { updateScale(); window.addEventListener("resize", updateScale); return () => window.removeEventListener("resize", updateScale); }, [updateScale]);

  // Transformer
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const sel = selectedId ? textsRef.current.find(t => t.id === selectedId) : null;
    if (sel && !sel.curved) {
      const node = textNodesRef.current.get(selectedId!);
      tr.nodes(node ? [node] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, texts]);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === "Delete" && selectedIdRef.current) {
        pushHistory(textsRef.current.filter(t => t.id !== selectedIdRef.current));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Images
  const [img1, setImg1] = useState<HTMLImageElement | null>(null);
  const [img2, setImg2] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => { loadImg(photo1, setImg1); }, [photo1]);
  useEffect(() => { loadImg(photo2, setImg2); }, [photo2]);
  useEffect(() => { loadImg(logoSrc, setLogoImg); }, [logoSrc]);

  function loadImg(src: string | null, setter: (v: HTMLImageElement | null) => void) {
    if (!src) { setter(null); return; }
    const el = new window.Image();
    el.src = src;
    el.onload = () => setter(el);
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function coverProps(img: HTMLImageElement, slotW: number, slotH: number) {
    const s = Math.max(slotW / img.naturalWidth, slotH / img.naturalHeight);
    const nw = img.naturalWidth * s;
    const nh = img.naturalHeight * s;
    return { x: (slotW - nw) / 2, y: (slotH - nh) / 2, width: nw, height: nh };
  }

  function handleUpload(slot: 1 | 2 | "logo", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (slot === 1) setPhoto1(url);
    else if (slot === 2) setPhoto2(url);
    else setLogoSrc(url);
  }

  function addText(partial?: Partial<TextItem> & { text: string }) {
    const item = makeText(partial ?? { text: "SEU TEXTO" }, canvasH, texts.length);
    pushHistory([...texts, item]);
    setSelectedId(item.id);
  }

  function addSticker(emoji: string) {
    const item = makeText({
      text: emoji, fontSize: 96, width: 120,
      shadowEnabled: false, fontFamily: "Inter, sans-serif",
    }, canvasH, texts.length);
    item.x = CANVAS_W / 2 - 60;
    pushHistory([...texts, item]);
    setSelectedId(item.id);
  }

  function patchSelected(patch: Partial<TextItem>) {
    if (!selectedId) return;
    pushHistory(texts.map(t => t.id === selectedId ? { ...t, ...patch } : t));
  }

  function patchById(id: string, patch: Partial<TextItem>) {
    // For drag/transform — don't push to history (too many events)
    setTexts(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function deleteSelected() {
    pushHistory(texts.filter(t => t.id !== selectedId));
    setSelectedId(null);
  }

  function duplicateSelected() {
    const src = texts.find(t => t.id === selectedId);
    if (!src) return;
    const dup = { ...src, id: uid(), x: src.x + 30, y: src.y + 30 };
    pushHistory([...texts, dup]);
    setSelectedId(dup.id);
  }

  function moveLayer(dir: -1 | 1) {
    const idx = texts.findIndex(t => t.id === selectedId);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= texts.length) return;
    const arr = [...texts];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    pushHistory(arr);
  }

  function applyTemplate(tpl: Template) {
    setMode(tpl.mode);
    setFormat(tpl.format);
    setOverlay(tpl.overlay);
    setFrame(tpl.frame);
    setFrameColor(tpl.frameColor);
    const newTexts = tpl.texts.map((t, i) => makeText(t, tpl.format === "feed" ? FEED_H : STORY_H, i));
    pushHistory(newTexts);
    setSelectedId(null);
  }

  async function handleDownload() {
    if (!stageRef.current) return;
    setDownloading(true);
    setSelectedId(null);
    await new Promise(r => setTimeout(r, 150));
    try {
      const url = stageRef.current.toDataURL({ pixelRatio: 1 });
      const a = document.createElement("a");
      a.href = url;
      a.download = `crialook-${format}-${Date.now()}.png`;
      a.click();
    } finally { setDownloading(false); }
  }

  // ─── Derived ────────────────────────────────────────────────────────────────
  const selected = texts.find(t => t.id === selectedId) ?? null;
  const halfW = CANVAS_W / 2;

  // Logo position
  const logoPad = 40;
  const logoW = CANVAS_W * logoScale;
  const logoH = logoImg ? logoW * (logoImg.naturalHeight / logoImg.naturalWidth) : 0;
  const logoXY = {
    tl: { x: logoPad, y: logoPad },
    tr: { x: CANVAS_W - logoW - logoPad, y: logoPad },
    bl: { x: logoPad, y: canvasH - logoH - logoPad },
    br: { x: CANVAS_W - logoW - logoPad, y: canvasH - logoH - logoPad },
  }[logoPos];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-4">

      {/* ── Canvas Column ── */}
      <div className="flex-1 flex flex-col items-center gap-3">

        {/* Toggles */}
        <div className="flex gap-2 flex-wrap justify-center w-full">
          <ToggleGroup value={format} options={[{ v: "feed", label: "Feed 4:5" }, { v: "story", label: "Stories 9:16" }]} onChange={v => setFormat(v as "feed" | "story")} />
          <ToggleGroup value={mode} options={[{ v: "single", label: "1 Foto" }, { v: "split", label: "Antes/Depois" }]} onChange={v => setMode(v as "single" | "split")} />
          {mode === "split" && (
            <ToggleGroup value={dividerStyle} options={[{ v: "none", label: "Sem" }, { v: "line", label: "Linha" }, { v: "gradient", label: "Grad" }]} onChange={v => setDividerStyle(v as "line" | "gradient" | "none")} />
          )}
        </div>

        {/* Stage */}
        <div ref={containerRef} className="relative w-full select-none" style={{ touchAction: "none", maxWidth: 540 }}>
          <Stage
            ref={stageRef}
            width={CANVAS_W * scale} height={canvasH * scale}
            scaleX={scale} scaleY={scale}
            style={{ borderRadius: 12, overflow: "hidden", background: "#111" }}
            onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}
            onTouchStart={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          >
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#111" />

              {/* Photos */}
              {mode === "single" && img1 && <KImage image={img1} {...coverProps(img1, CANVAS_W, canvasH)} />}
              {mode === "split" && img1 && (
                <Group clipX={0} clipY={0} clipWidth={halfW} clipHeight={canvasH}>
                  <KImage image={img1} {...coverProps(img1, halfW, canvasH)} />
                </Group>
              )}
              {mode === "split" && img2 && (
                <Group clipX={0} clipY={0} clipWidth={halfW} clipHeight={canvasH} x={halfW}>
                  <KImage image={img2} {...coverProps(img2, halfW, canvasH)} />
                </Group>
              )}

              {/* Divider */}
              {mode === "split" && dividerStyle === "line" && (
                <Line points={[halfW, 0, halfW, canvasH]} stroke="white" strokeWidth={4} opacity={0.8} />
              )}
              {mode === "split" && dividerStyle === "gradient" && (
                <>
                  <Rect x={halfW - 40} y={0} width={80} height={canvasH}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 80, y: 0 }}
                    fillLinearGradientColorStops={[0, "rgba(0,0,0,0.4)", 0.5, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.4)"]}
                  />
                  <Line points={[halfW, canvasH * 0.08, halfW, canvasH * 0.92]} stroke="white" strokeWidth={3} opacity={0.6} />
                </>
              )}

              {/* Overlay */}
              {overlay === "gradient-bottom" && (
                <Rect x={0} y={canvasH * 0.5} width={CANVAS_W} height={canvasH * 0.5}
                  fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: canvasH * 0.5 }}
                  fillLinearGradientColorStops={[0, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.75)"]}
                />
              )}
              {overlay === "gradient-top" && (
                <Rect x={0} y={0} width={CANVAS_W} height={canvasH * 0.4}
                  fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: canvasH * 0.4 }}
                  fillLinearGradientColorStops={[0, "rgba(0,0,0,0.7)", 1, "rgba(0,0,0,0)"]}
                />
              )}
              {overlay === "vignette" && (
                <Rect x={0} y={0} width={CANVAS_W} height={canvasH}
                  fillRadialGradientStartPoint={{ x: CANVAS_W / 2, y: canvasH / 2 }}
                  fillRadialGradientEndPoint={{ x: CANVAS_W / 2, y: canvasH / 2 }}
                  fillRadialGradientStartRadius={CANVAS_W * 0.3}
                  fillRadialGradientEndRadius={CANVAS_W * 0.9}
                  fillRadialGradientColorStops={[0, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.6)"]}
                />
              )}
              {overlay === "brand-warm" && (
                <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#D946EF" opacity={0.15} />
              )}
              {overlay === "brand-cool" && (
                <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#6D28D9" opacity={0.18} />
              )}

              {/* Logo */}
              {logoImg && (
                <KImage image={logoImg} x={logoXY.x} y={logoXY.y} width={logoW} height={logoH} opacity={logoOpacity} />
              )}

              {/* Texts */}
              {texts.map(item => (
                <Group key={item.id}>
                  {/* Badge background */}
                  {item.bgColor && (
                    <Rect
                      x={item.x - item.bgPadding}
                      y={item.y - item.bgPadding}
                      width={item.width + item.bgPadding * 2}
                      height={estimateTextHeight(item) + item.bgPadding * 2}
                      fill={item.bgColor}
                      cornerRadius={item.bgRadius}
                    />
                  )}
                  {/* Text or curved text */}
                  {item.curved ? (
                    <Group x={item.x} y={item.y} draggable
                      onClick={() => setSelectedId(item.id)}
                      onTap={() => setSelectedId(item.id)}
                      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => patchById(item.id, { x: e.target.x(), y: e.target.y() })}
                    >
                      <TextPath
                        data={arcPath(item.width, item.curveAmount)}
                        text={item.text}
                        fontSize={item.fontSize}
                        fill={item.fill}
                        fontFamily={item.fontFamily}
                        fontStyle={item.fontStyle}
                        shadowEnabled={item.shadowEnabled}
                        shadowColor="rgba(0,0,0,0.85)"
                        shadowBlur={14}
                        shadowOffsetX={2}
                        shadowOffsetY={2}
                        stroke={item.stroke || undefined}
                        strokeWidth={item.strokeWidth || undefined}
                      />
                    </Group>
                  ) : (
                    <KText
                      ref={(n: Konva.Text | null) => { if (n) textNodesRef.current.set(item.id, n); else textNodesRef.current.delete(item.id); }}
                      x={item.x} y={item.y}
                      text={item.text}
                      fontSize={item.fontSize}
                      fill={item.fill}
                      fontFamily={item.fontFamily}
                      fontStyle={item.fontStyle}
                      align={item.align}
                      width={item.width}
                      draggable
                      shadowEnabled={item.shadowEnabled}
                      shadowColor="rgba(0,0,0,0.85)"
                      shadowBlur={14} shadowOffsetX={2} shadowOffsetY={2}
                      stroke={item.stroke || undefined}
                      strokeWidth={item.strokeWidth || undefined}
                      onClick={() => setSelectedId(item.id)}
                      onTap={() => setSelectedId(item.id)}
                      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => patchById(item.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
                        const n = e.target;
                        patchById(item.id, {
                          x: n.x(), y: n.y(),
                          width: Math.max(50, n.width() * n.scaleX()),
                          fontSize: Math.max(12, Math.round(item.fontSize * n.scaleY())),
                        });
                        n.scaleX(1); n.scaleY(1);
                      }}
                    />
                  )}
                </Group>
              ))}

              {/* Frame */}
              {frame !== "none" && (
                <>
                  {frame === "thin" && <Rect x={0} y={0} width={CANVAS_W} height={canvasH} stroke={frameColor} strokeWidth={6} listening={false} />}
                  {frame === "thick" && <Rect x={12} y={12} width={CANVAS_W - 24} height={canvasH - 24} stroke={frameColor} strokeWidth={16} cornerRadius={8} listening={false} />}
                  {frame === "double" && (
                    <>
                      <Rect x={8} y={8} width={CANVAS_W - 16} height={canvasH - 16} stroke={frameColor} strokeWidth={4} listening={false} />
                      <Rect x={20} y={20} width={CANVAS_W - 40} height={canvasH - 40} stroke={frameColor} strokeWidth={2} listening={false} />
                    </>
                  )}
                </>
              )}

              <Transformer
                ref={transformerRef}
                enabledAnchors={["middle-left", "middle-right", "top-center", "bottom-center"]}
                boundBoxFunc={(_o: unknown, n: { width: number; height: number; x: number; y: number; rotation: number }) => n.width < 50 ? _o as typeof n : n}
                borderStroke="#D946EF" anchorStroke="#D946EF" anchorFill="#fff" anchorSize={10}
              />
            </Layer>
          </Stage>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 w-full flex-wrap justify-center" style={{ maxWidth: 540 }}>
          <button onClick={() => addText()} className="flex-1 min-w-[80px] py-2.5 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 text-[11px] font-bold hover:bg-fuchsia-500/30 transition border border-fuchsia-500/30">+ Texto</button>
          <button onClick={undo} className="py-2.5 px-3 rounded-xl bg-white/5 text-[#71717A] text-[11px] font-bold border border-white/10 hover:text-white transition" title="Desfazer (Ctrl+Z)">↩</button>
          <button onClick={redo} className="py-2.5 px-3 rounded-xl bg-white/5 text-[#71717A] text-[11px] font-bold border border-white/10 hover:text-white transition" title="Refazer (Ctrl+Y)">↪</button>
          <button onClick={handleDownload} disabled={downloading || (!photo1 && texts.length === 0)} className="flex-1 min-w-[80px] py-2.5 rounded-xl font-bold text-[11px] text-white transition-all disabled:opacity-40" style={{ background: "linear-gradient(135deg,#D946EF,#8B5CF6)" }}>
            {downloading ? "Gerando…" : `Baixar ${format === "feed" ? "Feed" : "Stories"}`}
          </button>
          <button onClick={() => setPanelOpen(!panelOpen)} className="lg:hidden py-2.5 px-3 rounded-xl bg-white/5 text-[#A1A1AA] text-[11px] font-bold border border-white/10 hover:text-white transition">
            {panelOpen ? "✕" : "⚙"}
          </button>
        </div>

        <p className="text-[10px] text-[#52525B] text-center">Arraste no canvas · Ctrl+Z desfazer · Delete apagar</p>
      </div>

      {/* ── Side Panel ── */}
      <div className={`lg:w-80 shrink-0 flex flex-col gap-0 ${panelOpen ? "block" : "hidden lg:flex"}`}>

        {/* Tabs */}
        <div className="flex bg-[#0A0A0A] rounded-t-2xl border border-white/5 border-b-0 p-1 gap-1">
          {([["text", "🔤 Texto"], ["visual", "🎨 Visual"], ["templates", "📋 Templates"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as typeof tab)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition ${tab === key ? "bg-white/10 text-white" : "text-[#71717A] hover:text-white"}`}
            >{label}</button>
          ))}
        </div>

        <div className="bg-[#0A0A0A] border border-white/5 rounded-b-2xl p-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* ── TAB: Text ── */}
          {tab === "text" && (
            <>
              {/* Upload */}
              <Section title={mode === "single" ? "Foto de fundo" : "Fotos"}>
                <UploadSlot label={mode === "split" ? "Esquerda" : "Foto"} preview={photo1} onChange={e => handleUpload(1, e)} onClear={() => setPhoto1(null)} />
                {mode === "split" && <UploadSlot label="Direita" preview={photo2} onChange={e => handleUpload(2, e)} onClear={() => setPhoto2(null)} />}
              </Section>

              {/* Frases prontas */}
              <Section title="Frases prontas">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PHRASES.map((p, i) => (
                    <button key={i} onClick={() => addText({ text: p.text, fontSize: p.fontSize, bgColor: p.bgColor ?? "", bgPadding: p.bgColor ? 14 : 16 })}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white/5 text-[#A1A1AA] hover:text-white hover:bg-fuchsia-500/20 transition border border-transparent hover:border-fuchsia-500/30 truncate max-w-full"
                    >{p.text}</button>
                  ))}
                </div>
              </Section>

              {/* Stickers */}
              <Section title="Stickers">
                <div className="flex flex-wrap gap-1.5">
                  {STICKER_EMOJIS.map(e => (
                    <button key={e} onClick={() => addSticker(e)} className="w-9 h-9 rounded-lg bg-white/5 text-lg hover:bg-white/10 transition flex items-center justify-center">{e}</button>
                  ))}
                </div>
              </Section>

              {/* Text list */}
              <Section title={`Textos (${texts.length})`}>
                {texts.length === 0 && <p className="text-[11px] text-[#52525B] text-center py-2">Clique &quot;+ Texto&quot; ou uma frase pronta</p>}
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {texts.map(t => (
                    <div key={t.id} onClick={() => setSelectedId(t.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition border cursor-pointer ${selectedId === t.id ? "bg-fuchsia-500/20 border-fuchsia-500/30" : "bg-white/5 border-transparent hover:border-white/10"}`}
                    >
                      <input type="text" value={t.text}
                        onChange={ev => pushHistory(texts.map(x => x.id === t.id ? { ...x, text: ev.target.value || " " } : x))}
                        onFocus={() => setSelectedId(t.id)}
                        className="flex-1 bg-transparent text-[11px] text-[#FAFAFA] outline-none min-w-0" placeholder="Texto..."
                      />
                      <button onClick={ev => { ev.stopPropagation(); pushHistory(texts.filter(x => x.id !== t.id)); if (selectedId === t.id) setSelectedId(null); }}
                        className="shrink-0 w-5 h-5 rounded text-[10px] text-red-400 hover:bg-red-500/20 flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Selected text properties */}
              {selected && (
                <Section title="Propriedades">
                  {/* Actions row */}
                  <div className="flex gap-1.5 mb-2">
                    <button onClick={duplicateSelected} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 text-[#A1A1AA] hover:text-white transition">Duplicar</button>
                    <button onClick={() => moveLayer(-1)} className="py-1.5 px-2.5 rounded-lg text-[10px] font-bold bg-white/5 text-[#A1A1AA] hover:text-white transition" title="Camada abaixo">↓</button>
                    <button onClick={() => moveLayer(1)} className="py-1.5 px-2.5 rounded-lg text-[10px] font-bold bg-white/5 text-[#A1A1AA] hover:text-white transition" title="Camada acima">↑</button>
                    <button onClick={deleteSelected} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Deletar</button>
                  </div>

                  {/* Font family */}
                  <div>
                    <p className="text-[10px] text-[#71717A] mb-1">Fonte</p>
                    <div className="flex flex-wrap gap-1">
                      {FONTS.map(f => (
                        <button key={f.value} onClick={() => patchSelected({ fontFamily: f.value })}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition border ${selected.fontFamily === f.value ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border-transparent"}`}
                          style={{ fontFamily: f.value }}
                        >{f.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Font size */}
                  <div>
                    <p className="text-[10px] text-[#71717A] mb-1">Tamanho: {selected.fontSize}px</p>
                    <div className="flex gap-1 flex-wrap">
                      {FONT_SIZES.map(s => (
                        <button key={s} onClick={() => patchSelected({ fontSize: s })}
                          className={`w-8 h-6 rounded-lg text-[10px] font-bold transition ${selected.fontSize === s ? "bg-fuchsia-500/30 text-fuchsia-200" : "bg-white/5 text-[#71717A] hover:text-white"}`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>

                  {/* Style & Align */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] text-[#71717A] mb-1">Estilo</p>
                      <div className="flex gap-1">
                        {(["normal", "bold", "italic", "bold italic"] as const).map(s => (
                          <button key={s} onClick={() => patchSelected({ fontStyle: s })}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition border ${selected.fontStyle === s ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] border-transparent"}`}
                          >{s === "normal" ? "Aa" : s === "bold" ? "B" : s === "italic" ? "I" : "BI"}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-[#71717A] mb-1">Alinhamento</p>
                      <div className="flex gap-1">
                        {(["left", "center", "right"] as const).map(a => (
                          <button key={a} onClick={() => patchSelected({ align: a })}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition border ${selected.align === a ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] border-transparent"}`}
                          >{a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <p className="text-[10px] text-[#71717A] mb-1">Cor do texto</p>
                    <div className="flex flex-wrap gap-1">
                      {BRAND_COLORS.map(c => (
                        <button key={c} onClick={() => patchSelected({ fill: c })} title={c}
                          className={`w-6 h-6 rounded-md transition ${selected.fill === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : "hover:scale-110"}`}
                          style={{ background: c, border: c === "#FFFFFF" || c === "#FAFAFA" ? "1px solid rgba(255,255,255,0.15)" : undefined }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stroke */}
                  <div>
                    <p className="text-[10px] text-[#71717A] mb-1">Contorno</p>
                    <div className="flex gap-1.5 items-center">
                      {["", "#000000", "#FFFFFF", "#D946EF", "#DC2626"].map(c => (
                        <button key={c} onClick={() => patchSelected({ stroke: c, strokeWidth: c ? 3 : 0 })}
                          className={`w-6 h-6 rounded-md transition border ${selected.stroke === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : ""} ${!c ? "border-white/20 text-[8px] text-[#71717A]" : "border-transparent"}`}
                          style={c ? { background: c } : undefined}
                        >{!c ? "✕" : ""}</button>
                      ))}
                      {selected.stroke && (
                        <input type="range" min={1} max={8} value={selected.strokeWidth}
                          onChange={e => patchSelected({ strokeWidth: Number(e.target.value) })}
                          className="flex-1 h-1 accent-fuchsia-500"
                        />
                      )}
                    </div>
                  </div>

                  {/* Shadow */}
                  <button onClick={() => patchSelected({ shadowEnabled: !selected.shadowEnabled })}
                    className={`w-full py-1.5 rounded-xl text-[10px] font-bold transition border ${selected.shadowEnabled ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-white/5 text-[#71717A] border-transparent"}`}
                  >{selected.shadowEnabled ? "Sombra ativada" : "Sombra desativada"}</button>

                  {/* Badge background */}
                  <div>
                    <p className="text-[10px] text-[#71717A] mb-1">Fundo/Badge</p>
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => patchSelected({ bgColor: "" })}
                        className={`w-6 h-6 rounded-md border text-[8px] text-[#71717A] transition ${!selected.bgColor ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A] border-white/20" : "border-white/10"}`}
                      >✕</button>
                      {["#000000", "#D946EF", "#DC2626", "#059669", "#2563EB", "#F59E0B", "rgba(0,0,0,0.6)"].map(c => (
                        <button key={c} onClick={() => patchSelected({ bgColor: c, bgPadding: 14, bgRadius: 12 })}
                          className={`w-6 h-6 rounded-md transition ${selected.bgColor === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : "hover:scale-110"}`}
                          style={{ background: c, border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Curved */}
                  <div>
                    <button onClick={() => patchSelected({ curved: !selected.curved })}
                      className={`w-full py-1.5 rounded-xl text-[10px] font-bold transition border ${selected.curved ? "bg-violet-500/10 text-violet-300 border-violet-500/30" : "bg-white/5 text-[#71717A] border-transparent"}`}
                    >{selected.curved ? "Texto curvo ativado" : "Texto curvo"}</button>
                    {selected.curved && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] text-[#52525B]">⌢</span>
                        <input type="range" min={-120} max={120} value={selected.curveAmount}
                          onChange={e => patchSelected({ curveAmount: Number(e.target.value) })}
                          className="flex-1 h-1 accent-violet-500"
                        />
                        <span className="text-[9px] text-[#52525B]">⌣</span>
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ── TAB: Visual ── */}
          {tab === "visual" && (
            <>
              <Section title="Overlay">
                <div className="grid grid-cols-3 gap-1.5">
                  {([["none", "Nenhum"], ["gradient-bottom", "Grad ↓"], ["gradient-top", "Grad ↑"], ["vignette", "Vinheta"], ["brand-warm", "Warm"], ["brand-cool", "Cool"]] as [Overlay, string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setOverlay(v)}
                      className={`py-2 rounded-xl text-[10px] font-bold transition border ${overlay === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border-transparent"}`}
                    >{label}</button>
                  ))}
                </div>
              </Section>

              <Section title="Moldura">
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {([["none", "Sem"], ["thin", "Fina"], ["thick", "Grossa"], ["double", "Dupla"]] as [Frame, string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setFrame(v)}
                      className={`py-2 rounded-xl text-[10px] font-bold transition border ${frame === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border-transparent"}`}
                    >{label}</button>
                  ))}
                </div>
                {frame !== "none" && (
                  <div className="flex flex-wrap gap-1">
                    <p className="text-[10px] text-[#71717A] w-full mb-0.5">Cor da moldura</p>
                    {["#FFFFFF", "#000000", "#D946EF", "#F59E0B", "#DC2626", "#10B981"].map(c => (
                      <button key={c} onClick={() => setFrameColor(c)}
                        className={`w-6 h-6 rounded-md transition ${frameColor === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : "hover:scale-110"}`}
                        style={{ background: c, border: c === "#FFFFFF" ? "1px solid rgba(255,255,255,0.15)" : undefined }}
                      />
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Logo / Marca d'água">
                <UploadSlot label="Logo" preview={logoSrc} onChange={e => handleUpload("logo", e)} onClear={() => setLogoSrc(null)} />
                {logoSrc && (
                  <div className="space-y-2 mt-2">
                    <div>
                      <p className="text-[10px] text-[#71717A] mb-1">Posição</p>
                      <div className="grid grid-cols-4 gap-1">
                        {([["tl", "↖ Esq"], ["tr", "↗ Dir"], ["bl", "↙ Esq"], ["br", "↘ Dir"]] as ["tl"|"tr"|"bl"|"br", string][]).map(([v, label]) => (
                          <button key={v} onClick={() => setLogoPos(v)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold transition border ${logoPos === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] border-transparent"}`}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#71717A] mb-1">Opacidade: {Math.round(logoOpacity * 100)}%</p>
                      <input type="range" min={10} max={100} value={Math.round(logoOpacity * 100)}
                        onChange={e => setLogoOpacity(Number(e.target.value) / 100)}
                        className="w-full h-1 accent-fuchsia-500"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#71717A] mb-1">Tamanho: {Math.round(logoScale * 100)}%</p>
                      <input type="range" min={5} max={40} value={Math.round(logoScale * 100)}
                        onChange={e => setLogoScale(Number(e.target.value) / 100)}
                        className="w-full h-1 accent-fuchsia-500"
                      />
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}

          {/* ── TAB: Templates ── */}
          {tab === "templates" && (
            <Section title="Layouts prontos">
              <p className="text-[10px] text-[#52525B] mb-2">Aplica textos e configurações. Suas fotos são mantidas.</p>
              <div className="space-y-2">
                {TEMPLATES.map((tpl, i) => (
                  <button key={i} onClick={() => applyTemplate(tpl)}
                    className="w-full text-left px-3 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/10 transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tpl.icon}</span>
                      <div>
                        <p className="text-[12px] font-bold text-[#FAFAFA] group-hover:text-fuchsia-300 transition">{tpl.name}</p>
                        <p className="text-[10px] text-[#52525B]">{tpl.format === "feed" ? "Feed" : "Stories"} · {tpl.mode === "split" ? "Antes/Depois" : "Foto única"} · {tpl.texts.length} textos</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  );
}

function ToggleGroup({ value, options, onChange }: { value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-[#121212] rounded-xl border border-white/10 p-0.5 gap-0.5">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${value === o.v ? "bg-white/10 text-white" : "text-[#71717A] hover:text-white"}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

function UploadSlot({ label, preview, onChange, onClear }: { label: string; preview: string | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-[10px] text-[#71717A] mb-1">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden h-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <button onClick={onClear} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center hover:bg-red-500/80 transition">×</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="w-full h-14 rounded-xl border-2 border-dashed border-white/10 text-[#52525B] text-[11px] flex items-center justify-center gap-2 hover:border-fuchsia-500/40 hover:text-[#A1A1AA] transition">
          Clique para enviar
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
