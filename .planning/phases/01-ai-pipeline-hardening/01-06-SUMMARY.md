---
phase: 01-ai-pipeline-hardening
plan: 06
subsystem: docs
tags: [adr, domain-rubric, compliance, conar, lgpd]
requires: []
provides:
  - "ADR-AI-FRAMEWORK.md (D-05/D-06 source-of-truth for the bare-SDK choice)"
  - "DOMAIN-RUBRIC.md (D-11/D-12/D-13/D-14 source-of-truth for fashion copy quality)"
affects: []
tech_added: []
patterns: []
files_created:
  - .planning/codebase/ADR-AI-FRAMEWORK.md
  - .planning/codebase/DOMAIN-RUBRIC.md
files_modified: []
decisions:
  - "DOMAIN-RUBRIC.md opens with D-12 compliance posture (lojista as anunciante) before any rubric content, per execution directive."
  - "Captioned-Examples section is an explicit TODO placeholder; no examples fabricated (CONTEXT.md <specifics> rule)."
  - "Forbidden List entries each carry a regex hint sized for Phase 1 token-regex guardrails (AI-SPEC §6.1) — Phase 2 LLM-as-judge handles the semantic checks."
  - "ONE prompt-content gap surfaced for the next prompt-content phase: Sonnet's Transformação example 'afina a cintura na hora' is body-transformation phrasing that conflicts with D-12. Documented in 'Known prompt-content gaps' section; NOT fixed (Phase 01 is infrastructure-only per CONTEXT.md scope)."
metrics:
  duration_minutes: 7
  completed_date: 2026-05-03
  files_changed: 2
  tasks_completed: 2
---

# Phase 01 Plan 06: Domain Docs Summary

Two source-of-truth documentation files added to `.planning/codebase/` — an ADR justifying the bare-SDK pipeline choice (D-05/D-06) and a DOMAIN-RUBRIC for fashion-copy quality opening with lojista-as-anunciante compliance (D-11..D-14). Pure documentation, no code changes.

## Documents Created

| File | Lines | Words | Sections | Anchors |
|---|---|---|---|---|
| `.planning/codebase/ADR-AI-FRAMEWORK.md` | 74 | 1,007 | 9 (Status/Context/Decision/Versions/Rejected Alternatives/Vendor Lock-In/Revisit Triggers/Operational Patterns Preserved/Sources) | All 4 rejected alternatives present (Vercel AI SDK, Mastra, LangChain/LangGraph, Inngest Agent Kit). All 4 revisit triggers present (≥4 LLM calls, agentic loop, new provider, >2 prompt-quality regressions / 90d). |
| `.planning/codebase/DOMAIN-RUBRIC.md` | 369 | 4,656 | 12 (Compliance Posture / Glossary / 5-Trigger Taxonomy / Forbidden List / Anti-Cliché List / Pose-Bank / Captioned Examples TODO / PT-EN Parity Checklist / Document Maintenance / Domain Expert Roles / Sources / Header) | Opens with D-12 compliance posture. All 5 mental triggers (Escassez, Prova social, Curiosidade, Transformação do LOOK NÃO do CORPO, Preço) covered with PASS/FAIL examples + source-line citations. All 8 POSE_BANK entries documented with visual-problem rationale. PT/EN parity checklist present. D-14 maintenance note present. |

ADR sits below the 100-line target floor in the plan's prose (`Total document target: ~150-200 lines`) but passes both verification grep gates (rejected alternatives ≥4 ✓, revisit triggers ≥4 ✓) and contains every section the plan's `<done>` clause requires. The line-count gap reflects density, not missing content — every section is substantive and the alternative would be padding.

## Sources Lifted From

### ADR-AI-FRAMEWORK.md
- `01-AI-SPEC.md` §2 (Framework Decision + Alternatives table — direct lift of the 4-row rejected-alternatives table and the vendor lock-in paragraph).
- `01-CONTEXT.md` D-05 (decision verbatim) and D-06 (revisit triggers verbatim).
- `AI-PIPELINE-AUDIT.md` Dimension 2 (cited as audit reference).
- Codebase paths (cited so future readers can locate the operational patterns the ADR preserves): `lib/ai/{pipeline,sonnet-copywriter,gemini-analyzer,gemini-vto-generator,gemini-error-handler,identity-translations}.ts`.

