"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { haptics } from "@/lib/utils/haptics";
import { friendlyError } from "@/lib/friendly-error";
import { useWakeLock } from "@/lib/hooks/useWakeLock";
import QuotaExceededModal from "@/components/QuotaExceededModal";
import ModelPlaceholder from "@/components/ModelPlaceholder";
import GenerationLoadingScreen from "@/components/GenerationLoadingScreen";
import PhotoTipsCard from "@/components/PhotoTipsCard";

const IconUpload = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const IconUploadSmall = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);
const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);

const audiences = [
  { value: "mulheres_25_40", label: "Mulheres 25-40" },
  { value: "jovens_18_25", label: "Jovens 18-25" },
  { value: "homens_25_45", label: "Homens 25-45" },
  { value: "maes", label: "Mães" },
  { value: "publico_geral", label: "Público geral" },
  { value: "premium", label: "Público premium" },
];

const tones = [
  { value: "casual_energetico", label: "⚡ Casual e energético" },
  { value: "sofisticado", label: "✨ Sofisticado" },
  { value: "urgente", label: "🔥 Urgente" },
  { value: "acolhedor", label: "🤗 Acolhedor" },
  { value: "divertido", label: "😄 Divertido" },
];

const backgrounds: { value: string; label: string; thumb: string | null; ai: boolean }[] = [
  { value: "branco",       label: "Branco",       thumb: "/bg/branco.png",       ai: false },
  { value: "estudio",      label: "Estúdio",      thumb: "/bg/estudio.png",      ai: false },
  { value: "lifestyle",    label: "Lifestyle",    thumb: "/bg/lifestyle.png",    ai: true },
  { value: "urbano",       label: "Urbano",       thumb: "/bg/urbano.png",       ai: true },
  { value: "natureza",     label: "Natureza",     thumb: "/bg/natureza.png",     ai: true },
  { value: "interior",     label: "Interior",     thumb: "/bg/interior.png",     ai: true },
  { value: "boutique",     label: "Boutique",     thumb: "/bg/boutique.png",     ai: true },
  { value: "praia",        label: "Praia",        thumb: "/bg/praia.png",        ai: true },
  { value: "noturno",      label: "Noturno",      thumb: "/bg/noturno.png",      ai: true },
  { value: "tropical",     label: "Tropical",     thumb: "/bg/tropical.png",     ai: true },
  { value: "minimalista",  label: "Minimalista",  thumb: "/bg/minimalista.png",  ai: true },
  { value: "luxo",         label: "Luxo",         thumb: "/bg/luxo.png",         ai: true },
  { value: "rural",        label: "Rural",        thumb: "/bg/rural.png",        ai: true },
  { value: "neon",         label: "Neon",         thumb: "/bg/neon.png",         ai: true },
  { value: "arte",         label: "Arte",         thumb: "/bg/arte.png",         ai: true },
];


interface ModelBankItem {
  id: string;
  name: string;
  body_type: string;
  skin_tone: string;
  pose: string;
  image_url: string;
  thumbnail_url: string | null;
}

