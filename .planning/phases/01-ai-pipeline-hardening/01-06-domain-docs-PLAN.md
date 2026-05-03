---
phase: 01-ai-pipeline-hardening
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/codebase/ADR-AI-FRAMEWORK.md
  - .planning/codebase/DOMAIN-RUBRIC.md
autonomous: true
requirements: [D-05, D-06, D-11, D-12, D-13, D-14]
user_setup: []

must_haves:
  truths:
    - "ADR-AI-FRAMEWORK.md exists at .planning/codebase/ and documents the bare-SDK choice + 4 rejected alternatives + revisit triggers"
    - "DOMAIN-RUBRIC.md exists at .planning/codebase/ and is the source-of-truth for fashion-copy quality (glossary, 5-trigger taxonomy, forbidden list, anti-cliché list, pose-bank, compliance posture)"
    - "DOMAIN-RUBRIC.md opens with the lojista-as-anunciante compliance disposition (D-12)"
    - "DOMAIN-RUBRIC.md includes a PT/EN parity checklist subsection (D-13) so prompt-edit PRs have a checklist to follow"
    - "DOMAIN-RUBRIC.md is human-review-only — prompt strings stay inline in *.ts (D-14)"
  artifacts:
    - path: ".planning/codebase/ADR-AI-FRAMEWORK.md"
      provides: "Architecture Decision Record for D-05 (stay on bare SDKs) and D-06 (revisit triggers)"
      contains: "## Decision\n\nStay on bare SDKs"
    - path: ".planning/codebase/DOMAIN-RUBRIC.md"
      provides: "Source-of-truth document for D-11 sections (glossary, triggers, forbidden, anti-cliché, pose-bank) + D-12 compliance posture + D-13 parity checklist"
      contains: "Conjunto vs Look"
  key_links:
    - from: ".planning/codebase/ADR-AI-FRAMEWORK.md"
      to: ".planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md §2"
      via: "lifted from §2 alternatives table"
      pattern: "Vercel AI SDK"
    - from: ".planning/codebase/DOMAIN-RUBRIC.md"
      to: "campanha-ia/src/lib/ai/sonnet-copywriter.ts:259-336 + lib/ai/identity-translations.ts POSE_BANK"
      via: "lifted from inline prompt content + POSE_BANK data"
      pattern: "Escassez|Prova social|Curiosidade"
---

<objective>
Create the two documentation artifacts that Phase 01 promised but does not implement in code: (a) `.planning/codebase/ADR-AI-FRAMEWORK.md` justifying the bare-SDK choice with rejected alternatives and revisit triggers (D-05, D-06); (b) `.planning/codebase/DOMAIN-RUBRIC.md` extracting the fashion-copy domain knowledge currently locked inside the Sonnet system prompt + POSE_BANK + identity-translations into a human-reviewable source-of-truth (D-11, D-12, D-13, D-14).

Purpose: Two of the audit's highest-impact findings were "no rationale doc for the bare-SDK choice" (which leaves future contributors guessing whether to migrate to Vercel AI SDK every time the question comes up) and "domain knowledge locked inside prompt strings with no rubric source-of-truth" (which means a prompt edit can silently drift from the rubric, and review is intuition-based rather than diff-able against a written standard). These two docs are the answers. Per D-14 the prompt strings STAY inline in `.ts` — DOMAIN-RUBRIC.md is the human-review document, not a runtime dependency.

Output: Two markdown files in `.planning/codebase/` (alongside the existing AI-PIPELINE-AUDIT.md per CONTEXT.md C-03 — confirmed location). No code changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@.planning/codebase/AI-PIPELINE-AUDIT.md
@campanha-ia/src/lib/ai/sonnet-copywriter.ts
@campanha-ia/src/lib/ai/identity-translations.ts
@campanha-ia/src/lib/ai/gemini-analyzer.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write ADR-AI-FRAMEWORK.md</name>
  <files>.planning/codebase/ADR-AI-FRAMEWORK.md</files>
  <action>Create `.planning/codebase/ADR-AI-FRAMEWORK.md` lifting content from AI-SPEC §2 (lines 170-191). The document MUST contain these sections in this order:

