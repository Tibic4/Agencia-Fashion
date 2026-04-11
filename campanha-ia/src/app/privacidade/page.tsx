import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export const metadata = { title: "Política de Privacidade — CriaLook" };

const sections = [
  {
    title: "1. Dados Coletados",
    content: "Coletamos: nome, email, dados da loja, fotos de produtos enviadas, e dados de uso do serviço. Dados de pagamento são processados diretamente pelo Mercado Pago e não armazenados por nós.",
  },
  {
    title: "2. Finalidade",
    content: "Seus dados são usados exclusivamente para: prestar o serviço de geração de campanhas, personalizar resultados, processar pagamentos e melhorar o produto.",
  },
  {
    title: "3. Processamento de Imagens",
    content: "As fotos enviadas são processadas pela API do Google Gemini exclusivamente para geração da campanha e Virtual Try-On. Não usamos suas imagens para treinar modelos.",
  },
  {
    title: "4. Armazenamento",
    content: "Seus dados são armazenados em servidores seguros (Supabase/AWS). Imagens são retidas conforme o período do seu plano e deletadas após o cancelamento.",
  },
  {
    title: "5. Compartilhamento",
    content: "Não vendemos nem compartilhamos seus dados pessoais. Compartilhamos apenas com provedores essenciais ao serviço (Mercado Pago, Clerk, provedores de IA).",
  },
  {
    title: "6. Seus Direitos (LGPD)",
    content: "Você tem direito a: acessar, corrigir, deletar seus dados, portabilidade, revogar consentimento e solicitar informações sobre compartilhamento. Contate-nos em contato@crialook.com.br.",
  },
  {
    title: "7. Cookies",
    content: "Usamos cookies essenciais para funcionamento do serviço e cookies de analytics (PostHog) para melhorar a experiência. Você pode desabilitá-los nas configurações do navegador.",
  },
];

export default function Privacidade() {
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
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Política de Privacidade</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Última atualização: Abril 2026 · Conforme LGPD (Lei 13.709/2018)</p>
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
