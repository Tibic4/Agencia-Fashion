# AI Pipeline Audit — CriaLook campanha-ia

**Date:** 2026-05-03
**Method:** Retroactive AI-SPEC audit applying the 4 dimensions from `gsd-ai-integration-phase` (framework / implementation / domain / evaluation) to the live pipeline.
**Scope:** Pipeline v7 — `campanha-ia/src/lib/ai/*`, `campanha-ia/src/app/api/campaign/generate/route.ts`, `campanha-ia/src/lib/inngest/functions.ts`.

---

## TL;DR

The pipeline is a **competently engineered hybrid orchestrator** (Gemini 3.1 Pro analyzer → parallel Gemini 3 Pro Image VTO + Claude Sonnet 4.6 copy) with strong **error handling** and **cost accounting**, but is **flying blind on quality**: zero tests, zero offline evals, zero LLM-output tracing, and a `campaign_scores` table that ships with a rubric (`nota_geral`, `conversao`, `clareza`, `urgencia`, `naturalidade`, `aprovacao_meta`) but is **never written to** in production code. There is also **no formal AI-SPEC, framework-selection rationale, or domain rubric document** anywhere in `.planning/`. Top three risks, in priority order: (1) silent regressions on every prompt edit; (2) no signal on which generations users actually like vs. delete; (3) Brazilian-fashion domain knowledge is locked inside prompt strings, undiffable across copies and unowned by anyone but the prompt author.

---

## Pipeline at a glance

```
POST /api/campaign/generate (SSE)
└── runCampaignPipeline (lib/ai/pipeline.ts)
    ├── 1. Gemini 3.1 Pro Analyzer  (analyzeWithGemini)
    │     • Vision + scene/styling prompt + pose_index
    │     • Structured output via responseJsonSchema
    │     • Fetches store.recent_pose_indices for anti-monotony
    │
    └── 2. PARALLEL:
          ├── Gemini 3 Pro Image VTO  (generateWithGeminiVTO)
          │     • Multi-image fusion (model + garment + optional backdrop)
          │     • Single image (used to be 3, collapsed in v7)
          │
          └── Claude Sonnet 4.6 Copywriter  (generateCopyWithSonnet)
                • Independent visual analysis of the same product photo
                • PT-BR / EN locale-switched system prompts
                • JSON via string parsing (no Anthropic structured output)

Side flows (Inngest):
  • generateModelPreviewJob  — Gemini 3.1 Flash Image
  • generateBackdropJob      — programmatic backdrop generator

Cost accounting: every call writes to api_cost_logs (real tokens when API returns them, fallback constants otherwise).
Error handling: callGeminiSafe wrapper (retry + classify) for Gemini; ad-hoc inline retry for Sonnet.
```

---

## Dimension 1 — Framework Selection

### What exists

| Slot | Reality |
|------|---------|
| Primary "framework" | None. Bare SDKs: `@anthropic-ai/sdk@^0.92.0`, `@google/genai@^1.48.0`, `@fal-ai/client@^1.9.5` (legacy fallback). |
| Orchestration | Hand-rolled `Promise.all([copyPromise, imagePromise])` in `pipeline.ts:268`. |
| System type | Multimodal generation pipeline (vision-in → vision-out + structured text-out). |
| Model provider | Multi-provider: Google (analyzer + image), Anthropic (copy), fal.ai (legacy, dead-on-hot-path). |
| Alternatives doc | **None.** No ADR, no `.planning/ai/`, no comment justifying "why not LangChain / Vercel AI SDK / Mastra." |

### Findings

- ✅ Bare-SDK choice is defensible (3-call pipeline, deterministic flow, no agentic branching).
- ⚠️ No documented rationale.
- ⚠️ Provider sprawl: `fashn ^0.13.0` listed as "legacy", `@fal-ai/client ^1.9.5` as "VTO fallback" but VTO is fully Gemini now. Also `lib/google/nano-banana.ts` (734 lines, separate Gemini wrapper).
- ⚠️ Three independent `getAI()` / `getClient()` singletons with slightly different env-var fallback chains. A deploy that sets `GEMINI_API_KEY` but not `GOOGLE_AI_API_KEY` will work for the campaign route but break model preview generation silently.

### Recommendation
1. ADR-AI-FRAMEWORK.md naming the choice + alternatives + revisit triggers.
2. Delete dead deps (`fashn`), audit `lib/fal/` and `nano-banana.ts`.
3. Centralize provider clients in `lib/ai/clients.ts`.

---

## Dimension 2 — Implementation Patterns

### Strong points
- ✅ Gemini structured output (`responseMimeType: "application/json"` + `responseJsonSchema` in `gemini-analyzer.ts:316-329`).
- ✅ `callGeminiSafe` wrapper (`gemini-error-handler.ts:190`) — typed error classification + exponential backoff + user-friendly PT-BR messages.
- ✅ SSE streaming for progress.
- ✅ Real token usage captured when SDK returns it; logged with `(estimated)` vs `(real)`.
- ✅ Image downscale before send (Sharp → 1536px WebP/80%).
- ✅ Identity Lock for VTO (`buildIdentityLock`).

