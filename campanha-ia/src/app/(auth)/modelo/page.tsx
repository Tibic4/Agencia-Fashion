"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ModelPlaceholder from "@/components/ModelPlaceholder";

/* ═══════════════════════════════════════
   Plan model limits (source: db/index.ts)
   Grátis: 0 | Essencial: 3 | Pro: 10 | Business: 25
   ═══════════════════════════════════════ */
const planModelLimits: Record<string, number> = {
  free: 0,
  gratis: 0,
  essencial: 3,
  pro: 10,
  business: 25,
};

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

const hairLengths = [
  { value: "joaozinho", label: "Joãozinho", emoji: "✂️" },
  { value: "chanel", label: "Chanel / Bob", emoji: "💈" },
  { value: "ombro", label: "Ombro", emoji: "👤" },
  { value: "medio", label: "Médio", emoji: "🙎‍♀️" },
  { value: "longo", label: "Longo", emoji: "💁‍♀️" },
];

const hairColors = [
  { value: "preto", label: "Preto", emoji: "⬛" },
  { value: "castanho_escuro", label: "Cast. escuro", emoji: "🟫" },
  { value: "castanho", label: "Castanho", emoji: "🤎" },
  { value: "ruivo", label: "Ruivo", emoji: "🔶" },
  { value: "loiro_escuro", label: "Mel", emoji: "🍯" },
  { value: "loiro", label: "Loiro", emoji: "💛" },
  { value: "platinado", label: "Platinado", emoji: "🤍" },
];

const bodyTypes = [
  { value: "magra", label: "Slim" },
  { value: "media", label: "Padrão" },
  { value: "plus_size", label: "Curvilínea" },
];

const styles = [
  { value: "casual_natural", label: "Casual", emoji: "👟" },
  { value: "elegante", label: "Elegante", emoji: "👠" },
  { value: "esportivo", label: "Esportivo", emoji: "🏃‍♀️" },
  { value: "urbano", label: "Urbano", emoji: "🏙️" },
];

const ages = [
  { value: "jovem_18_25", label: "18-25 anos" },
  { value: "adulta_26_35", label: "26-35 anos" },
  { value: "madura_36_50", label: "36-50 anos" },
];

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
  is_active: boolean;
  created_at: string;
  photo_url?: string | null;
  face_ref_url?: string | null;
}

