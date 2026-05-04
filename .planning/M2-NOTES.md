# M2 — "Consertar tudo" (DRAFT awaiting owner decisions)

**Goal:** Fechar TODOS os gaps reais do M1 + processar TODO o parking-lot blessed + endereçar achados-bonus surfaceados durante M1, deixando o repo numa janela "post-Play approval" mais limpa possível.

**Status:** DRAFT — não executar até owner aprovar escopo + responder 3 decisões abaixo.

---

## Decisões irreduzíveis (preciso de você antes de começar)

### Decisão 1 — Legal drift reconciliation (Option A ou B)
Site `crialook.com.br/{privacidade,termos,dpo}` tem versão FORMAL V1.0 (LGPD article-by-article, ~4000 palavras cada, "vigente desde 2026-04-24", Controlador "Alton Jorge de Souza Vieira" nomeado). In-app `crialook-app/lib/legal/content.ts` tem 9 sections summary friendly. Drift é REAL.

- **(A) Rewrite content.ts verbatim do site** — copia HTML→texto. Resultado: in-app vira ~5x maior, mais formal, pesado pra UX. CI fica green.
- **(B) Manter summary in-app + adicionar link "Ver versão completa em crialook.com.br/X"** — content.ts fica curto, link pra versão formal. UX preservada, mas in-app não é a versão legal canônica (tecnicamente é OK pra Brasil/LGPD desde que o usuário consiga acessar a versão completa).
- **(C) Híbrido** — manter summary as "quick summary" + botão "Versão completa" que renderiza HTML do site (precisa lib HTML render). Mais código, melhor UX possível.

**Recomendação:** **(B)** pra UX + LGPD compliance básica. Adapto `check-legal-drift.js` pra validar que summary in-app é consistente com o "essence" do site (não mais byte-for-byte).

### Decisão 2 — Expo SDK 55+ upgrade (clears 25 mobile vulns)
- **(A) Sim, upgrade nesta milestone** — esforço alto (breaking changes em Expo SDK 54→55 são reais, EAS build pode quebrar, precisa testar tudo no Android device). 25 vulns saem, audit clean. Possivelmente 2-4h de execução com risco de rollback.
- **(B) Não, deferir M3** — vulns são em deps transitivas (não diretas), não bloqueia Play Store, baixo risco operacional. Fazer só M2 cleanup mais leve.
- **(C) Tentar e rollback se quebrar** — eu tento, se EAS preview build falhar eu reverto, partimos pra (B).

**Recomendação:** **(C)** — tenta com safety net. Se SDK 55 break causar mais que 30min de troubleshoot, reverto.

### Decisão 3 — DROP `increment_regen_count(uuid)` migration aplicar agora?
P4 deixou essa deferida pra owner aplicar pós-deploy. Mas: você ainda não fez deploy (122 commits ahead). Posso aplicar agora MESMO via MCP se você confirmar. Risco: produção atual usa o 2-arg (caller principal); 1-arg só era usado num fallback in-source. Dropar pode quebrar se o caller for invocado num caso edge antes do código novo deployar.

- **(A) Aplicar agora via MCP** — assume risco. 1-arg dropado, prod ainda calls 2-arg (que continua existindo).
- **(B) Aguardar owner deploy** — eu deixo a migration file no repo, você aplica depois de `git push` + `bash deploy-crialook.sh`.
- **(C) Aplicar mas criar a 1-arg como NOOP wrapper** — defensive: 1-arg ainda existe mas só faz `RAISE WARNING 'legacy 1-arg called, ignoring'`. Owner detecta no Sentry se tem caller residual.

**Recomendação:** **(B)** pra ser conservador. M2 não executa essa migration, owner aplica quando deployar.

---

## M2 Phases (proposed)

### Phase 1: Backend security gaps (M1 bonus findings)
**Goal:** Fechar os 2 controles missing que P6 audit surfaceou — gates pra eventual Clerk Client Trust re-enable.

**Scope:**
- Add obfuscatedAccountIdAndroid hash validation em `campanha-ia/src/app/api/billing/verify/route.ts`:
  - Extract `obfuscatedExternalAccountId` da Google Play API response
  - Compare com `SHA256(getCurrentUserId(request))` slice 0,64
  - Reject 403 se mismatch
