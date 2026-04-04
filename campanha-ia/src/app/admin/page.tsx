import { createAdminClient } from "@/lib/supabase/admin";

async function getMetrics() {
  const supabase = createAdminClient();

  const [
    { count: totalStores },
    { count: activeStores },
    { count: campaignsThisMonth },
    { count: completedThisMonth },
    { count: failedThisMonth },
    { data: costData },
    { data: recentCampaigns },
    { data: recentStores },
  ] = await Promise.all([
    supabase.from("stores").select("*", { count: "exact", head: true }),
    supabase.from("stores").select("*", { count: "exact", head: true }).eq("onboarding_completed", true),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "completed").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("api_cost_logs").select("cost_brl").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("campaigns").select("id, status, created_at, price, store_id, stores!campaigns_store_id_fkey(name)").order("created_at", { ascending: false }).limit(10),
    supabase.from("stores").select("id, name, segment_primary, onboarding_completed, created_at, plans!stores_plan_id_fkey(display_name)").order("created_at", { ascending: false }).limit(5),
  ]);

  const apiCostBrl = costData?.reduce((sum, row) => sum + (row.cost_brl || 0), 0) ?? 0;

  return {
    totalStores: totalStores ?? 0,
    activeStores: activeStores ?? 0,
    campaignsThisMonth: campaignsThisMonth ?? 0,
    completedThisMonth: completedThisMonth ?? 0,
    failedThisMonth: failedThisMonth ?? 0,
    apiCostBrl,
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

export default async function AdminDashboard() {
  const metrics = await getMetrics();
  const successRate = metrics.campaignsThisMonth > 0
    ? ((metrics.completedThisMonth / metrics.campaignsThisMonth) * 100).toFixed(0)
    : "—";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Visão geral do CriaLook</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lojas cadastradas" value={metrics.totalStores} subtitle={`${metrics.activeStores} ativas`} color="text-white" />
        <StatCard label="Campanhas este mês" value={metrics.campaignsThisMonth} subtitle={`${successRate}% sucesso`} color="text-amber-400" />
        <StatCard label="Custo API (mês)" value={`R$ ${metrics.apiCostBrl.toFixed(2)}`} subtitle="Anthropic + Fashn + Stability" color="text-emerald-400" />
        <StatCard label="Falhas" value={metrics.failedThisMonth} subtitle="este mês" color={metrics.failedThisMonth > 0 ? "text-red-400" : "text-gray-500"} />
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Campanhas recentes</h2>
            <a href="/admin/campanhas" className="text-xs text-amber-400 hover:text-amber-300">Ver todas →</a>
          </div>
          <div className="divide-y divide-gray-800">
            {metrics.recentCampaigns.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                Nenhuma campanha ainda
              </div>
            ) : (
              metrics.recentCampaigns.map((campaign: Record<string, unknown>) => (
                <div key={campaign.id as string} className="px-6 py-3 flex items-center justify-between hover:bg-gray-800/30 transition">
                  <div>
                    <p className="text-sm text-white">{(campaign.stores as Record<string, string>)?.name || "—"}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(campaign.created_at as string).toLocaleDateString("pt-BR")} · R$ {Number(campaign.price).toFixed(2)}
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
            <a href="/admin/clientes" className="text-xs text-amber-400 hover:text-amber-300">Ver todos →</a>
          </div>
          <div className="divide-y divide-gray-800">
            {metrics.recentStores.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                Nenhum cliente ainda
              </div>
            ) : (
              metrics.recentStores.map((store: Record<string, unknown>) => (
                <div key={store.id as string} className="px-6 py-3 flex items-center justify-between hover:bg-gray-800/30 transition">
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
