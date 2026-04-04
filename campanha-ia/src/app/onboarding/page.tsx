"use client";

import { useState } from "react";
import Link from "next/link";

const IconSparkles = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);
const IconArrowRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
const IconArrowLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconZap = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

const segments = [
  { value: "feminina", label: "Moda Feminina", emoji: "👗", desc: "Vestidos, blusas, saias, conjuntos" },
  { value: "masculina", label: "Moda Masculina", emoji: "👔", desc: "Camisas, calças, bermudas" },
  { value: "infantil", label: "Infantil", emoji: "👶", desc: "Roupas para crianças e bebês" },
  { value: "plus_size", label: "Plus Size", emoji: "💃", desc: "Moda inclusiva e confortável" },
  { value: "fitness", label: "Fitness", emoji: "🏋️‍♀️", desc: "Leggings, tops, conjuntos esportivos" },
  { value: "intima", label: "Moda Íntima", emoji: "🩱", desc: "Lingerie, pijamas, underwear" },
  { value: "praia", label: "Praia", emoji: "👙", desc: "Biquínis, maiôs, saídas de praia" },
  { value: "acessorios", label: "Acessórios", emoji: "👜", desc: "Bolsas, bijuterias, cintos" },
];

const skinTones = [
  { value: "branca", color: "#F5D0B5" },
  { value: "morena_clara", color: "#D4A574" },
  { value: "morena", color: "#A67B5B" },
  { value: "negra", color: "#6B4226" },
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

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [storeName, setStoreName] = useState("");
  const [segment, setSegment] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [instagram, setInstagram] = useState("");
  const [skin, setSkin] = useState("morena_clara");
  const [hair, setHair] = useState("ondulado");
  const [body, setBody] = useState("media");
  const [skipModel, setSkipModel] = useState(false);

  const totalSteps = 3;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-brand)", color: "white" }}>
            <IconSparkles />
          </div>
          <span className="text-lg font-bold">Campanha <span className="gradient-text">IA</span></span>
        </div>
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: step >= s ? "var(--gradient-brand)" : "var(--surface)",
                  color: step >= s ? "white" : "var(--muted)",
                  border: step >= s ? "none" : "1px solid var(--border)",
                }}>
                {step > s ? <IconCheck /> : s}
              </div>
              {s < 3 && <div className="w-8 h-0.5 rounded" style={{ background: step > s ? "var(--brand-400)" : "var(--border)" }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          {/* Step 1: Store info */}
          {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-8">
                <span className="text-4xl mb-4 block">🏪</span>
                <h1 className="text-3xl font-bold mb-2">Sobre sua loja</h1>
                <p style={{ color: "var(--muted)" }}>Conte um pouco sobre seu negócio para personalizar as campanhas</p>
              </div>

              <div className="rounded-2xl p-6 space-y-5" style={{ background: "var(--background)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nome da loja *</label>
                  <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Boutique da Ana, Moda Bella..."
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--brand-300)]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-3">Segmento principal *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {segments.map((seg) => (
                      <button key={seg.value} onClick={() => setSegment(seg.value)}
                        className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                        style={{
                          background: segment === seg.value ? "var(--gradient-card)" : "var(--surface)",
                          border: segment === seg.value ? "1px solid var(--brand-300)" : "1px solid var(--border)",
                        }}>
                        <span className="text-xl">{seg.emoji}</span>
                        <div>
                          <p className="text-xs font-semibold">{seg.label}</p>
                          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{seg.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Cidade</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo"
                      className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Instagram</label>
                    <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@sualoja"
                      className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                </div>

                <button onClick={() => setStep(2)}
                  disabled={!storeName || !segment}
                  className="btn-primary w-full !py-3.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  Continuar <IconArrowRight />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Virtual model */}
          {step === 2 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-8">
                <span className="text-4xl mb-4 block">👩</span>
                <h1 className="text-3xl font-bold mb-2">Modelo virtual</h1>
                <p style={{ color: "var(--muted)" }}>Crie uma modelo IA para vestir suas roupas nas campanhas</p>
              </div>

              {!skipModel ? (
                <div className="rounded-2xl p-6 space-y-5" style={{ background: "var(--background)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
                  <div>
                    <label className="block text-sm font-semibold mb-3">Tom de pele</label>
                    <div className="flex gap-4 justify-center">
                      {skinTones.map((s) => (
                        <button key={s.value} onClick={() => setSkin(s.value)}
                          className="transition-all"
                          style={{ transform: skin === s.value ? "scale(1.2)" : "scale(1)" }}>
                          <div className="w-14 h-14 rounded-full transition-all"
                            style={{ background: s.color, border: skin === s.value ? "3px solid var(--brand-500)" : "3px solid transparent", boxShadow: skin === s.value ? "var(--shadow-glow)" : "none" }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3">Cabelo</label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {hairStyles.map((h) => (
                        <button key={h.value} onClick={() => setHair(h.value)}
                          className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                          style={{
                            background: hair === h.value ? "var(--gradient-brand)" : "var(--surface)",
                            color: hair === h.value ? "white" : "var(--muted)",
                            border: hair === h.value ? "none" : "1px solid var(--border)",
                          }}>
                          {h.emoji} {h.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3">Corpo</label>
                    <div className="grid grid-cols-3 gap-2">
                      {bodyTypes.map((b) => (
                        <button key={b.value} onClick={() => setBody(b.value)}
                          className="py-3 rounded-xl text-sm font-medium transition-all"
                          style={{
                            background: body === b.value ? "var(--gradient-brand)" : "var(--surface)",
                            color: body === b.value ? "white" : "var(--muted)",
                            border: body === b.value ? "none" : "1px solid var(--border)",
                          }}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="btn-secondary flex-1 !py-3">
                      <IconArrowLeft /> Voltar
                    </button>
                    <button onClick={() => setStep(3)} className="btn-primary flex-1 !py-3">
                      Criar modelo <IconArrowRight />
                    </button>
                  </div>

                  <button onClick={() => { setSkipModel(true); setStep(3); }}
                    className="w-full text-center text-xs py-2 transition"
                    style={{ color: "var(--muted)" }}>
                    Pular — usar modelos stock
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <div className="animate-fade-in-up text-center">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center animate-pulse-glow"
                style={{ background: "var(--gradient-brand)", color: "white" }}>
                <IconCheck />
              </div>
              <h1 className="text-3xl font-bold mb-2">Tudo pronto! 🎉</h1>
              <p className="text-lg mb-2" style={{ color: "var(--muted)" }}>
                Sua loja <strong style={{ color: "var(--foreground)" }}>{storeName || "Fashion"}</strong> está configurada
              </p>
              <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
                Agora é só tirar uma foto da roupa e deixar a IA fazer o resto!
              </p>

              <div className="rounded-2xl p-6 mb-6 text-left" style={{ background: "var(--background)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
                <h3 className="font-semibold mb-3">Resumo:</h3>
                <div className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
                  <p>🏪 <strong style={{ color: "var(--foreground)" }}>{storeName || "Sua loja"}</strong></p>
                  <p>👗 {segments.find((s) => s.value === segment)?.label || "Moda"}</p>
                  {city && <p>📍 {city}</p>}
                  {instagram && <p>📸 {instagram}</p>}
                  <p>👩 {skipModel ? "Modelo stock" : "Modelo personalizada"}</p>
                </div>
              </div>

              <Link href="/gerar" className="btn-primary text-base !py-4 !px-10 inline-flex animate-pulse-glow">
                <IconZap />
                Gerar minha primeira campanha
                <IconArrowRight />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
