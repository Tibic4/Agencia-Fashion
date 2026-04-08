"use client";

import { useState, useEffect } from "react";

interface ShowcaseTip {
  before_photo_url: string;
  after_photo_url: string;
  caption: string | null;
}

/**
 * PhotoTipsCard — "Guia Relâmpago ⚡"
 * Inline collapsible card with photo tips + before/after from admin Vitrine.
 * Auto-closes when user uploads a photo.
 */
export default function PhotoTipsCard({ hasPhoto }: { hasPhoto: boolean }) {
  const [open, setOpen] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseTip | null>(null);

  // Fetch the first showcase item from admin vitrine
  useEffect(() => {
    fetch("/api/showcase/tips")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setShowcase(d.data);
      })
      .catch(() => {});
  }, []);

  // Auto-close when user uploads
  useEffect(() => {
    if (hasPhoto && open) setOpen(false);
  }, [hasPhoto, open]);

  return (
    <div className="w-full">
      {/* Toggle link */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 mx-auto text-xs font-medium transition-colors"
        style={{
          color: open ? "var(--brand-500)" : "var(--muted)",
          minHeight: "44px",
        }}
      >
        <span style={{ fontSize: "14px" }}>📷</span>
        <span className="underline underline-offset-2 decoration-dotted">
          {open ? "Fechar dicas" : "Guia relâmpago: como tirar a foto ideal"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Collapsible card */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? "600px" : "0",
          opacity: open ? 1 : 0,
          marginTop: open ? "8px" : "0",
        }}
      >
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Header */}
          <div className="text-center">
            <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              ⚡ Guia Relâmpago
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Quanto melhor a foto, mais realista fica o resultado
            </p>
          </div>

          {/* Tips grid — stacked on mobile, side by side on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ✅ CERTO */}
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(16, 185, 129, 0.06)",
                border: "1px solid rgba(16, 185, 129, 0.15)",
              }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: "var(--success)" }}>
                ✅ Foto ideal
              </p>
              <ul className="space-y-1.5">
                {[
                  "Peça esticada sobre superfície lisa",
                  "Luz natural ou bem iluminada",
                  "Foto de frente, mostrando inteira",
                  "Fundo neutro (branco, cinza, madeira)",
                ].map((tip) => (
                  <li
                    key={tip}
                    className="text-xs flex items-start gap-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* ❌ EVITE */}
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(239, 68, 68, 0.06)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
              }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: "var(--error)" }}>
                ❌ Evite
              </p>
              <ul className="space-y-1.5">
                {[
                  "Peça amassada ou dobrada",
                  "Foto escura ou com sombras fortes",
                  "Peça cortada na imagem",
                  "Fundo poluído com objetos",
                ].map((tip) => (
                  <li
                    key={tip}
                    className="text-xs flex items-start gap-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    <span className="text-red-400 mt-0.5 shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Before/After from Vitrine (if admin uploaded one) */}
          {showcase && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="grid grid-cols-2 gap-0.5" style={{ background: "var(--border)" }}>
                <div className="relative">
                  <img
                    src={showcase.before_photo_url}
                    alt="Foto original"
                    className="w-full h-28 sm:h-36 object-cover"
                    style={{ background: "var(--background)" }}
                  />
                  <span
                    className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ background: "var(--warning)", color: "black" }}
                  >
                    ANTES
                  </span>
                </div>
                <div className="relative">
                  <img
                    src={showcase.after_photo_url}
                    alt="Resultado CriaLook"
                    className="w-full h-28 sm:h-36 object-cover"
                    style={{ background: "var(--background)" }}
                  />
                  <span
                    className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ background: "var(--success)", color: "white" }}
                  >
                    DEPOIS
                  </span>
                </div>
              </div>
              <div className="px-3 py-2 text-center" style={{ background: "var(--background)" }}>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {showcase.caption || "Veja o que a IA faz com uma boa foto ✨"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
