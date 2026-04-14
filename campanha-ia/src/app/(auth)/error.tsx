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
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "2rem" }}>⚠️</p>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
        Algo deu errado
      </h2>
      <p style={{ color: "#888", maxWidth: 360 }}>
        {error.message || "Ocorreu um erro inesperado. Tente novamente."}
      </p>
      {error.digest && (
        <p style={{ color: "#555", fontSize: "0.75rem" }}>
          Código: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1.5rem",
          borderRadius: "0.5rem",
          background: "#7c3aed",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
