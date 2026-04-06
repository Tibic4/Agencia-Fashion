import Link from "next/link";
import Image from "next/image";

export default function Sobre() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.png" alt="CriaLook" width={52} height={52} className="rounded-full" />
            <span className="text-lg font-bold">Cria<span className="gradient-text">Look</span></span>
          </Link>
          <Link href="/sign-up" className="btn-primary text-sm !py-2 !px-3 sm:!py-2.5 sm:!px-5">
            <span className="sm:hidden">Começar</span>
            <span className="hidden sm:inline">Testar na prática</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-20">
        <div className="container max-w-3xl">
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
            <div className="rounded-2xl p-8 my-8" style={{ background: "var(--gradient-card)", border: "1px solid var(--border)" }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>Nossa missão</h2>
              <p className="text-lg italic">
                &ldquo;Democratizar o marketing de moda para que qualquer lojista brasileiro possa competir 
                com as grandes marcas — usando apenas o celular.&rdquo;
              </p>
            </div>
            <h2 className="text-2xl font-bold mt-10 mb-4" style={{ color: "var(--foreground)" }}>Como funciona</h2>
            <p>
              Usando inteligência artificial de ponta, transformamos 
              uma simples foto de produto em campanhas completas para Instagram, WhatsApp e Meta Ads — 
              com textos persuasivos, criativos com modelo virtual e score de qualidade.
            </p>
            <p>
              Tudo isso em menos de 60 segundos e por uma fração do custo de uma agência tradicional.
            </p>
            <h2 className="text-2xl font-bold mt-10 mb-4" style={{ color: "var(--foreground)" }}>Contato</h2>
            <p>
              📧 <a href="mailto:contato@crialook.com.br" className="gradient-text font-semibold">contato@crialook.com.br</a><br/>
              📱 WhatsApp: <a href="https://wa.me/553498223001" className="gradient-text font-semibold">(34) 9822-3001</a>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
        <div className="container">© {new Date().getFullYear()} CriaLook. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}
