import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";
import { IconCamera, IconZap, IconDownload, IconMail, IconPhone, IconArrowRight, IconHeart, IconTarget, IconSparkles, IconShirt } from "@/components/Icons";

/* ═══════════════════════════════════════
   N6: Page metadata for SEO
   ═══════════════════════════════════════ */
export const metadata: Metadata = {
  title: "Sobre | CriaLook — Marketing de Moda com IA",
  description: "Conheça a CriaLook: a plataforma que transforma fotos de roupa em campanhas de marketing completas usando inteligência artificial. Feita para lojistas brasileiros.",
  alternates: { canonical: "/sobre" },
};

const steps = [
  {
    icon: <IconCamera />,
    title: "Fotografe a peça",
    description: "Use o celular. Qualquer fundo, qualquer luz — a IA isola e analisa tecido, caimento e cor automaticamente.",
  },
  {
    icon: <IconZap />,
    title: "IA cria a campanha",
    description: "Modelo virtual veste a peça, legendas persuasivas, hashtags e score de conversão — tudo em segundos.",
  },
  {
    icon: <IconDownload />,
    title: "Publique e venda",
    description: "Copie o texto, baixe a imagem e poste no Instagram, WhatsApp ou Meta Ads. Pronto pra converter.",
  },
];

const values = [
  {
    icon: <IconTarget />,
    title: "Democratizar",
    description: "Marketing profissional ao alcance de qualquer lojista, sem precisar de agência.",
  },
  {
    icon: <IconShirt />,
    title: "Inovar com moda",
    description: "IA treinada na linguagem da moda brasileira. Não é genérico — é técnico e persuasivo.",
  },
  {
    icon: <IconSparkles />,
    title: "Simplificar",
    description: "Uma foto. Uma campanha completa. Sem curva de aprendizado, sem complicação.",
  },
];

