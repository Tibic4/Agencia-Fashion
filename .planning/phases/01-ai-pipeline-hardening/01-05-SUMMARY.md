---
phase: 01-ai-pipeline-hardening
plan: 05
subsystem: ai-pipeline
tags: [d-16, sonnet, tool-use, zod, anthropic, boundary-validation, sentry]
requires:
  - getAnthropic + maxRetries:2 (lib/ai/clients.ts, Plan 01-03 / D-10)
  - withTimeout (lib/ai/with-timeout.ts, Plan 01-02 / D-17)
  - logModelCost call site at pipeline.ts:212-227 (Plan 01-04 / D-18) — UNCHANGED
  - SONNET_PROMPT_VERSION_PT/EN, sonnetPromptVersionFor (Plan 01-01 / D-15)
  - captureError (lib/observability.ts)
  - SonnetCopyResult shape consumed by pipeline.ts:209 .then() chain
  - Fallback dicas at pipeline.ts:218-237 — UNCHANGED, still catches SonnetInvalidOutputError
provides:
  - SonnetDicasPostagemSchema (Zod, exported)
  - SonnetDicasPostagem (now z.infer<typeof SonnetDicasPostagemSchema> — single source of truth)
  - SonnetInvalidOutputError class (code=SONNET_INVALID_OUTPUT, retryable=false, userMessage in PT-BR)
  - generateDicasPostagemTool (Anthropic.Tool, name locked to "generate_dicas_postagem")
  - tool_use + Zod boundary contract on every Sonnet copy generation
affects:
  - campanha-ia/src/lib/ai/sonnet-copywriter.ts (parser path rewritten, surface preserved)
  - Sentry: new SONNET_INVALID_OUTPUT alert class fires on schema drift (was silently masked)
tech-stack:
  added: []
  patterns:
    - "Anthropic tool_use + tool_choice forcing → Zod safeParse at the boundary"
    - "z.infer single-source-of-truth (interface derived from schema, not hand-maintained)"
    - "Classified error mirroring gemini-error-handler shape (code/retryable/userMessage/cause via ES2022 options bag)"
    - "Sentry breadcrumb on parser regressions (no longer silent)"
key-files:
  created:
    - campanha-ia/src/lib/ai/sonnet-copywriter.test.ts
  modified:
    - campanha-ia/src/lib/ai/sonnet-copywriter.ts
decisions:
  - "Tool name `generate_dicas_postagem` locked per CONTEXT.md D-16 — not negotiable across this plan."
  - "logModelCost call NOT moved into generateCopyWithSonnet; the pipeline.ts:212-227 call site (Plan 01-04 wiring) is the canonical owner. Moving it would double-log."
  - "SonnetInvalidOutputError forwards `cause` via the ES2022 Error options bag (super(msg, { cause })) instead of a parameter property — keeps it on the standard Error.cause field that Sentry already serializes."
  - "Edge case from execution-directives §6 (model emits text before tool_use) is covered by the explicit content.find by name; corresponding test uses a mocked Message with [text, tool_use] content array."
metrics:
  duration_min: 9
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
  loc_added: 485
  loc_removed: 104
  loc_net: 381
  tests_added: 13
  completed: 2026-05-03
status: complete
---

# Phase 01 Plan 05: Sonnet `tool_use` + Zod Boundary (D-16) Summary

