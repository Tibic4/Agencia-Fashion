import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Termo de Consentimento Biométrico — CriaLook",
  description:
    "Termo de Consentimento para tratamento de dados biométricos no Virtual Try-On, conforme art. 11 da LGPD.",
};

type Section = {
  title: string;
  paragraphs?: string[];
  list?: string[];
  tail?: string[];
  highlight?: boolean;
};

const sections: Section[] = [
  {
    title: "1. O que é este documento",
    paragraphs: [
      "Este Termo de Consentimento se destina ao tratamento de dados pessoais sensíveis (biometria facial) realizado pela funcionalidade de Virtual Try-On (VTO) do CriaLook, em estrita observância ao art. 11, inciso I, da Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018 — “LGPD”).",
      "Por força do art. 11 da LGPD, o tratamento de dados sensíveis exige consentimento específico e destacado, para finalidades específicas. Este termo é apresentado separadamente da Política de Privacidade para atender a esse requisito.",
    ],
  },
  {
    title: "2. Dados tratados",
    paragraphs: [
      "Ao ativar a funcionalidade de Virtual Try-On, o CriaLook tratará:",
    ],
    list: [
      "Imagens de pessoas fornecidas pelo titular (fotos contendo rosto e corpo, total ou parcialmente);",
      "Características faciais extraídas dessas imagens (landmarks, vetores de pose, segmentação), classificadas como dado pessoal sensível (art. 5º, II, LGPD);",
      "Metadados técnicos associados (resolução, dimensões, formato, data).",
    ],
  },
  {
    title: "3. Finalidade específica",
    highlight: true,
    paragraphs: [
      "Os dados acima serão tratados EXCLUSIVAMENTE para a finalidade de compor, por meio de inteligência artificial, uma imagem resultante de Virtual Try-On — isto é, a renderização virtual da peça de vestuário do titular sobre a pessoa retratada — para uso em Campanhas da loja do titular.",
      "Os dados NÃO serão utilizados para: (i) treinar modelos próprios do CriaLook; (ii) identificação ou verificação de identidade; (iii) perfilamento comportamental; (iv) qualquer outra finalidade não listada neste termo.",
    ],
  },
  {
    title: "4. Compartilhamento com subprocessadores",
    paragraphs: [
      "Para executar o Virtual Try-On, as imagens são encaminhadas aos seguintes subprocessadores, com os quais o CriaLook mantém contrato com cláusulas de proteção de dados:",
    ],
    list: [
      "Fashn.ai (Estados Unidos) — engine principal de Virtual Try-On;",
      "Google LLC / Gemini (Estados Unidos) — análise e geração de imagem auxiliar;",
      "Fal.ai (Estados Unidos) — processamento de IA generativa auxiliar.",
    ],
    tail: [
      "A transferência internacional é realizada com amparo nos incisos II (cláusulas contratuais específicas) e VIII (execução de contrato a pedido do titular) do art. 33 da LGPD. Os dados sensíveis NÃO são compartilhados com terceiros além dos acima listados.",
    ],
  },
  {
    title: "5. Retenção e eliminação",
    paragraphs: [
      "As imagens e características faciais serão eliminadas em até 30 (trinta) dias após a geração da Campanha ou imediatamente após a revogação deste consentimento, o que ocorrer primeiro, ressalvadas obrigações legais de retenção.",
      "A Campanha resultante (imagem final composta), por ser conteúdo do titular para uso em sua loja, segue a política de retenção de Campanhas prevista na Política de Privacidade.",
    ],
  },
  {
    title: "6. Autorização da Pessoa Retratada",
    highlight: true,
    paragraphs: [
      "Se a Pessoa Retratada for diferente do titular da conta (por exemplo, modelo contratada, funcionária, amiga, familiar), o titular DECLARA, sob as penas da lei:",
    ],
    list: [
      "Possuir autorização expressa, preferencialmente por escrito, da Pessoa Retratada para uso publicitário da imagem, inclusive para processamento por inteligência artificial de terceiros localizados no exterior;",
      "Que a Pessoa Retratada é maior de 18 (dezoito) anos;",
      "Que a Pessoa Retratada foi informada sobre as finalidades descritas neste termo, sobre os subprocessadores envolvidos e sobre a possibilidade de revogação do consentimento;",
      "Que assume integralmente a responsabilidade por eventual reclamação da Pessoa Retratada, isentando o CriaLook de qualquer ônus daí decorrente, respondendo regressivamente por danos causados a terceiros.",
    ],
  },
  {
    title: "7. Direitos do titular e da Pessoa Retratada",
    paragraphs: [
      "Nos termos do art. 18 da LGPD, o titular e a Pessoa Retratada podem, a qualquer momento e gratuitamente:",
    ],
    list: [
      "Confirmar a existência de tratamento;",
      "Acessar os dados tratados;",
      "Corrigir dados incorretos;",
      "Solicitar a eliminação dos dados tratados com consentimento;",
      "Revogar o consentimento, sem prejuízo dos tratamentos realizados anteriormente com base em consentimento legitimamente prestado;",
      "Peticionar à ANPD (www.gov.br/anpd).",
    ],
    tail: [
      "A revogação pode ser feita pelo painel da conta, pelo e-mail dpo@crialook.com.br ou pelos demais canais indicados na página do DPO.",
    ],
  },
  {
    title: "8. Consequências da não concessão ou revogação do consentimento",
    paragraphs: [
      "Sem o consentimento específico, a funcionalidade de Virtual Try-On não será executada e a geração de Campanhas que dependam dessa composição ficará indisponível. As demais funcionalidades da Plataforma permanecem disponíveis normalmente.",
    ],
  },
  {
    title: "9. Declaração de Consentimento",
    highlight: true,
    paragraphs: [
      "Ao marcar “Li e aceito” na funcionalidade de Virtual Try-On dentro da Plataforma, o titular declara que:",
    ],
    list: [
      "Leu, compreendeu e aceita os termos deste Consentimento Biométrico de forma livre, informada e inequívoca;",
      "Autoriza o tratamento dos dados sensíveis descritos, para as finalidades específicas indicadas, pelos subprocessadores listados;",
      "Possui, quando aplicável, autorização da Pessoa Retratada nos termos do item 6;",
      "Está ciente do direito de revogar o consentimento a qualquer tempo.",
    ],
  },
  {
    title: "10. Controlador e DPO",
    list: [
      "Controlador: [PREENCHER: razão social] — CNPJ [PREENCHER]",
      "Endereço: [PREENCHER: endereço completo]",
      "DPO: dpo@crialook.com.br",
      "Canal dedicado: /dpo",
    ],
  },
];

