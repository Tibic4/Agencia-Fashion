import { createAdminClient } from "@/lib/supabase/admin";

async function getSettings() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("*")
    .order("key");

  if (error) console.error("Error fetching settings:", error);
  return data ?? [];
}

async function getPlans() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("price_monthly");

  if (error) console.error("Error fetching plans:", error);
  return data ?? [];
}

const settingLabels: Record<string, { label: string; description: string }> = {
  max_image_size_mb: { label: "Tamanho máx. de imagem", description: "Limite em MB para upload de produto" },
  default_ai_model: { label: "Modelo IA padrão", description: "Modelo Claude usado nas campanhas" },
  enable_tryon: { label: "Virtual Try-On", description: "Habilitar/desabilitar try-on globalmente" },
  enable_bg_removal: { label: "Remoção de fundo", description: "Habilitar/desabilitar remoção de fundo" },
  maintenance_mode: { label: "Modo manutenção", description: "Bloqueia novas gerações" },
  monthly_cost_alert_brl: { label: "Alerta de custo mensal", description: "Valor em R$ para alerta de custo API" },
  enable_registration: { label: "Abrir cadastros", description: "Permite novos cadastros de lojas" },
  default_plan_id: { label: "Plano padrão", description: "ID do plano atribuído a novos usuários" },
  fashn_default_model: { label: "Modelo Fashn padrão", description: "Modelo de try-on padrão" },
};

export default async function AdminConfiguracoes() {
  const [settings, plans] = await Promise.all([getSettings(), getPlans()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 mt-1">Controles globais da plataforma</p>
      </div>

      {/* Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Configurações gerais</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {settings.map((setting) => {
            const settingValue = typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value);
            const meta = settingLabels[setting.key] || { label: setting.key, description: "" };
            const isBool = settingValue === "true" || settingValue === "false";
            return (
              <div key={setting.key} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800/30 transition">
                <div>
                  <p className="text-sm font-medium text-white">{meta.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                </div>
                <div className="text-right">
                  {isBool ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      settingValue === "true"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {settingValue === "true" ? "Ativo" : "Inativo"}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300 font-mono bg-gray-800 px-3 py-1 rounded-lg">
                      {settingValue}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {settings.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500 text-sm">
              Nenhuma configuração encontrada
            </div>
          )}
        </div>
      </div>

      {/* Plans */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Planos de assinatura</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Plano</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Preço/mês</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Campanhas</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Try-On</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-800/30 transition">
                  <td className="px-6 py-3">
                    <span className="text-white font-medium">{plan.display_name}</span>
                    <span className="text-xs text-gray-500 ml-2 font-mono">({plan.name})</span>
                  </td>
                  <td className="px-6 py-3 text-amber-400 font-semibold">
                    {plan.price_monthly === 0 ? "Grátis" : `R$ ${plan.price_monthly}`}
                  </td>
                  <td className="px-6 py-3 text-gray-300">
                    {plan.campaigns_per_month === -1 ? "∞" : plan.campaigns_per_month}/mês
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs ${plan.enable_tryon ? "text-emerald-400" : "text-gray-500"}`}>
                      {plan.enable_tryon ? "✓ Sim" : "✗ Não"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      plan.is_active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    }`}>
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