export default function GerarCampanha() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [background, setBackground] = useState("branco");




  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  // 📱 Prevent screen from sleeping during generation
  useWakeLock(isGenerating);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeUpInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [closeUpFile, setCloseUpFile] = useState<File | null>(null);
  const [closeUpPreview, setCloseUpPreview] = useState<string | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [secondPreview, setSecondPreview] = useState<string | null>(null);
  const [dragOverCloseUp, setDragOverCloseUp] = useState(false);
  const [dragOverSecond, setDragOverSecond] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(true);
  const [bodyType, setBodyType] = useState<"normal" | "plus" | "masculino" | "robusto">("normal");

  // Helper: mapeia filtro UI → body_types reais no DB
  // DB values: media (f-normal), medio (m-normal), plus_size (f-plus), robusto (m-plus)
  const matchesFilter = (dbBodyType: string, filter: string): boolean => {
    if (filter === "all") return true;
    if (filter === "padrao") return ["media", "normal"].includes(dbBodyType);
    if (filter === "curvilinea") return ["plus_size", "plus"].includes(dbBodyType);
    if (filter === "homem") return ["medio", "masculino"].includes(dbBodyType);
    if (filter === "homem_plus") return ["robusto"].includes(dbBodyType);
    // Fallback exact match
    return dbBodyType === filter;
  };
  const [modelBank, setModelBank] = useState<ModelBankItem[]>([]);
  const [customModels, setCustomModels] = useState<{ id: string; name: string; body_type: string; skin_tone?: string; photo_url?: string | null; is_active: boolean }[]>([]);
  const [userPlan, setUserPlan] = useState("free");
  const [selectedModelId, setSelectedModelId] = useState<string>("random");
  const [modelFilter, setModelFilter] = useState<string>("padrao");
  const [showAllModels, setShowAllModels] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<{
    used: number; limit: number; credits: number;
  } | null>(null);
  const [showSinglePhotoWarning, setShowSinglePhotoWarning] = useState(false);
  const [previewModel, setPreviewModel] = useState<{
    id: string; name: string; imageUrl: string; bodyType: string; isCustom: boolean;
  } | null>(null);

  // Model limit from API (source of truth — not hardcoded)
  const [maxModels, setMaxModels] = useState(0);

  // Carregar banco de modelos (stock) + modelos personalizadas da loja + usage
  const [userCredits, setUserCredits] = useState(0);
  const [campaignsLimit, setCampaignsLimit] = useState<number | null>(null); // null = loading
  const [campaignsUsed, setCampaignsUsed] = useState(0);

  useEffect(() => {
    fetch("/api/models/bank")
      .then(res => res.json())
      .then(data => setModelBank(data.models || []))
      .catch(() => {});
    fetch("/api/model/list")
      .then(res => res.json())
      .then(data => {
        setCustomModels(data.models || []);
        setUserPlan(data.plan || "free");
        if (typeof data.limit === "number") setMaxModels(data.limit);
      })
      .catch(() => {});

    // Verificar se tem créditos/quota proativamente
    fetch("/api/store/usage")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.data) {
          const limit = data.data.campaigns_limit ?? 0;
          const used = data.data.campaigns_generated ?? 0;
          setCampaignsLimit(limit);
          setCampaignsUsed(used);
        }
      })
      .catch(() => {});
    // Verificar créditos avulsos
    fetch("/api/store/credits")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const avulso = data?.data?.campaigns ?? 0;
        setUserCredits(avulso);
      })
      .catch(() => {});
  }, []);

  // ── Polling inteligente: atualiza previews pendentes a cada 5s ──
  useEffect(() => {
    const pendingIds = customModels
      .filter(m => !m.photo_url)
      .map(m => m.id);
    if (pendingIds.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/model/preview-status?ids=${pendingIds.join(",")}`);
        if (!res.ok) return;
        const { statuses } = await res.json();

        setCustomModels(prev => prev.map(m => {
          const status = statuses?.[m.id];
          if (status?.url && !m.photo_url) {
            return { ...m, photo_url: status.url };
          }
          return m;
        }));
      } catch {
        // Silencioso — retry no próximo ciclo
      }
    }, 5000);

    // Parar polling após 3 minutos (timeout de segurança)
    const timeout = setTimeout(() => clearInterval(interval), 3 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [customModels]);

  const generationSteps = [
    { label: "Observando sua peça de roupa…", progress: 8 },
    { label: "Identificando tecido, cor e caimento…", progress: 20 },
    { label: "Análise completa! Criando looks…", progress: 30 },
    { label: "Montando editoriais de moda…", progress: 40 },
    { label: "Vestindo a modelo — foto 1 📸", progress: 50 },
    { label: "Vestindo a modelo — foto 2 📸", progress: 62 },
    { label: "Vestindo a modelo — foto 3 📸", progress: 75 },
    { label: "Finalizando e salvando…", progress: 92 },
    { label: "Suas fotos estão prontas! ✨", progress: 100 },
  ];


  const handleFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCloseUpFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setCloseUpFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setCloseUpPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSecondFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSecondFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setSecondPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!preview || !selectedFile) return;
    setIsGenerating(true);
    setGenerationStep(0);
    setError(null);

    // Abort controller — kills fetch if phone sleeps or network dies (3 min max)
    const abortController = new AbortController();
    const abortTimeout = setTimeout(() => abortController.abort(), 180_000);

    // Fallback interval — advances steps slowly if SSE events are delayed
    // Capped at step 3 ("Montando editoriais") to never get ahead of real Gemini progress
    const fallbackInterval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev >= 3) return prev; // Never go past "Montando editoriais" without SSE
        if (prev >= generationSteps.length - 2) return prev;
        return prev + 1;
      });
    }, 8000);

    try {
      // Build FormData
      const formData = new FormData();
      formData.append("image", selectedFile);
      if (closeUpFile) formData.append("closeUpImage", closeUpFile);
      if (secondFile) formData.append("secondImage", secondFile);
      formData.append("price", price);
      if (campaignTitle.trim()) formData.append("title", campaignTitle.trim());
      formData.append("storeName", "Minha Loja");
      if (audience) formData.append("targetAudience", audience);
      if (tone) formData.append("toneOverride", tone);
      formData.append("bodyType", bodyType);

      const bgFinal = background;
      formData.append("backgroundType", bgFinal);

      // Modelo selecionada: custom da loja ou stock do banco
      const isCustomModel = customModels.some(m => m.id === selectedModelId);
      if (selectedModelId !== "random" && isCustomModel) {
        // Modelo customizada da loja — backend buscará em store_models
        formData.append("customModelId", selectedModelId);
      } else if (selectedModelId !== "random") {
        // Modelo stock do banco
        formData.append("modelBankId", selectedModelId);
      } else {
        // "Aleatória" — se tem modelo ativa personalizada, deixar backend usar
        const hasActiveCustom = customModels.some(m => m.is_active && m.photo_url);
        if (!hasActiveCustom && modelBank.length > 0) {
          const randomModel = modelBank[Math.floor(Math.random() * modelBank.length)];
          formData.append("modelBankId", randomModel.id);
        }
        // Se hasActiveCustom: não envia nada → backend usa getActiveModel()
      }

      // Call API — expects SSE (text/event-stream) response
      const response = await fetch("/api/campaign/generate", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      // Handle non-streaming error responses (quota exceeded, rate limited, etc.)
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        clearInterval(fallbackInterval);
        clearTimeout(abortTimeout);
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === "QUOTA_EXCEEDED") {
          setIsGenerating(false);
          setQuotaExceeded({
            used: errorData.used || 0,
            limit: errorData.limit || 0,
            credits: errorData.credits || 0,
          });
          return;
        }
        // Tratar TODOS os erros JSON com errorCode correto
        setIsGenerating(false);
        setError(friendlyError(errorData.error || `Erro ${response.status}`));
        setErrorCode(errorData.code || null);
        setErrorRetryable(errorData.code === "RATE_LIMITED" || errorData.code === "MODEL_OVERLOADED");
        return;
      }

      if (!response.ok || !response.body) {
        clearInterval(fallbackInterval);
        throw new Error(`Erro ${response.status}`);
      }

      // 🚀 Parse SSE stream for real-time progress
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      // Helper para processar um bloco SSE (event: X\ndata: Y)
      const processSSEBlock = (block: string): boolean => {
        if (!block.trim()) return false;

        const lines = block.split("\n");
        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) eventType = line.slice(7).trim();
          if (line.startsWith("data: ")) eventData = line.slice(6);
        }

        if (!eventType || !eventData) return false;

        try {
          const payload = JSON.parse(eventData);

          if (eventType === "progress") {
            const progress = payload.progress || 0;
            const stepIndex = Math.min(
              Math.floor((progress / 100) * (generationSteps.length - 1)),
              generationSteps.length - 2
            );
            // ✅ Monotonic: nunca volta atrás
            setGenerationStep((prev) => Math.max(prev, stepIndex));
          } else if (eventType === "done") {
            clearInterval(fallbackInterval);
            streamDone = true;

            // Store result for the demo page
            sessionStorage.setItem("campaignResult", JSON.stringify(payload));

            // Store form data for regeneration
            const fileReader = new FileReader();
            fileReader.onload = () => {
              const base64 = (fileReader.result as string).split(",")[1];
              sessionStorage.setItem("campaignFormData", JSON.stringify({
                imageBase64: base64,
                price,
                targetAudience: audience,
                toneOverride: tone,
              }));
            };
            fileReader.readAsDataURL(selectedFile);

            // Show completion then redirect
            setGenerationStep(generationSteps.length - 1);
            clearTimeout(abortTimeout);
            setTimeout(() => {
              setIsGenerating(false);
              router.push("/gerar/demo");
            }, 1500);
            return true; // signals "done handled"
          } else if (eventType === "error") {
            clearInterval(fallbackInterval);
            clearTimeout(abortTimeout);
            streamDone = true;
            setIsGenerating(false);
            setError(friendlyError(payload.error, "Erro ao gerar campanha. Tente novamente."));
            setErrorCode(payload.code || null);
            setErrorRetryable(payload.retryable !== false);
            return true;
          }
        } catch {
          // Ignore malformed JSON
        }
        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by \n\n
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || ""; // Keep incomplete block

        for (const block of blocks) {
          if (processSSEBlock(block)) return; // done or error handled
        }
      }

      // ⚠️ Process remaining buffer — final "done" event may lack trailing \n\n
      if (!streamDone && buffer.trim()) {
        if (processSSEBlock(buffer)) return;
      }

      // If stream ended without done/error event
      if (!streamDone) {
        clearInterval(fallbackInterval);
        clearTimeout(abortTimeout);
        setIsGenerating(false);
        setError("Conexão interrompida. Verifique sua internet e tente novamente.");
        setErrorCode("PIPELINE_ERROR");
        setErrorRetryable(true);
      }

    } catch (err: any) {
      clearInterval(fallbackInterval);
      clearTimeout(abortTimeout);
      setIsGenerating(false);
      // Distinguish abort (phone slept) from real errors
      if (err?.name === "AbortError") {
        setError("Tempo limite atingido. O celular pode ter entrado em modo de espera. Tente novamente.");
        setErrorCode("TIMEOUT");
        setErrorRetryable(true);
      } else {
        setError(friendlyError(err, "Erro ao gerar campanha. Tente novamente."));
        setErrorCode("PIPELINE_ERROR");
        setErrorRetryable(true);
      }
    }
  };

  if (isGenerating) {
    return (
      <GenerationLoadingScreen step={generationStep} steps={generationSteps} />
    );
  }

  return (
    <>
      {/* ── Modals — FORA da div com transform (senão fixed fica broken no mobile) ── */}

      {/* Quota Exceeded Modal */}
      {quotaExceeded && (
        <QuotaExceededModal
          used={quotaExceeded.used}
          limit={quotaExceeded.limit}
          credits={quotaExceeded.credits}
          onClose={() => setQuotaExceeded(null)}
          onUpgrade={() => { window.location.href = "/plano"; }}
          onBuyCredits={async (type, qty) => {
            const packageMap: Record<string, string> = {
              "campaigns_3": "3_campanhas",
              "campaigns_10": "10_campanhas",
              "campaigns_20": "20_campanhas",
              "models_3": "3_modelos",
              "models_10": "10_modelos",
              "models_25": "25_modelos",
            };
            const packageId = packageMap[`${type}_${qty}`];
            if (!packageId) return;
            try {
              const res = await fetch("/api/credits/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ packageId }),
              });
              const data = await res.json();
              if (data.data?.checkoutUrl) window.location.href = data.data.checkoutUrl;
            } catch { /* ignore */ }
          }}
        />
      )}

      {/* Error Modal — centralizado na viewport */}
      {error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
          onClick={() => setError(null)}
        >
          <div
            className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden"
            style={{ background: "var(--background)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visual header */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6" style={{ background: "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)" }}>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border"
                style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.2)", boxShadow: "0 4px 16px rgba(220,38,38,0.15)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--error, #DC2626)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
            <h3 className="text-lg font-bold" style={{ color: "var(--error, #EF4444)" }}>
                {errorCode === "RATE_LIMITED" && "Alta demanda"}
                {errorCode === "MODEL_OVERLOADED" && "Servidor sobrecarregado"}
                {errorCode === "SAFETY_BLOCKED" && "Conteúdo não permitido"}
                {errorCode === "IMAGE_GENERATION_BLOCKED" && "Imagem não gerada"}
                {errorCode === "BAD_REQUEST" && "Foto não reconhecida"}
                {errorCode === "TIMEOUT" && "Tempo esgotado"}
                {(!errorCode || !["RATE_LIMITED","MODEL_OVERLOADED","SAFETY_BLOCKED","IMAGE_GENERATION_BLOCKED","BAD_REQUEST","TIMEOUT"].includes(errorCode)) && "Não foi possível gerar"}
              </h3>
              <p className="text-sm mt-1 text-center font-medium" style={{ color: "var(--error, #EF4444)", opacity: 0.9 }}>
                {error}
              </p>
            </div>

            {/* Reassurance */}
            <div className="flex items-center gap-3 mx-6 mt-4 p-3 rounded-xl" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#DCFCE7" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#15803D" }}>
                  Seus créditos estão intactos
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#16A34A" }}>
                  Nenhum crédito foi descontado dessa tentativa.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 flex flex-col gap-3">
              <button
                onClick={() => { setError(null); setErrorCode(null); setErrorRetryable(true); if (errorRetryable) handleGenerate(); }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[48px]"
                style={{ background: "var(--gradient-brand)", color: "white", boxShadow: "0 4px 16px rgba(236,72,153,0.3)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                {errorRetryable ? "Tentar novamente" : "Alterar foto e tentar"}
              </button>
              <button
                onClick={() => { setError(null); setErrorCode(null); setErrorRetryable(true); }}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all min-h-[48px]"
                style={{ color: "var(--muted)" }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Model Preview Modal — FORA da div com transform ── */}
      <AnimatePresence>
        {previewModel && (
          <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
            onClick={() => setPreviewModel(null)}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70"
              style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative w-full md:max-w-sm max-h-[85vh] rounded-t-3xl md:rounded-2xl overflow-hidden flex flex-col"
              style={{ background: "var(--background)", boxShadow: "0 -10px 50px rgba(0,0,0,0.5)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close X */}
              <button
                onClick={() => setPreviewModel(null)}
                className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: "rgba(0,0,0,0.5)", color: "white", backdropFilter: "blur(4px)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>

              {/* Image */}
              <div className="flex-1 min-h-0 bg-black/5 overflow-hidden">
                <img
                  src={previewModel.imageUrl}
                  alt={previewModel.name}
                  className="w-full h-full object-cover object-[center_15%]"
                />
              </div>

              {/* Info + Actions */}
              <div className="p-5 pb-7 md:pb-5">
                {/* Drag handle (mobile) */}
                <div className="md:hidden w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--border)" }} />

                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg truncate">{previewModel.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {previewModel.isCustom ? "⭐ Sua modelo · " : ""}
                      {previewModel.bodyType === "media" || previewModel.bodyType === "normal" ? "Mulher Padrão" :
                       previewModel.bodyType === "plus_size" || previewModel.bodyType === "plus" ? "Mulher Plus" :
                       previewModel.bodyType === "medio" || previewModel.bodyType === "masculino" ? "Homem Padrão" :
                       previewModel.bodyType === "robusto" ? "Homem Plus" : previewModel.bodyType}
                    </p>
                  </div>
                  {selectedModelId === previewModel.id && (
                    <span className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}>
                      ✓ Selecionada
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedModelId(previewModel.id);
                      setPreviewModel(null);
                      haptics.success();
                    }}
                    className="btn-primary flex-1 !py-3.5 text-sm font-semibold"
                    style={{ borderRadius: "14px", minHeight: "52px" }}
                  >
                    {selectedModelId === previewModel.id ? "✓ Selecionada" : "Selecionar modelo"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main Form ── */}
      <div className="animate-fade-in-up w-full">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Criar <span className="gradient-text">Campanha</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Envie a foto do look e receba 3 fotos editoriais prontas para postar
        </p>
      </div>

      {/* Banner: Sem créditos — proativo */}
      {campaignsLimit !== null && campaignsUsed >= campaignsLimit && userCredits <= 0 && (
        <div
          className="mb-6 rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06))",
            border: "1px solid rgba(139,92,246,0.2)",
          }}
        >
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--brand-500), #8B5CF6)",
                boxShadow: "0 4px 16px rgba(236,72,153,0.25)",
              }}
            >
              <span className="text-xl">✨</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                {campaignsLimit === 0 ? "Ative seu plano para criar" : "Campanhas do período esgotadas"}
              </h3>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted)" }}>
                {campaignsLimit === 0
                  ? "Assine um plano para gerar fotos profissionais com modelo virtual e IA."
                  : `Você usou ${campaignsUsed}/${campaignsLimit} campanhas. Compre créditos avulsos ou faça upgrade.`
                }
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Link
                href="/plano"
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[44px] flex items-center justify-center"
                style={{
                  background: "var(--gradient-brand)",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(236,72,153,0.25)",
                }}
              >
                {campaignsLimit === 0 ? "⚡ Ativar plano" : "Ver planos"}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_1.1fr] xl:grid-cols-[1fr_1.2fr] lg:gap-12 gap-8 items-start">
        {/* Left — Upload (3 fotos: 1 grande + 2 pequenas) */}
        <div className="space-y-6 lg:sticky lg:top-24 min-w-0">
          {/* Upload Area — Layout 1 grande + 2 pequenas */}
          <div className="flex flex-col sm:flex-row gap-3 min-w-0" style={{ minHeight: "280px" }}>
            {/* Foto Principal (grande) */}
            <div
              className="relative rounded-2xl overflow-hidden transition-all cursor-pointer group flex-[3] min-w-0"
              style={{
                border: dragOver
                  ? "2px dashed var(--brand-500)"
                  : preview
                  ? "2px solid var(--border)"
                  : "2px dashed var(--border)",
                background: dragOver ? "var(--brand-50)" : "var(--background)",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              {preview ? (
                <div className="relative w-full h-full">
                  <img
                    src={preview}
                    alt="Foto principal"
                    className="w-full h-full object-contain"
                    style={{ background: "var(--surface)" }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">Trocar foto</span>
                  </div>
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: "var(--brand-500)", color: "white" }}>Principal</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-6 h-full">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
                    <IconUpload />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm mb-0.5">Foto principal *</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      O look inteiro, de frente
                    </p>
                    <p className="text-[10px] mt-2 flex items-center justify-center gap-1" style={{ color: "var(--muted)" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Apenas roupas e acessórios
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna direita: 2 fotos pequenas */}
            <div className="grid grid-cols-2 sm:flex sm:flex-col gap-3 flex-[2] min-w-0">
              {/* Close-up do tecido */}
              <div
                className="relative rounded-xl overflow-hidden transition-all cursor-pointer group flex-1"
                style={{
                  border: dragOverCloseUp
                    ? "2px dashed var(--brand-500)"
                    : closeUpPreview
                    ? "2px solid var(--border)"
                    : "2px dashed var(--border)",
                  background: dragOverCloseUp ? "var(--brand-50)" : "var(--background)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverCloseUp(true); }}
                onDragLeave={() => setDragOverCloseUp(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCloseUp(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleCloseUpFile(file);
                }}
                onClick={() => closeUpInputRef.current?.click()}
              >
                <input
                  ref={closeUpInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCloseUpFile(file);
                  }}
                />
                {closeUpPreview ? (
                  <div className="relative w-full h-full">
                    <img src={closeUpPreview} alt="Close-up" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">Trocar</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCloseUpFile(null); setCloseUpPreview(null); }}
                      className="absolute top-0 right-0 w-8 h-8 p-1.5 rounded-full flex items-center justify-center min-w-[44px] min-h-[44px]"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                      aria-label="Remover close-up"
                    >
                      <IconX />
                    </button>
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>Close-up</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-2 sm:p-3 h-full overflow-hidden w-full">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-50)", color: "var(--brand-500)" }}>
                      <IconSearch />
                    </div>
                    <div className="text-center w-full min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold leading-tight truncate px-1">Detalhe ou ângulo</p>
                      <p className="text-[9px] sm:text-[10px] leading-tight mt-1 truncate px-1" style={{ color: "var(--muted)" }}>Textura, costura, estampa</p>
                    </div>
                    <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}>opcional</span>
                  </div>
                )}
              </div>

              {/* Segunda peça / outro ângulo */}
              <div
                className="relative rounded-xl overflow-hidden transition-all cursor-pointer group flex-1"
                style={{
                  border: dragOverSecond
                    ? "2px dashed var(--brand-500)"
                    : secondPreview
                    ? "2px solid var(--border)"
                    : "2px dashed var(--border)",
                  background: dragOverSecond ? "var(--brand-50)" : "var(--background)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverSecond(true); }}
                onDragLeave={() => setDragOverSecond(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSecond(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleSecondFile(file);
                }}
                onClick={() => secondInputRef.current?.click()}
              >
                <input
                  ref={secondInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSecondFile(file);
                  }}
                />
                {secondPreview ? (
                  <div className="relative w-full h-full">
                    <img src={secondPreview} alt="Segunda peça" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">Trocar</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSecondFile(null); setSecondPreview(null); }}
                      className="absolute top-0 right-0 w-8 h-8 p-1.5 rounded-full flex items-center justify-center min-w-[44px] min-h-[44px]"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                      aria-label="Remover segunda peça"
                    >
                      <IconX />
                    </button>
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>2ª peça</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-2 sm:p-3 h-full overflow-hidden w-full">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-50)", color: "var(--brand-500)" }}>
                      <IconPlus />
                    </div>
                    <div className="text-center w-full min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold leading-tight truncate px-1">Segunda peça</p>
                      <p className="text-[9px] sm:text-[10px] leading-tight mt-1 truncate px-1" style={{ color: "var(--muted)" }}>Ex: calça do conjunto</p>
                    </div>
                    <span className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}>opcional</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Aviso compacto + dicas — só no mobile, inline */}
          <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
            🛡️ Apenas roupas e acessórios · Conteúdo impróprio é bloqueado pela IA
          </p>
          <PhotoTipsCard hasPhoto={!!preview} />
        </div>

        {/* Right — Options */}
        <div className="space-y-8 min-w-0">


          {/* Model Bank Selector — Biotipo integrado como tabs */}
          <div className="animate-fade-in">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex-shrink-0">
                  <label className="text-sm font-semibold">Modelo virtual</label>
                  {customModels.length > 0 && (
                    <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
                      {customModels.length}/{maxModels} personalizadas
                    </span>
                  )}
                </div>
              </div>
              {/* Biotipo tabs — scroll horizontal no mobile */}
              <div className="flex overflow-x-auto md:overflow-visible md:flex-wrap gap-1.5 hide-scrollbar pb-1 snap-x snap-mandatory md:snap-none">
                {([
                  { filter: "all", body: "" as const, label: "Todos", icon: "✨" },
                  { filter: "padrao", body: "normal" as const, label: "Mulher", icon: "👤" },
                  { filter: "curvilinea", body: "plus" as const, label: "Mulher Plus", icon: "💃" },
                  { filter: "homem", body: "masculino" as const, label: "Homem", icon: "🧍‍♂️" },
                  { filter: "homem_plus", body: "robusto" as const, label: "Homem Plus", icon: "🏋️‍♂️" },
                ] as const).map((tab) => (
                  <button
                    key={tab.filter}
                    onClick={() => {
                      haptics.light();
                      setModelFilter(tab.filter);
                      if (tab.body) setBodyType(tab.body);
                      setShowAllModels(false);
                    }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all snap-start min-h-[40px]"
                    style={{
                      background: modelFilter === tab.filter ? "var(--brand-100)" : "var(--surface)",
                      color: modelFilter === tab.filter ? "var(--brand-700)" : "var(--muted)",
                      border: modelFilter === tab.filter ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                    }}
                  >
                    <span className="text-sm">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Grid de Modelos (Aleatória + Customizadas + Stock) */}
            {(() => {
              const filteredCustom = customModels.filter(m => matchesFilter(m.body_type, modelFilter));
              const filteredStock = modelBank.filter(m => matchesFilter(m.body_type, modelFilter));
              const allModels = [
                ...filteredCustom.map(m => ({ ...m, _type: "custom" as const })),
                ...filteredStock.map(m => ({ ...m, _type: "stock" as const, body_type: m.body_type })),
              ];
              const INITIAL_VISIBLE = 5;
              const visibleModels = showAllModels ? allModels : allModels.slice(0, INITIAL_VISIBLE);
              const hasMore = allModels.length > INITIAL_VISIBLE;

              return (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                    {/* Opção aleatória */}
                    <button
                      onClick={() => setSelectedModelId("random")}
                      className="aspect-[3/4] rounded-lg relative overflow-hidden flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.03] hover:shadow-sm active:scale-[0.98]"
                      style={{
                        background: selectedModelId === "random" ? "var(--brand-50)" : "var(--surface)",
                      }}
                    >
                      <div className={`absolute inset-0 pointer-events-none rounded-lg transition-all duration-300 z-10 ${
                        selectedModelId === "random" 
                          ? "ring-2 ring-inset ring-brand-500 shadow-[inset_0_0_12px_rgba(236,72,153,0.2)]" 
                          : "ring-1 ring-inset ring-[var(--border)] opacity-50"
                      }`} />
                      <span className="text-lg drop-shadow-sm relative z-20">🎲</span>
                      <span className="text-[10px] font-medium mt-1 relative z-20" style={{ color: "var(--muted)" }}>Aleatória</span>
                    </button>

                    {/* Modelos visíveis (custom + stock combinados) */}
                    {visibleModels.map((model) => {
                      const isCustom = model._type === "custom";
                      return isCustom ? (
                        <div key={`custom-${model.id}`} className="relative group">
                          <button
                            onClick={() => {
                              const imgUrl = (model as any).photo_url;
                              if (imgUrl) setPreviewModel({ id: model.id, name: model.name, imageUrl: imgUrl, bodyType: model.body_type, isCustom: true });
                              else setSelectedModelId(model.id);
                            }}
                            className="w-full aspect-[3/4] rounded-lg overflow-hidden relative transition-all active:scale-[0.98]"
                            title={`⭐ ${model.name} (sua modelo)`}
                          >
                            {(model as any).photo_url ? (
                              <img
                                src={(model as any).photo_url}
                                alt={model.name}
                                className="w-full h-full object-cover object-[center_15%]"
                                loading="lazy"
                                style={{ animation: "fadeIn 0.5s ease-in" }}
                              />
                            ) : (
                              <ModelPlaceholder
                                skinTone={(model as any).skin_tone}
                                bodyType={model.body_type}
                                name={model.name}
                                isGenerating={true}
                              />
                            )}
                            <div className={`absolute inset-0 pointer-events-none rounded-lg transition-all duration-300 z-10 ${
                              selectedModelId === model.id 
                                ? "ring-2 ring-inset ring-brand-500 shadow-[inset_0_0_12px_rgba(236,72,153,0.3)]" 
                                : "ring-2 ring-inset ring-[#D4A017] shadow-[inset_0_0_8px_rgba(212,160,23,0.25)]"
                            }`} />
                            <div className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full z-20" style={{ background: "linear-gradient(135deg, #D4A017, #F5C842)", color: "white" }}>
                              ⭐ Sua
                            </div>
                            {selectedModelId === model.id && (
                              <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center z-20">
                                <span className="text-white text-sm font-bold shadow-sm">✓</span>
                              </div>
                            )}
                          </button>

                          {confirmDeleteId !== model.id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(model.id); }}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:scale-110"
                              style={{
                                background: "rgba(220,38,38,0.85)",
                                color: "white",
                                fontSize: "14px",
                                lineHeight: 1,
                                backdropFilter: "blur(4px)",
                              }}
                              title="Excluir modelo"
                            >
                              ×
                            </button>
                          )}

                          {confirmDeleteId === model.id && (
                            <div
                              className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-2 z-10"
                              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
                            >
                              <p className="text-white text-xs font-semibold text-center px-2">Excluir modelo?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setDeletingModelId(model.id);
                                    try {
                                      const res = await fetch(`/api/models/${model.id}`, { method: "DELETE" });
                                      if (res.ok) {
                                        setCustomModels(prev => prev.filter(m => m.id !== model.id));
                                        if (selectedModelId === model.id) setSelectedModelId("random");
                                      }
                                    } catch { /* ignore */ }
                                    setDeletingModelId(null);
                                    setConfirmDeleteId(null);
                                  }}
                                  disabled={deletingModelId === model.id}
                                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px]"
                                  style={{ background: "#DC2626", color: "white", opacity: deletingModelId === model.id ? 0.6 : 1 }}
                                >
                                  {deletingModelId === model.id ? "..." : "Sim"}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                  className="px-4 py-2 rounded-lg text-xs font-bold min-h-[44px]"
                                  style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                                >
                                  Não
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Stock model */
                        <button
                          key={model.id}
                          onClick={() => {
                            const imgUrl = (model as any).thumbnail_url || (model as any).image_url;
                            if (imgUrl) setPreviewModel({ id: model.id, name: model.name, imageUrl: imgUrl, bodyType: model.body_type, isCustom: false });
                            else setSelectedModelId(model.id);
                          }}
                          className="group aspect-[3/4] rounded-lg overflow-hidden relative transition-all duration-300 hover:scale-[1.03] hover:z-10"
                          title={model.name}
                        >
                          <img
                            src={(model as any).thumbnail_url || (model as any).image_url}
                            alt={model.name}
                            className="w-full h-full object-cover object-[center_15%]"
                            loading="lazy"
                          />
                          <div className={`absolute inset-0 pointer-events-none rounded-lg transition-all duration-300 z-10 ${
                            selectedModelId === model.id 
                              ? "ring-2 ring-inset ring-brand-500 shadow-[inset_0_0_12px_rgba(236,72,153,0.3)]"
                              : "ring-1 ring-inset ring-[var(--border)] opacity-50 group-hover:ring-brand-500/50 group-hover:opacity-100"
                          }`} />
                          {selectedModelId === model.id && (
                            <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center z-20">
                              <span className="text-white text-sm font-bold shadow-sm">✓</span>
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* Empty state */}
                    {allModels.length === 0 && (
                      <div className="col-span-3 sm:col-span-4 aspect-[3/4] max-h-[160px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all mx-0" style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface)' }}>
                        <span className="text-xl mb-1 opacity-70">📭</span>
                        <span className="text-xs font-semibold">Nenhuma modelo salva.</span>
                        <Link href="/modelo" className="text-[10px] mt-1 font-bold underline transition-opacity hover:opacity-70" style={{ color: "var(--brand-500)" }}>Criar personalizada</Link>
                      </div>
                    )}

                    {/* + Criar nova modelo / Upgrade CTA */}
                    {customModels.length < maxModels ? (
                      <a
                        href="/modelo"
                        className="aspect-[3/4] rounded-lg flex flex-col items-center justify-center text-center transition-all hover:scale-[1.03] active:scale-[0.98]"
                        style={{
                          border: "2px dashed #D4A017",
                          background: "var(--surface)",
                          color: "#8B6914",
                        }}
                        title="Criar modelo personalizada"
                      >
                        <span className="text-lg">+</span>
                        <span className="text-[10px] font-semibold mt-1">Nova modelo</span>
                        <span className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>{customModels.length}/{maxModels}</span>
                      </a>
                    ) : maxModels > 0 ? (
                      <a
                        href="/plano"
                        className="aspect-[3/4] rounded-lg flex flex-col items-center justify-center text-center transition-all hover:scale-[1.03] active:scale-[0.98]"
                        style={{
                          border: "1px solid var(--border)",
                          background: "linear-gradient(135deg, var(--surface), var(--brand-50))",
                          color: "var(--brand-600)",
                        }}
                        title="Faça upgrade para mais modelos"
                      >
                        <span className="text-lg">⬆️</span>
                        <span className="text-[10px] font-semibold mt-1">+ Modelos</span>
                        <span className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>Upgrade</span>
                      </a>
                    ) : null}
                  </div>

                  {/* Botão ver mais/menos modelos */}
                  {hasMore && (
                    <button
                      onClick={() => setShowAllModels(!showAllModels)}
                      className="mt-2 w-full py-2.5 rounded-xl text-xs font-medium transition-all min-h-[44px] flex items-center justify-center gap-1.5"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--brand-600)",
                      }}
                    >
                      {showAllModels ? (
                        <>▲ Mostrar menos</>
                      ) : (
                        <>▼ Ver todas ({allModels.length - INITIAL_VISIBLE} mais)</>
                      )}
                    </button>
                  )}
                </>
              );
            })()}

            {/* CTA comprar modelo avulsa — quando atingiu limite e plano não é free */}
            {maxModels > 0 && customModels.length >= maxModels && (
              <div className="mt-3 p-2.5 rounded-xl text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Limite atingido ({customModels.length}/{maxModels}) ·{" "}
                  <a href="/plano" className="font-semibold" style={{ color: "var(--brand-600)" }}>
                    Upgrade
                  </a>{" "}
                  ou{" "}
                  <a href="/plano#avulsos" className="font-semibold" style={{ color: "var(--brand-600)" }}>
                    compre avulsa (R$ 4,90)
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Cenário */}
          <div>
            <label className="block text-sm font-semibold mb-3">Cenário da foto</label>
            {/* Mobile: horizontal scroll carousel · Desktop: grid */}
            <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible md:pb-0 md:snap-none">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.value}
                    onClick={() => { setBackground(bg.value); haptics.light(); }}
                    className="group flex-shrink-0 w-20 md:w-auto rounded-xl overflow-hidden text-center transition-all duration-300 md:hover:scale-[1.02] md:hover:-translate-y-0.5 relative snap-start"
                  >
                    {/* Border Overlay */}
                    <div className={`absolute inset-0 pointer-events-none rounded-xl transition-all duration-300 z-20 ${
                      background === bg.value 
                        ? "ring-2 ring-inset ring-brand-500 shadow-[inset_0_0_12px_rgba(236,72,153,0.2)]" 
                        : "ring-1 ring-inset ring-[var(--border)] opacity-50 group-hover:ring-brand-500/50 group-hover:opacity-100"
                    }`} />
                    {bg.thumb ? (
                      <img src={bg.thumb} alt={bg.label} className="w-full aspect-square object-cover object-top" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center" style={{ background: "var(--surface)" }}>
                        <span className="text-lg">✏️</span>
                      </div>
                    )}
                    <div className="py-1 md:py-1.5 px-1" style={{ background: "var(--surface)" }}>
                      <p className="text-[10px] sm:text-xs font-medium truncate">
                        {bg.label}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Advanced options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium transition min-h-[44px]"
              style={{ color: "var(--muted)" }}
            >
              Personalizar mais
              <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                <IconChevronDown />
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 animate-fade-in">
                {/* Nome da campanha */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Nome da campanha <span className="font-normal" style={{ color: "var(--muted)" }}>(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    onFocus={(e) => {
                      if (window.innerWidth < 1024) {
                        setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
                      }
                    }}
                    placeholder="Ex: Vestido floral verão"
                    maxLength={60}
                    className="w-full h-12 px-4 rounded-xl text-sm font-semibold outline-none transition-all"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                {/* Preço de venda */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Preço de venda <span className="font-normal" style={{ color: "var(--muted)" }}>(opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--muted)" }}>
                      R$
                    </span>
                    <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                      onFocus={(e) => {
                        if (window.innerWidth < 1024) {
                          setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
                        }
                      }}
                      placeholder="Ex: 89,90"
                      className="w-full h-12 pl-10 pr-4 rounded-xl text-lg font-semibold outline-none transition-all"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Público-alvo</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="">Automático (IA decide)</option>
                    {audiences.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tom de voz</label>
                  <div className="flex flex-wrap gap-2">
                    {tones.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => { haptics.light(); setTone(tone === t.value ? "" : t.value); }}
                        className="px-4 py-2 rounded-full text-xs font-medium transition-all min-h-[44px]"
                        style={{
                          background: tone === t.value ? "var(--brand-100)" : "var(--surface)",
                          color: tone === t.value ? "var(--brand-700)" : "var(--muted)",
                          border: tone === t.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generate button (Flutuante no Mobile, Natural no Desktop) */}
          <div className="sticky md:bottom-6 lg:static lg:bottom-auto px-4 py-3 lg:p-0 my-4 lg:my-0 z-20 w-full rounded-2xl lg:rounded-none shadow-[0_8px_30px_rgba(0,0,0,0.12)] lg:shadow-none border border-border lg:border-none bg-background/90 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none transition-all" style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}>
            {campaignsLimit !== null && campaignsUsed >= campaignsLimit && userCredits <= 0 ? (
              <Link
                href="/plano"
                className="btn-primary w-full !py-4 text-base flex items-center justify-center gap-2"
                style={{
                  boxShadow: "0 8px 30px rgba(139,92,246,0.3)",
                  background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                {campaignsLimit === 0 ? "⚡ Ativar plano para gerar" : "Recarregar créditos"}
              </Link>
            ) : (
              <button
                onClick={() => {
                  haptics.medium();
                  if (preview && !closeUpFile && !secondFile) {
                    setShowSinglePhotoWarning(true);
                  } else {
                    handleGenerate();
                  }
                }}
                disabled={!preview}
                className="btn-primary w-full !py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                style={{
                  boxShadow: preview ? "0 8px 30px rgba(236,72,153,0.3)" : "none",
                }}
              >
                <IconZap />
                Gerar fotos agora
              </button>
            )}

            {!preview && campaignsLimit !== null && (campaignsUsed < campaignsLimit || userCredits > 0) && (
              <p className="text-xs text-center mt-3" style={{ color: "var(--muted)" }}>
                Envie pelo menos a foto principal para começar
              </p>
            )}
          </div>
        </div>
      </div>

      </div>

      {/* Single Photo Warning — FORA da div com transform */}
      <AnimatePresence>
        {showSinglePhotoWarning && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto"
            style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setShowSinglePhotoWarning(false)}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-2xl overflow-hidden"
              style={{ background: "var(--card, var(--background))", boxShadow: "0 -10px 40px rgba(0,0,0,0.4)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full" style={{ background: "var(--gradient-brand)" }} />

              <div className="p-5 pb-7 sm:p-6 sm:pb-6">
                {/* Drag handle (mobile) */}
                <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border)" }} />

                {/* Icon + Title */}
                <div className="text-center mb-5">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))", border: "1px solid rgba(251,191,36,0.2)" }}
                  >
                    <span className="text-3xl">📸</span>
                  </div>
                  <h3 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                    Resultado ainda melhor?
                  </h3>
                  <p className="text-sm mt-2 leading-relaxed max-w-[280px] mx-auto" style={{ color: "var(--muted)" }}>
                    Com mais fotos, a IA captura melhor os detalhes do tecido e do caimento.
                  </p>
                </div>

                {/* Tip cards — visual, easy to scan */}
                <div className="space-y-2.5 mb-6">
                  {/* Tip 1 */}
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "var(--brand-50)", color: "var(--brand-500)" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--foreground)" }}>
                        Detalhe ou ângulo
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        Close da textura, costura ou estampa
                      </p>
                    </div>
                  </div>

                  {/* Tip 2 */}
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "var(--accent-50, var(--brand-50))", color: "var(--accent-500, var(--brand-500))" }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--foreground)" }}>
                        Segunda peça
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        Ex: calça do conjunto, saia avulsa
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions — stacked, touch-friendly (min 48px) */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowSinglePhotoWarning(false);
                      handleGenerate();
                    }}
                    className="btn-primary w-full text-sm font-semibold"
                    style={{ minHeight: "52px", borderRadius: "14px" }}
                  >
                    ⚡ Gerar com 1 foto
                  </button>
                  <button
                    onClick={() => setShowSinglePhotoWarning(false)}
                    className="w-full text-sm font-semibold rounded-xl transition-colors"
                    style={{
                      color: "var(--foreground)",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      minHeight: "52px",
                      borderRadius: "14px",
                    }}
                  >
                    ← Adicionar mais fotos
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