Sonnet copywriter migrated from regex `JSON.parse` over response text to Anthropic `tool_use` + Zod boundary validation. Inline `callWithTimeout` / `isRetryable` / hand-rolled retry loop / regex JSON parser / "complete fallback" defaults all DELETED. Schema drift now fires `SonnetInvalidOutputError` (with Sentry `captureError` breadcrumb carrying `stop_reason` or `input`) instead of silently filling missing fields with hardcoded defaults — corrupted downstream copy is now LOUD instead of SILENT. The orchestrator-level fallback at `pipeline.ts:218-237` still catches the new error and returns default dicas, preserving the resilience contract.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add `SonnetDicasPostagemSchema` (Zod) + `generateDicasPostagemTool` (Anthropic.Tool) + `SonnetInvalidOutputError` class; redefine `SonnetDicasPostagem` interface as `z.infer<typeof SonnetDicasPostagemSchema>` (single source of truth); add 13 Vitest cases | `ce228bc` | `campanha-ia/src/lib/ai/sonnet-copywriter.ts`, `campanha-ia/src/lib/ai/sonnet-copywriter.test.ts` |
| 2 | Rewrite `generateCopyWithSonnet` to use `withTimeout` + `tools[generateDicasPostagemTool]` + `tool_choice` + Zod safeParse on tool_use block; DELETE inline `callWithTimeout`, `isRetryable`, retry loop, regex JSON parser, complete-fallback block | `4a0d7aa` | `campanha-ia/src/lib/ai/sonnet-copywriter.ts` |

