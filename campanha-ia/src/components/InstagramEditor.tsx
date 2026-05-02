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
const FONT_SIZES = [24, 32, 40, 52, 64, 80, 96];
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
  { label: "Marker", value: "'Permanent Marker', cursive" },
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
  { text: "SÓ HOJE", fontSize: 64, bgColor: "#DC2626" },
  { text: "QUEIMA DE ESTOQUE", fontSize: 48, bgColor: "#F59E0B" },
  { text: "NOVIDADE", fontSize: 52, bgColor: "#8B5CF6" },
];

const STICKER_EMOJIS = ["🔥", "⭐", "✅", "💎", "🏷️", "➡️", "❤️", "💰", "🎯", "⚡", "👆", "🛒", "💥", "✨", "🚀"];

type Overlay = "none" | "gradient-bottom" | "gradient-top" | "vignette" | "brand-warm" | "brand-cool";
type Frame = "none" | "thin" | "thick" | "double";

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
    id: uid(), x: CANVAS_W / 2 - 300, y: canvasH * 0.08 + idx * 90,
    fontSize: 64, fill: "#FFFFFF", fontStyle: "bold", fontFamily: "Inter, sans-serif",
    align: "center", shadowEnabled: true, width: 600,
    stroke: "", strokeWidth: 0, bgColor: "", bgPadding: 16, bgRadius: 12,
    curved: false, curveAmount: 60, ...partial,
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
  const lines = item.text.split("\n").reduce((s, l) => s + Math.max(1, Math.ceil((l.length || 1) / charsPerLine)), 0);
  return lines * item.fontSize * 1.2;
}

// ─── Templates ───────────────────────────────────────────────────────────────
interface Template {
  name: string; icon: string;
  mode: "single" | "split"; format: "feed" | "story";
  overlay: Overlay; frame: Frame; frameColor: string;
  texts: Array<Partial<TextItem> & { text: string }>;
}

