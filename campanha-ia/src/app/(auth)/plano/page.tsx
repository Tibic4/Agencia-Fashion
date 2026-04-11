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
  { id: "essencial", name: "Essencial", badge: "💡", price: 69, campaigns: 15, models: 3, highlight: false },
  { id: "pro", name: "Pro", badge: "🚀", price: 149, campaigns: 50, models: 10, highlight: true },
  { id: "business", name: "Business", badge: "🏢", price: 299, campaigns: 120, models: 25, highlight: false },
];

const extras = [
  { label: "+5 campanhas", price: "R$ 19,90", packageId: "5_campanhas" },
  { label: "+15 campanhas", price: "R$ 49,90", packageId: "15_campanhas" },
  { label: "+30 campanhas", price: "R$ 89,90", packageId: "30_campanhas" },
  { label: "+3 modelos virtuais", price: "R$ 9,90", packageId: "3_modelos" },
  { label: "+5 modelos virtuais", price: "R$ 14,90", packageId: "5_modelos" },
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
              <span className="text-2xl font-black">R$ 9,90</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>único</span>
            </div>
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
              5 campanhas + 1 modelo virtual • Sem mensalidade
            </p>
            <button
              onClick={() => handleCreditCheckout("trial")}
              disabled={creditLoading === "trial"}
              className="w-full max-w-xs mx-auto py-3 px-2 rounded-full text-[12px] sm:text-sm font-semibold transition-all disabled:opacity-60 min-h-[44px] truncate"
              style={{ background: "var(--gradient-brand)", color: "white" }}
            >
              {creditLoading === "trial" ? "Abrindo checkout..." : "⚡ Testar por R$ 9,90"}
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

      {/* Security Badge - Mercado Pago */}
      <div className="mt-12 flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 mb-2">
          {/* Lock Icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success, #22c55e)" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Pagamento 100% Seguro
          </span>
        </div>
        <div className="flex items-center gap-1.5 grayscale opacity-80" aria-label="Processado pelo Mercado Pago">
          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Processado por</span>
          <svg width="60" viewBox="0 0 100 28" fill="currentColor" style={{ color: "var(--muted)" }}>
             <path d="M12.984 6.772v10.957h-3.411V8.472L5.801 13.91 2.052 8.472v9.257H-.016V6.772h2.518l3.3 4.887 3.3-4.887h3.882zM15.42 11.66h5.819v-2.08H15.42v5.82h6.505v2.329h-8.91V6.772h8.777v2.33h-6.372v2.559zM29.585 9.1c.367.067.668.084 1.152.084V6.906c-.634 0-1.285 0-1.785.1-1.353.284-2.187 1.335-2.187 3.305v7.418h-2.32V6.772h2.32v2.571c.651-1.636 1.636-2.52 2.82-2.52.484 0,.985.083 1.402.167v2.454c-.45-.1-.851-.15-1.285-.15-1.352 0-2.086 1.035-2.086 2.504l-.017 5.925h-2.32V9.818c0-1.652.751-2.453 1.836-2.67.434-.083.951-.083 1.485-.083.568 0 .985.033 1.42.084v2.053-.05c-.484 0-.801-.017-1.151-.017h-.568c-.684 0-1.085.35-1.085.952v4.54H25.06V10.23c0-.6.4-.951 1.085-.951h.567c.35 0 .668.016 1.152.016.517 0 .951-.033 1.435-.084v-1.92c-.417-.083-.884-.1-1.368-.1-1.018 0-1.853.684-2.17 1.836h2.17v-1.936c-.467-.067-.935-.084-1.385-.084v-2.186c.634 0 1.285 0 1.785.1 1.352.284 2.186 1.336 2.186 3.305v7.418h-2.32V6.772h2.32v2.57c.651-1.635 1.636-2.52 2.82-2.52.484 0 .985.083 1.402.167v2.454c-.45-.1-.851-.151-1.285-.151ZM41.054 13.91c-1.386 1.586-3.222 2.07-5.041 1.953-2.003-.133-3.805-.985-4.856-2.603-1.069-1.653-1.219-3.923-.418-5.675 1.152-2.504 3.705-3.873 6.493-3.672 2.654.183 4.908 1.936 5.675 4.54.434 1.469.317 3.104-.334 4.524l-2.036-.935c1.085-3.038-.634-6.226-3.672-6.576l-.601-.067c-2.387 0-4.473 1.486-5.074 3.822-.651 2.504.668 5.174 3.071 6.025 2.153.768 4.606.334 6.225-1.152l.534-.484L41.02 13.91h.034ZM46.995 17.582h-2.353L44.625 6.755h1.936l1.319 8.013L51.987 6.772h2.337l-5.664 10.81c-1.118 2.086-1.536 2.87-2.654 3.337ZM64.639 9.383c0-2.637-2.02-4.106-4.573-4.106-2.571 0-4.606 1.486-4.606 4.106 0 2.637 2.053 4.123 4.623 4.123 2.537 0 4.557-1.486 4.557-4.123h-2.437c0 1.218-.952 1.836-2.12 1.836-1.185 0-2.136-.618-2.136-1.836 0-1.218.968-1.836 2.136-1.836s2.136.634 2.136 1.836h2.42ZM69.513 13.56c1.686-.183 3.105-1.502 3.105-3.321 0-1.786-1.435-3.121-3.205-3.121v-4.14h-2.42v14.752h5.457c1.786 0 3.321-1.318 3.321-3.137 0-1.302-.734-2.437-1.802-2.904l2.12-3.155h-2.654l-1.586 2.587h-2.37v-4.606h2.186c.551 0 1.002.384 1.002.935 0 .568-.45.952-1.002.952h-2.153v5.191h2.203c.6 0 1.052.417 1.052 1.001 0 .568-.451.985-1.035.985h-2.22V13.56Zm14.288-4.223h2.387c-1.085-3.104-4.173-4.573-7.51-3.371l-1.486.534-.417.15c-1.82 1.152-2.738 3.69-2.036 5.675.25.718.668 1.352 1.185 1.87 2.053 1.97 5.408 2.02 7.076-.835l.484-.818 2.136 1.101-1.635 2.137c-2.37 3.104-7.51 2.37-9.396-1.051-2.07-3.79-.117-8.38 3.673-9.582l1.936-.618c2.954-.951 7.21.684 8.761 4.807ZM89.176 13.91c-1.385 1.586-3.221 2.07-5.04 1.953-2.003-.133-3.806-.985-4.857-2.603-1.068-1.653-1.218-3.923-.417-5.675 1.152-2.504 3.705-3.873 6.492-3.672 2.654.183 4.907 1.936 5.675 4.54.434 1.469.317 3.104-.334 4.524L88.66 12.04c1.085-3.038-.634-6.226-3.672-6.576l-.601-.067c-2.387 0-4.473 1.486-5.074 3.822-.651 2.504.668 5.174 3.072 6.025 2.153.768 4.606.334 6.225-1.152l.534-.484L89.141 13.91h.034Zm5.792 3.84h-2.42V.692h2.42v17.058Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
