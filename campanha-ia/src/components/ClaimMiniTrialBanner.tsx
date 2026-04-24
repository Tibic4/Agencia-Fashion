"use client";
import { useEffect, useState } from "react";

interface Status {
  enabled: boolean;
  total_slots: number;
  total_used: number;
  remaining: number;
  eligible: boolean | null;
  already_used: boolean;
}

interface ClaimResponse {
  granted: boolean;
  reason?: string;
  remaining?: number;
}

/**
 * Banner em /gerar que permite reivindicar 1 campanha grátis (Beta).
 * Aparece se: usuário autenticado + ainda não usou + vagas restantes.
 * Após reivindicar com sucesso:
 *   1. Mostra confirmação visual ("✅ Crédito liberado!")
 *   2. Faz hard reload pra UI puxar o novo saldo de créditos do servidor
 */
export default function ClaimMiniTrialBanner({ onClaimed }: { onClaimed?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/credits/mini-trial-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: Status) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  const handleClaim = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credits/claim-mini-trial", { method: "POST" });
      const data = (await res.json()) as ClaimResponse;
      if (data.granted) {
        setSuccess(true);
        if (onClaimed) onClaimed();
        // Aguarda 1.2s pra usuário ver o sucesso, então faz hard reload completo
        // (router.refresh sozinho não basta porque /gerar busca créditos via server-side
        // e o ClerkProvider/store data fica em cache na primeira requisição).
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        const reasons: Record<string, string> = {
          already_used: "Você já reivindicou sua vaga grátis 🙂",
          slots_full: "As 50 vagas grátis acabaram. Mas você pode começar com R$ 19,90.",
          killswitch: "Beta encerrado.",
          no_store: "Complete o onboarding primeiro.",
          internal_error: "Erro ao reivindicar. Tenta de novo em alguns minutos.",
        };
        setError(reasons[data.reason ?? ""] ?? "Não foi possível reivindicar agora.");
      }
    } catch {
      setError("Erro de conexão. Tenta de novo.");
    } finally {
      setLoading(false);
    }
  };

  // Mostra mensagem de sucesso enquanto faz reload (1.2s)
  if (success) {
    return (
      <div
        className="rounded-2xl p-4 sm:p-5 mb-4 relative overflow-hidden animate-fade-in"
        style={{
          background: "linear-gradient(135deg, var(--success, #10b981), var(--brand-500))",
          color: "white",
        }}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="shrink-0 text-3xl" aria-hidden="true">✅</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold">
              Crédito liberado!
            </h3>
            <p className="text-xs sm:text-sm opacity-90">
              Sua campanha grátis está pronta. Atualizando a página...
            </p>
          </div>
          <div className="shrink-0">
            <div
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
              role="presentation"
            />
          </div>
        </div>
      </div>
    );
  }

  // Não mostra se beta off, esgotado, ou já usou anteriormente
  if (!status || !status.enabled || !status.eligible) {
    return null;
  }

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 mb-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, var(--brand-50), var(--accent-50))",
        border: "2px solid var(--brand-300)",
      }}
      role="region"
      aria-label="Vaga grátis disponível"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: "var(--brand-500)", color: "white" }}
          aria-hidden="true"
        >
          🎁
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--brand-600)" }}>
            Beta · {status.remaining} de {status.total_slots} vagas restantes
          </p>
          <h3 className="text-base sm:text-lg font-bold mb-1">
            Sua 1ª campanha é por nossa conta 🎁
          </h3>
          <p className="text-xs sm:text-sm mb-3" style={{ color: "var(--muted)" }}>
            3 fotos com modelo virtual + legendas prontas. Sem cartão. Sem pegadinha.
          </p>
          <button
            type="button"
            onClick={handleClaim}
            disabled={loading}
            className="btn-primary text-sm !py-2.5 !px-5"
          >
            {loading ? "Reivindicando..." : "Pegar minha vaga grátis →"}
          </button>
          {error && (
            <p className="text-xs mt-2" style={{ color: "var(--error, #dc2626)" }} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

