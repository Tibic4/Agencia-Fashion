import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Encarregado (DPO) — CriaLook",
  description:
    "Canal do Encarregado pelo Tratamento de Dados Pessoais (DPO) do CriaLook, conforme art. 41 da LGPD.",
};

export default function DpoPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-1.5">
            <Image src="/logo.webp" alt="CriaLook" width={44} height={44} className="rounded-full" priority />
            <span className="text-lg font-bold">Cria<span className="gradient-text">Look</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-up" className="btn-primary text-sm !py-2 !px-4 min-h-[40px] flex items-center">
              Começar
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 sm:pt-28 md:pt-36 pb-12 sm:pb-16 md:pb-24">
        <div className="container max-w-3xl">
          {/* Header */}
          <div className="mb-10 md:mb-14">
            <div className="badge badge-brand mb-4 inline-flex text-xs">Legal · LGPD</div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Encarregado pelo Tratamento de Dados Pessoais (DPO)
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Canal de comunicação previsto no art. 41 da Lei 13.709/2018 (LGPD)
            </p>
          </div>

          {/* Cartão do DPO */}
          <section
            className="rounded-xl p-5 md:p-7 mb-6"
            style={{
              background: "color-mix(in srgb, var(--brand-500) 6%, var(--surface))",
              border: "1px solid color-mix(in srgb, var(--brand-500) 40%, var(--border))",
            }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>
              Contato do Encarregado
            </h2>
            <dl className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="font-semibold w-40" style={{ color: "var(--foreground)" }}>
                  Nome do Encarregado
                </dt>
                <dd>Alton Jorge de Souza Vieira</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="font-semibold w-40" style={{ color: "var(--foreground)" }}>
                  E-mail
                </dt>
                <dd>
                  <a href="mailto:contato@crialook.com.br" className="underline hover:opacity-80">
                    contato@crialook.com.br
                  </a>
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="font-semibold w-40" style={{ color: "var(--foreground)" }}>
                  Endereço para correspondência
                </dt>
                <dd>[REDACTED-ENDERECO] — [REDACTED] — Patrocínio/MG (A/C: Alton Jorge de Souza Vieira)</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="font-semibold w-40" style={{ color: "var(--foreground)" }}>
                  Controlador
                </dt>
                <dd>
                  Alton Jorge de Souza Vieira (pessoa física) — CPF [REDACTED-CPF]
                </dd>
              </div>
            </dl>
          </section>

          {/* Competências */}
          <section className="surface-card p-5 md:p-6 mb-6">
            <h2 className="text-base md:text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>
              Competências do Encarregado (art. 41, §2º, LGPD)
            </h2>
            <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1.5" style={{ color: "var(--muted)" }}>
              <li>Receber reclamações e comunicações dos titulares, prestar esclarecimentos e adotar providências;</li>
              <li>Receber comunicações da ANPD e adotar providências;</li>
              <li>Orientar os colaboradores sobre práticas a serem tomadas em relação à proteção de dados pessoais;</li>
              <li>Executar as demais atribuições determinadas pelo Controlador ou estabelecidas em normas complementares.</li>
            </ul>
          </section>

          {/* Como exercer direitos */}
          <section className="surface-card p-5 md:p-6 mb-6">
            <h2 className="text-base md:text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>
              Como exercer seus direitos (art. 18 LGPD)
            </h2>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--muted)" }}>
              Qualquer titular pode solicitar ao Encarregado: confirmação da existência de tratamento; acesso aos dados;
              correção; anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos; portabilidade;
              eliminação de dados tratados com consentimento; informação sobre compartilhamentos; e revogação de consentimento.
            </p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--muted)" }}>
              O prazo de resposta é de até 15 (quinze) dias, conforme art. 19, §3º, da LGPD. Requisições podem ser feitas:
            </p>
            <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1.5" style={{ color: "var(--muted)" }}>
              <li>
                Pelo painel da conta em <code className="px-1 rounded" style={{ background: "var(--background)" }}>/conta</code>
                {" "}(endpoints <code className="px-1 rounded" style={{ background: "var(--background)" }}>/api/me</code>
                {" "}e <code className="px-1 rounded" style={{ background: "var(--background)" }}>/api/me/export</code>);
              </li>
              <li>
                Por e-mail a <a href="mailto:contato@crialook.com.br" className="underline">contato@crialook.com.br</a>;
              </li>
              <li>Por carta registrada ao endereço acima informado.</li>
            </ul>
          </section>

          {/* ANPD */}
          <section className="surface-card p-5 md:p-6 mb-6">
            <h2 className="text-base md:text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>
              Reclamação à ANPD
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              O titular tem direito de peticionar, a qualquer momento, à Autoridade Nacional de Proteção de Dados (ANPD),
              especialmente se entender que sua solicitação não foi adequadamente atendida. Canal oficial:{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="underline">
                www.gov.br/anpd
              </a>
              .
            </p>
          </section>

          {/* Back link */}
          <div className="mt-10 text-center">
            <Link
              href="/privacidade"
              className="text-sm font-medium inline-flex items-center gap-1.5 transition-colors hover:opacity-80"
              style={{ color: "var(--brand-500)" }}
            >
              ← Ver Política de Privacidade
            </Link>
          </div>
        </div>
      </main>

      <Footer useLinks />
    </div>
  );
}