1. **Header / Status block:**
   ```
   # ADR — AI Framework Choice (Phase 01)

   - **Status:** Accepted
   - **Date:** 2026-05-03
   - **Decision:** D-05 + D-06 (CONTEXT.md, Phase 01)
   - **Audit reference:** `.planning/codebase/AI-PIPELINE-AUDIT.md` Dimension 2
   ```

2. **## Context** — paragraph explaining the pipeline shape (3 deterministic LLM calls: Gemini analyzer → parallel Gemini VTO + Sonnet copy; no agentic loop; no provider swap; no retrieval). Lift from AI-SPEC §2 "Rationale" first paragraph.

3. **## Decision** — short paragraph: "Stay on bare SDKs (`@anthropic-ai/sdk` + `@google/genai`). No migration to Vercel AI SDK, Mastra, LangChain, LangGraph, or Inngest Agent Kit." Quote D-05 verbatim.

4. **## Versions Pinned**
   ```
   - @anthropic-ai/sdk@^0.92.0
   - @google/genai@^1.48.0
   - zod@^4.3.6 (boundary validation; not a framework)
   ```

5. **## Rejected Alternatives** — lift the 4-row table from AI-SPEC §2 lines 184-189 EXACTLY:

   | Framework | Ruled Out Because |
   |-----------|------------------|
   | Vercel AI SDK | Gemini 3 Pro Image not first-class for image gen; would still need bare SDK for VTO; partial unification has negative ROI |
   | Mastra | Full framework adoption (workflows + evals + tracing native) is a swing too large to justify against 3-call pipeline; eval and observability solved more cheaply by direct DB-write to existing campaign_scores + Phoenix later |
   | LangChain / LangGraph | Heavy abstraction tax; debugging through chains is harder than through bare SDK calls; no agentic flow requires the graph |
   | Inngest Agent Kit | We already use Inngest for async jobs — Agent Kit specifically is for agent loops we don't have |

6. **## Vendor Lock-In** — paragraph: "Partial — Anthropic for copy, Google for vision and image. By design (each model is best-in-class for its task)." Lift from AI-SPEC §2 line 191.

7. **## Revisit Triggers** — bullet list, lifted directly from CONTEXT.md D-06:
   - Pipeline grows to ≥4 LLM calls
   - Any agentic loop is required
   - A new provider enters the pipeline
   - More than 2 prompt-quality regressions in 90 days

8. **## Operational Patterns Preserved by This Decision** — short list explaining what the bare-SDK choice keeps working that a framework would replace:
   - `callGeminiSafe` retry+classify wrapper (`lib/ai/gemini-error-handler.ts`)
   - `responseJsonSchema` structured-output mode for Gemini analyzer (already correctly used)
   - Real-token cost accounting via `api_cost_logs` (one row per LLM call)
   - Lazy module-level singleton clients (`lib/ai/clients.ts` after Plan 03)
   Each bullet cites the file path so a future reader can locate the pattern.

9. **## Sources** — link to AI-SPEC §2 + CONTEXT.md D-05/D-06 + AI-PIPELINE-AUDIT.md Dimension 2.

Total document target: ~150-200 lines, ~5-7KB. Concise; this ADR exists to be re-read at decision time, not to be a tutorial. Do NOT invent revisit triggers beyond CONTEXT.md D-06.</action>
  <verify>
    <automated>test -f .planning/codebase/ADR-AI-FRAMEWORK.md &amp;&amp; grep -c "Vercel AI SDK\\|Mastra\\|LangChain\\|Inngest Agent Kit" .planning/codebase/ADR-AI-FRAMEWORK.md | awk '{ exit ($1 &gt;= 4 ? 0 : 1) }' &amp;&amp; grep -c "≥4 LLM calls\\|agentic loop\\|new provider\\|prompt-quality regressions" .planning/codebase/ADR-AI-FRAMEWORK.md | awk '{ exit ($1 &gt;= 4 ? 0 : 1) }'</automated>
  </verify>
  <done>File exists; all 4 rejected alternatives present; all 4 revisit triggers present; the Decision paragraph quotes D-05; sources cite AI-SPEC §2 and CONTEXT.md D-05/D-06.</done>
</task>

<task type="auto">
  <name>Task 2: Write DOMAIN-RUBRIC.md (source-of-truth for fashion copy)</name>
  <files>.planning/codebase/DOMAIN-RUBRIC.md</files>
  <action>Create `.planning/codebase/DOMAIN-RUBRIC.md`. The document is the human-review source-of-truth for "good fashion copy" per D-11. Prompts in `*.ts` files reflect this rubric (D-14 — prompts stay inline; this doc is human-review). Reviewers diff prompt-edit PRs against this document.

