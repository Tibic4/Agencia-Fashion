# ADR — AI Framework Choice (Phase 01)

- **Status:** Accepted
- **Date:** 2026-05-03
- **Decision:** D-05 + D-06 (CONTEXT.md, Phase 01)
- **Audit reference:** `.planning/codebase/AI-PIPELINE-AUDIT.md` Dimension 2

---

## Context

The CriaLook campanha-ia pipeline today is **three deterministic LLM calls**: a Gemini 3.1 Pro Analyzer call that produces a structured visual analysis of the lojista's product photo, followed by two parallel calls — Gemini 3 Pro Image for the photorealistic VTO render, and Claude Sonnet 4.6 for the PT-BR (or EN) marketing copy. There is no agentic loop, no dynamic tool dispatch, no provider-swap requirement, and no retrieval layer. Each call has a fixed prompt template, a fixed model selection, and a fixed output shape that the pipeline merges into the campaign payload streamed back to the lojista over SSE.

Every framework worth considering — Vercel AI SDK, Mastra, LangChain, LangGraph, Inngest Agent Kit — adds an abstraction layer (provider router, agent loop, workflow runtime) whose value is amortized over many LLM calls or many providers. Three calls and two providers do not pay for that overhead. The pipeline already has best-in-class custom infrastructure for what it actually needs — `callGeminiSafe` retry+classify wrapper, `responseJsonSchema` structured-output mode, real-token cost accounting per call — and migrating that to a framework would be a regression in error-handling fidelity, not an improvement. Critically, Vercel AI SDK does not yet treat Gemini 3 Pro Image as a first-class image-generation provider, so the VTO call would remain bare-SDK regardless, defeating the unification argument entirely.

## Decision

**Stay on bare SDKs (`@anthropic-ai/sdk` + `@google/genai`). No migration to Vercel AI SDK, Mastra, LangChain, LangGraph, or Inngest Agent Kit.** (CONTEXT.md decision **D-05**, verbatim.)

## Versions Pinned

```
- @anthropic-ai/sdk@^0.92.0
- @google/genai@^1.48.0
- zod@^4.3.6 (boundary validation; not a framework)
```

If a dev needs to add a new model surface, prefer matching the existing pin (no `npm install` of "latest"). Lock-file regeneration follows the project's `npm run lock:fix` rule (see project-memory `project_eas_npm_lock.md` — same posture: never plain `npm install`).

## Rejected Alternatives

| Framework | Ruled Out Because |
|-----------|------------------|
| Vercel AI SDK | Gemini 3 Pro Image not first-class for image gen; would still need bare SDK for VTO; partial unification has negative ROI |
| Mastra | Full framework adoption (workflows + evals + tracing native) is a swing too large to justify against 3-call pipeline; eval and observability solved more cheaply by direct DB-write to existing `campaign_scores` + Phoenix later |
| LangChain / LangGraph | Heavy abstraction tax; debugging through chains is harder than through bare SDK calls; no agentic flow requires the graph |
| Inngest Agent Kit | We already use Inngest for async jobs — Agent Kit specifically is for agent loops we don't have |

## Vendor Lock-In

Partial — Anthropic for copy, Google for vision and image. By design (each model is best-in-class for its task). The lock-in is **task-level**, not architectural: swapping Sonnet for another text model is a single-file change inside `lib/ai/sonnet-copywriter.ts`, and swapping Gemini 3 Pro Image for another image model is a single-file change inside `lib/ai/gemini-vto-generator.ts`. There is no shared abstraction layer that would have to be rewritten alongside such a swap, because there is no shared abstraction layer at all — that is the point of the bare-SDK choice.

## Revisit Triggers

Reopen this ADR if **any one** of the following occurs (lifted from CONTEXT.md D-06 — do not extend without a new decision record):

- Pipeline grows to **≥4 LLM calls**.
- **Any agentic loop** is required (model decides next tool, multi-step plan, self-reflection retry).
- **A new provider** enters the pipeline (third-party text/vision/image model beyond Anthropic + Google).
- **More than 2 prompt-quality regressions in 90 days** that would have been caught by a framework's eval/observability layer.

When any trigger fires, re-evaluate against the same four candidates (Vercel AI SDK, Mastra, LangChain/LangGraph, Inngest Agent Kit) — first-class support for the current model surface (especially Gemini 3 Pro Image) remains the highest-weight criterion.

## Operational Patterns Preserved by This Decision

The bare-SDK choice keeps the following pipeline-specific patterns working without abstraction-layer interference. A framework migration would either replace each pattern with the framework's generic equivalent (lossy) or force the team to maintain both layers (worse). The patterns are listed with their current file locations so a future reader can locate them quickly:

- **`callGeminiSafe` retry+classify wrapper** — typed retry with structured error classification (userMessage / technicalMessage / retryable / httpStatus / originalError). File: `campanha-ia/src/lib/ai/gemini-error-handler.ts`.
- **`responseJsonSchema` structured-output mode for the Gemini analyzer** — Gemini SDK's first-class JSON-schema output, already correctly used; no adapter layer required. File: `campanha-ia/src/lib/ai/gemini-analyzer.ts`.
- **Real-token cost accounting via `api_cost_logs`** — one row per LLM call, with provider/model/usage/durationMs and (after Plan 01-04 D-15) `prompt_version`. File: `campanha-ia/src/lib/ai/pipeline.ts` (cost-log functions, lines 312-433 pre-consolidation).
- **Lazy module-level singleton clients** — `let _x: T | null = null` + `getX()` factory; consolidated into a single source-of-truth module by Plan 01-03. File (post-consolidation): `campanha-ia/src/lib/ai/clients.ts` (`getAnthropic()` + `getGoogleGenAI()`).
- **Anthropic SDK built-in retry** — used via the `Anthropic({ maxRetries })` constructor option; replaces the prior hand-rolled retry in `sonnet-copywriter.ts:151-167` (D-16 cleanup). File: `campanha-ia/src/lib/ai/sonnet-copywriter.ts`.
- **Anthropic `tool_use` + Zod boundary validation** — structured-output pattern for Sonnet, replacing the regex JSON-parse path (D-16). Tool: `generate_dicas_postagem`. Files: `campanha-ia/src/lib/ai/sonnet-copywriter.ts` + `campanha-ia/src/lib/ai/pipeline.ts`.
- **`callWithTimeout` Promise.race wrapper** — extracted from `sonnet-copywriter.ts` into `lib/ai/with-timeout.ts` and applied inside `callGeminiSafe` (D-17). Defaults: 30s analyzer / 90s VTO. File (post-extraction): `campanha-ia/src/lib/ai/with-timeout.ts`.
- **Fire-and-forget cost logging contract** — `.catch((e) => console.warn(...))` so the user-facing path never waits on the cost-log write. Preserved by `logModelCost` consolidation (D-18). File: `campanha-ia/src/lib/ai/pipeline.ts`.

A framework migration would have to either re-implement each of these patterns in framework-idiomatic form (re-paying the cost of patterns that already work) or wrap them as escape hatches around the framework (worst of both worlds). The bare-SDK choice avoids that trade entirely.

## Sources

- `.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md` §2 (Framework Decision + Alternatives table — direct lift).
- `.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md` D-05 (stay on bare SDKs) and D-06 (revisit triggers).
- `.planning/codebase/AI-PIPELINE-AUDIT.md` Dimension 2 (provider/SDK sprawl finding that motivated the ADR).
- Codebase: `campanha-ia/src/lib/ai/{pipeline,sonnet-copywriter,gemini-analyzer,gemini-vto-generator,gemini-error-handler,identity-translations}.ts` (the patterns this ADR preserves).
