"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GerarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GerarError]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-3xl">⚠️</p>
      <h2 className="text-xl font-semibold">
        A IA travou no meio da geração
      </h2>
      <p className="max-w-sm text-muted-foreground">
        Não foi você. Seus créditos estão intactos — nenhum crédito foi descontado dessa tentativa. Quer tentar de novo?
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
          Gerar de novo
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
