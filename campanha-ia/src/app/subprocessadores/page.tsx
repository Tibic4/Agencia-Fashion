import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Subprocessadores — CriaLook",
  description:
    "Lista pública e atualizada dos subprocessadores (operadores) utilizados pelo CriaLook, em conformidade com a LGPD.",
};

type SubProcessor = {
  name: string;
  country: string;
  purpose: string;
  legalBasis: string;
  dataTypes: string;
  policy: string;
};

const subprocessors: SubProcessor[] = [
  {
    name: "Clerk Inc.",
    country: "Estados Unidos",
    purpose: "Autenticação, gestão de contas e sessões",
    legalBasis: "Execução de contrato (art. 7º, V, LGPD)",
    dataTypes: "Nome, e-mail, senha (hash), IP, user-agent, metadados de sessão",
    policy: "https://clerk.com/privacy",
  },
  {
    name: "Supabase Inc.",
    country: "Estados Unidos (região configurável)",
    purpose: "Banco de dados relacional e armazenamento de objetos",
    legalBasis: "Execução de contrato (art. 7º, V)",
    dataTypes: "Dados cadastrais, imagens enviadas, campanhas geradas, metadados",
    policy: "https://supabase.com/privacy",
  },
  {
    name: "Anthropic PBC",
    country: "Estados Unidos",
    purpose: "Geração de textos publicitários via IA (Claude)",
    legalBasis: "Execução de contrato (art. 7º, V)",
    dataTypes: "Prompts (contendo descrição da peça, público-alvo, tom), não envia imagens de pessoas",
    policy: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Google LLC",
    country: "Estados Unidos",
    purpose: "Análise e geração de imagens via IA (Gemini API)",
    legalBasis: "Execução de contrato (art. 7º, V)",
    dataTypes: "Imagens de produtos e, quando aplicável, imagens enviadas pelo titular para geração",
    policy: "https://policies.google.com/privacy",
  },
  {
    name: "Mercado Pago (MercadoLibre)",
    country: "Brasil",
    purpose: "Processamento de pagamentos (PIX, cartão, boleto)",
    legalBasis: "Execução de contrato e obrigação legal fiscal (art. 7º, II e V)",
    dataTypes: "Nome, CPF (do pagador), dados de pagamento, endereço de faturamento",
    policy: "https://www.mercadopago.com.br/privacidade",
  },
  {
    name: "PostHog Inc.",
    country: "Estados Unidos / União Europeia",
    purpose: "Analytics de produto (funis, eventos, experimentos)",
    legalBasis: "Consentimento (art. 7º, I) — opt-in via banner de cookies",
    dataTypes: "Eventos de uso, identificador de sessão, IP (truncado), user-agent",
    policy: "https://posthog.com/privacy",
  },
  {
    name: "Functional Software, Inc. (Sentry)",
    country: "Estados Unidos",
    purpose: "Monitoramento de erros e estabilidade",
    legalBasis: "Legítimo interesse (art. 7º, IX)",
    dataTypes: "Stack traces, mensagens de erro, IP, identificador de sessão",
    policy: "https://sentry.io/privacy/",
  },
  {
    name: "Cloudflare, Inc.",
    country: "Estados Unidos (rede global)",
    purpose: "CDN, WAF e proteção contra ataques (DDoS, bots)",
    legalBasis: "Legítimo interesse (segurança — art. 7º, IX)",
    dataTypes: "Endereço IP, user-agent, metadados de requisição",
    policy: "https://www.cloudflare.com/privacypolicy/",
  },
];

