---
phase: 01-ai-pipeline-hardening
plan: 05
type: execute
wave: 4
depends_on: ["01-02", "01-03", "01-04"]
files_modified:
  - campanha-ia/src/lib/ai/sonnet-copywriter.ts
  - campanha-ia/src/lib/ai/sonnet-copywriter.test.ts
autonomous: true
requirements: [D-16]
user_setup: []

must_haves:
  truths:
    - "Sonnet copywriter calls Anthropic with tools[generateDicasPostagemTool] + tool_choice forcing the named tool"
    - "Sonnet response is parsed by reading the tool_use block, NOT regex JSON.parse over text"
    - "Output is validated by SonnetDicasPostagemSchema (Zod) at the boundary; SonnetInvalidOutputError is thrown on failure"
    - "SonnetInvalidOutputError calls captureError() so Sentry alerts on parser regressions"
    - "Inline callWithTimeout (lines 139-167) is deleted; the call is wrapped by the generic withTimeout from Plan 02"
    - "Hand-rolled retry loop (lines 151-167) is deleted; Anthropic SDK's maxRetries:2 handles transport retries"
    - "Existing fallback in pipeline.ts:218-237 still catches SonnetInvalidOutputError and provides default dicas"
    - "SonnetDicasPostagem type is derived from the Zod schema via z.infer (single source of truth)"
  artifacts:
    - path: "campanha-ia/src/lib/ai/sonnet-copywriter.ts"
      provides: "generateCopyWithSonnet rewritten to use tool_use + Zod boundary; SonnetDicasPostagemSchema + SonnetInvalidOutputError exports"
      exports: ["generateCopyWithSonnet", "SonnetDicasPostagem", "SonnetDicasPostagemSchema", "SonnetInvalidOutputError"]
    - path: "campanha-ia/src/lib/ai/sonnet-copywriter.test.ts"
      provides: "Vitest coverage of Zod parser happy path, missing-tool-block error, schema-validation error, fallback-on-invalid"
  key_links:
    - from: "campanha-ia/src/lib/ai/sonnet-copywriter.ts generateCopyWithSonnet"
      to: "Anthropic.messages.create with tools[] + tool_choice: { type: \"tool\", name: \"generate_dicas_postagem\" }"
      via: "client.messages.create({ tools: [generateDicasPostagemTool], tool_choice: { type: \"tool\", name: \"generate_dicas_postagem\" }, ... })"
      pattern: "tool_choice:\\s*\\{\\s*type:\\s*\"tool\""
    - from: "campanha-ia/src/lib/ai/sonnet-copywriter.ts SonnetInvalidOutputError"
      to: "campanha-ia/src/lib/observability.ts captureError"
      via: "captureError(err, { extra: { stop_reason, input } })"
      pattern: "captureError\\("
    - from: "campanha-ia/src/lib/ai/pipeline.ts fallback at lines 218-237"
      to: "SonnetInvalidOutputError thrown by sonnet-copywriter.ts"
      via: "try/catch around generateCopyWithSonnet falls through to default dicas"
      pattern: "SonnetInvalidOutputError"
---

<objective>
Migrate the Sonnet copywriter from regex `JSON.parse` over the response text (`sonnet-copywriter.ts:181-194`) to Anthropic's `tool_use` mechanism with Zod boundary validation per D-16. Define one Anthropic tool whose `input_schema` mirrors the existing `SonnetDicasPostagem` interface; pass `tools: [generateDicasPostagemTool]` + `tool_choice: { type: "tool", name: "generate_dicas_postagem" }` to force the model to emit a `tool_use` block; read the block's `input` field (which is `unknown` at the type level); validate with `SonnetDicasPostagemSchema.safeParse(...)`; throw `SonnetInvalidOutputError` (paralleling the gemini-error-handler shape) and call `captureError()` for Sentry.

Purpose: Two failure modes are silently lost today. (1) The regex parse at lines 183-189 strips markdown fences and looks for the outermost `{`/`}` — which works most of the time but produces "Sonnet retornou copy inválido" with no Sentry breadcrumb when it doesn't, so we lose all signal on parser regressions. (2) The "complete fallback" logic at lines 197-205 silently fills missing fields with hardcoded defaults, masking schema drift from prompt edits — a Tuesday prompt edit that drops a required field will pass through this fallback and corrupt downstream behavior with no error. Tool-use + Zod replaces both: the LLM is constrained to the schema at generation time, and any drift is loud (Sentry alert) instead of silent (default values).

