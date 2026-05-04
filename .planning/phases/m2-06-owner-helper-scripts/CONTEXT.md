# M2 P6 — Owner-action helper scripts

**Goal:** Tornar runbooks owner-action self-service via 3 scripts pre-flight em `scripts/`.

**Status:** EXECUTED.

## Context

M1 + M2 P1-P5 acumularam ~5 runbooks owner-only (PLAY_RELEASE_CHECKLIST, DEPLOY_USER_MIGRATION, csp-rollout, deploy.md, CLERK_KEYS rotation). M2-NOTES §Phase 6 pediu 3 helper scripts para automatizar as partes scriptáveis e printar URLs/instruções para as que precisam de credencial humana.

## Deliverables

### 1. `scripts/play-release-prep.sh` (bash)
Owner pre-flight antes de `eas build`. 6 steps:
1. `eas.json` placeholder check (3 Clerk pks + 3 Sentry DSNs distintos, sem `PLACEHOLDER`).
2. `crialook-app/store-assets/assetlinks.json` SHA-256 != `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`.
3. Mobile vitest (`npm test`).
4. Mobile tsc.
5. expo-doctor.
6. `expo prebuild --platform android --clean` + grep `POST_NOTIFICATIONS` + `com.android.vending.BILLING` em `AndroidManifest.xml`.

Wired em `crialook-app/package.json` como `npm run play:prep`.

### 2. `scripts/clerk-revoke-loadtest-sessions.sh` (bash)
Helper informativo para 2 user IDs surfaceados em `loadtests/.env.loadtest` (M1 P4):
- Prod: `user_3Bxfdbw0jmhHyE7Xc2bIgVkH6i3` (instance `clerk.crialook.com.br`).
- Dev: `user_3BuUmVnqcFeMEV72k5Hkqw4kzP1` (instance `casual-vervet-96.clerk.accounts.dev`).

Detecta se `@clerk/backend` está instalado (incl. transitivamente via `@clerk/nextjs`); printa URLs do Dashboard + `curl` templates do Admin API se sim. **Não chama API alguma**, owner aplica `CLERK_SECRET_KEY` por instância na hora de rodar.

Wired em `campanha-ia/package.json` como `npm run clerk:revoke-loadtest` (não há root `package.json`).

### 3. `scripts/check-deploy-readiness.sh` (bash)
Owner pre-flight antes de `git push` + `bash deploy-crialook.sh`. 7 steps:
1. `git status --short` clean.
2. `git log origin/main..HEAD` count, WARN se > 50.
3. Web `npm run test:ci`.
4. Web tsc.
5. Web lint.
6. Web `npm run build`.
7. Best-effort Supabase migration parity (skip se `supabase` CLI ausente).

Wired em `campanha-ia/package.json` como `npm run deploy:check`.

### README
Adicionada seção `🛠️ Owner workflows` antes de `📊 Auditoria & qualidade` com tabela cross-ref para os 3 scripts + outros runbooks owner-action sem wrapper.

## Hard constraints honored

- ✅ Nenhum script chama remote APIs ou faz git push.
- ✅ Nenhum `npm install` — só Node built-ins (fs, child_process implícito) e ferramentas *nix padrão.
- ✅ `play:prep` NÃO executa `eas build`; `deploy:check` NÃO executa `deploy-crialook.sh`; `clerk:revoke-loadtest` NÃO chama Admin API.
- ✅ Husky pre-commit ativo (typecheck + lint-staged) — passa porque scripts são bash + edits triviais em package.json/README.

## Atomic commits

- `feat(m2-06-01)`: play-release-prep.sh + crialook-app `play:prep` script.
- `feat(m2-06-02)`: clerk-revoke-loadtest-sessions.sh + campanha-ia `clerk:revoke-loadtest` script.
- `feat(m2-06-03)`: check-deploy-readiness.sh + campanha-ia `deploy:check` script.
- `docs(m2-06-04)`: README "Owner workflows" section.
- `docs(m2-06-05)`: phase context.

## Test count delta

Sem nenhum test mudado — scripts são owner-tooling, não código de produção. Suite: 597 → 597 (web 428 + mobile 169).

## Notas de execução

- `expo prebuild` no script play-release-prep é a etapa mais lenta (~60-120s). É necessário porque o "AndroidManifest.xml gerado contém POST_NOTIFICATIONS + BILLING" é exatamente o defense-in-depth do D-15/D-16 (PLAY_RELEASE_CHECKLIST step 9). Owner pode pular se quiser, mas perde o gate.
- `@clerk/backend` está disponível transitivamente via `@clerk/nextjs` em `campanha-ia/node_modules/`. Script detecta isso e mostra os templates de API mesmo sem dep explícita.
- `check-deploy-readiness.sh` step 7 (Supabase parity) é best-effort. CLI ausente → SKIP, não FAIL. Owner aplica migrations via MCP entre fases (padrão M1 P1+P2+P4).
