"use client";

// react-konva é importado diretamente — SSR já está desabilitado pelo
// dynamic({ ssr: false }) no EditorClient.tsx que carrega este componente.
import { useRef, useState, useEffect } from "react";
import Konva from "konva";
import { Stage, Layer, Image as KImage, Text as KText, Rect, Line, Transformer } from "react-konva";

// ─── Constantes ──────────────────────────────────────────────────────────────
const BRAND_COLORS = [
  "#FFFFFF", "#000000",
  "#D946EF", "#A21CAF",
  "#EC4899", "#BE185D",
  "#8B5CF6", "#6D28D9",
  "#F59E0B", "#D97706",
  "#10B981", "#059669",
  "#F87171", "#DC2626",
  "#60A5FA", "#2563EB",
];

const FONT_SIZES = [18, 24, 32, 40, 52, 64, 80, 96];
const CANVAS_W = 1080;
const FEED_H   = 1350;
const STORY_H  = 1920;

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface TextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontStyle: string;
  align: "left" | "center" | "right";
  shadowEnabled: boolean;
  width: number;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Componente principal ─────────────────────────────────────────────────────
export default function InstagramEditor() {
  const [format, setFormat]           = useState<"feed" | "story">("feed");
  const [mode, setMode]               = useState<"single" | "split">("single");
  const [photo1, setPhoto1]           = useState<string | null>(null);
  const [photo2, setPhoto2]           = useState<string | null>(null);
  const [texts, setTexts]             = useState<TextItem[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [dividerStyle, setDividerStyle] = useState<"line" | "gradient" | "none">("gradient");
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing]         = useState<string | null>(null);
  const [editValue, setEditValue]     = useState("");
  const [scale, setScale]             = useState(0.4);

  const stageRef      = useRef<Konva.Stage>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textNodesRef  = useRef<Map<string, Konva.Text>>(new Map());

  const canvasH = format === "feed" ? FEED_H : STORY_H;

  // Ajusta escala ao container
  useEffect(() => {
    function update() {
      if (!containerRef.current) return;
      setScale(Math.min((containerRef.current.clientWidth - 2) / CANVAS_W, 0.45));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Atualiza Transformer quando a seleção muda
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedId ? textNodesRef.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId]);

  // Carrega imagens como HTMLImageElement para o Konva
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

  // Calcula posição/tamanho para cobrir o slot (object-cover)
  function coverProps(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const nw = img.naturalWidth * s;
    const nh = img.naturalHeight * s;
    return { x: x + (w - nw) / 2, y: y + (h - nh) / 2, width: nw, height: nh };
  }

  function handleUpload(slot: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    slot === 1 ? setPhoto1(url) : setPhoto2(url);
  }

  function addText() {
    const item: TextItem = {
      id: uid(), text: "Toque para editar",
      x: CANVAS_W / 2 - 300, y: canvasH * 0.1,
      fontSize: 64, fill: "#FFFFFF", fontStyle: "bold",
      align: "center", shadowEnabled: true, width: 600,
    };
    setTexts(p => [...p, item]);
    setSelectedId(item.id);
  }

  function patchSelected(patch: Partial<TextItem>) {
    if (!selectedId) return;
    setTexts(p => p.map(t => t.id === selectedId ? { ...t, ...patch } : t));
  }

  function patchById(id: string, patch: Partial<TextItem>) {
    setTexts(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  function deleteSelected() {
    setTexts(p => p.filter(t => t.id !== selectedId));
    setSelectedId(null);
  }

  function startEdit(item: TextItem) {
    if (!textNodesRef.current.has(item.id) || !stageRef.current) return;
    setEditing(item.id);
    setEditValue(item.text);
    setSelectedId(null);
  }

  function commitEdit() {
    if (!editing) return;
    patchById(editing, { text: editValue || " " });
    setEditing(null);
  }

  function textareaStyle(item: TextItem): React.CSSProperties {
    if (!stageRef.current || !containerRef.current) return {};
    const sb = stageRef.current.container().getBoundingClientRect();
    const cb = containerRef.current.getBoundingClientRect();
    return {
      position: "absolute",
      top:  sb.top  - cb.top  + item.y * scale,
      left: sb.left - cb.left + item.x * scale,
      width: item.width * scale,
      fontSize: item.fontSize * scale,
      fontWeight: item.fontStyle.includes("bold") ? "bold" : "normal",
      fontStyle: item.fontStyle.includes("italic") ? "italic" : "normal",
      textAlign: item.align,
      color: item.fill,
      background: "rgba(0,0,0,0.5)",
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

  async function handleDownload() {
    if (!stageRef.current) return;
    setDownloading(true);
    setSelectedId(null);
    setEditing(null);
    await new Promise(r => setTimeout(r, 120));
    try {
      const url = stageRef.current.toDataURL({ pixelRatio: 1 });
      const a = document.createElement("a");
      a.href = url;
      a.download = `crialook-${format}-${Date.now()}.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  const selected     = texts.find(t => t.id === selectedId) ?? null;
  const editingItem  = texts.find(t => t.id === editing) ?? null;
  const halfW        = CANVAS_W / 2;

  return (
    <div className="flex flex-col xl:flex-row gap-6">

      {/* ── Canvas ── */}
      <div className="flex-1 flex flex-col items-center gap-4">

        {/* Toggles */}
        <div className="flex gap-3 flex-wrap justify-center">
          <ToggleGroup
            value={format}
            options={[{ v: "feed", label: "Feed 4:5" }, { v: "story", label: "Stories 9:16" }]}
            onChange={(v) => setFormat(v as "feed" | "story")}
          />
          <ToggleGroup
            value={mode}
            options={[{ v: "single", label: "1 Foto" }, { v: "split", label: "Antes / Depois" }]}
            onChange={(v) => setMode(v as "single" | "split")}
          />
        </div>

        {/* Stage */}
        <div
          ref={containerRef}
          className="relative w-full max-w-[500px] select-none"
          style={{ touchAction: "none" }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_W * scale}
            height={canvasH * scale}
            scaleX={scale}
            scaleY={scale}
            style={{ borderRadius: 12, overflow: "hidden" }}
            onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          >
            <Layer>
              <Rect x={0} y={0} width={CANVAS_W} height={canvasH} fill="#111" />

              {/* Single photo */}
              {mode === "single" && img1 && (
                <KImage image={img1} {...coverProps(img1, 0, 0, CANVAS_W, canvasH)} />
              )}

              {/* Split photos */}
              {mode === "split" && img1 && (
                <KImage
                  image={img1}
                  {...coverProps(img1, 0, 0, halfW, canvasH)}
                  clipX={0} clipY={0} clipWidth={halfW} clipHeight={canvasH}
                />
              )}
              {mode === "split" && img2 && (
                <KImage
                  image={img2}
                  {...coverProps(img2, halfW, 0, halfW, canvasH)}
                  clipX={halfW} clipY={0} clipWidth={halfW} clipHeight={canvasH}
                />
              )}

              {/* Divider */}
              {mode === "split" && dividerStyle === "line" && (
                <Line points={[halfW, 0, halfW, canvasH]} stroke="white" strokeWidth={4} opacity={0.8} />
              )}
              {mode === "split" && dividerStyle === "gradient" && (
                <>
                  <Rect
                    x={halfW - 40} y={0} width={80} height={canvasH}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: 80, y: 0 }}
                    fillLinearGradientColorStops={[0, "rgba(0,0,0,0.4)", 0.5, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.4)"]}
                  />
                  <Line
                    points={[halfW, canvasH * 0.08, halfW, canvasH * 0.92]}
                    stroke="white" strokeWidth={3} opacity={0.6}
                  />
                </>
              )}

              {/* Text nodes */}
              {texts.map(item => editing === item.id ? null : (
                <KText
                  key={item.id}
                  ref={(n: Konva.Text | null) => {
                    if (n) textNodesRef.current.set(item.id, n);
                    else   textNodesRef.current.delete(item.id);
                  }}
                  x={item.x} y={item.y}
                  text={item.text}
                  fontSize={item.fontSize}
                  fill={item.fill}
                  fontFamily="Inter, Arial, sans-serif"
                  fontStyle={item.fontStyle}
                  align={item.align}
                  width={item.width}
                  draggable
                  shadowEnabled={item.shadowEnabled}
                  shadowColor="rgba(0,0,0,0.85)"
                  shadowBlur={14}
                  shadowOffsetX={2}
                  shadowOffsetY={2}
                  onClick={() => setSelectedId(item.id)}
                  onTap={() => setSelectedId(item.id)}
                  onDblClick={() => startEdit(item)}
                  onDblTap={() => startEdit(item)}
                  onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) =>
                    patchById(item.id, { x: e.target.x(), y: e.target.y() })}
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
              ))}

              <Transformer
                ref={transformerRef}
                enabledAnchors={["middle-left", "middle-right", "top-center", "bottom-center"]}
                boundBoxFunc={(_o: unknown, n: { width: number; height: number; x: number; y: number; rotation: number }) => n.width < 50 ? _o as typeof n : n}
                borderStroke="#D946EF"
                anchorStroke="#D946EF"
                anchorFill="#fff"
                anchorSize={10}
              />
            </Layer>
          </Stage>

          {/* Textarea inline */}
          {editing && editingItem && (
            <textarea
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === "Escape") commitEdit();
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitEdit();
              }}
              style={textareaStyle(editingItem)}
              rows={3}
            />
          )}
        </div>
      </div>

      {/* ── Painel de controles ── */}
      <div className="xl:w-72 flex flex-col gap-4">

        {/* Upload */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 space-y-3">
          <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">
            {mode === "single" ? "Foto de fundo" : "Fotos"}
          </p>
          <UploadSlot
            label={mode === "split" ? "Esquerda (manequim)" : "Foto"}
            preview={photo1}
            onChange={e => handleUpload(1, e)}
            onClear={() => setPhoto1(null)}
          />
          {mode === "split" && (
            <UploadSlot
              label="Direita (modelo)"
              preview={photo2}
              onChange={e => handleUpload(2, e)}
              onClear={() => setPhoto2(null)}
            />
          )}
        </div>

        {/* Divisória */}
        {mode === "split" && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-3">Divisória</p>
            <div className="flex gap-2">
              {(["none", "line", "gradient"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDividerStyle(d)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition border ${dividerStyle === d ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border-transparent"}`}
                >
                  {d === "none" ? "Nenhuma" : d === "line" ? "Linha" : "Gradiente"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Textos */}
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

          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {texts.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                onDoubleClick={() => startEdit(t)}
                className={`w-full text-left px-3 py-2 rounded-xl text-[12px] truncate transition border ${selectedId === t.id ? "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30" : "bg-white/5 text-[#A1A1AA] hover:text-white border-transparent"}`}
              >
                {t.text}
              </button>
            ))}
          </div>

          {/* Propriedades do texto selecionado */}
          {selected && (
            <div className="border-t border-white/5 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#71717A]">Selecionado</span>
                <button onClick={deleteSelected} className="text-[11px] text-red-400 hover:text-red-300 font-bold">Deletar</button>
              </div>

              {/* Tamanho */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Tamanho: {selected.fontSize}px</p>
                <div className="flex gap-1 flex-wrap">
                  {FONT_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => patchSelected({ fontSize: s })}
                      className={`w-9 h-7 rounded-lg text-[11px] font-bold transition ${selected.fontSize === s ? "bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estilo */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Estilo</p>
                <div className="flex gap-1.5">
                  {(["normal", "bold", "italic", "bold italic"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => patchSelected({ fontStyle: s })}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition border ${selected.fontStyle === s ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border-transparent"}`}
                    >
                      {s === "normal" ? "Aa" : s === "bold" ? "B" : s === "italic" ? "I" : "BI"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alinhamento */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Alinhamento</p>
                <div className="flex gap-1.5">
                  {(["left", "center", "right"] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => patchSelected({ align: a })}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition border ${selected.align === a ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" : "bg-white/5 text-[#71717A] hover:text-white border-transparent"}`}
                    >
                      {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sombra */}
              <button
                onClick={() => patchSelected({ shadowEnabled: !selected.shadowEnabled })}
                className={`w-full py-2 rounded-xl text-[11px] font-bold transition border ${selected.shadowEnabled ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-white/5 text-[#71717A] border-transparent hover:text-white"}`}
              >
                {selected.shadowEnabled ? "✓ Sombra ativada" : "Sombra"}
              </button>

              {/* Cores */}
              <div>
                <p className="text-[10px] text-[#71717A] mb-1.5">Cor</p>
                <div className="flex flex-wrap gap-1.5">
                  {BRAND_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => patchSelected({ fill: c })}
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

        {/* Baixar */}
        <button
          onClick={handleDownload}
          disabled={downloading || (!photo1 && texts.length === 0)}
          className="w-full py-4 rounded-2xl font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg,#D946EF,#8B5CF6)", color: "white", boxShadow: "0 4px 20px rgba(217,70,239,0.3)" }}
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

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function ToggleGroup({
  value, options, onChange,
}: {
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-[#121212] rounded-xl border border-white/10 p-1 gap-1">
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${value === o.v ? "bg-white/10 text-white" : "text-[#71717A] hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function UploadSlot({
  label, preview, onChange, onClear,
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
          >×</button>
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
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