Structure (CONTEXT.md D-11 specifies all 6 sections + D-12 compliance + D-13 parity checklist):

1. **# DOMAIN-RUBRIC — CriaLook Fashion Copy Quality Standard**
   - Header block with: `Status: Active`, `Owner: CriaLook product owner` (per AI-SPEC §1b "Domain Expert Roles for Evaluation"), `Decisions: D-11/D-12/D-13/D-14 (Phase 01)`, `Last review: 2026-05-03`.

2. **## Compliance Posture (D-12) — read this first**
   - Lift from CONTEXT.md D-12: "**Lojista is the anunciante (CONAR).** CriaLook ships a tool. We carry obligation to ship guardrails preventing clearly-noncompliant claims (no medical promises, no body-transformation claims beyond garment effect, no invented sizes, no claims about identifiable individuals beyond their literal photo). LGPD: only generated images of lojista's chosen model."
   - Add CONAR reference table from AI-SPEC §1b "Regulatory / Compliance Context" (CBARP arts. 1, 17, 23, 27; influencer guide; LGPD; Marco Civil; Instagram-CONAR partnership 2025). Cite the URLs.

3. **## Fashion Glossary**
   - **Conjunto vs Look:** lift from `campanha-ia/src/lib/ai/sonnet-copywriter.ts:259-279` (read the file; lift the explanation verbatim, then add a one-line summary).
   - **Color discrimination (PT-BR):** caramelo / bege / camel / marrom / terracota are DISTINCT, not synonyms. Denim wash: claro / médio / escuro / black / delavê / destroyed. Lift the same block from sonnet-copywriter.ts.
   - **Fabric / weight terms:** never invent unless lojista provided in form input. Forbidden: "tecido seda gelada", "seda pura", "cetim puro" (when lojista did not specify `tecido`).
   - **Garment terms:** silhueta, comprimento, manga, fechamento — these CAN be cited because they are visually verifiable.

4. **## 5 Mental-Trigger Taxonomy**
   - For each of the 5 triggers (Escassez, Prova social, Curiosidade, Transformação-do-look, Preço), provide:
     - **Definition** (one sentence)
     - **PASS criteria** (what good use looks like)
     - **FAIL example** (specific copy line that misuses or omits)
     - **Source line in sonnet-copywriter.ts** (cite the line number where the trigger is named in the prompt)
   - Lift content from `sonnet-copywriter.ts:283-296` (read the file). The "Transformação" trigger has a critical sub-rule: "Transformação do LOOK, NÃO do CORPO" — call this out explicitly because it intersects with D-12 compliance.

5. **## Forbidden List (with rationale)**
   - **Sizes:** never name "P / M / G / GG", "do P ao GG", or specific measurements unless lojista provided. Rationale: garment-attribute faithfulness (AI-SPEC §1b Dimension 1); CBARP Art. 27 §1 (truthfulness).
   - **Body-transformation claims:** "afina a cintura", "modela o corpo", "tira celulite", "rejuvenesce". Rationale: CBARP + D-12 lojista-as-anunciante; medical-adjacent claim risk.
   - **Invented testimonials:** "clientes adoraram", "todo mundo aprovou". Rationale: CONAR influencer guide (false testimonial requires `#publi` disclosure that the lojista did not necessarily make).
   - **Unproven superlatives:** "a melhor blusa do Brasil", "a peça mais elegante". Rationale: CBARP Art. 27 (comprovação requirement).
   - **Identity drift:** never describe the model's face, body, age, ethnicity beyond what the lojista's chosen model image literally shows. Rationale: D-12 LGPD posture; brand-persona contract.
   - **Denim wash drift:** never describe a wash that doesn't match the photo (e.g., "jeans escuro" on a medium wash). Rationale: AI-SPEC §1b Dimension 2 + practitioner heuristic (jeans is the highest-volume SKU category).
   - Each entry MUST include a regex hint that downstream guardrail work (Phase 2 LLM-as-judge or Phase 1 forbidden-token regex per AI-SPEC §6.1) can target. Format example:
     ```
     - **Body-transformation claims** — pattern: `/\b(afina\s+a?\s*cintura|tira\s+celulite|modela\s+o\s+corpo|rejuvenesce)\b/i`
     ```

