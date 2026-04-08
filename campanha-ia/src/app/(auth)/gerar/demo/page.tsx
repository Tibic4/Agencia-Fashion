"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ─────────────────────────────────────────
   Types — v3 payload
───────────────────────────────────────── */
interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  durationMs: number;
}

interface OpusAnalise {
  produto: {
    nome_generico: string;
    tipo: string;
    cor_principal: string;
    cor_secundaria?: string;
    material: string;
    comprimento: string;
    estilo: string;
    detalhes_especiais?: string;
  };
  modelo: {
    tipo_corpo: string;
    pose_sugerida: string;
    expressao: string;
  };
  cenario: {
    tipo: string;
    descricao: string;
    iluminacao: string;
  };
  negative_prompt: string;
}

interface DicasPostagem {
  melhor_horario: string;
  hashtags: string[];
  cta: string;
  tom_legenda: string;
  caption_sugerida: string;
}

interface V3Result {
  success: boolean;
  campaignId?: string | null;
  data?: {
    analise: OpusAnalise;
    images: (GeneratedImage | null)[];
    prompts: string[];
    dicas_postagem: DicasPostagem;
    durationMs: number;
    successCount: number;
  };
}

/* ─────────────────────────────────────────
   Mini Icons
───────────────────────────────────────── */
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);
const IconStar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
);

