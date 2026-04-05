"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const IconUpload = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
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
  { value: "branco", label: "Branco", color: "#ffffff", border: true },
  { value: "estudio", label: "Estúdio", gradient: "linear-gradient(135deg, #F5E6E0, #E8E8E8)" },
  { value: "lifestyle", label: "Lifestyle IA", gradient: "linear-gradient(135deg, #E0EAF0, #E0F0E8)", ai: true },
];

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
  const [useModel, setUseModel] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generationSteps = [
    { label: "Analisando produto...", progress: 15 },
    { label: "Criando estratégia...", progress: 30 },
    { label: "Escrevendo textos...", progress: 50 },
    { label: "Refinando copy...", progress: 65 },
    { label: "Processando imagem...", progress: 80 },
    { label: "Montando criativo...", progress: 92 },
    { label: "Pronto!", progress: 100 },
  ];


  const handleFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!preview || !price || !selectedFile) return;
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
    }, 2000);

    try {
      // Build FormData
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("price", price);
      formData.append("objective", objective);
      formData.append("storeName", "Minha Loja");
      if (audience) formData.append("targetAudience", audience);
      if (tone) formData.append("toneOverride", tone);
      formData.append("useModel", String(useModel));
      formData.append("backgroundType", background);

      // Call API
      const response = await fetch("/api/campaign/generate", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
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
          useModel: String(useModel),
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
    const step = generationSteps[generationStep];
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
        <div className="w-full max-w-md text-center">
          {/* Animated icon */}
          <div className="w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center animate-pulse-glow" style={{ background: "var(--gradient-brand)", color: "white" }}>
            <IconZap />
          </div>

          <h2 className="text-2xl font-bold mb-2">Gerando sua campanha</h2>
          <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>{step.label}</p>

          {/* Progress bar */}
          <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${step.progress}%`, background: "var(--gradient-brand)" }}
            />
          </div>

          {/* Steps list */}
          <div className="space-y-2 mt-8">
            {generationSteps.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm transition-all"
                style={{
                  opacity: i <= generationStep ? 1 : 0.3,
                  color: i < generationStep ? "var(--success)" :
                         i === generationStep ? "var(--brand-500)" : "var(--muted)",
                }}
              >
                <span>{i < generationStep ? "✓" : i === generationStep ? "●" : "○"}</span>
                <span className={i === generationStep ? "font-semibold" : ""}>{s.label}</span>
              </div>
            ))}
          </div>

          {generationStep >= generationSteps.length - 1 && (
            <Link
              href="/gerar/demo"
              className="btn-primary mt-8 inline-flex"
            >
              Ver resultado →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
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
        {/* Left — Upload */}
        <div className="space-y-6">
          {/* Upload Area */}
          <div
            className="relative rounded-2xl overflow-hidden transition-all cursor-pointer group"
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
              <div className="relative aspect-square">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                  style={{ background: "var(--surface)" }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">Trocar foto</span>
                </div>
              </div>
            ) : (
              <div className="aspect-square flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
                  <IconUpload />
                </div>
                <div className="text-center">
                  <p className="font-semibold mb-1">Arraste a foto da peça aqui</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    ou clique para selecionar · JPG, PNG até 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-semibold mb-2">Preço de venda *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--muted)" }}>
                R$
              </span>
              <input
                type="text"
                value={price}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.,]/g, "");
                  setPrice(val);
                }}
                placeholder="89,90"
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

          {/* Model toggle */}
          <div className="card-brand flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Usar modelo virtual</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Roupa vestida em modelo IA</p>
            </div>
            <button
              onClick={() => setUseModel(!useModel)}
              className="w-12 h-7 rounded-full relative transition-all"
              style={{
                background: useModel ? "var(--gradient-brand)" : "var(--border)",
              }}
            >
              <div
                className="w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow"
                style={{ left: useModel ? "26px" : "4px" }}
              />
            </button>
          </div>

          {/* Background */}
          <div>
            <label className="block text-sm font-semibold mb-3">Fundo do criativo</label>
            <div className="flex gap-3">
              {backgrounds.map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => setBackground(bg.value)}
                  className="flex-1 p-3 rounded-xl text-center transition-all"
                  style={{
                    border: background === bg.value
                      ? "2px solid var(--brand-500)"
                      : "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg mx-auto mb-2"
                    style={{
                      background: bg.gradient || bg.color,
                      border: bg.border ? "1px solid var(--border)" : "none",
                    }}
                  />
                  <p className="text-xs font-medium">{bg.label}</p>
                  {bg.ai && <span className="text-[10px] gradient-text font-semibold">✨ IA</span>}
                </button>
              ))}
            </div>
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
                  <label className="block text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>Público-alvo</label>
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
                  <label className="block text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>Tom de voz</label>
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
            disabled={!preview || !price}
            className="btn-primary w-full !py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              boxShadow: preview && price ? "0 8px 30px rgba(236,72,153,0.3)" : "none",
            }}
          >
            <IconZap />
            Gerar Campanha
          </button>

          {(!preview || !price) && (
            <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
              {!preview ? "Faça upload da foto para continuar" : "Informe o preço para continuar"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
