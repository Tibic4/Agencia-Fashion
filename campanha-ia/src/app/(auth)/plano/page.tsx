"use client";

import { useState, useEffect } from "react";
import { friendlyError } from "@/lib/friendly-error";

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

interface StoreUsage {
  plan_name: string;
  campaigns_generated: number;
  campaigns_limit: number;
  models_used: number;
  models_limit: number;
}

interface StoreData {
  id: string;
  name: string;
  plan_id: string | null;
  mercadopago_subscription_id?: string | null;
}

const plans = [
  { id: "essencial", name: "Essencial", badge: "💡", price: 179, campaigns: 15, models: 5, highlight: false },
  { id: "pro", name: "Pro", badge: "🚀", price: 359, campaigns: 40, models: 15, highlight: true },
  { id: "business", name: "Business", badge: "🏢", price: 749, campaigns: 100, models: 40, highlight: false },
];

const extras = [
  { label: "+3 campanhas", price: "R$ 49,90", packageId: "3_campanhas" },
  { label: "+10 campanhas", price: "R$ 149,90", packageId: "10_campanhas" },
  { label: "+20 campanhas", price: "R$ 249,00", packageId: "20_campanhas" },
  { label: "+3 modelos virtuais", price: "R$ 19,90", packageId: "3_modelos" },
  { label: "+10 modelos virtuais", price: "R$ 49,90", packageId: "10_modelos" },
  { label: "+25 modelos virtuais", price: "R$ 99,90", packageId: "25_modelos" },
];