Output: Rewritten `sonnet-copywriter.ts` with tool_use + Zod boundary; deleted inline timeout wrapper (lines 139-167); deleted hand-rolled retry loop (lines 151-167); deleted regex JSON parse + complete-fallback block (lines 181-205); Vitest tests covering the parser; existing fallback in `pipeline.ts:218-237` still handles `SonnetInvalidOutputError` propagation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@.planning/phases/01-ai-pipeline-hardening/01-02-SUMMARY.md
@.planning/phases/01-ai-pipeline-hardening/01-03-SUMMARY.md
@.planning/phases/01-ai-pipeline-hardening/01-04-SUMMARY.md
@campanha-ia/src/lib/ai/sonnet-copywriter.ts
@campanha-ia/src/lib/ai/pipeline.ts
@campanha-ia/src/lib/observability.ts

<interfaces>
<!-- Existing surface to preserve. Other modules import generateCopyWithSonnet + SonnetDicasPostagem; do not break. -->

From campanha-ia/src/lib/ai/sonnet-copywriter.ts (current public surface — DO NOT remove):
```ts
export interface SonnetDicasPostagem {
  melhor_dia: string;
  melhor_horario: string;
  sequencia_sugerida: string;
  caption_sugerida: string;
  caption_alternativa: string;
  tom_legenda: string;
  cta: string;
  dica_extra: string;
  story_idea: string;
  hashtags: string[];
  legendas: { foto: number; plataforma: string; legenda: string; hashtags?: string[]; dica?: string }[];
}

export async function generateCopyWithSonnet(opts: { /* existing args */ }): Promise<{
  dicas_postagem: SonnetDicasPostagem;
  inputTokens?: number;
  outputTokens?: number;
}>;
```

From upstream consumers (do NOT touch — they continue calling the same function):
- `campanha-ia/src/lib/ai/pipeline.ts:218-237` — try/catch around `generateCopyWithSonnet` provides default `dicas` on any throw. THIS FALLBACK STAYS — D-16 explicitly preserves it ("Existing fallback at pipeline.ts:218-237 stays").

From Plan 03 / D-10 (consume; do not redefine):
```ts
import { getAnthropic } from "@/lib/ai/clients";
```

From Plan 02 / D-17 (consume; do not redefine):
```ts
import { withTimeout } from "@/lib/ai/with-timeout";
```

From Plan 04 / D-18 (consume; do not redefine):
```ts
import { logModelCost } from "@/lib/ai/log-model-cost";
```

From Plan 01 / D-15 (the export this file introduced):
```ts
// Already exported from this file in Plan 01:
export const SONNET_PROMPT_VERSION_PT: string;
export const SONNET_PROMPT_VERSION_EN: string;
export function sonnetPromptVersionFor(locale: string): string;
```

From the codebase (Sentry capture surface — used as-is):
```ts
// campanha-ia/src/lib/observability.ts:41
export function captureError(err: unknown, opts?: { extra?: Record<string, unknown> }): void;
```

Lifted EXACTLY from AI-SPEC.md §3 (lines 224-273) for the entry-point pattern, and §4.1 (lines 323-455) for the full implementation including tool definition + Zod schema + SonnetInvalidOutputError class. The executor MUST treat those AI-SPEC sections as the source — copy the snippets, do not rewrite from scratch.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define SonnetDicasPostagemSchema (Zod) + SonnetInvalidOutputError + tool definition</name>
  <files>campanha-ia/src/lib/ai/sonnet-copywriter.ts</files>
  <behavior>
    - SonnetDicasPostagemSchema.safeParse(validInput) returns { success: true, data: ... } where data matches the existing SonnetDicasPostagem interface.
    - SonnetDicasPostagemSchema.safeParse({ caption_sugerida: "" }) returns { success: false } because all 11 fields are required and caption_sugerida fails .min(1).
    - SonnetDicasPostagemSchema.safeParse({ ...valid, legendas: [{ foto: 1, plataforma: "Instagram Feed", legenda: "x" }] }) fails because legendas requires .min(3).
    - z.infer<typeof SonnetDicasPostagemSchema> is structurally compatible with the existing SonnetDicasPostagem interface (compile-time check via `type _Check = z.infer<...> extends SonnetDicasPostagem ? true : never;`).
    - SonnetInvalidOutputError instances have code === "SONNET_INVALID_OUTPUT", retryable === false, and a userMessage in PT-BR.
  </behavior>
  <action>Open `.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md` and read §4.1 lines 333-419 (the full code block defining `SonnetDicaLegendaSchema`, `SonnetDicasPostagemSchema`, the `_SchemaMatchesInterface` compile-time check, the `generateDicasPostagemTool` constant, and the `SonnetInvalidOutputError` class). Lift EXACTLY into `campanha-ia/src/lib/ai/sonnet-copywriter.ts`, placed AFTER the existing `interface SonnetDicasPostagem` block but BEFORE `generateCopyWithSonnet`.

