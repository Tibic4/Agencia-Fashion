"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ModelPlaceholder from "@/components/ModelPlaceholder";
import { haptics } from "@/lib/utils/haptics";



const skinTones = [
  { value: "branca", label: "Clara", color: "#F5D0B5" },
  { value: "morena_clara", label: "Morena clara", color: "#D4A574" },
  { value: "morena", label: "Morena", color: "#A67B5B" },
  { value: "negra", label: "Negra", color: "#6B4226" },
];

const hairTextures = [
  { value: "liso", label: "Liso", emoji: "💇‍♀️" },
  { value: "ondulado", label: "Ondulado", emoji: "〰️" },
  { value: "cacheado", label: "Cacheado", emoji: "🌀" },
  { value: "crespo", label: "Crespo", emoji: "✨" },
];

const hairLengthsFem = [
  { value: "curto", label: "Curto", emoji: "✂️" },
  { value: "medio", label: "Médio", emoji: "🙎‍♀️" },
  { value: "longo", label: "Longo", emoji: "💁‍♀️" },
];

const hairLengthsMasc = [
  { value: "raspado", label: "Raspado", emoji: "🧑‍🦲" },
  { value: "curto", label: "Curto", emoji: "✂️" },
  { value: "medio", label: "Médio", emoji: "👤" },
];

const hairColors = [
  { value: "preto", label: "Preto", emoji: "⬛" },
  { value: "castanho", label: "Castanho", emoji: "🤎" },
  { value: "ruivo", label: "Ruivo", emoji: "🔶" },
  { value: "loiro", label: "Loiro", emoji: "💛" },
  { value: "platinado", label: "Platinado", emoji: "🤍" },
];

const bodyTypesFem = [
  { value: "magra", label: "Slim" },
  { value: "media", label: "Padrão" },
  { value: "plus_size", label: "Curvilinea" },
];

const bodyTypesMasc = [
  { value: "atletico", label: "Atlético" },
  { value: "medio", label: "Padrão" },
  { value: "robusto", label: "Robusto" },
];

// Style e Age removidos do formulário — defaults hardcoded para reduzir desvaneios da IA
// Dados legados permanecem no banco para backward compat

/* ═══════════════════════════════════════
   Model type
   ═══════════════════════════════════════ */
interface StoreModel {
  id: string;
  name: string;
  skin_tone: string;
  hair_style: string;
  hair_texture?: string;
  hair_length?: string;
  hair_color?: string;
  body_type: string;
  style: string;
  age_range: string;
  gender?: string;
  is_active: boolean;
  created_at: string;
  photo_url?: string | null;
  face_ref_url?: string | null;
  preview_failed?: boolean;
}

// Helper: traduz nome do plano para exibição
const planDisplayName: Record<string, string> = {
  gratis: "Gratuito",
  free: "Gratuito",
  essencial: "Essencial",
  pro: "Pro",
  business: "Business",
};

