import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Termos de Uso — CriaLook",
  description:
    "Termos de Uso do CriaLook — condições contratuais para utilização da plataforma SaaS de geração de campanhas de moda com IA.",
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
    title: "1. Identificação do Fornecedor (Dec. 7.962/2013, art. 2º)",
    paragraphs: [
      "O serviço CriaLook é fornecido por:",
    ],
    list: [
      "Operador / Responsável: Alton Jorge de Souza Vieira (pessoa física, empresário individual)",
      "CPF: [REDACTED-CPF]",
      "Endereço: [REDACTED-ENDERECO] — [REDACTED] — Patrocínio/MG",
      "E-mail: contato@crialook.com.br",
      "Encarregado (DPO): Alton Jorge de Souza Vieira — dpo@crialook.com.br",
    ],
  },
  {
    title: "2. Definições",
    list: [
      "Plataforma: o sítio crialook.com.br, subdomínios, aplicações e APIs associadas.",
      "Titular ou Usuário: pessoa física maior de 18 anos, ou pessoa jurídica regularmente constituída, cadastrada na Plataforma.",
      "Conta: perfil individual e intransferível criado no processo de cadastro.",
      "Loja: a atividade comercial de moda representada pelo Usuário na Plataforma.",
      "Campanha: conjunto de imagens, textos e metadados gerados pela IA da Plataforma a partir de inputs fornecidos pelo Usuário.",
      "Créditos: unidades de consumo necessárias para geração de Campanhas, vinculadas a planos ou pacotes avulsos.",
      "Modelo Virtual: imagem de pessoa gerada ou composta pela IA (Virtual Try-On) a partir de inputs do Usuário.",
      "Pessoa Retratada: pessoa cuja imagem física é enviada pelo Usuário para uso em Virtual Try-On.",
      "Conteúdo do Usuário: todo dado, imagem, texto ou material enviado pelo Usuário à Plataforma.",
    ],
  },
  {
    title: "3. Aceitação e Vinculação",
    paragraphs: [
      "Ao criar uma Conta, contratar um plano ou utilizar qualquer funcionalidade da Plataforma, o Usuário declara ter lido, compreendido e aceitado integralmente estes Termos de Uso e a Política de Privacidade, formando um contrato vinculante entre as partes.",
      "Caso não concorde com qualquer disposição, o Usuário deve se abster de utilizar a Plataforma.",
    ],
  },
  {
    title: "4. Requisitos para Uso",
    paragraphs: [
      "Para utilizar a Plataforma, o Usuário deve:",
    ],
    list: [
      "Ser maior de 18 (dezoito) anos e possuir plena capacidade civil (art. 5º CC);",
      "Ou, se pessoa jurídica, estar regularmente constituída e representada por quem possua poderes para contratar;",
      "Fornecer informações verdadeiras, atuais e completas no cadastro;",
      "Manter as credenciais de acesso em sigilo absoluto;",
      "Utilizar a Plataforma apenas para fins lícitos e em conformidade com estes Termos.",
    ],
  },
  {
    title: "5. Cadastro e Conta",
    paragraphs: [
      "O cadastro é gratuito e realizado por meio do provedor de autenticação Clerk. O Usuário é responsável por todas as atividades realizadas em sua Conta.",
      "Em caso de uso não autorizado da Conta, o Usuário deve notificar o CriaLook imediatamente pelo e-mail contato@crialook.com.br.",
      "A Conta é pessoal e intransferível. É vedada a criação de múltiplas contas para contornar limites de plano ou restrições de uso.",
    ],
  },
  {
    title: "6. Licença de Uso do Software",
    paragraphs: [
      "Sujeito ao cumprimento destes Termos e ao pagamento dos valores aplicáveis, o CriaLook concede ao Usuário uma licença limitada, não exclusiva, intransferível, revogável e não sublicenciável para acessar e utilizar a Plataforma conforme seu plano contratado.",
      "Todos os direitos de propriedade intelectual sobre o software, interfaces, marca, modelos, prompts, pesos de IA proprietários, bancos de dados e demais elementos da Plataforma permanecem com o CriaLook ou seus licenciadores.",
    ],
  },
  {
    title: "7. Planos, Créditos, Preços e Trial",
    paragraphs: [
      "A Plataforma opera em modelo de assinatura mensal com créditos de uso, complementados por pacotes avulsos e trial de entrada:",
    ],
    list: [
      "Trial R$ 19,90 — permite experimentar a geração de Campanhas com quantidade limitada de créditos;",
      "Plano Starter — R$ 179,00/mês",
      "Plano Pro — R$ 359,00/mês",
      "Plano Business — R$ 749,00/mês",
      "Packs avulsos — créditos adicionais disponíveis sem recorrência.",
    ],
    tail: [
      "Os créditos de cada ciclo não são cumulativos entre meses, salvo indicação expressa no plano, e são válidos apenas enquanto a assinatura estiver ativa.",
      "Os preços podem ser reajustados mediante notificação prévia de no mínimo 30 (trinta) dias, respeitado o ciclo vigente. Tributos aplicáveis serão destacados na fatura.",
      "O pagamento é processado pela Mercado Pago via PIX, cartão de crédito ou boleto.",
    ],
  },
  {
    title: "8. Direito de Arrependimento (CDC, art. 49)",
    highlight: true,
    paragraphs: [
      "Tratando-se de contratação à distância, o Usuário pessoa física consumidora tem o direito de desistir da contratação no prazo de 7 (sete) dias corridos, contados da assinatura ou do recebimento do acesso, independentemente de justificativa, mediante solicitação ao e-mail contato@crialook.com.br.",
      "Exercido tempestivamente o direito de arrependimento, os valores eventualmente pagos serão integralmente devolvidos, pelo mesmo meio de pagamento, em até 10 (dez) dias úteis.",
      "A utilização efetiva da Plataforma durante o período de arrependimento é permitida; porém, créditos efetivamente consumidos são abatidos do reembolso proporcionalmente ao plano contratado, conforme entendimento doutrinário corrente sobre serviços digitais consumidos de forma imediata.",
    ],
  },
  {
    title: "9. Cancelamento e Reembolso",
    paragraphs: [
      "O Usuário pode cancelar sua assinatura a qualquer momento pelo painel da conta. O cancelamento impede renovações futuras, mas não gera reembolso proporcional do ciclo em curso, salvo nos casos do item 8 ou quando houver falha grave imputável ao CriaLook.",
      "Créditos de pacotes avulsos já utilizados não são reembolsáveis. Créditos não utilizados podem ser reembolsados proporcionalmente dentro do prazo legal de arrependimento.",
      "Em caso de rescisão por inadimplência do Usuário, a Conta poderá ser suspensa após aviso com prazo mínimo de 7 (sete) dias.",
    ],
  },
  {
    title: "10. Regras de Upload e Conteúdo do Usuário",
    highlight: true,
    paragraphs: [
      "O Usuário DECLARA E GARANTE, sob as penas da lei, que:",
    ],
    list: [
      "Detém todos os direitos sobre as peças de vestuário e demais produtos fotografados, ou possui autorização expressa do titular;",
      "Quando enviar imagem contendo pessoa (para Virtual Try-On ou outra finalidade), detém autorização escrita da Pessoa Retratada para uso publicitário da imagem, inclusive para processamento por inteligência artificial de terceiros (CF, art. 5º, X; CC, arts. 20 e 21; LGPD, art. 11);",
      "A Pessoa Retratada é maior de 18 anos e está ciente das finalidades do tratamento;",
      "Não enviará conteúdo que viole direitos autorais, de marca, de imagem ou de privacidade de terceiros;",
      "Isenta integralmente o CriaLook de qualquer responsabilidade por uso indevido de imagens, respondendo regressivamente por eventuais danos causados a terceiros.",
    ],
  },
  {
    title: "11. Conteúdo Proibido",
    paragraphs: [
      "É expressamente vedado o upload ou a geração, pela Plataforma, de conteúdo que:",
    ],
    list: [
      "Envolva menores de 18 anos em qualquer contexto;",
      "Seja de natureza sexual, pornográfica, violenta ou discriminatória;",
      "Represente produto falsificado, contrafato, ou que infrinja propriedade intelectual de terceiros;",
      "Tenha origem ilícita ou fins ilícitos (lavagem, fraude, etc.);",
      "Reproduza indevidamente imagens, marcas ou identidade visual de concorrentes;",
      "Viole direitos de personalidade de terceiros;",
      "Contrarie leis brasileiras ou de jurisdições aplicáveis ao Usuário.",
    ],
    tail: [
      "O CriaLook poderá remover, bloquear ou recusar o processamento de conteúdo suspeito, bem como suspender a Conta do Usuário, sem prejuízo de reportar às autoridades competentes quando a lei exigir.",
    ],
  },
  {
    title: "12. Propriedade Intelectual sobre Campanhas Geradas",
    paragraphs: [
      "O CriaLook cede ao Usuário, de forma não exclusiva e para uso comercial em sua atividade de moda, os direitos patrimoniais sobre as Campanhas (imagens e textos) geradas a partir de seus inputs, respeitados os limites desta seção e dos termos dos subprocessadores de IA (Anthropic, Google, Fashn.ai, Fal.ai).",
      "O Usuário pode utilizar as Campanhas em redes sociais, marketplaces, site próprio e materiais de marketing de sua loja.",
      "É VEDADO ao Usuário: (i) revender as Campanhas a terceiros como serviço de criação; (ii) alegar autoria humana exclusiva quando veiculação legal exigir indicação de uso de IA; (iii) utilizar os modelos, prompts ou engine do CriaLook para criar produto concorrente.",
      "O CriaLook retém direitos sobre a tecnologia, modelos, pesos de IA proprietários, prompts internos, bases de dados, marca e interfaces.",
    ],
  },
  {
    title: "13. Responsabilidade do CriaLook",
    paragraphs: [
      "O CriaLook se compromete a empregar esforços técnicos razoáveis para manter a Plataforma disponível, segura e funcional. Contudo, como serviço baseado em IA generativa, o CriaLook NÃO GARANTE:",
    ],
    list: [
      "Resultados específicos em termos de vendas, engajamento ou conversão;",
      "Ausência de imperfeições estéticas em Campanhas geradas — o Usuário deve revisar o conteúdo antes da publicação;",
      "Disponibilidade ininterrupta, diante de eventual falha de subprocessadores ou força maior;",
      "Que a Campanha gerada seja integralmente protegível por direitos autorais, dada a legislação ainda em evolução sobre obras geradas por IA.",
    ],
    tail: [
      "Sem prejuízo de direitos consumeristas irrenunciáveis, a responsabilidade total do CriaLook perante o Usuário, por qualquer causa e sob qualquer teoria jurídica, fica limitada ao valor efetivamente pago pelo Usuário nos 12 (doze) meses anteriores ao evento que deu origem à reclamação.",
    ],
  },
  {
    title: "14. Responsabilidade do Usuário e Indenização",
    paragraphs: [
      "O Usuário se compromete a indenizar e manter o CriaLook, seus sócios, administradores e colaboradores, indenes de quaisquer reclamações, demandas, multas ou prejuízos (incluindo honorários advocatícios razoáveis) decorrentes de:",
    ],
    list: [
      "Uso indevido da Plataforma;",
      "Envio de conteúdo em violação às garantias do item 10;",
      "Uso indevido das Campanhas geradas;",
      "Violação de direitos de terceiros, especialmente direitos de imagem da Pessoa Retratada;",
      "Descumprimento destes Termos ou de lei aplicável.",
    ],
  },
  {
    title: "15. Suspensão e Encerramento da Conta",
    paragraphs: [
      "O CriaLook pode suspender ou encerrar a Conta mediante aviso prévio de 7 (sete) dias, salvo urgência, nos seguintes casos:",
    ],
    list: [
      "Violação destes Termos ou da Política de Privacidade;",
      "Inadimplência não regularizada;",
      "Uso para fins ilícitos ou que gere risco à Plataforma, a terceiros ou ao CriaLook;",
      "Determinação de autoridade judicial ou administrativa.",
    ],
    tail: [
      "Em caso de encerramento por culpa do Usuário, não há direito a reembolso de valores pagos. Em qualquer hipótese, o Usuário poderá solicitar exportação de seus dados em formato estruturado por até 30 (trinta) dias após o encerramento (portabilidade — art. 18, V, LGPD).",
    ],
  },
  {
    title: "16. Alterações dos Termos",
    paragraphs: [
      "O CriaLook pode alterar estes Termos mediante notificação prévia de 30 (trinta) dias, enviada ao e-mail cadastrado e destacada na Plataforma. Alterações puramente redacionais, de correção de erros materiais ou exigidas por lei podem ter efeito imediato.",
      "A continuidade do uso após a entrada em vigor implica aceitação. Caso o Usuário discorde, pode rescindir o contrato sem ônus até a data de vigência da alteração, com reembolso proporcional do ciclo pago e não usufruído.",
    ],
  },
  {
    title: "17. Solução Amigável e Mediação",
    paragraphs: [
      "As partes se comprometem a buscar, de boa-fé, solução amigável para quaisquer controvérsias por até 30 (trinta) dias antes de recorrer ao Poder Judiciário, preferencialmente pelo canal contato@crialook.com.br ou mediante câmara de mediação.",
    ],
  },
  {
    title: "18. Legislação Aplicável e Foro",
    paragraphs: [
      "Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial pelo Código de Defesa do Consumidor (Lei 8.078/1990), Código Civil, Marco Civil da Internet (Lei 12.965/2014), LGPD (Lei 13.709/2018) e Decreto 7.962/2013.",
      "Fica eleito o foro da comarca de Patrocínio/MG para dirimir quaisquer controvérsias, ressalvado o direito do consumidor pessoa física de optar pelo foro de seu domicílio (art. 101, I, CDC).",
    ],
  },
  {
    title: "19. Disposições Finais",
    list: [
      "Estes Termos constituem o acordo integral entre as partes, substituindo entendimentos anteriores;",
      "A tolerância de uma parte quanto ao descumprimento de cláusula pela outra não importa em renúncia ao direito;",
      "Se qualquer disposição for considerada inválida, as demais permanecem em vigor;",
      "Notificações serão encaminhadas aos e-mails cadastrados e consideram-se recebidas em 48 horas após o envio.",
    ],
  },
];

export default function Termos() {
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
            <Link href="/sign-up" className="btn-primary text-sm !py-2 !px-4 min-h-[40px] flex items-center">Começar</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 sm:pt-28 md:pt-36 pb-12 sm:pb-16 md:pb-24">
        <div className="container max-w-3xl">
          {/* Header */}
          <div className="mb-10 md:mb-14">
            <div className="badge badge-brand mb-4 inline-flex text-[11px]">Legal</div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">Termos de Uso</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Versão 1.0 · Vigente desde 2026-04-24
            </p>
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
                  <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1.5 mb-3" style={{ color: "var(--muted)" }}>
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