export default function ConsentimentoBiometricoPage() {
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
            <div className="badge badge-brand mb-4 inline-flex text-[11px]">
              Legal · Dado Sensível (art. 11 LGPD)
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">
              Consentimento Biométrico — Virtual Try-On
            </h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Versão 1.0 · Vigente desde [PREENCHER: AAAA-MM-DD] · Consentimento específico e destacado
            </p>
          </div>

          {/* Aviso destacado */}
          <div
            className="rounded-xl p-4 sm:p-5 mb-8 text-sm"
            style={{
              background: "color-mix(in srgb, var(--brand-500) 10%, transparent)",
              border: "2px solid color-mix(in srgb, var(--brand-500) 50%, transparent)",
              color: "var(--foreground)",
            }}
          >
            <strong>Atenção:</strong> este documento trata do uso de biometria facial, que é DADO PESSOAL SENSÍVEL nos
            termos do art. 5º, II, da LGPD. Leia com atenção antes de ativar o Virtual Try-On.
          </div>

          {/* Content */}
          <div className="space-y-6">
            {sections.map((s) => (
              <section
                key={s.title}
                className="rounded-xl p-4 sm:p-5 md:p-6"
                style={{
                  background: s.highlight
                    ? "color-mix(in srgb, var(--brand-500) 6%, var(--surface))"
                    : "var(--surface)",
                  border: s.highlight
                    ? "1px solid color-mix(in srgb, var(--brand-500) 40%, var(--border))"
                    : "1px solid var(--border)",
                }}
              >
                <h2 className="text-base md:text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>
                  {s.title}
                </h2>
                {s.paragraphs?.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed mb-3" style={{ color: "var(--muted)" }}>
                    {p}
                  </p>
                ))}
                {s.list && (
                  <ul
                    className="text-sm leading-relaxed list-disc pl-5 space-y-1.5 mb-3"
                    style={{ color: "var(--muted)" }}
                  >
                    {s.list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {s.tail?.map((p, i) => (
                  <p key={`tail-${i}`} className="text-sm leading-relaxed mb-3" style={{ color: "var(--muted)" }}>
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>

          {/* Links úteis */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/privacidade"
              className="rounded-xl p-4 text-sm font-medium transition-colors hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Política de Privacidade →
            </Link>
            <Link
              href="/subprocessadores"
              className="rounded-xl p-4 text-sm font-medium transition-colors hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Subprocessadores →
            </Link>
          </div>

          {/* Back link */}
          <div className="mt-10 text-center">
            <Link
              href="/"
              className="text-sm font-medium inline-flex items-center gap-1.5 transition-colors hover:opacity-80"
              style={{ color: "var(--brand-500)" }}
            >
              ← Voltar para o início
            </Link>
          </div>
        </div>
      </main>

      <Footer useLinks />
    </div>
  );
}
