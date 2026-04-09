"use client";

import { useState, useEffect } from "react";

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
  { qty: 5, price: "19,90", priceNum: 19.90, perUnit: "3,98", perUnitNum: 3.98, type: "campaigns", savings: 0 },
  { qty: 15, price: "49,90", priceNum: 49.90, perUnit: "3,33", perUnitNum: 3.33, type: "campaigns", savings: 16, popular: true },
  { qty: 30, price: "89,90", priceNum: 89.90, perUnit: "3,00", perUnitNum: 3.00, type: "campaigns", savings: 25, best: true },
];

const PLAN_UPGRADE = [
  { name: "Essencial", price: 69, campaigns: 15 },
  { name: "Pro", price: 149, campaigns: 50, recommended: true },
  { name: "Business", price: 299, campaigns: 120 },
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
  const [tab, setTab] = useState<"upgrade" | "credits">("credits");
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loadingPkg, setLoadingPkg] = useState<number | null>(null);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Calcular dias até renovação (próximo dia 1)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysLeft = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Filtrar planos acima do atual
  const currentIndex = PLAN_UPGRADE.findIndex(
    (p) => p.name.toLowerCase() === currentPlan?.toLowerCase()
  );
  const availableUpgrades = PLAN_UPGRADE.filter((_, i) => i > currentIndex);

  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 250);
  };

  const handleBuyCredits = (type: string, qty: number) => {
    setLoadingPkg(qty);
    onBuyCredits(type, qty);
  };

  // Reorder for mobile: popular first
  const orderedPackages = [...CREDIT_PACKAGES].sort((a, b) => {
    if (a.popular) return -1;
    if (b.popular) return 1;
    return 0;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.65)",
          opacity: visible && !closing ? 1 : 0,
        }}
        onClick={handleClose}
      />

      {/* Modal — Bottom sheet on mobile, centered on desktop */}
      <div
        className="relative w-full md:max-w-lg md:mx-4 overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #1a1a2e 0%, #16162a 50%, #0f0f23 100%)",
          borderRadius: "24px 24px 0 0",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 -8px 60px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(255,255,255,0.06)",
          transform: visible && !closing
            ? "translateY(0)"
            : "translateY(100%)",
          opacity: visible && !closing ? 1 : 0,
          transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          aria-label="Fechar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {/* ═══ Header — Positive framing ═══ */}
        <div className="px-6 pt-5 md:pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-start gap-3.5 mb-4">
            {/* Animated rocket icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
                boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
                animation: "pulseGlow 2s ease-in-out infinite",
              }}
            >
              <span className="text-xl">🚀</span>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white leading-tight">
                Continue criando!
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Desbloqueie mais campanhas para sua loja
              </p>
            </div>
          </div>

          {/* Progress bar visual */}
          <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-white">
                {used} de {limit} campanhas usadas
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#F87171",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}
              >
                100%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${usagePercent}%`,
                  background: "linear-gradient(90deg, #F59E0B, #EF4444)",
                  transition: "width 0.8s ease-in-out",
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                Renova em {daysLeft} dia{daysLeft > 1 ? "s" : ""}
              </span>
              {credits > 0 && (
                <span className="flex items-center gap-1" style={{ color: "#34D399" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  {credits} crédito{credits > 1 ? "s" : ""} avulso{credits > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Tabs ═══ */}
        <div className="flex mx-6 mt-4 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
          <button
            onClick={() => setTab("credits")}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            style={{
              background: tab === "credits"
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.15))"
                : "transparent",
              color: tab === "credits" ? "#34D399" : "rgba(255,255,255,0.4)",
              border: tab === "credits" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid transparent",
              boxShadow: tab === "credits" ? "0 2px 12px rgba(16, 185, 129, 0.15)" : "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Comprar Créditos
          </button>
          <button
            onClick={() => setTab("upgrade")}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            style={{
              background: tab === "upgrade"
                ? "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.15))"
                : "transparent",
              color: tab === "upgrade" ? "#A78BFA" : "rgba(255,255,255,0.4)",
              border: tab === "upgrade" ? "1px solid rgba(139, 92, 246, 0.25)" : "1px solid transparent",
              boxShadow: tab === "upgrade" ? "0 2px 12px rgba(139, 92, 246, 0.15)" : "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6-6 6 6" /><path d="M12 3v14" /><path d="M6 21h12" />
            </svg>
            Fazer Upgrade
          </button>
        </div>

        {/* ═══ Content ═══ */}
        <div className="p-6 pb-8">
          {tab === "credits" ? (
            <div className="space-y-3">
              <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Compre campanhas avulsas sem mudar de plano:
              </p>

              {/* Credit packages — popular first on rendering */}
              {orderedPackages.map((pkg) => (
                <button
                  key={pkg.qty}
                  onClick={() => handleBuyCredits(pkg.type, pkg.qty)}
                  disabled={loadingPkg !== null}
                  className="w-full text-left rounded-2xl transition-all group relative overflow-hidden"
                  style={{
                    background: pkg.popular
                      ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.06))"
                      : "rgba(255,255,255,0.03)",
                    border: pkg.popular
                      ? "1.5px solid rgba(16, 185, 129, 0.3)"
                      : pkg.best
                      ? "1.5px solid rgba(139, 92, 246, 0.25)"
                      : "1px solid rgba(255,255,255,0.08)",
                    padding: pkg.popular ? "16px 18px" : "14px 18px",
                    opacity: loadingPkg !== null && loadingPkg !== pkg.qty ? 0.5 : 1,
                    transform: pkg.popular ? "scale(1)" : "scale(1)",
                  }}
                >
                  {/* Badge */}
                  {pkg.popular && (
                    <span
                      className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-xl"
                      style={{
                        background: "linear-gradient(135deg, #10B981, #06B6D4)",
                        color: "white",
                        letterSpacing: "0.05em",
                      }}
                    >
                      ⭐ POPULAR
                    </span>
                  )}
                  {pkg.best && (
                    <span
                      className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-xl"
                      style={{
                        background: "linear-gradient(135deg, #8B5CF6, #A855F7)",
                        color: "white",
                        letterSpacing: "0.05em",
                      }}
                    >
                      💎 MELHOR VALOR
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Qty badge */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{
                          background: pkg.popular
                            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))"
                            : pkg.best
                            ? "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.2))"
                            : "rgba(255,255,255,0.06)",
                          color: pkg.popular ? "#34D399" : pkg.best ? "#A78BFA" : "rgba(255,255,255,0.6)",
                          border: pkg.popular
                            ? "1px solid rgba(16, 185, 129, 0.2)"
                            : pkg.best
                            ? "1px solid rgba(139, 92, 246, 0.2)"
                            : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        +{pkg.qty}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {pkg.qty === 1 ? "1 campanha" : `${pkg.qty} campanhas`}
                        </p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          R$ {pkg.perUnit}/campanha
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      {/* Savings badge */}
                      {pkg.savings > 0 && (
                        <span
                          className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
                          style={{
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#34D399",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                          }}
                        >
                          -{pkg.savings}%
                        </span>
                      )}
                      <div>
                        <p
                          className="text-base font-bold"
                          style={{
                            color: pkg.popular ? "#34D399" : pkg.best ? "#A78BFA" : "white",
                          }}
                        >
                          R$ {pkg.price}
                        </p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          pagamento único
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CTA button for popular */}
                  {pkg.popular && (
                    <div
                      className="mt-3 py-3 rounded-xl text-center text-sm font-bold transition-all min-h-[44px]"
                      style={{
                        background: "linear-gradient(135deg, #10B981, #06B6D4)",
                        color: "white",
                        boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      {loadingPkg === pkg.qty ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                          Processando...
                        </span>
                      ) : (
                        "Comprar agora"
                      )}
                    </div>
                  )}
                </button>
              ))}

              {/* Nudge para upgrade */}
              <div
                className="mt-4 p-3.5 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(168, 85, 247, 0.04))",
                  border: "1px solid rgba(139, 92, 246, 0.12)",
                }}
                onClick={() => setTab("upgrade")}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(139, 92, 246, 0.15)", color: "#A78BFA" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6-6 6 6" /><path d="M12 3v14" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "#A78BFA" }}>
                    💡 Dica: Faça upgrade e nunca fique sem campanhas
                  </p>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Planos a partir de R$ 69/mês — pague menos por campanha
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                📈 Nunca mais fique sem campanhas:
              </p>

              {availableUpgrades.length > 0 ? (
                availableUpgrades.map((plan) => (
                  <button
                    key={plan.name}
                    onClick={onUpgrade}
                    className="w-full text-left rounded-2xl transition-all group relative overflow-hidden"
                    style={{
                      background: plan.recommended
                        ? "linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(168, 85, 247, 0.06))"
                        : "rgba(255,255,255,0.03)",
                      border: plan.recommended
                        ? "1.5px solid rgba(139, 92, 246, 0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                      padding: plan.recommended ? "16px 18px" : "14px 18px",
                    }}
                  >
                    {plan.recommended && (
                      <span
                        className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-xl"
                        style={{
                          background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
                          color: "white",
                          letterSpacing: "0.05em",
                        }}
                      >
                        ⭐ RECOMENDADO
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: plan.recommended
                              ? "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.2))"
                              : "rgba(255,255,255,0.06)",
                            color: plan.recommended ? "#A78BFA" : "rgba(255,255,255,0.6)",
                            border: plan.recommended
                              ? "1px solid rgba(139, 92, 246, 0.2)"
                              : "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {plan.name}
                          </p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                            {plan.campaigns} campanhas/mês
                            <span className="ml-1.5" style={{ color: "#34D399" }}>
                              R$ {(plan.price / plan.campaigns).toFixed(2)}/camp
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className="text-base font-bold"
                          style={{ color: plan.recommended ? "#A78BFA" : "white" }}
                        >
                          R$ {plan.price}
                          <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                            /mês
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* CTA button for recommended */}
                    {plan.recommended && (
                      <div
                        className="mt-3 py-2.5 rounded-xl text-center text-sm font-bold transition-all"
                        style={{
                          background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
                          color: "white",
                          boxShadow: "0 4px 16px rgba(139, 92, 246, 0.3)",
                        }}
                      >
                        Assinar Pro
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div
                  className="rounded-2xl p-5 text-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(234, 179, 8, 0.05))",
                    border: "1px solid rgba(245, 158, 11, 0.15)",
                  }}
                >
                  <span className="text-2xl mb-2 block">🏆</span>
                  <p className="text-sm font-semibold text-white">Você já está no plano mais alto!</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Compre créditos avulsos para campanhas extras
                  </p>
                </div>
              )}

              {/* Features list */}
              <div className="mt-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-[11px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  INCLUÍDO EM TODOS OS PLANOS:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Virtual Try-On com IA", "4 canais prontos", "Score de qualidade", "Sem marca d'água"].map((f) => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Safe CSS for animations ═══ */}
        <style jsx>{`
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4); }
            50% { box-shadow: 0 4px 30px rgba(236, 72, 153, 0.5), 0 0 40px rgba(139, 92, 246, 0.2); }
          }

          @media (min-width: 768px) {
            .relative.w-full {
              border-radius: 24px !important;
              max-height: 85vh;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