export default function ModeloVirtual() {
  // ── Existing models list ──
  const [models, setModels] = useState<StoreModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [userPlan, setUserPlan] = useState("free");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Create form state ──
  const [skin, setSkin] = useState("morena_clara");
  const [hairTexture, setHairTexture] = useState("ondulado");
  const [hairLength, setHairLength] = useState("ombro");
  const [hairColor, setHairColor] = useState("castanho");
  const [body, setBody] = useState("media");
  const [style, setStyle] = useState("casual_natural");
  const [age, setAge] = useState("adulta_26_35");
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quotaError, setQuotaError] = useState<{ current: number; limit: number; plan: string } | null>(null);

  const maxModels = planModelLimits[userPlan] ?? 0;
  const canCreate = models.length < maxModels;

  // ── Load existing models ──
  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch("/api/model/list");
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
          setUserPlan(data.plan || "free");
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
            return { ...m, photo_url: status.url };
          }
          return m;
        }));
      } catch {
        // Silencioso
      }
    }, 5000);

    const timeout = setTimeout(() => clearInterval(interval), 3 * 60 * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [models.filter(m => !m.photo_url).map(m => m.id).join(",")]);

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
      formData.append("style", style);
      formData.append("ageRange", age);
      formData.append("name", name || "Modelo");

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
        style: style,
        age_range: age,
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
      await fetch(`/api/model/${modelId}`, { method: "DELETE" });
      setModels((prev) => prev.filter((m) => m.id !== modelId));
    } catch {
      // Silent fail
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetActive(modelId: string) {
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        is_active: m.id === modelId,
      }))
    );
    try {
      await fetch(`/api/model/${modelId}/activate`, { method: "POST" });
    } catch {
      // Silent fail
    }
  }

  // handleRegeneratePreview moved to autoGeneratePreview above

  function resetForm() {
    setName("");
    setSkin("morena_clara");
    setHairTexture("ondulado");
    setHairLength("ombro");
    setHairColor("castanho");
    setBody("media");
    setStyle("casual_natural");
    setAge("adulta_26_35");
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
            {models.length}/{maxModels} criadas · Plano{" "}
            <span className="font-semibold capitalize">{userPlan}</span>
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-8xl mb-6">👩</div>
          <h2 className="text-xl font-bold mb-2">
            Crie sua modelo exclusiva
          </h2>
          <p className="text-sm mb-6 max-w-md" style={{ color: "var(--muted)" }}>
            {maxModels === 0
              ? "Assine um plano pago e crie uma modelo com o rosto e corpo da sua cliente ideal. Suas roupas serão vestidas nela automaticamente!"
              : "Monte a modelo ideal para sua loja — escolha tom de pele, cabelo, biotipo e estilo. As roupas serão vestidas nela em todas as campanhas."
            }
          </p>
          {maxModels === 0 ? (
            <Link href="/plano" className="btn-primary">
              ⭐ Ver planos
            </Link>
          ) : (
            <button
              className="btn-primary"
              onClick={() => setShowCreateForm(true)}
            >
              ✨ Criar minha primeira modelo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => (
            <div
              key={model.id}
              className="rounded-2xl overflow-hidden transition-all group"
              style={{
                border: model.is_active
                  ? "2px solid var(--brand-500)"
                  : "1px solid var(--border)",
                background: "var(--background)",
                boxShadow: model.is_active ? "0 4px 20px rgba(236,72,153,0.15)" : "none",
              }}
            >
              {/* Model visual */}
              <div
                className="aspect-[3/4] flex items-center justify-center relative overflow-hidden"
                style={{ background: "var(--gradient-brand-soft)" }}
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
                    isGenerating={new Date(model.created_at).getTime() > Date.now() - 5 * 60 * 1000}
                    showRetry={new Date(model.created_at).getTime() <= Date.now() - 5 * 60 * 1000}
                    onRetry={() => handleRetryPreview(model.id)}
                  />
                )}
                {model.is_active && (
                  <div
                    className="absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "var(--gradient-brand)", color: "white" }}
                  >
                    ✅ Ativa
                  </div>
                )}
              </div>

              {/* Model info */}
              <div className="p-4">
                <h3 className="font-semibold mb-1">{model.name}</h3>
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="badge badge-brand text-xs">
                    {skinTones.find((s) => s.value === model.skin_tone)?.label || model.skin_tone}
                  </span>
                  <span className="badge badge-brand text-xs">
                    {hairTextures.find((h) => h.value === (model.hair_texture || model.hair_style))?.label || model.hair_style}
                  </span>
                  <span className="badge badge-brand text-xs">
                    {bodyTypes.find((b) => b.value === model.body_type)?.label || model.body_type}
                  </span>
                  <span className="badge badge-brand text-xs">
                    {styles.find((s) => s.value === model.style)?.label || model.style}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!model.is_active && (
                    <button
                      onClick={() => handleSetActive(model.id)}
                      className="flex-1 text-xs font-medium py-2.5 rounded-lg transition-all min-h-[44px]"
                      style={{
                        background: "var(--brand-100)",
                        color: "var(--brand-700)",
                        border: "1px solid var(--brand-200)",
                      }}
                    >
                      Usar esta
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(model.id)}
                    disabled={deletingId === model.id}
                    className="text-xs font-medium py-2.5 px-4 rounded-lg transition-all min-h-[44px]"
                    style={{
                      background: "var(--surface)",
                      color: "var(--error)",
                      border: "1px solid var(--border)",
                      opacity: deletingId === model.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === model.id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add more card (if within limits) */}
          {canCreate && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-2xl flex flex-col items-center justify-center aspect-[4/3] transition-all hover:scale-[1.02]"
              style={{
                border: "2px dashed var(--border)",
                background: "var(--surface)",
                color: "var(--muted)",
              }}
            >
              <div className="text-4xl mb-2">+</div>
              <span className="text-sm font-medium">Nova modelo</span>
              <span className="text-xs mt-1">
                {models.length}/{maxModels}
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
          Nova Modelo <span className="gradient-text">Virtual</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Personalize tom de pele, cabelo e estilo — a IA fará o resto.
          {models.length > 0 && ` (${models.length}/${maxModels} usadas)`}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left — Configuration */}
        <div className="space-y-6">
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
                  className="p-3 rounded-xl text-sm font-medium text-center transition-all"
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

          {/* Style */}
          <div>
            <label className="block text-sm font-semibold mb-3">Estilo</label>
            <div className="grid grid-cols-2 gap-2">
              {styles.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: style === s.value ? "var(--gradient-card)" : "var(--surface)",
                    border: style === s.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                    color: style === s.value ? "var(--brand-600)" : "var(--muted)",
                  }}
                >
                  <span className="text-lg">{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-semibold mb-3">Faixa etária</label>
            <div className="grid grid-cols-3 gap-2">
              {ages.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAge(a.value)}
                  className="p-3 rounded-xl text-xs sm:text-sm font-medium text-center transition-all min-h-[44px]"
                  style={{
                    background: age === a.value ? "var(--brand-100)" : "var(--surface)",
                    color: age === a.value ? "var(--brand-700)" : "var(--muted)",
                    border: age === a.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold mb-2">Nome da modelo (opcional)</label>
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
            <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <span className="text-lg">⚠️</span>
              <p className="text-sm font-medium" style={{ color: "#991B1B" }}>
                {error}
              </p>
            </div>
          )}

          {/* Generate */}
          <button
            className="btn-primary w-full !py-3.5"
            onClick={handleCreate}
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
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
            Usa 1 crédito de modelo do seu plano · Pronta em ~30 segundos
          </p>
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
                  <span className="badge badge-brand text-xs">{styles.find(s => s.value === style)?.label}</span>
                  <span className="badge badge-brand text-xs">{ages.find(a => a.value === age)?.label}</span>
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
    <div className="animate-fade-in-up pb-24 md:pb-0">
      {showCreateForm ? renderCreateForm() : renderModelsList()}
    </div>
  );
}
