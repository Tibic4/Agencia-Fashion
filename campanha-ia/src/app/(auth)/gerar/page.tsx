"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuotaExceededModal from "@/components/QuotaExceededModal";
import ModelPlaceholder from "@/components/ModelPlaceholder";
import GenerationLoadingScreen from "@/components/GenerationLoadingScreen";

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

const objectives = [
  { value: "venda_imediata", label: "💰 Venda imediata", desc: "Foco em conversão rápida" },
  { value: "lancamento", label: "🚀 Lançamento", desc: "Novidade, curiosidade" },
  { value: "promocao", label: "🔥 Promoção", desc: "Desconto, urgência" },
  { value: "engajamento", label: "💬 Engajamento", desc: "Curtidas, comentários" },
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

const productTypes = [
  { value: "blusa",     label: "👚 Blusa / Regata / Top" },
  { value: "saia",      label: "👗 Saia" },
  { value: "calca",     label: "👖 Calça / Shorts" },
  { value: "vestido",   label: "👗 Vestido" },
  { value: "macacao",   label: "🩱 Macacão / Culotte" },
  { value: "jaqueta",   label: "🧥 Jaqueta / Casaco" },
  { value: "acessorio", label: "💎 Acessório" },
];

const materials = [
  { value: "viscose",   label: "Viscose" },
  { value: "algodao",   label: "Algodão" },
  { value: "linho",     label: "Linho" },
  { value: "crepe",     label: "Crepe" },
  { value: "malha",     label: "Malha" },
  { value: "jeans",     label: "Jeans" },
  { value: "trico",     label: "Tricô" },
  { value: "seda",      label: "Seda / Cetim" },
  { value: "couro",     label: "Couro" },
  { value: "moletom",   label: "Moletom" },
  { value: "chiffon",   label: "Chiffon" },
  { value: "poliester", label: "Poliéster" },
  { value: "la",        label: "Lã" },
  { value: "nylon",     label: "Nylon" },
  { value: "suede",     label: "Suede" },
  { value: "outro",     label: "Outro" },
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
  const [objective, setObjective] = useState("venda_imediata");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [background, setBackground] = useState("branco");
  const [customBg, setCustomBg] = useState("");

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
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [material, setMaterial] = useState("");
  const [customMaterial, setCustomMaterial] = useState("");
  const [material2, setMaterial2] = useState("");
  const [customMaterial2, setCustomMaterial2] = useState("");
  const [bodyType, setBodyType] = useState<"normal" | "plus">("normal");
  const [priceMode, setPriceMode] = useState<"conjunto" | "separado">("conjunto");
  const [price2, setPrice2] = useState("");

  const isConjunto = selectedTypes.length === 2;
  const productType = isConjunto ? `conjunto:${selectedTypes.join("+")}` : selectedTypes[0] || "";

  function toggleProductType(value: string) {
    setSelectedTypes(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value);
      if (prev.length >= 2) return [prev[1], value]; // swap oldest
      return [...prev, value];
    });
  }
  const [modelBank, setModelBank] = useState<ModelBankItem[]>([]);
  const [customModels, setCustomModels] = useState<{ id: string; name: string; body_type: string; skin_tone?: string; photo_url?: string | null; is_active: boolean }[]>([]);
  const [userPlan, setUserPlan] = useState("free");
  const [selectedModelId, setSelectedModelId] = useState<string>("random");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<{
    used: number; limit: number; credits: number;
  } | null>(null);

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
    { label: "Analisando produto...", progress: 10 },
    { label: "Identificando cores e tecido...", progress: 20 },
    { label: "Criando estratégia de venda...", progress: 30 },
    { label: "Escrevendo textos para Instagram...", progress: 40 },
    { label: "Criando roteiro de Stories...", progress: 50 },
    { label: "Adaptando para WhatsApp...", progress: 58 },
    { label: "Refinando copy e hashtags...", progress: 66 },
    { label: "Processando imagem com IA...", progress: 75 },
    { label: "Montando criativo final...", progress: 85 },
    { label: "Avaliando qualidade (score)...", progress: 93 },
    { label: "Pronto! ✨", progress: 100 },
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

    // Animate progress steps while API processes
    const interval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev >= generationSteps.length - 2) {
          // Pause at second-to-last step until API responds
          return prev;
        }
        return prev + 1;
      });
    }, 2500);

    try {
      // Build FormData
      const formData = new FormData();
      formData.append("image", selectedFile);
      if (closeUpFile) formData.append("closeUpImage", closeUpFile);
      if (secondFile) formData.append("secondImage", secondFile);
      formData.append("price", price);
      formData.append("objective", objective);
      formData.append("storeName", "Minha Loja");
      if (audience) formData.append("targetAudience", audience);
      if (tone) formData.append("toneOverride", tone);
      if (productType) formData.append("productType", productType);
      const materialFinal = material === "outro" ? customMaterial : material;
      if (materialFinal) formData.append("material", materialFinal);
      if (isConjunto) {
        const material2Final = material2 === "outro" ? customMaterial2 : material2;
        if (material2Final) formData.append("material2", material2Final);
      }
      if (isConjunto && priceMode === "separado" && price2) {
        formData.append("price2", price2);
        formData.append("priceMode", "separado");
      }
      formData.append("bodyType", bodyType);

      const bgFinal = background === "personalizado" ? `personalizado:${customBg}` : background;
      formData.append("backgroundType", bgFinal);
      // Modelo do banco (aleatória ou selecionada)
      if (selectedModelId !== "random") {
        formData.append("modelBankId", selectedModelId);
      } else if (modelBank.length > 0) {
        const randomModel = modelBank[Math.floor(Math.random() * modelBank.length)];
        formData.append("modelBankId", randomModel.id);
      }

      // Call API
      const response = await fetch("/api/campaign/generate", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === "QUOTA_EXCEEDED") {
          clearInterval(interval);
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

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Erro desconhecido");
      }

      // Store result for the demo page
      sessionStorage.setItem("campaignResult", JSON.stringify(data));

      // Store form data for regeneration
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        sessionStorage.setItem("campaignFormData", JSON.stringify({
          imageBase64: base64,
          price,
          objective,
          targetAudience: audience,
          toneOverride: tone,
        }));
      };
      reader.readAsDataURL(selectedFile);

      // Show completion then redirect
      setGenerationStep(generationSteps.length - 1);
      setTimeout(() => {
        router.push("/gerar/demo");
      }, 1500);

    } catch (err: any) {
      clearInterval(interval);
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

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <span>⚠️</span>
          <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-sm" style={{ color: "#DC2626" }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Nova <span className="gradient-text">Campanha</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Upload da foto + preço = campanha completa em 60 segundos
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left — Upload (3 fotos: 1 grande + 2 pequenas) */}
        <div className="space-y-6">
          {/* Upload Area — Layout 1 grande + 2 pequenas */}
          <div className="flex gap-3" style={{ minHeight: "320px" }}>
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
                    <p className="font-semibold text-sm mb-0.5">Foto principal *</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Visão completa da peça
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna direita: 2 fotos pequenas */}
            <div className="flex flex-col gap-3 flex-[2]">
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
                      <p className="text-xs font-semibold">Close-up do tecido</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>Melhora a precisão</p>
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
                      <p className="text-xs font-semibold">Segunda peça</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>Outra peça do look</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}>opcional</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product Type — Multi-select (até 2 = conjunto) */}
          <div>
            <label className="block text-sm font-semibold mb-1">Tipo de produto *</label>
            <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
              Selecione 1 peça ou 2 para conjunto
            </p>
            <div className="grid grid-cols-2 gap-2">
              {productTypes.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => toggleProductType(pt.value)}
                  className="p-2.5 rounded-xl text-left text-sm transition-all"
                  style={{
                    background: selectedTypes.includes(pt.value) ? "var(--gradient-card)" : "var(--surface)",
                    border: selectedTypes.includes(pt.value)
                      ? "1px solid var(--brand-300)"
                      : "1px solid var(--border)",
                    fontWeight: selectedTypes.includes(pt.value) ? 600 : 400,
                  }}
                >
                  {pt.label}
                  {selectedTypes.includes(pt.value) && (
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ml-2"
                      style={{
                        background: "var(--brand-500)",
                        color: "white",
                        minWidth: "20px"
                      }}
                    >
                      {selectedTypes.indexOf(pt.value) + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {isConjunto && (
              <div className="mt-3 p-3 rounded-xl text-sm font-semibold flex items-center gap-2" style={{ background: "var(--brand-50)", color: "var(--brand-700)", border: "1px solid var(--brand-200)" }}>
                🎀 Conjunto: {productTypes.find(p => p.value === selectedTypes[0])?.label?.replace(/^.\s/, "")} + {productTypes.find(p => p.value === selectedTypes[1])?.label?.replace(/^.\s/, "")}
              </div>
            )}
          </div>

          {/* Material / Tecido — chips visuais (dual para conjunto) */}
          {isConjunto ? (
            <div className="space-y-4">
              {/* Material Peça 1 */}
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold" style={{ background: "var(--brand-500)", color: "white" }}>1</span>
                  Material — {productTypes.find(p => p.value === selectedTypes[0])?.label}
                </label>
                <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                  Opcional — a IA detecta pela foto
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {materials.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMaterial(material === m.value ? "" : m.value)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: material === m.value ? "var(--brand-100)" : "var(--surface)",
                        color: material === m.value ? "var(--brand-700)" : "var(--muted)",
                        border: material === m.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {material === "outro" && (
                  <input
                    type="text"
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    placeholder="Ex: crepe georgette, tricoline..."
                    maxLength={40}
                    className="w-full h-10 px-3 mt-2 rounded-xl text-sm outline-none transition-all"
                    style={{ background: "var(--surface)", border: "1px solid var(--brand-300)", color: "var(--foreground)" }}
                    autoFocus
                  />
                )}
              </div>
              {/* Divisor visual */}
              <div style={{ height: "1px", background: "var(--border)" }} />
              {/* Material Peça 2 */}
              <div>
                <label className="block text-sm font-semibold mb-1" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold" style={{ background: "var(--brand-500)", color: "white" }}>2</span>
                  Material — {productTypes.find(p => p.value === selectedTypes[1])?.label}
                </label>
                <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                  Opcional — a IA detecta pela foto
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {materials.map((m) => (
                    <button
                      key={`m2-${m.value}`}
                      onClick={() => setMaterial2(material2 === m.value ? "" : m.value)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: material2 === m.value ? "var(--brand-100)" : "var(--surface)",
                        color: material2 === m.value ? "var(--brand-700)" : "var(--muted)",
                        border: material2 === m.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {material2 === "outro" && (
                  <input
                    type="text"
                    value={customMaterial2}
                    onChange={(e) => setCustomMaterial2(e.target.value)}
                    placeholder="Ex: crepe georgette, tricoline..."
                    maxLength={40}
                    className="w-full h-10 px-3 mt-2 rounded-xl text-sm outline-none transition-all"
                    style={{ background: "var(--surface)", border: "1px solid var(--brand-300)", color: "var(--foreground)" }}
                    autoFocus
                  />
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold mb-1">
                Material / Tecido
              </label>
              <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                Opcional — a IA detecta pela foto, mas informar melhora a precisão
              </p>
              <div className="flex flex-wrap gap-1.5">
                {materials.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMaterial(material === m.value ? "" : m.value)}
                    className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: material === m.value ? "var(--brand-100)" : "var(--surface)",
                      color: material === m.value ? "var(--brand-700)" : "var(--muted)",
                      border: material === m.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {material === "outro" && (
                <input
                  type="text"
                  value={customMaterial}
                  onChange={(e) => setCustomMaterial(e.target.value)}
                  placeholder="Ex: crepe georgette, tricoline..."
                  maxLength={40}
                  className="w-full h-10 px-3 mt-2 rounded-xl text-sm outline-none transition-all"
                  style={{ background: "var(--surface)", border: "1px solid var(--brand-300)", color: "var(--foreground)" }}
                  autoFocus
                />
              )}
            </div>
          )}

          {/* Price — adaptável a conjunto */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              {isConjunto ? "Preço do conjunto" : "Preço de venda"} <span className="font-normal" style={{ color: "var(--muted)" }}>(opcional)</span>
            </label>

            {/* Toggle preço conjunto vs separado */}
            {isConjunto && (
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setPriceMode("conjunto")}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: priceMode === "conjunto" ? "var(--brand-100)" : "var(--surface)",
                    color: priceMode === "conjunto" ? "var(--brand-700)" : "var(--muted)",
                    border: priceMode === "conjunto" ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                  }}
                >
                  💰 Preço único
                </button>
                <button
                  onClick={() => setPriceMode("separado")}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: priceMode === "separado" ? "var(--brand-100)" : "var(--surface)",
                    color: priceMode === "separado" ? "var(--brand-700)" : "var(--muted)",
                    border: priceMode === "separado" ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                  }}
                >
                  💰💰 Preços separados
                </button>
              </div>
            )}

            {priceMode === "separado" && isConjunto ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "var(--muted)" }}>R$</span>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder={productTypes.find(p => p.value === selectedTypes[0])?.label?.replace(/^.\s/, "") || "Peça 1"}
                    className="w-full h-11 pl-9 pr-3 rounded-xl text-sm font-semibold outline-none transition-all"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "var(--muted)" }}>R$</span>
                  <input
                    type="text"
                    value={price2}
                    onChange={(e) => setPrice2(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder={productTypes.find(p => p.value === selectedTypes[1])?.label?.replace(/^.\s/, "") || "Peça 2"}
                    className="w-full h-11 pl-9 pr-3 rounded-xl text-sm font-semibold outline-none transition-all"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>
            ) : (
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
            )}
          </div>
        </div>

        {/* Right — Options */}
        <div className="space-y-6">
          {/* Objective */}
          <div>
            <label className="block text-sm font-semibold mb-3">Objetivo</label>
            <div className="grid grid-cols-2 gap-2">
              {objectives.map((obj) => (
                <button
                  key={obj.value}
                  onClick={() => setObjective(obj.value)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    background: objective === obj.value ? "var(--gradient-card)" : "var(--surface)",
                    border: objective === obj.value
                      ? "1px solid var(--brand-300)"
                      : "1px solid var(--border)",
                  }}
                >
                  <p className="text-sm font-semibold">{obj.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{obj.desc}</p>
                </button>
              ))}
            </div>
          </div>



          {/* Body Type — Tipo de Corpo */}
          <div className="animate-fade-in">
            <label className="block text-sm font-semibold mb-2">Tipo de corpo da modelo</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setBodyType("normal"); setModelFilter("normal"); }}
                className="p-3 rounded-xl text-center transition-all"
                style={{
                  border: bodyType === "normal"
                    ? "2px solid var(--brand-500)"
                    : "1px solid var(--border)",
                  background: bodyType === "normal" ? "var(--brand-50)" : "var(--surface)",
                }}
              >
                <span className="text-2xl">👤</span>
                <p className="text-sm font-semibold mt-1">Normal</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Tamanhos P / M / G</p>
              </button>
              <button
                onClick={() => { setBodyType("plus"); setModelFilter("plus_size"); }}
                className="p-3 rounded-xl text-center transition-all"
                style={{
                  border: bodyType === "plus"
                    ? "2px solid var(--brand-500)"
                    : "1px solid var(--border)",
                  background: bodyType === "plus" ? "var(--brand-50)" : "var(--surface)",
                }}
              >
                <span className="text-2xl">💃</span>
                <p className="text-sm font-semibold mt-1">Plus Size</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Tamanhos GG / XGG / EGG</p>
              </button>
            </div>
          </div>

          {/* Model Bank Selector — Unificado (customizadas + stock) */}
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-semibold">Escolha a modelo</label>
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
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: modelFilter === f ? "var(--brand-100)" : "transparent",
                      color: modelFilter === f ? "var(--brand-700)" : "var(--muted)",
                    }}
                  >
                    {f === "all" ? "Todas" : f === "normal" ? "Normal" : "Plus"}
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
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                          style={{ background: "#DC2626", color: "white", opacity: deletingModelId === model.id ? 0.6 : 1 }}
                        >
                          {deletingModelId === model.id ? "..." : "Sim"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold"
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
              {modelBank
                .filter(m => modelFilter === "all" || m.body_type === modelFilter)
                .map((model) => (
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
              ))}
            </div>

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
            <label className="block text-sm font-semibold mb-3">Cenário</label>
            <div className="grid grid-cols-4 gap-2">
              {backgrounds.map((bg) => (
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
                  {bg.thumb ? (
                    <img src={bg.thumb} alt={bg.label} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center" style={{ background: "var(--surface)" }}>
                      <span className="text-lg">✏️</span>
                    </div>
                  )}
                  <div className="py-1.5 px-1" style={{ background: "var(--surface)" }}>
                    <p className="text-xs font-medium">{bg.label}</p>
                  </div>
                </button>
              ))}
            </div>
            {background === "personalizado" && (
              <input
                type="text"
                value={customBg}
                onChange={(e) => setCustomBg(e.target.value)}
                placeholder="Ex: parede rosa da loja, praia ao pôr do sol..."
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
              Opções avançadas
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
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
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
            onClick={handleGenerate}
            disabled={!preview || selectedTypes.length === 0}
            className="btn-primary w-full !py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              boxShadow: preview && selectedTypes.length > 0 ? "0 8px 30px rgba(236,72,153,0.3)" : "none",
            }}
          >
            <IconZap />
            Gerar Campanha
          </button>

          {(!preview || selectedTypes.length === 0) && (
            <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
              {!preview ? "Faça upload da foto para continuar" : "Selecione o tipo de produto"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
