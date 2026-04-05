"use client";

import { useState } from "react";

interface HeadlineABTestProps {
  principal: string;
  variacao1?: string | null;
  variacao2?: string | null;
  onSelect?: (headline: string, variant: string) => void;
}

const variantColors = [
  { bg: "linear-gradient(135deg, #ec4899, #a855f7)", label: "A", tagBg: "#ec4899" },
  { bg: "linear-gradient(135deg, #3b82f6, #06b6d4)", label: "B", tagBg: "#3b82f6" },
  { bg: "linear-gradient(135deg, #f59e0b, #ef4444)", label: "C", tagBg: "#f59e0b" },
];

export default function HeadlineABTest({
  principal,
  variacao1,
  variacao2,
  onSelect,
}: HeadlineABTestProps) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const headlines = [
    { text: principal, angle: "Principal" },
    variacao1 ? { text: variacao1, angle: "Ângulo diferente" } : null,
    variacao2 ? { text: variacao2, angle: "Gatilho emocional" } : null,
  ].filter(Boolean) as { text: string; angle: string }[];

  if (headlines.length < 2) return null;

  const handleSelect = (idx: number) => {
    setSelectedVariant(idx);
    onSelect?.(headlines[idx].text, variantColors[idx].label);
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          🧪 A/B Testing — Headlines
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
        >
          {headlines.length} variações
        </span>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
            <path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" />
            <path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            Teste qual headline converte mais — poste versões diferentes e compare resultados
          </span>
        </div>

        {/* Headlines */}
        <div className="p-4 space-y-3" style={{ background: "var(--surface)" }}>
          {headlines.map((h, i) => (
            <div
              key={i}
              onClick={() => handleSelect(i)}
              className="relative rounded-xl p-4 cursor-pointer transition-all"
              style={{
                background: selectedVariant === i ? "var(--background)" : "transparent",
                border: selectedVariant === i
                  ? `2px solid ${variantColors[i].tagBg}`
                  : "1px solid var(--border)",
                boxShadow: selectedVariant === i
                  ? `0 4px 20px ${variantColors[i].tagBg}20`
                  : "none",
              }}
            >
              {/* Variant label */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                    style={{ background: variantColors[i].tagBg }}
                  >
                    {variantColors[i].label}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>
                    {h.angle}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedVariant === i && (
                    <span className="text-[10px] font-semibold" style={{ color: variantColors[i].tagBg }}>
                      ✅ Selecionada
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(h.text, i); }}
                    className="text-[10px] px-2 py-1 rounded-md font-medium transition-all"
                    style={{
                      background: copiedIdx === i ? "var(--success)" : "var(--brand-100)",
                      color: copiedIdx === i ? "white" : "var(--brand-700)",
                    }}
                  >
                    {copiedIdx === i ? "✓ Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* Headline text */}
              <p
                className="text-sm font-semibold leading-relaxed"
                style={{ color: "var(--foreground)" }}
              >
                &ldquo;{h.text}&rdquo;
              </p>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div
          className="px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border)", background: "var(--background)", color: "var(--muted)" }}
        >
          💡 <strong>Dica:</strong> Use a variação A no feed e B nos stories.
          Compare curtidas e vendas após 48h para descobrir qual funciona melhor.
        </div>
      </div>
    </div>
  );
}
