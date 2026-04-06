import Link from "next/link";
import Image from "next/image";
import ShowcaseSection from "@/components/ShowcaseSection";

/* ═══════════════════════════════════════
   Icons (inline SVGs to avoid deps)
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
const IconSparkles = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);
const IconShirt = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
);
const IconTarget = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
const IconBarChart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
const IconClock = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
);
const IconUsers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const IconArrowRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
const IconInstagram = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
);
const IconWhatsApp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);


/* ═══════════════════════════════════════
   Plans data
   ═══════════════════════════════════════ */
const plans = [
  {
    name: "Starter",
    price: 59,
    badge: "⭐",
    popular: false,
    campaigns: 15,
    channels: "Todos (4)",
    models: 1,
    regen: 2,
    history: "90 dias",
    features: ["Score completo", "1 modelo virtual", "2 regenerações/camp", "Suporte email"],
    notIncluded: ["Link de prévia", "Marca branca"],
  },
  {
    name: "Pro",
    price: 129,
    badge: "🚀",
    popular: true,
    campaigns: 40,
    channels: "Todos (4)",
    models: 2,
    regen: 3,
    history: "1 ano",
    features: ["Score completo", "2 modelos virtuais", "3 regenerações/camp", "Link de prévia", "Suporte email"],
    notIncluded: ["Marca branca"],
  },
  {
    name: "Business",
    price: 249,
    badge: "🏢",
    popular: false,
    campaigns: 85,
    channels: "Todos (4)",
    models: 3,
    regen: 3,
    history: "Ilimitado",
    features: ["Tudo do Pro", "3 modelos virtuais", "Modelo + fundo profissional", "3 regenerações/camp", "Histórico ilimitado", "Suporte WhatsApp"],
    notIncluded: ["Marca branca"],
  },
  {
    name: "Agência",
    price: 499,
    badge: "🏆",
    popular: false,
    campaigns: 170,
    channels: "Todos (4)",
    models: 5,
    regen: 3,
    history: "Ilimitado",
    features: ["Tudo do Business", "5 modelos virtuais", "Modelo + fundo profissional", "Marca branca", "API pública", "Suporte prioritário"],
    notIncluded: [],
  },
];