6. **## Anti-Cliché List**
   - Lift directly from `sonnet-copywriter.ts:303-330` and CONTEXT.md D-11 ("'Tá perfeito 🔥', 'Look pronto', etc."): "Tá perfeito 🔥", "Look pronto", "Arrasou", "Para arrasar", "Diva", "Maravilhoso(a)", "Apaixonada(o)", isolated unanchored emojis, "Confira esta peça incrível!" (ChatGPT-default opener).
   - Add the structural rules: hook in first 12 words; max 2 emojis; PT-BR contractions natural ("pra", "tá") when lojista's `tom_legenda` is informal.

7. **## Pose-Bank (with the visual problem each pose solves)**
   - Read `campanha-ia/src/lib/ai/identity-translations.ts` and locate the `POSE_BANK` constant. For each pose entry, document:
     - **Pose name** (the key in POSE_BANK)
     - **Visual problem it solves** (e.g., "shows full silhouette without obscuring garment fit", "creates depth on flat-fronted dresses")
     - **When NOT to use** (e.g., "skip on cropped tops where the pose hides the hem")
   - Also lift from `campanha-ia/src/lib/ai/gemini-analyzer.ts:505-581` ("per-scene styling moods").
   - The pose-bank rationale is the answer to "why does the model output use this pose?" for downstream prompt-quality reviewers.

8. **## Captioned Examples — 2-3 great outputs**
   - **CLARIFYING NOTE FOR THE EXECUTOR:** This section requires real generated examples that the team flags as "great". Per CONTEXT.md `<specifics>` "researcher lifts directly. Include 2-3 actual generated outputs the team flags as great (planner asks user via clarifying note in PLAN.md)". The user has NOT yet provided the example campaigns. Insert a placeholder block with a TODO that captures what to add and why:
     ```
     ## Captioned Examples — 2-3 Great Outputs

     > **TODO (D-11 outstanding):** product owner to nominate 2-3 anonymized
     > "great output" campaigns from production. For each, capture:
     > - Anonymized lojista form input (price, audience, tom)
     > - Generated caption + legendas
     > - Why it's great (which rubric dimensions it nails: trigger choice,
     >   garment attribute fidelity, anti-cliché PT-BR voice, etc.)
     >
     > Until populated, this section is empty by design — fake examples
     > would erode the rubric's credibility as a calibration anchor.
     ```
   - Do NOT invent examples.

9. **## PT/EN Parity Checklist (D-13)**
   - Per CONTEXT.md D-13 ("Add 'PT/EN parity checklist' subsection in DOMAIN-RUBRIC.md for prompt-edit PRs. Sync mechanism deferred."), provide a checklist that prompt-edit PR reviewers must run through:
     ```
     ## PT/EN Parity Checklist (D-13)

     When editing the Sonnet system prompt or DOMAIN-RUBRIC.md, verify:
     - [ ] Glossary term added in PT-BR is also reflected in the EN system prompt
     - [ ] Forbidden list addition lands in both PT and EN prompts
     - [ ] Mental-trigger criteria match across both locales
     - [ ] Anti-cliché list updates apply to both (note: cliches are language-specific; EN cliches differ from PT cliches and need locale-appropriate examples)
     - [ ] Pose-bank rationale changes propagate to both
     - [ ] Compliance language (no body claims, no invented sizes) is identical in spirit even when wording differs

     CI sync mechanism (`evals/parity-check.ts` or similar) is deferred to Phase 2 per CONTEXT.md `<deferred>`.
     ```

10. **## Document Maintenance (D-14)**
    - One paragraph: "DOMAIN-RUBRIC.md is the human-review document. Prompt strings stay inline in `*.ts` files (`sonnet-copywriter.ts`, `gemini-analyzer.ts`, `identity-translations.ts`) per D-14. The `*.ts` files are executable; this document is the diff target for review. When the rubric changes, the prompt edit lands in the same PR and reviewers diff against this document."

11. **## Domain Expert Roles** — lift the table from AI-SPEC §1b "Domain Expert Roles for Evaluation" (Lojista, PT-BR fashion copywriter, CONAR-savvy reviewer, CriaLook product owner).

12. **## Sources** — list all source URLs and file paths cited in the document.

