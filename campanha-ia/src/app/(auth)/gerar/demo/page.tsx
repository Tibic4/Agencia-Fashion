"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { haptics } from "@/lib/utils/haptics";

/* ─────────────────────────────────────────
   Types — pipeline payload (Sonnet + Gemini VTO)
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
  melhor_dia?: string;
  sequencia_sugerida?: string;
  hashtags: string[];
  cta: string;
  tom_legenda: string;
  caption_sugerida: string;
  caption_alternativa?: string;
  dica_extra?: string;
  story_idea?: string;
  legendas?: Array<{ foto: number; plataforma: string; legenda: string; hashtags?: string[]; dica?: string }>;
}

interface V3Result {
  success: boolean;
  campaignId?: string | null;
  objective?: string | null;
  targetAudience?: string | null;
  toneOverride?: string | null;
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
  { id: "stories",   label: "Stories / Zap", icon: "📱", w: 1080, h: 1920, ratio: "9:16", desc: "Stories, Reels e WhatsApp Status" },
  { id: "feed45",    label: "Feed 4:5",      icon: "📸", w: 1080, h: 1350, ratio: "4:5",  desc: "Post no Feed do Instagram" },
  { id: "feed11",    label: "Feed 1:1",      icon: "🖼️", w: 1080, h: 1080, ratio: "1:1",  desc: "Quadrado para Feed e catálogo" },
] as const;

type FormatId = typeof FORMAT_PRESETS[number]["id"];

/* Formatos de imagem:
   - Stories (9:16): saída padrão da IA, download direto sem processamento
   - Feed 4:5 / 1:1: endpoint `/api/campaign/format` (sharp) aplica
     contain (corpo inteiro) + blur nas laterais. ZERO alteração de cor.
   Web e mobile compartilham o mesmo endpoint. */

