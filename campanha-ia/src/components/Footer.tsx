import Image from "next/image";
import Link from "next/link";

interface FooterProps {
  /** Use Link-based hrefs for internal navigation (e.g., from /sobre) */
  useLinks?: boolean;
  /** Current page identifier to avoid self-referencing links */
  currentPage?: string;
}

export default function Footer({ useLinks = false, currentPage }: FooterProps) {
  const productLinks = [
    { label: "Como funciona", href: useLinks ? "/#como-funciona" : "#como-funciona" },
    { label: "Preços", href: useLinks ? "/#precos" : "#precos" },
    { label: "Benefícios", href: useLinks ? "/#beneficios" : "#beneficios" },
  ];

  return (
    <footer className="py-8 sm:py-12" style={{ background: "var(--gray-950)", color: "var(--gray-400)" }}>
      <div className="container">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-8">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <Image src="/logo.webp" alt="CriaLook" width={40} height={40} className="rounded-full" />
              <span className="text-lg font-bold text-white">CriaLook</span>
            </div>
            <p className="text-sm leading-relaxed">
              Transforme fotos de roupa em campanhas de marketing completas com inteligência artificial.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Produto</h4>
            <div className="space-y-2 text-sm">
              {productLinks.map((link) =>
                useLinks ? (
                  <Link key={link.label} href={link.href} className="block hover:text-white transition py-2">
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.label} href={link.href} className="block hover:text-white transition py-2">
                    {link.label}
                  </a>
                )
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Legal &amp; Contato</h4>
            <div className="space-y-2 text-sm">
              <Link href="/termos" className="block hover:text-white transition py-2">Termos de Uso</Link>
              <Link href="/privacidade" className="block hover:text-white transition py-2">Privacidade</Link>
              <Link href="/dpo" className="block hover:text-white transition py-2">Encarregado (DPO)</Link>
              <Link href="/subprocessadores" className="block hover:text-white transition py-2">Subprocessadores</Link>
              <a href="mailto:contato@crialook.com.br" className="block hover:text-white transition py-2">contato@crialook.com.br</a>
              {currentPage !== "sobre" && (
                <Link href="/sobre" className="block hover:text-white transition py-2">Sobre nós</Link>
              )}
            </div>
          </div>
        </div>
        <div className="pt-8 text-center text-xs" style={{ borderTop: "1px solid var(--gray-800)" }}>
          © {new Date().getFullYear()} CriaLook. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