Target document size: ~400-600 lines, ~15-25KB. This is a substantive rubric reviewers will reference repeatedly.

**File reads required during writing** (do these efficiently — read each file ONCE, extract everything you need in one pass):
- `campanha-ia/src/lib/ai/sonnet-copywriter.ts` (focus on lines 259-336 for glossary + triggers + forbidden list, lines 303-330 for anti-cliché)
- `campanha-ia/src/lib/ai/identity-translations.ts` (full file — small; extract POSE_BANK)
- `campanha-ia/src/lib/ai/gemini-analyzer.ts` (lines 505-581 for per-scene styling)

DO NOT add prompt-content recommendations — this phase is infrastructure-only per CONTEXT.md `<scope>` "Prompt content/quality changes — infrastructure only this phase". The rubric documents what is, not what should change.</action>
  <verify>
    <automated>test -f .planning/codebase/DOMAIN-RUBRIC.md &amp;&amp; grep -c "Conjunto vs Look\\|Escassez\\|Prova social\\|Curiosidade\\|Transformação\\|Preço\\|afina.*cintura\\|Tá perfeito\\|POSE_BANK\\|PT/EN parity" .planning/codebase/DOMAIN-RUBRIC.md | awk '{ exit ($1 &gt;= 8 ? 0 : 1) }'</automated>
  </verify>
  <done>File exists; opens with Compliance Posture (D-12); all 5 mental triggers named; forbidden list has regex hints for downstream guardrail use; pose-bank section is populated from POSE_BANK with visual-problem rationale; captioned-examples section has the explicit TODO placeholder (no invented examples); PT/EN parity checklist present (D-13); maintenance note (D-14) clarifies prompts stay inline.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Documentation → human reviewer | Pure docs; no executable surface. Risk surface is "rubric drift from prompts" not technical attack |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-01 | Tampering | Rubric drifts from inline prompts over time (D-14 risk) | accept | D-14 explicitly accepts this risk by keeping prompts inline (rubric is human-review, not runtime). PR review process is the mitigation; CI parity check is Phase 2 deferred |
| T-06-02 | Information Disclosure | Compliance posture document references CONAR / LGPD | accept | All cited regulations are public; no PII or secrets in either doc |
| T-06-03 | Repudiation | Captioned-examples section starts empty (TODO) | accept | Empty-by-design beats fabricated examples; product owner populates when ready |
</threat_model>

<verification>
1. `test -f .planning/codebase/ADR-AI-FRAMEWORK.md &amp;&amp; test -f .planning/codebase/DOMAIN-RUBRIC.md` — both files exist.
2. `wc -l .planning/codebase/ADR-AI-FRAMEWORK.md .planning/codebase/DOMAIN-RUBRIC.md` — ADR ≥100 lines, RUBRIC ≥300 lines.
3. ADR contains all 4 rejected-alternative names + all 4 revisit-trigger phrases (validated by Task 1's grep).
4. RUBRIC contains all 5 trigger names + glossary + forbidden list with regex hints + POSE_BANK material + PT/EN parity checklist (validated by Task 2's grep).
5. Manual review by product owner (out of plan scope; flagged in SUMMARY.md as a recommended follow-up before Phase 2 begins).
</verification>

<success_criteria>
- ADR-AI-FRAMEWORK.md exists with all required sections (status, context, decision, versions, rejected alternatives, vendor lock-in, revisit triggers, preserved patterns, sources).
- DOMAIN-RUBRIC.md exists with all 12 required sections (header, compliance posture, glossary, triggers, forbidden, anti-cliché, pose-bank, examples-TODO, parity checklist, maintenance, expert roles, sources).
- Both documents lift content from AI-SPEC + source files (no inventions).
- D-12 compliance posture appears at the top of DOMAIN-RUBRIC.md (not buried).
- Captioned-examples section is an explicit TODO placeholder (no fabricated examples).
- D-14 maintenance note clarifies that prompts stay inline.
</success_criteria>

<output>
After completion, create `.planning/phases/01-ai-pipeline-hardening/01-06-SUMMARY.md` documenting:
- Word count + section count for both documents.
- The TODO marker in DOMAIN-RUBRIC.md captioned-examples section, surfaced for product owner follow-up.
- Confirmation that NO prompt-content changes were proposed (this phase is infrastructure-only per CONTEXT.md `<scope>`).
</output>