Once the schema is defined, redefine the existing interface in terms of the schema per AI-SPEC §4b.1 ("Single source of truth"):
```ts
// Replace the hand-written `export interface SonnetDicasPostagem { ... }` with:
export type SonnetDicasPostagem = z.infer<typeof SonnetDicasPostagemSchema>;
```
The `_SchemaMatchesInterface` line in the AI-SPEC snippet is a transitional safety net — once the interface is replaced by `z.infer`, that compile-time check is automatic and the `_SchemaMatchesInterface` line can be deleted. Keep it for one PR cycle if you want belt-and-suspenders, then delete in a follow-up.

Add Vitest tests covering the five behaviors above. Use `vi.mock` for the Anthropic client surface; do NOT make real API calls in tests. Match the test style of `campanha-ia/src/lib/payments/google-play.test.ts`. Place tests in `campanha-ia/src/lib/ai/sonnet-copywriter.test.ts`.

Imports needed:
```ts
import { z } from "zod";  // already in deps per AI-SPEC §3 Installation
import Anthropic from "@anthropic-ai/sdk";  // already imported (used for types)
import { captureError } from "@/lib/observability";  // already in repo
```

DO NOT touch `generateCopyWithSonnet` yet — that is Task 2. This task is purely additive: define the schema, the tool, the error class, and tests.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; npx vitest run src/lib/ai/sonnet-copywriter.test.ts --reporter=basic</automated>
  </verify>
  <done>SonnetDicasPostagemSchema, generateDicasPostagemTool, SonnetInvalidOutputError all exported from sonnet-copywriter.ts; SonnetDicasPostagem type derived from z.infer; tests pass; tsc clean; legacy regex parse + fallback block still in place (deleted in Task 2).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rewrite generateCopyWithSonnet to use tool_use + delete legacy regex/timeout/retry blocks</name>
  <files>campanha-ia/src/lib/ai/sonnet-copywriter.ts, campanha-ia/src/lib/ai/sonnet-copywriter.test.ts</files>
  <behavior>
    - generateCopyWithSonnet on happy path: mocked Anthropic returns a Message with content = [{ type: "tool_use", name: "generate_dicas_postagem", input: validDicas }]; function resolves with { dicas_postagem: validDicas, inputTokens, outputTokens } where dicas_postagem === SonnetDicasPostagemSchema.parse(validDicas).
    - generateCopyWithSonnet when no tool_use block in response: mocked response has only text blocks (no tool_use). Function throws SonnetInvalidOutputError with technicalMessage matching "did not emit the expected tool_use block"; captureError was called once with extra.stop_reason populated.
    - generateCopyWithSonnet when tool_use.input fails Zod validation: mocked tool_use.input is missing required field. Function throws SonnetInvalidOutputError with technicalMessage starting "Zod boundary validation failed:"; captureError was called once with extra.input populated.
    - generateCopyWithSonnet calls withTimeout: spy on withTimeout, assert it was called with the messages.create promise + 30_000 + "Sonnet Copy".
    - generateCopyWithSonnet calls logModelCost on success with { provider: "anthropic", model: "claude-sonnet-4-6", action: "sonnet_copywriter", promptVersion: <SONNET_PROMPT_VERSION_*> from Plan 01 }.
  </behavior>
  <action>Replace the body of `generateCopyWithSonnet` with the AI-SPEC §4.1 lines 421-455 implementation pattern. The full surface change inside the function:

1. **Replace the messages.create call.** Delete the existing block around `sonnet-copywriter.ts:120-140` (the `client.messages.create({...})` setup wrapped in the local `callWithTimeout`). Replace with the AI-SPEC §4.1 §lines 421-455 pattern verbatim:

   ```ts
   const client = getAnthropic();  // from Plan 03 / D-10

   const response = await withTimeout(
     client.messages.create({
       model: "claude-sonnet-4-6",
       max_tokens: 1500,
       temperature: 0.7,
       system: systemPrompt,
       tools: [generateDicasPostagemTool],
       tool_choice: { type: "tool", name: "generate_dicas_postagem" },
       messages: [{ role: "user", content: contentParts }],
     }),
     30_000,
     "Sonnet Copy",
   );
   ```

2. **DELETE the inline `callWithTimeout` function** at lines 139-144 — replaced by the import `{ withTimeout } from "@/lib/ai/with-timeout"` (Plan 02). This is the inline pattern AI-SPEC §3 pitfall #1 + §4.2 explicitly mark as the migration source.

