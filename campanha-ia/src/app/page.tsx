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
            <a href="#vitrine" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Resultado</a>
            <a href="#como-funciona" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Como funciona</a>
            <a href="#precos" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Preços</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/sign-in" className="hidden sm:flex text-sm font-medium px-3 py-2 rounded-full transition min-h-[44px] items-center" style={{ color: 'var(--muted)' }}>
              Entrar
            </Link>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Link href="/sign-up" className="btn-primary w-full sm:w-auto text-sm !py-2.5 !px-4 sm:!py-2.5 sm:!px-5 min-h-[44px]">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Testar na prática</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ═══ HERO — VTO-first above the fold ═══ */}
        <section className="relative pt-24 pb-8 md:pt-36 md:pb-20 overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
          {/* Mesh gradient orbs */}
          <div className="absolute top-10 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.15] blur-[100px]" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full opacity-[0.08] blur-[120px]" style={{ background: 'var(--accent-400)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[80px]" style={{ background: 'var(--brand-300)' }} />
          
          <div className="container relative z-10">
            {/* ── Mobile Layout: text + compact VTO proof ── */}
            <div className="md:hidden text-center stagger-children">
              <div className="inline-flex items-center gap-2 badge badge-brand mb-3">
                <IconSparkles />
                <span>Virtual Try-On com IA</span>
              </div>

              <h1 className="text-[28px] font-bold tracking-tight leading-[1.1] mb-3">
                Sua roupa no corpo de uma{" "}
                <span className="gradient-text">modelo IA.</span>
              </h1>

              <p className="text-base leading-relaxed mb-6 max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
                Foto da peça → campanha completa.{" "}
                <strong style={{ color: 'var(--foreground)' }}>Modelo virtual, legendas e score</strong> — pronto pra postar.
              </p>

              {/* ── VTO Proof Card (mobile "aha moment") ── */}
              <div className="mb-6 mx-auto max-w-xs animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="rounded-2xl overflow-hidden" style={{ 
                  background: 'var(--surface)', 
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 40px rgba(236,72,153,0.12), var(--shadow-lg)',
                }}>
                  {/* VTO visual strip */}
                  <div className="relative" style={{ aspectRatio: '4/3', background: 'linear-gradient(135deg, var(--brand-100), var(--accent-100))' }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{
                          background: 'var(--gradient-brand)',
                          color: 'white',
                          boxShadow: '0 8px 32px rgba(236,72,153,0.35)',
                        }}>
                          <IconShirt />
                        </div>
                        <p className="text-xs font-bold" style={{ color: 'var(--brand-700)' }}>
                          Foto → Modelo Virtual
                        </p>
                      </div>
                    </div>
                    {/* Floating badges */}
                    <div className="absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(8px)' }}>
                      📷 Antes
                    </div>
                    <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'var(--gradient-brand)', color: 'white' }}>
                      ✨ Depois
                    </div>
                  </div>
                  {/* Smart caption preview */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>
                        <IconSparkles />
                      </div>
                      <span className="text-[11px] font-semibold">Legenda gerada pela IA</span>
                      <span className="ml-auto text-[11px] font-black gradient-text">94/100</span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                      ✨ Elegância que fala por si. Vestido midi em viscose premium — caimento fluido, decote transpassado e toque acetinado. Peça única. 💎
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>Alta Conversão</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-100)', color: 'var(--accent-600)' }}>Copy Persuasivo</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>Meta Aprovado</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                <Link href="/sign-up" className="btn-primary w-full text-sm !py-3.5 hover:animate-pulse-glow" aria-label="Testar CriaLook por R$ 9,90">
                  <IconZap />
                  Testar por R$ 9,90
                </Link>
                <a href="#vitrine" className="btn-secondary w-full text-sm !py-3">
                  Ver resultado real
                  <IconArrowRight />
                </a>
              </div>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-4 mt-6 text-[11px]" style={{ color: 'var(--muted)' }}>
                <span className="flex items-center gap-1"><span style={{ color: 'var(--success)' }}>✔</span> Via PIX</span>
                <span className="flex items-center gap-1"><span style={{ color: 'var(--success)' }}>✔</span> Sem assinatura</span>
                <span className="flex items-center gap-1"><span style={{ color: 'var(--success)' }}>✔</span> Cancele quando quiser</span>
              </div>
            </div>

            {/* ── Desktop Layout: side-by-side hero ── */}
            <div className="hidden md:grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left — Copy */}
              <div className="stagger-children">
                <div className="inline-flex items-center gap-2 badge badge-brand mb-6">
                  <IconSparkles />
                  <span>Virtual Try-On com IA</span>
                </div>

                <h1 className="text-4xl lg:text-[56px] font-bold tracking-tight leading-[1.06] mb-6">
                  Sua roupa no corpo{" "}
                  <span className="gradient-text">de uma modelo IA.</span>
                </h1>

                <p className="text-lg lg:text-xl leading-relaxed mb-8 max-w-lg" style={{ color: 'var(--muted)' }}>
                  Só com uma foto da peça, a IA veste a modelo virtual, gera legendas persuasivas com terminologia de moda e score de conversão —{" "}
                  <strong style={{ color: 'var(--foreground)' }}>campanha pronta pra postar</strong>.
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-8">
                  <Link href="/sign-up" className="btn-primary text-base !py-3.5 !px-8 hover:animate-pulse-glow" aria-label="Testar CriaLook por R$ 9,90">
                    <IconZap />
                    Testar por R$ 9,90 — 5 campanhas
                  </Link>
                  <a href="#vitrine" className="btn-secondary text-base !py-3.5 !px-8">
                    Ver resultado real
                    <IconArrowRight />
                  </a>
                </div>

                <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--muted)' }}>
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

              {/* Right — Browser Mockup with VTO proof */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="relative rounded-2xl overflow-hidden" style={{ 
                  background: 'var(--surface)', 
                  border: '1px solid var(--border)',
                  boxShadow: '0 20px 80px rgba(236,72,153,0.1), 0 8px 30px rgba(0,0,0,0.08)',
                }}>
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: '#10b981' }} />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="h-7 rounded-lg px-3 flex items-center text-xs" style={{ background: 'var(--background)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        crialook.com.br/gerar
                      </div>
                    </div>
                  </div>
                  {/* App content mockup */}
                  <div className="p-6 lg:p-8">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left — Upload visual */}
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--brand-500)' }}>
                          Foto original
                        </div>
                        <div className="rounded-xl flex flex-col items-center justify-center gap-3" style={{ 
                          aspectRatio: '3/4',
                          background: 'linear-gradient(180deg, var(--brand-50), var(--surface))',
                          border: '2px dashed var(--brand-200)',
                        }}>
                          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--brand-100)', color: 'var(--brand-500)' }}>
                            <IconCamera />
                          </div>
                          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Arraste a foto aqui</p>
                        </div>
                      </div>
                      {/* Right — AI Result */}
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-500)' }}>
                          Resultado IA
                        </div>
                        <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '3/4', background: 'linear-gradient(180deg, var(--accent-50), var(--surface))', border: '1px solid var(--border)' }}>
                          <div className="h-full flex flex-col items-center justify-center gap-2 p-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-brand)', color: 'white', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}>
                              <IconShirt />
                            </div>
                            <p className="text-[11px] font-bold text-center" style={{ color: 'var(--accent-700)' }}>Modelo IA vestindo a peça</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Result cards */}
                    <div className="mt-5 space-y-3">
                      <div className="rounded-xl p-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <IconInstagram />
                          <span className="text-xs font-bold">Instagram Feed</span>
                          <span className="ml-auto text-xs font-black gradient-text">94/100</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                          ✨ Elegância atemporal. Vestido midi em viscose premium, caimento solto e acabamento acetinado. Peça que transita do escritório ao happy hour com naturalidade.
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)' }}>Alta Conversão</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>Meta Aprovado ✓</span>
                        </div>
                      </div>
                      <div className="rounded-xl p-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span style={{ color: '#25d366' }}><IconWhatsApp /></span>
                          <span className="text-xs font-bold">WhatsApp</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                          Oi! ✨ Olha que peça maravilhosa acabou de chegar — vestido midi em viscose com toque acetinado. Super elegante e confortável. R$ 189,90 💎 Mando mais fotos? 📲
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ VITRINE ANTES/DEPOIS ═══ */}
        <div id="vitrine">
          <ShowcaseSectionLoader />
        </div>

        {/* ═══ COMO FUNCIONA ═══ */}
        <section id="como-funciona" className="section" style={{ background: 'var(--background)' }}>
          <div className="container">
            <div className="text-center mb-12 md:mb-16">
              <div className="badge badge-brand mb-4 inline-flex">3 passos simples</div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                De uma foto a uma <span className="gradient-text">campanha completa</span>
              </h2>
              <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Nenhum conhecimento técnico. Sem Photoshop. Sem agência.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto stagger-children">
              {steps.map((step, i) => (
                <div key={step.number} className="relative text-center group">
                  {/* Connector line between steps (mobile) */}
                  {i < steps.length - 1 && (
                    <div className="md:hidden absolute left-1/2 -translate-x-1/2 -bottom-4 w-px h-5" style={{ borderLeft: '2px dashed var(--brand-300)', opacity: 0.4 }} />
                  )}
                  {/* Step number */}
                  <div className="text-5xl md:text-7xl font-black mb-4 opacity-[0.05]" style={{ color: 'var(--brand-500)' }}>
                    {step.number}
                  </div>
                  {/* Icon */}
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 -mt-14 md:-mt-16 relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg" style={{ 
                    background: 'var(--gradient-brand)', 
                    color: 'white',
                    boxShadow: '0 8px 25px rgba(236,72,153,0.25)'
                  }}>
                    {step.icon}
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ BENEFÍCIOS — Bento Grid ═══ */}
        <section id="beneficios" className="section" style={{ background: 'var(--surface)' }}>
          <div className="container">
            <div className="text-center mb-12 md:mb-16">
              <div className="badge badge-brand mb-4 inline-flex">Tudo incluso</div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
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
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">Feature principal</div>
                <h3 className="text-lg md:text-xl font-bold mb-2">Modelo Virtual</h3>
                <p className="text-xs md:text-sm leading-relaxed opacity-90">
                  Sua roupa vestida em uma modelo IA realista. Sem fotógrafo, sem estúdio — Virtual Try-On.
                </p>
                <div className="mt-3">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    ✨ Powered by Fashn AI
                  </span>
                </div>
              </div>

              {/* 5 cards normais */}
              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{
                  background: 'var(--brand-100)', color: 'var(--brand-600)',
                }}>
                  <IconTarget />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Legendas que vendem</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  IA treinada em copy de moda brasileiro. Headlines, legendas e mensagens WhatsApp.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{
                  background: 'var(--brand-100)', color: 'var(--brand-600)',
                }}>
                  <IconBarChart />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Score de conversão</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Nota de 0 a 100: persuasão, clareza, Meta Ads. Saiba o que melhorar.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{
                  background: 'var(--brand-100)', color: 'var(--brand-600)',
                }}>
                  <IconCamera />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Só uma foto</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Fotografe com o celular. A IA isola o produto, analisa tecido e caimento.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{
                  background: 'var(--brand-100)', color: 'var(--brand-600)',
                }}>
                  <IconShield />
                </div>
                <h3 className="text-sm md:text-base font-bold mb-1">Compliance Meta</h3>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  Alertas sobre políticas do Meta Ads. Zero risco de bloqueio.
                </p>
              </div>

              <div className="card-brand group cursor-default rounded-2xl">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{
                  background: 'var(--brand-100)', color: 'var(--brand-600)',
                }}>
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

        {/* ═══ PRICING ═══ */}
        <section id="precos" className="section" style={{ background: 'var(--gradient-brand-soft)' }}>
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
                background: 'var(--background)',
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

            <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto overflow-x-auto snap-x snap-mandatory pb-6 md:overflow-visible md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scroll-pl-4 items-stretch" style={{ WebkitOverflowScrolling: "touch" }}>
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
        <section className="section relative overflow-hidden" style={{ background: 'var(--background)' }}>
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-400)' }} />
          
          <div className="container relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Sua próxima campanha está a uma{" "}
              <span className="gradient-text">foto de distância</span>.
            </h2>
            <p className="text-lg max-w-lg mx-auto mb-8" style={{ color: 'var(--muted)' }}>
              Comece com 5 campanhas por R$ 9,90. Modelo virtual, legendas inteligentes, hashtags — tudo incluso.
            </p>
            <Link href="/sign-up" className="btn-primary text-base !py-4 !px-10 hover:animate-pulse-glow" aria-label="Criar minha primeira campanha com IA">
              <IconZap />
              Criar minha primeira campanha
              <IconArrowRight />
            </Link>
          </div>
        </section>
      </main>

      {/* N3: Sticky CTA de Conversão (mobile) */}
      <Link
        href="/sign-up"
        className="fixed bottom-6 left-4 right-4 z-40 md:hidden h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 gap-2 font-bold"
        style={{ background: 'var(--gradient-brand)', color: 'white', boxShadow: '0 8px 25px rgba(236,72,153,0.4)' }}
      >
        <IconZap />
        Testar CriaLook por R$ 9,90
      </Link>

      <Footer />
    </div>
  );
}
