"use client";

import { useState } from "react";

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const currentPlan = {
  name: "Grátis",
  badge: "🆓",
  campaigns_used: 2,
  campaigns_limit: 3,
  models_used: 0,
  models_limit: 0,
  regen_used: 0,
  regen_limit: 0,
  next_renewal: "02/05/2026",
};

const plans = [
  { id: "starter", name: "Starter", badge: "⭐", price: 49.9, campaigns: 15, models: 1, regen: 2, highlight: false },
  { id: "pro", name: "Pro", badge: "🚀", price: 97, campaigns: 50, models: 2, regen: 3, highlight: true },
  { id: "scale", name: "Scale", badge: "🏢", price: 197, campaigns: 200, models: 3, regen: 5, highlight: false },
];

const extras = [
  { label: "+5 campanhas", price: "R$ 14,90" },
  { label: "+10 campanhas", price: "R$ 24,90" },
  { label: "+1 modelo virtual", price: "R$ 9,90" },
  { label: "+10 regenerações", price: "R$ 4,90" },
];

export default function Plano() {
  const [loading, setLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Ler status da URL (callback do Mercado Pago)
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "approved" && !statusMsg) {
      setStatusMsg("✅ Pagamento aprovado! Seu plano será atualizado em instantes.");
    } else if (status === "rejected" && !statusMsg) {
      setStatusMsg("❌ Pagamento não aprovado. Tente novamente.");
    } else if (status === "pending" && !statusMsg) {
      setStatusMsg("⏳ Pagamento pendente (PIX/Boleto). Atualizaremos assim que confirmar.");
    }
  }

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json();

      if (data.success && data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else if (data.demo) {
        setStatusMsg("🎭 Modo demo — checkout simulado. Configure MERCADOPAGO_ACCESS_TOKEN no .env.local");
        setLoading(null);
      } else {
        setStatusMsg("Erro ao criar checkout. Tente novamente.");
        setLoading(null);
      }
    } catch {
      setStatusMsg("Erro de conexão. Tente novamente.");
      setLoading(null);
    }
  };

  const usagePercent = (currentPlan.campaigns_used / currentPlan.campaigns_limit) * 100;

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Meu <span className="gradient-text">Plano</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Gerencie seu plano, créditos e faturamento
        </p>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm">{statusMsg}</p>
          <button onClick={() => setStatusMsg(null)} className="ml-auto text-sm" style={{ color: "var(--muted)" }}>✕</button>
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: "var(--gradient-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{currentPlan.badge}</span>
            <div>
              <h2 className="text-xl font-bold">Plano {currentPlan.name}</h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Renova em {currentPlan.next_renewal}</p>
            </div>
          </div>
        </div>

        {/* Usage bars */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--muted)" }}>Campanhas</span>
              <span className="font-bold">{currentPlan.campaigns_used}/{currentPlan.campaigns_limit}</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: `${usagePercent}%`, background: usagePercent > 80 ? "var(--warning)" : "var(--gradient-brand)" }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--muted)" }}>Modelos</span>
              <span className="font-bold">{currentPlan.models_used}/{currentPlan.models_limit || "—"}</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: "0%", background: "var(--gradient-brand)" }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--muted)" }}>Regenerações</span>
              <span className="font-bold">{currentPlan.regen_used}/{currentPlan.regen_limit || "—"}</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: "0%", background: "var(--gradient-brand)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade options */}
      <h3 className="text-lg font-bold mb-4">Fazer upgrade</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {plans.map((plan) => (
          <div key={plan.name} className="rounded-2xl p-5 transition-all hover:-translate-y-1 flex flex-col"
            style={{
              background: plan.highlight ? "var(--gradient-brand)" : "var(--background)",
              color: plan.highlight ? "white" : "var(--foreground)",
              border: plan.highlight ? "none" : "1px solid var(--border)",
              boxShadow: plan.highlight ? "var(--shadow-glow)" : "none",
            }}>
            {plan.highlight && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start mb-2"
                style={{ background: "rgba(255,255,255,0.25)" }}>
                Recomendado
              </span>
            )}
            <span className="text-2xl mb-1">{plan.badge}</span>
            <h4 className="font-bold">{plan.name}</h4>
            <p className="text-2xl font-black mt-1">R$ {plan.price}<span className="text-xs font-normal opacity-70">/mês</span></p>
            <div className="mt-4 space-y-2 flex-1">
              <div className="flex items-center gap-2 text-xs"><span style={{ color: plan.highlight ? "white" : "var(--success)" }}><IconCheck /></span>{plan.campaigns} campanhas/mês</div>
              <div className="flex items-center gap-2 text-xs"><span style={{ color: plan.highlight ? "white" : "var(--success)" }}><IconCheck /></span>{plan.models} modelos virtuais</div>
              <div className="flex items-center gap-2 text-xs"><span style={{ color: plan.highlight ? "white" : "var(--success)" }}><IconCheck /></span>{plan.regen} regen/campanha</div>
            </div>
            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={loading === plan.id}
              className="w-full mt-4 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-60"
              style={{
                background: plan.highlight ? "white" : "var(--gradient-brand)",
                color: plan.highlight ? "var(--brand-600)" : "white",
              }}>
              {loading === plan.id ? "Abrindo checkout..." : `Assinar ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Credits */}
      <h3 className="text-lg font-bold mb-4">Créditos avulsos</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {extras.map((extra) => (
          <button key={extra.label} className="p-4 rounded-xl text-left transition-all hover:-translate-y-0.5"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold">{extra.label}</p>
            <p className="text-lg font-black gradient-text mt-1">{extra.price}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>Pagamento único</p>
          </button>
        ))}
      </div>
    </div>
  );
}
