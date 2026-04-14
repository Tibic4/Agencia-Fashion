"use client";

import { useState, useEffect, useRef } from "react";
import { useClerk } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { haptics } from "@/lib/utils/haptics";
import { friendlyError } from "@/lib/friendly-error";

const BrandColorPicker = dynamic(() => import("@/components/BrandColorPicker"), { ssr: false });

export default function Configuracoes() {
  const { signOut } = useClerk();
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
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Backdrop state
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [backdropGenerating, setBackdropGenerating] = useState(false);
  const [backdropCanRegenerate, setBackdropCanRegenerate] = useState(true);
  const [backdropNextDate, setBackdropNextDate] = useState<string | null>(null);
  const backdropPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      .then(async (res) => {
        if (!res.ok) {
          setError("Não foi possível carregar os dados da loja.");
          return;
        }
        const data = await res.json();
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
          setStoreLoaded(true);
        }
      })
      .catch(() => {
        setError("Erro de conexão ao carregar configurações.");
      })
      .finally(() => setLoading(false));

    // Load backdrop status
    fetch("/api/store/backdrop")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data?.data) {
          setBackdropUrl(data.data.url || null);
          setBackdropCanRegenerate(data.data.canRegenerate ?? true);
          setBackdropNextDate(data.data.nextAvailableDate || null);
        }
      })
      .catch(() => {}); // non-critical

    return () => {
      if (backdropPollRef.current) clearInterval(backdropPollRef.current);
    };
  }, []);

  // ── Generate/regenerate backdrop ──
  const handleGenerateBackdrop = async () => {
    if (!brandColor || backdropGenerating) return;
    setBackdropGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/store/backdrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandColor }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "RATE_LIMITED") {
          setBackdropCanRegenerate(false);
          setBackdropNextDate(data.nextAvailableDate || null);
          throw new Error(data.error);
        }
        throw new Error(data.error || "Erro ao gerar estúdio");
      }

      // Start polling for backdrop completion
      let attempts = 0;
      const maxAttempts = 20; // 20 * 3s = 60s max

      if (backdropPollRef.current) clearInterval(backdropPollRef.current);

      backdropPollRef.current = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await fetch("/api/store/backdrop");
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData?.data?.url && pollData.data.url !== backdropUrl) {
              setBackdropUrl(pollData.data.url);
              setBackdropGenerating(false);
              setBackdropCanRegenerate(pollData.data.canRegenerate ?? false);
              setBackdropNextDate(pollData.data.nextAvailableDate || null);
              if (backdropPollRef.current) clearInterval(backdropPollRef.current);
            }
          }
        } catch {}

        if (attempts >= maxAttempts) {
          setBackdropGenerating(false);
          if (backdropPollRef.current) clearInterval(backdropPollRef.current);
        }
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao gerar estúdio";
      setError(message);
      setBackdropGenerating(false);
    }
  };

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
        throw new Error(friendlyError(data.error || `Erro ${res.status}`, "Erro ao enviar logo. Tente novamente."));
      }

      const data = await res.json();
      setLogoUrl(data.url || data.logo_url);
    } catch (err: unknown) {
      const message = friendlyError(err, "Erro ao enviar logo. Tente novamente.");
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
        throw new Error(friendlyError(data.error || `Erro ${res.status}`, "Erro ao salvar configurações."));
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const message = friendlyError(err, "Erro ao salvar configurações. Tente novamente.");
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in-up max-w-2xl mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--brand-200)", borderTopColor: "var(--brand-500)" }} />
      </div>
    );
  }

  return (
    <>
      {/* Color Picker Modal */}
      {showColorPicker && (
        <BrandColorPicker
          currentColor={brandColor}
          onColorSelected={(hex) => { setBrandColor(hex); setShowColorPicker(false); }}
          onClose={() => setShowColorPicker(false)}
        />
      )}

      <div className="animate-fade-in-up max-w-2xl mx-auto">

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
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--error, #EF4444)" }}>
          <span className="text-lg">⚠️</span>
          <p className="text-sm font-medium flex-1" style={{ color: "var(--error, #EF4444)" }}>
            Não foi possível salvar. Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => setError(null)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition hover:opacity-70"
            style={{ color: "var(--error, #EF4444)" }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* ── Logo + Cor da marca ── */}
        <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-5">Identidade da marca</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Logo */}
            <div className="flex flex-row sm:flex-col items-center sm:items-center gap-4 sm:gap-3">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer transition hover:opacity-80 relative group"
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
                    <span className="text-2xl sm:text-3xl">📷</span>
                    <p className="text-[10px] mt-1 hidden sm:block" style={{ color: "var(--muted)" }}>Sua logo</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-start sm:items-center flex-1 sm:flex-none">
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
                {!logoUrl && <label className="text-sm font-semibold sm:hidden block mb-1">Sua Logo</label>}
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="text-xs font-semibold px-4 py-2 rounded-lg min-h-[44px] transition w-full sm:w-auto"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {logoUrl ? "Trocar logo da marca" : "Fazer upload"}
                </button>
              </div>
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

        {/* ── Studio backdrop ── */}
        {brandColor && (
          <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <h2 className="text-lg font-semibold mb-2">📸 Estúdio personalizado</h2>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Imagem de fundo gerada pela IA na cor da sua marca. Usada como referência em todas as fotos de campanha para garantir consistência visual.
            </p>

            {/* Backdrop preview */}
            {backdropUrl ? (
              <div className="rounded-xl overflow-hidden mb-4 relative" style={{ border: "1px solid var(--border)" }}>
                <img
                  src={backdropUrl}
                  alt="Estúdio personalizado"
                  className="w-full h-48 object-cover"
                  style={{ objectPosition: "center bottom" }}
                />
                <div className="absolute bottom-0 inset-x-0 p-3 flex items-center justify-between" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
                  <span className="text-white text-xs font-semibold drop-shadow-md">✅ Estúdio ativo</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: brandColor, border: "2px solid white" }} />
                    <span className="text-white text-xs font-mono drop-shadow-md">{brandColor}</span>
                  </div>
                </div>
              </div>
            ) : backdropGenerating ? (
              <div className="rounded-xl h-48 flex flex-col items-center justify-center gap-3 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--brand-200)", borderTopColor: "var(--brand-500)" }} />
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Criando seu estúdio...</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Isso leva ~30 segundos</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl h-48 flex flex-col items-center justify-center gap-3 mb-4" style={{ background: `linear-gradient(180deg, ${brandColor}22 0%, ${brandColor}11 100%)`, border: "1px dashed var(--border)" }}>
                <span className="text-3xl">🎨</span>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Estúdio não gerado</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Gere seu estúdio personalizado para campanhas</p>
                </div>
              </div>
            )}

            {/* Generate/Regenerate button */}
            {backdropCanRegenerate ? (
              <button
                onClick={handleGenerateBackdrop}
                disabled={backdropGenerating || !brandColor}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: backdropGenerating ? "var(--surface)" : "var(--gradient-brand)",
                  color: backdropGenerating ? "var(--muted)" : "white",
                  border: backdropGenerating ? "1px solid var(--border)" : "none",
                }}
              >
                {backdropGenerating ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--brand-200)", borderTopColor: "var(--brand-500)" }} />
                    Gerando estúdio...
                  </>
                ) : backdropUrl ? (
                  "🔄 Regenerar estúdio"
                ) : (
                  "✨ Gerar estúdio personalizado"
                )}
              </button>
            ) : (
              <div className="w-full py-3 px-4 rounded-xl text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  🔒 Próxima troca disponível em{" "}
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>
                    {backdropNextDate
                      ? new Date(backdropNextDate).toLocaleDateString("pt-BR")
                      : "30 dias"}
                  </span>
                </p>
              </div>
            )}

            {!backdropCanRegenerate && (
              <p className="text-[11px] text-center mt-2" style={{ color: "var(--muted)" }}>
                O estúdio pode ser atualizado 1x a cada 30 dias
              </p>
            )}
          </div>
        )}
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
                className="p-2 sm:p-3 rounded-xl text-[11px] sm:text-sm font-medium text-center transition-all min-h-[44px] flex items-center justify-center gap-1.5 sm:gap-2 truncate min-w-0"
                style={{
                  background: segment === seg.value ? "var(--gradient-brand)" : "var(--surface)",
                  color: segment === seg.value ? "white" : "var(--muted)",
                  border: segment === seg.value ? "none" : "1px solid var(--border)",
                }}>
                <span className="flex-shrink-0">{seg.emoji}</span> <span className="truncate">{seg.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Save ── */}
        <button onClick={handleSave}
          disabled={saving || !storeLoaded}
          className="btn-primary !py-3.5 w-full disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: saved ? "var(--success)" : undefined }}>
          {saving ? "Salvando..." : saved ? "✅ Salvo!" : !storeLoaded ? "Carregando..." : "Salvar alterações"}
        </button>

        {/* ── Conta e Segurança (Logout - Mobile & Desktop) ── */}
        <div 
          className="mt-12 p-6 rounded-2xl flex flex-col items-center text-center" 
          style={{ 
            background: "var(--surface)", 
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px -12px rgba(239,68,68,0.05)"
          }}
        >
          <div 
            className="w-12 h-12 rounded-full mb-4 flex items-center justify-center bg-red-500/10"
            style={{ color: "#EF4444" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          
          <h2 className="text-[17px] font-bold tracking-tight mb-1" style={{ color: "var(--foreground)" }}>
            Conta e Segurança
          </h2>
          <p className="text-[14px] leading-relaxed mb-6 max-w-[280px]" style={{ color: "var(--muted)" }}>
            Você precisará fazer login novamente para acessar seus créditos e o histórico de campanhas.
          </p>
          
          <button
            onClick={() => {
              haptics.error();
              signOut({ redirectUrl: "/" });
            }}
            className="w-full py-3.5 px-4 rounded-xl text-[15px] font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] flex items-center justify-center gap-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.12) 100%)",
              color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.2)",
              boxShadow: "0 4px 12px -4px rgba(239,68,68,0.1)"
            }}
          >
            Sair do aplicativo
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
