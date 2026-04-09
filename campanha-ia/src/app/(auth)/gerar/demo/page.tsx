"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ─────────────────────────────────────────
   Types — v4 payload (Sonnet + FASHN)
───────────────────────────────────────── */
interface GeneratedImage {
  imageBase64?: string;
  imageUrl?: string;
  mimeType: string;
  conceptName?: string;
  prompt?: string;
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
  objective?: string | null;
  targetAudience?: string | null;
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
   Format Presets — client-side Canvas crop
───────────────────────────────────────── */
const FORMAT_PRESETS = [
  { id: "stories",   label: "Stories",       icon: "📱", w: 1080, h: 1920, ratio: "9:16" },
  { id: "feed45",    label: "Feed 4:5",      icon: "📸", w: 1080, h: 1350, ratio: "4:5" },
  { id: "whatsapp",  label: "WhatsApp",      icon: "💬", w: 1080, h: 1920, ratio: "9:16" },
] as const;

type FormatId = typeof FORMAT_PRESETS[number]["id"];

/** Crop & resize image using offscreen canvas (zero API cost) */
async function cropToFormat(
  imageSrc: string,
  targetW: number,
  targetH: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const targetRatio = targetW / targetH;
      const srcRatio = srcW / srcH;

      let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;

      if (srcRatio > targetRatio) {
        // Source is wider → crop sides
        cropW = Math.round(srcH * targetRatio);
        cropX = Math.round((srcW - cropW) / 2);
      } else {
        // Source is taller → crop top/bottom
        cropH = Math.round(srcW / targetRatio);
        cropY = Math.round((srcH - cropH) / 2);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      resolve(canvas.toDataURL("image/png", 1.0));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}

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
  const [activeFormat, setActiveFormat] = useState<FormatId>("stories");
  const [downloadingHQ, setDownloadingHQ] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // ── AI Tips (Gemini Flash Vision) ──
  interface SmartTips {
    poste_as: string;
    tom_da_voz: string;
    cta: string;
    dica_extra: string;
    hashtags: string[];
  }
  const [smartTips, setSmartTips] = useState<SmartTips | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsFetched, setTipsFetched] = useState<string | null>(null); // track which image was analyzed

  useEffect(() => {
    const campaignId = searchParams.get("id");

    // Reset state when campaign changes (prevents showing stale data)
    setResult(null);
    setSelectedIndex(null);
    setSmartTips(null);
    setTipsFetched(null);
    setPreviewDataUrl(null);
    setCopiedCaption(false);

    // 1. If URL has ?id=, ALWAYS load from API (history / shared links)
    if (campaignId) {
      setLoadingFromApi(true);
      fetch(`/api/campaigns/${campaignId}?t=${Date.now()}`)
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
      return;
    }

    // 2. No ?id= → fresh generation, use sessionStorage
    try {
      const raw = sessionStorage.getItem("campaignResult");
      if (raw) {
        const parsed = JSON.parse(raw) as V3Result;
        setResult(parsed);
        const firstValid = parsed.data?.images?.findIndex(img => img !== null) ?? -1;
        if (firstValid >= 0) setSelectedIndex(firstValid);
        // Clear sessionStorage after loading so next generation doesn't show stale data
        sessionStorage.removeItem("campaignResult");
      }
    } catch {
      // ignore
    }
  }, [searchParams]);

  const getImageSrc = (img: GeneratedImage) =>
    img.imageUrl || `data:${img.mimeType};base64,${img.imageBase64}`;