Note on commit splitting: per Plan 01-01 / Plan 01-04 precedent, the husky `pre-commit` hook runs `npx tsc --noEmit` over the whole project. A standalone test-only RED commit fails that gate (the schema/error/tool symbols don't exist yet → TS2305). Tests therefore land WITH Task 1 (where the schema/error class become available — those tests turn green immediately); the 7 generateCopyWithSonnet tests stay red until Task 2's source rewrite, at which point all 13 turn green. Git history shows two atomic functional commits, not three.

## LoC Delta

| File | Added | Removed | Net |
|---|---:|---:|---:|
| `sonnet-copywriter.test.ts` (new) | 307 | — | +307 |
| `sonnet-copywriter.ts` (refactor) | 178 | 104 | +74 |
| **Totals** | **485** | **104** | **+381** |

The source-only diff for the two source commits (excluding the test file): **+178 / -104**. The +74 net on the source file is the tool definition (~110 lines including the snake-case JSON schema mirror) plus the new Zod schema (~30 lines) plus the `SonnetInvalidOutputError` class (~20 lines), MINUS the deleted regex parser + `callWithTimeout` + `isRetryable` + retry loop + complete-fallback block (~84 lines). Test file is the dominant additive line count, as expected for a TDD-driven plan.

## Lines DELETED (legacy parsing/control-flow)

Per the plan's "Output" section requirement to record original line ranges:

| Removed block | Original lines (pre-Plan-05) | Why deleted |
|---|---|---|
| `function callWithTimeout(timeoutMs)` (inline `Promise.race` against a manual setTimeout) | 145-150 | Replaced by `withTimeout` from `lib/ai/with-timeout.ts` (Plan 01-02 / D-17). Same 30s deadline, same `Promise.race` pattern, but with the timer-cleanup `.finally()` that the inline version lacked. |
| `function isRetryable(err)` (regex on `err.message` for `timeout|rate.?limit|429|503|504|overloaded|ECONNRESET`) | 152-155 | Anthropic SDK's `maxRetries: 2` (locked into `clients.ts:getAnthropic`, Plan 01-03 / D-10) handles 408/409/429/5xx with proper Retry-After honoring. Regex-on-`.message` was never a reliable way to classify SDK errors. |
| Manual try/catch retry loop (1s backoff, second attempt at 45s timeout) | 157-173 | Same — duplicated SDK behavior, less correctly. |
| Regex JSON parse + markdown-fence stripping (`text.replace(/```json/...).replace(/```/...).trim()`, `cleaned.indexOf("{")`, `cleaned.lastIndexOf("}")`, `JSON.parse(cleaned.slice(first, last + 1))`) | 181-200 | This is the silent-failure mode the plan exists to kill. Text-block parsing is irrelevant under tool_use forcing — the model emits structured `input` directly, no markdown, no extraction. |
| "Complete fallback" block that filled missing `caption_sugerida`/`caption_alternativa`/`legendas` with hardcoded defaults | 202-212 | Per D-16 / T-05-04: schema drift must be loud (Sentry alert), not silent (default values). The orchestrator-level fallback at `pipeline.ts:218-237` is the right layer for graceful degradation; the call-site fallback was a wrong layer that masked drift from Tuesday-prompt-edit-Friday-quality-dip debugging. |

## Tool Definition Snapshot (`generateDicasPostagemTool.input_schema`)

So the rubric/Phase-2 reviewer doesn't need to re-read the source — locked input_schema fields:

```text
type: "object"
properties:
  melhor_dia:           { type: "string" }
  melhor_horario:       { type: "string" }
  sequencia_sugerida:   { type: "string" }
  caption_sugerida:     { type: "string" }
  caption_alternativa:  { type: "string" }
  tom_legenda:          { type: "string" }
  cta:                  { type: "string" }
  dica_extra:           { type: "string" }
  story_idea:           { type: "string" }
  hashtags:             { type: "array", items: { type: "string" } }
  legendas:             { type: "array", minItems: 3, items: {
                          type: "object",
                          properties: { foto: integer, plataforma: string,
                                        legenda: string, hashtags: string[],
                                        dica: string },
                          required: ["foto", "plataforma", "legenda"]
                        } }
required: [all 11 fields above]
```

The Zod schema mirror (`SonnetDicasPostagemSchema`) tightens this with `caption_sugerida.min(1)`, `legendas.min(3)`, and `legenda.min(1)` per nested entry — the JSON Schema layer defers required-field enforcement to Anthropic; the Zod layer enforces *content*-level minimums.

## prompt_version SHA Preservation Evidence (D-15 contract)

Per the executor brief: PT/EN SHAs from Plan 01-01 MUST remain identical post-migration because system prompts (`buildSystemPrompt(locale)` + `buildSystemPromptEN()`) MUST NOT change.

| Constant | Plan 01-01 baseline | Plan 01-04 post-migration | **Plan 01-05 post-migration** |
|---|---|---|---|
| `SONNET_PROMPT_VERSION_PT` | `368daa52106b` | `368daa52106b` ✓ | `368daa52106b` ✓ |
| `SONNET_PROMPT_VERSION_EN` | `6fb4023c4732` | `6fb4023c4732` ✓ | `6fb4023c4732` ✓ |

Verified via `npx tsx -e "import { SONNET_PROMPT_VERSION_PT, SONNET_PROMPT_VERSION_EN } from './src/lib/ai/sonnet-copywriter.ts'; console.log(...)"` immediately before the first edit, after Task 1 commit, and after Task 2 commit. Three reads, three identical outputs. The five `buildSystemPrompt` / `buildSystemPromptEN` / `buildUserPrompt` / `buildUserPromptEN` / locale-switching code paths are byte-identical to pre-Plan-05.

## Behavioral Preservation Evidence

### `SonnetCopyResult` interface — UNCHANGED

```ts
// Pre and post Plan 05 — identical:
export interface SonnetCopyResult {
  dicas_postagem: SonnetDicasPostagem;
  _usageMetadata?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

`pipeline.ts:209` consumes `copyResult._usageMetadata?.inputTokens` and `copyResult._usageMetadata?.outputTokens` for the `logModelCost` call. Same shape pre/post — `pipeline.ts` did NOT need to be modified.

`SonnetDicasPostagem` is now `z.infer<typeof SonnetDicasPostagemSchema>` instead of a hand-written `interface`, but the resolved structural shape is identical (every field on the old interface exists on the inferred type with the same TS type, modulo `hashtags?: string[]` and `dica?: string` on `SonnetDicaLegenda` which `z.array(...).optional()` resolves to `string[] | undefined` — same as `?:` syntax).

### `pipeline.ts` — UNCHANGED

```bash
$ git diff HEAD~2 HEAD -- campanha-ia/src/lib/ai/pipeline.ts
(no output — Plan 01-05's two commits did not touch this file)

$ git log --oneline -- campanha-ia/src/lib/ai/pipeline.ts | head -3
2435d9b refactor(ai): pipeline.ts uses logModelCost; delete logAnalyzerCost + logSonnetCost (D-18)
7304961 feat(admin)(01-07): surface regenerate_reason aggregate in /admin/custos (D-04)
4582595 chore(copy): alinhar textos e preços com pipeline single-shot
```

Last touched by Plan 01-04 (`2435d9b`). The fallback at `pipeline.ts:218-237` (the `.catch((err) => { ... return { dicas_postagem: { ... default dicas ... }, _usageMetadata: undefined } })`) is preserved verbatim and still intercepts `SonnetInvalidOutputError` — verified by reading the block, by `git diff` empty output, and by the `does NOT retry on schema-validation failure` Vitest case (which asserts only ONE `messages.create` call when validation fails — confirming the error propagates instead of being swallowed-and-retried inside `generateCopyWithSonnet`).

### Resilience contract end-to-end

1. Sonnet API success + valid tool_use input → `dicas_postagem` returns to `pipeline.ts` `.then()` chain → `logModelCost` fires → user gets real copy.
2. Sonnet API success + invalid tool_use input (Zod failure) → `SonnetInvalidOutputError` thrown → `captureError(err, { extra: { input } })` fires Sentry → `pipeline.ts` `.catch()` returns hardcoded fallback dicas → user gets default copy + Sentry alert reaches the team.
3. Sonnet API success + no tool_use block (impossible under `tool_choice` forcing, but defensively handled) → `SonnetInvalidOutputError` thrown → `captureError(err, { extra: { stop_reason } })` fires Sentry → same fallback path.
4. Sonnet API timeout (>30s) → `withTimeout` rejects with `AITimeoutError` (retryable=true, from Plan 02) → `pipeline.ts` `.catch()` returns hardcoded fallback dicas.
5. Sonnet API transport error (429/503/etc) → SDK retries up to 2 times automatically → if still failing, error propagates → `pipeline.ts` `.catch()` returns hardcoded fallback dicas.

## Verification

### Final tsc + vitest

```text
$ cd campanha-ia && npx tsc --noEmit
(0 errors)

$ cd campanha-ia && npx vitest run --reporter=default
 ✓ src/lib/ai/log-model-cost.test.ts (7 tests) 67ms
 ✓ src/lib/ai/sonnet-copywriter.test.ts (13 tests) 291ms        ← NEW
 ✓ src/lib/ai/with-timeout.test.ts (5 tests) 20ms
 ✓ src/lib/payments/google-play.test.ts (20 tests) 91ms
 ✓ src/lib/editor-session.test.ts (10 tests) 13ms
 ✓ src/lib/mp-signature.test.ts (11 tests) 12ms
 ✓ src/lib/ai/prompt-version.test.ts (4 tests) 9ms
 ✓ src/lib/validation.test.ts (5 tests) 8ms
 ✓ src/lib/rate-limit.test.ts (4 tests) 8ms
 ✓ src/lib/observability.test.ts (3 tests) 14ms

 Test Files  10 passed (10)
      Tests  82 passed (82)
   Duration  2.24s
```

Baseline was 69/69 across 9 files; post-Plan-05 is 82/82 across 10 files (+1 file, +13 tests, all in `sonnet-copywriter.test.ts`).

### Grep verification (per execution-directives §5)

```text
$ grep -n "JSON.parse" campanha-ia/src/lib/ai/sonnet-copywriter.ts
(no matches — regex parser deleted)

$ grep -n "callWithTimeout\|callSonnet\|isRetryable" campanha-ia/src/lib/ai/sonnet-copywriter.ts
(no matches — inline timeout/retry/classifier deleted)

$ grep -n "tool_choice:.*type:.*tool.*name:.*generate_dicas_postagem" campanha-ia/src/lib/ai/sonnet-copywriter.ts
256:      tool_choice: { type: "tool", name: "generate_dicas_postagem" },

$ grep -n "SonnetDicasPostagemSchema.safeParse(toolBlock.input)" campanha-ia/src/lib/ai/sonnet-copywriter.ts
280:  const parsed = SonnetDicasPostagemSchema.safeParse(toolBlock.input);

$ grep -n "captureError" campanha-ia/src/lib/ai/sonnet-copywriter.ts
21:import { captureError } from "@/lib/observability";
273:    captureError(err, { extra: { stop_reason: response.stop_reason } });
288:    captureError(err, { extra: { input: toolBlock.input } });
```

All five plan-mandated greps pass. The `JSON.parse` / `callWithTimeout` / `callSonnet` / `isRetryable` literals are absent from the codebase — the regression gate.

## Tests Added (13 cases, all passing)

| # | Suite | Asserts |
|---|---|---|
| 1 | SonnetDicasPostagemSchema (Zod boundary, D-16) | safeParse accepts a fully populated valid payload |
| 2 | (same) | rejects empty caption_sugerida (.min(1)) |
| 3 | (same) | rejects legendas with fewer than 3 entries (.min(3)) |
| 4 | (same) | rejects payload missing required field (caption_sugerida dropped entirely) |
| 5 | SonnetInvalidOutputError (D-16) | code === "SONNET_INVALID_OUTPUT", retryable === false, userMessage matches /inesperado/i, message preserved |
| 6 | (same) | optional cause forwarded to Error.cause via ES2022 options bag |
| 7 | generateCopyWithSonnet — tool_use happy path | returns dicas_postagem + _usageMetadata { inputTokens, outputTokens } when tool_use block is valid |
| 8 | (same) | calls Anthropic with model=claude-sonnet-4-6, max_tokens=1500, temperature=0.7, tools[0].name="generate_dicas_postagem", tool_choice={type:"tool",name:"generate_dicas_postagem"} |
| 9 | (same) | wraps the call with withTimeout(promise, 30_000, "Sonnet Copy") — T-05-03 mitigation |
| 10 | generateCopyWithSonnet — failure paths (T-05-01, T-05-04) | throws SonnetInvalidOutputError + captureError fires with extra.stop_reason when no tool_use block present |
| 11 | (same) | throws SonnetInvalidOutputError + captureError fires with extra.input on Zod safeParse failure (caption_sugerida missing) |
| 12 | (same) | does NOT retry on schema-validation failure (mockMessagesCreate called exactly once — T-05-04 no money burn) |
| 13 | generateCopyWithSonnet — tool_use block selection (regex-replacement edge case) | iterates response.content and selects by name, ignoring leading text blocks (regression test for the most common parser bug class) |

Mocking strategy uses the same patterns as `log-model-cost.test.ts` (Plan 01-04): `vi.mock` injects a stub Anthropic client via `./clients`, spies on `withTimeout` while preserving promise plumbing, spies on `@/lib/observability.captureError` to assert Sentry breadcrumbs. No real API calls.

`logModelCost` is intentionally NOT spied on from this test file — that contract lives at `pipeline.ts:212-227` (Plan 01-04 wiring) and is pinned by the C-02 determinism gate in `log-model-cost.test.ts`. Re-spying here would double-test and obscure the canonical wiring location.

## AI-SPEC §3 pitfall #3 — Reasoning-Elicitation Language Now Inert (Follow-Up Flag)

The Plan body called out: under `tool_choice: { type: "tool", name: "..." }` the model emits ONLY `tool_use` blocks — no leading natural-language text, no chain-of-thought. Any "explain your reasoning" / "think step by step" prompts in the system instructions become inert.

Audit of `buildSystemPrompt` (`sonnet-copywriter.ts` PT-BR system prompt, lines 367-507) shows the prompt does have internal-reasoning language: ETAPA 1 says "Antes de escrever qualquer copy, analise a foto com atenção e identifique mentalmente:" and ETAPA 3 says "Escolha UM gatilho mental para esse copy". These instructions were already framed as INTERNAL ("identifique mentalmente", "antes de escrever") and the previous regex parser ignored any preamble text anyway — so the prompt was effectively designed for non-emitted reasoning from day one. No regression; no rewrite needed in this plan.

The EN system prompt (`buildSystemPromptEN`) mirrors the same structure ("study the photo and mentally identify…") with the same posture. Same conclusion.

**No follow-up required.** The reasoning was always meant to be internal; making `tool_choice` enforce that explicitly is an alignment, not a regression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `SonnetInvalidOutputError` parameter property `cause?: unknown` triggered TS4115 (override modifier required)**
- **Found during:** Task 1 typecheck.
- **Issue:** `lib.es2022.error.d.ts` declares `Error.cause` (the standard ES2022 property). A `public readonly cause?: unknown` parameter property in the subclass shadows the base — TS strict mode requires the `override` modifier, OR just don't redeclare it.
- **Fix:** Removed the parameter property. Constructor now does `super(technicalMessage, cause !== undefined ? { cause } : undefined)` — forwards `cause` through the standard ES2022 Error options bag so it lands on `this.cause` (the lib base property). Sentry's exception serializer reads `cause` from there automatically; a parameter-property shadow would have created a divergent field that Sentry couldn't see.
- **Files modified:** `campanha-ia/src/lib/ai/sonnet-copywriter.ts` (one line in `SonnetInvalidOutputError` constructor).
- **Commit:** Folded into Task 1's `ce228bc` (caught before the commit).

**2. [Rule 1 — Bug] Vitest `vi.fn()` typing collisions with TS strict mode**
- **Found during:** Task 1 typecheck (test file).
- **Issue:** Vitest 4.x's `vi.fn()` overload set includes a `Constructable` arm; without a type parameter, tsc picked the wrong arm and rejected `mockMessagesCreate(...args)` call expressions (`Mock<Procedure | Constructable> is not callable`). Same issue with `realWithTimeoutMock` and `captureErrorSpy`.
- **Fix:** Added explicit signature types (`MessagesCreateFn`, `WithTimeoutFn`, `CaptureErrorFn`) and passed them as `vi.fn<...>()` generics. Standard pattern for Vitest 4.x strict-TS test files.
- **Files modified:** `campanha-ia/src/lib/ai/sonnet-copywriter.test.ts` (mock setup block at top of file).
- **Commit:** Folded into Task 1's `ce228bc`.

**3. [Rule 3 — Blocking] `mockMessagesCreate.mock.calls[0][0]` access required type narrowing**
- **Found during:** Task 1 typecheck.
- **Issue:** Even with the typed `vi.fn<MessagesCreateFn>()`, the captured call args are inferred as `unknown` (Vitest's `MockedFunction.mock.calls` is variadic). Direct property access (`callArgs.model`, `callArgs.tools`) failed under strict mode.
- **Fix:** Added a single explicit cast at the boundary (`as { model: string; max_tokens: number; ...; tools: Array<...> }`). The narrow type is colocated with the assertions so future readers see the expected call shape. Same pattern for `captureErrorSpy.mock.calls[0]` destructuring.
- **Files modified:** `campanha-ia/src/lib/ai/sonnet-copywriter.test.ts` (3 cast sites).
- **Commit:** Folded into Task 1's `ce228bc`.

### Plan-vs-implementation refinements (no rule needed, just notes)

**1. `logModelCost` call NOT added inside `generateCopyWithSonnet`.** Plan Task 2 §7 explicitly allowed this skip ("If cost-log was previously called from `pipeline.ts` instead of inside this function, leave the call there per Plan 04's wiring and skip this step. Read pipeline.ts to see which side owns the call after Plan 04."). Confirmed by reading `pipeline.ts:212-227` — Plan 01-04 wired the cost-log call into the `.then()` chain on `copyPromise`. Adding a second call inside `generateCopyWithSonnet` would double-log every successful call and corrupt the C-02 determinism test results in the `api_cost_logs` table. Skipped per the plan's own contingency clause.

**2. Combined RED+GREEN for both tasks** (matches Plan 01-01 / Plan 01-04 precedent). The husky `pre-commit` hook runs `npx tsc --noEmit` over the whole project; a standalone test-file commit fails because the test imports `SonnetInvalidOutputError` / `SonnetDicasPostagemSchema` which don't exist yet → TS2305 → commit aborted. So the test file lands in Task 1's commit (where the schema/error are added — those tests pass). The Task 2 generateCopy tests stay red until `4a0d7aa` (the source rewrite), at which point all 13 turn green. This is the same trade-off Plan 01-01 documented in its Deviations §2 and Plan 01-04 documented in its Deviations §1 — no commit can run with `--no-verify` per CLAUDE.md.

### Threat surface scan

No new auth paths, network endpoints, or trust-boundary surface introduced. The Anthropic API surface is unchanged (same model, same client singleton from Plan 03). The only NEW surface is the Sentry breadcrumb payload on `SonnetInvalidOutputError` — `extra.input` carries the raw `tool_use.input` (marketing copy + lojista form data), which is `T-05-02` in the threat register's `accept` disposition (no PII beyond what Sentry already captures via the upstream `store_id` / `campaign_id` breadcrumb in `route.ts`).

### Stub tracking

None — `generateCopyWithSonnet` returns a fully-validated, fully-populated `SonnetDicasPostagem` on every success path, or throws (no placeholder defaults, no TODO branches, no "coming soon" copy). The orchestrator-level fallback at `pipeline.ts:218-237` is the single legitimate stub (already documented in Plan 01-04's notes); not introduced by this plan.

## Note for Phase 2

When Phase 2 introduces server-side tool result loops or multi-turn agent flows, the `tool_use` pattern landed here is the foundation: `generateDicasPostagemTool` is a "leaf" tool (no execution, just schema constraint). A multi-turn agent in Phase 2 would add an executable tool (e.g. `lookup_pricing`, `fetch_inventory`) and feed `tool_result` blocks back to a follow-up `messages.create`. The boundary pattern is identical: `tool_use.input` is `unknown` → `Schema.parse(input)` → typed handler. Don't `as`-cast.

## Self-Check: PASSED

- [FOUND] `campanha-ia/src/lib/ai/sonnet-copywriter.ts` (modified, 709 lines)
- [FOUND] `campanha-ia/src/lib/ai/sonnet-copywriter.test.ts` (created, 307 lines, 13/13 passing)
- [VERIFIED ABSENT] `JSON.parse` in `sonnet-copywriter.ts` (regex parser deleted)
- [VERIFIED ABSENT] `function callWithTimeout` / `callSonnet` / `function isRetryable` in `sonnet-copywriter.ts` (legacy timeout/retry deleted)
- [FOUND] `tool_choice: { type: "tool", name: "generate_dicas_postagem" }` at `sonnet-copywriter.ts:256`
- [FOUND] `SonnetDicasPostagemSchema.safeParse(toolBlock.input)` at `sonnet-copywriter.ts:280`
- [FOUND] `captureError` at `sonnet-copywriter.ts:21` (import), `:273` (no-tool-block path), `:288` (Zod-failure path)
- [FOUND] commit `ce228bc` (Task 1) on main
- [FOUND] commit `4a0d7aa` (Task 2) on main
- [VERIFIED] `npx tsc --noEmit` returns 0 errors at HEAD
- [VERIFIED] `npx vitest run` returns 82/82 passing across 10 files at HEAD
- [VERIFIED] `SONNET_PROMPT_VERSION_PT === "368daa52106b"` at HEAD (matches Plan 01-01 baseline byte-for-byte)
- [VERIFIED] `SONNET_PROMPT_VERSION_EN === "6fb4023c4732"` at HEAD (matches Plan 01-01 baseline byte-for-byte)
- [VERIFIED] `git diff HEAD~2 HEAD -- campanha-ia/src/lib/ai/pipeline.ts` returns no output (pipeline.ts unmodified by Plan 01-05; fallback at lines 218-237 preserved)
- [VERIFIED] `SonnetCopyResult` interface unchanged (same fields, same types — pipeline.ts consumer compiles without modification)
