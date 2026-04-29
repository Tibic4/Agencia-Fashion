import Link from "next/link";
import Footer from "@/components/Footer";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Excluir conta — CriaLook",
  description:
    "Como solicitar a exclusão da sua conta e dos seus dados no CriaLook.",
};

export default function ExcluirContaPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-50">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            CriaLook
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">
          Excluir minha conta
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          Esta página explica como solicitar a exclusão da sua conta CriaLook e
          dos dados associados, conforme a LGPD (art. 18, VI).
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">
            Opção 1 — Pelo aplicativo (recomendado)
          </h2>
          <ol className="list-decimal space-y-2 pl-6 text-gray-700 dark:text-gray-300">
            <li>Abra o app CriaLook e faça login.</li>
            <li>
              Vá em <strong>Configurações</strong> &rarr; role até o final.
            </li>
            <li>
              Toque em <strong>Excluir minha conta</strong>.
            </li>
            <li>
              Confirme digitando a palavra <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">EXCLUIR</code>.
            </li>
            <li>
              A exclusão é processada imediatamente e você será desconectado.
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">
            Opção 2 — Por e-mail
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Caso você não tenha mais acesso ao app, envie um e-mail para{" "}
            <a
              href="mailto:suporte@crialook.com.br?subject=Exclus%C3%A3o%20de%20conta"
              className="font-medium text-purple-600 underline dark:text-purple-400"
            >
              suporte@crialook.com.br
            </a>{" "}
            com o assunto <strong>“Exclusão de conta”</strong>. Inclua no corpo:
          </p>
          <ul className="list-disc space-y-1 pl-6 text-gray-700 dark:text-gray-300">
            <li>O e-mail cadastrado na sua conta CriaLook;</li>
            <li>O nome da loja (se lembrar);</li>
            <li>
              Confirmação de que está solicitando a exclusão definitiva.
            </li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300">
            A solicitação é atendida em até <strong>15 dias úteis</strong>.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">O que é excluído</h2>
          <ul className="list-disc space-y-1 pl-6 text-gray-700 dark:text-gray-300">
            <li>Conta de autenticação (e-mail, senha, perfil);</li>
            <li>Dados da loja (nome, segmento, logo, configurações);</li>
            <li>
              Modelos virtuais, fotos de produtos e campanhas geradas;
            </li>
            <li>Tokens de notificação push;</li>
            <li>Histórico de uso e preferências.</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">O que pode ser retido</h2>
          <p className="text-gray-700 dark:text-gray-300">
            Por obrigação legal, alguns dados podem ser mantidos por períodos
            específicos mesmo após a exclusão da conta:
          </p>
          <ul className="list-disc space-y-1 pl-6 text-gray-700 dark:text-gray-300">
            <li>
              <strong>Dados fiscais e de pagamento</strong> (notas fiscais,
              comprovantes): até 5 anos (art. 173, CTN);
            </li>
            <li>
              <strong>Logs de acesso/segurança</strong> (IP, identificadores de
              sessão): até 6 meses (art. 15, Marco Civil da Internet);
            </li>
            <li>
              <strong>Registros de exclusão</strong> (data, e-mail, motivo): até
              5 anos para comprovação de cumprimento da LGPD.
            </li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300">
            Esses dados ficam em ambiente segregado, sem uso comercial.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">Outras solicitações LGPD</h2>
          <p className="text-gray-700 dark:text-gray-300">
            Você também tem direito a acesso, correção, portabilidade e
            anonimização dos seus dados (art. 18 da LGPD). Detalhes na{" "}
            <Link
              href="/privacidade"
              className="font-medium text-purple-600 underline dark:text-purple-400"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
