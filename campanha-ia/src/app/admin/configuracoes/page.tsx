"use client";

import { useState, useEffect, useCallback } from "react";

interface Setting {
  key: string;
  value: string;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  campaigns_per_month: number;
  enable_tryon: boolean;
  is_active: boolean;
}

const settingMeta: Record<string, { label: string; description: string; type: "toggle" | "text" | "number" }> = {
  enable_tryon: { label: "Virtual Try-On (Fashn.ai)", description: "Habilitar/desabilitar o try-on globalmente. Se desabilitado, usa fal.ai como fallback.", type: "toggle" },
  enable_bg_removal: { label: "Remoção de fundo", description: "Habilitar/desabilitar remoção de fundo automática", type: "toggle" },
  maintenance_mode: { label: "Modo manutenção", description: "Bloqueia novas gerações de campanha", type: "toggle" },
  enable_registration: { label: "Abrir cadastros", description: "Permite novos cadastros de lojas", type: "toggle" },
  default_ai_model: { label: "Modelo IA padrão", description: "Modelo Claude usado nas campanhas", type: "text" },
  fashn_default_model: { label: "Modelo Fashn padrão", description: "Modelo de try-on padrão do Fashn.ai", type: "text" },
  monthly_cost_alert_brl: { label: "Alerta de custo mensal (R$)", description: "Valor para alerta de custo API", type: "number" },
  max_image_size_mb: { label: "Tamanho máx. imagem (MB)", description: "Limite em MB para upload", type: "number" },
  default_plan_id: { label: "Plano padrão", description: "ID do plano atribuído a novos usuários", type: "text" },
};

export default function AdminConfiguracoes() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, plansRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/plans"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.data || []);
      }

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.data || []);
      } else {
        // Fallback: fetch plans from settings page itself
      }
    } catch {
      console.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getSettingValue = (key: string): string => {
    return settings.find(s => s.key === key)?.value || "";
  };

  const updateSetting = async (key: string, value: string) => {
    setSaving(key);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      const data = await res.json();

      if (data.success) {
        setSettings(prev =>
          prev.some(s => s.key === key)
            ? prev.map(s => s.key === key ? { ...s, value } : s)
            : [...prev, { key, value }]
        );
        setStatusMsg(`✅ ${settingMeta[key]?.label || key} atualizado!`);
      } else {
        setStatusMsg(`❌ ${data.error}`);
      }
    } catch {
      setStatusMsg("❌ Erro de conexão");
    } finally {
      setSaving(null);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleToggle = (key: string) => {
    const current = getSettingValue(key);
    updateSetting(key, current === "true" ? "false" : "true");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Separate toggles from text settings
  const toggleSettings = Object.entries(settingMeta).filter(([, m]) => m.type === "toggle");
  const textSettings = Object.entries(settingMeta).filter(([, m]) => m.type !== "toggle");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 mt-1">Controles globais da plataforma</p>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white">
          {statusMsg}
        </div>
      )}

      {/* Toggle Controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Funcionalidades</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {toggleSettings.map(([key, meta]) => {
            const isActive = getSettingValue(key) === "true";
            const isSaving = saving === key;
            return (
              <div key={key} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800/30 transition">
                <div>
                  <p className="text-sm font-medium text-white">{meta.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                </div>
                <button
                  onClick={() => handleToggle(key)}
                  disabled={isSaving}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                    isActive ? "bg-emerald-500" : "bg-gray-700"
                  } ${isSaving ? "opacity-50" : ""}`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-300 ${
                    isActive ? "left-7" : "left-0.5"
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Text/Number Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Parâmetros</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {textSettings.map(([key, meta]) => {
            const val = getSettingValue(key);
            return (
              <div key={key} className="px-6 py-4 hover:bg-gray-800/30 transition">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{meta.label}</p>
                    <p className="text-xs text-gray-500">{meta.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type={meta.type === "number" ? "number" : "text"}
                    defaultValue={val}
                    onBlur={(e) => {
                      if (e.target.value !== val) {
                        updateSetting(key, e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const target = e.target as HTMLInputElement;
                        if (target.value !== val) updateSetting(key, target.value);
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-mono bg-gray-800 border border-gray-700 text-gray-200 focus:border-amber-500 focus:outline-none transition"
                    placeholder={`${meta.label}...`}
                  />
                  {saving === key && (
                    <span className="text-xs text-amber-400 self-center animate-pulse">Salvando...</span>
                  )}
                </div>
              </div>
            );
          })}
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
              {plans.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Nenhum plano cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
