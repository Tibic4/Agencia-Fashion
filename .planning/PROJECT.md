# PROJECT — CriaLook

## Vision

CriaLook é um SaaS B2C que transforma uma foto de peça de roupa em uma campanha de moda completa (foto editorial gerada com IA, copy persuasivo, hashtags, score de conversão) em ~60 segundos. Público: lojistas brasileiros que vendem por Instagram, WhatsApp e Meta Ads.

Em produção em **crialook.com.br** com usuários pagantes.

## Topology

Monorepo com dois produtos principais + utilitários:

| Path                       | Stack                                  | Status                           |
| -------------------------- | -------------------------------------- | -------------------------------- |
| `campanha-ia/`             | Next.js 16, TypeScript 5, Tailwind 4   | Produção (web)                   |
| `crialook-app/`            | Expo SDK 54, React Native 0.81, Android-only | Em revisão Play Store      |
| `curriculo/`               | Python utility (CV gen)                | Não relacionado, baixa prioridade |
| `ops/`, `loadtests/`       | Scripts ops, testes de carga           | Apoio                            |
| Root: `deploy-crialook.sh`, `nginx-crialook.conf`, `ecosystem.config.js`, `Dockerfile` | Deploy & ops      | Produção                  |

Pipeline IA (paralelo, ~50–60s end-to-end):
- **Gemini 3.1 Pro** — Analyzer (entende a peça)
- **Gemini VTO ×3** — gera 3 variações editoriais
- **Claude Sonnet 4.6** — Copy/legendas/hashtags

Stack ops: **Supabase** (Postgres + RLS, ~14 RPCs SECURITY DEFINER), **Clerk** (auth), **Mercado Pago** (pagamentos), **Inngest** (jobs), **Sentry** (observability).

## Current Milestone — `M1: Hardening + Play Readiness`

Duas trilhas paralelas, mesma janela:

### Trilha A — Bug-bash & hardening do monorepo
Varredura sistemática achando bugs, problemas de segurança, race conditions, fragilidades de ops e gaps de teste no `campanha-ia/` e na infra de deploy. Fixar em ondas por severidade. Findings de partida em `.planning/audits/MONOREPO-BUG-BASH.md`.

### Trilha B — Estabilizar `crialook-app` para review final da Play Store
Fechar todos os blockers de Play review (compliance, build hygiene, runtime stability, segurança), preparar plano de re-enable do **Clerk Client Trust** (atualmente desligado) pós-aprovação. Findings de partida em `.planning/audits/CRIALOOK-PLAY-READINESS.md`.

## Constraints (não negociáveis)

- **Produção com usuários pagantes** — zero tolerância pra bug em rota de pagamento, auth, ou pipeline `/gerar`. Mudanças nessas áreas precisam de teste + rollback claro
- **`crialook-app` é Android-only** — Play Store é o único alvo; dropar/flagar paths/props iOS-specific
- **EAS build expects npm 10 lock** — regen `crialook-app/package-lock.json` SEMPRE com `npm run lock:fix`, NUNCA com `npm install` direto
- **Clerk Client Trust desligado** — temporário, só pra passar Play review. M1 deve produzir plano de re-enable mas NÃO re-ligar até app aprovado
- **Phase 2.5 (Labeling) deferred indefinidamente** — judge captura uncalibrated, não propor implementation, Promptfoo nunca block PR
- **Storybook×Vite peer-dep conflict** em `crialook-app` (vite@^8 vs storybook@8.6.18) — atualmente roda com `--legacy-peer-deps`; não regredir esse hack sem decidir destino do Storybook

## Stakeholders

- **Owner / Tech lead:** usuário deste workspace (bicagold@gmail.com)
- **Production users:** lojistas brasileiros (web ativa)
- **Play Store reviewers:** gate externo da Trilha B

## Sources of truth (read these before planning any phase)

- Codebase intel: `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `QUALITY.md`, `CONCERNS.md`
- Bug-bash findings: `.planning/audits/MONOREPO-BUG-BASH.md`
- Play readiness findings: `.planning/audits/CRIALOOK-PLAY-READINESS.md`
- Limpeza pós-monorepo: root `TASKS.md`
- Vision/produto: root `README.md`
- Histórico de planejamento anterior: `.planning-old/` (referência, NÃO truth)
