# Minutas Jurídicas Consolidadas — CriaLook

> **ATENÇÃO:** Este documento consolida as minutas em Markdown para revisão por advogado humano antes da publicação. Todo item marcado como `[PREENCHER: ...]` depende de dados reais do titular (razão social, CNPJ, endereço etc.) ou de decisão comercial/jurídica a ser formalizada.
>
> As versões TSX equivalentes (renderizadas no site) ficam em:
> - `campanha-ia/src/app/privacidade/page.tsx`
> - `campanha-ia/src/app/termos/page.tsx`
> - `campanha-ia/src/app/dpo/page.tsx`
> - `campanha-ia/src/app/subprocessadores/page.tsx`
> - `campanha-ia/src/app/consentimento-biometrico/page.tsx`
> - `campanha-ia/src/components/CookieBanner.tsx`

---

## Sumário

1. [Política de Privacidade](#1-politica-de-privacidade)
2. [Termos de Uso](#2-termos-de-uso)
3. [Termo de Consentimento Biométrico (Virtual Try-On)](#3-termo-de-consentimento-biometrico)
4. [Cookie Banner — texto legal](#4-cookie-banner)
5. [Aviso de Subprocessadores](#5-subprocessadores)

---

## 1. Política de Privacidade

**Versão 1.0 — vigente desde [PREENCHER: AAAA-MM-DD]**  
**Conforme LGPD (Lei 13.709/2018)**

### 1.1 Identificação do Controlador
- **Razão Social:** [PREENCHER]
- **CNPJ:** [PREENCHER]
- **Endereço:** [PREENCHER]
- **E-mail geral:** contato@crialook.com.br
- **WhatsApp/Telefone:** [PREENCHER]
- **DPO:** dpo@crialook.com.br

### 1.2 Aplicação
Aplica-se a todo o ecossistema crialook.com.br. Serviço destinado EXCLUSIVAMENTE a maiores de 18 anos.

### 1.3 Dados Coletados

| Categoria | Dados | Origem |
|---|---|---|
| Cadastrais | Nome, e-mail, senha (hash), nome da loja | Cadastro via Clerk |
| Perfil | Público-alvo, tom, preferências estéticas | Onboarding |
| Conteúdo | Fotos de produtos e, eventualmente, de pessoas | Upload |
| **Sensíveis (biometria facial)** | Características faciais (VTO) | Upload com consentimento específico |
| Pagamento | ID da transação, status, valor, últimos 4 dígitos, CPF do pagador | Mercado Pago |
| Conexão | IP, user-agent, cookies, sessão, eventos | Automático (Clerk, PostHog, Sentry, Cloudflare) |
| Logs de erro | Stack traces, IP, sessão | Sentry |
| Conteúdo gerado | Campanhas (imagem + texto) | Geração pela Plataforma |

### 1.4 Finalidades e Bases Legais

| Finalidade | Base legal (LGPD) |
|---|---|
| Criação/manutenção de conta | Execução de contrato (art. 7º, V) |
| Geração de campanhas | Execução de contrato (art. 7º, V) |
| **Virtual Try-On (biometria)** | **Consentimento específico (art. 11, I)** |
| Processamento de pagamento | Execução de contrato + obrigação legal fiscal (art. 7º, II e V) |
| Nota fiscal e tributação | Obrigação legal (art. 7º, II) |
| Segurança e antifraude | Legítimo interesse (art. 7º, IX) |
| Monitoramento de erros (Sentry) | Legítimo interesse (art. 7º, IX) |
| Analytics (PostHog) | Consentimento opt-in (art. 7º, I) |
| Atendimento | Execução de contrato (art. 7º, V) |
| Defesa em processos | Exercício regular de direitos (art. 7º, VI) |

### 1.5 Tratamento de Dados Sensíveis
Realizado APENAS com consentimento específico e destacado via `/consentimento-biometrico`. Titular responde pela autorização de terceiro retratado.

### 1.6 Subprocessadores
Lista pública em `/subprocessadores` (ver seção 5 deste documento).

### 1.7 Transferência Internacional (art. 33 LGPD)
Fundamentos: inciso II (cláusulas contratuais), VIII (execução de contrato) e I (adequação futura). [PREENCHER: indicar DPAs assinados com cada operador].

### 1.8 Retenção

| Tipo | Prazo |
|---|---|
| Conta ativa | Enquanto ativa |
| Conta encerrada — dados cadastrais | Até 5 anos (prescrição CC + fiscal) |
| Fotos de produto/modelo | 90 dias após encerramento |
| **Biometria (VTO)** | **Até 30 dias após geração ou revogação** |
| Campanhas | Enquanto a conta estiver ativa |
| Logs de acesso | 6 meses (art. 15 MCI) |
| Logs Sentry | 90 dias |
| Telemetria PostHog | 12 meses |
| Dados fiscais | 5 a 10 anos |

### 1.9 Direitos do Titular (art. 18)
Confirmação, acesso, correção, anonimização, portabilidade, eliminação, info sobre compartilhamentos, revogação de consentimento, oposição. Exercício: `/api/me`, `/api/me/export`, e-mail dpo@crialook.com.br (resposta em 15 dias).

### 1.10 Cookies

| Categoria | Consentimento |
|---|---|
| Estritamente necessários | Dispensado |
| Funcionais | Dispensado |
| Sentry (erro) | Legítimo interesse — desativável |
| PostHog (analytics) | Opt-in obrigatório |
| Marketing | Não utilizado |

### 1.11 Segurança
TLS 1.2+, criptografia em repouso, MFA (Clerk), RBAC, WAF Cloudflare, logs MCI, DPAs, política de incidentes (art. 48 LGPD).

### 1.12 Menores de 18 anos
**VEDAÇÃO ABSOLUTA.** Serviço não destinado a menores; vedação de upload de imagens de menores.

### 1.13 DPO
dpo@crialook.com.br — página dedicada em `/dpo`.

### 1.14 ANPD
Direito de peticionar: www.gov.br/anpd.

### 1.15 Alterações
Notificação com 15 dias de antecedência (alterações materiais).

### 1.16 Legislação e Foro
Lei brasileira. Foro: [PREENCHER], ressalvado art. 101, I, CDC.

---

## 2. Termos de Uso

**Versão 1.0 — vigente desde [PREENCHER]**  
Fundamentos: CDC (Lei 8.078/1990), Marco Civil da Internet (Lei 12.965/2014), Decreto 7.962/2013, Código Civil, LGPD.

### 2.1 Identificação do Fornecedor (Dec. 7.962/13, art. 2º)
- Razão Social: [PREENCHER]
- CNPJ: [PREENCHER]
- Endereço: [PREENCHER]
- E-mail: contato@crialook.com.br
- WhatsApp/Telefone: [PREENCHER]

### 2.2 Definições
Plataforma, Titular, Conta, Loja, Campanha, Créditos, Modelo Virtual, Pessoa Retratada, Conteúdo do Usuário.

### 2.3 Requisitos
- 18+ com plena capacidade civil;
- Pessoa jurídica regularmente constituída;
- Dados verazes;
- Sigilo de credenciais;
- Uso lícito.

### 2.4 Cadastro
Via Clerk. Conta pessoal e intransferível. Vedado burlar limites com multi-contas.

### 2.5 Licença
Limitada, não exclusiva, intransferível, revogável, não sublicenciável. IP da Plataforma é do CriaLook.

### 2.6 Planos e Preços
- Trial R$ 19,90
- Starter R$ 179/mês
- Pro R$ 359/mês
- Business R$ 749/mês
- Packs avulsos

Reajuste com aviso mínimo de 30 dias. Pagamento via Mercado Pago.

### 2.7 Direito de Arrependimento (CDC art. 49)
7 dias corridos para consumidor pessoa física. Reembolso em até 10 dias úteis, pelo mesmo meio. Créditos consumidos são abatidos proporcionalmente (construção doutrinária sobre serviço digital imediato).

### 2.8 Cancelamento e Reembolso
Cancelamento a qualquer momento; sem reembolso proporcional do ciclo vigente (exceto arrependimento ou falha grave). Packs avulsos consumidos: não reembolsáveis.

### 2.9 Regras de Upload — **Garantias do Usuário**
- Direitos sobre as peças/produtos;
- **Autorização por escrito da Pessoa Retratada** para uso publicitário inclusive por IA (CF 5º X; CC 20 e 21; LGPD 11);
- Pessoa Retratada maior de 18;
- Não violação de direitos de terceiros;
- Isenção integral ao CriaLook; responsabilidade regressiva.

### 2.10 Conteúdo Proibido
Menores de 18, sexual/pornográfico, violento, discriminatório, falsificado, ilícito, de concorrente, violador de personalidade.

### 2.11 Propriedade Intelectual
- **Campanha gerada:** cedida ao Usuário para uso comercial não exclusivo em sua loja;
- **Vedado:** revenda como serviço de criação; alegar autoria humana exclusiva quando a lei exigir indicação de IA; uso dos prompts/engine para criar produto concorrente;
- **CriaLook retém** modelos, pesos, prompts internos, bases, marca, interfaces.

### 2.12 Responsabilidade do CriaLook
Sem garantia de resultado, perfeição estética ou proteção autoral plena. **Limite:** valor pago nos últimos 12 meses (ressalvados direitos consumeristas irrenunciáveis).

### 2.13 Indenização pelo Usuário
Hold-harmless amplo por uso indevido, violação das garantias de upload, das Campanhas geradas, dos direitos de terceiros ou do contrato.

### 2.14 Suspensão e Encerramento
Aviso prévio de 7 dias (exceto urgência). Portabilidade por até 30 dias após encerramento.

### 2.15 Alterações
Notificação de 30 dias. Rescisão sem ônus pelo Usuário que discordar.

### 2.16 Solução Amigável
30 dias de tratativa antes de ação judicial; canal contato@crialook.com.br.

### 2.17 Legislação e Foro
Lei brasileira. Foro: [PREENCHER: comarca da sede], ressalvado CDC art. 101, I.

---

## 3. Termo de Consentimento Biométrico

**Versão 1.0 — vigente desde [PREENCHER]**  
Art. 11, I, LGPD — consentimento específico e destacado.

### 3.1 Dados tratados
- Imagens de pessoas;
- Características faciais (landmarks, pose, segmentação) — dado sensível;
- Metadados técnicos.

### 3.2 Finalidade EXCLUSIVA
Compor Virtual Try-On para campanhas do Usuário.  
**Vedado:** treinar modelos próprios, identificar pessoas, perfilamento, qualquer outra finalidade.

### 3.3 Subprocessadores
Fashn.ai (EUA), Google/Gemini (EUA), Fal.ai (EUA). Transferência internacional com base no art. 33, II e VIII, LGPD.

### 3.4 Retenção
30 dias após geração OU revogação (o que ocorrer primeiro), ressalvadas obrigações legais.

### 3.5 Autorização da Pessoa Retratada
Se diferente do titular, o titular DECLARA que possui autorização escrita, que a pessoa é maior de 18, que foi informada sobre finalidades/subprocessadores, e assume responsabilidade integral.

### 3.6 Direitos
Confirmação, acesso, correção, eliminação, revogação a qualquer tempo (sem efeito retroativo), petição à ANPD.

### 3.7 Consequência da não concessão
VTO indisponível; demais funcionalidades continuam.

### 3.8 Declaração
Checkbox "Li e aceito" na UI do VTO implica consentimento livre, informado, inequívoco.

### 3.9 Controlador e DPO
[PREENCHER: razão social, CNPJ, endereço] · dpo@crialook.com.br · /dpo

---

## 4. Cookie Banner

### 4.1 Texto principal (layout padrão)
> **Nós usamos cookies.**  
> Utilizamos cookies estritamente necessários para o funcionamento da Plataforma e, mediante seu consentimento, cookies analíticos e de estabilidade para melhorar o produto. Você pode aceitar tudo, rejeitar os opcionais ou personalizar suas preferências. Saiba mais na nossa [Política de Privacidade](/privacidade).
>
> [Personalizar] [Rejeitar opcionais] [Aceitar todos]

### 4.2 Categorias

| Categoria | Status | Base legal |
|---|---|---|
| Estritamente necessários | Sempre ativos | Dispensa consentimento |
| Funcionais | Sempre ativos | Execução de contrato |
| Sentry (erro) | Default: ligado | Legítimo interesse (desativável via código/privacidade) |
| PostHog (analytics) | Default: desligado | Consentimento (opt-in) |
| Marketing | Default: desligado | Consentimento (não utilizado no momento) |

### 4.3 Armazenamento
`localStorage.cookieConsent = { functional: bool, analytics: bool, marketing: bool, timestamp: ISO, version: 1 }`

### 4.4 Evento
`window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: prefs }))` — consumido por PostHog/Sentry.

---

## 5. Subprocessadores

**Última atualização:** [PREENCHER: AAAA-MM-DD]

| Subprocessador | País | Finalidade | Base legal | Política |
|---|---|---|---|---|
| Clerk Inc. | EUA | Autenticação e contas | Execução de contrato | https://clerk.com/privacy |
| Supabase Inc. | EUA (região configurável) | Banco de dados e storage | Execução de contrato | https://supabase.com/privacy |
| Anthropic PBC | EUA | Geração de textos (Claude) | Execução de contrato | https://www.anthropic.com/legal/privacy |
| Google LLC | EUA | Geração de imagens (Gemini) | Execução de contrato | https://policies.google.com/privacy |
| Fashn.ai | EUA | Virtual Try-On | **Consentimento (art. 11, I)** | https://fashn.ai/privacy |
| Fal.ai | EUA | IA generativa de imagens | Execução de contrato / consentimento | https://fal.ai/privacy-policy |
| Mercado Pago | Brasil | Pagamentos | Execução de contrato + obrigação legal | https://www.mercadopago.com.br/privacidade |
| PostHog Inc. | EUA/UE | Analytics | Consentimento (opt-in) | https://posthog.com/privacy |
| Sentry (Functional Software) | EUA | Monitoramento de erros | Legítimo interesse | https://sentry.io/privacy/ |
| Cloudflare, Inc. | EUA (global) | CDN, WAF, DDoS | Legítimo interesse (segurança) | https://www.cloudflare.com/privacypolicy/ |

### 5.1 Alterações
Aviso prévio de 15 dias por e-mail e banner destacado. Histórico sob demanda em dpo@crialook.com.br.

---

## Anexo — Checklist de revisão jurídica humana

- [ ] Preencher todos os `[PREENCHER: ...]`
- [ ] Confirmar DPAs assinados com todos os operadores internacionais
- [ ] Validar nome e qualificação do DPO
- [ ] Publicar vigência em todas as páginas (mesma data)
- [ ] Definir política de reembolso proporcional em arrependimento (item 8 dos Termos)
- [ ] Validar cláusula de limitação de responsabilidade (item 13 dos Termos) frente ao CDC — jurisprudência oscila quanto à sua validade em contratos consumeristas
- [ ] Validar forum de eleição (item 18 dos Termos) — CDC pode invalidar para consumidor PF
- [ ] Implementar endpoints `/api/me` e `/api/me/export`
- [ ] Implementar página `/conta` com revogação de consentimento e exclusão
- [ ] Registrar Controlador na ANPD (quando exigível)
- [ ] Configurar PostHog para respeitar opt-in (sem autocapture até consentimento)
- [ ] Configurar retenção de biometria em 30 dias no backend
- [ ] Treinar equipe sobre resposta a incidentes (art. 48 LGPD)
