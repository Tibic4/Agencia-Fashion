import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export const metadata = { title: "Termos de Uso — CriaLook" };

const sections = [
  {
    title: "1. Aceitação dos Termos",
    content: "Ao acessar e usar o CriaLook, você concorda com estes termos de uso. Se não concordar, não utilize o serviço.",
  },
  {
    title: "2. Descrição do Serviço",
    content: "O CriaLook é uma plataforma SaaS que utiliza inteligência artificial para gerar campanhas de marketing a partir de fotos de produtos de moda. O serviço inclui geração de textos, criativos visuais com modelo virtual (Virtual Try-On) e análise de qualidade com score de conversão.",
  },
  {
    title: "3. Conta do Usuário",
    content: "Você é responsável por manter a segurança de sua conta e senha. Notifique-nos imediatamente sobre qualquer uso não autorizado.",
  },
  {
    title: "4. Uso Aceitável",
    content: "Você concorda em não usar o serviço para gerar conteúdo ilegal, ofensivo, discriminatório ou que viole direitos de terceiros. Imagens enviadas devem ser de produtos seus ou com autorização.",
  },
  {
    title: "5. Propriedade Intelectual",
    content: "O conteúdo gerado pela IA é de uso exclusivo do cliente. O CriaLook não reivindica propriedade sobre os criativos gerados.",
  },
  {
    title: "6. Pagamentos e Reembolsos",
    content: "Os planos são cobrados mensalmente via Mercado Pago (PIX, cartão ou boleto). Cancelamentos são efetivos no próximo ciclo de faturamento. Créditos extras não são reembolsáveis.",
  },
  {
    title: "7. Limitação de Responsabilidade",
    content: "O CriaLook não garante resultados específicos de vendas. O conteúdo gerado por IA deve ser revisado pelo usuário antes de publicação.",
  },
];

export default function Termos() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.png" alt="CriaLook" width={44} height={44} className="rounded-full" priority />
            <span className="text-lg font-bold">Cria<span className="gradient-text">Look</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-up" className="btn-primary text-sm !py-2 !px-4 min-h-[40px] flex items-center">Começar</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-28 md:pt-36 pb-16 md:pb-24">
        <div className="container max-w-3xl">
          {/* Header */}
          <div className="mb-10 md:mb-14">
            <div className="badge badge-brand mb-4 inline-flex text-[11px]">Legal</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Termos de Uso</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Última atualização: Abril 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {sections.map((s) => (
              <div key={s.title} className="rounded-xl p-5 md:p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h2 className="text-base md:text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>{s.title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{s.content}</p>
              </div>
            ))}
          </div>

          {/* Back link */}
          <div className="mt-10 text-center">
            <Link href="/" className="text-sm font-medium inline-flex items-center gap-1.5 transition-colors hover:opacity-80" style={{ color: "var(--brand-500)" }}>
              ← Voltar para o início
            </Link>
          </div>
        </div>
      </main>

      <Footer useLinks />
    </div>
  );
}
