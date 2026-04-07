import { createAdminClient } from "@/lib/supabase/admin";

async function getCosts() {
  const supabase = createAdminClient();

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const [{ data: thisMonthCosts }, { data: lastMonthCosts }, { data: budgetSetting }] = await Promise.all([
    supabase.from("api_cost_logs").select("provider, model_used, action, cost_brl, cost_usd, tokens_used, created_at").gte("created_at", thisMonth).order("created_at", { ascending: false }).limit(500),
    supabase.from("api_cost_logs").select("provider, cost_brl").gte("created_at", lastMonth).lte("created_at", lastMonthEnd),
    supabase.from("admin_settings").select("value").eq("key", "api_budget_monthly_brl").single(),
  ]);

  const budget = parseFloat(budgetSetting?.value || process.env.API_BUDGET_MONTHLY_BRL || "2000");

  // Group by provider
  const byProvider: Record<string, { calls: number; cost: number; tokens: number }> = {};
  (thisMonthCosts ?? []).forEach((row) => {
    const p = row.provider || "unknown";
    if (!byProvider[p]) byProvider[p] = { calls: 0, cost: 0, tokens: 0 };
    byProvider[p].calls++;
    byProvider[p].cost += row.cost_brl || 0;
    byProvider[p].tokens += row.tokens_used || 0;
  });

  // Group by pipeline step
  const byStep: Record<string, { calls: number; cost: number }> = {};
  (thisMonthCosts ?? []).forEach((row) => {
    const step = row.action || "unknown";
    if (!byStep[step]) byStep[step] = { calls: 0, cost: 0 };
    byStep[step].calls++;
    byStep[step].cost += row.cost_brl || 0;
  });

  // Daily costs (last 7 days)
  const byDay: Record<string, number> = {};
  (thisMonthCosts ?? []).forEach((row) => {
    const day = new Date(row.created_at).toISOString().split("T")[0];
    byDay[day] = (byDay[day] || 0) + (row.cost_brl || 0);
  });

  const totalThisMonth = (thisMonthCosts ?? []).reduce((s, r) => s + (r.cost_brl || 0), 0);
  const totalLastMonth = (lastMonthCosts ?? []).reduce((s, r) => s + (r.cost_brl || 0), 0);
  
  // Projeção para final do mês
  const dailyAvg = dayOfMonth > 0 ? totalThisMonth / dayOfMonth : 0;
  const projection = dailyAvg * daysInMonth;
  const budgetUsedPct = budget > 0 ? (totalThisMonth / budget) * 100 : 0;
  const projectionPct = budget > 0 ? (projection / budget) * 100 : 0;

  // Alertas (seção 4.5 do doc 05)
  type AlertLevel = "normal" | "warning" | "danger" | "critical";
  let alertLevel: AlertLevel = "normal";
  let alertMessage = "";
  if (budgetUsedPct >= 100) {
    alertLevel = "critical";
    alertMessage = "🚨 BUDGET EXCEDIDO! Custos acima do orçamento mensal.";
  } else if (projectionPct >= 120) {
    alertLevel = "danger";
    alertMessage = "🔴 Projeção indica estouro de budget de 20%+. Revise os custos.";
  } else if (budgetUsedPct >= 80) {
    alertLevel = "warning";
    alertMessage = "⚠️ 80%+ do budget utilizado. Monitore os gastos.";
  }

  // Custo médio por campanha
  const totalCampaignCalls = Object.entries(byStep)
    .filter(([k]) => k === "vision" || k === "strategy" || k === "copywriter")
    .reduce((s, [, v]) => Math.max(s, v.calls), 0);
  const avgCostPerCampaign = totalCampaignCalls > 0 ? totalThisMonth / totalCampaignCalls : 0;

  return {
    byProvider,
    byStep,
    byDay,
    totalThisMonth,
    totalLastMonth,
    budget,
    projection,
    budgetUsedPct,
    projectionPct,
    alertLevel,
    alertMessage,
    avgCostPerCampaign,
    dayOfMonth,
    daysInMonth,
    logs: thisMonthCosts ?? [],
  };
}

const providerColors: Record<string, string> = {
  anthropic: "from-violet-500 to-purple-500",
  google: "from-blue-500 to-indigo-500",
  "fal.ai": "from-orange-500 to-amber-500",
  stability: "from-blue-500 to-cyan-500",
  openai: "from-emerald-500 to-teal-500",
  unknown: "from-gray-500 to-gray-600",
};

const stepLabels: Record<string, string> = {
  vision: "👁️ Vision Analyzer",
  strategy: "🎯 Estrategista",
  copywriter: "✍️ Copywriter",
  refiner: "🔄 Refiner",
  scorer: "📊 Scorer",
  virtual_try_on: "👗 Virtual Try-On",
  edit_image: "✂️ Edit/Refine",
  copywriter_retry: "✍️ Copywriter (retry)",
  background_removal: "🎨 Remoção de Fundo",
};

