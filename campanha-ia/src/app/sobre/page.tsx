import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";
import { IconCamera, IconZap, IconDownload, IconMail, IconPhone, IconArrowRight, IconHeart, IconTarget } from "@/components/Icons";

/* ═══════════════════════════════════════
   N6: Page metadata for SEO
   ═══════════════════════════════════════ */
export const metadata: Metadata = {
  title: "Sobre — CriaLook | Marketing de Moda com IA",
  description: "Conheça a CriaLook: a plataforma que transforma fotos de roupa em campanhas de marketing completas usando inteligência artificial. Feita para lojistas brasileiros.",
};

const steps = [
  {
    icon: <IconCamera />,
    title: "Tire a foto",
    description: "Fotografe a peça com seu celular. Qualquer fundo serve — a IA resolve.",
  },
  {
    icon: <IconZap />,
    title: "IA trabalha",
    description: "Textos, criativos com modelo virtual, hashtags e score de qualidade — tudo automático.",
  },
  {
    icon: <IconDownload />,
    title: "Publique",
    description: "Copie o texto, baixe a imagem e poste no Instagram, WhatsApp ou Meta Ads.",
  },
];

export default function Sobre() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Nav — Issue #2: added navigation links */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.png" alt="CriaLook" width={52} height={52} className="rounded-full" priority />
            <span className="text-lg font-bold">Cria<span className="gradient-text">Look</span></span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <Link href="/#como-funciona" className="text-sm font-medium" style={{ color: "var(--muted)" }}>Como funciona</Link>
            <Link href="/#precos" className="text-sm font-medium" style={{ color: "var(--muted)" }}>Preços</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="text-sm font-medium min-h-[44px] flex items-center px-3" style={{ color: "var(--muted)" }}>Entrar</Link>
            <ThemeToggle />
            <Link href="/sign-up" className="btn-primary text-sm !py-2.5 !px-3 sm:!py-2.5 sm:!px-5 min-h-[44px] flex items-center">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Testar na prática</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-20">
        <div className="container max-w-3xl">
          {/* Hero */}
          <div className="badge badge-brand mb-4 inline-flex">Sobre nós</div>
          <h1 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            Marketing de moda <span className="gradient-text">simplificado</span>
          </h1>
          <div className="space-y-6 text-base leading-relaxed" style={{ color: "var(--muted)" }}>
            <p>
              <strong style={{ color: "var(--foreground)" }}>CriaLook</strong> nasceu de uma dor real: lojistas de moda 
              brasileiros que precisam postar todo dia mas não têm tempo, dinheiro nem conhecimento para criar 
              campanhas profissionais.
            </p>
            <p>
              Nosso público são os donos de loja de bairro, os empreendedores de Instagram, os vendedores de 
              WhatsApp — gente que vive de moda mas não entende de marketing digital.
            </p>
          </div>

          {/* Missão — card visual */}
          <div className="rounded-2xl p-8 my-10 relative overflow-hidden" style={{ background: "var(--gradient-card)", border: "1px solid var(--border)" }}>
            <div className="absolute top-4 right-4 opacity-10">
              <IconHeart />
            </div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
                <IconTarget />
              </span>
              Nossa missão
            </h2>
            <p className="text-lg italic leading-relaxed" style={{ color: "var(--muted)" }}>
              &ldquo;Democratizar o marketing de moda para que qualquer lojista brasileiro possa competir 
              com as grandes marcas — usando apenas o celular.&rdquo;
            </p>
          </div>

          {/* Como funciona — Issue #5: cards com ícones */}
          <h2 className="text-2xl font-bold mt-12 mb-6" style={{ color: "var(--foreground)" }}>Como funciona</h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "var(--muted)" }}>
            Usando inteligência artificial de ponta, transformamos 
            uma simples foto de produto em campanhas completas para Instagram, WhatsApp e Meta Ads — 
            com textos persuasivos, criativos com modelo virtual e score de qualidade.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-xl p-5 text-center group transition-all hover:-translate-y-0.5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110" style={{
                  background: "var(--gradient-brand)",
                  color: "white",
                  boxShadow: "0 4px 15px rgba(236,72,153,0.25)",
                }}>
                  {step.icon}
                </div>
                <h3 className="text-sm font-bold mb-1" style={{ color: "var(--foreground)" }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <p className="text-base leading-relaxed mb-10" style={{ color: "var(--muted)" }}>
            Tudo isso só com uma foto e por uma fração do custo de uma agência tradicional.
          </p>

          {/* Contato — Issue #5: cards com ícones SVG */}
          <h2 className="text-2xl font-bold mt-10 mb-6" style={{ color: "var(--foreground)" }}>Contato</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <a
              href="https://wa.me/553498223001"
              className="flex items-center gap-4 rounded-xl p-5 transition-all hover:-translate-y-0.5 min-h-[60px]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <IconPhone />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>WhatsApp</p>
                <p className="text-sm font-semibold" style={{ color: "#16a34a" }}>(34) 9822-3001</p>
              </div>
            </a>
            <a
              href="mailto:contato@crialook.com.br"
              className="flex items-center gap-4 rounded-xl p-5 transition-all hover:-translate-y-0.5 min-h-[60px]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
                <IconMail />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>E-mail</p>
                <p className="text-sm font-semibold gradient-text">contato@crialook.com.br</p>
              </div>
            </a>
          </div>

          {/* CTA final */}
          <div className="rounded-2xl p-8 text-center mt-12" style={{ background: "var(--gradient-brand-soft)", border: "1px solid var(--brand-200)" }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              Sua próxima campanha está a uma <span className="gradient-text">foto de distância</span>.
            </h2>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
              Teste com 5 campanhas por R$ 9,90. Sem compromisso.
            </p>
            <Link href="/sign-up" className="btn-primary text-sm !py-3 !px-8 hover:animate-pulse-glow inline-flex min-h-[48px] items-center" aria-label="Criar minha primeira campanha com IA">
              <IconZap />
              Criar minha primeira campanha
              <IconArrowRight />
            </Link>
          </div>
        </div>
      </main>

      <Footer useLinks currentPage="sobre" />
    </div>
  );
}
