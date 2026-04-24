import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 · CriaLook",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--gradient-hero)" }}>
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6 animate-float">👗</div>
        <h1 className="text-6xl font-black mb-4">
          <span className="gradient-text">404</span>
        </h1>
        <h2 className="text-xl font-bold mb-2">Página não encontrada</h2>
        <p className="mb-8" style={{ color: "var(--muted)" }}>
          Parece que essa peça saiu de coleção. Vamos te levar de volta?
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary !py-3 !px-6">
            Ir para o início
          </Link>
          <Link href="/gerar" className="btn-secondary !py-3 !px-6">
            Gerar campanha
          </Link>
        </div>
      </div>
    </div>
  );
}
