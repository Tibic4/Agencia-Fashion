import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Política de Privacidade — CriaLook",
  description:
    "Política de Privacidade do CriaLook em conformidade com a LGPD (Lei 13.709/2018). Saiba como tratamos seus dados pessoais.",
};

type Section = {
  title: string;
  paragraphs?: string[];
  list?: string[];
  table?: { headers: string[]; rows: string[][] };
  extra?: string;
  highlight?: boolean;
};

const sections: Section[] = [
  {
    title: "1. Identificação do Controlador",
    paragraphs: [
      "Para fins da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — “LGPD”), o Controlador dos dados pessoais tratados por meio do CriaLook é:",
    ],
    list: [
      "Controlador: Alton Jorge de Souza Vieira (pessoa física, atuando como desenvolvedor independente)",
      "Localização: Patrocínio/MG, Brasil",
      "Contato geral: contato@crialook.com.br",
      "Encarregado pelo Tratamento de Dados Pessoais (DPO): Alton Jorge de Souza Vieira — contato@crialook.com.br",
      "Dados completos do controlador (CPF, endereço, telefone) podem ser solicitados via e-mail ao DPO em situação que exija formalização (ex.: requerimento da ANPD, processo judicial).",
    ],
  },
  {
    title: "2. Aplicação desta Política",
    paragraphs: [
      "Esta Política se aplica a todas as operações de tratamento de dados pessoais realizadas por meio do sítio crialook.com.br, subdomínios, aplicações e APIs associadas (coletivamente, “Plataforma”). Ao utilizar a Plataforma, o titular declara ter lido, compreendido e aceitado as condições aqui descritas.",
      "O CriaLook é um produto de Software as a Service (SaaS) destinado exclusivamente a maiores de 18 (dezoito) anos, lojistas de moda, pessoas físicas ou jurídicas que desejam gerar campanhas de marketing com auxílio de inteligência artificial.",
    ],
  },
  {
    title: "3. Dados Pessoais Coletados",
    paragraphs: [
      "Coletamos e tratamos as seguintes categorias de dados pessoais:",
    ],
    table: {
      headers: ["Categoria", "Dados tratados", "Origem"],
      rows: [
        ["Cadastrais", "Nome, e-mail, senha (hash), nome da loja", "Fornecidos pelo titular no cadastro (via Clerk)"],
        ["Perfil e preferências", "Público-alvo, tom de voz, preferências estéticas", "Fornecidos pelo titular no onboarding"],
        ["Conteúdo enviado", "Fotos de produtos de moda; eventualmente, fotos de pessoas (modelos) para Virtual Try-On", "Upload pelo titular"],
        ["Dados sensíveis (biometria facial)", "Características faciais extraídas das imagens de modelos enviadas pelo titular para Virtual Try-On", "Upload pelo titular — com consentimento específico"],
        ["Pagamento", "Dados de faturamento processados pelo Mercado Pago; recebemos apenas metadados da transação (ID, status, valor, últimos 4 dígitos do cartão, eventualmente CPF do pagador)", "Mercado Pago (processador)"],
        ["Conexão e navegação", "Endereço IP, user-agent, cookies, identificador de sessão, páginas visitadas, eventos de interação", "Coletado automaticamente (Clerk, PostHog, Sentry, Cloudflare)"],
        ["Logs de erro", "Mensagens de erro, stack traces, identificador de sessão", "Sentry"],
        ["Conteúdo gerado", "Campanhas (imagens e textos) produzidas pela IA a partir dos seus inputs", "Gerado pela Plataforma"],
      ],
    },
  },
  {
    title: "4. Finalidades e Bases Legais (arts. 7º e 11 da LGPD)",
    paragraphs: [
      "Cada tratamento de dados pessoais é realizado com finalidade específica, explícita e informada, e amparado em uma base legal da LGPD:",
    ],
    table: {
      headers: ["Finalidade", "Dados tratados", "Base legal (LGPD)"],
      rows: [
        ["Criação e manutenção de conta", "Cadastrais, conexão", "Execução de contrato (art. 7º, V)"],
        ["Execução do serviço (geração de campanhas)", "Conteúdo enviado, preferências, conteúdo gerado", "Execução de contrato (art. 7º, V)"],
        ["Virtual Try-On com biometria facial", "Dados sensíveis (fotos de pessoas/modelos)", "Consentimento específico e destacado (art. 11, I)"],
        ["Processamento de pagamentos", "Dados cadastrais, pagamento", "Execução de contrato (art. 7º, V) e cumprimento de obrigação legal fiscal (art. 7º, II)"],
        ["Emissão de nota fiscal e obrigações tributárias", "Cadastrais, CPF/CNPJ, dados fiscais", "Cumprimento de obrigação legal (art. 7º, II)"],
        ["Segurança, prevenção a fraude e integridade", "Conexão, logs", "Legítimo interesse (art. 7º, IX)"],
        ["Monitoramento de erros (Sentry)", "Logs de erro, IP, sessão", "Legítimo interesse (art. 7º, IX)"],
        ["Telemetria e analytics (PostHog)", "Eventos de uso, sessão", "Consentimento (art. 7º, I) — opt-in via banner de cookies"],
        ["Atendimento, suporte e comunicação transacional", "Cadastrais, conteúdo do chamado", "Execução de contrato (art. 7º, V)"],
        ["Defesa em processos administrativos ou judiciais", "Todos os dados pertinentes", "Exercício regular de direitos (art. 7º, VI)"],
      ],
    },
  },
  {
    title: "5. Tratamento de Dados Sensíveis — Biometria Facial (art. 11 LGPD)",
    highlight: true,
    paragraphs: [
      "A funcionalidade de Virtual Try-On (VTO) processa imagens que podem conter características faciais, sendo estas classificadas como dado pessoal sensível nos termos do art. 5º, II, da LGPD.",
      "O tratamento desses dados é realizado EXCLUSIVAMENTE com consentimento específico, livre, informado e destacado do titular, nos termos do art. 11, I, da LGPD, mediante aceite do Termo de Consentimento Biométrico disponível em /consentimento-biometrico.",
      "O titular é o único responsável por garantir que possui autorização da pessoa retratada nas imagens enviadas. Caso a pessoa retratada seja diferente do titular da conta (ex.: modelo contratada, funcionária, amiga), o titular declara expressamente possuir autorização por escrito dessa pessoa para uso da imagem com finalidade de geração de campanha publicitária por meio de IA.",
      "O titular pode revogar o consentimento a qualquer momento por meio do painel de conta ou do e-mail contato@crialook.com.br. A revogação não afeta tratamentos realizados anteriormente com base no consentimento legitimamente prestado.",
    ],
  },
  {
    title: "6. Compartilhamento com Operadores e Subprocessadores",
    paragraphs: [
      "Para prestar o serviço, o CriaLook compartilha dados pessoais estritamente necessários com operadores (art. 5º, VII, LGPD) contratados sob cláusulas de confidencialidade e proteção de dados. Nenhum dado pessoal é vendido, alugado ou comercializado a terceiros.",
      "A lista completa e atualizada de subprocessadores está disponível em /subprocessadores.",
    ],
    table: {
      headers: ["Subprocessador", "País", "Finalidade", "Base legal"],
      rows: [
        ["Clerk Inc.", "EUA", "Autenticação e gestão de contas", "Execução de contrato"],
        ["Supabase Inc.", "EUA / região configurável", "Banco de dados e armazenamento", "Execução de contrato"],
        ["Anthropic PBC (Claude)", "EUA", "Geração de textos publicitários via IA", "Execução de contrato"],
        ["Google LLC (Gemini API)", "EUA", "Análise e geração de imagens via IA", "Execução de contrato"],
        ["Fashn.ai", "EUA", "Virtual Try-On (biometria facial)", "Consentimento (art. 11, I)"],
        ["Fal.ai", "EUA", "Processamento de IA generativa de imagens", "Execução de contrato / consentimento"],
        ["Mercado Pago (MercadoLibre)", "Brasil", "Processamento de pagamentos", "Execução de contrato e obrigação legal"],
        ["PostHog Inc.", "EUA / UE", "Analytics de produto", "Consentimento (opt-in)"],
        ["Functional Software, Inc. (Sentry)", "EUA", "Monitoramento de erros", "Legítimo interesse"],
        ["Cloudflare, Inc.", "EUA (rede global)", "CDN, WAF e proteção contra DDoS", "Legítimo interesse (segurança)"],
      ],
    },
  },
  {
    title: "7. Transferência Internacional de Dados (arts. 33 a 36 LGPD)",
    paragraphs: [
      "Diversos subprocessadores estão sediados fora do Brasil, principalmente nos Estados Unidos. As transferências internacionais são realizadas com base nas seguintes garantias, conforme o art. 33 da LGPD:",
    ],
    list: [
      "Inciso II — cláusulas contratuais específicas (Data Processing Addendums) com compromissos equivalentes aos previstos na LGPD;",
      "Inciso VIII — execução de contrato do qual o titular seja parte, a seu pedido, para fornecimento do serviço contratado;",
      "Inciso I — quando o país destinatário proporcionar grau de proteção adequado (após eventual reconhecimento pela ANPD);",
      "Inciso IX — exercício regular de direitos em processo judicial, administrativo ou arbitral.",
    ],
  },
  {
    title: "8. Retenção e Eliminação de Dados",
    paragraphs: [
      "Os prazos de retenção variam conforme a finalidade e a base legal aplicáveis:",
    ],
    table: {
      headers: ["Tipo de dado", "Prazo de retenção"],
      rows: [
        ["Dados cadastrais de conta ativa", "Enquanto a conta permanecer ativa"],
        ["Dados cadastrais após encerramento da conta", "Até 5 anos (prescrição — art. 206, §3º, V, CC) ou prazo fiscal aplicável"],
        ["Conteúdo enviado (fotos de produto/modelo)", "Até 90 dias após o encerramento da conta, salvo solicitação de exclusão imediata"],
        ["Dados biométricos (Virtual Try-On)", "Eliminados em até 30 dias após a geração da campanha ou revogação do consentimento, o que ocorrer primeiro"],
        ["Campanhas geradas", "Enquanto o titular mantiver a conta ativa ou solicitar exclusão"],
        ["Logs de acesso e segurança", "6 meses (art. 15 do Marco Civil da Internet — Lei 12.965/2014)"],
        ["Logs de erro (Sentry)", "Até 90 dias"],
        ["Telemetria (PostHog)", "Até 12 meses"],
        ["Dados fiscais e financeiros", "5 anos (art. 173 e art. 174 do CTN) ou 10 anos se aplicável"],
      ],
    },
  },
  {
    title: "9. Direitos do Titular (art. 18 LGPD)",
    paragraphs: [
      "O titular pode, a qualquer momento e mediante requisição, exercer os seguintes direitos:",
    ],
    list: [
      "Confirmação da existência de tratamento;",
      "Acesso aos dados;",
      "Correção de dados incompletos, inexatos ou desatualizados;",
      "Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;",
      "Portabilidade a outro fornecedor;",
      "Eliminação dos dados tratados com consentimento;",
      "Informação sobre entidades com as quais o controlador compartilhou dados;",
      "Informação sobre a possibilidade de não fornecer consentimento e suas consequências;",
      "Revogação do consentimento;",
      "Oposição a tratamentos realizados com base em outras hipóteses legais, em caso de descumprimento da LGPD.",
    ],
  },
  {
    title: "10. Como Exercer seus Direitos",
    paragraphs: [
      "O titular pode exercer seus direitos pelos seguintes canais:",
    ],
    list: [
      "Painel de conta: acesse /conta para editar, exportar ou excluir seus dados (endpoints /api/me e /api/me/export);",
      "E-mail: contato@crialook.com.br — resposta em até 15 (quinze) dias, conforme art. 19, §3º, LGPD;",
      "Por escrito: solicite o endereço de correspondência ao DPO via e-mail (contato@crialook.com.br);",
      "Reclamação à ANPD: https://www.gov.br/anpd — o titular tem direito de peticionar à Autoridade Nacional de Proteção de Dados.",
    ],
  },
  {
    title: "11. Cookies e Tecnologias Similares",
    paragraphs: [
      "Utilizamos cookies e tecnologias similares para as seguintes finalidades:",
    ],
    table: {
      headers: ["Categoria", "Finalidade", "Consentimento"],
      rows: [
        ["Estritamente necessários", "Autenticação (Clerk), segurança (Cloudflare), CSRF, sessão", "Dispensa consentimento — essenciais ao serviço"],
        ["Funcionais", "Preferências (tema, idioma)", "Dispensa consentimento — funcionalidade básica"],
        ["Erro e estabilidade (Sentry)", "Identificar e corrigir bugs", "Legítimo interesse — desativável"],
        ["Analíticos (PostHog)", "Estatísticas de uso, funil, A/B", "Consentimento explícito (opt-in)"],
        ["Marketing", "Não utilizamos cookies de marketing de terceiros neste momento", "—"],
      ],
    },
    extra: "O titular pode gerenciar suas preferências a qualquer momento por meio do banner de cookies exibido no primeiro acesso ou no link “Preferências de cookies” disponível no rodapé.",
  },
  {
    title: "12. Segurança da Informação",
    paragraphs: [
      "Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados pessoais contra acessos não autorizados, destruição, perda, alteração ou qualquer forma de tratamento inadequado ou ilícito, incluindo:",
    ],
    list: [
      "Criptografia em trânsito (TLS 1.2+) e em repouso nos bancos de dados;",
      "Autenticação via provedor especializado (Clerk) com suporte a MFA;",
      "Controle de acesso baseado em função (RBAC) e princípio do menor privilégio;",
      "Monitoramento de erros (Sentry) e de segurança perimetral (Cloudflare WAF);",
      "Registros de acesso mantidos conforme o Marco Civil da Internet;",
      "Cláusulas de proteção de dados com todos os operadores;",
      "Política interna de resposta a incidentes e comunicação à ANPD e aos titulares em caso de incidente relevante (art. 48 LGPD).",
    ],
  },
  {
    title: "13. Menores de 18 Anos",
    highlight: true,
    paragraphs: [
      "O CriaLook é destinado EXCLUSIVAMENTE a maiores de 18 (dezoito) anos. Não coletamos intencionalmente dados de crianças ou adolescentes. Caso identifiquemos o cadastro de menor de idade, a conta será suspensa e os dados eliminados, ressalvadas obrigações legais de retenção.",
      "É expressamente vedado o upload de imagens contendo menores de idade, sob qualquer pretexto, ficando o titular integralmente responsável por eventual violação.",
    ],
  },
  {
    title: "14. Canal do Encarregado (DPO)",
    paragraphs: [
      "Em cumprimento ao art. 41 da LGPD, nomeamos um Encarregado pelo Tratamento de Dados Pessoais, que é o canal de comunicação entre o Controlador, os titulares e a ANPD:",
    ],
    list: [
      "Nome: Alton Jorge de Souza Vieira",
      "E-mail: contato@crialook.com.br",
      "Página dedicada: /dpo",
    ],
  },
  {
    title: "15. Alterações desta Política",
    paragraphs: [
      "Esta Política pode ser atualizada periodicamente para refletir mudanças legais, regulatórias ou operacionais. Alterações materiais serão notificadas por e-mail e/ou aviso destacado na Plataforma com antecedência mínima de 15 (quinze) dias antes de sua entrada em vigor, salvo quando obrigação legal impuser prazo menor.",
      "O histórico de versões está disponível ao final deste documento.",
    ],
  },
  {
    title: "16. Legislação Aplicável e Foro",
    paragraphs: [
      "Esta Política é regida pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de Patrocínio/MG para dirimir quaisquer controvérsias, ressalvado o direito do consumidor de optar pelo foro de seu domicílio (art. 101, I, CDC).",
    ],
  },
  {
    title: "17. Histórico de Versões",
    list: [
      "Versão 1.0 — vigente desde 2026-04-24",
    ],
  },
];

