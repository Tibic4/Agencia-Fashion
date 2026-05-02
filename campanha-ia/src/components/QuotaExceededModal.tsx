"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptics } from "@/lib/utils/haptics";

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
  { qty: 3, price: "24,90", priceNum: 24.90, perUnit: "8,30", perUnitNum: 8.30, type: "campaigns", savings: 0 },
  { qty: 10, price: "69,90", priceNum: 69.90, perUnit: "6,99", perUnitNum: 6.99, type: "campaigns", savings: 16, popular: true },
  { qty: 20, price: "119,90", priceNum: 119.90, perUnit: "6,00", perUnitNum: 6.00, type: "campaigns", savings: 28, best: true },
];

const PLAN_UPGRADE = [
  { name: "Essencial", price: 89, campaigns: 15 },
  { name: "Pro", price: 179, campaigns: 40, recommended: true },
  { name: "Business", price: 379, campaigns: 100 },
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
  const [, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loadingPkg, setLoadingPkg] = useState<number | null>(null);

  // focus trap + restore focus + ESC handler
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    haptics.light();

    // Guarda o elemento focado antes do modal abrir
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Foca no primeiro elemento focável do modal
    requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      firstFocusable?.focus();
    });

    // ESC fecha modal
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
      // Tab trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    // Previne scroll no body enquanto modal aberto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restaura foco
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <AnimatePresence>
      {!closing && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal — Bottom sheet on mobile, centered on desktop */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-modal-title"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full md:max-w-lg md:mx-4 overflow-hidden"
            style={{
              background: "linear-gradient(145deg, var(--surface) 0%, var(--surface-2) 50%, var(--background) 100%)",
              borderRadius: "24px 24px 0 0",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 -8px 60px rgba(217, 70, 239, 0.15), 0 0 0 1px var(--border)",
            }}
          >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "var(--border)" }}
          />
        </div>

        {/* Close button — contraste AA + focus ring */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: "var(--surface-hover)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
          aria-label="Fechar modal de quota"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {/* ═══ Header — Positive framing ═══ */}
        <div className="px-6 pt-5 md:pt-6 pb-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-start gap-3.5 mb-4">
            {/* Animated rocket icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "var(--gradient-brand)",
                boxShadow: "0 4px 20px rgba(217, 70, 239, 0.4)",
                animation: "pulseGlow 2s ease-in-out infinite",
              }}
            >
              <span className="text-xl">🚀</span>
            </div>
            <div>
              <h2 id="quota-modal-title" className="text-lg md:text-xl font-bold leading-tight" style={{ color: "var(--foreground)" }}>
                Continue criando!
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                Desbloqueie mais campanhas para sua loja
              </p>
            </div>
          </div>

          {/* Progress bar visual */}
          <div className="rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                {used} de {limit} campanhas usadas
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--error) 15%, transparent)",
                  color: "var(--error)",
                  border: "1px solid color-mix(in srgb, var(--error) 25%, transparent)",
                }}
              >
                100%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-hover)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${usagePercent}%`,
                  background: "linear-gradient(90deg, var(--warning), var(--error))",
                  transition: "width 0.8s ease-in-out",
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                Renova em {daysLeft} dia{daysLeft > 1 ? "s" : ""}
              </span>
              {credits > 0 && (
                <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
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
        <div className="flex mx-6 mt-4 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
          <button
            onClick={() => { setTab("credits"); haptics.light(); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 min-h-tap"
            style={{
              background: tab === "credits"
                ? "color-mix(in srgb, var(--success) 18%, transparent)"
                : "transparent",
              color: tab === "credits" ? "var(--success)" : "var(--muted)",
              border: tab === "credits" ? "1px solid color-mix(in srgb, var(--success) 25%, transparent)" : "1px solid transparent",
              boxShadow: tab === "credits" ? "0 2px 12px color-mix(in srgb, var(--success) 15%, transparent)" : "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Comprar Créditos
          </button>
          <button
            onClick={() => { setTab("upgrade"); haptics.light(); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 min-h-tap"
            style={{
              background: tab === "upgrade"
                ? "color-mix(in srgb, var(--brand-500) 18%, transparent)"
                : "transparent",
              color: tab === "upgrade" ? "var(--brand-500)" : "var(--muted)",
              border: tab === "upgrade" ? "1px solid color-mix(in srgb, var(--brand-500) 25%, transparent)" : "1px solid transparent",
              boxShadow: tab === "upgrade" ? "0 2px 12px color-mix(in srgb, var(--brand-500) 15%, transparent)" : "none",
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
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
                Compre campanhas avulsas sem mudar de plano:
              </p>

              {/* Credit packages — popular first on rendering */}
              {orderedPackages.map((pkg) => (
                <button
                  key={pkg.qty}
                  onClick={() => { haptics.medium(); handleBuyCredits(pkg.type, pkg.qty); }}
                  disabled={loadingPkg !== null}
                  className="w-full text-left rounded-2xl transition-all group relative overflow-hidden"
                  style={{
                    background: pkg.popular
                      ? "color-mix(in srgb, var(--success) 8%, transparent)"
                      : "var(--surface-2)",
                    border: pkg.popular
                      ? "1.5px solid color-mix(in srgb, var(--success) 30%, transparent)"
                      : pkg.best
                      ? "1.5px solid color-mix(in srgb, var(--brand-500) 25%, transparent)"
                      : "1px solid var(--border)",
                    padding: pkg.popular ? "16px 18px" : "14px 18px",
                    opacity: loadingPkg !== null && loadingPkg !== pkg.qty ? 0.5 : 1,
                    transform: pkg.popular ? "scale(1)" : "scale(1)",
                  }}
                >
                  {/* Badge */}
                  {pkg.popular && (
                    <span
                      className="absolute top-0 right-0 text-2xs font-bold px-3 py-1 rounded-bl-xl"
                      style={{
                        background: "var(--success)",
                        color: "white",
                        letterSpacing: "0.05em",
                      }}
                    >
                      ⭐ POPULAR
                    </span>
                  )}
                  {pkg.best && (
                    <span
                      className="absolute top-0 right-0 text-2xs font-bold px-3 py-1 rounded-bl-xl"
                      style={{
                        background: "var(--gradient-brand)",
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
                            ? "color-mix(in srgb, var(--success) 20%, transparent)"
                            : pkg.best
                            ? "color-mix(in srgb, var(--brand-500) 20%, transparent)"
                            : "var(--surface-hover)",
                          color: pkg.popular ? "var(--success)" : pkg.best ? "var(--brand-500)" : "var(--muted)",
                          border: pkg.popular
                            ? "1px solid color-mix(in srgb, var(--success) 25%, transparent)"
                            : pkg.best
                            ? "1px solid color-mix(in srgb, var(--brand-500) 25%, transparent)"
                            : "1px solid var(--border)",
                        }}
                      >
                        +{pkg.qty}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          {pkg.qty === 1 ? "1 campanha" : `${pkg.qty} campanhas`}
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          R$ {pkg.perUnit}/campanha
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      {/* Savings badge */}
                      {pkg.savings > 0 && (
                        <span
                          className="text-2xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
                          style={{
                            background: "color-mix(in srgb, var(--success) 12%, transparent)",
                            color: "var(--success)",
                            border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
                          }}
                        >
                          -{pkg.savings}%
                        </span>
                      )}
                      <div>
                        <p
                          className="text-base font-bold"
                          style={{
                            color: pkg.popular ? "var(--success)" : pkg.best ? "var(--brand-500)" : "var(--foreground)",
                          }}
                        >
                          R$ {pkg.price}
                        </p>
                        <p className="text-2xs" style={{ color: "var(--muted-foreground)" }}>
                          pagamento único
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CTA button for popular */}
                  {pkg.popular && (
                    <div
                      className="mt-3 py-3 rounded-xl text-center text-sm font-bold transition-all min-h-tap"
                      style={{
                        background: "var(--success)",
                        color: "white",
                        boxShadow: "0 4px 16px color-mix(in srgb, var(--success) 30%, transparent)",
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
                  background: "color-mix(in srgb, var(--brand-500) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--brand-500) 12%, transparent)",
                }}
                onClick={() => { setTab("upgrade"); haptics.light(); }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "color-mix(in srgb, var(--brand-500) 15%, transparent)", color: "var(--brand-500)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6-6 6 6" /><path d="M12 3v14" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--brand-500)" }}>
                    💡 Dica: Faça upgrade e nunca fique sem campanhas
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Planos a partir de R$ 69/mês — pague menos por campanha
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted-foreground)", flexShrink: 0 }}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
                📈 Nunca mais fique sem campanhas:
              </p>

              {availableUpgrades.length > 0 ? (
                availableUpgrades.map((plan) => (
                  <button
                    key={plan.name}
                    onClick={() => { haptics.medium(); onUpgrade(); }}
                    className="w-full text-left rounded-2xl transition-all group relative overflow-hidden"
                    style={{
                      background: plan.recommended
                        ? "color-mix(in srgb, var(--brand-500) 8%, transparent)"
                        : "var(--surface-2)",
                      border: plan.recommended
                        ? "1.5px solid color-mix(in srgb, var(--brand-500) 30%, transparent)"
                        : "1px solid var(--border)",
                      padding: plan.recommended ? "16px 18px" : "14px 18px",
                    }}
                  >
                    {plan.recommended && (
                      <span
                        className="absolute top-0 right-0 text-2xs font-bold px-3 py-1 rounded-bl-xl"
                        style={{
                          background: "var(--gradient-brand)",
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
                              ? "color-mix(in srgb, var(--brand-500) 20%, transparent)"
                              : "var(--surface-hover)",
                            color: plan.recommended ? "var(--brand-500)" : "var(--muted)",
                            border: plan.recommended
                              ? "1px solid color-mix(in srgb, var(--brand-500) 25%, transparent)"
                              : "1px solid var(--border)",
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                            {plan.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            {plan.campaigns} campanhas/mês
                            <span className="ml-1.5" style={{ color: "var(--success)" }}>
                              R$ {(plan.price / plan.campaigns).toFixed(2)}/camp
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className="text-base font-bold"
                          style={{ color: plan.recommended ? "var(--brand-500)" : "var(--foreground)" }}
                        >
                          R$ {plan.price}
                          <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>
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
                          background: "var(--gradient-brand)",
                          color: "white",
                          boxShadow: "0 4px 16px rgba(217, 70, 239, 0.3)",
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
                    background: "color-mix(in srgb, var(--warning) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--warning) 18%, transparent)",
                  }}
                >
                  <span className="text-2xl mb-2 block">🏆</span>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Você já está no plano mais alto!</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Compre créditos avulsos para campanhas extras
                  </p>
                </div>
              )}

              {/* Features list */}
              <div className="mt-2 p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                  INCLUÍDO EM TODOS OS PLANOS:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Virtual Try-On com IA", "4 canais prontos", "Score de qualidade", "Sem marca d'água"].map((f) => (
                    <div key={f} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            0%, 100% { box-shadow: 0 4px 20px rgba(217, 70, 239, 0.4); }
            50% { box-shadow: 0 4px 30px rgba(236, 72, 153, 0.5), 0 0 40px rgba(217, 70, 239, 0.2); }
          }

          @media (min-width: 768px) {
            .relative.w-full {
              border-radius: 24px !important;
              max-height: 85vh;
            }
          }
        `}</style>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