/* ─────────────────────────────────────────
   Main Page
───────────────────────────────────────── */
export default function ResultadoCampanha() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<V3Result | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [loadingFromApi, setLoadingFromApi] = useState(false);

  useEffect(() => {
    // 1. Try sessionStorage first (fresh generation)
    try {
      const raw = sessionStorage.getItem("campaignResult");
      if (raw) {
        const parsed = JSON.parse(raw) as V3Result;
        setResult(parsed);
        const firstValid = parsed.data?.images?.findIndex(img => img !== null) ?? -1;
        if (firstValid >= 0) setSelectedIndex(firstValid);
        return;
      }
    } catch {
      // ignore
    }

    // 2. If no sessionStorage, try loading by campaign ID from URL
    const campaignId = searchParams.get("id");
    if (campaignId) {
      setLoadingFromApi(true);
      fetch(`/api/campaigns/${campaignId}`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(`Erro ${res.status}`)))
        .then(data => {
          if (data?.data) {
            setResult(data.data as V3Result);
            const firstValid = (data.data as V3Result).data?.images?.findIndex((img: GeneratedImage | null) => img !== null) ?? -1;
            if (firstValid >= 0) setSelectedIndex(firstValid);
          }
        })
        .catch(() => {
          // Campaign not found or error — will show empty state
        })
        .finally(() => setLoadingFromApi(false));
    }
  }, [searchParams]);

  const downloadImage = (img: GeneratedImage, idx: number) => {
    const link = document.createElement("a");
    link.href = `data:${img.mimeType};base64,${img.imageBase64}`;
    link.download = `crialook_foto_${idx + 1}.png`;
    link.click();
  };

  const copyCaption = async () => {
    const caption = result?.data?.dicas_postagem?.caption_sugerida;
    if (!caption) return;
    await navigator.clipboard.writeText(caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // ── Loading / empty ──
  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center space-y-4 px-6">
          {loadingFromApi ? (
            <>
              <div className="w-12 h-12 rounded-full border-4 border-t-transparent mx-auto animate-spin" style={{ borderColor: "var(--brand-200)", borderTopColor: "var(--brand-500)" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>Carregando campanha...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--gradient-card)" }}>
                <span className="text-2xl">📷</span>
              </div>
              <p className="text-sm font-semibold">Nenhum resultado encontrado</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Gere uma nova campanha para ver aqui</p>
            </>
          )}
          <button
            onClick={() => router.push("/gerar")}
            className="text-sm underline"
            style={{ color: "var(--brand-500)" }}
          >
            Voltar e gerar novamente
          </button>
        </div>
      </div>
    );
  }

  const data = result.data;
  const images = data?.images ?? [];
  const analise = data?.analise;
  const dicas = data?.dicas_postagem;
  const validImages = images.filter(Boolean) as GeneratedImage[];
  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => router.push("/gerar")}
          className="flex items-center gap-1.5 text-sm font-medium transition hover:opacity-70"
          style={{ color: "var(--muted)" }}
        >
          <IconBack />
          Nova campanha
        </button>
        <div className="flex-1" />
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}>
          ✨ {validImages.length} foto{validImages.length !== 1 ? "s" : ""} gerada{validImages.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* ── Título ── */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Suas fotos estão prontas! 🎉</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {analise?.produto?.nome_generico && `${analise.produto.nome_generico} · `}
            Escolha a melhor e faça download · {data?.durationMs ? `${(data.durationMs / 1000).toFixed(0)}s` : ""}
          </p>
        </div>

        {/* ── Grid 3 fotos ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img, idx) => (
            <div key={idx} className="space-y-2">
              <button
                onClick={() => img && setSelectedIndex(idx)}
                disabled={!img}
                className="w-full relative rounded-2xl overflow-hidden transition-all"
                style={{
                  aspectRatio: "3/4",
                  border: selectedIndex === idx
                    ? "3px solid var(--brand-500)"
                    : "2px solid var(--border)",
                  background: "var(--surface)",
                  boxShadow: selectedIndex === idx ? "0 0 0 4px var(--brand-100)" : "none",
                  opacity: img ? 1 : 0.4,
                  cursor: img ? "pointer" : "not-allowed",
                }}
              >
                {img ? (
                  <img
                    src={`data:${img.mimeType};base64,${img.imageBase64}`}
                    alt={`Foto ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl">❌</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Falhou</span>
                  </div>
                )}

                {/* Selecionado badge */}
                {selectedIndex === idx && img && (
                  <div
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "var(--brand-500)", color: "white" }}
                  >
                    <IconCheck />
                  </div>
                )}

                {/* Número */}
                <div
                  className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
                >
                  {idx + 1}
                </div>
              </button>

              {/* Download individual */}
              {img && (
                <button
                  onClick={() => downloadImage(img, idx)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <IconDownload />
                  Baixar foto {idx + 1}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ── Foto selecionada em destaque + botão principal ── */}
        {selectedImage && (
          <div
            className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <img
              src={`data:${selectedImage.mimeType};base64,${selectedImage.imageBase64}`}
              alt="Foto selecionada"
              className="w-32 h-40 object-cover rounded-xl flex-shrink-0"
            />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <IconStar />
                <span className="font-bold text-sm">Foto {(selectedIndex ?? 0) + 1} selecionada</span>
              </div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Sua melhor foto para posts no Instagram, WhatsApp e Lojas Online.
              </p>
              <button
                onClick={() => downloadImage(selectedImage, selectedIndex ?? 0)}
                className="btn-primary flex items-center gap-2 w-full sm:w-auto px-6 py-3"
              >
                <IconDownload />
                Baixar foto selecionada
              </button>
            </div>
          </div>
        )}

        {/* ── Caption sugerida ── */}
        {dicas?.caption_sugerida && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">📝 Legenda sugerida</h2>
              <button
                onClick={copyCaption}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80"
                style={{ background: "var(--brand-100)", color: "var(--brand-700)", border: "1px solid var(--brand-200)" }}
              >
                {copiedCaption ? <><IconCheck /> Copiado!</> : <><IconCopy /> Copiar</>}
              </button>
            </div>
            <pre className="text-sm whitespace-pre-wrap break-words font-sans" style={{ color: "var(--foreground)", lineHeight: 1.65 }}>
              {dicas.caption_sugerida}
            </pre>
            {dicas.hashtags && dicas.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                {dicas.hashtags.slice(0, 20).map((tag, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "var(--brand-50)", color: "var(--brand-600)", border: "1px solid var(--brand-100)" }}
                  >
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Dicas adicionais ── */}
        {dicas && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl p-4 space-y-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--muted)" }}>⏰ MELHOR HORÁRIO</p>
              <p className="text-sm font-semibold">{dicas.melhor_horario || "Entre 18h–21h"}</p>
            </div>
            <div className="rounded-2xl p-4 space-y-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--muted)" }}>💬 TOM DA LEGENDA</p>
              <p className="text-sm font-semibold">{dicas.tom_legenda || "Descontraído e acolhedor"}</p>
            </div>
            <div className="rounded-2xl p-4 space-y-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--muted)" }}>📣 CTA SUGERIDO</p>
              <p className="text-sm font-semibold">{dicas.cta || "Chama no direct!"}</p>
            </div>
          </div>
        )}

        {/* ── Análise do produto (colapsável) ── */}
        {analise?.produto && (
          <details className="rounded-2xl overflow-hidden group" style={{ border: "1px solid var(--border)" }}>
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" style={{ background: "var(--surface)" }}>
              <span className="text-sm font-bold">🔍 Análise técnica do produto (Claude Opus)</span>
              <span className="text-xs group-open:rotate-180 transition-transform" style={{ color: "var(--muted)" }}>▼</span>
            </summary>
            <div className="px-5 pb-5 pt-3 space-y-3" style={{ background: "var(--surface)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Produto", value: analise.produto.nome_generico },
                  { label: "Tipo", value: analise.produto.tipo },
                  { label: "Cor principal", value: analise.produto.cor_principal },
                  { label: "Cor secundária", value: analise.produto.cor_secundaria },
                  { label: "Material", value: analise.produto.material },
                  { label: "Comprimento", value: analise.produto.comprimento },
                  { label: "Estilo", value: analise.produto.estilo },
                  { label: "Detalhes", value: analise.produto.detalhes_especiais },
                ]
                  .filter(f => f.value)
                  .map((f, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{f.label}</p>
                      <p className="text-sm font-semibold mt-0.5">{f.value}</p>
                    </div>
                  ))}
              </div>
              {analise.negative_prompt && (
                <div className="rounded-xl p-3" style={{ background: "var(--background)", border: "1px dashed var(--border)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Negative prompt usado</p>
                  <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>{analise.negative_prompt}</p>
                </div>
              )}
            </div>
          </details>
        )}

        {/* ── Nova campanha ── */}
        <div className="flex justify-center pb-8">
          <button
            onClick={() => router.push("/gerar")}
            className="btn-secondary px-8 py-3 text-sm font-semibold"
          >
            ✨ Gerar nova campanha
          </button>
        </div>
      </div>
    </div>
  );
}