- Wire `consume_rate_limit_token` (P4 RPC) em `/billing/verify` + `/billing/restore` (low-budget bucket — ex: 30 reqs / 5min per user)
- Add testes pra ambos
- Update `CLERK_TRUST_COMPENSATING_CONTROLS.md` com novos refs path:line

**Success criteria:**
1. Mobile envia obfuscated hash != backend SHA256(userId) → 403
2. /billing/verify or /billing/restore com >30 reqs em 5min → 429
3. CLERK_TRUST_COMPENSATING_CONTROLS.md mostra controls 2+3 LIVE com refs

**Migration:** ZERO (rate-limit infra já existe da P4)

---

### Phase 2: Legal drift reconciliation
**Goal:** CI green em `npm run check:legal-drift`, in-app conforme owner Option A/B/C.

**Scope (depends on Decision 1):**
- Implementar Option escolhida em `crialook-app/lib/legal/content.ts`
- Atualizar `crialook-app/scripts/check-legal-drift.js` se Option B/C (validar essence vs byte-for-byte)
- Atualizar `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md` documentando a decisão
- Verificar CI green
- Bump `LAST_UPDATED`

**Success criteria:**
1. `npm run check:legal-drift` exits 0
2. CI workflow check-legal-drift job green

---

### Phase 3: Coverage ratchet to D-10 spec (30% web / 35% mobile)
**Goal:** Atingir D-10 spec ou explicitar honest gap residual.

**Scope:**
- Identificar áreas de baixa cobertura (web routes não testadas, RN screen hooks)
- Adicionar tests unitários onde possível (lib/ utility files, helpers, RPCs)
- RN screen hooks (camera/biometric/push) — provavelmente NÃO testáveis sem maestro/detox; explicitar como tech debt
- Raise vitest thresholds:
  - Web: 30% lines/funcs (atual ~22-30%)
  - Mobile: 35% lines/funcs (atual ~22-29%)
- Se thresholds não atingíveis sem e2e, raise pra max possible + comment doc

**Success criteria:**
1. Web vitest coverage thresholds: lines ≥30, functions ≥35 (or honest max with doc)
2. Mobile vitest coverage thresholds: lines ≥35, functions ≥35 (or honest max with doc)
3. CI continua green

---

### Phase 4: Code cleanup parking lot (low-risk)
**Goal:** Atacar items de cleanup blessed do M1 parking-lot que não têm risco operacional.

**Scope:**
- `process.env.X → env.X` migration (typesafe env access via @t3-oss/env-nextjs ou similar) — full sweep
- Logger consolidation: replace `console.*` em todas as routes (não só /generate que P2 fez)
- `CrialookError` base class: unified error responses com `code` / `userMessage` / `httpStatus`
- `FEATURE_REGENERATE_CAMPAIGN`: ship ou drop (preciso de decisão owner, default=drop)
- Drop `runMockPipeline` from prod bundle (build-time flag)
- TypeScript `as any` sweep (~79 occurrences) — replace com proper types
- Sharp dynamic import → static top-level (perf)
- Manifest URL + apple-icon dead weight removal (web app side ainda usa, mobile não)

**Success criteria:**
1. `grep -rn "process.env\." campanha-ia/src/ | wc -l` < 5 (só em `env.ts` sí mesmo)
2. `grep -rn "console\." campanha-ia/src/app/api/ | wc -l` < 5
3. CrialookError used em ≥10 routes
4. `runMockPipeline` undefined em production bundle
5. `grep -rn "as any" campanha-ia/src/ | wc -l` < 10
6. tsc --noEmit clean
7. vitest 264+ green

---

### Phase 5: Dependency vuln housekeeping
**Goal:** Zero high+ vulnerabilities em `npm audit` (web). Mobile depende da Decisão 2.

**Scope:**
- `next` patch bump (16.x latest)
- `uuid` override em campanha-ia/package.json (transitive via mercadopago)
- `npm audit fix` onde safe (sem breaking changes)
- Mobile (depends Decisão 2):
  - **(2A) Sim:** Expo SDK 54 → 55 upgrade. Test Android EAS preview build.
  - **(2B) Não:** skip mobile vuln fixes
  - **(2C) Try+rollback:** attempt SDK 55, rollback se preview break

