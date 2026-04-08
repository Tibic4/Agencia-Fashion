"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

/* ═══════════════════════════════════════
   Test page — renders key UI sections
   WITHOUT Clerk authentication.
   Access: /test-mobile
   ═══════════════════════════════════════ */

const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);
const IconHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconCreditCard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
);
const IconUpload = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
);

const navItems = [
  { href: "#gerar", label: "Nova Campanha", shortLabel: "Criar", icon: <IconPlus /> },
  { href: "#historico", label: "Histórico", shortLabel: "Histórico", icon: <IconHistory /> },
  { href: "#modelo", label: "Modelo Virtual", shortLabel: "Modelo", icon: <IconUser /> },
  { href: "#config", label: "Configurações", shortLabel: "Config", icon: <IconSettings /> },
  { href: "#plano", label: "Meu Plano", shortLabel: "Plano", icon: <IconCreditCard /> },
];

export default function TestMobilePage() {
  const [activeTab, setActiveTab] = useState("gerar");

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface)" }}>
      {/* Sidebar — Desktop */}
      <aside
        className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30"
        style={{ background: "var(--background)", borderRight: "1px solid var(--border)" }}
      >
        <div className="h-16 flex items-center gap-2.5 px-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <Image src="/logo.png" alt="CriaLook" width={40} height={40} className="rounded-full" />
          <span className="text-lg font-bold tracking-tight">
            Cria<span className="gradient-text">Look</span>
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => setActiveTab(item.href.replace("#", ""))}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] text-left"
              style={{
                background: activeTab === item.href.replace("#", "") ? "var(--gradient-card)" : "transparent",
                color: activeTab === item.href.replace("#", "") ? "var(--brand-600)" : "var(--muted)",
                borderLeft: activeTab === item.href.replace("#", "") ? "3px solid var(--brand-500)" : "3px solid transparent",
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        {/* Usage */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="rounded-xl p-3" style={{ background: "var(--gradient-card)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Campanhas usadas</span>
              <span className="text-xs font-bold gradient-text">2/5</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: "40%", background: "var(--gradient-brand)" }} />
            </div>
          </div>
        </div>
        {/* User */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>T</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Teste Loja</p>
              <p className="text-xs truncate" style={{ color: "var(--muted)" }}>teste@crialook.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 glass h-14 flex items-center justify-between px-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="CriaLook" width={34} height={34} className="rounded-full" />
          <span className="text-base font-bold">
            Cria<span className="gradient-text">Look</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold gradient-text">2/5</span>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass flex items-center justify-around py-1 pb-[max(0.375rem,env(safe-area-inset-bottom))]" style={{ borderTop: "1px solid var(--border)" }}>
        {navItems.map((item) => {
          const key = item.href.replace("#", "");
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-all min-w-[56px] min-h-[48px] justify-center"
              style={{ color: activeTab === key ? "var(--brand-500)" : "var(--muted)" }}
            >
              {item.icon}
              <span className="text-[9px] font-medium leading-tight">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          {activeTab === "gerar" && <GerarSection />}
          {activeTab === "historico" && <HistoricoSection />}
          {activeTab === "modelo" && <ModeloSection />}
          {activeTab === "config" && <ConfigSection />}
          {activeTab === "plano" && <PlanoSection />}
        </div>
      </main>
    </div>
  );
}

/* ═══════ GERAR ═══════ */
function GerarSection() {
  return (
    <div className="animate-fade-in-up pb-24 md:pb-0">
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
          <div className="flex flex-col sm:flex-row gap-3" style={{ minHeight: "280px" }}>
            {/* Main photo */}
            <div className="relative rounded-2xl overflow-hidden transition-all cursor-pointer group flex-[3]" style={{ border: "2px dashed var(--border)", background: "var(--background)", minHeight: "200px" }}>
              <div className="flex flex-col items-center justify-center gap-3 p-6 h-full">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
                  <IconUpload />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm mb-0.5">Foto principal *</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Visão completa da peça</p>
                </div>
              </div>
            </div>
            {/* Side photos */}
            <div className="flex flex-row sm:flex-col gap-3 flex-[2]">
              <div className="relative rounded-xl overflow-hidden transition-all cursor-pointer group flex-1" style={{ border: "2px dashed var(--border)", background: "var(--background)", minHeight: "100px" }}>
                <div className="flex flex-col items-center justify-center gap-2 p-3 h-full">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-50)", color: "var(--brand-500)" }}>
                    <IconSearch />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold">Close-up</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>Melhora precisão</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}>opcional</span>
                </div>
              </div>
              <div className="relative rounded-xl overflow-hidden transition-all cursor-pointer group flex-1" style={{ border: "2px dashed var(--border)", background: "var(--background)", minHeight: "100px" }}>
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
              </div>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Preço de venda <span className="font-normal" style={{ color: "var(--muted)" }}>(opcional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--muted)" }}>R$</span>
              <input type="text" placeholder="Ex: 89,90" className="w-full h-12 pl-10 pr-4 rounded-xl text-lg font-semibold outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-6">
          {/* Body Type */}
          <div>
            <label className="block text-sm font-semibold mb-2">Tipo de corpo da modelo</label>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-3 rounded-xl text-center" style={{ border: "2px solid var(--brand-500)", background: "var(--brand-50)" }}>
                <span className="text-2xl">👤</span>
                <p className="text-sm font-semibold mt-1">Normal</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Tamanhos P / M / G</p>
              </button>
              <button className="p-3 rounded-xl text-center" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                <span className="text-2xl">💃</span>
                <p className="text-sm font-semibold mt-1">Plus Size</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Tamanhos GG / XGG / EGG</p>
              </button>
            </div>
          </div>

          {/* Model selector (simple) */}
          <div>
            <label className="text-sm font-semibold">Escolha a modelo</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 mt-3">
              <button className="aspect-[3/4] rounded-lg flex flex-col items-center justify-center" style={{ border: "2px solid var(--brand-500)", background: "var(--brand-50)" }}>
                <span className="text-lg">🎲</span>
                <span className="text-[10px] font-medium mt-1" style={{ color: "var(--muted)" }}>Aleatória</span>
              </button>
              {[1,2,3,4,5,6].map(i => (
                <button key={i} className="aspect-[3/4] rounded-lg flex items-center justify-center" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <span className="text-2xl">👩</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cenário */}
          <div>
            <label className="block text-sm font-semibold mb-3">Cenário</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {["Estúdio", "Urbano", "Praia", "Jardim", "Loja", "Minha Marca"].map(bg => (
                <button key={bg} className="rounded-xl overflow-hidden text-center" style={{ border: bg === "Estúdio" ? "2px solid var(--brand-500)" : "1px solid var(--border)" }}>
                  <div className="w-full aspect-square flex items-center justify-center" style={{ background: "var(--surface)" }}>
                    <span className="text-lg">🎨</span>
                  </div>
                  <div className="py-1.5 px-1" style={{ background: "var(--surface)" }}>
                    <p className="text-xs font-medium">{bg}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button className="btn-primary w-full !py-4 text-base disabled:opacity-40" disabled>
            <IconZap />
            Gerar Campanha
          </button>
          <p className="text-xs text-center" style={{ color: "var(--muted)" }}>Faça upload da foto para continuar</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════ HISTÓRICO ═══════ */
function HistoricoSection() {
  const campaigns = [
    { id: "1", headline: "Vestido Floral — Promoção de Verão", objective: "venda_imediata", price: 89.90, score: 87, status: "completed", date: "Hoje" },
    { id: "2", headline: "Blusa Cropped — Black Friday 50% OFF", objective: "promocao", price: 49.90, score: 92, status: "completed", date: "Ontem" },
    { id: "3", headline: "Conjunto Fitness — Lançamento", objective: "lancamento", price: 129.90, score: null, status: "processing", date: "3d atrás" },
  ];
  const objectiveLabels: Record<string, string> = {
    venda_imediata: "💰 Venda",
    lancamento: "🚀 Lançamento",
    promocao: "🔥 Promoção",
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            <span className="gradient-text">Histórico</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>3 campanhas geradas</p>
        </div>
        <button className="btn-primary text-sm !py-2.5 min-h-[44px] flex items-center justify-center">
          + Nova campanha
        </button>
      </div>

      <div className="mb-6 p-3 rounded-xl flex items-center gap-3 text-xs" style={{ background: "var(--brand-50)", border: "1px solid var(--brand-200)" }}>
        <span>📅</span>
        <p>Seu plano mostra campanhas dos últimos <strong>30 dias</strong>. <span className="font-semibold underline" style={{ color: "var(--brand-600)" }}>Faça upgrade</span> para histórico mais longo.</p>
      </div>

      <div className="space-y-3">
        {campaigns.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl transition-all group min-h-[60px]"
            style={{ background: "var(--background)", border: "1px solid var(--border)", animationDelay: `${i * 0.05}s` }}
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0" style={{ background: "var(--gradient-card)" }}>
              {c.status === "completed" ? "✅" : "⏳"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{c.headline}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                R$ {c.price.toFixed(2).replace(".", ",")} · {objectiveLabels[c.objective]} · {c.date}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {c.score ? (
                <div className="text-right">
                  <p className="text-lg font-black gradient-text">{c.score}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted)" }}>score</p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--muted)" }}>Processando...</p>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ MODELO ═══════ */
function ModeloSection() {
  return (
    <div className="animate-fade-in-up pb-24 md:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Modelos <span className="gradient-text">Virtuais</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>0/3 modelos · Plano <span className="font-semibold capitalize">Pro</span></p>
        </div>
        <button className="btn-primary !py-2.5 text-sm min-h-[44px]">+ Nova modelo</button>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-8xl mb-6">👩</div>
        <h2 className="text-xl font-bold mb-2">Nenhuma modelo ainda</h2>
        <p className="text-sm mb-6 max-w-md" style={{ color: "var(--muted)" }}>
          Crie uma modelo virtual que representa suas clientes. Suas roupas serão vestidas nela automaticamente.
        </p>
        <button className="btn-primary">✨ Criar primeira modelo</button>
      </div>
    </div>
  );
}

/* ═══════ CONFIGURAÇÕES ═══════ */
function ConfigSection() {
  return (
    <div className="animate-fade-in-up pb-24 md:pb-0">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          <span className="gradient-text">Configurações</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Personalize sua experiência</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Store info */}
        <div className="rounded-2xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold mb-4">Dados da Loja</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Nome da loja</label>
              <input type="text" value="Boutique Fashion" readOnly className="w-full h-11 px-4 rounded-xl text-sm outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Nicho</label>
              <input type="text" value="Moda Feminina" readOnly className="w-full h-11 px-4 rounded-xl text-sm outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>
        </div>

        {/* Brand color */}
        <div className="rounded-2xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold mb-4">🎨 Cor da Marca</h2>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>A cor será usada nos cenários &ldquo;Minha Marca&rdquo;</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl" style={{ background: "#EC4899", border: "2px solid var(--border)" }} />
            <div>
              <p className="text-sm font-semibold">#EC4899</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Clique para alterar</p>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="rounded-2xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold mb-4">Conta</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--surface)" }}>
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>teste@crialook.com</p>
              </div>
            </div>
            <button className="w-full py-3 rounded-xl text-sm font-medium min-h-[44px]" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════ PLANO ═══════ */
function PlanoSection() {
  return (
    <div className="animate-fade-in-up pb-24 md:pb-0">
      <div className="mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Seu <span className="gradient-text">Plano</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Escolha o melhor plano para sua loja</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {[
          { name: "Starter", price: "59", features: ["5 campanhas/mês", "1 modelo virtual", "Suporte por email"] },
          { name: "Pro", price: "129", features: ["20 campanhas/mês", "3 modelos virtuais", "Suporte prioritário", "Histórico 90 dias"], popular: true },
          { name: "Business", price: "249", features: ["50 campanhas/mês", "5 modelos virtuais", "Suporte VIP", "Histórico ilimitado"] },
        ].map(plan => (
          <div key={plan.name} className="rounded-2xl p-5 relative" style={{
            background: "var(--background)",
            border: plan.popular ? "2px solid var(--brand-500)" : "1px solid var(--border)",
            boxShadow: plan.popular ? "0 4px 20px rgba(236,72,153,0.15)" : "none",
          }}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold" style={{ background: "var(--gradient-brand)", color: "white" }}>
                Mais popular
              </div>
            )}
            <h3 className="text-lg font-bold mt-2">{plan.name}</h3>
            <p className="text-3xl font-black mt-2">
              R$ {plan.price}<span className="text-sm font-normal" style={{ color: "var(--muted)" }}>/mês</span>
            </p>
            <ul className="mt-4 space-y-2">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <span style={{ color: "var(--brand-500)" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button className={`w-full mt-6 py-3 rounded-xl text-sm font-semibold min-h-[44px] ${plan.popular ? "btn-primary" : ""}`} style={!plan.popular ? { background: "var(--surface)", border: "1px solid var(--border)" } : {}}>
              {plan.popular ? "Assinar agora" : "Escolher"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
