import { createAdminClient } from "@/lib/supabase/admin";

async function getLogs() {
  const supabase = createAdminClient();

  const [{ data: failedCampaigns }, { data: recentCosts }] = await Promise.all([
    supabase.from("campaigns")
      .select("id, status, error_message, created_at, store_id, stores(name)")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("api_cost_logs")
      .select("provider, model, cost_brl, tokens_used, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    failedCampaigns: failedCampaigns ?? [],
    recentCosts: recentCosts ?? [],
  };
}

export default async function AdminLogs() {
  const { failedCampaigns, recentCosts } = await getLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Logs</h1>
        <p className="text-gray-400 mt-1">Erros e chamadas API para debug</p>
      </div>

      {/* Failed campaigns */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <h2 className="text-sm font-semibold text-white">Campanhas com erro ({failedCampaigns.length})</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {failedCampaigns.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">
              ✅ Nenhum erro registrado
            </div>
          ) : (
            failedCampaigns.map((c: Record<string, unknown>) => (
              <div key={c.id as string} className="px-6 py-4 hover:bg-gray-800/30 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {(c.stores as Record<string, string>)?.name || "Loja desconhecida"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      failed
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(c.created_at as string).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <pre className="text-xs text-red-300/80 bg-red-950/30 rounded-lg p-3 overflow-x-auto font-mono">
                  {(c.error_message as string) || "Sem mensagem de erro"}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>

      {/* API call logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <h2 className="text-sm font-semibold text-white">Chamadas API recentes ({recentCosts.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Hora</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Modelo</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Tokens</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentCosts.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Nenhuma chamada registrada</td></tr>
              ) : (
                recentCosts.map((log, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition">
                    <td className="px-6 py-2.5 text-gray-400 text-xs font-mono">
                      {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-6 py-2.5 text-white capitalize">{log.provider}</td>
                    <td className="px-6 py-2.5 text-gray-400 font-mono text-xs">{log.model || "—"}</td>
                    <td className="px-6 py-2.5 text-gray-400">{log.tokens_used?.toLocaleString("pt-BR") || "—"}</td>
                    <td className="px-6 py-2.5 text-emerald-400">R$ {(log.cost_brl || 0).toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