export default function ModeloVirtual() {
  // ── Existing models list ──
  const [models, setModels] = useState<StoreModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [userPlan, setUserPlan] = useState("free");
  const [modelLimit, setModelLimit] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Create form state ──
  const [gender, setGender] = useState<"feminino" | "masculino">("feminino");
  const [skin, setSkin] = useState("morena_clara");
  const [hairTexture, setHairTexture] = useState("ondulado");
  const [hairLength, setHairLength] = useState("medio");
  const [hairColor, setHairColor] = useState("castanho");
  const [body, setBody] = useState("media");
  const [name, setName] = useState("");

  // Dynamic arrays based on gender
  const hairLengths = gender === "masculino" ? hairLengthsMasc : hairLengthsFem;
  const bodyTypes = gender === "masculino" ? bodyTypesMasc : bodyTypesFem;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotaError, setQuotaError] = useState<{ current: number; limit: number; plan: string } | null>(null);

  const maxModels = modelLimit;
  const canCreate = !loadingModels && models.length < maxModels;

  // ── Load existing models ──
  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch("/api/model/list");
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
          setUserPlan(data.plan || "free");
          setModelLimit(data.limit ?? 0);
        }
      } catch {
        // If API doesn't exist yet, use empty list
      } finally {
        setLoadingModels(false);
      }
    }
    loadModels();
  }, []);

  // ── Polling inteligente para previews pendentes ──
  useEffect(() => {
    const pendingIds = models
      .filter(m => !m.photo_url)
      .map(m => m.id);
    if (pendingIds.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/model/preview-status?ids=${pendingIds.join(",")}`);
        if (!res.ok) return;
        const { statuses } = await res.json();

        setModels(prev => prev.map(m => {
          const status = statuses?.[m.id];
          if (status?.url && !m.photo_url) {
            return { ...m, photo_url: status.url, preview_failed: false };
          }
          if (status?.status === "failed" && !m.preview_failed) {
            return { ...m, preview_failed: true };
          }
          return m;
        }));
      } catch {
        // Silencioso
      }
    }, 5000);

    const timeout = setTimeout(() => clearInterval(interval), 3 * 60 * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [models]);

  // ── Retry manual de preview ──
  const handleRetryPreview = useCallback(async (modelId: string) => {
    try {
      await fetch("/api/model/regenerate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
    } catch {
      // Silencioso
    }
  }, []);

  async function handleCreate() {
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("skinTone", skin);
      formData.append("hairTexture", hairTexture);
      formData.append("hairLength", hairLength);
      formData.append("hairColor", hairColor);
      formData.append("hairStyle", hairTexture); // backward compat
      formData.append("bodyType", body);
      formData.append("style", "casual_natural"); // default fixo — campo removido do UI
      formData.append("ageRange", gender === "masculino" ? "adulto_26_35" : "adulta_26_35"); // default fixo
      formData.append("name", name || "Modelo");
      formData.append("gender", gender);

      const res = await fetch("/api/model/create", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") {
          setQuotaError({ current: json.current, limit: json.limit, plan: json.plan });
          setLoading(false);
          return;
        }
        throw new Error(json.error || "Erro ao criar modelo");
      }
      setQuotaError(null);

      // Add new model to list
      const newModel: StoreModel = {
        id: json.data?.id || json.id || crypto.randomUUID(),
        name: name || "Modelo",
        skin_tone: skin,
        hair_style: hairTexture,
        hair_texture: hairTexture,
        hair_length: hairLength,
        hair_color: hairColor,
        body_type: body,
        style: "casual_natural",
        age_range: gender === "masculino" ? "adulto_26_35" : "adulta_26_35",
        gender,
        is_active: true,
        created_at: new Date().toISOString(),
        photo_url: json.data?.previewUrl || null,
      };
      setModels((prev) => [...prev, newModel]);
      setShowCreateForm(false);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(modelId: string) {
    setDeletingId(modelId);
    try {
      const res = await fetch(`/api/model/${modelId}`, { method: "DELETE" });
      if (res.ok) {
        setModels((prev) => prev.filter((m) => m.id !== modelId));
      }
    } catch {
      // Silent fail
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleSetActive(modelId: string) {
    const prevModels = [...models];
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        is_active: m.id === modelId,
      }))
    );
    try {
      const res = await fetch(`/api/model/${modelId}/activate`, { method: "POST" });
      if (!res.ok) {
        // Rollback em caso de falha
        setModels(prevModels);
      }
    } catch {
      // Rollback
      setModels(prevModels);
    }
  }

  // handleRegeneratePreview moved to autoGeneratePreview above

  function resetForm() {
    setGender("feminino");
    setName("");
    setSkin("morena_clara");
    setHairTexture("ondulado");
    setHairLength("medio");
    setHairColor("castanho");
    setBody("media");
    setError("");
    setQuotaError(null);
  }



  // ── Models list view ──
  const renderModelsList = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Modelos <span className="gradient-text">Virtuais</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {loadingModels ? "Carregando..." : `${models.length}/${maxModels} criadas`} · Plano{" "}
            <span className="font-semibold">{planDisplayName[userPlan] || userPlan}</span>
          </p>
        </div>
        {canCreate ? (
          <button
            className="btn-primary !py-2.5 text-sm min-h-[44px]"
            onClick={() => setShowCreateForm(true)}
          >
            + Nova modelo
          </button>
        ) : (
          <Link
            href="/plano"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--gradient-brand)",
              color: "white",
            }}
          >
            {maxModels === 0 ? "⭐ Assine um plano para começar" : "⬆️ Liberar mais modelos"}
          </Link>
        )}
      </div>

      {/* Models grid */}
      {loadingModels ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl h-64 animate-pulse"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            />
          ))}
        </div>
      ) : models.length === 0 ? (
        /* Empty state */
        <div 
          className="flex flex-col items-center justify-center p-8 text-center rounded-2xl mx-auto max-w-lg mt-8 transition-all hover:scale-[1.02] active:scale-[0.98] group"
          style={{ 
            border: "2px dashed var(--border)", 
            background: "var(--surface)", 
            boxShadow: "0 8px 32px rgba(0,0,0,0.05)" 
          }}
        >
          <div className="w-20 h-20 rounded-full mb-6 flex items-center justify-center bg-brand-50 mx-auto" style={{ border: "2px solid var(--border)" }}>
            <span className="text-4xl group-hover:scale-110 transition-transform">✨</span>
          </div>
          <h2 className="text-xl font-bold mb-2 text-foreground">
            Sua vitrine virtual está vazia
          </h2>
          <p className="text-sm mb-8 leading-relaxed max-w-md mx-auto" style={{ color: "var(--muted)" }}>
            {maxModels === 0
              ? "Assine um plano e adicione modelos reais ou IA com as proporções exatas do seu público. Vista roupas de forma automática!"
              : "Crie a modelo ideal para sua loja escolhendo biotipo, etnia e cabelo. Ela usará suas roupas com perfeição em todas as campanhas."
            }
          </p>
          {maxModels === 0 ? (
            <Link href="/plano" className="btn-primary w-full sm:w-auto shadow-lg hover:shadow-xl transition-all">
              ⭐ Ver planos e iniciar
            </Link>
          ) : (
            <button
              className="btn-primary w-full sm:w-auto shadow-lg hover:shadow-xl transition-all"
              onClick={() => setShowCreateForm(true)}
            >
              + Criar modelo exclusiva
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {models.map((model) => {
            // Helpers to dynamically resolve strings based on what exists in the arrays
            const labelSkin = skinTones.find((s) => s.value === model.skin_tone)?.label || model.skin_tone;
            const labelHair = hairTextures.find((h) => h.value === (model.hair_texture || model.hair_style))?.label || model.hair_style;
            const labelBodyFem = bodyTypesFem.find((b) => b.value === model.body_type)?.label;
            const labelBodyMasc = bodyTypesMasc.find((b) => b.value === model.body_type)?.label;
            const labelBody = labelBodyFem || labelBodyMasc || model.body_type;

            return (
              <div
                key={model.id}
                className="relative rounded-2xl overflow-hidden transition-all group flex flex-col hover:scale-[1.02] active:scale-[0.98] cursor-default"
                style={{
                  border: model.is_active ? "2px solid var(--brand-500)" : "1px solid var(--border)",
                  background: "var(--surface)",
                  boxShadow: model.is_active ? "0 4px 20px rgba(236,72,153,0.15)" : "0 2px 10px rgba(0,0,0,0.05)",
                  aspectRatio: "3/4",
                }}
              >
                {/* Background Image Area */}
                <div className="absolute inset-0 z-0">
                  {model.photo_url ? (
                    <img
                      src={model.photo_url}
                      alt={model.name}
                      className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                  ) : (
                    <ModelPlaceholder
                      skinTone={model.skin_tone}
                      bodyType={model.body_type}
                      name={model.name}
                      isGenerating={!model.preview_failed && new Date(model.created_at).getTime() > Date.now() - 5 * 60 * 1000}
                      showRetry={model.preview_failed || new Date(model.created_at).getTime() <= Date.now() - 5 * 60 * 1000}
                      onRetry={() => handleRetryPreview(model.id)}
                    />
                  )}
                </div>

                {/* Ativa Badge */}
                {model.is_active && (
                  <div className="absolute top-2 right-2 z-10">
                    <div 
                      className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md transition-transform active:scale-95"
                      style={{ background: "rgba(236,72,153,0.85)", color: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      ATIVA
                    </div>
                  </div>
                )}

                {/* Bottom Overlay Gradient & Content */}
                <div 
                  className="absolute inset-x-0 bottom-0 z-10 p-3 pt-16 flex flex-col justify-end pointer-events-none"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)" }}
                >
                  <h3 className="font-bold text-white truncate text-sm leading-tight mb-0.5" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                    {model.name}
                  </h3>
                  <p className="text-[10px] text-white/85 line-clamp-1 mb-2.5 font-medium tracking-wide">
                    {labelSkin} • {labelHair} • {labelBody}
                  </p>

                  {/* Actions row */}
                  <div className="flex gap-1.5 mt-auto pointer-events-auto">
                    {!model.is_active && (
                      <button
                        onClick={(e) => { e.stopPropagation(); haptics.medium(); handleSetActive(model.id); }}
                        className="flex-1 text-[11px] font-bold py-2 px-2 rounded-lg transition-all active:scale-95 backdrop-blur-md"
                        style={{
                          background: "var(--brand-500)",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.15)",
                          boxShadow: "0 2px 8px rgba(236,72,153,0.3)"
                        }}
                      >
                        Usar
                      </button>
                    )}
                    {confirmDeleteId === model.id ? (
                      <div className="flex gap-1.5 flex-1 animate-fade-in">
                        <button
                          onClick={(e) => { e.stopPropagation(); haptics.error(); handleDelete(model.id); }}
                          disabled={deletingId === model.id}
                          className="flex-1 text-[11px] font-bold py-2 rounded-lg transition-all active:scale-95 flex justify-center items-center shadow-lg"
                          style={{ background: "#EF4444", color: "white", opacity: deletingId === model.id ? 0.5 : 1 }}
                        >
                          {deletingId === model.id ? "..." : "Sim"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); haptics.light(); setConfirmDeleteId(null); }}
                          className="flex-1 text-[11px] font-bold py-2 rounded-lg transition-all active:scale-95 flex justify-center items-center backdrop-blur-md"
                          style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); haptics.medium(); setConfirmDeleteId(model.id); }}
                        className="text-[11px] font-bold py-2 px-2.5 rounded-lg transition-all active:scale-95 backdrop-blur-sm"
                        style={{
                          background: "rgba(0,0,0,0.4)",
                          color: "#FCA5A5",
                          border: "1px solid rgba(255,255,255,0.1)"
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add more card (if within limits) */}
          {canCreate && (
            <button
              onClick={() => { haptics.medium(); setShowCreateForm(true); }}
              className="rounded-2xl flex flex-col items-center justify-center transition-all hover:scale-[1.02] active:scale-[0.98] group"
              style={{
                border: "2px dashed var(--border)",
                background: "var(--surface)",
                color: "var(--muted)",
                aspectRatio: "3/4"
              }}
            >
              <div className="w-12 h-12 rounded-full mb-3 flex items-center justify-center group-hover:bg-brand-50 transition-colors" style={{ border: "2px solid var(--border)" }}>
                <span className="text-xl font-bold group-hover:text-brand-500 transition-colors">+</span>
              </div>
              <span className="text-xs font-semibold group-hover:text-brand-500 transition-colors">Nova modelo</span>
              <span className="text-[10px] mt-1 opacity-70">
                {models.length}/{maxModels} slots
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  // ── Create form view ──
  const renderCreateForm = () => (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <button
          onClick={() => { setShowCreateForm(false); resetForm(); }}
          className="flex items-center gap-1 text-sm font-medium mb-4 transition hover:opacity-70 cursor-pointer min-h-[44px]"
          style={{ color: "var(--muted)" }}
        >
          ← Voltar para modelos
        </button>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {gender === "masculino" ? "Novo Modelo" : "Nova Modelo"} <span className="gradient-text">Virtual</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Personalize tom de pele, cabelo e estilo — a IA fará o resto.
          {models.length > 0 && ` (${models.length}/${maxModels} usadas)`}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left — Configuration */}
        <div className="space-y-6">
          {/* Gender toggle */}
          <div>
            <label className="block text-sm font-semibold mb-3">Gênero</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setGender("feminino");
                  setBody("media");
                  setHairLength("medio");
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold transition-all min-h-[48px]"
                style={{
                  background: gender === "feminino" ? "var(--gradient-brand)" : "var(--surface)",
                  color: gender === "feminino" ? "white" : "var(--muted)",
                  border: gender === "feminino" ? "none" : "1px solid var(--border)",
                }}
              >
                <span className="text-lg">♀️</span> Feminino
              </button>
              <button
                onClick={() => {
                  setGender("masculino");
                  setBody("medio");
                  setHairLength("curto");
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold transition-all min-h-[48px]"
                style={{
                  background: gender === "masculino" ? "var(--gradient-brand)" : "var(--surface)",
                  color: gender === "masculino" ? "white" : "var(--muted)",
                  border: gender === "masculino" ? "none" : "1px solid var(--border)",
                }}
              >
                <span className="text-lg">♂️</span> Masculino
              </button>
            </div>
          </div>

          {/* Skin tone */}
          <div>
            <label className="block text-sm font-semibold mb-3">Tom de pele</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {skinTones.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSkin(s.value)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all min-h-[44px]"
                  style={{
                    border: skin === s.value ? "2px solid var(--brand-500)" : "1px solid var(--border)",
                    background: skin === s.value ? "var(--gradient-card)" : "var(--surface)",
                  }}
                >
                  <div className="w-10 h-10 rounded-full" style={{ background: s.color }} />
                  <span className="text-[11px] sm:text-xs font-medium leading-tight text-center">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hair — 3 campos granulares */}
          <div>
            <label className="block text-sm font-semibold mb-1">Cabelo</label>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Monte o visual combinando textura, comprimento e cor</p>

            {/* Textura */}
            <p className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Textura</p>
            <div className="flex flex-wrap gap-2">
              {hairTextures.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setHairTexture(h.value)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[44px]"
                  style={{
                    background: hairTexture === h.value ? "var(--brand-100)" : "var(--surface)",
                    color: hairTexture === h.value ? "var(--brand-700)" : "var(--muted)",
                    border: hairTexture === h.value ? "1.5px solid var(--brand-400)" : "1px solid var(--border)",
                  }}
                >
                  <span>{h.emoji}</span> {h.label}
                </button>
              ))}
            </div>

            {/* Comprimento */}
            <p className="text-xs font-medium mb-2 mt-3" style={{ color: "var(--muted)" }}>Comprimento</p>
            <div className="flex flex-wrap gap-2">
              {hairLengths.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setHairLength(h.value)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[44px]"
                  style={{
                    background: hairLength === h.value ? "var(--brand-100)" : "var(--surface)",
                    color: hairLength === h.value ? "var(--brand-700)" : "var(--muted)",
                    border: hairLength === h.value ? "1.5px solid var(--brand-400)" : "1px solid var(--border)",
                  }}
                >
                  <span>{h.emoji}</span> {h.label}
                </button>
              ))}
            </div>

            {/* Cor */}
            <p className="text-xs font-medium mb-2 mt-3" style={{ color: "var(--muted)" }}>Cor do cabelo</p>
            <div className="flex flex-wrap gap-2">
              {hairColors.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setHairColor(h.value)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap min-h-[44px]"
                  style={{
                    background: hairColor === h.value ? "var(--brand-100)" : "var(--surface)",
                    color: hairColor === h.value ? "var(--brand-700)" : "var(--muted)",
                    border: hairColor === h.value ? "1.5px solid var(--brand-400)" : "1px solid var(--border)",
                  }}
                >
                  <span>{h.emoji}</span> {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body type */}
          <div>
            <label className="block text-sm font-semibold mb-3">Tipo de corpo</label>
            <div className="grid grid-cols-3 gap-2">
              {bodyTypes.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBody(b.value)}
                  className="p-2 sm:p-3 rounded-xl text-xs sm:text-sm font-medium text-center transition-all truncate min-w-0"
                  style={{
                    background: body === b.value ? "var(--gradient-brand)" : "var(--surface)",
                    color: body === b.value ? "white" : "var(--muted)",
                    border: body === b.value ? "none" : "1px solid var(--border)",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style e Age removidos — defaults fixos enviados no submit */}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold mb-2">Nome {gender === "masculino" ? "do modelo" : "da modelo"} (opcional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Ana, Bia, Carla..."
              maxLength={20}
              className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-brand-300"
              style={{ background: "var(--background)", border: "1.5px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>


          {/* Quota exceeded */}
          {quotaError && (
            <div className="p-4 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06))", border: "1px solid rgba(139,92,246,0.2)" }}>
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">🎯</span>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    Limite de modelos atingido ({quotaError.current}/{quotaError.limit})
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    Compre créditos avulsos de modelos ou faça upgrade do plano.
                  </p>
                  <Link
                    href="/plano"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                    style={{ background: "var(--gradient-brand)", color: "white" }}
                  >
                    ⬆️ Ver planos e créditos
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !quotaError && (
            <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--error, #EF4444)" }}>
              <span className="text-lg">⚠️</span>
              <p className="text-sm font-medium" style={{ color: "var(--error, #EF4444)" }}>
                {error}
              </p>
            </div>
          )}

          {/* Generate (Sticky no Mobile) */}
          <div className="lg:static sticky bottom-20 md:bottom-0 p-4 lg:p-0 -mx-4 lg:mx-0 mt-6 lg:mt-0 z-20 lg:bg-transparent lg:backdrop-blur-none" style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(var(--background-rgb, 255, 255, 255), 0.8)", borderTop: "1px solid var(--border)", borderRadius: "24px 24px 0 0" }}>
            <button
              className="btn-primary w-full !py-3.5"
              onClick={handleCreate}
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Criando modelo...
                </span>
              ) : (
                "✨ Criar modelo virtual"
              )}
            </button>
            <p className="text-xs text-center mt-3" style={{ color: "var(--muted)" }}>
              Usa 1 crédito de modelo do seu plano · Pronta em ~30 seg
            </p>
          </div>
        </div>

        {/* Right — Preview */}
        <div className="hidden lg:block">
          <div className="rounded-2xl overflow-hidden sticky top-8" style={{ border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold">Preview</h3>
              <span className="badge badge-brand text-xs">IA</span>
            </div>
            <div className="aspect-[3/4] flex items-center justify-center" style={{ background: "var(--gradient-brand-soft)" }}>
              <div className="text-center p-8">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: skinTones.find(s => s.value === skin)?.color || '#D4A574', border: '3px solid var(--brand-300)' }}>
                  <span className="text-4xl">👩</span>
                </div>
                <p className="font-semibold text-lg">{name || "Sua modelo"}</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className="badge badge-brand text-xs">{skinTones.find(s => s.value === skin)?.label}</span>
                  <span className="badge badge-brand text-xs">{hairTextures.find(h => h.value === hairTexture)?.label}</span>
                  <span className="badge badge-brand text-xs">{hairLengths.find(h => h.value === hairLength)?.label}</span>
                  <span className="badge badge-brand text-xs">{hairColors.find(h => h.value === hairColor)?.label}</span>
                  <span className="badge badge-brand text-xs">{bodyTypes.find(b => b.value === body)?.label}</span>

                </div>

                <p className="text-xs mt-6" style={{ color: "var(--muted)" }}>
                  O visual completo será gerado pela IA ao clicar em &quot;Criar&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in-up pb-32 md:pb-0">
      {showCreateForm ? renderCreateForm() : renderModelsList()}
    </div>
  );
}
