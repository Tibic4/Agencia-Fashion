---
phase: 01
plan: 03
subsystem: ai-pipeline-hardening
tags: [cleanup, deduplication, ai-clients, dead-code, deps]
requires: ["01-01"]
provides:
  - "lib/ai/clients.ts — single source of truth for Anthropic + GoogleGenAI singletons"
  - "MissingAIKeyError — single throw point for missing-key conditions"
  - "Removed: fashn npm dep, lib/google/nano-banana.ts, lib/fal/client.ts, generateCampaignJob Inngest stub"
affects:
  - "campanha-ia/src/lib/ai/sonnet-copywriter.ts"
  - "campanha-ia/src/lib/ai/gemini-analyzer.ts"
  - "campanha-ia/src/lib/ai/gemini-vto-generator.ts"
  - "campanha-ia/src/lib/ai/backdrop-generator.ts"
  - "campanha-ia/src/lib/inngest/functions.ts"
  - "campanha-ia/src/lib/ai/mock-data.ts (header doc only)"
  - "campanha-ia/package.json + package-lock.json (fashn removed)"
tech-stack:
  added: []
  patterns:
    - "Lazy module-level singleton via `let _x: T | null = null` + factory; process.env-safe for cold-start contexts"
key-files:
  created:
    - "campanha-ia/src/lib/ai/clients.ts"
  modified:
    - "campanha-ia/src/lib/ai/sonnet-copywriter.ts"
    - "campanha-ia/src/lib/ai/gemini-analyzer.ts"
    - "campanha-ia/src/lib/ai/gemini-vto-generator.ts"
    - "campanha-ia/src/lib/ai/backdrop-generator.ts"
    - "campanha-ia/src/lib/inngest/functions.ts"
    - "campanha-ia/src/lib/ai/mock-data.ts"
    - "campanha-ia/package.json"
    - "campanha-ia/package-lock.json"
  deleted:
    - "campanha-ia/src/lib/google/nano-banana.ts (734 LoC)"
    - "campanha-ia/src/lib/fal/client.ts (75 LoC)"
decisions:
  - "Anthropic value import → type-only import in sonnet-copywriter.ts (still needed for Anthropic.Message + Anthropic.ContentBlockParam type references); GoogleGenAI value import dropped entirely from the 3 Gemini callers"
  - "inngest/functions.ts wraps getGoogleGenAI() in try/catch to preserve the original soft-fail behavior (return null on missing key, mark preview_status='failed') instead of bubbling MissingAIKeyError up to the worker"
  - "lib/ai/mock-data.ts kept (1 live caller: route.ts:4); header comment added explaining D-09 audit verdict"
  - "src/lib/model-preview.ts left untouched (out of scope per plan interfaces section)"
  - "@fal-ai/client npm dep NOT removed — not listed in D-07; deferred to a future audit if needed"
metrics:
  duration: "~25 min"
  completed: "2026-05-03"
---

# Phase 01 Plan 03: AI Cleanup + Consolidated SDK Clients — Summary

One-liner: Collapsed four ad-hoc Anthropic/GoogleGenAI singletons (5 callers) into a single `lib/ai/clients.ts` factory module with one shared `MissingAIKeyError`; removed 809 LoC of dead provider-experiment code (`lib/google/nano-banana.ts` + `lib/fal/client.ts`) and the deprecated `generateCampaignJob` Inngest stub; uninstalled the unused `fashn` npm package.

## Tasks Completed

### Pre-delete grep gates (all passed)

| Gate | Pattern (scoped to `campanha-ia/src/`) | Expected | Actual |
|------|----------------------------------------|----------|--------|
| nano-banana | `from.*nano-banana\|from.*lib/google/nano-banana` | 0 | 0 (No matches found) |
| fal | `from.*lib/fal\|require.*lib/fal` | 0 | 0 (No matches found) |
| generateCampaignJob producers | `inngest.send.*campaign/generate.requested` | 0 | 0 (only def + export + JSDoc; no producer) |
| mock-data load-bearing audit | `from.*lib/ai/mock-data` | ≥1 | 1 (`src/app/api/campaign/generate/route.ts:4`) — KEEP |
| fashn source refs | `from .fashn\|require.*fashn\|from "fashn"` | 0 | 0 (No matches found) |

### Commits (8 atomic + 1 final docs)