export default function SubprocessadoresPage() {
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
        <div className="container max-w-5xl">
          {/* Header */}
          <div className="mb-10 md:mb-14">
            <div className="badge badge-brand mb-4 inline-flex text-xs">Legal · Transparência</div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">Subprocessadores</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Lista pública e atualizada dos operadores que tratam dados pessoais em nome do CriaLook, nos termos do
              art. 5º, VII, da LGPD. Última atualização: 2026-04-24.
            </p>
          </div>

          {/* Aviso */}
          <div
            className="rounded-xl p-4 sm:p-5 mb-8 text-xs"
            style={{
              background: "color-mix(in srgb, var(--brand-500) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--brand-500) 30%, transparent)",
              color: "var(--foreground)",
            }}
          >
            <strong>Transferência internacional de dados.</strong> Vários subprocessadores estão sediados fora do Brasil.
            Essas transferências são realizadas com base em cláusulas contratuais específicas e demais garantias do art.
            33 da LGPD. Ao utilizar a Plataforma, o titular reconhece e concorda com essas transferências.
          </div>

          {/* Tabela em cards (mobile) e tabela (desktop) */}
          <div className="space-y-4 md:hidden">
            {subprocessors.map((p) => (
              <article key={p.name} className="surface-card p-4">
                <h2 className="text-base font-bold mb-2" style={{ color: "var(--foreground)" }}>
                  {p.name}
                </h2>
                <dl className="text-xs space-y-1.5" style={{ color: "var(--muted)" }}>
                  <div>
                    <dt className="inline font-semibold" style={{ color: "var(--foreground)" }}>
                      País:{" "}
                    </dt>
                    <dd className="inline">{p.country}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold" style={{ color: "var(--foreground)" }}>
                      Finalidade:{" "}
                    </dt>
                    <dd className="inline">{p.purpose}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold" style={{ color: "var(--foreground)" }}>
                      Dados tratados:{" "}
                    </dt>
                    <dd className="inline">{p.dataTypes}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold" style={{ color: "var(--foreground)" }}>
                      Base legal:{" "}
                    </dt>
                    <dd className="inline">{p.legalBasis}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold" style={{ color: "var(--foreground)" }}>
                      Política:{" "}
                    </dt>
                    <dd className="inline">
                      <a href={p.policy} target="_blank" rel="noopener noreferrer" className="underline">
                        {p.policy}
                      </a>
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="surface-card hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ color: "var(--muted)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
                    <th className="text-left font-semibold px-4 py-3" style={{ color: "var(--foreground)" }}>
                      Subprocessador
                    </th>
                    <th className="text-left font-semibold px-4 py-3" style={{ color: "var(--foreground)" }}>
                      País
                    </th>
                    <th className="text-left font-semibold px-4 py-3" style={{ color: "var(--foreground)" }}>
                      Finalidade
                    </th>
                    <th className="text-left font-semibold px-4 py-3" style={{ color: "var(--foreground)" }}>
                      Dados tratados
                    </th>
                    <th className="text-left font-semibold px-4 py-3" style={{ color: "var(--foreground)" }}>
                      Base legal
                    </th>
                    <th className="text-left font-semibold px-4 py-3" style={{ color: "var(--foreground)" }}>
                      Política
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subprocessors.map((p, i) => (
                    <tr
                      key={p.name}
                      style={{
                        borderBottom:
                          i === subprocessors.length - 1 ? "none" : "1px solid var(--border)",
                      }}
                    >
                      <td className="align-top px-4 py-3 font-semibold" style={{ color: "var(--foreground)" }}>
                        {p.name}
                      </td>
                      <td className="align-top px-4 py-3">{p.country}</td>
                      <td className="align-top px-4 py-3">{p.purpose}</td>
                      <td className="align-top px-4 py-3">{p.dataTypes}</td>
                      <td className="align-top px-4 py-3">{p.legalBasis}</td>
                      <td className="align-top px-4 py-3">
                        <a href={p.policy} target="_blank" rel="noopener noreferrer" className="underline">
                          Link
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notificação de mudanças */}
          <section className="surface-card p-5 md:p-6 mt-8">
            <h2 className="text-base md:text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>
              Alterações na lista
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Alterações na lista de subprocessadores são comunicadas com antecedência mínima de 15 (quinze) dias por
              e-mail e/ou aviso destacado na Plataforma, salvo se a alteração for necessária por razões legais ou de
              segurança com urgência. O histórico de versões fica disponível sob demanda pelo canal{" "}
              <a href="mailto:contato@crialook.com.br" className="underline">
                contato@crialook.com.br
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