**Success criteria:**
1. `cd campanha-ia && npm audit --audit-level=high` returns 0 vulns
2. (depends 2): mobile audit clean OR honest doc

---

### Phase 6: Owner-action doc improvements
**Goal:** Tornar os runbooks owner-action mais self-service.

**Scope:**
- Add `scripts/play-release-prep.sh` — automatiza partes do PLAY_RELEASE_CHECKLIST que são scriptáveis (validação placeholder, gen of assetlinks template, etc)
- Add `scripts/clerk-revoke-loadtest-sessions.sh` — usa Clerk Admin API se SDK admin estiver instalado, OU prints exact Dashboard URLs pra owner clicar
- Add `scripts/check-deploy-readiness.sh` — pre-flight check antes de `git push`: tests green, no uncommitted, migrations applied, etc

**Success criteria:**
1. 3 novos scripts em `scripts/`
2. README.md atualizado com "Owner workflows" section

---

### Phase 7: Minor cleanup parking lot
**Goal:** Limpar itens triviais blessed do parking lot.

**Scope:**
- iOS section cleanup em `crialook-app/app.config.ts` (drop iOS-specific paths/props)
- Manifest URL + apple-icon dead weight removal in web (only if web doesn't depend on them)
- Storybook×Vite peer-dep resolution — vite ^6.4.2 deve satisfazer storybook ^8.6.18, drop --legacy-peer-deps se possível
- Storage GC schedule verification em `lib/storage/garbage-collector.ts`
- Drop `lint-staged` zombie config (P3 já wired husky, mas pode ter resíduos)

**Success criteria:**
1. iOS section comments dropped from app.config.ts
2. apple-icon, manifest URL: confirmed unused → removed
3. Storybook builds without --legacy-peer-deps
4. Storage GC scheduled (or doc explaining why not)

---

### Phase 8: Final M2 verification + STATE close
**Goal:** Fechar M1+M2 cleanly.

**Scope:**
- Re-run all tests (web + mobile)
- `npm audit` cross-check
- Update STATE.md: M1 ✅ + M2 ✅
- Update ROADMAP.md progress table
- Generate `M1+M2-SUMMARY.md` for posterity
- Optionally: spawn `gsd-audit-milestone` agent for formal audit

---

## What's NOT in M2 (still parking-lot indefinite)

- Phase 2.5 (Labeling) — judge calibration: indefinitely deferred per project memory
- Multi-instance rate-limit migration to Redis: parking-lot per ROADMAP M1
- GPG-signed commit verification: parking-lot
- Mercado Pago webhook IP allowlist at nginx: parking-lot (IP ranges churn)
- Editor password → per-user passwords: acceptable at scale per CONCERNS §2
- Maestro/Detox e2e: explicit defer, blocks Phase 3 D-10 spec to "honest max"
- Anything that requires my SSH/EAS/Clerk Dashboard/Play Console access — owner-only

---

## Estimated scope

| Phase | Tasks | Wall-clock | Risk |
|-------|-------|------------|------|
| 1 | ~6 | 30-45min | Low |
| 2 | ~3 | 15-30min | Low (B) / Medium (A) |
| 3 | ~10-15 | 1-2h | Medium (RN screens hard to cover) |
| 4 | ~20 (sweep) | 2-3h | Medium (TS errors may surface) |
| 5 | ~5 | 30min (B) / 1-2h (C) / 2-4h (A) | Low (B/C) / High (A) |
| 6 | ~5 | 45min | Low |
| 7 | ~6 | 30-45min | Low |
| 8 | ~3 | 15min | Low |

**Total estimated:** 6-12h wall-clock dependendo das 3 decisões.

---

## Coordination guardrails (lessons from M1)

- ONE git-mutating background agent at a time (P3 reset incident)
- Migrations applied via MCP between phases (P1+P2+P4 pattern)
- Atomic commits per task, husky hook protects type errors
- Code-prep done by me, all SSH/EAS/Dashboard/Play Console = owner action
