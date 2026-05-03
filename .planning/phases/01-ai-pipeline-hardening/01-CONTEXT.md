# Phase 01: AI Pipeline Hardening — Context

**Gathered:** 2026-05-03
**Status:** Ready for planning
**Source:** Decisions from `.planning/codebase/AI-PIPELINE-AUDIT.md` + interactive discussion.

<domain>
## Phase Boundary

Harden the existing campanha-ia AI pipeline (Gemini 3.1 Pro Analyzer → Gemini 3 Pro Image VTO + Claude Sonnet 4.6 Copywriter) by closing the highest-impact gaps from the audit: (1) zero production quality signal, (2) provider/SDK sprawl with no rationale doc, (3) domain knowledge locked inside prompt strings with no rubric source-of-truth, (4) prompt/code hygiene defects causing silent regressions.

**This phase delivers infrastructure and guardrails — it does NOT change generation quality on day one.** Quality measurement comes in Phase 2 (Quality Loop), once production signal lands and we have a baseline.

**In scope:**
- Production signal: `regenerate_reason` enum + admin/custos surfacing
- Framework ADR: justify bare-SDK choice + rejected alternatives + revisit triggers
- Dead-code cleanup: delete or archive `fashn`, `lib/fal/`, `nano-banana.ts`, `mock-data.ts`, `generateCampaignJob` deprecated stub
- Client consolidation: 3 `getAI()`/`getClient()` singletons → one `lib/ai/clients.ts`
- DOMAIN-RUBRIC.md extraction: glossary + forbidden list + 5-trigger taxonomy + pose-bank rationale + compliance posture (lojista owns CONAR/LGPD risk; we ship guardrails)
- 4 hygiene items:
  - `prompt_version` (12-char content SHA) in `api_cost_logs.metadata`
  - Sonnet copywriter migration: regex JSON parse → Anthropic `tool_use` + Zod validation at boundary
  - Timeout wrapper on every Gemini call (~30s analyzer / ~90s VTO)
  - Consolidate `logAnalyzerCost` + `logSonnetCost` + `logGeminiVTOCosts` into `logModelCost(provider, model, usage, durationMs)`

**Out of scope (deferred):**
- LLM-as-judge wiring of `campaign_scores` table → Phase 2 Quality Loop
- Golden dataset + CI assert → Phase 2
- Phoenix/Langfuse tracing → Phase 3 Observability
- Migration to Vercel AI SDK / Mastra / LangChain — not planned; ADR documents why
- Prompt content/quality changes — infrastructure only this phase

</domain>

<decisions>
## Implementation Decisions

### Eval Strategy MVP — production signal first
- **D-01:** First quality signal from real users, not synthetic judges. `regenerate_reason` enum (`face_wrong | garment_wrong | copy_wrong | pose_wrong | other`) on regenerate flow. Persist on `campaigns` row or new `campaign_regenerations` (planner picks shape). Surface aggregate counts in `/admin/custos`.
- **D-02:** `is_favorited` stays. No thumbs-down — `regenerate_reason` carries actionable categorization.
- **D-03:** Regenerate that captures reason is FREE (no credit charge) this phase to maximize feedback density. Pricing of feedback regens deferred to Phase 2.
- **D-04:** Phase 1 ships capture-and-surface only. Acting on signals (alerts, prompt rollbacks) → Phase 2.

### Provider Strategy — bare SDKs stay
- **D-05:** Stay on bare SDKs. No migration to Vercel AI SDK, Mastra, LangChain.
- **D-06:** Write `.planning/codebase/ADR-AI-FRAMEWORK.md`: choice, rejected alternatives (Vercel AI SDK, Mastra, LangChain, Inngest Agent Kit), rationale (3-call pipeline + Gemini 3 Pro Image not first-class in Vercel AI SDK yet), revisit triggers (≥4 LLM calls; agentic loop; new provider; >2 prompt-quality regressions in 90 days).
- **D-07:** Delete `fashn` from `package.json`. `lib/fal/client.ts` → `legacy/` with header comment OR delete (planner verifies).
- **D-08:** Audit `lib/google/nano-banana.ts` (734 lines): no live caller → delete; transitional dependency → document inline.
- **D-09:** `lib/ai/mock-data.ts` and `inngest/functions.ts:generateCampaignJob` (DEPRECATED no-op) — same: delete unless load-bearing.
- **D-10:** Consolidate 3 client singletons into `lib/ai/clients.ts` exporting `getAnthropic()` and `getGoogleGenAI()`. Single env-var fallback chain: `GOOGLE_AI_API_KEY || GEMINI_API_KEY` for Google; `ANTHROPIC_API_KEY` for Anthropic. Throws same `MissingAIKeyError` from one place.

