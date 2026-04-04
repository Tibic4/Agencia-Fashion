import { createAdminClient } from "@/lib/supabase/admin";

async function getCosts() {
  const supabase = createAdminClient();

  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59).toISOString();

  const [{ data: thisMonthCosts }, { data: lastMonthCosts }] = await Promise.all([
    supabase.from("api_cost_logs").select("provider, model, cost_brl, tokens_used, created_at").gte("created_at", thisMonth).order("created_at", { ascending: false }),
    supabase.from("api_cost_logs").select("provider, cost_brl").gte("created_at", lastMonth).lte("created_at", lastMonthEnd),
  ]);

  // Group by provider
  const byProvider: Record<string, { calls: number; cost: number; tokens: number }> = {};
  (thisMonthCosts ?? []).forEach((row) => {
    const p = row.provider || "unknown";
    if (!byProvider[p]) byProvider[p] = { calls: 0, cost: 0, tokens: 0 };
    byProvider[p].calls++;
    byProvider[p].cost += row.cost_brl || 0;
    byProvider[p].tokens += row.tokens_used || 0;
  });

  const totalThisMonth = (thisMonthCosts ?? []).reduce((s, r) => s + (r.cost_brl || 0), 0);
  const totalLastMonth = (lastMonthCosts ?? []).reduce((s, r) => s + (r.cost_brl || 0), 0);

  return {
    byProvider,
    totalThisMonth,
    totalLastMonth,
    logs: thisMonthCosts ?? [],
  };
}

const providerColors: Record<string, string> = {
  anthropic: "from-violet-500 to-purple-500",
  fashn: "from-pink-500 to-rose-500",
  stability: "from-blue-500 to-cyan-500",
  unknown: "from-gray-500 to-gray-600",
};

export default async function AdminCustos() {
  const { byProvider, totalThisMonth, totalLastMonth, logs } = await getCosts();
  const diff = totalLastMonth > 0 ? (((totalThisMonth - totalLastMonth) / totalLastMonth) * 100).toFixed(0) : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Custos API</h1>
        <p className="text-gray-400 mt-1">Controle de gastos com APIs externas</p>
      </div>

      {/* Total card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-gray-400">Total este mês</p>
            <p className="text-4xl font-bold text-emerald-400 mt-1">R$ {totalThisMonth.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Mês anterior</p>
            <p className="text-lg font-semibold text-gray-300">R$ {totalLastMonth.toFixed(2)}</p>
            {diff !== "—" && (
              <p className={`text-xs ${Number(diff) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {Number(diff) > 0 ? "↑" : "↓"} {Math.abs(Number(diff))}%
              </p>
            )}
          </div>
        </div>
      </div>

      {/* By Provider */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(byProvider).map(([provider, data]) => (
          <div key={provider} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${providerColors[provider] || providerColors.unknown} text-white text-xs font-bold`}>
                {provider.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white capitalize">{provider}</p>
                <p className="text-xs text-gray-500">{data.calls} chamadas</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">R$ {data.cost.toFixed(2)}</p>
            {data.tokens > 0 && (
              <p className="text-xs text-gray-500 mt-1">{data.tokens.toLocaleString("pt-BR")} tokens</p>
            )}
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${providerColors[provider] || providerColors.unknown}`}
                style={{ width: `${totalThisMonth > 0 ? (data.cost / totalThisMonth * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
        {Object.keys(byProvider).length === 0 && (
          <div className="col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
            Nenhum custo registrado este mês
          </div>
        )}
      </div>

      {/* Recent logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Últimas chamadas API</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Modelo</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Tokens</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Custo</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.slice(0, 20).map((log, i) => (
                <tr key={i} className="hover:bg-gray-800/30 transition">
                  <td className="px-6 py-2.5 text-white capitalize">{log.provider}</td>
                  <td className="px-6 py-2.5 text-gray-400 font-mono text-xs">{log.model || "—"}</td>
                  <td className="px-6 py-2.5 text-gray-400">{log.tokens_used?.toLocaleString("pt-BR") || "—"}</td>
                  <td className="px-6 py-2.5 text-emerald-400 font-medium">R$ {(log.cost_brl || 0).toFixed(4)}</td>
                  <td className="px-6 py-2.5 text-gray-500 text-xs">{new Date(log.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Nenhum log ainda</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