3. **DELETE the inline `isRetryable` function** at lines 146-149 — the Anthropic SDK's `maxRetries: 2` (set in Plan 03's `clients.ts:getAnthropic`) handles 408/409/429/5xx automatically. AI-SPEC §4.1 line 457: "Drop the hand-rolled retry at sonnet-copywriter.ts:151-167 — the SDK already does it, more correctly."

4. **DELETE the manual try/catch retry block** at lines 151-167 — it's now redundant with the SDK's built-in retry.

5. **DELETE the regex JSON parse block** at lines 181-194 (`text.replace(/```json/...)` and the `JSON.parse(cleaned.slice(first, last + 1))`). Replace with the AI-SPEC §4.1 lines 436-454 tool-use-block read + Zod safeParse:
   ```ts
   const toolBlock = response.content.find(
     (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "generate_dicas_postagem",
   );
   if (!toolBlock) {
     const err = new SonnetInvalidOutputError("Sonnet did not emit the expected tool_use block");
     captureError(err, { extra: { stop_reason: response.stop_reason } });
     throw err;
   }

   const parsed = SonnetDicasPostagemSchema.safeParse(toolBlock.input);
   if (!parsed.success) {
     const err = new SonnetInvalidOutputError(
       `Zod boundary validation failed: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
       parsed.error,
     );
     captureError(err, { extra: { input: toolBlock.input } });
     throw err;
   }
   const result = parsed.data;
   ```

6. **DELETE the "complete fallback" block** at lines 196-205 (the `if (!result.caption_sugerida || ...) { ... result.caption_sugerida = ... }` defaults). Per AI-SPEC §4.1 line 459: the existing fallback at `pipeline.ts:218-237` catches `SonnetInvalidOutputError` and provides a complete default `dicas` object — this is the right layer for fallback (orchestrator-level, not call-site-level). The call-site fallback at lines 196-205 silently masks schema drift; deleting it makes drift loud.

7. **Add the cost-log call at function exit** using `logModelCost` from Plan 04:
   ```ts
   logModelCost({
     storeId, campaignId,
     provider: "anthropic",
     model: "claude-sonnet-4-6",
     action: "sonnet_copywriter",
     usage: {
       inputTokens: response.usage?.input_tokens,
       outputTokens: response.usage?.output_tokens,
     },
     durationMs: Date.now() - startTime,
     promptVersion: sonnetPromptVersionFor(locale),
   }).catch((e) => console.warn("[Pipeline] cost-log failed:", e.message));
   ```
   (If cost-log was previously called from `pipeline.ts` instead of inside this function, leave the call there per Plan 04's wiring and skip this step. Read pipeline.ts to see which side owns the call after Plan 04.)

8. **Add Vitest tests** covering the five behaviors. Use `vi.mock("@/lib/ai/clients", () => ({ getAnthropic: () => mockClient }))` to inject a stub Anthropic client; `mockClient.messages.create` returns the canned Message shape per test case. Use `vi.mock("@/lib/ai/with-timeout", ...)` to spy on the call. Use `vi.mock("@/lib/observability", ...)` to spy on captureError. Use `vi.mock("@/lib/ai/log-model-cost", ...)` to spy on logModelCost.

After all deletions, the function body should be measurably shorter — roughly the lines 100-225 block collapses to ~70 lines. Run `wc -l campanha-ia/src/lib/ai/sonnet-copywriter.ts` before and after; expect the file to shrink by ~80-100 lines (the deleted inline timeout + retry + regex parse + manual fallback) but grow by the schema + tool definition (~80 lines from Task 1), netting roughly even.

Critical AI-SPEC §3 pitfall #3: `tool_choice: { type: "tool", name: "..." }` prefills the assistant turn — the model emits ONLY `tool_use` blocks, no leading text. If the existing system prompt has "explain your reasoning" instructions, those become inert. Per AI-SPEC: this is acceptable for D-16 because reasoning was never logged anyway, but if the prompt has reasoning-elicitation language, mention it in the SUMMARY.md as a follow-up consideration.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; npx vitest run src/lib/ai/sonnet-copywriter.test.ts --reporter=basic &amp;&amp; bash -c '! grep -q "JSON.parse(cleaned" src/lib/ai/sonnet-copywriter.ts &amp;&amp; ! grep -q "function callWithTimeout" src/lib/ai/sonnet-copywriter.ts'</automated>
  </verify>
  <done>generateCopyWithSonnet uses tool_use + Zod boundary; legacy callWithTimeout/isRetryable/retry-loop/regex-parse/complete-fallback blocks all DELETED; cost-log call carries promptVersion + real token usage; tests pass 5/5 (Task 1 baseline + 5 new); pipeline.ts:218-237 still catches SonnetInvalidOutputError and provides default dicas (verify by reading that block — do not modify it).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Anthropic API → application | Untrusted external content; previously parsed by regex (silently masking drift), now constrained by tool_choice + validated by Zod |
| tool_use.input → SonnetDicasPostagem | The Zod boundary; AI-SPEC §3 pitfall #4 enforces NEVER `as MyType`, ALWAYS `Schema.parse` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Tampering | Model emits malformed output (silent schema drift) | mitigate | Zod safeParse at the boundary throws SonnetInvalidOutputError; captureError surfaces to Sentry; pipeline.ts:218-237 fallback prevents campaign failure |
| T-05-02 | Information Disclosure | Sentry payload contains raw tool_use.input on Zod failure | accept | input contains marketing copy + lojista form data already on the upstream Sentry breadcrumb (store_id, campaign_id) per AI-SPEC §4b.1; no PII beyond what Sentry already captures |
| T-05-03 | DoS | Anthropic SDK timeout default is 10 minutes (AI-SPEC §3 pitfall #2) | mitigate | withTimeout(promise, 30_000, "Sonnet Copy") wraps every call; AITimeoutError flows through pipeline error handling |
| T-05-04 | Repudiation | Schema retry on Zod failure burns money without changing outcome (AI-SPEC §4b.1) | mitigate | Throw SonnetInvalidOutputError immediately; do NOT retry on schema failures; SDK retry only handles transport errors |
| T-05-05 | Elevation of Privilege | Tool definition includes `description` that the model could be jailbroken to ignore | accept | Even if jailbroken, output still passes through tool_use → Zod boundary; jailbreak that produces invalid schema fails closed |
</threat_model>

<verification>
1. `cd campanha-ia &amp;&amp; npx tsc --noEmit` returns zero errors.
2. `cd campanha-ia &amp;&amp; npx vitest run src/lib/ai/sonnet-copywriter.test.ts` passes 5+ tests.
3. `cd campanha-ia &amp;&amp; npm test -- --run` exits 0 (existing pipeline tests still green).
4. `grep -c "JSON.parse(cleaned\\|function callWithTimeout\\|function isRetryable" campanha-ia/src/lib/ai/sonnet-copywriter.ts` returns 0 (all three legacy patterns deleted).
5. `grep -c "tool_choice:.*type:.*tool.*name:.*generate_dicas_postagem" campanha-ia/src/lib/ai/sonnet-copywriter.ts` returns 1.
6. `grep -c "SonnetDicasPostagemSchema.safeParse(toolBlock.input)" campanha-ia/src/lib/ai/sonnet-copywriter.ts` returns 1.
7. `grep -c "captureError" campanha-ia/src/lib/ai/sonnet-copywriter.ts` returns ≥2 (no-tool-block path + Zod-failure path).
8. Manual smoke: trigger one campaign generation; copy comes back with the expected fields. Then artificially break the schema (e.g., locally edit the tool description to encourage extra fields) and confirm the failure path: SonnetInvalidOutputError appears in Sentry with `extra.stop_reason` AND `pipeline.ts:218-237` fallback delivers a default dicas so the campaign still completes.
</verification>

<success_criteria>
- generateCopyWithSonnet uses tool_use + Zod boundary; no regex JSON parse remains.
- Inline timeout/retry blocks deleted; SDK + withTimeout are the only timeout/retry layers.
- SonnetInvalidOutputError calls captureError on both the no-tool-block path and the Zod-failure path.
- pipeline.ts:218-237 fallback still catches the error and provides default dicas (verified by reading the block).
- Vitest covers happy path + both failure paths + withTimeout invocation + logModelCost invocation.
- File size measurably reduced (legacy parsing/retry blocks gone); functional surface preserved (`generateCopyWithSonnet` signature unchanged from caller's perspective).
</success_criteria>

<output>
After completion, create `.planning/phases/01-ai-pipeline-hardening/01-05-SUMMARY.md` documenting:
- Lines deleted (regex parse, inline timeout, hand-rolled retry, complete fallback) with the original line ranges.
- The new tool definition's input_schema field list (so Phase 2 can compare to the rubric without re-reading the file).
- Confirmation that pipeline.ts:218-237 fallback was NOT modified (it must still be in place — D-16 explicitly preserves it).
- Any prompt-language follow-up flagged by AI-SPEC §3 pitfall #3 (reasoning-elicitation language now inert under tool_choice).
</output>