### Domain Rubric + Compliance — extract source-of-truth, lojista owns ad risk
- **D-11:** Extract `.planning/codebase/DOMAIN-RUBRIC.md` as **source of truth** for "good fashion copy". Prompts reflect rubric. Sections required:
  - Fashion glossary (Conjunto vs Look, tecidos, peças, cores)
  - 5 mental-trigger taxonomy with criteria
  - Forbidden list with rationale (sizes, denim wash drift, identity drift, medical/transformative claims)
  - Anti-cliché list ("Tá perfeito 🔥", "Look pronto", etc.)
  - Pose-bank with the visual problem each pose solves
  - 2-3 captioned "great output" examples
- **D-12:** Compliance: **lojista is the anunciante** (CONAR). CriaLook ships a tool. We carry obligation to ship guardrails preventing clearly-noncompliant claims (no medical promises, no body-transformation claims beyond garment effect, no invented sizes, no claims about identifiable individuals beyond their literal photo). LGPD: only generated images of lojista's chosen model. Document at top of `DOMAIN-RUBRIC.md`.
- **D-13:** Bilingual prompts (PT-BR/EN) NOT consolidated this phase. Add "PT/EN parity checklist" subsection in DOMAIN-RUBRIC.md for prompt-edit PRs. Sync mechanism deferred.
- **D-14:** Prompt strings stay inline in `*.ts`. DOMAIN-RUBRIC.md is human/review document; `.ts` files are executable. Reviewers diff against rubric.

### Prompt Hygiene — all 4 items in scope
- **D-15:** `prompt_version`: 12-char SHA-256 hex of system prompt computed at module load. Written to `api_cost_logs.metadata.prompt_version` on every analyzer/VTO/sonnet log row. `metadata jsonb` column already exists (used in `route.ts:834`); planner verifies.
- **D-16:** Sonnet → `tool_use`: define one Anthropic tool with JSON schema mirroring `SonnetDicasPostagem`; pass via `tools: [...]` + `tool_choice: { type: "tool", name: "..." }`. Read `tool_use` block instead of `text`. Zod boundary validation (`SonnetDicasPostagemSchema`); throw `SonnetInvalidOutputError`. Keep existing fallback `dicas` in `pipeline.ts:218-237`.
- **D-17:** Gemini timeout wrapper: extract `callWithTimeout` from `sonnet-copywriter.ts` → `lib/ai/with-timeout.ts`, apply inside `callGeminiSafe`. Defaults: 30s analyzer, 90s VTO.
- **D-18:** `logModelCost` consolidation: one helper signature `logModelCost({ storeId, campaignId, provider, model, action, usage, durationMs, exchangeRate?, fallbacks? })`. Move fallback constants into `lib/pricing/fallbacks.ts`. Delete the three duplicates.

