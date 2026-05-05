# Agencia-Fashion — Claude instructions

## Skill precedence

- **GSD skills (`gsd-*`)** — usar para qualquer trabalho dentro do fluxo de fase do projeto (discuss → plan → execute → verify, code review, debug de phase, milestones, roadmap). Estado vive em `.planning/`.
- **Superpowers skills** — usar para tarefas avulsas fora do fluxo de fase: bugfix pontual, exploração ad-hoc, refactor isolado, perguntas, scripts utilitários.

Se o usuário pedir algo que cabe nos dois, prefira GSD quando houver `.planning/` ativo no diretório envolvido; senão, Superpowers.

## Convenções específicas do projeto

Ver memória persistente em `C:\Users\bicag\.claude\projects\d--Nova-pasta-Agencia-Fashion\memory\MEMORY.md` — contém regras sobre `crialook-app` (Android-only, EAS npm lock), Clerk Client Trust e Phase 2.5.
