"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptics } from "@/lib/utils/haptics";

interface BrandColorPickerProps {
  currentColor?: string;
  onColorSelected: (hex: string) => void;
  onClose: () => void;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export default function BrandColorPicker({ currentColor, onColorSelected, onClose }: BrandColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [pickedColor, setPickedColor] = useState<string>(currentColor || "");
  const [hoveredColor, setHoveredColor] = useState<string>("");
  const [manualHex, setManualHex] = useState(currentColor || "");
  const [mode, setMode] = useState<"upload" | "canvas" | "manual">("upload");
  const [closing, setClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    haptics.light();
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 300);
  };

  const drawImageOnCanvas = useCallback((file: File) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxW = 320;
      const maxH = 320;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h = (maxW / w) * h; w = maxW; }
      if (h > maxH) { w = (maxH / h) * w; h = maxH; }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      setImageLoaded(true);
      setMode("canvas");
      haptics.light();
    };
    img.src = URL.createObjectURL(file);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    setPickedColor(hex);
    setManualHex(hex);
    haptics.selection();
  }, []);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    setHoveredColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
  }, []);

  const handleCanvasTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((touch.clientX - rect.left) * scaleX);
    const y = Math.floor((touch.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    setPickedColor(hex);
    setManualHex(hex);
    setHoveredColor(hex);
    haptics.selection();
  }, []);

  const handleManualChange = (val: string) => {
    setManualHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setPickedColor(val.toUpperCase());
    }
  };

  const handleConfirm = () => {
    if (pickedColor) {
      haptics.medium();
      onColorSelected(pickedColor);
      handleClose();
    }
  };

  const [recentColors, setRecentColors] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("crialook_recent_colors");
      if (stored) setRecentColors(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const saveRecentColor = (color: string) => {
    const updated = [color, ...recentColors.filter(c => c !== color)].slice(0, 5);
    setRecentColors(updated);
    try { localStorage.setItem("crialook_recent_colors", JSON.stringify(updated)); } catch { /* */ }
  };

  return (
    <AnimatePresence>
      {!closing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden mt-8"
            style={{ background: "var(--background)", border: "1px solid var(--border)", boxShadow: "0 -10px 50px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-base font-bold">🎨 Cor da sua marca</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  Envie sua logo e toque para extrair a cor
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center min-h-[44px] min-w-[44px]"
                style={{ color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Canvas always in DOM so ref is available for drawImageOnCanvas */}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMove}
                onTouchStart={handleCanvasTouch}
                onTouchMove={handleCanvasTouch}
                className="rounded-xl max-w-full cursor-crosshair"
                style={{
                  border: "1px solid var(--border)",
                  maxHeight: "300px",
                  touchAction: "none",
                  display: mode === "canvas" ? "block" : "none",
                  margin: "0 auto",
                }}
              />

              {mode === "upload" && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) drawImageOnCanvas(file);
                      e.target.value = ''; // Reset for consecutive same-file selection
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-12 rounded-xl flex flex-col items-center gap-3 transition hover:opacity-80 cursor-pointer active:scale-[0.98]"
                    style={{ border: "2px dashed var(--border)", background: "var(--surface)" }}
                  >
                    <span className="text-4xl">📤</span>
                    <div className="text-center">
                      <p className="text-sm font-semibold">Envie sua logo ou criativo</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        JPG, PNG ou WebP
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => { haptics.light(); setMode("manual"); }}
                    className="w-full mt-3 py-2.5 text-xs font-medium rounded-lg transition"
                    style={{ color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    Já sei minha cor → digitar HEX
                  </button>
                </div>
              )}

              {mode === "canvas" && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-center" style={{ color: "var(--muted)" }}>
                    👆 Toque/clique na cor que deseja extrair
                  </p>

                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex gap-2">
                      {hoveredColor && (
                        <div className="text-center">
                          <div className="w-10 h-10 rounded-lg" style={{ background: hoveredColor, border: "1px solid var(--border)" }} />
                          <p className="text-2xs mt-0.5" style={{ color: "var(--muted)" }}>hover</p>
                        </div>
                      )}
                      {pickedColor && (
                        <div className="text-center">
                          <div className="w-10 h-10 rounded-lg" style={{ background: pickedColor, border: "2px solid var(--brand-500)" }} />
                          <p className="text-2xs mt-0.5 font-bold" style={{ color: "var(--brand-500)" }}>escolhida</p>
                        </div>
                      )}
                    </div>
                    {pickedColor && (
                      <div className="flex-1">
                        <p className="text-sm font-bold font-mono">{pickedColor}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>Cor selecionada</p>
                      </div>
                    )}
                    {!pickedColor && (
                      <p className="text-xs flex-1" style={{ color: "var(--muted)" }}>
                        Clique na imagem para capturar a cor
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => { haptics.light(); setMode("upload"); setImageLoaded(false); setPickedColor(""); }}
                    className="text-xs font-medium w-full py-2 rounded-lg transition"
                    style={{ color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    Trocar imagem
                  </button>
                </div>
              )}

              {mode === "manual" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={pickedColor || "#EC4899"}
                      onChange={(e) => { setPickedColor(e.target.value.toUpperCase()); setManualHex(e.target.value.toUpperCase()); }}
                      className="w-12 h-12 rounded-xl cursor-pointer border-none p-0"
                    />
                    <div className="flex-1">
                      <label className="text-xs font-semibold block mb-1">Código HEX</label>
                      <input
                        type="text"
                        value={manualHex}
                        onChange={(e) => handleManualChange(e.target.value)}
                        placeholder="#EC4899"
                        maxLength={7}
                        className="w-full h-10 px-3 rounded-lg text-sm font-mono outline-none"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                      />
                    </div>
                  </div>

                  {pickedColor && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="w-12 h-12 rounded-xl" style={{ background: pickedColor, border: "2px solid var(--brand-500)" }} />
                      <div>
                        <p className="text-sm font-bold">{pickedColor}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>Preview da cor</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { haptics.light(); setMode("upload"); }}
                    className="text-xs font-medium w-full py-2 rounded-lg transition"
                    style={{ color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    ← Voltar e enviar imagem
                  </button>
                </div>
              )}

              {recentColors.length > 0 && (
                <div>
                  <p className="text-2xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Cores recentes</p>
                  <div className="flex gap-2">
                    {recentColors.map((c) => (
                      <button
                        key={c}
                        onClick={() => { haptics.selection(); setPickedColor(c); setManualHex(c); }}
                        className="w-9 h-9 rounded-lg transition hover:scale-110"
                        style={{
                          background: c,
                          border: pickedColor === c ? "2px solid var(--brand-500)" : "1px solid var(--border)",
                          boxShadow: pickedColor === c ? "0 0 0 3px var(--brand-100)" : "none",
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={handleClose}
                className="flex-1 py-3 rounded-xl text-sm font-semibold min-h-[44px]"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { saveRecentColor(pickedColor); handleConfirm(); }}
                disabled={!pickedColor}
                className="flex-1 py-3 rounded-xl text-sm font-bold min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed transition"
                style={{ background: "var(--gradient-brand)", color: "white" }}
              >
                ✓ Usar esta cor
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