### Claude's Discretion
- **C-01:** Order of execution within phase — planner picks. (Suggested: hygiene D-15..D-18 first → cleanup D-07..D-10 → consolidation D-05..D-06 + ADR → DOMAIN-RUBRIC.md → production signal D-01..D-04.)
- **C-02:** Test coverage targets — none specified. Add tests where they make change safer (Sonnet `tool_use` parser, cost helper). Phase 2 golden-set covers the rest.
- **C-03:** DOMAIN-RUBRIC.md location — planner picks `.planning/codebase/` (default, alongside audit) vs `.planning/specs/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit (source for every decision)
- `.planning/codebase/AI-PIPELINE-AUDIT.md` — Full retroactive audit. Sections 1-4 map 1:1 to AI-SPEC dimensions. Decisions D-01..D-18 trace to specific findings here.

### AI pipeline source files (the change surface)
- `campanha-ia/src/lib/ai/pipeline.ts` — orchestrator; cost-log functions to consolidate (lines 312-433)
- `campanha-ia/src/lib/ai/sonnet-copywriter.ts` — regex JSON parse to migrate (lines 181-194); inline timeout to extract (lines 139-167)
- `campanha-ia/src/lib/ai/gemini-analyzer.ts` — `responseJsonSchema` correctly used; needs timeout via `callGeminiSafe`
- `campanha-ia/src/lib/ai/gemini-vto-generator.ts` — `buildIdentityLock`; cost logger to consolidate (lines 571-632)
- `campanha-ia/src/lib/ai/gemini-error-handler.ts` — `callGeminiSafe` is timeout-wrapper insertion point
- `campanha-ia/src/lib/ai/identity-translations.ts` — `POSE_BANK` data; source for D-11 pose-bank rubric section
- `campanha-ia/src/app/api/campaign/generate/route.ts` — calls `runCampaignPipeline`; SSE writer pattern stays
- `campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts` — D-01 hooks here (currently Modified per `git status`)
- `campanha-ia/src/lib/inngest/functions.ts` — inline `getGoogleGenAI()` to consolidate; `generateCampaignJob` DEPRECATED stub to delete

### Database schema
- `campanha-ia/supabase/migrations/00000000000000_baseline.sql` lines 60-76 — `campaign_scores` table (read-only this phase)
- `campanha-ia/supabase/migrations/00000000000000_baseline.sql` lines 15-30 — `api_cost_logs` (D-15 writes here; planner verifies `metadata jsonb`)

### Memory notes
- `crialook-app é Android-only` — irrelevant for this phase but lojista compliance discussion (D-12) shouldn't assume cross-platform delivery.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`callGeminiSafe`** (`gemini-error-handler.ts:190`) — typed retry wrapper. D-17 extends it with timeout; API and call sites stay the same.
- **Anthropic SDK retry** (`Anthropic` constructor option `maxRetries`) — supersedes hand-rolled retry in `sonnet-copywriter.ts:151-167`. D-16 should let SDK retry while keeping timeout external.
- **Zod is in deps** (`zod ^4.3.6`) — no new dep for D-16 boundary validation.
- **`api_cost_logs.metadata jsonb`** — referenced in `route.ts:834` so D-15's `prompt_version` field lands without schema change.
- **Sentry `captureError`** (`observability.ts:41`) — D-16's `SonnetInvalidOutputError` should call this so parser regressions alert immediately.
- **Generated-images bucket + 3-attempt upload retry** (`route.ts:594-622`) — existing pattern for transient infra retry; D-17 timeout follows same shape.

### Established Patterns
- **Singleton clients via lazy module-level `let _x: T | null = null`** — used in 4 files. D-10 collapses these into one location, same lazy-init pattern preserved.
- **Fire-and-forget cost logging** (`pipeline.ts:174-178, 203-213`) — `.catch((e) => console.warn(...))` so user-facing path never waits. D-18's `logModelCost` keeps this contract.
- **Structured error classification** (`gemini-error-handler.ts`) — userMessage + technicalMessage + retryable + httpStatus + originalError. D-16's `SonnetInvalidOutputError` follows same shape.
- **PT-BR user-facing messages, English logs** — every classified error has Portuguese `userMessage` and English `technicalMessage`. D-12 compliance guardrails follow same convention.

### Integration Points
- **`api_cost_logs.metadata`** — write site for D-15. Currently three functions; after D-18 it's one.
- **`/api/campaign/[id]/regenerate/route.ts`** — D-01 hooks here (in Modified state on working tree).
- **`/admin/custos/page.tsx`** — D-04 surfaces aggregate `regenerate_reason` counts here.
- **Sentry breadcrumbs** — when D-16 throws `SonnetInvalidOutputError`, Sentry context already has store_id + campaign_id from `route.ts` upstream.

</code_context>

<specifics>
## Specific Ideas

- **`prompt_version` format:** 12-char hex of `crypto.createHash('sha256').update(SYSTEM_PROMPT).digest('hex').slice(0, 12)`. Computed once at module import. Stored as `metadata.prompt_version` in `api_cost_logs`.
- **Sonnet tool name:** `generate_dicas_postagem` — matches existing JSON shape exactly so parser delete is the only meaningful diff.
- **Timeout defaults:** 30s analyzer (parity with Sonnet's 30s default), 90s VTO (Gemini 3 Pro Image regularly takes 30-60s; 90s gives one std dev of headroom against route's 300s cap).
- **`regenerate_reason` enum literals** (PT-BR strings since admin/custos is PT-BR-only): `face_wrong`, `garment_wrong`, `copy_wrong`, `pose_wrong`, `other`. Stored as `text` column with check constraint, not Postgres enum (easier to add values).
- **DOMAIN-RUBRIC.md examples:** the audit's "Recommendation" sections drafted what the rubric should look like — researcher lifts directly. Include 2-3 actual generated outputs the team flags as great (planner asks user via clarifying note in PLAN.md).

</specifics>

<deferred>
## Deferred Ideas

### Phase 2 — Quality Loop (depends on Phase 1 production signal landing)
- Wire `campaign_scores` with LLM-as-judge — second Sonnet call after each successful generation scores on 6 existing rubric dimensions. ~R$0.02/campaign. Requires Phase 1's `prompt_version` to correlate score drift to prompt changes.
- Golden dataset + CI assert — 30-50 anonymized campaigns; `evals/run.ts` runs in PR with `dryRun` flag.
- Acting on `regenerate_reason` signals — alerts when `face_wrong` rate > 5% week-over-week; prompt-rollback runbook.

### Phase 3 — Observability
- Phoenix or Langfuse per-generation tracing.
- Pipeline-level OTel spans (vendor-neutral alternative).

### Adjacent (not AI-pipeline scoped, captured for backlog)
- Bilingual prompt sync mechanism — D-13 deferred. CI script that diffs PT/EN system prompts on PR.
- Centralize fallback token constants — partially solved by D-18; full audit of every magic-number constant in pipeline pricing is its own cleanup phase.
- Audit `useModelSelector.test.ts.skip` — flagged in CONCERNS.md, unrelated.

</deferred>

---

*Phase: 01-ai-pipeline-hardening*
*Context gathered: 2026-05-03*