### Weak points
- ❌ Sonnet copy uses string parsing, not structured output (`sonnet-copywriter.ts:181-194` regex JSON-extraction).
- ❌ Sonnet retry hand-rolled (`sonnet-copywriter.ts:151-167`) — different from Gemini's `callGeminiSafe`.
- ❌ No prompt versioning. No `prompt_version`, no hash, nothing in `api_cost_logs.metadata` ties a generation to a specific prompt revision.
- ❌ No timeout on Gemini calls (only on Sonnet). Gemini 3 Pro Image can hang for 90s+ and request sits until Vercel's `maxDuration = 300` kills it.
- ❌ Two dead-or-near-dead modules — `lib/ai/mock-data.ts` and `lib/google/nano-banana.ts`.
- ⚠️ `runCampaignPipeline` directly calls Supabase (untestable in isolation).
- ⚠️ `logAnalyzerCost` and `logSonnetCost` and `logGeminiVTOCosts` duplicated.
- ⚠️ Magic constants for fallback token counts inline.

### Recommendation
| # | Action |
|---|--------|
| 1 | Migrate Sonnet to `tool_use` structured output + Zod validation |
| 2 | Add `prompt_version` (12-char SHA) to `api_cost_logs.metadata` |
| 3 | Wrap every Gemini call in timeout consistent with Sonnet |
| 4 | Consolidate cost loggers into one `logModelCost` helper |
| 5 | Audit `nano-banana.ts` and `lib/fal/`; delete or document |

---

## Dimension 3 — Domain Context

The pipeline is **drenched in domain knowledge** — but all of it is **embedded inside system prompts, with no external rubric document**.

### What exists (all from prompt strings)
- Fashion glossary: `Conjunto" → só se 2+ peças forem do MESMO tecido` (sonnet-copywriter.ts:259-279).
- Color discrimination: `"Caramelo ≠ bege ≠ camel ≠ marrom ≠ terracota"` (line 275).
- Mental triggers taxonomy (Escassez | Prova social | Curiosidade | Transformação | Preço) (line 283-296).
- Forbidden behaviors: NEVER cite sizes (line 332-336).
- Anti-cliché list (line 328-330).
- Structural rules: hook + max 12 words + 2 emojis (line 303-321).
- Identity Lock + pose-bank streak rule (anti-monotony via `stores.recent_pose_indices`).
- Per-scene styling moods (15 named scenes in `gemini-analyzer.ts:505-581`).

### Findings
- ✅ Real practitioner expertise. Not a generic GPT wrapper.
- ❌ None of it is ownable, reviewable, or testable as a rubric.
- ❌ No regulatory / compliance notes (CONAR, LGPD).
- ❌ Domain knowledge duplicated PT/EN — diverges silently.
- ⚠️ Bilingual prompt bug surface — JSON keys must stay in PT.

### Recommendation
Extract `DOMAIN-RUBRIC.md` as source of truth (glossary, forbidden list, triggers, pose-bank rationale, compliance posture). Prompts must reflect it.

---

## Dimension 4 — Evaluation Strategy 🚨

**This is the gap that should worry you most.**

| Slot | Status |
|------|--------|
| Schema for scoring | ✅ Present — `campaign_scores` (`nota_geral`, `conversao`, `clareza`, `urgencia`, `naturalidade`, `aprovacao_meta`, `nivel_risco`) at `baseline.sql:60-76` |
| Code that **writes** to `campaign_scores` | ❌ **None.** Read-only in production code (`db/index.ts:565,601`, `app/api/me/export/route.ts:51`). Empty in every running deployment. |
| User feedback signal | ⚠️ Minimal — `is_favorited` boolean only |
| Implicit signals | ⚠️ Weak — `regen_count`, `pipeline_duration_ms` not aggregated |
| Offline test set | ❌ None — zero `.test.ts` in `lib/ai/`, no `evals/`, no golden dataset |
| LLM tracing | ❌ None — no Phoenix, Arize, Langfuse, Braintrust, OpenTelemetry |
| Pre/post-generation guardrails | ⚠️ Partial — input validation good, no content moderation on output |
| Production monitoring | ⚠️ Cost-only — `api_cost_logs` says nothing about quality |

### Why this is the highest-priority finding
1. Cannot ship a prompt change with confidence. No test gate.
2. No idea which campaigns users actually like.
3. The rubric exists in the schema. It just was never wired up.
4. Cost tracking without quality tracking is a trap.

### Recommendation — minimum viable eval, in priority order

**Phase 1 — production signal (1 day)**
- Add `regenerate_reason` enum (`face_wrong | garment_wrong | copy_wrong | pose_wrong | other`).
- Add `prompt_version` (12-char SHA) to `api_cost_logs.metadata`.

**Phase 2 — offline eval set (3 days)**
- 30-50 anonymized real campaigns as golden set.
- `evals/run.ts` runs on every PR touching `lib/ai/*`.

**Phase 3 — LLM-as-judge for copy quality (1 week)**
- Wire `campaign_scores` table that already exists.
- ~R$0.02/campaign overhead.

**Phase 4 — tracing (optional)**
- Phoenix or Langfuse for per-generation span tracing.

---

## Cross-cutting findings

### Things going well
- Anti-monotony pose-history mechanism.
- Fail-safe credit refund logic.
- Multi-attempt upload retry with backoff.
- Bilingual prompt design with key-stable parser.
- Cost logging captures real tokens.

### Things going wrong
- Three SDK singletons with diverging env-var fallback chains.
- Sonnet structured-output via regex JSON-extraction.
- Domain knowledge in prompt strings, no rubric doc.
- `campaign_scores` table that no code writes to.
- Zero tests, zero evals, zero LLM tracing.

### Dead weight
- `fashn ^0.13.0` in `package.json`.
- `lib/fal/client.ts` with no live caller.
- `lib/google/nano-banana.ts` (734 lines).
- `mock-data.ts` (only used in demo mode never hit in prod).
- `generateCampaignJob` Inngest function self-documented as DEPRECATED no-op.

---

*Audit performed at branch `ui-followups`, commit `1000548`. No code modified.*
