---
phase: 01-ai-pipeline-hardening
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - campanha-ia/src/lib/ai/with-timeout.ts
  - campanha-ia/src/lib/ai/with-timeout.test.ts
  - campanha-ia/src/lib/ai/gemini-error-handler.ts
autonomous: true
requirements: [D-17]
user_setup: []

must_haves:
  truths:
    - "Every Gemini call (analyzer, VTO, backdrop, model-preview) has a deadline; a hung Gemini API call cannot consume the entire 300s Vercel route budget"
    - "Default timeout is 30s for non-VTO calls and 90s for VTO calls (D-17 spec)"
    - "AITimeoutError carries retryable=true so callGeminiSafe's existing retry loop gives the timed-out call a second attempt"
    - "Timed-out timers are cleared in .finally() so vitest does not hang on open handles"
  artifacts:
    - path: "campanha-ia/src/lib/ai/with-timeout.ts"
      provides: "withTimeout<T>(promise, ms, label) generic + AITimeoutError class"
      exports: ["withTimeout", "AITimeoutError"]
    - path: "campanha-ia/src/lib/ai/with-timeout.test.ts"
      provides: "Vitest coverage of resolve-before-timeout, reject-on-timeout, timer-cleared-on-resolve"
  key_links:
    - from: "campanha-ia/src/lib/ai/gemini-error-handler.ts callGeminiSafe (line 190)"
      to: "campanha-ia/src/lib/ai/with-timeout.ts withTimeout"
      via: "withTimeout(fn(), timeoutMs, label) wrapping the per-attempt invocation"
      pattern: "withTimeout\\(fn\\(\\)"
---

<objective>
Land the generic `withTimeout` Promise.race wrapper (D-17) and inject it into `callGeminiSafe` so every existing Gemini call site (analyzer, VTO, backdrop, model-preview) inherits a deadline without changing its signature. Today, a hung Gemini API call has no upper bound until the SDK's own 10-minute timeout (which is far above the route's 300s `maxDuration` cap), so a single slow call silently eats the full request budget and surfaces as a Vercel 504 with no diagnostic.

Purpose: The audit finding is that `sonnet-copywriter.ts:139-167` already has a hand-rolled `callWithTimeout` but it is local to that file and not used for Gemini. D-17 says: extract it as a generic, wire into `callGeminiSafe` once, and let every Gemini call site benefit. Defaults locked by CONTEXT.md `<specifics>`: 30s analyzer, 90s VTO. The Sonnet copywriter file's own inline wrapper is removed in Plan 05 (D-16 migration); this plan only owns the Gemini path.

Output: `with-timeout.ts` module with `AITimeoutError` class; vitest coverage; `gemini-error-handler.ts:190` `callGeminiSafe` wraps `fn()` in `withTimeout`; default selection logic uses `label.includes("VTO")` to pick 90s vs 30s per AI-SPEC §4.2.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@campanha-ia/src/lib/ai/gemini-error-handler.ts
@campanha-ia/src/lib/ai/sonnet-copywriter.ts

<interfaces>
<!-- Existing callGeminiSafe surface — DO NOT change the public signature. The new timeoutMs option is additive with sane defaults. -->

From campanha-ia/src/lib/ai/gemini-error-handler.ts (lines 175-230, current state):
```ts
interface CallGeminiOptions {
  maxRetries?: number;     // default 2
  backoffMs?: number;      // default 2000
  label?: string;          // default "Gemini"
}

export async function callGeminiSafe<T>(
  fn: () => Promise<T>,
  options: CallGeminiOptions = {},
): Promise<T>;
```

Existing call sites (do not touch in this plan; they pick up the timeout for free):
- `campanha-ia/src/lib/ai/gemini-analyzer.ts` — `callGeminiSafe(() => ai.models.generateContent(...), { label: "Analyzer", maxRetries: 2 })`
- `campanha-ia/src/lib/ai/gemini-vto-generator.ts` — `callGeminiSafe(() => ..., { label: "VTO #1" })` etc.
- `campanha-ia/src/lib/ai/backdrop-generator.ts` — `callGeminiSafe(() => ..., { label: "Backdrop" })`

The label-based timeout selection (90s for VTO, 30s otherwise) is intentional per AI-SPEC §4.2 — VTO call sites already pass labels containing "VTO".

