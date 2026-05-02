import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeBR } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";

async function getCampaigns() {
  const admin = await requireAdmin();
  if (!admin.isAdmin) redirect("/gerar");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, status, price, objective, target_audience, created_at, pipeline_duration_ms, store_id, stores!campaigns_store_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) console.error("Error fetching campaigns:", error);
  return data ?? [];
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

export default async function AdminCampanhas() {
  const campaigns = await getCampaigns();

  const stats = {
    total: campaigns.length,
    completed: campaigns.filter(c => c.status === "completed").length,
    failed: campaigns.filter(c => c.status === "failed").length,
    avgTime: campaigns.filter(c => c.pipeline_duration_ms).reduce((sum, c) => sum + (c.pipeline_duration_ms || 0), 0) / (campaigns.filter(c => c.pipeline_duration_ms).length || 1),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Campanhas</h1>
        <p className="text-gray-400 mt-1">Todas as campanhas geradas na plataforma</p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Concluídas</p>
          <p className="text-xl font-bold text-emerald-400">{stats.completed}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Falhas</p>
          <p className="text-xl font-bold text-red-400">{stats.failed}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Tempo médio</p>
          <p className="text-xl font-bold text-amber-400">{(stats.avgTime / 1000).toFixed(1)}s</p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
          Nenhuma campanha gerada ainda
        </div>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="md:hidden space-y-3">
            {campaigns.map((c: Record<string, unknown>) => (
              <div key={c.id as string} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium text-sm truncate flex-1 mr-2">
                    {(c.stores as Record<string, string>)?.name || "—"}
                  </p>
                  <StatusBadge status={c.status as string} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                  <span>🎯 {c.objective as string || "—"}</span>
                  {Number(c.price) > 0 && <span>💰 R$ {Number(c.price).toFixed(2)}</span>}
                  {Number(c.pipeline_duration_ms) > 0 && <span>⏱ {(Number(c.pipeline_duration_ms) / 1000).toFixed(1)}s</span>}
                </div>
                <p className="text-2xs text-gray-600 mt-2">
                  {formatDateTimeBR(c.created_at as string)}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Loja</th>
                    <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Objetivo</th>
                    <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Público</th>
                    <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Preço</th>
                    <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tempo</th>
                    <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {campaigns.map((c: Record<string, unknown>) => (
                    <tr key={c.id as string} className="hover:bg-gray-800/30 transition">
                      <td className="px-6 py-3 text-white font-medium">{(c.stores as Record<string, string>)?.name || "—"}</td>
                      <td className="px-6 py-3 text-gray-400">{c.objective as string || "—"}</td>
                      <td className="px-6 py-3 text-gray-400">{c.target_audience as string || "—"}</td>
                      <td className="px-6 py-3 text-gray-300">{Number(c.price) > 0 ? `R$ ${Number(c.price).toFixed(2)}` : "—"}</td>
                      <td className="px-6 py-3 text-gray-400">{c.pipeline_duration_ms ? `${(Number(c.pipeline_duration_ms) / 1000).toFixed(1)}s` : "—"}</td>
                      <td className="px-6 py-3"><StatusBadge status={c.status as string} /></td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{formatDateTimeBR(c.created_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
