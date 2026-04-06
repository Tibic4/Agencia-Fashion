"use client";

import { useState } from "react";

interface QuotaExceededModalProps {
  used: number;
  limit: number;
  credits: number;
  currentPlan?: string;
  onClose: () => void;
  onUpgrade: () => void;
  onBuyCredits: (type: string, qty: number) => void;
}

const CREDIT_PACKAGES = [
  { qty: 1, price: "7,99", perUnit: "7,99", type: "campaigns" },
  { qty: 5, price: "34,99", perUnit: "7,00", type: "campaigns" },
  { qty: 10, price: "59,99", perUnit: "6,00", type: "campaigns" },
];

const PLAN_UPGRADE = [
  { name: "Starter", price: 79, campaigns: 20 },
  { name: "Pro", price: 179, campaigns: 45 },
  { name: "Business", price: 349, campaigns: 90 },
  { name: "Agência", price: 699, campaigns: 180 },
];

export default function QuotaExceededModal({
  used,
  limit,
  credits,
  currentPlan,
  onClose,
  onUpgrade,
  onBuyCredits,
}: QuotaExceededModalProps) {
  const [tab, setTab] = useState<"upgrade" | "credits">("upgrade");

  // Calcular dias até renovação (próximo dia 1)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Filtrar planos acima do atual
  const currentIndex = PLAN_UPGRADE.findIndex(
    (p) => p.name.toLowerCase() === currentPlan?.toLowerCase()
  );
  const availableUpgrades = PLAN_UPGRADE.filter((_, i) => i > currentIndex);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-gray-800 px-6 py-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">😮</span>
            <div>
              <h2 className="text-lg font-bold text-white">
                Suas {limit} campanhas do mês acabaram!
              </h2>
              <p className="text-sm text-gray-300 mt-0.5">
                Mas calma, você tem opções...
              </p>
            </div>
          </div>
          {/* Usage bar */}
          <div className="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full" style={{ width: "100%" }} />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-gray-400">
            <span>{used}/{limit} campanhas usadas</span>
            <span>📅 Renova em {daysLeft} dias</span>
          </div>
          {credits > 0 && (
            <p className="text-xs text-emerald-400 mt-2">
              💳 Você tem {credits} crédito{credits > 1 ? "s" : ""} avulso{credits > 1 ? "s" : ""} restante{credits > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setTab("upgrade")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === "upgrade"
                ? "text-violet-400 border-b-2 border-violet-400 bg-violet-500/5"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            💡 Fazer Upgrade
          </button>
          <button
            onClick={() => setTab("credits")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === "credits"
                ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            ⚡ Comprar Créditos
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === "upgrade" ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-3">
                Economize por campanha fazendo upgrade:
              </p>
              {availableUpgrades.length > 0 ? (
                availableUpgrades.map((plan) => (
                  <button
                    key={plan.name}
                    onClick={onUpgrade}
                    className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-violet-500/50 rounded-xl px-4 py-3.5 transition group"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition">
                        {plan.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {plan.campaigns} campanhas/mês
                        <span className="text-emerald-400 ml-1">
                          (R$ {(plan.price / plan.campaigns).toFixed(2)}/camp)
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-violet-400">
                        R$ {plan.price}/mês
                      </p>
                      <p className="text-xs text-gray-500">→</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="bg-gray-800 rounded-xl p-4 text-center text-sm text-gray-400">
                  Você já está no plano mais alto! 🏆
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-3">
                Compre campanhas avulsas sem mudar de plano:
              </p>
              {CREDIT_PACKAGES.map((pkg) => (
                <button
                  key={pkg.qty}
                  onClick={() => onBuyCredits(pkg.type, pkg.qty)}
                  className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-emerald-500/50 rounded-xl px-4 py-3.5 transition group"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white group-hover:text-emerald-300 transition">
                      +{pkg.qty} campanhas
                    </p>
                    <p className="text-xs text-gray-400">
                      R$ {pkg.perUnit}/campanha
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      R$ {pkg.price}
                    </p>
                    <p className="text-xs text-gray-500">pagamento único</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-6 py-4 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            📅 Sua cota renova em {daysLeft} dia{daysLeft > 1 ? "s" : ""}
          </p>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