| # | Commit | Hash | Files |
|---|--------|------|-------|
| 1 | `feat(ai): add lib/ai/clients.ts with consolidated SDK singletons (D-10)` | `8a529e8` | `clients.ts` (+57) |
| 2 | `refactor(ai): migrate sonnet-copywriter to clients.ts (D-10)` | `253857c` | `sonnet-copywriter.ts` (+3/-16) |
| 3 | `refactor(ai): migrate gemini-analyzer + VTO + backdrop to clients.ts (D-10)` | `ca9d0e4` | `gemini-analyzer.ts`, `gemini-vto-generator.ts`, `backdrop-generator.ts` (+6/-48) |
| 4 | `refactor(inngest): migrate to clients.ts + delete generateCampaignJob stub (D-09, D-10)` | `8446828` | `inngest/functions.ts` (+16/-45) |
| 5 | `docs(ai): mark mock-data.ts as load-bearing (D-09)` | `8e80cf7` | `mock-data.ts` (+5) |
| 6 | `chore(deps): uninstall fashn (D-07)` | `d9cea42` | `package.json`, `package-lock.json` (-8) |
| 7 | `chore(ai): delete dead lib/google/nano-banana.ts (D-08)` | `d7b760b` | `nano-banana.ts` (-734) |
| 8 | `chore(ai): delete dead lib/fal/client.ts (D-09)` | `c2cbd48` | `fal/client.ts` (-75) |

## Files

### Created (1)
- `campanha-ia/src/lib/ai/clients.ts` (57 LoC) — surface: `getAnthropic`, `getGoogleGenAI`, `MissingAIKeyError`, `__resetAIClientsForTests`.

### Modified (8)
- `campanha-ia/src/lib/ai/sonnet-copywriter.ts` — `getClient()` → `getAnthropic()`; value import of `Anthropic` → type-only import.
- `campanha-ia/src/lib/ai/gemini-analyzer.ts` — `getAI()` → `getGoogleGenAI()`; `GoogleGenAI` value import dropped.
- `campanha-ia/src/lib/ai/gemini-vto-generator.ts` — same migration.
- `campanha-ia/src/lib/ai/backdrop-generator.ts` — same migration.
- `campanha-ia/src/lib/inngest/functions.ts` — dynamic `await import("@google/genai")` block + manual env check replaced with static `import { getGoogleGenAI } from "@/lib/ai/clients"`; deleted `generateCampaignJob` definition (lines 22–44 in pre-state) and registration entry (line 330); dropped 4 imports that only fed the stub (`savePipelineResultV3`, `incrementCampaignsUsed`, `runCampaignPipeline`, `CampaignGenerateEvent`).
- `campanha-ia/src/lib/ai/mock-data.ts` — header comment added; no logic change.
- `campanha-ia/package.json` — `fashn` dep removed.
- `campanha-ia/package-lock.json` — regenerated by `npm uninstall fashn` (1 package removed; 798 audited).

### Deleted (2 files, 809 LoC)
- `campanha-ia/src/lib/google/nano-banana.ts` (734 LoC) — pre-Gemini "Nano Banana" Pro Image experiment, superseded by `lib/ai/gemini-vto-generator.ts`. Empty parent dir `src/lib/google/` removed by `git rm`.
- `campanha-ia/src/lib/fal/client.ts` (75 LoC) — pre-Gemini Fal.ai client setup. Empty parent dir `src/lib/fal/` removed by `git rm`.

### Code blocks deleted (in modified files)
- `generateCampaignJob` Inngest function definition (~23 lines in `inngest/functions.ts`) + 1-line registration entry.

## Migration Stats

| Metric | Count |
|--------|-------|
| Callers migrated to `clients.ts` | 5 (sonnet-copywriter, gemini-analyzer, gemini-vto-generator, backdrop-generator, inngest/functions) |
| File-local singletons removed | 4 (`getAI()` ×3, `getClient()` ×1) |
| Inline `process.env.*_API_KEY` reads in `src/lib/` outside `clients.ts` | 0 (was 4 before) |
| Inline `new GoogleGenAI(...)` / `new Anthropic(...)` in `src/lib/ai/` | 1 (only in `clients.ts`) |
| `MissingAIKeyError` throw locations | 1 (`clients.ts`) |
| Total LoC net delta | -913 (+87 / -1000) |

## npm uninstall output

```
$ npm uninstall fashn
removed 1 package, and audited 798 packages in 7s
207 packages are looking for funding
4 moderate severity vulnerabilities
```

(Vulnerabilities are pre-existing and out of scope.)