const alertStyles: Record<string, { bg: string; border: string; text: string }> = {
  normal: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  danger: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" },
  critical: { bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-300" },
};

export default async function AdminCustos() {
  const data = await getCosts();
  const { byProvider, byStep, totalThisMonth, totalLastMonth, budget, projection, budgetUsedPct, projectionPct, alertLevel, alertMessage, avgCostPerCampaign, dayOfMonth, daysInMonth, logs } = data;
  const diffPct = totalLastMonth > 0 ? (((totalThisMonth - totalLastMonth) / totalLastMonth) * 100).toFixed(0) : "—";
  const alert = alertStyles[alertLevel];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Custos API</h1>
        <p className="text-gray-400 mt-1">Controle de gastos com APIs externas • Dia {dayOfMonth}/{daysInMonth}</p>
      </div>

      {/* Alert */}
      {alertMessage && (
        <div className={`${alert.bg} border ${alert.border} rounded-xl p-4`}>
          <p className={`text-sm font-medium ${alert.text}`}>{alertMessage}</p>
        </div>
      )}

      {/* Budget Overview - 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Gasto Atual</p>
          <p className="text-2xl font-bold text-emerald-400">R$ {totalThisMonth.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {diffPct !== "—" && (
              <span className={Number(diffPct) > 0 ? "text-red-400" : "text-emerald-400"}>
                {Number(diffPct) > 0 ? "↑" : "↓"} {Math.abs(Number(diffPct))}% vs mês anterior
              </span>
            )}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Budget Mensal</p>
          <p className="text-2xl font-bold text-white">R$ {budget.toFixed(0)}</p>
          <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetUsedPct >= 100 ? "bg-red-500" : budgetUsedPct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{budgetUsedPct.toFixed(0)}% usado</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Projeção Mensal</p>
          <p className={`text-2xl font-bold ${projectionPct > 100 ? "text-red-400" : "text-blue-400"}`}>
            R$ {projection.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {projectionPct.toFixed(0)}% do budget
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Custo/Campanha</p>
          <p className="text-2xl font-bold text-violet-400">R$ {avgCostPerCampaign.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">média por geração</p>
        </div>
      </div>

      {/* By Provider + By Step */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Provider */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Por Provedor</h2>
          <div className="space-y-3">
            {Object.entries(byProvider).sort(([,a],[,b]) => b.cost - a.cost).map(([provider, d]) => (
              <div key={provider}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br ${providerColors[provider] || providerColors.unknown} text-white text-xs font-bold`}>
                      {provider.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-white capitalize">{provider}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-white">R$ {d.cost.toFixed(2)}</span>
                    <span className="text-xs text-gray-500 ml-1">({d.calls}x)</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${providerColors[provider] || providerColors.unknown}`}
                    style={{ width: `${totalThisMonth > 0 ? (d.cost / totalThisMonth * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(byProvider).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum custo este mês</p>
            )}
          </div>
        </div>

        {/* By Pipeline Step */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Por Etapa do Pipeline</h2>
          <div className="space-y-3">
            {Object.entries(byStep).sort(([,a],[,b]) => b.cost - a.cost).map(([step, d]) => (
              <div key={step} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{stepLabels[step] || step}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-400">R$ {d.cost.toFixed(2)}</span>
                  <span className="text-xs text-gray-500 ml-1">({d.calls}x)</span>
                </div>
              </div>
            ))}
            {Object.keys(byStep).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma etapa registrada</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Últimas chamadas API</h2>
          <span className="text-xs text-gray-500">{logs.length} registros este mês</span>
        </div>

        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">Nenhum log ainda — gere uma campanha para iniciar o tracking</div>
        ) : (
          <>
            {/* Mobile: compact cards */}
            <div className="md:hidden divide-y divide-gray-800">
              {logs.slice(0, 30).map((log: Record<string, unknown>, i: number) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br ${providerColors[String(log.provider || "")] || providerColors.unknown} text-white text-[9px] font-bold`}>
                        {String(log.provider || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-white capitalize font-medium">{String(log.provider || "")}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">R$ {(Number(log.cost_brl) || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>{stepLabels[String(log.action || "")] || String(log.action || "—")}</span>
                    <span>{new Date(String(log.created_at)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Provider</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Etapa</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Modelo</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Custo</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {logs.slice(0, 30).map((log: Record<string, unknown>, i: number) => (
                    <tr key={i} className="hover:bg-gray-800/30 transition">
                      <td className="px-6 py-2.5 text-white capitalize">{String(log.provider || "")}</td>
                      <td className="px-6 py-2.5 text-gray-400 text-xs">{stepLabels[String(log.action || "")] || String(log.action || "—")}</td>
                      <td className="px-6 py-2.5 text-gray-400 font-mono text-xs">{String(log.model_used || "—")}</td>
                      <td className="px-6 py-2.5 text-emerald-400 font-medium">R$ {(Number(log.cost_brl) || 0).toFixed(4)}</td>
                      <td className="px-6 py-2.5 text-gray-500 text-xs">{new Date(String(log.created_at)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
