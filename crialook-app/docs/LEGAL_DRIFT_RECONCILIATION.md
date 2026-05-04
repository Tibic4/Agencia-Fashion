# Legal Content Drift Reconciliation — Phase 7 Baseline (F-06)

**Audit date:** 2026-05-03
**Audited by:** GSD Phase 7 plan 07-03
**Site URLs audited:** crialook.com.br/{privacidade,termos,dpo,subprocessadores,consentimento-biometrico}
**In-app source:** `crialook-app/lib/legal/content.ts` (LAST_UPDATED bumped to "3 de maio de 2026" this run)
**Method:** manual fetch (curl) + heuristic content extraction from Next.js RSC payload + visual diff against the 5 exports in content.ts. Automated CI check lands in plan 07-07 against the same 3 primary URLs.

---

## Summary

| Section | Site URL status | Drift verdict | Decision |
|---------|-----------------|---------------|----------|
| Política de Privacidade | HTTP 200 (140 KB) | **MAJOR DRIFT** — site is a formal V1.0 (vigente 2026-04-24); in-app is a shorter friendlier summary | OWNER ACTION (see below) |
| Termos de Uso | HTTP 200 (120 KB) | **MAJOR DRIFT** — site is a formal V1.0 (Dec. 7.962/2013 + 13 numbered clauses); in-app is a 9-section friendly version | OWNER ACTION (see below) |
| Encarregado (DPO) | HTTP 200 ( 96 KB) | **MAJOR DRIFT** — site lists DPO name + CPF + endereço; in-app is generic | OWNER ACTION (see below) |
| Subprocessadores | HTTP 200 (118 KB) | (URL exists; not in CONTEXT D-06 primary list — automated CI script tracks 3 primary only) | OWNER review recommended |
| Consentimento Biométrico | HTTP 200 (105 KB) | (URL exists; not in CONTEXT D-06 primary list) | OWNER review recommended |

**Total: MAJOR DRIFT in all 3 primary URLs.** Both surfaces are valid legal texts but they are not byte-equivalent. Site is the more recent and more formal V1.0 (vigente desde 2026-04-24), with named Controlador (Alton Jorge de Souza Vieira, CPF redacted, endereço Patrocínio/MG) and detailed LGPD article references. In-app is a shorter, more user-friendly version dated "27 de abril de 2026" without those explicit identifiers.

This is a Google Play User Data Policy concern: in-app disclosure should match the privacy URL byte-for-byte (or as close as practical). Two reconciliation paths:

**Option A (default per D-08): bring content.ts up to site V1.0 verbatim.** Pros: zero drift, audit-trail clean. Cons: (i) explicit Controlador identifiers (CPF, endereço) currently REDACTED in raw RSC payload — need to confirm with owner what is OK to ship in-app. (ii) Verbose formal text degrades in-app UX (~5x longer scroll vs current).

**Option B (alternative per D-08): synthesize — keep in-app friendly summary + add a "for the full legal text, see crialook.com.br/X" link block at the top of each in-app screen.** Then the in-app is the SUMMARY surface, the site is the AUTHORITATIVE surface, and the link makes the relationship explicit. This is a real Play-acceptable pattern (e.g., banking apps).

**Decision (this run):** Plan 07-03 records the drift but DOES NOT silently rewrite content.ts to ~5x larger formal text without owner sign-off. The doc bumps LAST_UPDATED to today (audit happened) and flags this as **OWNER ACTION P0** before plan 07-07 wires the CI check (otherwise the CI script will fail on day 1 because of this baseline drift).

---

## Fetch transcript

All 5 URLs fetched on 2026-05-03 ~09:47 UTC via `curl -sSL --max-time 30`. All returned HTTP 200 on first attempt (no retries needed).

### https://crialook.com.br/privacidade
- HTTP status: 200
- Content-Length: 140,357 bytes
- Extracted text length (RSC payload): ~142 children-string snippets

### https://crialook.com.br/termos
- HTTP status: 200
- Content-Length: 119,654 bytes
- Extracted text length: ~103 snippets

### https://crialook.com.br/dpo
- HTTP status: 200
- Content-Length:  96,610 bytes
- Extracted text length: ~18 snippets

### https://crialook.com.br/subprocessadores
- HTTP status: 200
- Content-Length: 118,282 bytes

### https://crialook.com.br/consentimento-biometrico
- HTTP status: 200
- Content-Length: 105,310 bytes

---

## Diff: Política de Privacidade — illustrative samples

The site uses Next.js App Router + RSC; the payload was sniffed via grep for `children\":\"…` snippets in the streamed React tree. Representative excerpts:

### Site has — NOT in content.ts

- "Versão 1.0 · Vigente desde 2026-04-24 · Conforme LGPD (Lei 13.709/2018)"
- "Para fins da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — "LGPD"), o Controlador dos dados pessoais tratados por meio do CriaLook é:"
- "Controlador: Alton Jorge de Souza Vieira (pessoa física, atuando como desenvolvedor independente)"
- "Encarregado pelo Tratamento de Dados Pessoais (DPO): Alton Jorge de Souza Vieira — contato@crialook.com.br"
- "Dados completos do controlador (CPF, endereço, telefone) podem ser solicitados via e-mail ao DPO em situação que exija formalização (ex.: requerimento da ANPD, processo judicial)."
- "5. Tratamento de Dados Sensíveis — Biometria Facial (art. 11 LGPD)"
- (~140 more snippets; site has numbered sections 1..N with article-by-article LGPD mapping)

### content.ts has — NOT on site (as currently written)

