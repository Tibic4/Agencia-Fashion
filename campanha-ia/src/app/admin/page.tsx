import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateBR } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";

async function getMetrics() {
  const admin = await requireAdmin();
  if (!admin.isAdmin) redirect("/gerar");

  const supabase = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { count: totalStores },
    { count: activeStores },
    { count: campaignsThisMonth },
    { count: completedThisMonth },
    { count: failedThisMonth },
    { data: costData },
    { data: recentCampaigns },
    { data: recentStores },
    // ── Métricas de vendas ──
    { data: planDistribution },
    { data: creditPurchases },
    { count: paidStores },
    { count: pipelineErrors, data: pipelineErrorData },
  ] = await Promise.all([
    supabase.from("stores").select("*", { count: "exact", head: true }),
    supabase.from("stores").select("*", { count: "exact", head: true }).eq("onboarding_completed", true),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "completed").gte("created_at", monthStart),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", monthStart),
    supabase.from("api_cost_logs").select("cost_brl").gte("created_at", monthStart),
    supabase.from("campaigns").select("id, status, created_at, price, store_id, stores!campaigns_store_id_fkey(name)").order("created_at", { ascending: false }).limit(10),
    supabase.from("stores").select("id, name, segment_primary, onboarding_completed, created_at, plans!stores_plan_id_fkey(display_name)").order("created_at", { ascending: false }).limit(5),
    // Distribuição por plano
    supabase.from("stores").select("plan_id, plans!stores_plan_id_fkey(name, display_name, price_monthly)"),
    // Compras de créditos do mês
    // FASE 11.29: coluna era "payment_status" (não existe) — o webhook MP só insere
    // em credit_purchases depois que o pagamento foi aprovado, então filtrar pela
    // existência de mercadopago_payment_id já equivale a "approved".
    supabase.from("credit_purchases").select("*").gte("created_at", monthStart).not("mercadopago_payment_id", "is", null),
    // Lojas pagantes (não-grátis)
    supabase.from("stores").select("*", { count: "exact", head: true }).not("mercadopago_subscription_id", "is", null),
    // Erros de pipeline no mês (para KPI)
    supabase.from("api_cost_logs").select("metadata", { count: "exact" }).eq("action", "pipeline_error").gte("created_at", monthStart),
  ]);

  const apiCostBrl = costData?.reduce((sum, row) => sum + (row.cost_brl || 0), 0) ?? 0;

  // Calcular distribuição por plano
  const planCounts: Record<string, { name: string; display: string; count: number; price: number }> = {};
  planDistribution?.forEach((store: Record<string, unknown>) => {
    const plan = store.plans as Record<string, string> | null;
    const planName = plan?.name || "sem_plano";
    const planDisplay = plan?.display_name || "Sem plano";
    const planPrice = parseFloat(plan?.price_monthly || "0");
    if (!planCounts[planName]) {
      planCounts[planName] = { name: planName, display: planDisplay, count: 0, price: planPrice };
    }
    planCounts[planName].count++;
  });

  // MRR (Monthly Recurring Revenue)
  const mrr = Object.values(planCounts).reduce((sum, p) => sum + (p.count * p.price), 0);

  // Créditos vendidos no mês
  const creditStats = {
    totalPurchases: creditPurchases?.length || 0,
    totalRevenue: creditPurchases?.reduce((sum, p) => sum + parseFloat(p.price_brl || "0"), 0) || 0,
    // FASE 11.29: coluna correta é "type", não "package_type"
    campaigns: creditPurchases?.filter(p => p.type === "campaigns").reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
    models: creditPurchases?.filter(p => p.type === "models").reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
    regenerations: creditPurchases?.filter(p => p.type === "regenerations").reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
  };

    // Pipeline error breakdown
    const pipelineErrorCounts: Record<string, number> = {};
    pipelineErrorData?.forEach((row: Record<string, unknown>) => {
      const meta = row.metadata as Record<string, unknown> | null;
      const code = String(meta?.error_code || "UNKNOWN");
      pipelineErrorCounts[code] = (pipelineErrorCounts[code] || 0) + 1;
    });

    return {
    totalStores: totalStores ?? 0,
    activeStores: activeStores ?? 0,
    paidStores: paidStores ?? 0,
    campaignsThisMonth: campaignsThisMonth ?? 0,
    completedThisMonth: completedThisMonth ?? 0,
    failedThisMonth: failedThisMonth ?? 0,
    pipelineErrors: pipelineErrors ?? 0,
    pipelineErrorCounts,
    apiCostBrl,
    mrr,
    planCounts,
    creditStats,
    recentCampaigns: recentCampaigns ?? [],
    recentStores: recentStores ?? [],
  };
}

