# LGPD Compliance — CriaLook

> Documento-vivo de acompanhamento da conformidade com a LGPD (Lei 13.709/2018). Última atualização: 2026-04-24.

---

## 1. O que já foi feito (entrega atual)

### 1.1 Documentação jurídica (minutas)
- [x] **Política de Privacidade** completa, com 17 seções (identificação do controlador, dados, bases legais, subprocessadores, transferência internacional, retenção, direitos do titular, cookies, segurança, menores, biometria, DPO, ANPD, alterações, foro). Arquivo TSX em `src/app/privacidade/page.tsx`.
- [x] **Termos de Uso** completos conforme CDC, Dec. 7.962/2013 e Marco Civil (19 seções). Arquivo TSX em `src/app/termos/page.tsx`.
- [x] **Termo de Consentimento Biométrico** separado, destacado, conforme art. 11, I, LGPD. Arquivo TSX em `src/app/consentimento-biometrico/page.tsx`.
- [x] **Página do DPO** com competências (art. 41 §2º LGPD) e canais de contato. Arquivo TSX em `src/app/dpo/page.tsx`.
- [x] **Aviso público de Subprocessadores** com tabela de 10 operadores, países, finalidades e bases legais. Arquivo TSX em `src/app/subprocessadores/page.tsx`.
- [x] **Minutas consolidadas** em Markdown em `docs/juridico/MINUTAS-CONSOLIDADAS.md`.

### 1.2 Componentes técnicos
- [x] **CookieBanner** (`src/components/CookieBanner.tsx`):
  - Aparece se `localStorage.cookieConsent` ausente;
  - Botões "Aceitar tudo", "Rejeitar opcionais", "Personalizar";
  - Persiste `{ functional, analytics, marketing, timestamp, version }`;
  - Dispara `CustomEvent("cookie-consent-changed")` — consumível por PostHog/Sentry;
  - Re-dispara evento em remount para sincronizar consumidores em navegação SPA;
  - Versiona o consentimento (`version: 1`) para reset futuro.

### 1.3 Estrutura visual
- [x] Padrão visual alinhado ao restante do projeto (Tailwind + design tokens `var(--background)`, `var(--surface)`, `var(--border)`, `var(--brand-500)`, `var(--foreground)`, `var(--muted)`, classes `.glass`, `.btn-primary`, `.badge`).
- [x] Header/Footer consistentes; responsividade mobile-first.
- [x] Blocos destacados (`highlight: true`) para seções sensíveis (biometria, menores de idade, upload).

---

## 2. O que o advogado humano precisa revisar

### 2.1 Pontos de atenção específicos
- [ ] **Limitação de responsabilidade** (Termos § 13) — cláusula limitativa tem validade controvertida frente ao CDC. Decidir se mantém, retira ou restringe a consumidor não-hipossuficiente (B2B).
- [ ] **Foro de eleição** (Termos § 18) — inválido para consumidor pessoa física (CDC art. 101, I). Validar redação da ressalva.
- [ ] **Direito de arrependimento com créditos consumidos** (Termos § 8) — jurisprudência divergente sobre abatimento proporcional em serviço digital de consumo imediato. Definir política comercial e formalizá-la.
- [ ] **Cessão de direitos sobre Campanha gerada** (Termos § 12) — revisar cláusula à luz dos ToS de Anthropic, Google Gemini, Fashn.ai e Fal.ai; confirmar se o que se cede é compatível com o que os modelos licenciam.
- [ ] **Uso obrigatório do disclosure de IA** — avaliar se há exigência legal em segmentos específicos (ex.: publicidade ao consumidor, menor de idade, saúde).
- [ ] **Retenção de biometria em 30 dias** — tecnologicamente viável? Validar com squad técnica; ajustar se necessário.
- [ ] **Cláusulas contratuais (DPAs)** — confirmar a existência de DPA assinado com cada operador listado (Clerk, Supabase, Anthropic, Google, Fashn, Fal, PostHog, Sentry, Cloudflare, Mercado Pago).
- [ ] **Registro dos tratamentos (RoPA)** — construir o Registro de Operações de Tratamento exigido pelo art. 37 da LGPD. Não está coberto pelas minutas.
- [ ] **Relatório de Impacto à Proteção de Dados (RIPD)** — recomendado para VTO (dado sensível + transferência internacional + IA), art. 38 LGPD.
- [ ] **Política de retenção e descarte interno** — documentar os procedimentos operacionais que implementam os prazos publicados.
- [ ] **Plano de resposta a incidentes** — procedimento de comunicação à ANPD e aos titulares (art. 48 LGPD) com prazos internos.
- [ ] **Contrato com modelos/terceiros retratados** — recomendar aos lojistas uso de modelo de termo de autorização de uso de imagem (template para o CriaLook distribuir).

