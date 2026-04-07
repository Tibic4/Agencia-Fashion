import Link from "next/link";

export const metadata = { title: "Política de Privacidade — CriaLook" };

export default function Privacidade() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-brand)", color: "white" }}>✨</div>
            <span className="text-lg font-bold">Cria<span className="gradient-text">Look</span></span>
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-20">
        <div className="container max-w-3xl">
          <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
          <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Última atualização: Abril 2026 · Conforme LGPD (Lei 13.709/2018)</p>
          <div className="prose space-y-4 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>1. Dados Coletados</h2>
            <p>Coletamos: nome, email, dados da loja, fotos de produtos enviadas, e dados de uso do serviço. Dados de pagamento são processados diretamente pelo Mercado Pago e não armazenados por nós.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>2. Finalidade</h2>
            <p>Seus dados são usados exclusivamente para: prestar o serviço de geração de campanhas, personalizar resultados, processar pagamentos e melhorar o produto.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>3. Processamento de Imagens</h2>
            <p>As fotos enviadas são processadas por APIs de IA terceirizadas (Anthropic, Google Gemini, fal.ai) exclusivamente para geração da campanha. Não usamos suas imagens para treinar modelos.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>4. Armazenamento</h2>
            <p>Seus dados são armazenados em servidores seguros (Supabase/AWS). Imagens são retidas conforme o período do seu plano e deletadas após o cancelamento.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>5. Compartilhamento</h2>
            <p>Não vendemos nem compartilhamos seus dados pessoais. Compartilhamos apenas com provedores essenciais ao serviço (Mercado Pago, Clerk, provedores de IA).</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>6. Seus Direitos (LGPD)</h2>
            <p>Você tem direito a: acessar, corrigir, deletar seus dados, portabilidade, revogar consentimento e solicitar informações sobre compartilhamento. Contate-nos em contato@crialook.com.br.</p>
            <h2 className="text-lg font-bold mt-6" style={{ color: "var(--foreground)" }}>7. Cookies</h2>
            <p>Usamos cookies essenciais para funcionamento do serviço e cookies de analytics (PostHog) para melhorar a experiência. Você pode desabilitá-los nas configurações do navegador.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
        <div className="container">© {new Date().getFullYear()} CriaLook.</div>
      </footer>
    </div>
  );
}