/* ─────────────────────────────────────────
   Main Page
───────────────────────────────────────── */
export default function ResultadoCampanha() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<V3Result | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [loadingFromApi, setLoadingFromApi] = useState(false);
  const [activeFormat, setActiveFormat] = useState<FormatId>("stories");
  const [downloadingHQ, setDownloadingHQ] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [showFormatSheet, setShowFormatSheet] = useState(false);

  // ── Copy tip actions ──
  const [copiedTip, setCopiedTip] = useState<string | null>(null);
  const [copyTab, setCopyTab] = useState(0); // 0=Feed, 1=WhatsApp, 2=Stories

  useEffect(() => {
    const campaignId = searchParams.get("id");

    // Reset state when campaign changes (prevents showing stale data)
    setResult(null);
    setSelectedIndex(null);
    setPreviewDataUrl(null);


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
        sessionStorage.removeItem("campaignResult");
        return;
      }
    } catch {
      // ignore
    }

    // 3. No sessionStorage either → load most recent campaign
    setLoadingFromApi(true);
    fetch("/api/campaigns?limit=1")
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`Erro ${res.status}`)))
      .then(data => {
        const latest = data?.data?.[0];
        if (latest?.id) {
          router.replace(`/gerar/demo?id=${latest.id}`);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFromApi(false));
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

  /**
   * Busca a imagem formatada — Stories retorna direto (saída padrão da IA),
   * Feed 4:5/1:1 chama o endpoint server-side que aplica contain + blur nas
   * laterais sem alterar cores. Web e mobile compartilham o mesmo endpoint.
   */
  const fetchFormatted = useCallback(async (img: GeneratedImage, formatId: FormatId): Promise<string> => {
    // Stories é a saída padrão da IA — baixa direto sem processamento
    if (formatId === "stories") {
      const src = getImageSrc(img);
      if (img.imageUrl) {
        const res = await fetch(img.imageUrl);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
      return src; // base64 data URL
    }

    // Feed 4:5 / 1:1 — endpoint aplica contain + blur nas laterais
    const body: Record<string, string> = { format: formatId };
    if (img.imageUrl) body.imageUrl = img.imageUrl;
    else if (img.imageBase64) body.imageBase64 = img.imageBase64;
    else throw new Error("Image has neither URL nor base64");

    const res = await fetch("/api/campaign/format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`format endpoint failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }, []);

  /** Download with format — Stories: direto, Feed: endpoint server-side */
  const downloadFormatted = useCallback(async (img: GeneratedImage, idx: number, formatId: FormatId) => {
    setDownloadingHQ(true);
    try {
      const format = FORMAT_PRESETS.find(f => f.id === formatId) || FORMAT_PRESETS[0];
      const objectUrl = await fetchFormatted(img, formatId);
      const ext = formatId === "stories" ? "png" : "jpg";
      const link = document.createElement("a");
      link.download = `crialook_foto_${idx + 1}_${format.id}_${format.w}x${format.h}.${ext}`;
      link.href = objectUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("Crop error:", err);
      downloadImage(img, idx);
    } finally {
      setDownloadingHQ(false);
    }
  }, [fetchFormatted]);

  /** Update preview when format or selected image changes */
  useEffect(() => {
    if (selectedIndex === null) { setPreviewDataUrl(null); return; }
    const img = result?.data?.images?.[selectedIndex];
    if (!img) { setPreviewDataUrl(null); return; }

    let cancelled = false;
    let createdUrl: string | null = null;

    fetchFormatted(img, activeFormat)
      .then(objectUrl => {
        if (cancelled) { URL.revokeObjectURL(objectUrl); return; }
        createdUrl = objectUrl;
        setPreviewDataUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setPreviewDataUrl(null); });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [selectedIndex, activeFormat, result, fetchFormatted]);

  /* Smart Tips removed — all copy now comes from the enriched analyzer dicas_postagem */



  // ── Loading / empty ──
  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)" }}>
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
    <div style={{ background: "var(--background)", overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 -mx-4 px-4 py-3 flex items-center gap-3 glass">
        <button
          onClick={() => router.back()}
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
        <div className="px-4 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 leading-tight">
            <span style={{
              background: "linear-gradient(135deg, var(--foreground) 0%, var(--brand-600) 60%, #a855f7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Suas fotos ficaram incríveis!
            </span>{" "}
            <span aria-hidden>🎉</span>
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: "var(--muted)", wordBreak: "break-word" }}>
            {analise?.produto?.nome_generico && `${analise.produto.nome_generico} · `}
            Escolha a sua favorita e baixe para postar{data?.durationMs ? ` · gerado em ${(data.durationMs / 1000).toFixed(0)}s` : ""}
          </p>
        </div>

        {/* ── Foto Principal (mobile: hero + thumbs) ── */}
        <div>
          {/* Hero Image — mobile: full width, desktop: hidden (uses grid below) */}
          <div className="block sm:hidden px-2">
            {selectedImage ? (
              <div
                className="relative rounded-2xl overflow-hidden w-full"
                style={{
                  aspectRatio: "3/4",
                  boxShadow: "0 0 0 1px var(--brand-500), 0 0 0 4px rgba(217,70,239,0.16), 0 20px 40px -16px rgba(217,70,239,0.24)",
                  background: "var(--surface)",
                }}
              >
                <img
                  src={getImageSrc(selectedImage)}
                  alt={`Foto ${(selectedIndex ?? 0) + 1}`}
                  className="w-full h-full object-cover object-top"
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
                <img src={getImageSrc(validImages[0])} alt="Foto 1" className="w-full h-full object-cover object-top" />
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
                    boxShadow: selectedIndex === idx
                      ? "0 0 0 1px var(--brand-500), 0 0 0 4px rgba(217,70,239,0.16), 0 8px 20px -8px rgba(217,70,239,0.32)"
                      : "0 0 0 1px var(--border)",
                    opacity: img ? 1 : 0.35,
                    cursor: img ? "pointer" : "not-allowed",
                  }}
                >
                  {img ? (
                    <img src={getImageSrc(img)} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--surface)" }}>
                      <span className="text-sm">❌</span>
                    </div>
                  )}
                  <div
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-2xs font-bold"
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
                    background: "var(--surface)",
                    boxShadow: selectedIndex === idx
                      ? "0 0 0 1px var(--brand-500), 0 0 0 5px rgba(217,70,239,0.18), 0 16px 36px -12px rgba(217,70,239,0.28)"
                      : "0 0 0 1px var(--border)",
                    opacity: img ? 1 : 0.4,
                    cursor: img ? "pointer" : "not-allowed",
                  }}
                >
                  {img ? (
                    <img src={getImageSrc(img)} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover object-top" loading="lazy" />
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
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-2xs font-bold" style={{ background: "rgba(0,0,0,0.55)", color: "white" }}>
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
          <div className="surface-card overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <IconStar />
              <span className="font-bold text-sm">Foto {(selectedIndex ?? 0) + 1} selecionada</span>
              <span
                className="text-2xs px-2 py-0.5 rounded-full font-semibold ml-auto"
                style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}
              >
                {FORMAT_PRESETS.find(f => f.id === activeFormat)?.ratio}
              </span>
            </div>

            {/* Format selector — BottomSheet trigger on mobile, horizontal list on desktop */}
            <div className="px-3 sm:px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              {/* Desktop: horizontal scroll */}
              <div
                className="hidden sm:flex gap-2 overflow-x-auto"
                style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
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
                    <span className="text-2xs opacity-70">{fmt.w}×{fmt.h}</span>
                  </button>
                ))}
              </div>

              {/* Mobile: button trigger for Bottom Sheet */}
              <div className="sm:hidden">
                <button
                  onClick={() => { haptics.light(); setShowFormatSheet(true); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: "var(--surface)" }}>
                      {FORMAT_PRESETS.find(f => f.id === activeFormat)?.icon}
                    </div>
                    <div className="text-left">
                      <p className="text-2xs font-bold tracking-wider uppercase mb-0.5" style={{ color: "var(--muted)" }}>Proporção e Crop</p>
                      <p className="text-sm font-bold leading-none" style={{ color: "var(--brand-600)" }}>
                        {FORMAT_PRESETS.find(f => f.id === activeFormat)?.label} ({FORMAT_PRESETS.find(f => f.id === activeFormat)?.ratio})
                      </p>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}>
                    Alterar
                  </div>
                </button>
              </div>
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
                  className="w-full h-full object-contain"
                />
                <div
                  className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-2xs font-bold"
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
                    {FORMAT_PRESETS.find(f => f.id === activeFormat)?.desc}
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
                      {activeFormat === "stories" ? "Baixando..." : "Adaptando..."}
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

        {/* ── Copy de Instagram (gerado pelo Sonnet) ── */}
        {dicas && (
          <div className="space-y-3">
            {/* AI Copy badge */}
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold px-2 py-0.5 rounded-full truncate" style={{ background: "linear-gradient(135deg, var(--brand-100), var(--brand-200))", color: "var(--brand-700)", maxWidth: "100%" }}>✨ Copy por IA</span>
            </div>

            {/* ── Legendas por plataforma (tabs) ── */}
            {dicas.legendas && dicas.legendas.length >= 3 ? (
              <div className="surface-card overflow-hidden">
                {/* Tab bar */}
                <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
                  {/* SVG icons em vez de emoji — 📸 renderiza inconsistente em alguns Chrome/Windows */}
                  {[
                    {
                      label: "Feed",
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                          <circle cx="12" cy="13" r="3"/>
                        </svg>
                      ),
                    },
                    {
                      label: "WhatsApp",
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                      ),
                    },
                    {
                      label: "Stories",
                      icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
                          <path d="M12 18h.01"/>
                        </svg>
                      ),
                    },
                  ].map((tab, i) => (
                    <button
                      key={i}
                      onClick={() => { setCopyTab(i); haptics.light(); }}
                      className="flex-1 py-3 text-xs font-bold transition-all relative min-h-[48px] active:scale-[0.97] inline-flex items-center justify-center gap-1.5"
                      style={{
                        color: copyTab === i ? "var(--brand-700)" : "var(--muted)",
                        background: copyTab === i ? "var(--brand-50)" : "transparent",
                      }}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {copyTab === i && (
                        <span className="absolute bottom-0 left-[15%] right-[15%] h-[2.5px] rounded-full transition-all" style={{ background: "var(--brand-500)" }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="p-4 space-y-3">
                  {(() => {
                    const leg = dicas.legendas![copyTab];
                    if (!leg) return null;
                    const charLimit = copyTab === 0 ? 300 : copyTab === 2 ? 100 : 200;
                    const charCount = leg.legenda?.length || 0;
                    const isOver = charCount > charLimit;
                    return (
                      <>
                        {/* Header + copy + counter */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-2xs sm:text-xs font-bold truncate" style={{ color: "var(--muted)" }}>
                              {leg.plataforma}
                            </p>
                            <span
                              className="text-2xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{
                                background: isOver ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                                color: isOver ? "#D97706" : "#16A34A",
                              }}
                            >
                              {charCount}/{charLimit}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(leg.legenda);
                              haptics.success();
                              setCopiedTip(`tab${copyTab}`);
                              setTimeout(() => setCopiedTip(null), 2000);
                            }}
                            className="text-2xs font-bold px-3 py-1.5 rounded-lg transition-all min-h-[44px] flex-shrink-0 active:scale-[0.95] flex items-center gap-1"
                            style={{ background: copiedTip === `tab${copyTab}` ? "var(--brand-500)" : "var(--brand-100)", color: copiedTip === `tab${copyTab}` ? "white" : "var(--brand-700)" }}
                          >
                            {copiedTip === `tab${copyTab}` ? "✓ Copiado!" : "📋 Copiar"}
                          </button>
                        </div>

                        {/* Legenda text */}
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ wordBreak: "break-word" }}>{leg.legenda}</p>

                        {/* Platform tip */}
                        {leg.dica && (
                          <p className="text-xs italic" style={{ color: "var(--muted)" }}>💡 {leg.dica}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* Fallback: campanhas antigas sem legendas[] */
              dicas.caption_sugerida && (
                <div className="surface-card p-4 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-2xs sm:text-xs font-bold" style={{ color: "var(--muted)" }}>📝 CAPTION PRONTA</p>
                      <span
                        className="text-2xs font-bold px-1.5 py-0.5 rounded-md"
                        style={{
                          background: (dicas.caption_sugerida.length > 300) ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                          color: (dicas.caption_sugerida.length > 300) ? "#D97706" : "#16A34A",
                        }}
                      >
                        {dicas.caption_sugerida.length}/300
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(dicas.caption_sugerida);
                        haptics.success();
                        setCopiedTip("caption");
                        setTimeout(() => setCopiedTip(null), 2000);
                      }}
                      className="text-2xs font-bold px-3 py-1.5 rounded-lg transition-all min-h-[44px] active:scale-[0.95] flex items-center gap-1"
                      style={{ background: copiedTip === "caption" ? "var(--brand-500)" : "var(--brand-100)", color: copiedTip === "caption" ? "white" : "var(--brand-700)" }}
                    >
                      {copiedTip === "caption" ? "✓ Copiado!" : "📋 Copiar"}
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ wordBreak: "break-word" }}>{dicas.caption_sugerida}</p>
                </div>
              )
            )}

            {/* ── Hashtags (sempre visíveis, com copiar) ── */}
            {dicas.hashtags && dicas.hashtags.length > 0 && (
              <div className="surface-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-2xs sm:text-xs font-bold" style={{ color: "var(--muted)" }}># HASHTAGS</p>
                  <button
                    onClick={async () => {
                      const hashText = dicas.hashtags.slice(0, 5).map(t => t.startsWith("#") ? t : `#${t}`).join(" ");
                      await navigator.clipboard.writeText(hashText);
                      haptics.success();
                      setCopiedTip("hashtags");
                      setTimeout(() => setCopiedTip(null), 2000);
                    }}
                    className="text-2xs font-bold px-3 py-1.5 rounded-lg transition-all min-h-[44px] active:scale-[0.95] flex items-center gap-1"
                    style={{ background: copiedTip === "hashtags" ? "var(--brand-500)" : "var(--brand-100)", color: copiedTip === "hashtags" ? "white" : "var(--brand-700)" }}
                  >
                    {copiedTip === "hashtags" ? "✓ Copiado!" : "📋 Copiar"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dicas.hashtags.slice(0, 5).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: "var(--brand-50)", color: "var(--brand-600)", border: "1px solid var(--brand-100)" }}
                    >
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Caption alternativa ── */}
            {dicas.caption_alternativa && (
              <div className="surface-card p-4 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-2xs sm:text-xs font-bold" style={{ color: "var(--muted)" }}>🔄 OPÇÃO B</p>
                    <span
                      className="text-2xs font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        background: (dicas.caption_alternativa.length > 300) ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                        color: (dicas.caption_alternativa.length > 300) ? "#D97706" : "#16A34A",
                      }}
                    >
                      {dicas.caption_alternativa.length}/300
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(dicas.caption_alternativa!);
                      haptics.success();
                      setCopiedTip("alt");
                      setTimeout(() => setCopiedTip(null), 2000);
                    }}
                    className="text-2xs font-bold px-3 py-1.5 rounded-lg transition-all min-h-[44px] active:scale-[0.95] flex items-center gap-1"
                    style={{ background: copiedTip === "alt" ? "var(--brand-500)" : "var(--brand-100)", color: copiedTip === "alt" ? "white" : "var(--brand-700)" }}
                  >
                    {copiedTip === "alt" ? "✓ Copiado!" : "📋 Copiar"}
                  </button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--muted)", wordBreak: "break-word" }}>{dicas.caption_alternativa}</p>
              </div>
            )}

            {/* ── Grid: Horário + Tom + CTA ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="surface-card p-3 sm:p-4 space-y-1 relative">
                <p className="text-2xs sm:text-xs font-bold" style={{ color: "var(--muted)" }}>⏰ POSTE ÀS</p>
                <p className="text-xs sm:text-sm font-semibold">{dicas.melhor_horario || "Entre 18h–21h"}</p>
              </div>
              <div className="surface-card p-3 sm:p-4 space-y-1">
                <p className="text-2xs sm:text-xs font-bold" style={{ color: "var(--muted)" }}>💬 TOM DA VOZ</p>
                <p className="text-xs sm:text-sm font-semibold">{dicas.tom_legenda || "Descontraído e acolhedor"}</p>
              </div>
              <div className="surface-card p-3 sm:p-4 space-y-1 col-span-2 sm:col-span-1">
                <p className="text-2xs sm:text-xs font-bold" style={{ color: "var(--muted)" }}>📣 CHAMADA PRA AÇÃO</p>
                <p className="text-xs sm:text-sm font-semibold">{dicas.cta || "Chama no direct!"}</p>
              </div>
            </div>

            {/* ── Story idea ── */}
            {dicas.story_idea && (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "linear-gradient(135deg, var(--brand-50), var(--surface))", border: "1px solid var(--brand-100)" }}>
                <span className="text-sm flex-shrink-0">📱</span>
                <div className="flex-1 min-w-0">
                  <p className="text-2xs font-bold mb-0.5" style={{ color: "var(--brand-700)" }}>IDEIA PARA STORY</p>
                  <p className="text-xs font-medium" style={{ color: "var(--brand-700)" }}>{dicas.story_idea}</p>
                </div>
              </div>
            )}

            {/* ── Dica extra ── */}
            {dicas.dica_extra && (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "var(--brand-50)", border: "1px solid var(--brand-100)" }}>
                <span className="text-sm flex-shrink-0">💡</span>
                <p className="text-xs font-medium flex-1" style={{ color: "var(--brand-700)" }}>{dicas.dica_extra}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Análise do produto (colapsável) ── */}
        {analise?.produto && (
          <details className="surface-card overflow-hidden group">
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none">
              <span className="text-sm font-bold">🔍 Como a IA analisou sua peça</span>
              <span className="text-xs group-open:rotate-180 transition-transform" style={{ color: "var(--muted)" }}>▼</span>
            </summary>
            <div className="px-5 pb-5 pt-3 space-y-3">
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
                      <p className="text-2xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{f.label}</p>
                      <p className="text-sm font-semibold mt-0.5">{f.value}</p>
                    </div>
                  ))}
              </div>
              {analise.negative_prompt && (
                <div className="rounded-xl p-3" style={{ background: "var(--background)", border: "1px dashed var(--border)", overflowX: "hidden" }}>
                  <p className="text-2xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Negative prompt usado</p>
                  <p className="text-xs font-mono" style={{ color: "var(--muted)", wordBreak: "break-all" }}>{analise.negative_prompt}</p>
                </div>
              )}
            </div>
          </details>
        )}

        {/* ── Nova campanha ── */}
        <div className="flex justify-center pb-4">
          <button
            onClick={() => router.push("/gerar")}
            className="btn-secondary px-8 py-3 text-sm font-semibold"
            style={{ minHeight: 48 }}
          >
            ✨ Criar mais fotos
          </button>
        </div>
      </div>

      {/* Format Selector Bottom Sheet (Mobile only) */}
      <AnimatePresence>
        {showFormatSheet && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:hidden pointer-events-auto"
            style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setShowFormatSheet(false)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full rounded-t-3xl p-5 pb-8"
              style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Escolha o Aspect Ratio</h3>
                <button onClick={() => setShowFormatSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--muted)]">
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                {FORMAT_PRESETS.map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => {
                      haptics.selection();
                      setActiveFormat(fmt.id);
                      setShowFormatSheet(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl transition-all"
                    style={{
                      background: activeFormat === fmt.id ? "var(--brand-50)" : "var(--background)",
                      border: activeFormat === fmt.id ? "2px solid var(--brand-500)" : "1px solid var(--border)"
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-[var(--surface)]">
                        {fmt.icon}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold" style={{ color: activeFormat === fmt.id ? "var(--brand-700)" : "var(--foreground)" }}>
                          {fmt.label}
                        </p>
                        <p className="text-2xs uppercase font-bold" style={{ color: "var(--muted)" }}>
                          {fmt.w} × {fmt.h} pixels
                        </p>
                      </div>
                    </div>
                    {activeFormat === fmt.id && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--brand-500)] text-white">
                        ✓
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
