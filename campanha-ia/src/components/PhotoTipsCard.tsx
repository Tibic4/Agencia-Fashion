"use client";

import { useState, useEffect } from "react";

/**
 * PhotoTipsCard — "Guia Relâmpago ⚡"
 * Inline collapsible card with photo tips.
 * Auto-closes when user uploads a photo.
 */
export default function PhotoTipsCard({ hasPhoto }: { hasPhoto: boolean }) {
  const [open, setOpen] = useState(false);

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
                  "Envie mais de uma foto (frente + detalhe)",
                  "Peça esticada sobre superfície lisa",
                  "Luz natural ou ambiente bem iluminado",
                  "Mostre a peça inteira, sem cortar",
                  "Fundo limpo (branco, cinza, madeira)",
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
                  "Foto em manequim (a IA confunde com modelo)",
                  "Várias peças juntas na mesma foto",
                  "Peça amassada, dobrada ou enrolada",
                  "Foto escura ou com sombras pesadas",
                  "Fundo poluído com objetos ao redor",
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

          {/* Pro tip */}
          <div
            className="rounded-lg px-3 py-2 flex items-start gap-2"
            style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)" }}
          >
            <span className="text-sm shrink-0">💡</span>
            <p className="text-[11px]" style={{ color: "var(--brand-700)" }}>
              <strong>Dica pro:</strong> Quanto mais fotos e ângulos, melhor a IA entende sua peça. Use o campo &quot;Detalhe do tecido&quot; para enviar um close — o resultado fica muito mais realista!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