Existing inline pattern at sonnet-copywriter.ts:139-167 (reference only — DO NOT extract from there in this plan; Plan 05 / D-16 deletes that block):
```ts
async function callWithTimeout(timeoutMs: number): Promise<Anthropic.Message> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Sonnet timeout (${timeoutMs}ms)`)), timeoutMs),
  );
  return Promise.race([callSonnet(), timeoutPromise]);
}
```
The new `withTimeout` is materially different (clears the timer in .finally, throws a typed AITimeoutError, generic over T) — write fresh from AI-SPEC §4.2, do not copy from sonnet-copywriter.ts.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create with-timeout.ts module + AITimeoutError class</name>
  <files>campanha-ia/src/lib/ai/with-timeout.ts, campanha-ia/src/lib/ai/with-timeout.test.ts</files>
  <behavior>
    - Promise that resolves before timeout: `withTimeout(Promise.resolve(42), 100, "test")` → resolves to 42.
    - Promise that exceeds timeout: `withTimeout(new Promise(r =&gt; setTimeout(() =&gt; r(1), 50)), 10, "slow")` → rejects with AITimeoutError where `.label === "slow"`, `.timeoutMs === 10`, `.code === "AI_TIMEOUT"`, `.retryable === true`.
    - Timer is cleared on resolve: spy on global `clearTimeout`; resolve the inner promise immediately and assert clearTimeout was called once. Prevents the "open handle" warning that would otherwise hang vitest.
    - userMessage is the PT-BR string from AI-SPEC §4.2: "A IA demorou demais para responder. Tente novamente."
  </behavior>
  <action>Lift the `withTimeout` and `AITimeoutError` definitions from `.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md` §4.2 lines 463-482 EXACTLY as written. The file content is:

```ts
// campanha-ia/src/lib/ai/with-timeout.ts
export class AITimeoutError extends Error {
  readonly code = "AI_TIMEOUT" as const;
  readonly retryable = true;
  readonly userMessage = "A IA demorou demais para responder. Tente novamente.";
  constructor(public readonly label: string, public readonly timeoutMs: number) {
    super(`[${label}] timeout after ${timeoutMs}ms`);
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AITimeoutError(label, timeoutMs)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
```

Then write `with-timeout.test.ts` covering all four behaviors above. Use Vitest's `vi.useFakeTimers()` for the second test (fast-forward time without actually waiting). Use `vi.spyOn(global, "clearTimeout")` for the third test. Reset timers between tests with `vi.useRealTimers()` in `afterEach`. Match the import + describe/it style of `campanha-ia/src/lib/payments/google-play.test.ts`.

Why this signature is locked (do not modify): downstream Plan 05 (D-16) will pass an Anthropic SDK promise into `withTimeout(client.messages.create({...}), 30_000, "Sonnet Copy")` — same generic shape. Changing the signature breaks that contract.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx vitest run src/lib/ai/with-timeout.test.ts --reporter=basic</automated>
  </verify>
  <done>Both files exist, tests pass 4/4, `AITimeoutError` exports `code`/`retryable`/`userMessage`/`label`/`timeoutMs` fields, `withTimeout` is generic over T, timer is cleared on both resolve and reject paths.</done>
</task>

<task type="auto">
  <name>Task 2: Wire withTimeout into callGeminiSafe with label-based defaults</name>
  <files>campanha-ia/src/lib/ai/gemini-error-handler.ts</files>
  <action>Modify `callGeminiSafe` at `campanha-ia/src/lib/ai/gemini-error-handler.ts:190-230` per AI-SPEC §4.2 lines 487-509. Specifically:

1. Add `import { withTimeout } from "./with-timeout";` to the top of the file.
2. Extend the `CallGeminiOptions` interface (lines 175-182) with one new optional field:
   ```ts
   /** Timeout in ms; defaults to 90_000 if label includes "VTO", else 30_000 (D-17). */
   timeoutMs?: number;
   ```
3. Inside `callGeminiSafe`, after destructuring options (line 194), compute the default and override the `fn()` invocation inside the for-loop:
   ```ts
   const {
     maxRetries = 2,
     backoffMs = 2000,
     label = "Gemini",
     timeoutMs = label.includes("VTO") ? 90_000 : 30_000,
   } = options;
   ```
   Then change line 200 from:
   ```ts
   return await fn();
   ```
   to:
   ```ts
   return await withTimeout(fn(), timeoutMs, label);
   ```
4. Critical: the existing classify/retry logic at lines 201-223 must be untouched — `AITimeoutError.retryable === true` makes it flow through the existing retry path naturally (the for-loop catches, classifies as retryable, backs off, retries). DO NOT add a special-case branch for AITimeoutError.

5. Verify with `grep -n "withTimeout\\|timeoutMs" campanha-ia/src/lib/ai/gemini-error-handler.ts` — should show the import + the destructure default + the wrapped fn call.

DO NOT change any call site (`gemini-analyzer.ts`, `gemini-vto-generator.ts`, `backdrop-generator.ts`). They pass labels like "Analyzer", "VTO #1", "Backdrop" already; the label-based default selects the right timeout automatically. The route maxDuration of 300s gives 3.3x headroom over the 90s VTO timeout, so a single Gemini hang surfaces as a clean retryable error instead of a Vercel 504 (per AI-SPEC §4b.5 latency budget).</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; grep -c "withTimeout(fn()" src/lib/ai/gemini-error-handler.ts</automated>
  </verify>
  <done>TypeScript compiles. `callGeminiSafe` wraps the per-attempt `fn()` in `withTimeout` with label-based default (90s if "VTO" in label, else 30s). The retry/classify loop is untouched; `AITimeoutError` flows through it via `retryable=true`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Application → Gemini API (HTTPS) | Untrusted external service whose latency is the threat being mitigated |
| Async timer scheduler → Promise.race | Internal — the threat here is resource leakage (uncleared timers), not security |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Denial of Service | Hung Gemini call consumes 300s route budget | mitigate | This plan IS the mitigation — `withTimeout` caps every Gemini call at 30s/90s, well below `maxDuration = 300` |
| T-02-02 | Denial of Service | Uncleared setTimeout leaks per request | mitigate | `.finally(() => if (timer) clearTimeout(timer))` covers both resolve and reject paths; vitest test asserts clearTimeout is called |
| T-02-03 | Denial of Service | Race-condition leak: timeout wins but underlying fetch keeps running | accept | AI-SPEC §4b.2 documents this: bounded by Vercel `maxDuration`, not a process-level leak in production. Future hardening (AbortController + signal) is flagged in §4b.2 but out of scope this phase |
| T-02-04 | Information Disclosure | AITimeoutError.message contains the label string | accept | Labels are application-controlled constants ("Analyzer", "VTO #1") — never user input — so no PII or secret can leak into the message |
</threat_model>

<verification>
1. `cd campanha-ia &amp;&amp; npx tsc --noEmit` — zero errors.
2. `cd campanha-ia &amp;&amp; npx vitest run src/lib/ai/with-timeout.test.ts` — 4/4 pass.
3. `grep -c "withTimeout(fn()" campanha-ia/src/lib/ai/gemini-error-handler.ts` returns 1.
4. `grep -c "label.includes(\"VTO\")" campanha-ia/src/lib/ai/gemini-error-handler.ts` returns 1 (the default-selection branch).
5. Manual smoke: temporarily lower the timeout to 1ms and trigger one campaign generation; verify Sentry captures an `AITimeoutError` with the expected label, then revert.
</verification>

<success_criteria>
- `with-timeout.ts` exports `withTimeout` and `AITimeoutError`; tests pass.
- `callGeminiSafe` wraps every per-attempt `fn()` in `withTimeout`; defaults are label-based (30s/90s).
- Zero call-site changes — analyzer/VTO/backdrop/model-preview inherit the timeout for free.
- `AITimeoutError.retryable = true` flows through the existing retry loop without special-casing.
</success_criteria>

<output>
After completion, create `.planning/phases/01-ai-pipeline-hardening/01-02-SUMMARY.md` documenting:
- The exported surface (`withTimeout`, `AITimeoutError`).
- The default-selection rule (`label.includes("VTO") ? 90_000 : 30_000`) so Plan 05 / D-16 knows the VTO bucket already exists.
- A note that the inline `callWithTimeout` at `sonnet-copywriter.ts:139-167` is intentionally NOT removed in this plan — it is removed in Plan 05 when D-16 rewrites that file end-to-end.
</output>