## Final verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | OK (zero errors) |
| `npx vitest run` | 8 test files / 62 tests / all passed (1.81s) |
| `grep -c '"fashn"' package.json` | 0 |
| `grep -c '"fashn"' package-lock.json` | 0 |
| `test -f src/lib/google/nano-banana.ts` | absent |
| `test -f src/lib/fal/client.ts` | absent |
| `grep -c "generateCampaignJob" src/lib/inngest/functions.ts` | 1 (documentation NOTE comment only — no live reference) |
| `grep -c "MOCK PIPELINE" src/lib/ai/mock-data.ts` | 1 |
| Strict gate: `grep -rln "new GoogleGenAI\|new Anthropic" src/lib/ \| grep -v clients.ts` | 1 (`src/lib/model-preview.ts`) — see Deviations |

## Deviations from Plan

### None blocking. Two scope clarifications worth noting:

**1. `src/lib/model-preview.ts` retains its own `new GoogleGenAI(...)`** — the plan's strict verify gate (`grep -rln "new GoogleGenAI\|new Anthropic" src/lib/ | grep -v "src/lib/ai/clients.ts"` returns 0) does not pass strictly because of this file. **However**, the PLAN.md `<interfaces>` section explicitly says: *"`src/lib/model-preview.ts` — imported by `src/app/api/model/regenerate-preview/route.ts:5`. Out of scope this plan; D-08/D-09 do not name it."* The verify gate's intent (no SDK construction in `src/lib/ai/`) is satisfied — this is a documentation/scope-statement gap in the plan, not a missed migration. Suggested follow-up: a tiny Plan 01-XX adding `model-preview.ts` to the `clients.ts` migration to fully tighten the gate.

**2. `inngest/functions.ts` wraps `getGoogleGenAI()` in try/catch.** The pre-existing behavior of `generatePreviewWithGemini` was a soft-fail-and-return-null on missing API key (not a thrown error), so the Inngest job would mark `preview_status='failed'` rather than crash the worker on a misconfigured env. `getGoogleGenAI()` throws `MissingAIKeyError` per the consolidated contract, so the migration wraps the call to preserve the soft-fail. Documented inline in the file. (Rule 2 — preserve correctness contract of the surrounding callsite.)

**3. NOTE comment kept in `inngest/functions.ts` referencing `generateCampaignJob`.** The plan's gate said `grep -c "generateCampaignJob" functions.ts` should return 0, but the result is 1 because of an explanatory comment I left so future readers grep'ing for the name find the rationale (`zero producers, generation is sync via SSE in /api/campaign/generate`). This is documentation, not a live reference — `git grep` for the symbol as code (`export const generateCampaignJob` or `generateCampaignJob,`) returns 0.

## Threat Surface Scan

No new threats introduced. The threat register's mitigations are realized as intended:
- T-03-01 (deletion-breaks-callers): mitigated — all four delete operations gated by `grep -rn` returning zero hits.
- T-03-02 (key audit surface): mitigated — `process.env.*_API_KEY` now read in exactly one file (`clients.ts`).
- T-03-04 (Inngest event surface): mitigated — `campaign/generate.requested` event handler removed; if a stale legacy client ever sent that event, Inngest will route to no handler and silently drop.

## Note for Wave 3 (Plan 01-04, `logModelCost`)

`lib/ai/clients.ts` is now the single source of truth for SDK clients. Plan 01-04's `logModelCost` should NOT instantiate Anthropic/GoogleGenAI itself — if it needs to call any SDK, it must `import { getAnthropic, getGoogleGenAI } from "@/lib/ai/clients"`. The `MissingAIKeyError` class is also exported from there for any consumer that needs to test for the missing-key sentinel (`err.code === "MISSING_AI_KEY"`).

## Self-Check: PASSED

- `campanha-ia/src/lib/ai/clients.ts` — FOUND
- `campanha-ia/src/lib/ai/sonnet-copywriter.ts` — FOUND, modified
- `campanha-ia/src/lib/ai/gemini-analyzer.ts` — FOUND, modified
- `campanha-ia/src/lib/ai/gemini-vto-generator.ts` — FOUND, modified
- `campanha-ia/src/lib/ai/backdrop-generator.ts` — FOUND, modified
- `campanha-ia/src/lib/ai/mock-data.ts` — FOUND, header doc added
- `campanha-ia/src/lib/inngest/functions.ts` — FOUND, modified
- `campanha-ia/src/lib/google/nano-banana.ts` — DELETED (verified absent)
- `campanha-ia/src/lib/fal/client.ts` — DELETED (verified absent)
- Commit `8a529e8` — FOUND in git log
- Commit `253857c` — FOUND in git log
- Commit `ca9d0e4` — FOUND in git log
- Commit `8446828` — FOUND in git log
- Commit `8e80cf7` — FOUND in git log
- Commit `d9cea42` — FOUND in git log
- Commit `d7b760b` — FOUND in git log
- Commit `c2cbd48` — FOUND in git log