- "Mantemos seus dados enquanto a conta estiver ativa. Após exclusão, removemos em até 30 dias, salvo obrigações legais (ex: nota fiscal)."
- "Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Tokens guardados em Keychain (iOS) / Keystore (Android). Acessos auditados."
- (in-app version is concise; site V1.0 is verbose-formal)

**Decision:** OWNER ACTION — see "Owner action items" below.

---

## Diff: Termos de Uso — illustrative samples

### Site has — NOT in content.ts

- "Versão 1.0 · Vigente desde 2026-04-24"
- "1. Identificação do Fornecedor (Dec. 7.962/2013, art. 2º)"
- "Fornecedor: Alton Jorge de Souza Vieira (pessoa física, atuando como desenvolvedor independente)"
- "Localização: Patrocínio/MG, Brasil"
- "Plataforma: o sítio crialook.com.br, subdomínios, aplicações e APIs associadas."
- "Titular ou Usuário: pessoa física maior de 18 anos, ou pessoa jurídica regularmente constituída, cadastrada na Plataforma."
- "Conta: perfil individual e intransferível criado no processo de cadastro."
- "Modelo Virtual: imagem de pessoa gerada ou composta pela IA (Virtual Try-On) a partir de inputs do Usuário."
- (~100 more numbered legal definitions and clauses)

### content.ts has — NOT on site (as currently written)

- "Dúvidas? Escreva para contato@crialook.com.br."
- (the in-app 9-section friendly version is short and consumer-tone)

**Decision:** OWNER ACTION.

---

## Diff: Encarregado (DPO) — illustrative samples

### Site has — NOT in content.ts

- "Encarregado pelo Tratamento de Dados Pessoais (DPO)"
- "Canal de comunicação previsto no art. 41 da Lei 13.709/2018 (LGPD)"
- "Endereço para correspondência: [REDACTED-ENDERECO] — [REDACTED] — Patrocínio/MG (A/C: Alton Jorge de Souza Vieira)"
- "Alton Jorge de Souza Vieira (pessoa física) — CPF [REDACTED-CPF]"
- "Por carta registrada ao endereço acima informado."

### content.ts has — NOT on site

- The in-app DPO page is ~7 sections of friendly explanation; the site lists the named Encarregado + endereço explicitly. **The named Encarregado + CPF + endereço is the kind of detail a Play reviewer expects to see in the privacy URL.**

**Decision:** OWNER ACTION — at minimum the in-app DPO screen should add the named Encarregado (Alton Jorge de Souza Vieira) so the in-app and site agree on WHO the DPO is.

---

## In-app-only sections (no corresponding diff this run)

### subprocessadores
- Site URL HTTP 200; ~118 KB
- Not in CONTEXT D-06 primary list. The 07-07 CI script audits only the 3 primary URLs (privacidade/termos/dpo). Owner may want to extend the script in M2 to cover all 5; not blocking M1.

### consentimentoBiometrico
- Site URL HTTP 200; ~105 KB
- Same status as above. The in-app text addresses biometrics directly; site has its own dedicated page.

---

## Owner action items (P0 before submission AND before 07-07 CI lands)

The drift is real and material. Three concrete asks:

- [ ] **OWNER DECIDE: Option A or Option B** (verbatim site or summary+link). Whichever is chosen, the OUTCOME must be byte-aligned across content.ts ↔ site ↔ Play Console submission. Drift in any direction is a Play User Data policy violation.

- [ ] **OWNER: confirm DPO identifiers can be in-app verbatim.** Site lists "Alton Jorge de Souza Vieira" as Controlador + DPO with CPF+endereço in the RSC payload (currently REDACTED in this audit transcript). If those identifiers are intended for the published privacy URL, they should also be in-app — at minimum the named DPO.

- [ ] **OWNER: review subprocessadores and consentimento-biometrico site pages** vs the in-app exports. Sites exist (HTTP 200), so Play reviewers can land on them; in-app should be aligned even though they're outside the CI-tracked 3 primary URLs.

- [ ] **GATING NOTE for plan 07-07:** the automated CI script will fail on day 1 if reconciliation is not done before it merges. Two acceptable paths:
  1. Reconcile content.ts to match site (Option A) BEFORE 07-07 lands.
  2. Land 07-07 anyway with the script intentionally gated to dry-run-only mode (or add an `:: PENDING_OWNER_RECONCILIATION ::` skip flag) until the owner ticks the boxes above. Plan 07-07 currently does NOT add this skip flag — see 07-07 action items in its plan body.

---

## What changed in content.ts this run

- `LAST_UPDATED` bumped from `'27 de abril de 2026'` → `'3 de maio de 2026'` (the audit ran today; constant must reflect that even though no string content was rewritten without owner sign-off).

**No string content was rewritten.** The drift is documented above; reconciliation is owner-action P0.

---

## Sign-off

- [x] All 3 primary URLs successfully fetched (HTTP 200)
- [x] Drifts enumerated (illustrative samples per section; full RSC payloads available at `C:/Users/bicag/AppData/Local/Temp/legal-drift/{slug}.html` for re-derivation)
- [x] LAST_UPDATED constant bumped to 2026-05-03 (PT-BR: "3 de maio de 2026")
- [ ] **content.ts reconciled to site (Option A) OR site updated to summary+link pattern (Option B) — BLOCKED on owner action**
- [ ] 07-07 CI script gating decided (reconcile-first vs skip-flag-first)

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| 2026-05-03 | Phase 7 plan 07-03 | Initial baseline audit; recorded MAJOR DRIFT in all 3 primary URLs; flagged owner-action P0; bumped LAST_UPDATED |