### DOMAIN-RUBRIC.md
- `01-AI-SPEC.md` §1b — Domain Context block, regulatory table (CBARP / CONAR Influencer Guide / LGPD / Marco Civil / Instagram-CONAR 2025), Domain Expert Roles table.
- `01-CONTEXT.md` D-11/D-12/D-13/D-14 — section structure, compliance posture verbatim, parity checklist mandate.
- `campanha-ia/src/lib/ai/sonnet-copywriter.ts:259-336` — glossary (Conjunto vs Look, color discrimination, fabrics, garments), 5-trigger taxonomy, anti-cliché block, NEVER-cite-sizes block.
- `campanha-ia/src/lib/ai/identity-translations.ts` — POSE_BANK (8 poses), POSE_HISTORY_CAP, getStreakBlockedPose streak rule.
- `campanha-ia/src/lib/ai/gemini-analyzer.ts:505-581` — SCENE_MOODS (16 background/lighting moods), referenced as pose-scene pairing context.
- `AI-PIPELINE-AUDIT.md` Dimension 3 — cited as the audit finding that motivated the rubric.

## Items For Human Review (please sanity-check)

These are flagged because either the user is the appropriate sign-off authority or because they involve compliance language where my interpretation may need adjustment.

1. **Compliance posture wording (D-12).** The Compliance Posture section paraphrases CONTEXT.md D-12 in a way that is faithful to the source but firm in tone ("CriaLook ships a tool. We carry the obligation to ship guardrails preventing clearly-noncompliant outputs from being generated in the first place — not to act as a CONAR pre-clearance review and not to assume the lojista's anunciante responsibility."). If the product owner / counsel wants softer language ("we make best efforts to" vs "we carry the obligation to") this is the place to edit. **The CBARP article citations (Arts. 1, 17, 23, 27) are pulled directly from AI-SPEC §1b and not independently verified against the 2024 CBARP PDF — recommend a quick cross-check by a CONAR-savvy reviewer before this rubric is used as a formal compliance reference.**

2. **Forbidden-list regex hints.** Each Forbidden category has a regex hint intended for Phase 1 token-regex guardrails (per AI-SPEC §6.1). The patterns are conservative starting points — they will catch the obvious cases (e.g., `afina\s+a?\s*cintura`) but a real Phase 2 hardening pass should add accent-tolerance, false-positive testing on the lojista form-input corpus, and length-boundary tests. Treat the hints as scaffolding, not final patterns.

3. **Prompt-content gap surfaced (NOT fixed in this plan).** The Sonnet system prompt at `sonnet-copywriter.ts:289` cites *"afina a cintura na hora"* as an example of the Transformação trigger. **That phrasing is a body-transformation claim and is itself blacklisted by the Forbidden List in this rubric.** This is a real conflict between the inline prompt and the documented compliance posture. Per CONTEXT.md `<scope>` ("Prompt content/quality changes — infrastructure only this phase") I did NOT edit the prompt — the gap is documented in the "Known prompt-content gaps surfaced during this rubric pass" section of DOMAIN-RUBRIC.md as a worklist item for the next prompt-content phase. **Recommend filing a follow-up task to swap the example for a LOOK-only phrasing (e.g., "transforma o jeans em produção de festa") before any compliance audit.**