export default function Plano() {
  const [loading, setLoading] = useState<string | null>(null);
  const [creditLoading, setCreditLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
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

      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else if (data.demo || data.data?.demo) {
        setStatusMsg("🎭 Modo demo — checkout simulado. Configure MERCADOPAGO_ACCESS_TOKEN no .env.local");
        setCreditLoading(null);
      } else {
        setStatusMsg(friendlyError(data.error, "Erro ao criar checkout de créditos."));
        setCreditLoading(null);
      }
    } catch {
      setStatusMsg("Erro de conexão. Tente novamente.");
      setCreditLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura? Seu plano permanecerá ativo até o fim do período pago.")) return;
    setCancelLoading(true);
    try {
      const response = await fetch("/api/subscription/cancel", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setStatusMsg("✅ Assinatura cancelada. Seu plano permanece ativo até o fim do período.");
        setStore((prev) => prev ? { ...prev, mercadopago_subscription_id: null } : prev);
      } else {
        setStatusMsg(friendlyError(data.error, "Erro ao cancelar assinatura."));
      }
    } catch {
      setStatusMsg("Erro de conexão. Tente novamente.");
    } finally {
      setCancelLoading(false);
    }
  };

  const campaignsUsed = usage?.campaigns_generated ?? 0;
  const campaignsLimit = usage?.campaigns_limit ?? 0;
  const usagePercent = campaignsLimit > 0 ? (campaignsUsed / campaignsLimit) * 100 : 0;

  // Detect current plan name from usage API (source of truth)
  const planNameMap: Record<string, string> = {
    gratis: "Avulso",
    free: "Avulso",
    essencial: "Essencial",
    pro: "Pro",
    business: "Business",
  };
  const currentPlanName = usage?.plan_name
    ? planNameMap[usage.plan_name] || "Avulso"
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
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{currentPlanName === "Avulso" ? "💳" : plans.find((p) => p.name === currentPlanName)?.badge || "⭐"}</span>
            <div>
              <h2 className="text-xl font-bold">Plano {currentPlanName}</h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {store?.mercadopago_subscription_id 
                  ? `🔄 Assinatura ativa — Renova em ${renewalStr}` 
                  : currentPlanName === "Avulso" 
                    ? "Sem assinatura — compre créditos ou assine um plano"
                    : `Renova em ${renewalStr}`
                }
              </p>
            </div>
          </div>
          {store?.mercadopago_subscription_id && (
            <button
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              className="text-xs px-4 py-2.5 rounded-full transition-all hover:opacity-80 disabled:opacity-50 min-h-[44px]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              {cancelLoading ? "Cancelando..." : "Cancelar assinatura"}
            </button>
          )}
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
              <span style={{ color: "var(--muted)" }}>Modelo + Fundo</span>
              <span className="font-bold" style={{ color: "var(--success)" }}>✓ Incluso</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: "100%", background: "var(--gradient-brand)" }} />
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
              <div className="flex items-center gap-2 text-xs"><span style={{ color: plan.highlight ? "white" : "var(--success)" }}><IconCheck /></span>Modelo + fundo profissional</div>
            </div>
            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={loading === plan.id}
              className="w-full mt-4 py-3 px-2 rounded-full text-[12px] sm:text-sm font-semibold transition-all disabled:opacity-60 min-h-[44px] truncate"
              style={{
                background: plan.highlight ? "white" : "var(--gradient-brand)",
                color: plan.highlight ? "var(--brand-600)" : "white",
              }}>
              {loading === plan.id ? "Abrindo checkout..." : `Assinar ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Trial — only show for free plan users */}
      {currentPlanName === "Avulso" && (
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-4">Comece agora</h3>
          <div className="rounded-2xl p-5 text-center transition-all hover:-translate-y-1" style={{
            background: "var(--gradient-brand-soft)",
            border: "1px solid var(--brand-200)",
            boxShadow: "var(--shadow-md)",
          }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xl">🎯</span>
              <h4 className="text-lg font-bold">Teste na Prática</h4>
            </div>
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-2xl font-black">R$ 19,90</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>único</span>
            </div>
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
              3 campanhas + 1 modelo virtual • Sem mensalidade
            </p>
            <button
              onClick={() => handleCreditCheckout("trial")}
              disabled={creditLoading === "trial"}
              className="w-full max-w-xs mx-auto py-3 px-2 rounded-full text-[12px] sm:text-sm font-semibold transition-all disabled:opacity-60 min-h-[44px] truncate"
              style={{ background: "var(--gradient-brand)", color: "white" }}
            >
              {creditLoading === "trial" ? "Abrindo checkout..." : "⚡ Testar por R$ 19,90"}
            </button>
          </div>
        </div>
      )}

      {/* Credits */}
      <h3 className="text-lg font-bold mb-4">Créditos avulsos</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {extras.map((extra) => (
          <button key={extra.label}
            onClick={() => handleCreditCheckout(extra.packageId)}
            disabled={creditLoading === extra.packageId}
            className="p-4 rounded-xl text-left transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-60 min-h-[72px]"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold">{extra.label}</p>
            <p className="text-lg font-black gradient-text mt-1">{extra.price}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
              {creditLoading === extra.packageId ? "Abrindo checkout..." : "Comprar agora"}
            </p>
          </button>
        ))}
      </div>

      {/* Security Badge — Mercado Pago */}
      <div className="mt-12 mb-8 flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-all duration-300">
        <div className="flex items-center gap-1.5 mb-3">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success, #22c55e)" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Pagamento 100% Seguro
          </span>
        </div>
        <div className="flex items-center gap-2.5 mb-2">
          {/* MP Handshake Icon — official style */}
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mercado Pago">
            <circle cx="24" cy="24" r="24" fill="#00AAFF"/>
            <path d="M13 27.5c0 0 1.5-1 3-1s2.5.8 3.5.8c1.2 0 2-.5 2-.5l5.5-5c.8-.7 2-.6 2.7.2.6.7.5 1.8-.2 2.4l-3 2.6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M35 27.5c0 0-1.5-1-3-1s-2.5.8-3.5.8c-1.2 0-2-.5-2-.5l-5.5-5c-.8-.7-2-.6-2.7.2-.6.7-.5 1.8.2 2.4l3 2.6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M21 27c1 .8 2.2 1.2 3 1.2s2-.4 3-1.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            <path d="M10 28.5c0-.8.7-1.5 1.5-1.5h2c.4 0 .5.3.5.7v4.3c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-3.5z" fill="white" opacity="0.9"/>
            <path d="M38 28.5c0-.8-.7-1.5-1.5-1.5h-2c-.4 0-.5.3-.5.7v4.3c0 .6.4 1 1 1h2c.6 0 1-.4 1-1v-3.5z" fill="white" opacity="0.9"/>
          </svg>
          {/* Mercado Pago wordmark */}
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Checkout oficial</span>
            <span className="text-lg font-black tracking-tight" style={{ color: '#00AAFF' }}>
              mercado<span className="font-black">pago</span>
            </span>
          </div>
        </div>
        {/* Payment methods */}
        <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          <span>PIX</span>
          <span className="w-0.5 h-0.5 rounded-full" style={{ background: "var(--muted)" }} />
          <span>Cartão</span>
          <span className="w-0.5 h-0.5 rounded-full" style={{ background: "var(--muted)" }} />
          <span>Boleto</span>
        </div>
      </div>
    </div>
  );
}
