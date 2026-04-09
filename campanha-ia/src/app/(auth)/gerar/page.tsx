"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const backgrounds = [
  { value: "branco",     label: "Branco",       thumb: "/bg/branco.png",    ai: false },
  { value: "estudio",    label: "Estúdio",       thumb: "/bg/estudio.png",   ai: false },
  { value: "lifestyle",  label: "Lifestyle",    thumb: "/bg/lifestyle.png", ai: true },
  { value: "urbano",     label: "Urbano",       thumb: "/bg/urbano.png",    ai: true },
  { value: "natureza",   label: "Natureza",     thumb: "/bg/natureza.png",  ai: true },
  { value: "interior",   label: "Interior",     thumb: "/bg/interior.png",  ai: true },
  { value: "boutique",   label: "Boutique",     thumb: "/bg/boutique.png",  ai: true },
  { value: "gradiente",  label: "Gradiente",    thumb: "/bg/gradiente.png", ai: false },
  { value: "personalizado", label: "Personalizado", thumb: null,            ai: true },
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [background, setBackground] = useState("branco");
  const [customBg, setCustomBg] = useState("");
  const [storeBrandColor, setStoreBrandColor] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
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
  const [bodyType, setBodyType] = useState<"normal" | "plus">("normal");
  const [modelBank, setModelBank] = useState<ModelBankItem[]>([]);
  const [customModels, setCustomModels] = useState<{ id: string; name: string; body_type: string; skin_tone?: string; photo_url?: string | null; is_active: boolean }[]>([]);
  const [userPlan, setUserPlan] = useState("free");
  const [selectedModelId, setSelectedModelId] = useState<string>("random");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [showAllModels, setShowAllModels] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<{
    used: number; limit: number; credits: number;
  } | null>(null);
  const [showSinglePhotoWarning, setShowSinglePhotoWarning] = useState(false);

  const planModelLimits: Record<string, number> = {
    free: 0, gratis: 0, starter: 1, pro: 3, business: 5, agencia: 10,
  };
  const maxModels = planModelLimits[userPlan] || 1;

  // Carregar banco de modelos (stock) + modelos personalizadas da loja
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
      })
      .catch(() => {});
    // Carregar cor da marca da loja
    fetch("/api/store")
      .then(res => res.json())
      .then(data => {
        const bc = data?.data?.brand_colors as { primary?: string } | null;
        if (bc?.primary) setStoreBrandColor(bc.primary);
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
  }, [customModels.filter(m => !m.photo_url).map(m => m.id).join(",")]);

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
      formData.append("storeName", "Minha Loja");
      if (audience) formData.append("targetAudience", audience);
      if (tone) formData.append("toneOverride", tone);
      formData.append("bodyType", bodyType);

      const bgFinal = background === "personalizado" ? `personalizado:${customBg}` : background;
      formData.append("backgroundType", bgFinal);
      if (storeBrandColor) formData.append("brandColor", storeBrandColor);
      if (selectedModelId !== "random") {
        formData.append("modelBankId", selectedModelId);
      } else if (modelBank.length > 0) {
        const randomModel = modelBank[Math.floor(Math.random() * modelBank.length)];
        formData.append("modelBankId", randomModel.id);
      }

      // Call API — expects SSE (text/event-stream) response
      const response = await fetch("/api/campaign/generate", {
        method: "POST",
        body: formData,
      });

      // Handle non-streaming error responses (quota exceeded, etc.)
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        clearInterval(fallbackInterval);
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
        throw new Error(errorData.error || `Erro ${response.status}`);
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
            setTimeout(() => {
              router.push("/gerar/demo");
            }, 1500);
            return true; // signals "done handled"
          } else if (eventType === "error") {
            clearInterval(fallbackInterval);
            streamDone = true;
            setIsGenerating(false);
            setError(payload.error || "Erro ao gerar campanha");
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
        setIsGenerating(false);
        setError("Conexão interrompida. Tente novamente.");
      }

    } catch (err: any) {
      clearInterval(fallbackInterval);
      setIsGenerating(false);
      setError(err.message || "Erro ao gerar campanha");
    }
  };

  if (isGenerating) {
    return (
      <GenerationLoadingScreen step={generationStep} steps={generationSteps} />
    );
  }

  return (
    <div className="animate-fade-in-up pb-24 md:pb-0">
      {/* Quota Exceeded Modal (seção 5.5) */}
      {quotaExceeded && (
        <QuotaExceededModal
          used={quotaExceeded.used}
          limit={quotaExceeded.limit}
          credits={quotaExceeded.credits}
          onClose={() => setQuotaExceeded(null)}
          onUpgrade={() => { window.location.href = "/plano"; }}
          onBuyCredits={async (type, qty) => {
            // Mapear type+qty para packageId que a API espera
            const packageMap: Record<string, string> = {
              "campaigns_1": "1_campanha",
              "campaigns_5": "5_campanhas",
              "campaigns_10": "10_campanhas",
              "models_1": "1_modelo",
              "models_3": "3_modelos",
            };
            const packageId = packageMap[`${type}_${qty}`];
            if (!packageId) return;

            try {
              const res = await fetch("/api/credits", {
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

      {/* Error Modal — mobile-first overlay */}
      {error && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in-up"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
          onClick={() => setError(null)}
        >
          <div
            className="w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-2xl overflow-hidden animate-fade-in-up"
            style={{ background: "var(--background)", boxShadow: "0 -4px 40px rgba(0,0,0,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visual header */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6" style={{ background: "linear-gradient(135deg, #FEF2F2 0%, #FFF1F2 100%)" }}>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "#FEE2E2", boxShadow: "0 4px 16px rgba(220,38,38,0.15)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#991B1B" }}>
                Não foi possível gerar
              </h3>
              <p className="text-sm mt-1 text-center" style={{ color: "#B91C1C" }}>
                Houve uma instabilidade temporária. Isso pode acontecer em horários de pico.
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
                onClick={() => { setError(null); handleGenerate(); }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[48px]"
                style={{ background: "var(--gradient-brand)", color: "white", boxShadow: "0 4px 16px rgba(236,72,153,0.3)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Tentar novamente
              </button>
              <button
                onClick={() => setError(null)}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all min-h-[48px]"
                style={{ color: "var(--muted)" }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Criar <span className="gradient-text">Campanha</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Envie a foto da peça e receba 3 fotos editoriais prontas para postar
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left — Upload (3 fotos: 1 grande + 2 pequenas) */}
        <div className="space-y-6">
          {/* Upload Area — Layout 1 grande + 2 pequenas */}
          <div className="flex flex-col sm:flex-row gap-3" style={{ minHeight: "280px" }}>
            {/* Foto Principal (grande) */}
            <div
              className="relative rounded-2xl overflow-hidden transition-all cursor-pointer group flex-[3]"
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
                    <p className="font-semibold text-sm mb-0.5">Foto da peça *</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Mostrando a peça inteira, de frente
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna direita: 2 fotos pequenas */}
            <div className="flex flex-row sm:flex-col gap-3 flex-[2]">
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
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      <IconX />
                    </button>
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>Close-up</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-3 h-full">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-50)", color: "var(--brand-500)" }}>
                      <IconSearch />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold">Detalhe do tecido</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>Ajuda a IA acertar a textura</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}>opcional</span>
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
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      <IconX />
                    </button>
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>2ª peça</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-3 h-full">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-50)", color: "var(--brand-500)" }}>
                      <IconPlus />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold">Compor o look</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>Outra peça para combinar</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}>opcional</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Guia Relâmpago — dicas de foto + antes/depois da vitrine */}
          <PhotoTipsCard hasPhoto={!!preview} />


          {/* Price */}
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
        </div>

        {/* Right — Options */}
        <div className="space-y-6">


          {/* Body Type — Biotipo */}
          <div className="animate-fade-in">
            <label className="block text-sm font-semibold mb-2">Biotipo da modelo</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setBodyType("normal"); setModelFilter("normal"); setShowAllModels(false); }}
                className="p-3 rounded-xl text-center transition-all"
                style={{
                  border: bodyType === "normal"
                    ? "2px solid var(--brand-500)"
                    : "1px solid var(--border)",
                  background: bodyType === "normal" ? "var(--brand-50)" : "var(--surface)",
                }}
              >
                <span className="text-2xl">👤</span>
                <p className="text-sm font-semibold mt-1">Padrão</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>P · M · G</p>
              </button>
              <button
                onClick={() => { setBodyType("plus"); setModelFilter("plus_size"); setShowAllModels(false); }}
                className="p-3 rounded-xl text-center transition-all"
                style={{
                  border: bodyType === "plus"
                    ? "2px solid var(--brand-500)"
                    : "1px solid var(--border)",
                  background: bodyType === "plus" ? "var(--brand-50)" : "var(--surface)",
                }}
              >
                <span className="text-2xl">💃</span>
                <p className="text-sm font-semibold mt-1">Curvilínea</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>GG · XGG · EGG</p>
              </button>
            </div>
          </div>

          {/* Model Bank Selector — Unificado (customizadas + stock) */}
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-semibold">Modelo virtual</label>
                {customModels.length > 0 && (
                  <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
                    {customModels.length}/{maxModels} personalizadas
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {["all", "normal", "plus_size"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setModelFilter(f)}
                    className="px-3 py-2 rounded-md text-xs font-medium transition-all min-h-[36px]"
                    style={{
                      background: modelFilter === f ? "var(--brand-100)" : "transparent",
                      color: modelFilter === f ? "var(--brand-700)" : "var(--muted)",
                    }}
                  >
                    {f === "all" ? "Todas" : f === "normal" ? "Padrão" : "Curvilínea"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {/* Opção aleatória */}
              <button
                onClick={() => setSelectedModelId("random")}
                className="aspect-[3/4] rounded-lg flex flex-col items-center justify-center text-center transition-all"
                style={{
                  border: selectedModelId === "random"
                    ? "2px solid var(--brand-500)"
                    : "1px solid var(--border)",
                  background: selectedModelId === "random" ? "var(--brand-50)" : "var(--surface)",
                }}
              >
                <span className="text-lg">🎲</span>
                <span className="text-[10px] font-medium mt-1" style={{ color: "var(--muted)" }}>Aleatória</span>
              </button>

              {/* ⭐ Modelos personalizadas da loja (borda dourada) */}
              {customModels
                .filter(m => modelFilter === "all" || m.body_type === modelFilter || (modelFilter === "plus_size" && m.body_type === "plus_size"))
                .map((model) => (
                <div key={`custom-${model.id}`} className="relative group">
                  <button
                    onClick={() => setSelectedModelId(model.id)}
                    className="w-full aspect-[3/4] rounded-lg overflow-hidden relative transition-all"
                    style={{
                      border: selectedModelId === model.id
                        ? "2px solid var(--brand-500)"
                        : "2px solid #D4A017",
                      boxShadow: "0 0 8px rgba(212,160,23,0.25)",
                    }}
                    title={`⭐ ${model.name} (sua modelo)`}
                  >
                    {model.photo_url ? (
                      <img
                        src={model.photo_url}
                        alt={model.name}
                        className="w-full h-full object-cover"
                        style={{ animation: "fadeIn 0.5s ease-in" }}
                      />
                    ) : (
                      <ModelPlaceholder
                        skinTone={model.skin_tone}
                        bodyType={model.body_type}
                        name={model.name}
                        isGenerating={true}
                      />
                    )}
                    {/* Badge ⭐ */}
                    <div className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "linear-gradient(135deg, #D4A017, #F5C842)", color: "white" }}>
                      ⭐ Sua
                    </div>
                    {selectedModelId === model.id && (
                      <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                  </button>

                  {/* Botão excluir — visível no hover (desktop) e sempre no mobile */}
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

                  {/* Overlay de confirmação */}
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
              ))}

              {/* + Criar nova modelo / Upgrade CTA */}
              {customModels.length < maxModels ? (
                <a
                  href="/modelo"
                  className="aspect-[3/4] rounded-lg flex flex-col items-center justify-center text-center transition-all hover:scale-[1.03]"
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
                  className="aspect-[3/4] rounded-lg flex flex-col items-center justify-center text-center transition-all hover:scale-[1.03]"
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

              {/* Modelos stock do banco */}
              {(() => {
                const filtered = modelBank.filter(m => modelFilter === "all" || m.body_type === modelFilter);
                const visibleModels = showAllModels ? filtered : filtered.slice(0, 6);
                return visibleModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModelId(model.id)}
                    className="aspect-[3/4] rounded-lg overflow-hidden relative transition-all"
                    style={{
                      border: selectedModelId === model.id
                        ? "2px solid var(--brand-500)"
                        : "1px solid var(--border)",
                    }}
                    title={model.name}
                  >
                    <img
                      src={model.thumbnail_url || model.image_url}
                      alt={model.name}
                      className="w-full h-full object-cover"
                    />
                    {selectedModelId === model.id && (
                      <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                  </button>
                ));
              })()}
            </div>

            {/* Botão ver mais modelos */}
            {(() => {
              const filtered = modelBank.filter(m => modelFilter === "all" || m.body_type === modelFilter);
              if (filtered.length <= 6) return null;
              return (
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
                    <>▼ Ver todas ({filtered.length - 6} mais)</>
                  )}
                </button>
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
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {(() => {
                // Build dynamic backgrounds with "Minha Marca" if store has brand color
                const allBgs = [...backgrounds];
                if (storeBrandColor) {
                  allBgs.splice(1, 0, {
                    value: "minha_marca",
                    label: "Minha Marca",
                    thumb: null,
                    ai: true,
                  });
                }
                return allBgs.map((bg) => (
                  <button
                    key={bg.value}
                    onClick={() => setBackground(bg.value)}
                    className="rounded-xl overflow-hidden text-center transition-all"
                    style={{
                      border: background === bg.value
                        ? "2px solid var(--brand-500)"
                        : "1px solid var(--border)",
                    }}
                  >
                    {bg.value === "minha_marca" && storeBrandColor ? (
                      <div
                        className="w-full aspect-square flex flex-col items-center justify-center gap-1.5 relative"
                        style={{
                          background: `linear-gradient(145deg, ${storeBrandColor}15 0%, ${storeBrandColor}40 100%)`,
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${storeBrandColor}, ${storeBrandColor}CC)`,
                            border: "2px solid white",
                          }}
                        />
                        <span className="text-[9px] font-bold tracking-wide uppercase" style={{ color: storeBrandColor }}>Marca</span>
                      </div>
                    ) : bg.value === "personalizado" ? (
                      <div
                        className="w-full aspect-square flex flex-col items-center justify-center gap-1"
                        style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--brand-50) 100%)" }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span className="text-[9px] font-medium" style={{ color: "var(--muted)" }}>Descreva</span>
                      </div>
                    ) : bg.thumb ? (
                      <img src={bg.thumb} alt={bg.label} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center" style={{ background: "var(--surface)" }}>
                        <span className="text-lg">✏️</span>
                      </div>
                    )}
                    <div className="py-1.5 px-1" style={{ background: "var(--surface)" }}>
                      <p className="text-[10px] sm:text-xs font-medium truncate">
                        {bg.value === "personalizado" ? "Personalizar" : bg.label}
                      </p>
                    </div>
                  </button>
                ));
              })()}
            </div>
            {background === "personalizado" && (
              <input
                type="text"
                value={customBg}
                onChange={(e) => setCustomBg(e.target.value)}
                placeholder="Descreva: parede rosa da loja, praia ao pôr do sol…"
                maxLength={60}
                className="w-full h-10 px-3 mt-2 rounded-xl text-sm outline-none transition-all"
                style={{ background: "var(--surface)", border: "1px solid var(--brand-300)", color: "var(--foreground)" }}
                autoFocus
              />
            )}
          </div>

          {/* Advanced options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium transition"
              style={{ color: "var(--muted)" }}
            >
              Personalizar mais
              <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                <IconChevronDown />
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 animate-fade-in">
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
                        onClick={() => setTone(tone === t.value ? "" : t.value)}
                        className="px-3.5 py-2 rounded-full text-xs font-medium transition-all min-h-[36px]"
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

          {/* Generate button */}
          <button
            onClick={() => {
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

          {!preview && (
            <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
              Envie pelo menos a foto principal para começar
            </p>
          )}
        </div>
      </div>

      {/* Single Photo Warning — Bottom Sheet (mobile-first) */}
      {showSinglePhotoWarning && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          onClick={() => setShowSinglePhotoWarning(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Sheet */}
          <div
            className="relative w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-2xl p-6 pb-8 sm:pb-6 animate-fade-in-up"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />

            {/* Icon + Title */}
            <div className="text-center mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(251, 191, 36, 0.12)" }}
              >
                <span className="text-2xl">📸</span>
              </div>
              <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                Quer um resultado ainda melhor?
              </h3>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>
                Você enviou apenas 1 foto. Com mais ângulos, a IA captura
                melhor os detalhes e gera imagens mais fiéis à sua peça.
              </p>
            </div>

            {/* Suggestions */}
            <div
              className="rounded-xl p-3.5 mb-5 space-y-2"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                💡 Sugestões para melhores resultados:
              </p>
              <ul className="space-y-1.5">
                {[
                  "Adicione um close do tecido (campo \"Detalhe\")",
                  "Envie outro ângulo da peça (campo \"Compor o look\")",
                ].map((tip) => (
                  <li
                    key={tip}
                    className="text-xs flex items-start gap-2"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions — stacked on mobile */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setShowSinglePhotoWarning(false);
                  handleGenerate();
                }}
                className="btn-primary w-full !py-3.5 text-sm"
                style={{ minHeight: "48px" }}
              >
                ⚡ Gerar mesmo assim
              </button>
              <button
                onClick={() => setShowSinglePhotoWarning(false)}
                className="w-full py-3 text-sm font-medium rounded-xl transition-colors"
                style={{
                  color: "var(--brand-600)",
                  background: "var(--brand-50)",
                  border: "1px solid var(--brand-100)",
                  minHeight: "48px",
                }}
              >
                Voltar e adicionar mais fotos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