export default function Sobre() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.webp" alt="CriaLook" width={52} height={52} className="rounded-full" priority />
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

      <main className="flex-1 pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="container">
          {/* ═══ Hero ═══ */}
          <div className="max-w-3xl mx-auto text-center mb-16 md:mb-24 stagger-children">
            <div className="badge badge-brand mb-4 inline-flex items-center gap-1.5">
              <IconHeart />
              <span>Sobre nós</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
              Marketing de moda{" "}
              <span className="gradient-text">inteligente</span>
            </h1>
            <p className="text-base md:text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: "var(--muted)" }}>
              Uma plataforma brasileira que usa IA para transformar uma simples foto de produto em campanhas completas — com modelo virtual, legendas profissionais e score de qualidade.
            </p>
          </div>

          {/* ═══ Nossa história ═══ */}
          <div className="max-w-3xl mx-auto mb-16 md:mb-24">
            <div className="grid md:grid-cols-2 gap-4 sm:gap-8 md:gap-12">
              {/* Story card */}
              <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ 
                background: "var(--gradient-card)", 
                border: "1px solid var(--border)",
              }}>
                <div className="hidden sm:block absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: "var(--brand-400)" }} />
                <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: "var(--foreground)" }}>A dor que nos move</h2>
                <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  <p>
                    <strong style={{ color: "var(--foreground)" }}>CriaLook</strong> nasceu de uma dor real: lojistas de moda 
                    brasileiros que precisam postar todo dia mas não têm tempo, dinheiro nem conhecimento para criar 
                    campanhas profissionais.
                  </p>
                  <p>
                    Nosso público são os donos de loja de bairro, os empreendedores de Instagram, os vendedores de 
                    WhatsApp — gente que vive de moda mas não domina marketing digital.
                  </p>
                </div>
              </div>

              {/* Mission card */}
              <div className="rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{
                background: "var(--gradient-brand)",
                color: "white",
                boxShadow: "0 8px 40px rgba(236,72,153,0.15)",
              }}>
                <div className="hidden sm:block absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: "white" }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
                  <IconTarget />
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-3">Nossa missão</h2>
                <p className="text-base md:text-lg italic leading-relaxed opacity-95">
                  &ldquo;Democratizar o marketing de moda para que qualquer lojista brasileiro possa competir 
                  com as grandes marcas — usando apenas o celular.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* ═══ Valores — Bento style ═══ */}
          <div className="max-w-3xl mx-auto mb-16 md:mb-24">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-10">
              O que nos <span className="gradient-text">define</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 stagger-children">
              {values.map((v) => (
                <div
                  key={v.title}
                  className="surface-card surface-card-hover p-5 md:p-6 group transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{
                    background: "var(--gradient-brand)",
                    color: "white",
                    boxShadow: "0 4px 15px rgba(236,72,153,0.25)",
                  }}>
                    {v.icon}
                  </div>
                  <h3 className="text-sm font-bold mb-1">{v.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                    {v.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Como funciona ═══ */}
          <div className="max-w-3xl mx-auto mb-16 md:mb-24">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
              Como <span className="gradient-text">funciona</span>
            </h2>
            <p className="text-sm md:text-base text-center mb-8 md:mb-10" style={{ color: "var(--muted)" }}>
              IA de ponta transforma uma foto em campanha completa — com modelo virtual e textos profissionais.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 stagger-children">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="surface-card surface-card-hover p-5 text-center group transition-all duration-300 hover:-translate-y-0.5 relative"
                >
                  {/* Connector (mobile) */}
                  {i < steps.length - 1 && (
                    <div className="sm:hidden absolute left-1/2 -translate-x-1/2 -bottom-3 w-px h-4" style={{ borderLeft: '2px dashed var(--brand-300)', opacity: 0.3 }} />
                  )}
                  {/* Step number */}
                  <div className="text-2xs font-black uppercase tracking-widest mb-3" style={{ color: "var(--brand-400)" }}>
                    Passo {i + 1}
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110" style={{
                    background: "var(--gradient-brand)",
                    color: "white",
                    boxShadow: "0 4px 15px rgba(236,72,153,0.25)",
                  }}>
                    {step.icon}
                  </div>
                  <h3 className="text-sm font-bold mb-1">{step.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ Contato ═══ */}
          <div className="max-w-3xl mx-auto mb-16 md:mb-24">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Contato</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <a
                href="https://wa.me/553498223001"
                className="surface-card surface-card-hover flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 min-h-[72px] group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" }}>
                  <IconPhone />
                </div>
                <div>
                  <p className="text-2xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--muted)" }}>WhatsApp</p>
                  <p className="text-sm font-bold" style={{ color: "var(--success)" }}>(34) 9822-3001</p>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--muted)" }}>
                  <IconArrowRight />
                </div>
              </a>
              <a
                href="mailto:contato@crialook.com.br"
                className="surface-card surface-card-hover flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 min-h-[72px] group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}>
                  <IconMail />
                </div>
                <div>
                  <p className="text-2xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--muted)" }}>E-mail</p>
                  <p className="text-sm font-bold gradient-text">contato@crialook.com.br</p>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--muted)" }}>
                  <IconArrowRight />
                </div>
              </a>
            </div>
          </div>

          {/* ═══ CTA final ═══ */}
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-5 sm:p-8 md:p-12 text-center relative overflow-hidden" style={{ background: "var(--gradient-brand-soft)", border: "1px solid var(--brand-200)" }}>
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-10 blur-3xl" style={{ background: "var(--brand-400)" }} />
              <h2 className="text-xl md:text-3xl font-bold mb-3">
                Sua próxima campanha está a uma <span className="gradient-text">foto de distância</span>.
              </h2>
              <p className="text-sm md:text-base mb-6 max-w-md mx-auto" style={{ color: "var(--muted)" }}>
                Comece grátis: 1 campanha completa pelo Beta, sem cartão. Modelo virtual, legendas e score — tudo incluso.
              </p>
              <Link href="/sign-up" className="btn-primary text-sm md:text-base !py-3.5 !px-8 hover:animate-pulse-glow inline-flex min-h-[48px] items-center" aria-label="Criar minha primeira campanha com IA">
                <IconZap />
                Criar minha primeira campanha
                <IconArrowRight />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer useLinks currentPage="sobre" />
    </div>
  );
}
