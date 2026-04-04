"use client";

import Link from "next/link";
import { useState } from "react";

export default function Cadastro() {
  const [step, setStep] = useState<"form" | "loading" | "done">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setStep("loading");
    setTimeout(() => setStep("done"), 2000);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--gradient-hero)" }}>
      {/* Left — Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
        style={{ background: "var(--gradient-brand)" }}>
        <div className="text-center text-white p-12 relative z-10">
          <h2 className="text-4xl font-bold mb-4">3 campanhas<br/>grátis pra testar</h2>
          <p className="text-lg opacity-80 mb-8">Sem cartão. Sem compromisso.</p>
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {[
              "✅ Upload da foto → campanha em 60s",
              "✅ Textos para Instagram, Stories e WhatsApp",
              "✅ Score de qualidade com melhorias",
              "✅ Modelo virtual IA (planos pagos)",
            ].map((item, i) => (
              <p key={i} className="text-sm opacity-90">{item}</p>
            ))}
          </div>
        </div>
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: "white" }} />
        <div className="absolute -bottom-48 -right-24 w-[500px] h-[500px] rounded-full opacity-10" style={{ background: "white" }} />
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-brand)", color: "white" }}>✨</div>
            <span className="text-xl font-bold">Campanha <span className="gradient-text">IA</span></span>
          </Link>

          {step === "form" && (
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold mb-2">Criar conta</h1>
              <p className="mb-8" style={{ color: "var(--muted)" }}>
                Comece grátis com 3 campanhas por mês
              </p>

              {/* Social */}
              <button className="w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-3 mb-6 transition-all hover:-translate-y-0.5"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continuar com Google
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span className="text-xs" style={{ color: "var(--muted)" }}>ou com email</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Nome</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome ou nome da loja" required
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--brand-300)]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com" required
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--brand-300)]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Senha</label>
                  <input type="password" placeholder="Mínimo 8 caracteres" required minLength={8}
                    className="w-full h-12 px-4 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--brand-300)]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <button type="submit" className="btn-primary w-full !py-3.5">
                  Criar conta grátis
                </button>
              </form>

              <p className="text-xs text-center mt-4" style={{ color: "var(--muted)" }}>
                Ao criar conta você aceita os{" "}
                <Link href="/termos" className="underline">Termos</Link> e{" "}
                <Link href="/privacidade" className="underline">Privacidade</Link>
              </p>
              <p className="text-center text-sm mt-6" style={{ color: "var(--muted)" }}>
                Já tem conta?{" "}
                <Link href="/login" className="font-semibold gradient-text">Entrar</Link>
              </p>
            </div>
          )}

          {step === "loading" && (
            <div className="animate-fade-in text-center py-16">
              <div className="w-12 h-12 border-3 border-[var(--brand-200)] border-t-[var(--brand-500)] rounded-full animate-spin mx-auto mb-6" />
              <p className="font-semibold">Criando sua conta...</p>
            </div>
          )}

          {step === "done" && (
            <div className="animate-fade-in-up text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">Conta criada!</h2>
              <p className="mb-6" style={{ color: "var(--muted)" }}>Vamos configurar sua loja</p>
              <Link href="/onboarding" className="btn-primary inline-flex !py-3.5 !px-8">
                Configurar loja →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
