import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";
// Above-the-fold — eager (hero LCP)
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
// Below-the-fold — dynamic import reduz bundle inicial da landing (-60KB)
const HowItWorksAnimation = dynamic(() => import("@/components/HowItWorksAnimation"));
const FaqAccordion = dynamic(() => import("@/components/FaqAccordion"));
const LiveCampaignDemo = dynamic(() => import("@/components/LiveCampaignDemo"));
const CostComparisonTable = dynamic(() => import("@/components/CostComparisonTable"));
const PricingTabs = dynamic(() => import("@/components/PricingTabs"));
const StickyCTA = dynamic(() => import("@/components/StickyCTA"));
const ScrollTracker = dynamic(() => import("@/components/ScrollTracker"));
const ShowcaseSection = dynamic(() => import("@/components/ShowcaseSectionLoader"));
// Hero badge dinâmico — mostra "X/50 vagas grátis" se beta ativo
import BetaTrialBadge from "@/components/BetaTrialBadge";

/* ═══════════════════════════════════════
   ISR — Regenera a landing page a cada 1h.
   Evita SSR a cada request na VPS de CPU limitada.
   ═══════════════════════════════════════ */
export const revalidate = 3600;

/* ─── Contadores diários deterministicos ─────────────────────────────────────
   Usam a data como semente para gerar incrementos pseudo-aleatórios estáveis.
   Cada dia acumula: lojistas +10~20, campanhas +80~100.
   ──────────────────────────────────────────────────────────────────────────── */
function dailyCounters() {
  const BASE_DATE = new Date("2025-01-15").getTime();
  const BASE_LOJISTAS = 1247;
  const BASE_CAMPANHAS = 8900;
  const MS_PER_DAY = 86400000;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceBase = Math.max(0, Math.floor((today.getTime() - BASE_DATE) / MS_PER_DAY));

  // Semente simples mas deterministica por dia
  let lojistas = BASE_LOJISTAS;
  let campanhas = BASE_CAMPANHAS;
  for (let d = 0; d < daysSinceBase; d++) {
    const seed = (d * 2654435761) >>> 0; // Knuth multiplicative hash
    lojistas  += 10 + (seed % 11);           // +10 a +20
    campanhas += 80 + ((seed >> 4) % 21);    // +80 a +100
  }

  return { lojistas, campanhas };
}

import { IconCamera, IconZap, IconDownload, IconSparkles, IconShirt, IconTarget, IconBarChart, IconShield, IconUsers, IconCheck, IconArrowRight, IconInstagram, IconWhatsApp, IconChevronUp } from "@/components/Icons";



/* ═══════════════════════════════════════
   Steps data (Como funciona)
   ═══════════════════════════════════════ */
const steps = [
  {
    number: "01",
    icon: <IconCamera />,
    title: "Fotografe a peça",
    description: "Use o celular. Qualquer fundo, qualquer luz — a IA isola e analisa o tecido, caimento e cor.",
  },
  {
    number: "02",
    icon: <IconZap />,
    title: "IA cria tudo",
    description: "Modelo virtual veste a peça, legendas persuasivas, hashtags e score de conversão — em segundos.",
  },
  {
    number: "03",
    icon: <IconDownload />,
    title: "Publique e venda",
    description: "Copie, baixe e poste direto no Instagram, WhatsApp ou Meta Ads. Pronto pra converter.",
  },
];


/* ═══════════════════════════════════════
   Page Component
   ═══════════════════════════════════════ */
