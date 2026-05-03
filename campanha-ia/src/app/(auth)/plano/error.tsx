"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PlanoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PlanoError]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-3xl">⚠️</p>
      <h2 className="text-xl font-semibold">
        Não consegui carregar seu plano
      </h2>
      <p className="max-w-sm text-muted-foreground">
        Sua assinatura e seus créditos estão protegidos. Foi só esse carregamento que falhou.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Código: {error.digest}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <button
          onClick={reset}
          className="btn-primary min-h-tap"
        >
          Tentar de novo
        </button>
        <Link
          href="/historico"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors min-h-tap"
        >
          Voltar pra Home
        </Link>
      </div>
    </div>
  );
}
