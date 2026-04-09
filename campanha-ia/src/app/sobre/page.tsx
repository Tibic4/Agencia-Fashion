import Link from "next/link";
import Image from "next/image";

/* ═══════════════════════════════════════
   Icons (inline SVGs)
   ═══════════════════════════════════════ */
const IconCamera = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
);
const IconZap = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const IconDownload = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const IconMail = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
);
const IconPhone = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);
const IconArrowRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
const IconHeart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
);
const IconTarget = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);

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
          <Link href="/sign-up" className="btn-primary text-sm !py-2.5 !px-3 sm:!py-2.5 sm:!px-5 min-h-[44px] flex items-center">
            <span className="sm:hidden">Começar</span>
            <span className="hidden sm:inline">Testar na prática</span>
          </Link>
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
          </div>

          {/* CTA final */}
          <div className="rounded-2xl p-8 text-center mt-12" style={{ background: "var(--gradient-brand-soft)", border: "1px solid var(--brand-200)" }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
              Pronto para vender <span className="gradient-text">mais</span>?
            </h2>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
              Teste com 3 campanhas por R$ 9,90. Sem compromisso.
            </p>
            <Link href="/sign-up" className="btn-primary text-sm !py-3 !px-8 animate-pulse-glow inline-flex min-h-[48px] items-center">
              <IconZap />
              Criar minha primeira campanha
              <IconArrowRight />
            </Link>
          </div>
        </div>
      </main>

      {/* Issue #12: footer compartilhado — consistente com a Home */}
      <footer className="py-12" style={{ background: "var(--gray-950)", color: "var(--gray-400)" }}>
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <Image src="/logo.png" alt="CriaLook" width={40} height={40} className="rounded-full" />
                <span className="text-lg font-bold text-white">CriaLook</span>
              </div>
              <p className="text-sm leading-relaxed">
                Transforme fotos de roupa em campanhas de marketing completas com inteligência artificial.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Produto</h4>
              <div className="space-y-3 text-sm">
                <Link href="/#como-funciona" className="block hover:text-white transition py-1">Como funciona</Link>
                <Link href="/#precos" className="block hover:text-white transition py-1">Preços</Link>
                <Link href="/#beneficios" className="block hover:text-white transition py-1">Benefícios</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Legal & Contato</h4>
              <div className="space-y-3 text-sm">
                <Link href="/termos" className="block hover:text-white transition py-1">Termos de Uso</Link>
                <Link href="/privacidade" className="block hover:text-white transition py-1">Privacidade</Link>
                <a href="mailto:contato@crialook.com.br" className="block hover:text-white transition py-1">contato@crialook.com.br</a>
              </div>
            </div>
          </div>
          <div className="pt-8 text-center text-xs" style={{ borderTop: "1px solid var(--gray-800)" }}>
            © {new Date().getFullYear()} CriaLook. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
