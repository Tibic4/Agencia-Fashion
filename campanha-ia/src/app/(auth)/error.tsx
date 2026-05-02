"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AuthError]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-3xl">⚠️</p>
      <h2 className="text-xl font-semibold">
        Algo deu errado
      </h2>
      <p className="max-w-sm text-muted-foreground">
        {error.message || "Ocorreu um erro inesperado. Tente novamente."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Código: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="btn-primary mt-2"
      >
        Tentar novamente
      </button>
    </div>
  );
}
