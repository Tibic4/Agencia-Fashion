"use client";
import { useEffect, useState } from "react";

interface Status {
  enabled: boolean;
  total_slots: number;
  total_used: number;
  remaining: number;
}

/**
 * Badge "X de 50 vagas preenchidas" — aparece se beta ativo.
 * Faz fetch público (não precisa auth) com refresh a cada 60s.
 * Aplica gatilho de loss-aversion (escassez honesta, número real).
 */
export default function BetaTrialBadge({ variant = "hero" }: { variant?: "hero" | "compact" }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/credits/mini-trial-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch {
        /* silencioso */
      }
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Beta desligado ou esgotado: não mostra (não desperdiça atenção)
  if (!status || !status.enabled || status.remaining <= 0) {
    return null;
  }

  const percentFilled = Math.round((status.total_used / status.total_slots) * 100);

  if (variant === "compact") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
        style={{ color: "var(--brand-600)" }}
      >
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: "var(--brand-500)" }}
          />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--brand-500)" }} />
        </span>
        Beta · {status.remaining} de {status.total_slots} vagas grátis
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs font-semibold mb-3"
      style={{
        background: "color-mix(in srgb, var(--brand-500) 12%, transparent)",
        color: "var(--brand-600)",
        border: "1px solid color-mix(in srgb, var(--brand-500) 40%, transparent)",
      }}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ background: "var(--brand-500)" }}
        />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "var(--brand-500)" }} />
      </span>
      <span>
        <strong>Beta gratuito</strong> · {status.total_used} de {status.total_slots} vagas preenchidas
      </span>
      <div className="hidden sm:block w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--brand-500) 20%, transparent)" }} aria-hidden="true">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${percentFilled}%`, background: "var(--brand-500)" }}
        />
      </div>
    </div>
  );
}