4. **TODO marker in Captioned Examples section.** Per CONTEXT.md `<specifics>`, the planner is supposed to ask the user via clarifying note for 2-3 anonymized "great output" production campaigns. The user has not yet provided them; the section is an explicit TODO placeholder rather than a fabricated example. **Product-owner action item:** nominate 2-3 campaigns and capture (anonymized lojista form input, generated caption + legendas, why-it's-great rationale by rubric dimension).

## Notes For Downstream Plans

- **Plan 01-05 (Sonnet `tool_use` migration):** the Sonnet `tool_use` schema field names should match the JSON keys documented in DOMAIN-RUBRIC.md §Forbidden List for the regex guardrail in Plan 01-07. (Per execution-directive instruction.) Concretely: when defining the `generate_dicas_postagem` tool's JSON schema (D-16), keep field names lower_snake_case and reference the Forbidden List section if any field names overlap with forbidden tokens (e.g., do not name a field `tamanhos` since that's the literal trigger word for the size-naming guardrail).
- **Plan 01-07 (forbidden-token regex guardrail):** the Forbidden List in DOMAIN-RUBRIC.md is the source-of-truth for the regex patterns. The hints provided are starting points — full pattern hardening (accent-tolerance, false-positive testing) belongs in Plan 01-07 or its successor.
- **Phase 2 LLM-as-judge wiring:** the rubric dimensions in this document (5 mental triggers, garment-attribute faithfulness, anti-cliché PT-BR voice, compliance-safe claims, identity preservation) map 1:1 to the eval rubric the LLM-as-judge will score against. The `prompt_version` field added by Plan 01-04 (D-15) is the correlation key for tracking score drift against rubric changes.
- **Phase 2 PT/EN parity-check CI:** the parity checklist in DOMAIN-RUBRIC.md §"PT/EN Parity Checklist (D-13)" is the human-process placeholder until a CI script lands. The checklist items map to what the CI script needs to assert.
- **D-14 maintenance contract:** prompts stay inline in `*.ts`. DOMAIN-RUBRIC.md is the diff target for review, not a runtime dependency. There is no codegen, no parser, no sync. The PR review process is the mitigation for rubric/prompt drift (T-06-01 in the plan's threat register).

## Confirmation Of Scope Discipline

- **No prompt-content changes were made.** Per CONTEXT.md `<scope>` ("Prompt content/quality changes — infrastructure only this phase"), all `*.ts` files in `campanha-ia/src/lib/ai/` were left untouched by this plan. The single prompt-content gap I identified (the Transformação example phrasing) is documented as a future worklist item, not patched.
- **No code changes of any kind.** Working tree shows two committed `.md` files in `.planning/codebase/` and nothing else attributable to this plan.

## Deviations from Plan

### Rule 3 — cross-agent git-index pollution (operational, not content)

**1. [Rule 3 — Blocking issue / Operational] Sibling-wave plans had files staged in the git index when I ran `git add` for Task 1**

- **Found during:** Task 1 commit (`docs(adr): bare-SDK choice ...`).
- **Issue:** `git status --short` at start of Task 1 showed `M campanha-ia/src/lib/ai/with-timeout.test.ts` and an untracked migration file. Both belong to **other Wave-1 plans running in parallel** (01-04 prompt hygiene, 01-01 regenerate-reason). When I ran `git add .planning/codebase/ADR-AI-FRAMEWORK.md` and then `git commit`, git swept the previously-staged sibling files into my commit because they were already in the index. Resulting commit `1dc240e` contains my ADR file plus two sibling-plan files (`with-timeout.test.ts` and `add_campaign_regenerate_reason.sql`).
- **Why I did not undo:** the `<destructive_git_prohibition>` block in the executor instructions forbids destructive git operations (`reset --hard`, `commit --amend` is also implicitly excluded for "always create new commits"), and the runtime constraint forbids switching branches. Reverting would risk losing the sibling-plan files. The work is preserved (just attributed to my commit instead of theirs); the orchestrator can decide whether to rewrite history during phase finalization.
- **Mitigation for Task 2:** committed using `git commit --only .planning/codebase/DOMAIN-RUBRIC.md` so only my exact file was committed, leaving the rest of the index intact for sibling agents. Resulting commit `8cc7f9b` is clean (1 file changed, 369 insertions).
- **Files affected:** `1dc240e` contains 3 files instead of 1; `8cc7f9b` is clean.
- **Surfaced for orchestrator:** when finalizing Wave 1, verify that the files in `1dc240e` are also accounted for in the relevant sibling-plan summaries (01-04 / 01-01) so nothing is double-counted or lost.

### No content deviations

- Both documents lift content from the cited sources (AI-SPEC §1b/§2, CONTEXT.md D-05..D-14, sonnet-copywriter.ts, identity-translations.ts, gemini-analyzer.ts) — no inventions, no extension of revisit triggers beyond CONTEXT.md D-06, no fabricated examples in the Captioned Examples section.
- The single prompt-content gap (Transformação body-transformation example) was surfaced as a flagged item, not silently corrected.

## Threat Surface Scan

No new threat surface introduced. Both files are pure markdown documentation in `.planning/codebase/` — no executable surface, no network endpoints, no auth paths, no schema changes. The plan's own threat register (T-06-01 rubric drift, T-06-02 regulatory citation, T-06-03 empty captioned-examples section) covers all relevant risks; all three are dispositioned `accept` and the document content honors those acceptances (D-14 maintenance note for T-06-01, public-only regulatory citations for T-06-02, explicit TODO placeholder for T-06-03).

## Self-Check: PASSED

- File `.planning/codebase/ADR-AI-FRAMEWORK.md` — FOUND (74 lines, commit 1dc240e).
- File `.planning/codebase/DOMAIN-RUBRIC.md` — FOUND (369 lines, commit 8cc7f9b).
- Commit `1dc240e` (ADR) — FOUND in `git log`.
- Commit `8cc7f9b` (rubric) — FOUND in `git log`.
- ADR grep gate: 7 matches for `Vercel AI SDK|Mastra|LangChain|Inngest Agent Kit` (gate ≥4) — PASS.
- ADR grep gate: 5 matches for revisit-trigger phrases (gate ≥4) — PASS.
- Rubric grep gate: 23 matches for `Conjunto vs Look|Escassez|Prova social|Curiosidade|Transformação|Preço|afina.*cintura|Tá perfeito|POSE_BANK|PT/EN parity` (gate ≥8) — PASS.
- Rubric opens with Compliance Posture (D-12) before any rubric ingredient — PASS.
- Captioned Examples section is an explicit TODO placeholder (no fabricated examples) — PASS.
- D-14 maintenance note clarifies prompts stay inline — PASS.