export default function Privacidade() {
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
            <Link href="/sign-up" className="btn-primary text-sm !py-2 !px-4 min-h-tap flex items-center">Começar</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 sm:pt-28 md:pt-36 pb-12 sm:pb-16 md:pb-24">
        <div className="container max-w-3xl">
          {/* Header */}
          <div className="mb-10 md:mb-14">
            <div className="badge badge-brand mb-4 inline-flex text-xs">Legal</div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">Política de Privacidade</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Versão 1.0 · Vigente desde 2026-04-24 · Conforme LGPD (Lei 13.709/2018)
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
                  <p
                    key={i}
                    className="text-sm leading-relaxed mb-3"
                    style={{ color: "var(--muted)" }}
                  >
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
                {s.table && (
                  <div className="overflow-x-auto -mx-4 sm:-mx-5 md:-mx-6">
                    <table className="w-full text-xs" style={{ color: "var(--muted)" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          {s.table.headers.map((h) => (
                            <th
                              key={h}
                              className="text-left font-semibold px-4 sm:px-5 md:px-6 py-2"
                              style={{ color: "var(--foreground)" }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.table.rows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                            {row.map((cell, j) => (
                              <td key={j} className="align-top px-4 sm:px-5 md:px-6 py-2.5 leading-relaxed">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {s.extra && (
                  <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--muted)" }}>
                    {s.extra}
                  </p>
                )}
              </section>
            ))}
          </div>

          {/* Links úteis */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/subprocessadores"
              className="surface-card surface-card-hover p-4 text-sm font-medium transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              Lista de subprocessadores →
            </Link>
            <Link
              href="/consentimento-biometrico"
              className="surface-card surface-card-hover p-4 text-sm font-medium transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              Consentimento biométrico (VTO) →
            </Link>
            <Link
              href="/dpo"
              className="surface-card surface-card-hover p-4 text-sm font-medium transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              Canal do Encarregado (DPO) →
            </Link>
            <Link
              href="/termos"
              className="surface-card surface-card-hover p-4 text-sm font-medium transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              Termos de Uso →
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
