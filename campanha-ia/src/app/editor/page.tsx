"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const InstagramEditor = dynamic(
  () => import("@/components/InstagramEditor"),
  { ssr: false }
);

export default function StandaloneEditorPage() {
  const [status, setStatus] = useState<"loading" | "login" | "authed">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if already authenticated (cookie will be sent automatically)
  useEffect(() => {
    fetch("/api/editor-auth/check")
      .then((r) => {
        if (r.ok) setStatus("authed");
        else setStatus("login");
      })
      .catch(() => setStatus("login"));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/editor-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus("authed");
      } else {
        const data = await res.json();
        setError(data.error || "Senha incorreta.");
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading ────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ─── Login ──────────────────────────────────────────────
  if (status === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white text-sm font-black shadow-[0_0_20px_rgba(217,70,239,0.3)]">
                A
              </div>
              <span className="text-xl font-bold tracking-tight">
                Cria<span className="text-fuchsia-400">Look</span>
              </span>
            </div>
            <p className="text-sm text-[#71717A] mt-3">Editor de Post</p>
          </div>

          {/* Password input */}
          <div className="space-y-2">
            <label
              htmlFor="editor-password"
              className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider"
            >
              Senha de acesso
            </label>
            <input
              id="editor-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-fuchsia-500/50 transition placeholder:text-[#52525B]"
            />
            {error && (
              <p className="text-xs text-red-400 animate-fade-in">{error}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #D946EF, #8B5CF6)",
            }}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Entrando…
              </span>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>
    );
  }

  // ─── Editor ──────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-[#FAFAFA] tracking-tight">
            Editor de Post
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-0.5">
            Monte posts prontos para Instagram — feed 4:5 ou stories 9:16
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white text-[10px] font-black">
            A
          </div>
          <span className="hidden sm:inline text-sm font-bold tracking-tight">
            Cria<span className="text-fuchsia-400">Look</span>
          </span>
        </div>
      </div>

      {/* Editor */}
      <InstagramEditor />
    </div>
  );
}
