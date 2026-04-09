import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateBR } from "@/lib/admin/format";

async function getMetrics() {
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
    supabase.from("credit_purchases").select("*").gte("created_at", monthStart).eq("payment_status", "approved"),
    // Lojas pagantes (não-grátis)
    supabase.from("stores").select("*", { count: "exact", head: true }).not("mercadopago_subscription_id", "is", null),
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
    campaigns: creditPurchases?.filter(p => p.package_type === "campaigns").reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
    models: creditPurchases?.filter(p => p.package_type === "models").reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
    regenerations: creditPurchases?.filter(p => p.package_type === "regenerations").reduce((sum, p) => sum + (p.quantity || 0), 0) || 0,
  };

  return {
    totalStores: totalStores ?? 0,
    activeStores: activeStores ?? 0,
    paidStores: paidStores ?? 0,
    campaignsThisMonth: campaignsThisMonth ?? 0,
    completedThisMonth: completedThisMonth ?? 0,
    failedThisMonth: failedThisMonth ?? 0,
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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

const planColors: Record<string, string> = {
  gratis: "bg-gray-600",
  essencial: "bg-blue-500",
  pro: "bg-fuchsia-500",
  business: "bg-amber-500",
  sem_plano: "bg-gray-700",
};

export default async function AdminDashboard() {
  const m = await getMetrics();
  const successRate = m.campaignsThisMonth > 0
    ? ((m.completedThisMonth / m.campaignsThisMonth) * 100).toFixed(0)
    : "—";
  const totalMrrCredits = m.mrr + m.creditStats.totalRevenue;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Visão geral do CriaLook</p>
      </div>

      {/* KPI Cards — Linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lojas cadastradas" value={m.totalStores} subtitle={`${m.activeStores} ativas · ${m.paidStores} pagantes`} color="text-white" />
        <StatCard label="MRR (Recorrência)" value={`R$ ${m.mrr.toFixed(2)}`} subtitle={`+ R$ ${m.creditStats.totalRevenue.toFixed(2)} em créditos`} color="text-emerald-400" />
        <StatCard label="Campanhas este mês" value={m.campaignsThisMonth} subtitle={`${successRate}% sucesso`} color="text-amber-400" />
        <StatCard label="Custo API (mês)" value={`R$ ${m.apiCostBrl.toFixed(2)}`} subtitle={`Margem: R$ ${(totalMrrCredits - m.apiCostBrl).toFixed(2)}`} color="text-blue-400" />
      </div>

      {/* Vendas por Plano + Créditos Avulsos */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribuição por plano */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">📊 Vendas por Plano</h2>
          </div>
          <div className="p-6 space-y-4">
            {Object.entries(m.planCounts)
              .sort(([,a], [,b]) => b.price - a.price)
              .map(([key, plan]) => {
              const pct = m.totalStores > 0 ? (plan.count / m.totalStores) * 100 : 0;
              const barColor = planColors[key] || "bg-gray-500";
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{plan.display}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-white">{plan.count}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {plan.price > 0 ? `R$ ${(plan.count * plan.price).toFixed(0)}/mês` : "free"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{pct.toFixed(1)}% dos usuários</p>
                </div>
              );
            })}
            <div className="border-t border-gray-800 pt-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">MRR Total</span>
                <span className="text-lg font-bold text-emerald-400">R$ {m.mrr.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Créditos Avulsos */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">💳 Créditos Avulsos (este mês)</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{m.creditStats.totalPurchases}</p>
                <p className="text-xs text-gray-400 mt-1">Compras realizadas</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">R$ {m.creditStats.totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">Receita avulsa</p>
              </div>
            </div>

            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📝</span>
                  <span className="text-sm text-gray-300">Campanhas extras</span>
                </div>
                <span className="text-sm font-bold text-amber-400">+{m.creditStats.campaigns}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧍</span>
                  <span className="text-sm text-gray-300">Modelos extras</span>
                </div>
                <span className="text-sm font-bold text-fuchsia-400">+{m.creditStats.models}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <span className="text-sm text-gray-300">Regenerações extras</span>
                </div>
                <span className="text-sm font-bold text-blue-400">+{m.creditStats.regenerations}</span>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Receita total do mês</span>
                <span className="text-lg font-bold text-white">R$ {(m.mrr + m.creditStats.totalRevenue).toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">MRR R$ {m.mrr.toFixed(2)} + Avulsos R$ {m.creditStats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards 2 — Falhas e Rate */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Taxa de conversão" value={m.totalStores > 0 ? `${((m.paidStores / m.totalStores) * 100).toFixed(1)}%` : "0%"} subtitle="free → pago" color="text-fuchsia-400" />
        <StatCard label="Ticket médio" value={m.paidStores > 0 ? `R$ ${(m.mrr / m.paidStores).toFixed(2)}` : "—"} subtitle="por loja pagante" color="text-amber-400" />
        <StatCard label="Campanhas/loja" value={m.activeStores > 0 ? (m.campaignsThisMonth / m.activeStores).toFixed(1) : "0"} subtitle="média este mês" color="text-blue-400" />
        <StatCard label="Falhas" value={m.failedThisMonth} subtitle="este mês" color={m.failedThisMonth > 0 ? "text-red-400" : "text-gray-500"} />
      </div>

      {/* Two columns — Recent activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Campanhas recentes</h2>
            <a href="/admin/campanhas" className="text-xs text-amber-400 hover:text-amber-300 py-1 px-2 min-h-[44px] flex items-center">Ver todas →</a>
          </div>
          <div className="divide-y divide-gray-800">
            {m.recentCampaigns.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                Nenhuma campanha ainda
              </div>
            ) : (
              m.recentCampaigns.map((campaign: Record<string, unknown>) => (
                <div key={campaign.id as string} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-800/30 transition min-h-[52px]">
                  <div>
                    <p className="text-sm text-white">{(campaign.stores as Record<string, string>)?.name || "—"}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateBR(campaign.created_at as string)} · R$ {Number(campaign.price).toFixed(2)}
                    </p>
                  </div>
                  <StatusBadge status={campaign.status as string} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Stores */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Novos clientes</h2>
            <a href="/admin/clientes" className="text-xs text-amber-400 hover:text-amber-300 py-1 px-2 min-h-[44px] flex items-center">Ver todos →</a>
          </div>
          <div className="divide-y divide-gray-800">
            {m.recentStores.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                Nenhum cliente ainda
              </div>
            ) : (
              m.recentStores.map((store: Record<string, unknown>) => (
                <div key={store.id as string} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-800/30 transition min-h-[52px]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                      {(store.name as string)?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white">{store.name as string}</p>
                      <p className="text-xs text-gray-500">{store.segment_primary as string} · {(store.plans as Record<string, string>)?.display_name || "Sem plano"}</p>
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${store.onboarding_completed ? "bg-emerald-400" : "bg-yellow-400"}`} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
