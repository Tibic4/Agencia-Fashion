import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeBR, formatTimeBR } from "@/lib/admin/format";
import { StuckCampaignsSection } from "./StuckCampaigns";
import { requireAdmin } from "@/lib/admin/guard";
import { redirect } from "next/navigation";

async function getLogs() {
  const admin = await requireAdmin();
  if (!admin.isAdmin) redirect("/gerar");

  const supabase = createAdminClient();

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const [
    { data: failedCampaigns },
    { data: stuckCampaigns },
    { data: recentCosts },
    { data: allCampaigns24h },
    { data: allCampaigns7d },
  ] = await Promise.all([
    supabase.from("campaigns")
      .select("id, status, error_message, created_at, store_id, duration_ms, stores(name)")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(50),
    // Campanhas presas em processing > 5 minutos
    supabase.from("campaigns")
      .select("id, status, created_at, store_id, stores(name)")
      .eq("status", "processing")
      .lt("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("api_cost_logs")
      .select("provider, model_used, action, cost_brl, tokens_used, created_at, campaign_id")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("campaigns")
      .select("id, status, duration_ms")
      .gte("created_at", last24h),
    supabase.from("campaigns")
      .select("id, status, duration_ms")
      .gte("created_at", last7d),
  ]);

  // SLA metrics (últimas 24h)
  const total24h = allCampaigns24h?.length || 0;
  const success24h = allCampaigns24h?.filter((c) => c.status === "completed").length || 0;
  const failed24h = allCampaigns24h?.filter((c) => c.status === "failed").length || 0;
  const processing24h = allCampaigns24h?.filter((c) => c.status === "processing").length || 0;
  const sla24h = total24h > 0 ? ((success24h / total24h) * 100) : 100;

  // 7d metrics
  const total7d = allCampaigns7d?.length || 0;
  const success7d = allCampaigns7d?.filter((c) => c.status === "completed").length || 0;
  const sla7d = total7d > 0 ? ((success7d / total7d) * 100) : 100;

  // Avg generation time
  const completedWithTime = allCampaigns24h?.filter((c) => c.status === "completed" && c.duration_ms) || [];
  const avgDuration = completedWithTime.length > 0
    ? completedWithTime.reduce((s, c) => s + (c.duration_ms || 0), 0) / completedWithTime.length
    : 0;

  // Errors by type
  const errorTypes: Record<string, number> = {};
  (failedCampaigns ?? []).forEach((c) => {
    const msg = (c.error_message as string) || "Erro desconhecido";
    const type = msg.includes("JSON") ? "JSON inválido"
      : msg.includes("timeout") || msg.includes("Timeout") ? "Timeout"
      : msg.includes("429") || msg.includes("rate") ? "Rate limit"
      : msg.includes("500") || msg.includes("503") ? "API indisponível"
      : msg.includes("ANTHROPIC") || msg.includes("anthropic") ? "Anthropic error"
      : "Outro";
    errorTypes[type] = (errorTypes[type] || 0) + 1;
  });

  // Filter out legacy providers from recent API logs
  const LEGACY_PROVIDERS = ["fashnai", "fashn.ai", "fashn", "fal", "stability", "openai", "anthropic"];
  const filteredCosts = (recentCosts ?? []).filter(
    (row) => !LEGACY_PROVIDERS.includes((String(row.provider) || "").toLowerCase())
  );

  return {
    failedCampaigns: failedCampaigns ?? [],
    stuckCampaigns: stuckCampaigns ?? [],
    recentCosts: filteredCosts,
    stats: {
      total24h, success24h, failed24h, processing24h, sla24h,
      total7d, success7d, sla7d,
      avgDuration,
      errorTypes,
    },
  };
}

/** Map raw action names to human-readable v6 step labels */
function stepLabel(action: string): string {
  const map: Record<string, { icon: string; label: string }> = {
    gemini_analyzer: { icon: "🔍", label: "Análise da peça (Gemini 3.1 Pro)" },
    gemini_vto_v5: { icon: "👗", label: "Virtual Try-On v5 (Gemini Pro Image)" },
    gemini_vto_v6: { icon: "👗", label: "Virtual Try-On v6 (Gemini 3 Pro Image)" },
    image_generation_v3: { icon: "👗", label: "Virtual Try-On (Gemini Pro Image)" },
    model_preview: { icon: "🖼️", label: "Preview de modelo (Flash Image)" },
    preview_model: { icon: "🖼️", label: "Preview de modelo (Flash Image)" },
    smart_tips: { icon: "✍️", label: "Copywriter Pro (Gemini 3.1 Pro)" },
    pipeline_error: { icon: "❌", label: "Erro no Pipeline" },
    sonnet_analyzer: { icon: "🧠", label: "Análise (Sonnet — legacy)" },
  };
  const entry = map[action];
  return entry ? `${entry.icon} ${entry.label}` : action;
}

const slaColor = (pct: number) => {
  if (pct >= 99) return "text-emerald-400";
  if (pct >= 95) return "text-amber-400";
  return "text-red-400";
};

const slaBg = (pct: number) => {
  if (pct >= 99) return "bg-emerald-500";
  if (pct >= 95) return "bg-amber-500";
  return "bg-red-500";
};

export default async function AdminLogs() {
  const { failedCampaigns, stuckCampaigns, recentCosts, stats } = await getLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Logs & Saúde do Sistema</h1>
        <p className="text-gray-400 mt-1">Monitoramento de pipeline, erros e SLA</p>
      </div>

      {/* SLA Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400">SLA 24h</p>
          <p className={`text-2xl font-bold ${slaColor(stats.sla24h)}`}>
            {stats.sla24h.toFixed(1)}%
          </p>
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${slaBg(stats.sla24h)}`} style={{ width: `${stats.sla24h}%` }} />
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400">SLA 7 dias</p>
          <p className={`text-2xl font-bold ${slaColor(stats.sla7d)}`}>
            {stats.sla7d.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">{stats.success7d}/{stats.total7d} ok</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400">✅ Sucesso (24h)</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.success24h}</p>
          <p className="text-xs text-gray-500 mt-1">de {stats.total24h} total</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400">❌ Falhas (24h)</p>
          <p className="text-2xl font-bold text-red-400">{stats.failed24h}</p>
          {stats.processing24h > 0 && (
            <p className="text-xs text-amber-400 mt-1">⏳ {stats.processing24h} processando</p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-400">⏱️ Tempo Médio</p>
          <p className="text-2xl font-bold text-blue-400">
            {stats.avgDuration > 0 ? `${(stats.avgDuration / 1000).toFixed(1)}s` : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">por geração</p>
        </div>
      </div>

      {/* Error Types Breakdown */}
      {Object.keys(stats.errorTypes).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Tipos de Erro</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.errorTypes).sort(([,a],[,b]) => b - a).map(([type, count]) => (
              <div key={type} className="bg-red-950/30 border border-red-500/20 rounded-xl p-3">
                <p className="text-xs text-red-300">{type}</p>
                <p className="text-lg font-bold text-red-400">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⚠️ Stuck campaigns — processing > 5min */}
      <StuckCampaignsSection campaigns={stuckCampaigns as any} />

      {/* Failed campaigns */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-white">Campanhas com erro ({failedCampaigns.length})</h2>
        </div>
        <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
          {failedCampaigns.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">
              ✅ Nenhum erro registrado
            </div>
          ) : (
            failedCampaigns.map((c: Record<string, unknown>) => (
              <div key={c.id as string} className="px-4 md:px-6 py-4 hover:bg-gray-800/30 transition">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {(c.stores as Record<string, string>)?.name || "Loja desconhecida"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      failed
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {formatDateTimeBR(c.created_at as string)}
                  </span>
                </div>
                <pre className="text-[10px] md:text-xs text-red-300/80 bg-red-950/30 rounded-lg p-2 md:p-3 overflow-x-auto font-mono whitespace-pre-wrap break-all">
                  {(c.error_message as string) || "Sem mensagem de erro"}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>

      {/* API call logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-800 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <h2 className="text-sm font-semibold text-white">Chamadas API recentes ({recentCosts.length})</h2>
        </div>

        {recentCosts.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">Nenhuma chamada registrada</div>
        ) : (
          <>
            {/* Mobile: compact rows */}
            <div className="md:hidden divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {recentCosts.map((log: Record<string, unknown>, i: number) => {
                const isError = log.action === "pipeline_error";
                const meta = (log.metadata as Record<string, unknown>) || {};
                return (
                <div key={i} className={`px-4 py-2.5 ${isError ? 'bg-red-950/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white capitalize font-medium">{String(log.provider || "")}</span>
                      <span className={`text-[10px] ${isError ? 'text-red-400' : 'text-gray-500'}`}>{stepLabel(String(log.action || ""))}</span>
                    </div>
                    {isError ? (
                      <span className="text-xs font-semibold text-red-400" title={String(meta.message || '')}>{String(meta.error_code || 'ERROR')}</span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400">R$ {(Number(log.cost_brl) || 0).toFixed(4)}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600">{formatTimeBR(String(log.created_at))}</span>
                </div>
                );
              })}
            </div>

            {/* Desktop: full table */}
            <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Hora</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Provider</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Etapa</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Modelo</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Custo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {recentCosts.map((log: Record<string, unknown>, i: number) => {
                    const isError = log.action === "pipeline_error";
                    const meta = (log.metadata as Record<string, unknown>) || {};
                    return (
                    <tr key={i} className={`transition ${isError ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-gray-800/30'}`}>
                      <td className="px-6 py-2.5 text-gray-400 text-xs font-mono">
                        {formatTimeBR(String(log.created_at))}
                      </td>
                      <td className="px-6 py-2.5 text-white capitalize">{String(log.provider || "")}</td>
                      <td className={`px-6 py-2.5 text-xs ${isError ? 'text-red-400 font-medium' : 'text-gray-400'}`}>{stepLabel(String(log.action || ""))}</td>
                      <td className="px-6 py-2.5 text-gray-400 font-mono text-xs" title={isError ? String(meta.message || '') : ''}>
                        {isError ? String(meta.error_code || 'ERROR') : String(log.model_used || "—")}
                      </td>
                      <td className={`px-6 py-2.5 ${isError ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isError ? '—' : `R$ ${(Number(log.cost_brl) || 0).toFixed(4)}`}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