  const downloadImage = async (img: GeneratedImage, idx: number) => {
    const src = getImageSrc(img);
    if (img.imageUrl) {
      try {
        const resp = await fetch(img.imageUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `crialook_foto_${idx + 1}.png`;
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        window.open(img.imageUrl, "_blank");
      }
    } else {
      const link = document.createElement("a");
      link.href = src;
      link.download = `crialook_foto_${idx + 1}.png`;
      link.click();
    }
  };

  /** Download with format crop (Canvas) */
  const downloadFormatted = useCallback(async (img: GeneratedImage, idx: number, formatId: FormatId) => {
    setDownloadingHQ(true);
    try {
      const format = FORMAT_PRESETS.find(f => f.id === formatId) || FORMAT_PRESETS[0];
      const src = getImageSrc(img);
      const croppedDataUrl = await cropToFormat(src, format.w, format.h);

      const link = document.createElement("a");
      link.download = `crialook_foto_${idx + 1}_${format.id}_${format.w}x${format.h}.png`;
      link.href = croppedDataUrl;
      link.click();
    } catch (err) {
      console.error("Crop error:", err);
      // Fallback: download original
      downloadImage(img, idx);
    } finally {
      setDownloadingHQ(false);
    }
  }, []);

  /** Update preview when format or selected image changes */
  useEffect(() => {
    if (selectedIndex === null) { setPreviewDataUrl(null); return; }
    const img = result?.data?.images?.[selectedIndex];
    if (!img) { setPreviewDataUrl(null); return; }

    const format = FORMAT_PRESETS.find(f => f.id === activeFormat) || FORMAT_PRESETS[0];
    const src = getImageSrc(img);
    let cancelled = false;

    cropToFormat(src, format.w, format.h)
      .then(dataUrl => { if (!cancelled) setPreviewDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setPreviewDataUrl(null); });

    return () => { cancelled = true; };
  }, [selectedIndex, activeFormat, result]);

  /** Fetch AI tips when a photo is selected (lazy, once per image) */
  useEffect(() => {
    if (selectedIndex === null) return;
    const img = result?.data?.images?.[selectedIndex];
    if (!img) return;
    const src = img.imageUrl;
    if (!src) return;
    if (tipsFetched === src) return; // already fetched for this image

    const campaignId = searchParams.get("id") || result?.campaignId;
    if (!campaignId) return;

    setTipsLoading(true);
    fetch(`/api/campaign/${campaignId}/tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: src,
        objective: result?.objective || undefined,
        targetAudience: result?.targetAudience || undefined,
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.data) {
          setSmartTips(data.data);
          setTipsFetched(src);
        }
      })
      .catch(() => { /* silent fallback to static tips */ })
      .finally(() => setTipsLoading(false));
  }, [selectedIndex, result, tipsFetched, searchParams]);

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
              <p className="text-sm" style={{ color: "var(--muted)" }}>Carregando sua campanha…</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--gradient-card)" }}>
                <span className="text-2xl">📷</span>
              </div>
              <p className="text-sm font-semibold">Nenhuma campanha encontrada</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Crie uma nova campanha para ver suas fotos aqui</p>
            </>
          )}
          <button
            onClick={() => router.push("/gerar")}
            className="text-sm underline"
            style={{ color: "var(--brand-500)" }}
          >
            Criar nova campanha
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
    <div className="min-h-screen" style={{ background: "var(--background)", overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 -mx-4 px-4 py-3 flex items-center gap-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => router.push("/gerar")}
          className="flex items-center gap-1.5 text-sm font-medium transition hover:opacity-70 min-h-[44px]"
          style={{ color: "var(--muted)" }}
        >
          <IconBack />
          Voltar
        </button>
        <div className="flex-1" />
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}>
          ✨ {validImages.length} foto{validImages.length !== 1 ? "s" : ""} gerada{validImages.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="w-full max-w-5xl mx-auto px-0 sm:px-4 py-6 space-y-8" style={{ overflowX: "hidden" }}>

        {/* ── Título ── */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1">Suas fotos ficaram incríveis! 🎉</h1>
          <p className="text-xs sm:text-sm" style={{ color: "var(--muted)", wordBreak: "break-word" }}>
            {analise?.produto?.nome_generico && `${analise.produto.nome_generico} · `}
            Escolha a sua favorita e baixe para postar{data?.durationMs ? ` · gerado em ${(data.durationMs / 1000).toFixed(0)}s` : ""}
          </p>
        </div>

        {/* ── Foto Principal (mobile: hero + thumbs) ── */}
        <div>
          {/* Hero Image — mobile: full width, desktop: hidden (uses grid below) */}
          <div className="block sm:hidden">
            {selectedImage ? (
              <div
                className="relative rounded-2xl overflow-hidden w-full"
                style={{
                  aspectRatio: "3/4",
                  border: "3px solid var(--brand-500)",
                  boxShadow: "0 0 0 4px var(--brand-100)",
                  background: "var(--surface)",
                }}
              >
                <img
                  src={getImageSrc(selectedImage)}
                  alt={`Foto ${(selectedIndex ?? 0) + 1}`}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "var(--brand-500)", color: "white" }}
                >
                  <IconCheck />
                </div>
                <div
                  className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
                >
                  Foto {(selectedIndex ?? 0) + 1} de {validImages.length}
                </div>
              </div>
            ) : validImages[0] ? (
              <div
                className="relative rounded-2xl overflow-hidden w-full"
                style={{ aspectRatio: "3/4", background: "var(--surface)" }}
              >
                <img src={getImageSrc(validImages[0])} alt="Foto 1" className="w-full h-full object-cover" />
              </div>
            ) : null}

            {/* Thumbnail row — mobile only */}
            <div className="flex gap-2 mt-3 justify-center">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => img && setSelectedIndex(idx)}
                  disabled={!img}
                  className="relative rounded-xl overflow-hidden transition-all flex-shrink-0"
                  style={{
                    width: "72px",
                    height: "96px",
                    border: selectedIndex === idx
                      ? "3px solid var(--brand-500)"
                      : "2px solid var(--border)",
                    boxShadow: selectedIndex === idx ? "0 0 0 3px var(--brand-100)" : "none",
                    opacity: img ? 1 : 0.35,
                    cursor: img ? "pointer" : "not-allowed",
                  }}
                >
                  {img ? (
                    <img src={getImageSrc(img)} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--surface)" }}>
                      <span className="text-sm">❌</span>
                    </div>
                  )}
                  <div
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ background: "rgba(0,0,0,0.6)", color: "white" }}
                  >
                    {idx + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Desktop grid — 3 cols, hidden on mobile */}
          <div className="hidden sm:grid grid-cols-3 gap-4">
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
                    <img src={getImageSrc(img)} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <span className="text-3xl">❌</span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>Falhou</span>
                    </div>
                  )}
                  {selectedIndex === idx && img && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--brand-500)", color: "white" }}>
                      <IconCheck />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.55)", color: "white" }}>
                    {idx + 1}
                  </div>
                </button>
                {img && (
                  <button
                    onClick={() => downloadImage(img, idx)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    <IconDownload />
                    Baixar #{idx + 1}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Foto selecionada + Formato + Download ── */}
        {selectedImage && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <IconStar />
              <span className="font-bold text-sm">Foto {(selectedIndex ?? 0) + 1} selecionada</span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold ml-auto"
                style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}
              >
                {FORMAT_PRESETS.find(f => f.id === activeFormat)?.ratio}
              </span>
            </div>

            {/* Format selector — horizontal scroll, mobile-first */}
            <div
              className="px-3 sm:px-4 py-3 flex gap-2 overflow-x-auto"
              style={{ borderBottom: "1px solid var(--border)", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
            >
              {FORMAT_PRESETS.map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => setActiveFormat(fmt.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    minHeight: 48,
                    background: activeFormat === fmt.id ? "var(--gradient-brand)" : "var(--background)",
                    color: activeFormat === fmt.id ? "white" : "var(--muted)",
                    border: activeFormat === fmt.id ? "2px solid var(--brand-400)" : "1px solid var(--border)",
                    boxShadow: activeFormat === fmt.id ? "0 2px 8px rgba(var(--brand-rgb, 168, 85, 247), 0.3)" : "none",
                    transform: activeFormat === fmt.id ? "scale(1.03)" : "scale(1)",
                  }}
                >
                  <span className="text-base">{fmt.icon}</span>
                  <span>{fmt.label}</span>
                  <span className="text-[10px] opacity-70">{fmt.w}×{fmt.h}</span>
                </button>
              ))}
            </div>

            {/* Preview + download */}
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              {/* Cropped preview — hidden on mobile (hero already shows the photo) */}
              <div
                className="relative rounded-xl overflow-hidden flex-shrink-0 bg-black/5 hidden sm:block"
                style={{
                  width: 90,
                  aspectRatio: `${FORMAT_PRESETS.find(f => f.id === activeFormat)?.w || 1080} / ${FORMAT_PRESETS.find(f => f.id === activeFormat)?.h || 1920}`,
                  maxHeight: 160,
                }}
              >
                <img
                  src={previewDataUrl || getImageSrc(selectedImage)}
                  alt="Preview do formato"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: "rgba(0,0,0,0.6)", color: "white" }}
                >
                  {FORMAT_PRESETS.find(f => f.id === activeFormat)?.ratio}
                </div>
              </div>

              {/* Info + button */}
              <div className="flex-1 w-full min-w-0 space-y-2 sm:space-y-3">
                <div className="text-center sm:text-left">
                  <p className="text-sm font-semibold truncate">
                    {FORMAT_PRESETS.find(f => f.id === activeFormat)?.label} — {FORMAT_PRESETS.find(f => f.id === activeFormat)?.w}×{FORMAT_PRESETS.find(f => f.id === activeFormat)?.h}px
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {activeFormat === "stories" && "Ideal para Instagram Stories e Reels"}
                    {activeFormat === "feed45" && "Formato recomendado para Feed do Instagram"}
                    {activeFormat === "whatsapp" && "WhatsApp Status e catálogo pelo celular"}
                  </p>
                </div>
                <button
                  onClick={() => downloadFormatted(selectedImage, selectedIndex ?? 0, activeFormat)}
                  disabled={downloadingHQ}
                  className="btn-primary flex items-center justify-center gap-2 w-full px-6 py-3.5 text-sm"
                  style={{ minHeight: 48, opacity: downloadingHQ ? 0.6 : 1 }}
                >
                  {downloadingHQ ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Recortando...
                    </>
                  ) : (
                    <>
                      <IconDownload />
                      Baixar {FORMAT_PRESETS.find(f => f.id === activeFormat)?.label} HD
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Caption sugerida ── */}
        {dicas?.caption_sugerida && (
          <div className="rounded-2xl p-4 sm:p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-bold text-sm">📝 Legenda pronta para copiar</h2>
              <button
                onClick={copyCaption}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80 self-start sm:self-auto flex-shrink-0"
                style={{ background: "var(--brand-100)", color: "var(--brand-700)", border: "1px solid var(--brand-200)" }}
              >
                {copiedCaption ? <><IconCheck /> Copiado!</> : <><IconCopy /> Copiar</>}
              </button>
            </div>
            <pre className="text-xs sm:text-sm whitespace-pre-wrap break-words font-sans" style={{ color: "var(--foreground)", lineHeight: 1.65, overflowWrap: "anywhere", maxWidth: "100%" }}>
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

        {/* ── Dicas adicionais (AI-powered) ── */}
        {dicas && (
          <div className="space-y-3">
            {/* AI badge */}
            {smartTips && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full truncate" style={{ background: "var(--brand-100)", color: "var(--brand-700)", maxWidth: "100%" }}>✨ Dicas por IA</span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl p-3 sm:p-4 space-y-1 relative" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] sm:text-xs font-bold" style={{ color: "var(--muted)" }}>⏰ POSTE ÀS</p>
                {tipsLoading ? (
                  <div className="h-5 rounded-lg animate-pulse" style={{ background: "var(--border)", width: "60%" }} />
                ) : (
                  <p className="text-xs sm:text-sm font-semibold">{smartTips?.poste_as || dicas.melhor_horario || "Entre 18h–21h"}</p>
                )}
              </div>
              <div className="rounded-2xl p-3 sm:p-4 space-y-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] sm:text-xs font-bold" style={{ color: "var(--muted)" }}>💬 TOM DA VOZ</p>
                {tipsLoading ? (
                  <div className="h-5 rounded-lg animate-pulse" style={{ background: "var(--border)", width: "80%" }} />
                ) : (
                  <p className="text-xs sm:text-sm font-semibold">{smartTips?.tom_da_voz || dicas.tom_legenda || "Descontraído e acolhedor"}</p>
                )}
              </div>
              <div className="rounded-2xl p-3 sm:p-4 space-y-1 col-span-2 sm:col-span-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] sm:text-xs font-bold" style={{ color: "var(--muted)" }}>📣 CHAMADA PRA AÇÃO</p>
                {tipsLoading ? (
                  <div className="h-5 rounded-lg animate-pulse" style={{ background: "var(--border)", width: "70%" }} />
                ) : (
                  <p className="text-xs sm:text-sm font-semibold">{smartTips?.cta || dicas.cta || "Chama no direct!"}</p>
                )}
              </div>
            </div>
            {/* Dica extra do AI */}
            {smartTips?.dica_extra && (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)" }}>
                <span className="text-sm flex-shrink-0">💡</span>
                <p className="text-xs font-medium" style={{ color: "var(--brand-700)" }}>{smartTips.dica_extra}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Análise do produto (colapsável) ── */}
        {analise?.produto && (
          <details className="rounded-2xl overflow-hidden group" style={{ border: "1px solid var(--border)" }}>
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none" style={{ background: "var(--surface)" }}>
              <span className="text-sm font-bold">🔍 Como a IA analisou sua peça</span>
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
                <div className="rounded-xl p-3" style={{ background: "var(--background)", border: "1px dashed var(--border)", overflowX: "hidden" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Negative prompt usado</p>
                  <p className="text-xs font-mono" style={{ color: "var(--muted)", wordBreak: "break-all" }}>{analise.negative_prompt}</p>
                </div>
              )}
            </div>
          </details>
        )}

        {/* ── Nova campanha ── */}
        <div className="flex justify-center pb-24 sm:pb-8">
          <button
            onClick={() => router.push("/gerar")}
            className="btn-secondary px-8 py-3 text-sm font-semibold"
            style={{ minHeight: 48 }}
          >
            ✨ Criar mais fotos
          </button>
        </div>
      </div>
    </div>
  );
}
