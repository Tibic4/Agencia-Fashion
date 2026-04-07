"use client";

import { useState } from "react";

export default function Configuracoes() {
  const [storeName, setStoreName] = useState("Loja Fashion");
  const [city, setCity] = useState("São Paulo");
  const [state, setState] = useState("SP");
  const [instagram, setInstagram] = useState("@lojafashion");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="animate-fade-in-up max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          <span className="gradient-text">Configurações</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Dados da sua loja usados pela IA para personalizar as campanhas
        </p>
      </div>

      <div className="space-y-8">
        {/* Store info */}
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
                <input type="text" value={state} onChange={(e) => setState(e.target.value)} maxLength={2}
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
            <div>
              <label className="block text-sm font-medium mb-1.5">Logo da loja</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl" style={{ background: "var(--brand-100)" }}>
                  👗
                </div>
                <button className="btn-secondary text-xs !py-2.5 min-h-[44px]">Trocar logo</button>
              </div>
            </div>
          </div>
        </div>

        {/* Segment */}
        <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-5">Segmento</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {["Moda feminina", "Moda masculina", "Infantil", "Plus size", "Fitness", "Acessórios"].map((seg) => (
              <button key={seg} className="p-3 rounded-xl text-sm font-medium text-center transition-all min-h-[44px]"
                style={{
                  background: seg === "Moda feminina" ? "var(--gradient-brand)" : "var(--surface)",
                  color: seg === "Moda feminina" ? "white" : "var(--muted)",
                  border: seg === "Moda feminina" ? "none" : "1px solid var(--border)",
                }}>
                {seg}
              </button>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-5">Preferências</h2>
          <div className="space-y-4">
            {[
              { label: "Usar emojis nas copies", desc: "A IA inclui emojis relevantes nos textos", enabled: true },
              { label: "Incluir hashtags", desc: "Gerar hashtags automaticamente para Instagram", enabled: true },
              { label: "Tom informal", desc: "Textos mais próximos e casuais", enabled: false },
            ].map((pref) => (
              <div key={pref.label} className="flex items-center justify-between py-3 min-h-[48px]">
                <div>
                  <p className="text-sm font-medium">{pref.label}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{pref.desc}</p>
                </div>
                <div className="w-11 h-6 rounded-full relative cursor-pointer"
                  style={{ background: pref.enabled ? "var(--gradient-brand)" : "var(--border)" }}>
                  <div className="w-4.5 h-4.5 rounded-full bg-white absolute top-[3px] transition-all shadow"
                    style={{ left: pref.enabled ? "22px" : "3px", width: "18px", height: "18px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave}
          className="btn-primary !py-3.5 w-full"
          style={{ background: saved ? "var(--success)" : undefined }}>
          {saved ? "✅ Salvo!" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