const TEMPLATES: Template[] = [
  {
    name: "Antes vs Depois", icon: "🔀",
    mode: "split", format: "feed", overlay: "gradient-bottom", frame: "none", frameColor: "#FFF",
    texts: [
      { text: "ANTES", x: 120, y: 60, fontSize: 52, bgColor: "#000", bgPadding: 14, align: "center", width: 300 },
      { text: "DEPOIS", x: 660, y: 60, fontSize: 52, bgColor: "#D946EF", bgPadding: 14, align: "center", width: 300 },
      { text: "RESULTADO REAL\nEM 5 MINUTOS", x: 190, y: 1120, fontSize: 64, align: "center", width: 700 },
    ],
  },
  {
    name: "Promo Feed", icon: "🏷️",
    mode: "single", format: "feed", overlay: "gradient-bottom", frame: "thick", frameColor: "#D946EF",
    texts: [
      { text: "QUEIMA\nDE ESTOQUE", x: 140, y: 100, fontSize: 96, fontFamily: "'Bebas Neue', cursive", align: "center", width: 800 },
      { text: "50% OFF", x: 240, y: 1050, fontSize: 80, bgColor: "#DC2626", bgPadding: 20, bgRadius: 16, align: "center", width: 600 },
      { text: "SÓ HOJE · LINK NA BIO", x: 190, y: 1220, fontSize: 36, fill: "#A1A1AA", align: "center", width: 700 },
    ],
  },
  {
    name: "Stories CTA", icon: "📱",
    mode: "single", format: "story", overlay: "gradient-top", frame: "none", frameColor: "#FFF",
    texts: [
      { text: "NOVIDADE", x: 290, y: 120, fontSize: 48, bgColor: "#D946EF", bgPadding: 14, align: "center", width: 500 },
      { text: "ARRASTE\nPARA CIMA", x: 190, y: 1650, fontSize: 64, align: "center", width: 700, fontFamily: "'Oswald', sans-serif" },
    ],
  },
  {
    name: "Depoimento", icon: "💬",
    mode: "single", format: "feed", overlay: "vignette", frame: "thin", frameColor: "#FFF",
    texts: [
      { text: "\"Melhor investimento\nque já fiz!\"", x: 90, y: 900, fontSize: 56, fontFamily: "'Playfair Display', serif", fontStyle: "italic", align: "center", width: 900 },
      { text: "— @cliente_real", x: 290, y: 1150, fontSize: 32, fill: "#A1A1AA", align: "center", width: 500 },
    ],
  },
  {
    name: "Resultado", icon: "📊",
    mode: "split", format: "feed", overlay: "gradient-bottom", frame: "none", frameColor: "#FFF",
    texts: [
      { text: "MANEQUIM", x: 120, y: 1100, fontSize: 36, bgColor: "rgba(0,0,0,0.6)", bgPadding: 10, align: "center", width: 300 },
      { text: "MODELO IA", x: 660, y: 1100, fontSize: 36, bgColor: "#D946EF", bgPadding: 10, align: "center", width: 300 },
      { text: "QUAL VENDE MAIS?", x: 140, y: 1220, fontSize: 56, align: "center", width: 800, fontFamily: "'Oswald', sans-serif" },
    ],
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// Componente principal
// ═════════════════════════════════════════════════════════════════════════════
export default function InstagramEditor() {
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [mode, setMode] = useState<"single" | "split">("single");
  const [photo1, setPhoto1] = useState<string | null>(null);
  const [photo2, setPhoto2] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dividerStyle, setDividerStyle] = useState<"line" | "gradient" | "none">("gradient");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [frame, setFrame] = useState<Frame>("none");
  const [frameColor, setFrameColor] = useState("#FFFFFF");
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState<"tl" | "tr" | "bl" | "br">("br");
  const [logoOpacity, setLogoOpacity] = useState(0.8);
  const [logoScale, setLogoScale] = useState(0.15);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale] = useState(0.22);
  const [tab, setTab] = useState<"text" | "visual" | "templates">("text");
  const [mobileOpen, setMobileOpen] = useState(false);

  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const quickPhotoRef = useRef<HTMLInputElement>(null);
  const quickPhoto2Ref = useRef<HTMLInputElement>(null);
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

  // Google Fonts
  useEffect(() => {
    if (document.getElementById("editor-gfonts")) return;
    const link = document.createElement("link");
    link.id = "editor-gfonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Montserrat:wght@400;700;900&family=Poppins:wght@400;700&family=Bangers&family=Permanent+Marker&display=swap";
    document.head.appendChild(link);
  }, []);

  // Restore saved logo from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("editor_logo");
      if (saved) setLogoSrc(saved);
    } catch {}
  }, []);

  // Scale — fill container width, on mobile also constrain by height
  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth - 2;
    const scaleByW = containerW / CANVAS_W;
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      // Cap canvas at ~46% of viewport height so controls stay visible
      const maxCanvasH = window.innerHeight * 0.46;
      const scaleByH = maxCanvasH / canvasH;
      setScale(Math.min(scaleByW, scaleByH));
    } else {
      setScale(scaleByW);
    }
  }, [canvasH]);
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
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === "Delete" && selectedIdRef.current) {
        pushHistory(textsRef.current.filter(t => t.id !== selectedIdRef.current));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
   
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
    const el = new window.Image(); el.src = src; el.onload = () => setter(el);
  }

  function coverProps(img: HTMLImageElement, slotW: number, slotH: number) {
    const s = Math.max(slotW / img.naturalWidth, slotH / img.naturalHeight);
    const nw = img.naturalWidth * s, nh = img.naturalHeight * s;
    return { x: (slotW - nw) / 2, y: (slotH - nh) / 2, width: nw, height: nh };
  }

  function handleUpload(slot: 1 | 2 | "logo", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (slot === "logo") {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLogoSrc(dataUrl);
        try { localStorage.setItem("editor_logo", dataUrl); } catch {}
      };
      reader.readAsDataURL(file);
    } else {
      const url = URL.createObjectURL(file);
      if (slot === 1) setPhoto1(url); else setPhoto2(url);
    }
  }

  function addText(partial?: Partial<TextItem> & { text: string }) {
    const item = makeText(partial ?? { text: "SEU TEXTO" }, canvasH, texts.length);
    pushHistory([...texts, item]);
    setSelectedId(item.id);
    setTab("text");
  }

  function addSticker(emoji: string) {
    const item = makeText({ text: emoji, fontSize: 96, width: 120, shadowEnabled: false }, canvasH, texts.length);
    item.x = CANVAS_W / 2 - 60;
    pushHistory([...texts, item]);
    setSelectedId(item.id);
  }

  function patchSelected(patch: Partial<TextItem>) {
    if (!selectedId) return;
    pushHistory(texts.map(t => t.id === selectedId ? { ...t, ...patch } : t));
  }

  function patchById(id: string, patch: Partial<TextItem>) {
    setTexts(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function deleteSelected() { pushHistory(texts.filter(t => t.id !== selectedId)); setSelectedId(null); }

  function duplicateSelected() {
    const src = texts.find(t => t.id === selectedId); if (!src) return;
    const dup = { ...src, id: uid(), x: src.x + 30, y: src.y + 30 };
    pushHistory([...texts, dup]); setSelectedId(dup.id);
  }

  function moveLayer(dir: -1 | 1) {
    const idx = texts.findIndex(t => t.id === selectedId); if (idx < 0) return;
    const target = idx + dir; if (target < 0 || target >= texts.length) return;
    const arr = [...texts]; [arr[idx], arr[target]] = [arr[target], arr[idx]];
    pushHistory(arr);
  }

  function applyTemplate(tpl: Template) {
    setMode(tpl.mode); setFormat(tpl.format); setOverlay(tpl.overlay);
    setFrame(tpl.frame); setFrameColor(tpl.frameColor);
    pushHistory(tpl.texts.map((t, i) => makeText(t, tpl.format === "feed" ? FEED_H : STORY_H, i)));
    setSelectedId(null);
  }

  async function handleDownload() {
    if (!stageRef.current) return;
    setDownloading(true); setSelectedId(null);
    await new Promise(r => setTimeout(r, 150));
    try {
      const url = stageRef.current.toDataURL({ pixelRatio: 1 });
      const a = document.createElement("a"); a.href = url;
      a.download = `crialook-${format}-${Date.now()}.png`; a.click();
    } finally { setDownloading(false); }
  }

  const selected = texts.find(t => t.id === selectedId) ?? null;
  const halfW = CANVAS_W / 2;
  const logoPad = 40;
  const logoW = CANVAS_W * logoScale;
  const logoH = logoImg ? logoW * (logoImg.naturalHeight / logoImg.naturalWidth) : 0;
  const logoXY = { tl: { x: logoPad, y: logoPad }, tr: { x: CANVAS_W - logoW - logoPad, y: logoPad }, bl: { x: logoPad, y: canvasH - logoH - logoPad }, br: { x: CANVAS_W - logoW - logoPad, y: canvasH - logoH - logoPad } }[logoPos];

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col md:flex-row gap-3 md:gap-5">

      {/* ═══ Coluna do Canvas ═══ */}
      <div className="flex-1 flex flex-col items-center gap-2 pb-28 md:pb-0 overflow-x-hidden">

        {/* Toggles */}
        <div className="flex gap-2 flex-wrap justify-center w-full px-1">
          <Toggle value={format} options={[["feed", "Feed 4:5"], ["story", "Story 9:16"]]} onChange={v => setFormat(v as "feed" | "story")} />
          <Toggle value={mode} options={[["single", "1 Foto"], ["split", "2 Fotos"]]} onChange={v => setMode(v as "single" | "split")} />
          {mode === "split" && <Toggle value={dividerStyle} options={[["none", "—"], ["line", "│"], ["gradient", "▓"]]} onChange={v => setDividerStyle(v as "line" | "gradient" | "none")} />}
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="relative w-full select-none" style={{ touchAction: "none", maxWidth: 560 }}>
          <Stage ref={stageRef} width={CANVAS_W * scale} height={canvasH * scale} scaleX={scale} scaleY={scale}
            style={{ borderRadius: 10, overflow: "hidden", background: "#111" }}
            onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}
            onTouchStart={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          >
            <Layer>
              <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#111" />

              {mode === "single" && img1 && <KImage image={img1} {...coverProps(img1, CANVAS_W, canvasH)} />}
              {mode === "split" && img1 && <Group clipX={0} clipY={0} clipWidth={halfW} clipHeight={canvasH}><KImage image={img1} {...coverProps(img1, halfW, canvasH)} /></Group>}
              {mode === "split" && img2 && <Group clipX={0} clipY={0} clipWidth={halfW} clipHeight={canvasH} x={halfW}><KImage image={img2} {...coverProps(img2, halfW, canvasH)} /></Group>}

              {mode === "split" && dividerStyle === "line" && <Line points={[halfW, 0, halfW, canvasH]} stroke="white" strokeWidth={4} opacity={0.8} />}
              {mode === "split" && dividerStyle === "gradient" && (
                <>
                  <Rect x={halfW - 40} y={0} width={80} height={canvasH}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 80, y: 0 }}
                    fillLinearGradientColorStops={[0, "rgba(0,0,0,0.4)", 0.5, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.4)"]} />
                  <Line points={[halfW, canvasH * 0.08, halfW, canvasH * 0.92]} stroke="white" strokeWidth={3} opacity={0.6} />
                </>
              )}

              {/* Overlays */}
              {overlay === "gradient-bottom" && <Rect x={0} y={canvasH * 0.5} width={CANVAS_W} height={canvasH * 0.5} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: canvasH * 0.5 }} fillLinearGradientColorStops={[0, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.75)"]} />}
              {overlay === "gradient-top" && <Rect x={0} y={0} width={CANVAS_W} height={canvasH * 0.4} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 0, y: canvasH * 0.4 }} fillLinearGradientColorStops={[0, "rgba(0,0,0,0.7)", 1, "rgba(0,0,0,0)"]} />}
              {overlay === "vignette" && <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fillRadialGradientStartPoint={{ x: CANVAS_W / 2, y: canvasH / 2 }} fillRadialGradientEndPoint={{ x: CANVAS_W / 2, y: canvasH / 2 }} fillRadialGradientStartRadius={CANVAS_W * 0.3} fillRadialGradientEndRadius={CANVAS_W * 0.9} fillRadialGradientColorStops={[0, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.6)"]} />}
              {overlay === "brand-warm" && <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#D946EF" opacity={0.15} />}
              {overlay === "brand-cool" && <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#6D28D9" opacity={0.18} />}

              {/* Logo */}
              {logoImg && <KImage image={logoImg} x={logoXY.x} y={logoXY.y} width={logoW} height={logoH} opacity={logoOpacity} />}

              {/* Texts */}
              {texts.map(item => (
                <Group key={item.id}>
                  {item.bgColor && (
                    <Rect x={item.x - item.bgPadding} y={item.y - item.bgPadding}
                      width={item.width + item.bgPadding * 2} height={estimateTextHeight(item) + item.bgPadding * 2}
                      fill={item.bgColor} cornerRadius={item.bgRadius} />
                  )}
                  {item.curved ? (
                    <Group x={item.x} y={item.y} draggable
                      onClick={() => setSelectedId(item.id)} onTap={() => setSelectedId(item.id)}
                      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => patchById(item.id, { x: e.target.x(), y: e.target.y() })}>
                      <TextPath data={arcPath(item.width, item.curveAmount)} text={item.text}
                        fontSize={item.fontSize} fill={item.fill} fontFamily={item.fontFamily} fontStyle={item.fontStyle}
                        shadowEnabled={item.shadowEnabled} shadowColor="rgba(0,0,0,0.85)" shadowBlur={14} shadowOffsetX={2} shadowOffsetY={2}
                        stroke={item.stroke || undefined} strokeWidth={item.strokeWidth || undefined} />
                    </Group>
                  ) : (
                    <KText
                      ref={(n: Konva.Text | null) => { if (n) textNodesRef.current.set(item.id, n); else textNodesRef.current.delete(item.id); }}
                      x={item.x} y={item.y} text={item.text} fontSize={item.fontSize} fill={item.fill}
                      fontFamily={item.fontFamily} fontStyle={item.fontStyle} align={item.align} width={item.width} draggable
                      shadowEnabled={item.shadowEnabled} shadowColor="rgba(0,0,0,0.85)" shadowBlur={14} shadowOffsetX={2} shadowOffsetY={2}
                      stroke={item.stroke || undefined} strokeWidth={item.strokeWidth || undefined}
                      onClick={() => setSelectedId(item.id)} onTap={() => setSelectedId(item.id)}
                      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => patchById(item.id, { x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
                        const n = e.target;
                        patchById(item.id, { x: n.x(), y: n.y(), width: Math.max(50, n.width() * n.scaleX()), fontSize: Math.max(12, Math.round(item.fontSize * n.scaleY())) });
                        n.scaleX(1); n.scaleY(1);
                      }}
                    />
                  )}
                </Group>
              ))}

              {/* Frame */}
              {frame === "thin" && <Rect x={0} y={0} width={CANVAS_W} height={canvasH} stroke={frameColor} strokeWidth={6} listening={false} />}
              {frame === "thick" && <Rect x={12} y={12} width={CANVAS_W - 24} height={canvasH - 24} stroke={frameColor} strokeWidth={16} cornerRadius={8} listening={false} />}
              {frame === "double" && (<><Rect x={8} y={8} width={CANVAS_W - 16} height={canvasH - 16} stroke={frameColor} strokeWidth={4} listening={false} /><Rect x={20} y={20} width={CANVAS_W - 40} height={canvasH - 40} stroke={frameColor} strokeWidth={2} listening={false} /></>)}

              <Transformer ref={transformerRef} enabledAnchors={["middle-left", "middle-right", "top-center", "bottom-center"]}
                boundBoxFunc={(_o: unknown, n: { width: number; height: number; x: number; y: number; rotation: number }) => n.width < 50 ? _o as typeof n : n}
                borderStroke="#D946EF" anchorStroke="#D946EF" anchorFill="#fff" anchorSize={12} />
            </Layer>
          </Stage>
        </div>

        {/* ── Quick Bar (always visible) ── */}
        <input ref={quickPhotoRef} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(1, e)} />
        {mode === "split" && <input ref={quickPhoto2Ref} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(2, e)} />}
        <div className="flex gap-2 w-full flex-wrap justify-center" style={{ maxWidth: 560 }}>
          <Btn onClick={() => quickPhotoRef.current?.click()} accent>{photo1 ? "🔄 Foto" : "📷 Foto"}</Btn>
          {mode === "split" && <Btn onClick={() => quickPhoto2Ref.current?.click()} accent>{photo2 ? "🔄 Foto 2" : "📷 Foto 2"}</Btn>}
          <Btn onClick={() => addText()} accent>+ Texto</Btn>
          <Btn onClick={undo} title="Ctrl+Z">↩</Btn>
          <Btn onClick={redo} title="Ctrl+Y">↪</Btn>
          <Btn onClick={handleDownload} disabled={downloading || (!photo1 && texts.length === 0)} gradient>
            {downloading ? "…" : "⬇ Baixar"}
          </Btn>
        </div>

        {/* ── Selected text quick-edit (mobile-friendly) ── */}
        {selected && (
          <div className="w-full rounded-2xl bg-[#0A0A0A] border border-fuchsia-500/30 p-3 space-y-2.5 max-h-[50vh] md:max-h-none overflow-y-auto" style={{ maxWidth: 560 }}>
            {/* Text input — big, always accessible */}
            <input
              type="text" value={selected.text}
              onChange={e => pushHistory(texts.map(t => t.id === selectedId ? { ...t, text: e.target.value || " " } : t))}
              className="w-full bg-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none border border-white/10 focus:border-fuchsia-500/50 transition"
              placeholder="Digite o texto…"
            />

            {/* Font — horizontal scroll */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-1.5 w-max">
                {FONTS.map(f => (
                  <button key={f.value} onClick={() => patchSelected({ fontFamily: f.value })}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition border whitespace-nowrap ${selected.fontFamily === f.value ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}
                    style={{ fontFamily: f.value }}>{f.label}</button>
                ))}
              </div>
            </div>

            {/* Size — horizontal scroll */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-1.5 w-max items-center">
                <span className="text-2xs text-muted-foreground shrink-0 mr-1">Tamanho</span>
                {FONT_SIZES.map(s => (
                  <button key={s} onClick={() => patchSelected({ fontSize: s })}
                    className={`shrink-0 w-10 h-9 rounded-xl text-xs font-bold transition ${selected.fontSize === s ? "bg-fuchsia-500/30 text-fuchsia-200" : "bg-white/5 text-muted-foreground active:bg-white/10"}`}>{s}</button>
                ))}
              </div>
            </div>

            {/* Style + Align + Shadow row */}
            <div className="flex gap-1.5 flex-wrap">
              {(["normal", "bold", "italic", "bold italic"] as const).map(s => (
                <button key={s} onClick={() => patchSelected({ fontStyle: s })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${selected.fontStyle === s ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}>
                  {s === "normal" ? "Aa" : s === "bold" ? "B" : s === "italic" ? "I" : "BI"}
                </button>
              ))}
              <div className="w-px bg-white/10" />
              {(["left", "center", "right"] as const).map(a => (
                <button key={a} onClick={() => patchSelected({ align: a })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${selected.align === a ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}>
                  {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
                </button>
              ))}
              <div className="w-px bg-white/10" />
              <button onClick={() => patchSelected({ shadowEnabled: !selected.shadowEnabled })}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${selected.shadowEnabled ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}>
                Sombra
              </button>
            </div>

            {/* Colors — horizontal scroll */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-1.5 w-max items-center">
                <span className="text-2xs text-muted-foreground shrink-0 mr-1">Cor</span>
                {BRAND_COLORS.map(c => (
                  <button key={c} onClick={() => patchSelected({ fill: c })} title={c}
                    className={`shrink-0 w-8 h-8 rounded-lg transition ${selected.fill === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A] scale-110" : "active:scale-110"}`}
                    style={{ background: c, border: c === "#FFFFFF" || c === "#FAFAFA" ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.05)" }} />
                ))}
              </div>
            </div>

            {/* Contorno */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-1.5 w-max items-center">
                <span className="text-2xs text-muted-foreground shrink-0 mr-1">Contorno</span>
                {["", "#000000", "#FFFFFF", "#D946EF", "#DC2626", "#F59E0B"].map(c => (
                  <button key={c} onClick={() => patchSelected({ stroke: c, strokeWidth: c ? 3 : 0 })}
                    className={`shrink-0 w-8 h-8 rounded-lg transition border ${selected.stroke === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : ""} ${!c ? "border-white/20 text-xs text-muted-foreground" : "border-white/5"}`}
                    style={c ? { background: c } : undefined}>{!c ? "✕" : ""}</button>
                ))}
                {selected.stroke && <input type="range" min={1} max={8} value={selected.strokeWidth} onChange={e => patchSelected({ strokeWidth: Number(e.target.value) })} className="w-20 h-1 accent-fuchsia-500 shrink-0" />}
              </div>
            </div>

            {/* Badge fundo */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-1.5 w-max items-center">
                <span className="text-2xs text-muted-foreground shrink-0 mr-1">Badge</span>
                <button onClick={() => patchSelected({ bgColor: "" })}
                  className={`shrink-0 w-8 h-8 rounded-lg border text-xs text-muted-foreground transition ${!selected.bgColor ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A] border-white/20" : "border-white/10"}`}>✕</button>
                {["#000000", "#D946EF", "#DC2626", "#059669", "#2563EB", "#F59E0B", "rgba(0,0,0,0.6)"].map(c => (
                  <button key={c} onClick={() => patchSelected({ bgColor: c, bgPadding: 14, bgRadius: 12 })}
                    className={`shrink-0 w-8 h-8 rounded-lg transition ${selected.bgColor === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : "active:scale-110"}`}
                    style={{ background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
                ))}
              </div>
            </div>

            {/* Curvo */}
            <div className="flex gap-1.5 items-center">
              <button onClick={() => patchSelected({ curved: !selected.curved })}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${selected.curved ? "bg-violet-500/10 text-violet-300 border-violet-500/30" : "bg-white/5 text-muted-foreground border-transparent"}`}>
                Curvo
              </button>
              {selected.curved && <input type="range" min={-120} max={120} value={selected.curveAmount} onChange={e => patchSelected({ curveAmount: Number(e.target.value) })} className="flex-1 h-1 accent-violet-500" />}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <Btn onClick={duplicateSelected}>Duplicar</Btn>
              <Btn onClick={() => moveLayer(-1)}>↓ Camada</Btn>
              <Btn onClick={() => moveLayer(1)}>↑ Camada</Btn>
              <Btn onClick={deleteSelected} danger>Deletar</Btn>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Desktop Sidebar (hidden on mobile) ═══ */}
      <div className="hidden md:flex md:w-72 lg:w-80 shrink-0 flex-col gap-0">
        <div className="flex bg-[#0A0A0A] rounded-t-2xl border border-white/5 border-b-0 p-1 gap-1">
          {([["text", "🔤 Texto"], ["visual", "🎨 Visual"], ["templates", "📋 Layouts"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as typeof tab)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${tab === key ? "bg-white/10 text-white" : "text-muted-foreground active:bg-white/5"}`}>{label}</button>
          ))}
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-b-2xl p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {tab === "text" && (
            <>
              <Section title={mode === "single" ? "Foto" : "Fotos"}>
                <UploadSlot label={mode === "split" ? "Esquerda" : "Foto"} preview={photo1} onChange={e => handleUpload(1, e)} onClear={() => setPhoto1(null)} />
                {mode === "split" && <UploadSlot label="Direita" preview={photo2} onChange={e => handleUpload(2, e)} onClear={() => setPhoto2(null)} />}
              </Section>
              <Section title="Frases prontas">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PHRASES.map((p, i) => (
                    <button key={i} onClick={() => addText({ text: p.text, fontSize: p.fontSize, bgColor: p.bgColor ?? "", bgPadding: p.bgColor ? 14 : 16 })}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground hover:text-white active:bg-fuchsia-500/20 transition border border-transparent active:border-fuchsia-500/30 truncate max-w-full">
                      {p.text}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Stickers">
                <div className="flex flex-wrap gap-1.5">
                  {STICKER_EMOJIS.map(e => (
                    <button key={e} onClick={() => addSticker(e)}
                      className="w-10 h-10 rounded-xl bg-white/5 text-lg active:bg-white/10 transition flex items-center justify-center">{e}</button>
                  ))}
                </div>
              </Section>
              <Section title={`Textos (${texts.length})`}>
                {texts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Adicione textos acima</p>}
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {texts.map(t => (
                    <div key={t.id} onClick={() => setSelectedId(t.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition border cursor-pointer ${selectedId === t.id ? "bg-fuchsia-500/20 border-fuchsia-500/30" : "bg-white/5 border-transparent active:border-white/20"}`}>
                      <span className="text-xs text-foreground truncate flex-1">{t.text}</span>
                      <button onClick={ev => { ev.stopPropagation(); pushHistory(texts.filter(x => x.id !== t.id)); if (selectedId === t.id) setSelectedId(null); }}
                        className="shrink-0 w-7 h-7 rounded-lg text-sm text-red-400 active:bg-red-500/20 flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
          {tab === "visual" && (
            <>
              <Section title="Overlay">
                <div className="grid grid-cols-3 gap-1.5">
                  {([["none", "Nenhum"], ["gradient-bottom", "Grad ↓"], ["gradient-top", "Grad ↑"], ["vignette", "Vinheta"], ["brand-warm", "Warm"], ["brand-cool", "Cool"]] as [Overlay, string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setOverlay(v)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition border ${overlay === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}>{label}</button>
                  ))}
                </div>
              </Section>
              <Section title="Moldura">
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {([["none", "Sem"], ["thin", "Fina"], ["thick", "Grossa"], ["double", "Dupla"]] as [Frame, string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setFrame(v)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition border ${frame === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}>{label}</button>
                  ))}
                </div>
                {frame !== "none" && (
                  <div className="flex flex-wrap gap-1.5">
                    {["#FFFFFF", "#000000", "#D946EF", "#F59E0B", "#DC2626", "#10B981"].map(c => (
                      <button key={c} onClick={() => setFrameColor(c)}
                        className={`w-8 h-8 rounded-lg transition ${frameColor === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : "active:scale-110"}`}
                        style={{ background: c, border: c === "#FFFFFF" ? "1px solid rgba(255,255,255,0.15)" : undefined }} />
                    ))}
                  </div>
                )}
              </Section>
              <Section title="Logo / Marca d&apos;água">
                <UploadSlot label="Logo" preview={logoSrc} onChange={e => handleUpload("logo", e)} onClear={() => { setLogoSrc(null); try { localStorage.removeItem("editor_logo"); } catch {} }} />
                {logoSrc && (
                  <div className="space-y-2 mt-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      {([["tl", "↖"], ["tr", "↗"], ["bl", "↙"], ["br", "↘"]] as ["tl" | "tr" | "bl" | "br", string][]).map(([v, icon]) => (
                        <button key={v} onClick={() => setLogoPos(v)}
                          className={`py-2 rounded-xl text-sm font-bold transition border ${logoPos === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent"}`}>{icon}</button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Opacidade <input type="range" min={10} max={100} value={Math.round(logoOpacity * 100)} onChange={e => setLogoOpacity(Number(e.target.value) / 100)} className="flex-1 h-1 accent-fuchsia-500" /> {Math.round(logoOpacity * 100)}%
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Tamanho <input type="range" min={5} max={40} value={Math.round(logoScale * 100)} onChange={e => setLogoScale(Number(e.target.value) / 100)} className="flex-1 h-1 accent-fuchsia-500" /> {Math.round(logoScale * 100)}%
                    </label>
                  </div>
                )}
              </Section>
            </>
          )}
          {tab === "templates" && (
            <Section title="Layouts prontos">
              <p className="text-xs text-muted-foreground mb-2">Aplica textos e visual. Fotos são mantidas.</p>
              <div className="space-y-2">
                {TEMPLATES.map((tpl, i) => (
                  <button key={i} onClick={() => applyTemplate(tpl)}
                    className="w-full text-left px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 active:border-fuchsia-500/40 active:bg-fuchsia-500/10 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{tpl.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-foreground">{tpl.name}</p>
                        <p className="text-xs text-muted-foreground">{tpl.format === "feed" ? "Feed" : "Stories"} · {tpl.mode === "split" ? "Antes/Depois" : "1 foto"} · {tpl.texts.length} textos</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* ═══ Mobile Bottom Sheet (hidden on desktop) ═══ */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col">
        {/* Expandable content — slides up above the tab bar */}
        {mobileOpen && (
          <div className="bg-[#0A0A0A]/98 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-4 space-y-4 max-h-[45vh] overflow-y-auto">
            {tab === "text" && (
              <>
                <Section title={mode === "single" ? "Foto" : "Fotos"}>
                  <UploadSlot label={mode === "split" ? "Esquerda" : "Foto"} preview={photo1} onChange={e => handleUpload(1, e)} onClear={() => setPhoto1(null)} />
                  {mode === "split" && <UploadSlot label="Direita" preview={photo2} onChange={e => handleUpload(2, e)} onClear={() => setPhoto2(null)} />}
                </Section>
                <Section title="Frases prontas">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_PHRASES.map((p, i) => (
                      <button key={i} onClick={() => { addText({ text: p.text, fontSize: p.fontSize, bgColor: p.bgColor ?? "", bgPadding: p.bgColor ? 14 : 16 }); setMobileOpen(false); }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground active:bg-fuchsia-500/20 transition border border-transparent active:border-fuchsia-500/30 truncate max-w-full">
                        {p.text}
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="Stickers">
                  <div className="flex flex-wrap gap-1.5">
                    {STICKER_EMOJIS.map(e => (
                      <button key={e} onClick={() => { addSticker(e); setMobileOpen(false); }}
                        className="w-10 h-10 rounded-xl bg-white/5 text-lg active:bg-white/10 transition flex items-center justify-center">{e}</button>
                    ))}
                  </div>
                </Section>
                <Section title={`Textos (${texts.length})`}>
                  {texts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Adicione textos acima</p>}
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {texts.map(t => (
                      <div key={t.id} onClick={() => { setSelectedId(t.id); setMobileOpen(false); }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition border cursor-pointer ${selectedId === t.id ? "bg-fuchsia-500/20 border-fuchsia-500/30" : "bg-white/5 border-transparent active:border-white/20"}`}>
                        <span className="text-xs text-foreground truncate flex-1">{t.text}</span>
                        <button onClick={ev => { ev.stopPropagation(); pushHistory(texts.filter(x => x.id !== t.id)); if (selectedId === t.id) setSelectedId(null); }}
                          className="shrink-0 w-7 h-7 rounded-lg text-sm text-red-400 active:bg-red-500/20 flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}
            {tab === "visual" && (
              <>
                <Section title="Overlay">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([["none", "Nenhum"], ["gradient-bottom", "Grad ↓"], ["gradient-top", "Grad ↑"], ["vignette", "Vinheta"], ["brand-warm", "Warm"], ["brand-cool", "Cool"]] as [Overlay, string][]).map(([v, label]) => (
                      <button key={v} onClick={() => setOverlay(v)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition border ${overlay === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}>{label}</button>
                    ))}
                  </div>
                </Section>
                <Section title="Moldura">
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {([["none", "Sem"], ["thin", "Fina"], ["thick", "Grossa"], ["double", "Dupla"]] as [Frame, string][]).map(([v, label]) => (
                      <button key={v} onClick={() => setFrame(v)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition border ${frame === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent active:bg-white/10"}`}>{label}</button>
                    ))}
                  </div>
                  {frame !== "none" && (
                    <div className="flex flex-wrap gap-1.5">
                      {["#FFFFFF", "#000000", "#D946EF", "#F59E0B", "#DC2626", "#10B981"].map(c => (
                        <button key={c} onClick={() => setFrameColor(c)}
                          className={`w-8 h-8 rounded-lg transition ${frameColor === c ? "ring-2 ring-fuchsia-400 ring-offset-1 ring-offset-[#0A0A0A]" : "active:scale-110"}`}
                          style={{ background: c, border: c === "#FFFFFF" ? "1px solid rgba(255,255,255,0.15)" : undefined }} />
                      ))}
                    </div>
                  )}
                </Section>
                <Section title="Logo / Marca d&apos;água">
                  <UploadSlot label="Logo" preview={logoSrc} onChange={e => handleUpload("logo", e)} onClear={() => { setLogoSrc(null); try { localStorage.removeItem("editor_logo"); } catch {} }} />
                  {logoSrc && (
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-4 gap-1.5">
                        {([["tl", "↖"], ["tr", "↗"], ["bl", "↙"], ["br", "↘"]] as ["tl" | "tr" | "bl" | "br", string][]).map(([v, icon]) => (
                          <button key={v} onClick={() => setLogoPos(v)}
                            className={`py-2 rounded-xl text-sm font-bold transition border ${logoPos === v ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-muted-foreground border-transparent"}`}>{icon}</button>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Opacidade <input type="range" min={10} max={100} value={Math.round(logoOpacity * 100)} onChange={e => setLogoOpacity(Number(e.target.value) / 100)} className="flex-1 h-1 accent-fuchsia-500" /> {Math.round(logoOpacity * 100)}%
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Tamanho <input type="range" min={5} max={40} value={Math.round(logoScale * 100)} onChange={e => setLogoScale(Number(e.target.value) / 100)} className="flex-1 h-1 accent-fuchsia-500" /> {Math.round(logoScale * 100)}%
                      </label>
                    </div>
                  )}
                </Section>
              </>
            )}
            {tab === "templates" && (
              <Section title="Layouts prontos">
                <p className="text-xs text-muted-foreground mb-2">Aplica textos e visual. Fotos são mantidas.</p>
                <div className="space-y-2">
                  {TEMPLATES.map((tpl, i) => (
                    <button key={i} onClick={() => { applyTemplate(tpl); setMobileOpen(false); }}
                      className="w-full text-left px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 active:border-fuchsia-500/40 active:bg-fuchsia-500/10 transition">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{tpl.icon}</span>
                        <div>
                          <p className="text-sm font-bold text-foreground">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground">{tpl.format === "feed" ? "Feed" : "Stories"} · {tpl.mode === "split" ? "Antes/Depois" : "1 foto"} · {tpl.texts.length} textos</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Tab bar — always visible at the very bottom */}
        <div className="flex bg-[#0A0A0A] border-t border-white/10 px-1.5 py-1.5 gap-1" style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
          {([["text", "🔤 Texto"], ["visual", "🎨 Visual"], ["templates", "📋"]] as const).map(([key, label]) => (
            <button key={key}
              onClick={() => { if (tab === key && mobileOpen) { setMobileOpen(false); } else { setTab(key as typeof tab); setMobileOpen(true); } }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${tab === key && mobileOpen ? "bg-fuchsia-500/20 text-fuchsia-300" : "text-muted-foreground active:bg-white/5"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="text-2xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{title}</p>{children}</div>;
}

function Toggle({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-[#121212] rounded-xl border border-white/10 p-0.5 gap-0.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all min-h-tap flex items-center justify-center ${value === v ? "bg-white/10 text-white" : "text-muted-foreground active:text-white"}`}>{label}</button>
      ))}
    </div>
  );
}

function Btn({ children, onClick, disabled, accent, gradient, danger, title }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  accent?: boolean; gradient?: boolean; danger?: boolean; title?: string;
}) {
  const base = "px-4 py-3 rounded-xl text-xs font-bold transition-all min-h-tap flex items-center justify-center";
  const cls = gradient
    ? `${base} text-white disabled:opacity-40`
    : accent
      ? `${base} bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 active:bg-fuchsia-500/30`
      : danger
        ? `${base} bg-red-500/10 text-red-400 border border-red-500/20 active:bg-red-500/20`
        : `${base} bg-white/5 text-muted-foreground border border-white/10 active:bg-white/10 active:text-white`;
  return (
    <button onClick={onClick} disabled={disabled} className={cls} title={title}
      style={gradient ? { background: "linear-gradient(135deg,#D946EF,#8B5CF6)" } : undefined}>
      {children}
    </button>
  );
}

function UploadSlot({ label, preview, onChange, onClear }: {
  label: string; preview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-2xs text-muted-foreground mb-1">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden h-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`Pré-visualização: ${label}`} className="w-full h-full object-cover" />
          <button onClick={onClear} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-sm flex items-center justify-center active:bg-red-500/80 transition">×</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()}
          className="w-full h-14 rounded-xl border-2 border-dashed border-white/10 text-muted-foreground text-xs flex items-center justify-center gap-2 active:border-fuchsia-500/40 transition">
          Toque para enviar
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
