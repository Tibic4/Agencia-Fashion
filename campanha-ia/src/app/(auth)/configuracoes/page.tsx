"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const BrandColorPicker = dynamic(() => import("@/components/BrandColorPicker"), { ssr: false });

export default function Configuracoes() {
  const [storeName, setStoreName] = useState("");
  const [city, setCity] = useState("");
  const [stateUF, setStateUF] = useState("");
  const [instagram, setInstagram] = useState("");
  const [segment, setSegment] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const segments = [
    { value: "feminina", label: "Moda Feminina", emoji: "👗" },
    { value: "masculina", label: "Moda Masculina", emoji: "👔" },
    { value: "infantil", label: "Infantil", emoji: "👶" },
    { value: "plus_size", label: "Plus Size", emoji: "💃" },
    { value: "fitness", label: "Fitness", emoji: "🏋️‍♀️" },
    { value: "intima", label: "Moda Íntima", emoji: "🩱" },
    { value: "praia", label: "Praia", emoji: "👙" },
    { value: "acessorios", label: "Acessórios", emoji: "👜" },
  ];

  // ── Load store data ──
  useEffect(() => {
    fetch("/api/store")
      .then(res => res.json())
      .then(data => {
        const store = data?.data;
        if (store) {
          setStoreName(store.name || "");
          setCity(store.city || "");
          setStateUF(store.state || "");
          setInstagram(store.instagram_handle || "");
          setSegment(store.segment_primary || "");
          setLogoUrl(store.logo_url || null);
          const bc = store.brand_colors as { primary?: string } | null;
          if (bc?.primary) setBrandColor(bc.primary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Upload logo ──
  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingLogo(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/store/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      setLogoUrl(data.url || data.logo_url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar logo";
      setError(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Save settings ──
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName,
          city,
          state: stateUF,
          instagram,
          segment,
          brand_colors: brandColor ? { primary: brandColor } : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in-up max-w-2xl flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--brand-200)", borderTopColor: "var(--brand-500)" }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up max-w-2xl">
      {/* Color Picker Modal */}
      {showColorPicker && (
        <BrandColorPicker
          currentColor={brandColor}
          onColorSelected={(hex) => { setBrandColor(hex); setShowColorPicker(false); }}
          onClose={() => setShowColorPicker(false)}
        />
      )}

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          <span className="gradient-text">Configurações</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Dados da sua loja usados pela IA para personalizar as campanhas
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 rounded-xl flex items-center gap-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <span>⚠️</span>
          <p className="text-sm font-medium flex-1" style={{ color: "#DC2626" }}>{error}</p>
          <button onClick={() => setError(null)} style={{ color: "#DC2626" }}>✕</button>
        </div>
      )}

      <div className="space-y-8">
        {/* ── Logo + Cor da marca ── */}
        <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-5">Identidade da marca</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer transition hover:opacity-80 relative group"
                style={{ background: "var(--surface)", border: "2px dashed var(--border)" }}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--brand-200)", borderTopColor: "var(--brand-500)" }} />
                ) : logoUrl ? (
                  <>
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">Trocar</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <span className="text-3xl">📷</span>
                    <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>Sua logo</p>
                  </div>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                className="text-xs font-semibold px-4 py-2 rounded-lg min-h-[44px] transition"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                {logoUrl ? "Trocar logo" : "Enviar logo"}
              </button>
            </div>

            {/* Brand Color */}
            <div className="flex-1 space-y-3">
              <label className="text-sm font-semibold block">🎨 Cor da marca</label>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Usada como fundo "Minha Marca" nas campanhas. Extraia da sua logo!
              </p>

              <div className="flex items-center gap-3">
                {brandColor ? (
                  <div
                    className="w-14 h-14 rounded-xl cursor-pointer transition hover:scale-105"
                    style={{ background: brandColor, border: "2px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    onClick={() => setShowColorPicker(true)}
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center cursor-pointer transition hover:scale-105"
                    style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)", border: "2px dashed var(--border)" }}
                    onClick={() => setShowColorPicker(true)}
                  >
                    <span className="text-white text-lg drop-shadow-md">?</span>
                  </div>
                )}
                <div className="flex-1">
                  {brandColor && (
                    <p className="text-sm font-mono font-bold">{brandColor}</p>
                  )}
                  <button
                    onClick={() => setShowColorPicker(true)}
                    className="text-xs font-semibold mt-1 transition"
                    style={{ color: "var(--brand-500)" }}
                  >
                    {brandColor ? "Trocar cor →" : "Escolher cor da marca →"}
                  </button>
                </div>
              </div>

              {/* Preview */}
              {brandColor && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <div className="h-16 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${brandColor}33, ${brandColor}, ${brandColor}CC)` }}>
                    <span className="text-white text-sm font-bold drop-shadow-md">Preview do fundo "Minha Marca"</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Store info ── */}
        <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-5">Dados da loja</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome da loja *</label>
              <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Cidade</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Estado</label>
                <input type="text" value={stateUF} onChange={(e) => setStateUF(e.target.value)} maxLength={2}
                  className="w-full h-11 px-4 rounded-xl text-sm outline-none uppercase"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Instagram</label>
              <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)}
                placeholder="@sualoja"
                className="w-full h-11 px-4 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
          </div>
        </div>

        {/* ── Segment ── */}
        <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-5">Segmento</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {segments.map((seg) => (
              <button key={seg.value}
                onClick={() => setSegment(seg.value)}
                className="p-3 rounded-xl text-sm font-medium text-center transition-all min-h-[44px] flex items-center justify-center gap-2"
                style={{
                  background: segment === seg.value ? "var(--gradient-brand)" : "var(--surface)",
                  color: segment === seg.value ? "white" : "var(--muted)",
                  border: segment === seg.value ? "none" : "1px solid var(--border)",
                }}>
                <span>{seg.emoji}</span> {seg.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Save ── */}
        <button onClick={handleSave}
          disabled={saving || !storeName}
          className="btn-primary !py-3.5 w-full disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: saved ? "var(--success)" : undefined }}>
          {saving ? "Salvando..." : saved ? "✅ Salvo!" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
