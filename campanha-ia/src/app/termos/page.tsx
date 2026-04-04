import Link from "next/link";

export const metadata = { title: "Termos de Uso — CriaLook" };

export default function Termos() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-brand)", color: "white" }}>✨</div>
            <span className="text-lg font-bold">Campanha <span className="gradient-text">IA</span></span>
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-20">
        <div className="container max-w-3xl">
          <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
          <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Última atualização: Abril 2026</p>
          <div className="prose space-y-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>1. Aceitação dos Termos</h2>
            <p>Ao acessar e usar o CriaLook, você concorda com estes termos de uso. Se não concordar, não utilize o serviço.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>2. Descrição do Serviço</h2>
            <p>O CriaLook é uma plataforma SaaS que utiliza inteligência artificial para gerar campanhas de marketing a partir de fotos de produtos de moda. O serviço inclui geração de textos, criativos visuais e análise de qualidade.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>3. Conta do Usuário</h2>
            <p>Você é responsável por manter a segurança de sua conta e senha. Notifique-nos imediatamente sobre qualquer uso não autorizado.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>4. Uso Aceitável</h2>
            <p>Você concorda em não usar o serviço para gerar conteúdo ilegal, ofensivo, discriminatório ou que viole direitos de terceiros. Imagens enviadas devem ser de produtos seus ou com autorização.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>5. Propriedade Intelectual</h2>
            <p>O conteúdo gerado pela IA é de uso exclusivo do cliente. O CriaLook não reivindica propriedade sobre os criativos gerados.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>6. Pagamentos e Reembolsos</h2>
            <p>Os planos são cobrados mensalmente via Stripe. Cancelamentos são efetivos no próximo ciclo de faturamento. Créditos extras não são reembolsáveis.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>7. Limitação de Responsabilidade</h2>
            <p>O CriaLook não garante resultados específicos de vendas. O conteúdo gerado por IA deve ser revisado pelo usuário antes de publicação.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
        <div className="container">© {new Date().getFullYear()} CriaLook.</div>
      </footer>
    </div>
  );
}