### 2.2 Itens que dependem de decisão comercial
- [ ] Janela de reembolso estendida (além dos 7 dias legais) — diferencial competitivo?
- [ ] Política de cessão/uso dos dados em caso de aquisição societária (M&A clause).
- [ ] Período de grace após cancelamento antes de eliminar dados definitivamente.

---

## 3. O que depende de dados do usuário (pendências de preenchimento)

Todos os trechos marcados como `[PREENCHER: ...]` nos arquivos TSX e no MD consolidado. Abaixo, a lista curada:

### 3.1 Dados do controlador
- [ ] **Razão social completa**
- [ ] **CNPJ** (formato XX.XXX.XXX/XXXX-XX)
- [ ] **Endereço completo** com CEP
- [ ] **WhatsApp/Telefone** com DDD
- [ ] **Nome completo do DPO** (pessoa física indicada como Encarregado)
- [ ] **Data de vigência** inicial da Política, Termos e Consentimento Biométrico (formato AAAA-MM-DD)

### 3.2 Jurídico/operacional
- [ ] **Comarca da sede** (para foro de eleição nos Termos e na Política)
- [ ] **Endereço postal** para recebimento de requisições formais de titulares (pode ser o mesmo da sede ou um endereço específico)

### 3.3 Subprocessadores
- [ ] **Data da última revisão** da lista de subprocessadores em `/subprocessadores`
- [ ] Confirmar que a lista está completa — se houver e-mail transacional (Resend, SendGrid), SMS, atendimento (Intercom, Crisp), analytics adicional, etc., incluir.
- [ ] Confirmar **região do Supabase** (US-East, SA-East etc.)

### 3.4 Itens técnicos a implementar
- [ ] Endpoint `GET /api/me` — retorna dados do usuário autenticado
- [ ] Endpoint `GET /api/me/export` — portabilidade (JSON ou ZIP)
- [ ] Endpoint `DELETE /api/me` — eliminação (com confirmação)
- [ ] Página `/conta` — painel com exportação, exclusão e revogação de consentimento biométrico
- [ ] Job de retenção: eliminar biometria > 30 dias
- [ ] Job de retenção: eliminar conteúdo de conta encerrada > 90 dias
- [ ] PostHog configurado para NÃO capturar até opt-in (desativar autocapture por padrão)
- [ ] Sentry com `beforeSend` respeitando preferência do cookie banner
- [ ] Registro de logs de acesso por 6 meses (MCI art. 15)

---

## 4. Mapa de arquivos

```
d:/Nova pasta/Agencia-Fashion/
├── campanha-ia/
│   └── src/
│       ├── app/
│       │   ├── privacidade/page.tsx          [ATUALIZADO]
│       │   ├── termos/page.tsx               [ATUALIZADO]
│       │   ├── dpo/page.tsx                  [NOVO]
│       │   ├── subprocessadores/page.tsx     [NOVO]
│       │   └── consentimento-biometrico/page.tsx  [NOVO]
│       └── components/
│           └── CookieBanner.tsx              [NOVO]
└── docs/
    └── juridico/
        ├── MINUTAS-CONSOLIDADAS.md           [NOVO]
        └── LGPD-COMPLIANCE.md                [NOVO — este arquivo]
```

---

## 5. Integração do CookieBanner

Para ativar o banner na aplicação, adicione no layout raiz (`src/app/layout.tsx`) ou em um provider global:

```tsx
import CookieBanner from "@/components/CookieBanner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
```

E integre com PostHog/Sentry escutando o evento:

```ts
window.addEventListener("cookie-consent-changed", (e: Event) => {
  const detail = (e as CustomEvent<{ analytics: boolean; marketing: boolean; functional: boolean }>).detail;
  if (detail.analytics) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
});
```

---

## 6. Referências normativas utilizadas

- **LGPD** — Lei 13.709/2018 (arts. 5º, 6º, 7º, 11, 18, 19, 33, 37, 38, 41, 48)
- **CDC** — Lei 8.078/1990 (arts. 4º, 6º, 12-14, 39, 49, 101)
- **Marco Civil da Internet** — Lei 12.965/2014 (arts. 13, 15, 19, 21)
- **Decreto 7.962/2013** — Regulamentação do CDC para e-commerce (art. 2º)
- **Código Civil** — Lei 10.406/2002 (arts. 5º, 20, 21, 186, 206 §3º V, 927)
- **Constituição Federal** — art. 5º, X (direito à imagem)
- **CTN** — Lei 5.172/1966 (arts. 173, 174 — prazos fiscais)
