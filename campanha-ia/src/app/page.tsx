import Link from "next/link";
import Image from "next/image";
import ShowcaseSectionLoader from "@/components/ShowcaseSectionLoader";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";

/* ═══════════════════════════════════════
   ISR — Regenera a landing page a cada 1h.
   Evita SSR a cada request na VPS de CPU limitada.
   ═══════════════════════════════════════ */
export const revalidate = 3600;

import { IconCamera, IconZap, IconDownload, IconSparkles, IconShirt, IconTarget, IconBarChart, IconShield, IconUsers, IconCheck, IconArrowRight, IconInstagram, IconWhatsApp, IconChevronUp } from "@/components/Icons";

/* ═══════════════════════════════════════
   Plans data
   ═══════════════════════════════════════ */
const plans = [
  {
    id: "essencial",
    name: "Essencial",
    price: 69,
    badge: "💡",
    popular: false,
    campaigns: 15,
    models: 3,
    tagline: "Pra quem tá começando com IA",
    unitPrice: "R$ 4,60 por campanha",
    cta: "Começar com Essencial",
    features: ["15 campanhas/mês", "3 modelos virtuais", "Virtual Try-On com IA", "4 canais prontos", "Score de qualidade", "Histórico 30 dias", "Suporte por email"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    badge: "🚀",
    popular: true,
    campaigns: 50,
    models: 10,
    tagline: "O favorito das lojistas que crescem",
    unitPrice: "R$ 2,98 por campanha",
    cta: "Assinar Pro ⭐",
    features: ["50 campanhas/mês", "10 modelos virtuais", "Virtual Try-On com IA", "4 canais prontos", "Score de qualidade", "Histórico 1 ano", "Suporte WhatsApp"],
  },
  {
    id: "business",
    name: "Business",
    price: 299,
    badge: "🏢",
    popular: false,
    campaigns: 120,
    models: 25,
    tagline: "Pra quem posta todo dia e não quer limite",
    unitPrice: "R$ 2,49 por campanha — melhor custo",
    cta: "Ir pro Business",
    features: ["120 campanhas/mês", "25 modelos virtuais", "Virtual Try-On com IA", "4 canais prontos", "Score de qualidade", "Histórico ilimitado", "Suporte prioritário"],
  },
];

const benefits = [
  {
    icon: <IconCamera />,
    title: "Só com uma foto",
    description: "Fotografe a peça com o celular e a IA gera a campanha completa, pronta pra postar.",
  },
  {
    icon: <IconTarget />,
    title: "Textos que vendem",
    description: "IA treinada em copy de moda brasileira. Headlines, legendas e WhatsApp que convertem.",
  },
  {
    icon: <IconShirt />,
    title: "Modelo virtual",
    description: "Sua roupa vestida em modelo IA. Sem fotógrafo, sem estúdio, sem custo extra.",
  },
  {
    icon: <IconBarChart />,
    title: "Score de qualidade",
    description: "Nota de 0 a 100 com análise de conversão, clareza e aprovação Meta Ads.",
  },
  {
    icon: <IconShield />,
    title: "Compliance Meta",
    description: "Alertas automáticos sobre políticas do Meta Ads. Zero risco de bloqueio.",
  },
  {
    icon: <IconUsers />,
    title: "Feito para lojista",
    description: "Interface simples. Não precisa saber de marketing, design nem IA.",
  },
];

const steps = [
  {
    number: "01",
    icon: <IconCamera />,
    title: "Tire a foto",
    description: "Fotografe a peça de roupa com seu celular. Qualquer fundo serve — a IA resolve.",
  },
  {
    number: "02",
    icon: <IconZap />,
    title: "IA trabalha",
    description: "Textos, criativos com modelo virtual, hashtags e score de qualidade — tudo automático.",
  },
  {
    number: "03",
    icon: <IconDownload />,
    title: "Publique",
    description: "Copie o texto, baixe a imagem e poste no Instagram, WhatsApp ou Meta Ads.",
  },
];


/* ═══════════════════════════════════════
   Page Component
   ═══════════════════════════════════════ */
export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ═══ NAVBAR ═══ */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.png" alt="CriaLook" width={52} height={52} className="rounded-full" priority />
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Cria<span className="gradient-text">Look</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#como-funciona" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Como funciona</a>
            <a href="#beneficios" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Benefícios</a>
            <a href="#precos" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Preços</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/sign-in" className="text-sm font-medium px-3 py-2 rounded-full transition min-h-[44px] flex items-center" style={{ color: 'var(--muted)' }}>
              Entrar
            </Link>
            <ThemeToggle />
            <Link href="/sign-up" className="btn-primary text-sm !py-2.5 !px-4 sm:!py-2.5 sm:!px-5 min-h-[44px]">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Testar na prática</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ═══ HERO ═══ */}
        <section className="relative pt-24 pb-16 md:pt-40 md:pb-28 overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
          {/* Decorative elements */}
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-400)' }} />
          
          <div className="container relative z-10">
            <div className="max-w-3xl mx-auto text-center stagger-children">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 badge badge-brand mb-4 md:mb-6">
                <IconSparkles />
                <span>Feito para lojistas de moda</span>
              </div>

              {/* Headline */}
              <h1 className="text-[32px] sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
                Sua roupa no corpo de uma{" "}
                <span className="gradient-text">modelo IA.</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'var(--muted)' }}>
                Só com uma foto da peça. A IA veste a modelo virtual, gera textos, hashtags e score de qualidade —{" "}
                <strong style={{ color: 'var(--foreground)' }}>campanha pronta pra postar</strong>.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up" className="btn-primary text-sm sm:text-base !py-3.5 !px-5 sm:!px-8 hover:animate-pulse-glow" aria-label="Testar CriaLook por R$ 9,90">
                  <IconZap />
                  <span className="sm:hidden">Testar por R$ 9,90</span>
                  <span className="hidden sm:inline">Testar por R$ 9,90 — 5 campanhas completas</span>
                </Link>
                <a href="#como-funciona" className="btn-secondary text-base !py-3.5 !px-8">
                  Ver como funciona
                  <IconArrowRight />
                </a>
              </div>

              {/* Social proof */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 mt-8 text-sm" style={{ color: 'var(--muted)' }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--success)' }}>✔</span>
                  <span>Modelo virtual inclusa</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--success)' }}>✔</span>
                  <span>Pague via PIX</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--success)' }}>✔</span>
                  <span>Cancele quando quiser</span>
                </div>
              </div>
            </div>

            {/* Hero Visual — App Preview Mockup */}
            {/* Mobile: compact result preview */}
            <div className="md:hidden mt-10 max-w-sm mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>
                    <IconSparkles />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Resultado da IA</p>
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Campanha gerada automaticamente</p>
                  </div>
                  <span className="ml-auto text-xs font-bold gradient-text">87/100</span>
                </div>
                <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--muted)' }}>
                  ✨ Ela chegou pra roubar a cena! Vestido floral perfeito pro verão — confortável, estiloso e por apenas R$ 89,90 💕
                </p>
                <p className="text-[10px]" style={{ color: 'var(--brand-500)' }}>
                  #modafeminina #vestidofloral #looknovo #fashionstyle
                </p>
              </div>
            </div>
            {/* Desktop: full browser mockup */}
            <div className="hidden md:block mt-16 md:mt-20 max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <div className="relative rounded-2xl overflow-hidden" style={{ 
                background: 'var(--gradient-card)', 
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-xl)'
              }}>
                {/* Browser bar */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: '#10b981' }} />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="h-6 rounded-md px-3 flex items-center text-xs" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
                      crialook.com.br/gerar
                    </div>
                  </div>
                </div>
                {/* App content mockup */}
                <div className="p-6 md:p-10">
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Left — Upload area */}
                    <div className="flex flex-col gap-4">
                      <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-500)' }}>
                        Upload da peça
                      </div>
                      <div className="aspect-square rounded-xl flex flex-col items-center justify-center gap-3" style={{ 
                        background: 'var(--surface)', 
                        border: '2px dashed var(--border)',
                      }}>
                        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>
                          <IconCamera />
                        </div>
                        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Arraste a foto da roupa aqui</p>
                        <div className="btn-primary text-xs !py-2 !px-4">Escolher foto</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: 'var(--muted)' }}>Preço:</span>
                        <div className="flex-1 h-10 rounded-lg px-3 flex items-center font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          R$ 89,90
                        </div>
                      </div>
                    </div>
                    {/* Right — Result preview */}
                    <div className="flex flex-col gap-4">
                      <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-500)' }}>
                        Resultado IA
                      </div>
                      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <IconInstagram />
                          <span className="text-sm font-semibold">Instagram Feed</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                          ✨ Ela chegou pra roubar a cena! Vestido floral perfeito pro verão — confortável, 
                          estiloso e por apenas R$ 89,90 💕
                        </p>
                        <p className="text-xs" style={{ color: 'var(--brand-500)' }}>
                          #modafeminina #vestidofloral #looknovo #fashionstyle #tendencia2026
                        </p>
                      </div>
                      <div className="rounded-xl p-5 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#25d366' }}><IconWhatsApp /></span>
                          <span className="text-sm font-semibold">WhatsApp</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                          Oi! 🌸 Acabou de chegar vestido floral LINDO, super fresquinho pro calor! 
                          Por R$ 89,90. Quer ver mais fotos? 📲
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: '87%', background: 'var(--gradient-brand)' }} />
                        </div>
                        <span className="text-sm font-bold gradient-text">87/100</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ COMO FUNCIONA ═══ */}
        <section id="como-funciona" className="section" style={{ background: 'var(--background)' }}>
          <div className="container">
            <div className="text-center mb-16">
              <div className="badge badge-brand mb-4 inline-flex">3 passos simples</div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Como <span className="gradient-text">funciona</span>
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Nenhum conhecimento técnico necessário. Foto + preço = campanha completa.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto stagger-children">
              {steps.map((step, i) => (
                <div key={step.number} className="relative text-center group">
                  {/* N5: Connector line between steps (mobile) */}
                  {i < steps.length - 1 && (
                    <div className="md:hidden absolute left-1/2 -translate-x-1/2 -bottom-5 w-px h-6" style={{ borderLeft: '2px dashed var(--brand-300)', opacity: 0.4 }} />
                  )}
                  {/* Step number */}
                  <div className="text-5xl md:text-7xl font-black mb-4 opacity-[0.06] md:opacity-[0.12]" style={{ color: 'var(--brand-500)' }}>
                    {step.number}
                  </div>
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 -mt-16 relative z-10 transition-transform group-hover:scale-110" style={{ 
                    background: 'var(--gradient-brand)', 
                    color: 'white',
                    boxShadow: '0 8px 25px rgba(236,72,153,0.25)'
                  }}>
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ BENEFÍCIOS ═══ */}
        <section id="beneficios" className="section" style={{ background: 'var(--gradient-brand-soft)' }}>
          <div className="container">
            <div className="text-center mb-16">
              <div className="badge badge-brand mb-4 inline-flex">Por que escolher</div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Tudo que seu <span className="gradient-text">marketing</span> precisa
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Ferramenta completa para lojistas de moda que querem vender mais sem complicação.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 max-w-5xl mx-auto stagger-children">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="card-brand group cursor-default">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 md:mb-4 transition-transform group-hover:scale-110" style={{
                    background: 'var(--brand-100)',
                    color: 'var(--brand-600)',
                  }}>
                    {benefit.icon}
                  </div>
                  <h3 className="text-base md:text-lg font-bold mb-1 md:mb-2">{benefit.title}</h3>
                  <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ VITRINE ANTES/DEPOIS ═══ */}
        <ShowcaseSectionLoader />

        {/* ═══ PRICING ═══ */}
        <section id="precos" className="section" style={{ background: 'var(--background)' }}>
          <div className="container">
            <div className="text-center mb-16">
              <div className="badge badge-brand mb-4 inline-flex">Planos</div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Teste na prática, <span className="gradient-text">escale quando quiser</span>
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Escolha quantas campanhas sua loja precisa. Mesma tecnologia em todos os planos.
              </p>
            </div>

            {/* Trial Pack */}
            <div className="max-w-md mx-auto mb-10">
              <div className="rounded-2xl p-5 text-center transition-all" style={{
                background: 'var(--gradient-brand-soft)',
                border: '1px solid var(--brand-200)',
                boxShadow: 'var(--shadow-md)',
              }}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">🎯</span>
                  <h3 className="text-lg font-bold">Teste na Prática</h3>
                </div>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-2xl font-black">R$ 9,90</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>único</span>
                </div>
                <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                  5 campanhas completas • Sem mensalidade
                </p>
                <Link href="/sign-up" className="btn-primary w-full !py-2.5 text-sm">
                  <IconZap />
                  Testar por R$ 9,90
                </Link>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 max-w-md mx-auto mb-12">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>ou assine e pague menos</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-5 max-w-5xl mx-auto overflow-x-auto snap-x snap-mandatory pb-6 md:overflow-visible md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scroll-pl-4" style={{ WebkitOverflowScrolling: "touch" }}>
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className="relative flex flex-col rounded-2xl p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 snap-center min-w-[260px] md:min-w-0 flex-shrink-0"
                  style={{
                    background: plan.popular ? 'var(--gradient-brand)' : 'var(--surface)',
                    border: plan.popular ? 'none' : '1px solid var(--border)',
                    boxShadow: plan.popular ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                    color: plan.popular ? 'white' : 'var(--foreground)',
                  }}
                >
                  {plan.popular && (
                    <div className="text-xs font-bold px-4 py-1 rounded-full mb-3 inline-block" style={{
                      background: 'var(--gray-950)',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}>
                      ⭐ Mais popular
                    </div>
                  )}

                  <div className="text-2xl mb-2">{plan.badge}</div>
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-1">
                    {plan.price > 0 ? (
                      <>
                        <span className="text-3xl font-black">R$ {plan.price}</span>
                        <span className="text-sm opacity-70">/mês</span>
                      </>
                    ) : (
                      <span className="text-3xl font-black">Grátis</span>
                    )}
                  </div>

                  <p className="text-xs mb-1 opacity-80">
                    {plan.tagline}
                  </p>
                  <p className="text-xs mb-5 font-medium" style={{ opacity: 0.8 }}>
                    {plan.unitPrice}
                  </p>

                  <Link
                    href="/sign-up"
                    className="w-full text-center text-sm font-semibold py-3 sm:py-2.5 rounded-full transition-all mb-5 min-h-[44px]"
                    style={{
                      background: plan.popular ? 'white' : 'var(--gradient-brand)',
                      color: plan.popular ? 'var(--brand-600)' : 'white',
                    }}
                  >
                    {plan.cta}
                  </Link>

                  <div className="flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex-shrink-0" style={{ color: plan.popular ? 'white' : 'var(--success)' }}>
                          <IconCheck />
                        </span>
                        <span style={{ opacity: plan.popular ? 0.95 : 0.8 }}>{f}</span>
                      </div>
                    ))}

                  </div>
                </div>
              ))}
            </div>
            {/* Mobile scroll hint */}
            <p className="md:hidden text-center text-xs mt-2" style={{ color: 'var(--muted)' }}>
              ← Deslize para ver todos os planos →
            </p>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="section relative overflow-hidden" style={{ background: 'var(--gradient-brand-soft)' }}>
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-400)' }} />
          
          <div className="container relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Sua próxima campanha está a uma{" "}
              <span className="gradient-text">foto de distância</span>.
            </h2>
            <p className="text-lg max-w-lg mx-auto mb-8" style={{ color: 'var(--muted)' }}>
              Comece com 5 campanhas por R$ 9,90. Modelo virtual, textos, hashtags — tudo incluso.
            </p>
            <Link href="/sign-up" className="btn-primary text-base !py-4 !px-10 hover:animate-pulse-glow" aria-label="Criar minha primeira campanha com IA">
              <IconZap />
              Criar minha primeira campanha
              <IconArrowRight />
            </Link>
          </div>
        </section>
      </main>

      {/* N3: Scroll-to-top FAB (mobile) */}
      <a
        href="#"
        className="fixed bottom-6 right-6 z-40 md:hidden w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
        style={{ background: 'var(--gradient-brand)', color: 'white', boxShadow: '0 4px 15px rgba(236,72,153,0.3)' }}
        aria-label="Voltar ao topo"
      >
        <IconChevronUp />
      </a>

      <Footer />
    </div>
  );
}