const benefits = [
  {
    icon: <IconClock />,
    title: "60 segundos",
    description: "Do upload da foto à campanha completa pronta para postar. Sem espera.",
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
    description: "Em 60 segundos: textos, criativos com modelo virtual, hashtags e score de qualidade.",
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
            <Link href="/sign-in" className="hidden sm:inline-flex text-sm font-medium px-4 py-2 rounded-full transition" style={{ color: 'var(--muted)' }}>
              Entrar
            </Link>
            <Link href="/sign-up" className="btn-primary text-sm !py-2 !px-3 sm:!py-2.5 sm:!px-5">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Testar na prática</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ═══ HERO ═══ */}
        <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
          {/* Decorative elements */}
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-400)' }} />
          
          <div className="container relative z-10">
            <div className="max-w-3xl mx-auto text-center stagger-children">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 badge badge-brand mb-6">
                <IconSparkles />
                <span>Feito para lojistas de moda</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                Foto da roupa.{" "}
                <span className="gradient-text">Campanha pronta.</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'var(--muted)' }}>
                Tire uma foto da peça, informe o preço — a IA gera textos, criativos com modelo virtual, 
                hashtags e score de qualidade em <strong style={{ color: 'var(--foreground)' }}>menos de 60 segundos</strong>.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up" className="btn-primary text-base !py-3.5 !px-8 animate-pulse-glow">
                  <IconZap />
                  Testar na prática — a partir de R$ 9,90
                </Link>
                <a href="#como-funciona" className="btn-secondary text-base !py-3.5 !px-8">
                  Ver como funciona
                  <IconArrowRight />
                </a>
              </div>

              {/* Social proof */}
              <div className="flex items-center justify-center gap-6 mt-10 text-sm" style={{ color: 'var(--muted)' }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--success)' }}>●</span>
                  <span>Pague via PIX</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--success)' }}>●</span>
                  <span>Setup em 2 minutos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--success)' }}>●</span>
                  <span>Cancele quando quiser</span>
                </div>
              </div>
            </div>

            {/* Hero Visual — App Preview Mockup */}
            <div className="mt-16 md:mt-20 max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
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
              {steps.map((step) => (
                <div key={step.number} className="relative text-center group">
                  {/* Step number */}
                  <div className="text-7xl font-black mb-4 opacity-5" style={{ color: 'var(--brand-500)' }}>
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

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto stagger-children">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="card-brand group cursor-default">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{
                    background: 'var(--brand-100)',
                    color: 'var(--brand-600)',
                  }}>
                    {benefit.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ VITRINE ANTES/DEPOIS ═══ */}
        <ShowcaseSection />

        {/* ═══ PRICING ═══ */}
        <section id="precos" className="section" style={{ background: 'var(--background)' }}>
          <div className="container">
            <div className="text-center mb-16">
              <div className="badge badge-brand mb-4 inline-flex">Planos</div>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Teste na prática, <span className="gradient-text">escale quando quiser</span>
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
                Comece com 3 campanhas por R$ 9,90. Gostou? Assine e pague menos por campanha.
              </p>
            </div>

            {/* Trial Pack */}
            <div className="max-w-lg mx-auto mb-12">
              <div className="rounded-2xl p-6 text-center transition-all hover:-translate-y-1" style={{
                background: 'var(--gradient-brand-soft)',
                border: '2px solid var(--brand-300)',
                boxShadow: 'var(--shadow-lg)',
              }}>
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="text-xl font-bold mb-1">Teste na Prática</h3>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-3xl font-black">R$ 9,90</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>único</span>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                  3 campanhas completas com modelo virtual • Sem mensalidade
                </p>
                <Link href="/sign-up" className="btn-primary w-full !py-3 text-base animate-pulse-glow">
                  <IconZap />
                  Começar por R$ 9,90
                </Link>
                <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                  Pague via PIX ou cartão • Créditos não expiram
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 max-w-md mx-auto mb-12">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>ou assine e pague menos</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className="relative flex flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: plan.popular ? 'var(--gradient-brand)' : 'var(--surface)',
                    border: plan.popular ? 'none' : '1px solid var(--border)',
                    boxShadow: plan.popular ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                    color: plan.popular ? 'white' : 'var(--foreground)',
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full" style={{
                      background: 'white',
                      color: 'var(--brand-600)',
                    }}>
                      Mais popular
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

                  <p className="text-sm mb-5 opacity-70">
                    {plan.campaigns} campanhas/mês
                  </p>

                  <Link
                    href="/sign-up"
                    className="w-full text-center text-sm font-semibold py-2.5 rounded-full transition-all mb-5"
                    style={{
                      background: plan.popular ? 'white' : 'var(--gradient-brand)',
                      color: plan.popular ? 'var(--brand-600)' : 'white',
                    }}
                  >
                    Assinar agora
                  </Link>

                  <div className="flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5 flex-shrink-0" style={{ color: plan.popular ? 'white' : 'var(--success)' }}>
                          <IconCheck />
                        </span>
                        <span style={{ opacity: plan.popular ? 0.95 : 0.8 }}>{f}</span>
                      </div>
                    ))}
                    {plan.notIncluded.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-xs opacity-40">
                        <span className="mt-0.5 flex-shrink-0">
                          <IconX />
                        </span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA FINAL ═══ */}
        <section className="section relative overflow-hidden" style={{ background: 'var(--gradient-brand-soft)' }}>
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--brand-400)' }} />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-400)' }} />
          
          <div className="container relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Pronto para vender <span className="gradient-text">mais</span>?
            </h2>
            <p className="text-lg max-w-lg mx-auto mb-8" style={{ color: 'var(--muted)' }}>
              Teste com 3 campanhas por R$ 9,90. Sem compromisso, sem mensalidade, sem complicação.
            </p>
            <Link href="/sign-up" className="btn-primary text-base !py-4 !px-10 animate-pulse-glow">
              <IconZap />
              Criar minha primeira campanha
              <IconArrowRight />
            </Link>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12" style={{ background: 'var(--gray-950)', color: 'var(--gray-400)' }}>
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
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
              <div className="space-y-2 text-sm">
                <a href="#como-funciona" className="block hover:text-white transition">Como funciona</a>
                <a href="#precos" className="block hover:text-white transition">Preços</a>
                <a href="#beneficios" className="block hover:text-white transition">Benefícios</a>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Legal</h4>
              <div className="space-y-2 text-sm">
                <Link href="/termos" className="block hover:text-white transition">Termos de Uso</Link>
                <Link href="/privacidade" className="block hover:text-white transition">Privacidade</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Contato</h4>
              <div className="space-y-2 text-sm">
                <a href="mailto:contato@crialook.com.br" className="block hover:text-white transition">contato@crialook.com.br</a>
                <Link href="/sobre" className="block hover:text-white transition">Sobre nós</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 text-center text-xs" style={{ borderTop: '1px solid var(--gray-800)' }}>
            © {new Date().getFullYear()} CriaLook. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