function StatCard({ label, value, subtitle, color }: { label: string; value: string | number; subtitle?: string; color: string }) {
  return (
    <div className="relative bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 sm:p-6 overflow-hidden group">
      {/* Subtle top glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
      {/* Subtle inner gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <p className="text-[13px] font-medium text-[#A1A1AA] mb-1">{label}</p>
        <p className={`text-xl sm:text-3xl font-black tracking-tight ${color}`}>{value}</p>
        {subtitle && <p className="text-[11px] uppercase tracking-wider text-[#71717A] mt-2 font-medium">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { dot: string; text: string }> = {
    completed: { dot: "bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.5)]", text: "text-[#34D399]" },
    processing: { dot: "bg-[#60A5FA] shadow-[0_0_8px_rgba(96,165,250,0.5)] animate-pulse", text: "text-[#60A5FA]" },
    failed: { dot: "bg-[#F87171] shadow-[0_0_8px_rgba(248,113,113,0.5)]", text: "text-[#F87171]" },
    pending: { dot: "bg-[#FBBF24] shadow-[0_0_8px_rgba(251,191,36,0.5)]", text: "text-[#FBBF24]" },
  };

  const style = styles[status] || styles.pending;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span className={`text-[11px] font-bold uppercase tracking-wider ${style.text}`}>
        {status}
      </span>
    </div>
  );
}

const planGradients: Record<string, string> = {
  gratis: "bg-gradient-to-r from-[#52525B] to-[#3F3F46]", // Zinc
  essencial: "bg-gradient-to-r from-[#60A5FA] to-[#3B82F6]", // Blue
  pro: "bg-gradient-to-r from-[#D946EF] to-[#C026D3]", // Fuchsia
  business: "bg-gradient-to-r from-[#FBBF24] to-[#D97706]", // Premium Gold
  sem_plano: "bg-gradient-to-r from-[#3F3F46] to-[#27272A]", // Darker Zinc
};

export default async function AdminDashboard() {
  const m = await getMetrics();
  const successRate = m.campaignsThisMonth > 0
    ? ((m.completedThisMonth / m.campaignsThisMonth) * 100).toFixed(0)
    : "—";
  const totalMrrCredits = m.mrr + m.creditStats.totalRevenue;

  return (
    <div className="space-y-4 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#FAFAFA] tracking-tight">Dashboard Overview</h1>
        <p className="text-sm font-medium text-[#A1A1AA] mt-1">Métricas e performance do ecossistema CriaLook</p>
      </div>

      {/* KPI Cards — Linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lojas cadastradas" value={m.totalStores} subtitle={`${m.activeStores} ativas · ${m.paidStores} pagantes`} color="text-[#FAFAFA]" />
        <StatCard label="MRR (Recorrência)" value={`R$ ${m.mrr.toFixed(2)}`} subtitle={`+ R$ ${m.creditStats.totalRevenue.toFixed(2)} avulsos`} color="text-[#34D399]" />
        <StatCard label="Campanhas no mês" value={m.campaignsThisMonth} subtitle={`${successRate}% sucesso`} color="text-[#FBBF24]" />
        <StatCard label="Custo API (mês)" value={`R$ ${m.apiCostBrl.toFixed(2)}`} subtitle={`Margem: R$ ${(totalMrrCredits - m.apiCostBrl).toFixed(2)}`} color="text-[#FAFAFA]" />
      </div>

      {/* Vendas por Plano + Créditos Avulsos */}
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Distribuição por plano */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5">
            <h2 className="text-[13px] font-bold text-[#FAFAFA] uppercase tracking-widest">Distribuição por Plano</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 relative z-10">
            {Object.entries(m.planCounts)
              .sort(([,a], [,b]) => b.price - a.price)
              .map(([key, plan]) => {
              const pct = m.totalStores > 0 ? (plan.count / m.totalStores) * 100 : 0;
              const barGradient = planGradients[key] || "bg-gray-500";
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-semibold text-[#E4E4E7]">{plan.display}</span>
                    <div className="text-right flex items-baseline gap-2">
                      <span className="text-sm font-black text-[#FAFAFA]">{plan.count} <span className="text-[10px] font-medium text-[#71717A]">lojas</span></span>
                      <span className="text-[11px] font-medium text-[#A1A1AA] w-16 text-right">
                        {plan.price > 0 ? `R$ ${(plan.count * plan.price).toFixed(0)}` : "free"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden shadow-[inset_0_1px_rgba(0,0,0,0.5)]">
                    <div className={`${barGradient} h-1.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <p className="text-[10px] font-medium text-[#71717A] mt-1.5">{pct.toFixed(1)}% da base ativa</p>
                </div>
              );
            })}
            <div className="border-t border-white/5 pt-4 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider">MRR Fixado</span>
                <span className="text-lg font-black text-[#34D399]">R$ {m.mrr.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Créditos Avulsos */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden relative flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5">
            <h2 className="text-[13px] font-bold text-[#FAFAFA] uppercase tracking-widest">Marketplace de Créditos</h2>
          </div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col relative z-10">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#121212] border border-white/[0.03] shadow-[inset_0_1px_rgba(255,255,255,0.02)] rounded-2xl p-3 sm:p-5 text-center">
                <p className="text-xl sm:text-3xl font-black text-[#FAFAFA]">{m.creditStats.totalPurchases}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] mt-1">Transações</p>
              </div>
              <div className="bg-[#121212] border border-white/[0.03] shadow-[inset_0_1px_rgba(255,255,255,0.02)] rounded-2xl p-3 sm:p-5 text-center">
                <p className="text-xl sm:text-3xl font-black text-[#FBBF24]">R$ {m.creditStats.totalRevenue.toFixed(0)}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] mt-1">Volume R$</p>
              </div>
            </div>

            <div className="space-y-4 mb-6 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/[0.05]">
                    <span className="text-[14px]">📝</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#A1A1AA]">Campanhas Extras</span>
                </div>
                <span className="text-[13px] font-black text-[#FBBF24]">+{m.creditStats.campaigns}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/[0.05]">
                    <span className="text-[14px]">🧍</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#A1A1AA]">Modelos Extras</span>
                </div>
                <span className="text-[13px] font-black text-[#D946EF]">+{m.creditStats.models}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/[0.05]">
                    <span className="text-[14px]">🔄</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#A1A1AA]">Regenerações</span>
                </div>
                <span className="text-[13px] font-black text-[#60A5FA]">+{m.creditStats.regenerations}</span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 mt-auto">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider block">Gross Revenue (Mês)</span>
                  <p className="text-[10px] text-[#71717A] mt-0.5">Assinaturas + Avulsos</p>
                </div>
                <span className="text-xl font-black text-[#FAFAFA]">R$ {(m.mrr + m.creditStats.totalRevenue).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards 2 — Falhas e Rate */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Conversão Funil" value={m.totalStores > 0 ? `${((m.paidStores / m.totalStores) * 100).toFixed(1)}%` : "0%"} subtitle="free → pagante" color="text-[#D946EF]" />
        <StatCard label="ARPU (Ticket Médio)" value={m.paidStores > 0 ? `R$ ${(m.mrr / m.paidStores).toFixed(2)}` : "—"} subtitle="por loja ativa" color="text-[#FBBF24]" />
        <StatCard label="Intensidade de Uso" value={m.activeStores > 0 ? (m.campaignsThisMonth / m.activeStores).toFixed(1) : "0"} subtitle="campanhas/loja (mês)" color="text-[#60A5FA]" />
        <StatCard label="Erros IA" value={m.pipelineErrors + m.failedThisMonth} subtitle={m.pipelineErrors > 0 ? Object.entries(m.pipelineErrorCounts).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'sem erros'} color={m.pipelineErrors + m.failedThisMonth > 0 ? "text-[#F87171]" : "text-[#71717A]"} />
      </div>

      {/* Two columns — Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent Campaigns */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <h2 className="text-[12px] font-bold text-[#FAFAFA] uppercase tracking-widest">Activity Feed</h2>
            <a href="/admin/campanhas" className="text-[11px] font-bold uppercase tracking-wider text-[#FBBF24] hover:text-[#D97706] transition min-h-[44px] flex items-center">Ver Full Log →</a>
          </div>
          <div className="divide-y divide-white/5 border-t-0">
            {m.recentCampaigns.length === 0 ? (
              <div className="px-6 py-16 text-center text-[#71717A] text-[13px] font-medium">
                Nenhum evento registrado.
              </div>
            ) : (
              m.recentCampaigns.map((campaign: Record<string, unknown>) => (
                <div key={campaign.id as string} className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-white/[0.02] transition min-h-[48px] sm:min-h-[56px]">
                  <div>
                    <p className="text-[13px] font-semibold text-[#E4E4E7]">{(campaign.stores as Record<string, string>)?.name || "Store desativada"}</p>
                    <p className="text-[11px] text-[#71717A] font-medium mt-0.5">
                      {formatDateBR(campaign.created_at as string)}
                    </p>
                  </div>
                  <StatusBadge status={campaign.status as string} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Stores */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <h2 className="text-[12px] font-bold text-[#FAFAFA] uppercase tracking-widest">Latest Client Onboards</h2>
            <a href="/admin/clientes" className="text-[11px] font-bold uppercase tracking-wider text-[#FBBF24] hover:text-[#D97706] transition min-h-[44px] flex items-center">Database →</a>
          </div>
          <div className="divide-y divide-white/5 border-t-0">
            {m.recentStores.length === 0 ? (
              <div className="px-6 py-16 text-center text-[#71717A] text-[13px] font-medium">
                Nenhuma conta criada.
              </div>
            ) : (
              m.recentStores.map((store: Record<string, unknown>) => (
                <div key={store.id as string} className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-white/[0.02] transition min-h-[48px] sm:min-h-[56px]">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] flex items-center justify-center text-white text-[13px] font-black shadow-[0_0_12px_rgba(217,70,239,0.3)]">
                      {(store.name as string)?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#FAFAFA]">{store.name as string}</p>
                      <p className="text-[11px] text-[#71717A] font-medium mt-0.5">{store.segment_primary as string} · {(store.plans as Record<string, string>)?.display_name || "Free Tier"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${store.onboarding_completed ? "text-[#34D399] border-[#34D399]/20 bg-[#34D399]/10" : "text-[#FBBF24] border-[#FBBF24]/20 bg-[#FBBF24]/10"}`}>
                      {store.onboarding_completed ? "Active" : "Onboarding"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