export default function Home() {
  const { lojistas, campanhas } = dailyCounters();
  return (
    <div className="flex flex-col min-h-screen">
      {/* ═══ NAVBAR ═══ */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.webp" alt="CriaLook" width={52} height={52} className="rounded-full" />
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Cria<span className="gradient-text">Look</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#demo-viva" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Demo</a>
            <a href="#como-funciona" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Como funciona</a>
            <a href="#precos" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Preços</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/sign-in" className="hidden sm:flex text-sm font-medium px-3 py-2 rounded-full transition min-h-[44px] items-center" style={{ color: 'var(--muted)' }}>
              Entrar
            </Link>
            <div>
              <ThemeToggle />
            </div>
            <Link href="/sign-up" className="btn-primary w-auto text-sm !py-2.5 !px-4 sm:!py-2.5 sm:!px-5 min-h-[44px] whitespace-nowrap">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Testar na prática</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 pb-16 md:pb-0">
        {/* ═══ HERO — VTO-first above the fold ═══ */}
        <section className="relative pt-24 pb-8 md:pt-36 md:pb-20 overflow-x-hidden" style={{ background: 'var(--gradient-hero)' }}>
          {/* Mesh gradient orbs */}
          <div className="absolute top-10 -left-20 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] rounded-full opacity-[0.15] blur-[100px]" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute -bottom-20 -right-20 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] rounded-full opacity-[0.08] blur-[120px]" style={{ background: 'var(--accent-400)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] rounded-full opacity-[0.04] blur-[80px]" style={{ background: 'var(--brand-300)' }} />
          
          <div className="container relative z-10">
            {/* ── Mobile Layout: text + compact VTO proof ── */}
            <div className="md:hidden text-center stagger-children">
              <BetaTrialBadge />

              <div className="inline-flex items-center gap-2 badge badge-brand mb-3">
                <IconSparkles />
                <span>Modelo Virtual com IA</span>
              </div>

              <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight leading-[1.1] mb-3">
                Sua peça vira <span className="gradient-text">campanha pronta</span> em 60s.
              </h1>

              <p className="text-sm sm:text-base leading-relaxed mb-6 max-w-[280px] sm:max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
                Foto no manequim ou cabide → 1 foto com modelo virtual + legendas prontas.{" "}
                <strong style={{ color: 'var(--foreground)' }}>Sem fotógrafo. Sem Photoshop.</strong>
              </p>

              {/* ── VTO Proof — Before/After Slider (mobile) ── */}
              <div className="mb-6 mx-auto max-w-xs animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <BeforeAfterSlider 
                  beforeImage="/demo-before.webp" 
                  afterImage="/demo-after.webp" 
                />
                {/* Smart caption preview */}
                <div className="mt-3 rounded-xl px-4 py-3 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>
                      <IconSparkles />
                    </div>
                    <span className="text-xs font-semibold">Legenda gerada pela IA</span>
                    <span className="ml-auto text-xs font-black gradient-text">94/100</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                    ✨ Vestido floral tropical — caimento fluido, estampa exclusiva e toque acetinado. Peça que vende sozinha. 🌺
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300">Alta Conversão</span>
                    <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-accent-100 dark:bg-accent-700/30 text-accent-600 dark:text-accent-300">Copy Persuasivo</span>
                    <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" }}>Meta Aprovado</span>
                  </div>
                </div>
              </div>

              {/* CTA principal */}
              <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
                <Link
                  href="/sign-up"
                  className="btn-primary w-full text-sm !py-3.5 hover:animate-pulse-glow whitespace-normal text-center leading-tight"
                  aria-label="Pegar minha vaga grátis no Beta"
                >
                  <IconZap className="shrink-0" />
                  <span>Pegar minha vaga grátis</span>
                </Link>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  ✓ 1 campanha completa (1 foto) <strong>grátis</strong> · sem cartão
                </p>
              </div>

              {/* O que está incluso na vaga grátis */}
              <div className="mt-5 mx-auto max-w-xs rounded-2xl p-4 text-left" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Incluso na vaga grátis</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>1</span>
                    <div>
                      <p className="text-sm font-bold">Foto com modelo virtual</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Cenário e pose escolhidos pela IA</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>✍️</span>
                    <div>
                      <p className="text-sm font-bold">Legendas + hashtags</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Textos persuasivos prontos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>⚡</span>
                    <div>
                      <p className="text-sm font-bold">Pronto em até 90s</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Use sua peça real (não exemplo)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ver exemplo — depois do breakdown */}
              <div className="mt-4 mx-auto max-w-xs">
                <a href="#demo-viva" className="btn-secondary w-full text-sm !py-3">
                  Ver Exemplo Pronto
                  <IconArrowRight />
                </a>
              </div>
            </div>

            {/* ── Desktop Layout: side-by-side hero ── */}
            <div className="hidden md:grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left — Copy */}
              <div className="stagger-children">
                <BetaTrialBadge />

                <div className="inline-flex items-center gap-2 badge badge-brand mb-6">
                  <IconSparkles />
                  <span>Modelo Virtual com IA</span>
                </div>

                {/* desktop usa <p> com estilo h1 — só 1 h1 por página (o mobile).
                    aria-hidden evita screenreader ler 2x. */}
                <p
                  aria-hidden="true"
                  className="text-4xl lg:text-[56px] font-bold tracking-tight leading-[1.06] mb-6"
                >
                  Sua peça vira <span className="gradient-text">campanha pronta</span> em 60s.
                </p>

                <p className="text-lg lg:text-xl leading-relaxed mb-8 max-w-lg" style={{ color: 'var(--muted)' }}>
                  Foto no manequim ou cabide → 1 foto com modelo virtual + legendas prontas pra postar.{" "}
                  <strong style={{ color: 'var(--foreground)' }}>Sem fotógrafo. Sem Photoshop.</strong>
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <Link
                    href="/sign-up"
                    className="btn-primary text-base !py-3.5 !px-8 hover:animate-pulse-glow"
                    aria-label="Pegar minha vaga grátis no Beta"
                  >
                    <IconZap />
                    Pegar minha vaga grátis
                  </Link>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                  ✓ 1 campanha completa (1 foto) <strong style={{ color: 'var(--foreground)' }}>grátis</strong> · sem cartão · sem assinatura
                </p>

                {/* Pack breakdown — desktop */}
                <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--muted)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>1</span>
                    <span><strong style={{ color: 'var(--foreground)' }}>foto</strong> pronta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">👩</span>
                    <span><strong style={{ color: 'var(--foreground)' }}>Modelo</strong> personalizada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">✍️</span>
                    <span><strong style={{ color: 'var(--foreground)' }}>Legendas</strong> + hashtags</span>
                  </div>
                </div>

                <a href="#demo-viva" className="btn-secondary text-sm !py-3 !px-6 mt-6 inline-flex">
                  Ver Exemplo Pronto
                  <IconArrowRight />
                </a>
              </div>

              {/* Right — Interactive Before/After Slider */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <BeforeAfterSlider 
                  beforeImage="/demo-before.webp" 
                  afterImage="/demo-after.webp" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SOCIAL PROOF BAR ═══ */}
        <section className="py-8 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="container">
            <div className="text-center">
              <p className="text-sm font-semibold mb-6 flex items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--success)' }}></span>
                  <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--success)' }}></span>
                </span>
                <strong style={{ color: 'var(--foreground)' }}>{lojistas.toLocaleString("pt-BR")} lojistas</strong> já criaram {campanhas.toLocaleString("pt-BR")}+ campanhas esta semana
              </p>
              <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-5 md:gap-16 opacity-60 grayscale blur-[0.5px]">
                <span className="text-sm sm:text-xl font-black tracking-tighter">DONNA</span>
                <span className="text-sm sm:text-xl font-black tracking-widest font-serif">ELEGANCE</span>
                <span className="text-sm sm:text-xl font-bold uppercase">ML Fashion</span>
                <span className="text-sm sm:text-xl font-bold italic">Boutique</span>
                <span className="text-sm sm:text-xl font-black">CiaBrand</span>
              </div>
            </div>
          </div>
        </section>


        {/* ═══ DEMONSTRAÇÃO VIVA ═══ */}
        <section id="demo-viva" className="section scroll-mt-20" style={{ background: 'var(--surface)' }}>
          <div className="container">
            <div className="text-center mb-10">
              <div className="badge badge-brand mb-4 inline-flex">Demonstração Real</div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Veja uma <span className="gradient-text">Campanha Viva</span>
              </h2>
              <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Simule como seria a geração mágica com CriaLook sem precisar criar conta agora.
              </p>
            </div>
            <LiveCampaignDemo />
          </div>
        </section>

        {/* ═══ COMO FUNCIONA ═══ */}
        <section id="como-funciona" className="section scroll-mt-20" style={{ background: 'var(--background)' }}>
          <div className="container">
            <div className="text-center mb-12 md:mb-16">
              <div className="badge badge-brand mb-4 inline-flex">3 passos simples</div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4">
                De uma foto a uma <span className="gradient-text">campanha completa</span>
              </h2>
              <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Nenhum conhecimento técnico. Sem Photoshop. Sem agência.
              </p>
            </div>

            <HowItWorksAnimation />
          </div>
        </section>

        {/* ═══ SHOWCASE — prova social real ═══ */}
        <ShowcaseSection />

        {/* ═══ BENEFÍCIOS — Bento Grid ═══ */}
        <section id="beneficios" className="section scroll-mt-20" style={{ background: 'var(--surface)' }}>
          <div className="container">
            <div className="text-center mb-12 md:mb-16">
              <div className="badge badge-brand mb-4 inline-flex">Tudo incluso</div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Uma foto. <span className="gradient-text">Seis entregas.</span>
              </h2>
              <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Cada campanha vem com modelo virtual, legendas inteligentes, hashtags, score e compliance — sem custo extra.
              </p>
            </div>

            {/* Bento Grid — 3 cols desktop, 2 cols tablet, 1 col mobile = no orphan */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 stagger-children">
              {/* ★ VTO — gradient brand card for prominence */}
              <div className="group rounded-2xl p-5 md:p-7 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden" style={{
                background: 'var(--gradient-brand)',
                color: 'white',
                boxShadow: '0 8px 40px rgba(236,72,153,0.2)',
              }}>
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-3xl" style={{ background: 'white' }} />
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110" style={{
                  background: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)',
                }}>
                  <IconShirt />
                </div>
                <div className="text-2xs font-bold uppercase tracking-widest mb-2 opacity-80">Feature principal</div>
                <h3 className="text-lg md:text-xl font-bold mb-2">Modelos Exclusivas</h3>
                <p className="text-xs md:text-sm leading-relaxed opacity-90">
                  Crie o biotipo da sua cliente ideal (etnia, cabelo, corpo) e vista toda a sua coleção nela de forma padronizada.
                </p>

              </div>

              {/* 5 cards normais */}
              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
                  <IconTarget />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Legendas que vendem</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  IA treinada em copy de moda brasileiro. Headlines, legendas e mensagens WhatsApp.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
                  <IconBarChart />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Score de conversão</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Nota de 0 a 100: persuasão, clareza, Meta Ads. Saiba o que melhorar.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
                  <IconCamera />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Poder de Escolha</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Não dependa da sorte de um clique só. A IA gera 3 opções visuais a cada campanha para garantir a foto ideal.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
                  <IconShield />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Compliance Meta</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Alertas sobre políticas do Meta Ads. Zero risco de bloqueio.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
                  <IconUsers />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Feito pra lojista</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Interface simples e direta. Não precisa saber de marketing ou design.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ MATEMÁTICA HUMILHANTE & PRICING ═══ */}
        <section id="precos" className="section scroll-mt-20" style={{ background: 'var(--gradient-brand-soft)' }}>
          <div className="container">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Quanto você <span className="gradient-text">economiza</span> em cada campanha
              </h2>
              <p className="text-sm sm:text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Compare o que sua concorrência paga a cada shoot com o seu custo real no CriaLook.
              </p>
            </div>
            
            <CostComparisonTable />

            <div className="mt-20 text-center mb-8">
              <div className="badge badge-brand mb-4 inline-flex">Planos & Packs</div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Invista na Sua <span className="gradient-text">Agência Virtual</span>
              </h2>
              <div className="inline-flex items-center gap-2 rounded-xl sm:rounded-full px-4 py-2 text-xs sm:text-sm font-semibold mb-4 bg-brand-500/10 text-brand-600 border border-brand-200 dark:border-brand-800 dark:text-brand-400 text-center">
                ⚡ Cancele quando quiser. Créditos não expiram.
              </div>
            </div>

            <PricingTabs />
          </div>
        </section>

        {/* ═══ DEPOIMENTOS — escondido até termos depoimentos reais com prints
             do Instagram. Componente preservado para reativação. ═══ */}

        {/* ═══ FAQ SECTION ═══ */}
        <section id="faq" className="section scroll-mt-20 border-t" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
          <div className="container">
            <div className="text-center mb-12 md:mb-16">
              <div className="badge badge-brand mb-4 inline-flex">Dúvidas Frequentes</div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Ainda tem <span className="gradient-text">perguntas?</span>
              </h2>
              <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Tudo o que você precisa saber antes de gerar sua primeira campanha.
              </p>
            </div>
            
            <FaqAccordion />
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="section relative overflow-hidden" style={{ background: 'var(--background)' }}>
          <div className="absolute top-0 left-1/4 w-60 sm:w-96 h-60 sm:h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute bottom-0 right-1/4 w-60 sm:w-96 h-60 sm:h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-400)' }} />
          
          <div className="container relative z-10 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Sua próxima campanha está a uma{" "}
              <span className="gradient-text">foto de distância</span>.
            </h2>
            {/* Pack breakdown inline */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-8 text-sm" style={{ color: 'var(--muted)' }}>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>1</span>
                <span><strong style={{ color: 'var(--foreground)' }}>foto</strong> pronta</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">👩</span>
                <span><strong style={{ color: 'var(--foreground)' }}>Modelo</strong> personalizada</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">✍️</span>
                <span><strong style={{ color: 'var(--foreground)' }}>Legendas</strong> + hashtags</span>
              </div>
            </div>
            <Link href="/sign-up" className="btn-primary text-sm sm:text-base !py-4 !px-6 sm:!px-10 hover:animate-pulse-glow whitespace-normal text-center leading-tight" aria-label="Pegar minha vaga grátis">
              <IconZap className="shrink-0" />
              <span>Pegar minha vaga grátis</span>
              <IconArrowRight className="shrink-0" />
            </Link>
            <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>Sem cartão. Sem assinatura.</p>

          </div>
        </section>
      </main>

      {/* N3: Sticky CTA de Conversão (mobile) */}
      <StickyCTA />
      
      <ScrollTracker />
      <Footer />
    </div>
  );
}
