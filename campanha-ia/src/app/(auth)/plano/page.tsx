"use client";

import { useState, useEffect } from "react";

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

interface StoreUsage {
  campaigns_generated: number;
  campaigns_limit: number;
  models_used: number;
  models_limit: number;
  regen_limit: number;
}

interface StoreData {
  id: string;
  name: string;
  plan_id: string | null;
}

const plans = [
  { id: "starter", name: "Starter", badge: "⭐", price: 59, campaigns: 15, models: 1, regen: 2, highlight: false },
  { id: "pro", name: "Pro", badge: "🚀", price: 129, campaigns: 40, models: 2, regen: 3, highlight: true },
  { id: "business", name: "Business", badge: "🏢", price: 249, campaigns: 85, models: 3, regen: 3, highlight: false },
  { id: "agencia", name: "Agência", badge: "🏆", price: 499, campaigns: 170, models: 5, regen: 3, highlight: false },
];

const extras = [
  { label: "+5 campanhas", price: "R$ 29,90", packageId: "5_campanhas" },
  { label: "+10 campanhas", price: "R$ 49,90", packageId: "10_campanhas" },
  { label: "+25 campanhas", price: "R$ 99,90", packageId: "25_campanhas" },
  { label: "+1 modelo virtual", price: "R$ 4,90", packageId: "1_modelo" },
  { label: "+3 modelos virtuais", price: "R$ 12,90", packageId: "3_modelos" },
  { label: "+10 regenerações", price: "R$ 9,90", packageId: "10_regeneracoes" },
];

export default function Plano() {
  const [loading, setLoading] = useState<string | null>(null);
  const [creditLoading, setCreditLoading] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [usage, setUsage] = useState<StoreUsage | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Fix #2: Read URL params inside useEffect (not during render)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "approved") {
      setStatusMsg("✅ Pagamento aprovado! Seu plano será atualizado em instantes.");
    } else if (status === "rejected") {
      setStatusMsg("❌ Pagamento não aprovado. Tente novamente.");
    } else if (status === "pending") {
      setStatusMsg("⏳ Pagamento pendente (PIX/Boleto). Atualizaremos assim que confirmar.");
    }
  }, []);

  // Fix #3: Fetch real store + usage data from API
  useEffect(() => {
    async function loadStoreData() {
      try {
        const [storeRes, usageRes] = await Promise.all([
          fetch("/api/store"),
          fetch("/api/store/usage"),
        ]);

        if (storeRes.ok) {
          const storeData = await storeRes.json();
          setStore(storeData.data);
        }

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsage(usageData.data);
        }
      } catch {
        console.error("[Plano] Erro ao carregar dados da loja");
      } finally {
        setDataLoading(false);
      }
    }
    loadStoreData();
  }, []);

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

  const handleCreditCheckout = async (packageId: string) => {
    setCreditLoading(packageId);
    try {
      const response = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setStatusMsg(data.error || "Erro ao criar checkout de créditos.");
        setCreditLoading(null);
      }
    } catch {
      setStatusMsg("Erro de conexão. Tente novamente.");
      setCreditLoading(null);
    }
  };

  const campaignsUsed = usage?.campaigns_generated ?? 0;
  const campaignsLimit = usage?.campaigns_limit ?? 3;
  const usagePercent = campaignsLimit > 0 ? (campaignsUsed / campaignsLimit) * 100 : 0;

  // Detect current plan name from store data
  const currentPlanName = store?.plan_id
    ? plans.find((p) => store.plan_id?.includes(p.id))?.name || "Avulso"
    : "Avulso";

  const nextRenewal = new Date();
  nextRenewal.setMonth(nextRenewal.getMonth() + 1, 1);
  const renewalStr = nextRenewal.toLocaleDateString("pt-BR");

  if (dataLoading) {
    return (
      <div className="animate-fade-in-up">
        <div className="mb-8">
          <div className="skeleton skeleton-title" style={{ width: '160px' }} />
          <div className="skeleton skeleton-text" style={{ width: '240px' }} />
        </div>
        <div className="rounded-2xl p-6 mb-8" style={{ background: 'var(--gradient-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
            <div className="flex-1">
              <div className="skeleton skeleton-title" style={{ width: '120px' }} />
              <div className="skeleton skeleton-text" style={{ width: '180px' }} />
            </div>
          </div>
          <div className="skeleton" style={{ height: '12px', width: '100%', borderRadius: '999px' }} />
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card skeleton rounded-2xl" style={{ height: '200px' }} />
          ))}
        </div>
      </div>
    );
  }

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
            <span className="text-3xl">{currentPlanName === "Avulso" ? "💳" : plans.find((p) => p.name === currentPlanName)?.badge || "⭐"}</span>
            <div>
              <h2 className="text-xl font-bold">Plano {currentPlanName}</h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Renova em {renewalStr}</p>
            </div>
          </div>
        </div>

        {/* Usage bars */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--muted)" }}>Campanhas</span>
              <span className="font-bold">
                {dataLoading ? "..." : `${campaignsUsed}/${campaignsLimit}`}
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${usagePercent}%`, background: usagePercent > 80 ? "var(--warning)" : "var(--gradient-brand)" }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--muted)" }}>Modelos</span>
              <span className="font-bold">
                {dataLoading ? "..." : `${usage?.models_used ?? 0}/${usage?.models_limit ?? 0}`}
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: `${usage?.models_limit ? ((usage?.models_used ?? 0) / usage.models_limit) * 100 : 0}%`, background: "var(--gradient-brand)" }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--background)" }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--muted)" }}>Regenerações/camp</span>
              <span className="font-bold">
                {dataLoading ? "..." : `${usage?.regen_limit ?? 0} por campanha`}
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: "100%", background: "var(--gradient-brand)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade options */}
      <h3 className="text-lg font-bold mb-4">Fazer upgrade</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      {/* Credits - Fix #15: disabled with "Em breve" tooltip */}
      <h3 className="text-lg font-bold mb-4">Créditos avulsos</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {extras.map((extra) => (
          <button key={extra.label}
            onClick={() => handleCreditCheckout(extra.packageId)}
            disabled={creditLoading === extra.packageId}
            className="p-4 rounded-xl text-left transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-60"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold">{extra.label}</p>
            <p className="text-lg font-black gradient-text mt-1">{extra.price}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
              {creditLoading === extra.packageId ? "Abrindo checkout..." : "Comprar agora"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
