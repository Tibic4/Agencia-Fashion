"use client";

import { useState } from "react";

const skinTones = [
  { value: "branca", label: "Clara", color: "#F5D0B5" },
  { value: "morena_clara", label: "Morena clara", color: "#D4A574" },
  { value: "morena", label: "Morena", color: "#A67B5B" },
  { value: "negra", label: "Negra", color: "#6B4226" },
];

const hairStyles = [
  { value: "liso", label: "Liso", emoji: "💇‍♀️" },
  { value: "ondulado", label: "Ondulado", emoji: "🌊" },
  { value: "cacheado", label: "Cacheado", emoji: "🌀" },
  { value: "crespo", label: "Crespo", emoji: "✨" },
  { value: "curto", label: "Curto", emoji: "✂️" },
];

const bodyTypes = [
  { value: "magra", label: "Magra" },
  { value: "media", label: "Média" },
  { value: "plus_size", label: "Plus Size" },
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

export default function ModeloVirtual() {
  const [skin, setSkin] = useState("morena_clara");
  const [hair, setHair] = useState("ondulado");
  const [body, setBody] = useState("media");
  const [style, setStyle] = useState("casual_natural");
  const [age, setAge] = useState("adulta_26_35");
  const [name, setName] = useState("");
  const [hasModel, setHasModel] = useState(false);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Modelo <span className="gradient-text">Virtual</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Crie uma modelo IA que representa suas clientes. Suas roupas serão vestidas nela.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left — Configuration */}
        <div className="space-y-6">
          {/* Skin tone */}
          <div>
            <label className="block text-sm font-semibold mb-3">Tom de pele</label>
            <div className="flex gap-3">
              {skinTones.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSkin(s.value)}
                  className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                  style={{
                    border: skin === s.value ? "2px solid var(--brand-500)" : "1px solid var(--border)",
                    background: skin === s.value ? "var(--gradient-card)" : "var(--surface)",
                  }}
                >
                  <div className="w-10 h-10 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hair */}
          <div>
            <label className="block text-sm font-semibold mb-3">Cabelo</label>
            <div className="flex flex-wrap gap-2">
              {hairStyles.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setHair(h.value)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: hair === h.value ? "var(--brand-100)" : "var(--surface)",
                    color: hair === h.value ? "var(--brand-700)" : "var(--muted)",
                    border: hair === h.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
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
            <div className="flex gap-2">
              {ages.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAge(a.value)}
                  className="flex-1 p-2.5 rounded-xl text-xs font-medium text-center transition-all"
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
              className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>

          {/* Generate */}
          <button className="btn-primary w-full !py-3.5">
            ✨ Criar modelo virtual
          </button>
          <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
            Consome 1 criação de modelo do seu plano · Leva ~30 segundos
          </p>
        </div>

        {/* Right — Preview */}
        <div>
          <div className="rounded-2xl overflow-hidden sticky top-8" style={{ border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold">Preview</h3>
              <span className="badge badge-brand text-xs">IA</span>
            </div>
            <div className="aspect-[3/4] flex items-center justify-center" style={{ background: "var(--gradient-brand-soft)" }}>
              <div className="text-center p-8">
                <div className="text-8xl mb-4">👩</div>
                <p className="font-semibold text-lg">{name || "Sua modelo"}</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className="badge badge-brand text-xs">{skinTones.find(s => s.value === skin)?.label}</span>
                  <span className="badge badge-brand text-xs">{hairStyles.find(h => h.value === hair)?.label}</span>
                  <span className="badge badge-brand text-xs">{bodyTypes.find(b => b.value === body)?.label}</span>
                  <span className="badge badge-brand text-xs">{styles.find(s => s.value === style)?.label}</span>
                  <span className="badge badge-brand text-xs">{ages.find(a => a.value === age)?.label}</span>
                </div>
                <p className="text-xs mt-6" style={{ color: "var(--muted)" }}>
                  A modelo será gerada pela IA após clicar em &quot;Criar&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
