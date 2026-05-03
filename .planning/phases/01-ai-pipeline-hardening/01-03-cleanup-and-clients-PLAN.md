---
phase: 01-ai-pipeline-hardening
plan: 03
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - campanha-ia/package.json
  - campanha-ia/package-lock.json
  - campanha-ia/src/lib/ai/clients.ts
  - campanha-ia/src/lib/ai/sonnet-copywriter.ts
  - campanha-ia/src/lib/ai/gemini-analyzer.ts
  - campanha-ia/src/lib/ai/gemini-vto-generator.ts
  - campanha-ia/src/lib/ai/backdrop-generator.ts
  - campanha-ia/src/lib/inngest/functions.ts
  - campanha-ia/src/lib/google/nano-banana.ts
  - campanha-ia/src/lib/fal/client.ts
  - campanha-ia/src/lib/ai/mock-data.ts
autonomous: true
requirements: [D-07, D-08, D-09, D-10]
user_setup: []

must_haves:
  truths:
    - "fashn package is no longer listed in campanha-ia/package.json"
    - "lib/google/nano-banana.ts and lib/fal/client.ts are deleted (zero callers verified before delete)"
    - "Inngest generateCampaignJob deprecated stub is deleted from lib/inngest/functions.ts"
    - "lib/ai/mock-data.ts disposition is documented (deleted if zero non-test callers, kept with header comment otherwise)"
    - "All Anthropic + Google client instantiation flows through lib/ai/clients.ts (getAnthropic, getGoogleGenAI)"
    - "MissingAIKeyError is thrown from one place, not four"
  artifacts:
    - path: "campanha-ia/src/lib/ai/clients.ts"
      provides: "Single source of truth for Anthropic + GoogleGenAI singletons + MissingAIKeyError"
      exports: ["getAnthropic", "getGoogleGenAI", "MissingAIKeyError", "__resetAIClientsForTests"]
  key_links:
    - from: "campanha-ia/src/lib/ai/sonnet-copywriter.ts (was: getClient at line 57)"
      to: "campanha-ia/src/lib/ai/clients.ts getAnthropic"
      via: "import { getAnthropic } from \"./clients\""
      pattern: "getAnthropic\\(\\)"
    - from: "campanha-ia/src/lib/ai/gemini-analyzer.ts, gemini-vto-generator.ts, backdrop-generator.ts (were: local getAI singletons)"
      to: "campanha-ia/src/lib/ai/clients.ts getGoogleGenAI"
      via: "import { getGoogleGenAI } from \"./clients\""
      pattern: "getGoogleGenAI\\(\\)"
    - from: "campanha-ia/src/lib/inngest/functions.ts (was: dynamic import @google/genai)"
      to: "campanha-ia/src/lib/ai/clients.ts getGoogleGenAI"
      via: "static import { getGoogleGenAI } from \"@/lib/ai/clients\""
      pattern: "from .@/lib/ai/clients"
---

<objective>
Execute the four cleanup decisions in one coherent pass: (D-07) drop the unused `fashn` npm dependency; (D-08) audit `lib/google/nano-banana.ts` and delete if no live callers; (D-09) audit `lib/ai/mock-data.ts` and the Inngest `generateCampaignJob` deprecated stub, deleting whichever have zero callers; (D-10) collapse the four ad-hoc Anthropic/Google client singletons into one `lib/ai/clients.ts` module per AI-SPEC §4.3. The audit-before-delete grep gates protect against accidental deletion of load-bearing code.

Purpose: The audit found four files using identical "lazy module-level `let _x: T \| null = null`" patterns to instantiate the same SDKs. This duplicates env-var fallback chains (some use `GOOGLE_AI_API_KEY`, others use `GEMINI_API_KEY`, with no shared resolution), produces inconsistent error messages on missing keys, and makes test-time client swapping a per-file maintenance burden. D-10 collapses to one module + one fallback chain + one `MissingAIKeyError`.

Output: One new module (`clients.ts`); five files migrated to import from it; three files (or four) deleted; `package.json` minus `fashn`; `package-lock.json` regenerated for `campanha-ia` (which uses npm normally — NOT the `npm run lock:fix` rule that applies only to `crialook-app`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md
@campanha-ia/src/lib/ai/sonnet-copywriter.ts
@campanha-ia/src/lib/ai/gemini-analyzer.ts
@campanha-ia/src/lib/ai/gemini-vto-generator.ts
@campanha-ia/src/lib/ai/backdrop-generator.ts
@campanha-ia/src/lib/inngest/functions.ts
@campanha-ia/package.json

<interfaces>
<!-- Existing singleton patterns being replaced. Each currently lives at the top of its respective file. -->

From campanha-ia/src/lib/ai/sonnet-copywriter.ts:56-64 (current):
```ts
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  // ...env check + new Anthropic({ apiKey })
  return _client;
}
```

From campanha-ia/src/lib/ai/gemini-analyzer.ts:155-156, gemini-vto-generator.ts:93-94, backdrop-generator.ts:31-32 (all similar):
```ts
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI { /* env check + new GoogleGenAI({ apiKey }) */ }
```

From campanha-ia/src/lib/inngest/functions.ts:78-86 (dynamic-import variant — also being replaced):
```ts
const { GoogleGenAI } = await import("@google/genai");
const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("...");
const ai = new GoogleGenAI({ apiKey });
```

Target replacement (the new lib/ai/clients.ts surface — lifted EXACTLY from AI-SPEC §4.3):
```ts
export class MissingAIKeyError extends Error { /* code: "MISSING_AI_KEY" */ }
export function getAnthropic(): Anthropic;
export function getGoogleGenAI(): GoogleGenAI;
export function __resetAIClientsForTests(): void;
```

Confirmed dead code (already grep-verified):
- `lib/google/nano-banana.ts` — 0 callers in `campanha-ia/src/`.
- `lib/fal/client.ts` — 0 callers in `campanha-ia/src/`.
- `generateCampaignJob` (Inngest stub) — 0 producers send `campaign/generate.requested` event; `functions.ts:330` exports it but only the stub itself references it.

Confirmed LIVE code (must NOT be deleted):
- `lib/ai/mock-data.ts` — imported by `src/app/api/campaign/generate/route.ts:4` (`import { runMockPipeline } from "@/lib/ai/mock-data"`). Document, do not delete.
- `src/lib/model-preview.ts` — imported by `src/app/api/model/regenerate-preview/route.ts:5`. Out of scope this plan; D-08/D-09 do not name it.

`fashn` in package.json — the audit's `<deferred>` confirms `fashn` and `lib/fal/client.ts` are residue from the pre-Gemini provider experiment.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete fashn package + dead-code files (with grep gates)</name>
  <files>campanha-ia/package.json, campanha-ia/package-lock.json, campanha-ia/src/lib/google/nano-banana.ts, campanha-ia/src/lib/fal/client.ts, campanha-ia/src/lib/inngest/functions.ts, campanha-ia/src/lib/ai/mock-data.ts</files>
  <action>Execute four delete operations, each gated by a grep verification. **If any grep gate finds a live caller, STOP that sub-step and report — do not delete.**

Sub-step 1.1 — D-07: drop the `fashn` package.
- From `campanha-ia/`: `npm uninstall fashn` (campanha-ia uses npm normally; do NOT use `npm run lock:fix` — that's the crialook-app rule per auto-memory `project_eas_npm_lock.md`).
- Verify removal: `grep -c "\"fashn\"" campanha-ia/package.json campanha-ia/package-lock.json` should return `0` for both files (or `package.json:0` + a small number from package-lock.json transitively — if the latter, run `npm install` once to fully sync).
- Verify zero source references: `grep -rn "from .fashn\\|require(.fashn" campanha-ia/src/` returns zero hits.

Sub-step 1.2 — D-08: delete `lib/google/nano-banana.ts`.
- Gate: `grep -rn "from .*nano-banana\\|from \"@/lib/google/nano-banana\"\\|require(.*nano-banana" campanha-ia/src/` MUST return zero hits. If any hit appears, STOP — do not delete; instead, append to the SUMMARY.md a note explaining the live caller and leave nano-banana.ts in place.
- If gate passes: `rm campanha-ia/src/lib/google/nano-banana.ts`.

Sub-step 1.3 — D-08 part 2: delete `lib/fal/client.ts` and the empty `lib/fal/` directory.
- Gate: `grep -rn "from .*lib/fal\\|require(.*lib/fal" campanha-ia/src/` MUST return zero hits. If any hit, STOP and document in SUMMARY.md.
- If gate passes: `rm campanha-ia/src/lib/fal/client.ts` and remove the now-empty `lib/fal/` directory.

Sub-step 1.4 — D-09 part 1: delete the Inngest deprecated stub `generateCampaignJob`.
- Gate: `grep -rn "campaign/generate.requested\\|generateCampaignJob" campanha-ia/src/` should return ONLY the file you're about to edit (`src/lib/inngest/functions.ts`) and the export-list line. No producer (`inngest.send({ name: "campaign/generate.requested" })`) should exist anywhere. Confirmed by previous grep — but re-verify before delete.
- Open `campanha-ia/src/lib/inngest/functions.ts`, delete the entire `export const generateCampaignJob = inngest.createFunction({...}, async ({ event }) => {...})` block at lines 22-44 (the `DEPRECATED — nenhum caller em produção` JSDoc + the function), AND remove `generateCampaignJob,` from the exports array at line 330. After delete, run `grep -c "generateCampaignJob" campanha-ia/src/lib/inngest/functions.ts` — should be 0.

Sub-step 1.5 — D-09 part 2: audit `lib/ai/mock-data.ts`.
- Gate (different from delete-gate — this one ALLOWS callers): `grep -rn "from .*lib/ai/mock-data\\|from \"@/lib/ai/mock-data\"" campanha-ia/src/` will return at least one hit (`src/app/api/campaign/generate/route.ts:4` per the pre-verified interfaces section).
- Because `mock-data.ts` IS load-bearing (powers the dev/test mock pipeline path in `route.ts`), do NOT delete. Instead, prepend this header comment to `lib/ai/mock-data.ts` (above the existing `import` block):
  ```ts
  /**
   * MOCK PIPELINE — used by /api/campaign/generate when MOCK=1 env flag is set.
   * Kept in repo because route.ts:4 imports runMockPipeline for local dev / E2E.
   * If you change the real pipeline shape (pipeline.ts), keep this in sync OR
   * delete + remove the route.ts:4 import together (D-09 audit, Phase 01-03).
   */
  ```

After all five sub-steps: run `cd campanha-ia &amp;&amp; npx tsc --noEmit` to confirm nothing else broke. Run `cd campanha-ia &amp;&amp; npm test -- --run` to confirm test suite is green (some tests may import the deleted files — if so, also delete those test files and document in SUMMARY.md).</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; ! grep -q "\"fashn\"" package.json &amp;&amp; ! test -f src/lib/google/nano-banana.ts &amp;&amp; ! test -f src/lib/fal/client.ts &amp;&amp; ! grep -q "generateCampaignJob" src/lib/inngest/functions.ts &amp;&amp; grep -q "MOCK PIPELINE" src/lib/ai/mock-data.ts</automated>
  </verify>
  <done>fashn removed from package.json + lock; nano-banana.ts deleted; fal/client.ts deleted; generateCampaignJob block removed from functions.ts (both definition and exports-array entry); mock-data.ts retained with the documented header comment; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Create lib/ai/clients.ts consolidated singleton module</name>
  <files>campanha-ia/src/lib/ai/clients.ts</files>
  <action>Create `campanha-ia/src/lib/ai/clients.ts` by lifting the code from `.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md` §4.3 lines 515-552 EXACTLY. The full file content is:

```ts
// campanha-ia/src/lib/ai/clients.ts
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export class MissingAIKeyError extends Error {
  readonly code = "MISSING_AI_KEY" as const;
  constructor(provider: "anthropic" | "google", envVars: string[]) {
    super(`[${provider}] missing API key. Set one of: ${envVars.join(", ")}`);
  }
}

let _anthropic: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingAIKeyError("anthropic", ["ANTHROPIC_API_KEY"]);
  // maxRetries: 2 is the SDK default — declared explicitly so future readers know it's intentional.
  // Do NOT set `timeout` here — we use external withTimeout for liveness.
  _anthropic = new Anthropic({ apiKey, maxRetries: 2 });
  return _anthropic;
}

let _google: GoogleGenAI | null = null;
export function getGoogleGenAI(): GoogleGenAI {
  if (_google) return _google;
  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new MissingAIKeyError("google", ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"]);
  _google = new GoogleGenAI({ apiKey });
  return _google;
}

// Test-only escape hatch — vitest can swap clients in setupFiles.
export function __resetAIClientsForTests(): void {
  _anthropic = null;
  _google = null;
}
```

Per AI-SPEC §3 pitfall #5: keep the lazy `let _x: T | null = null` pattern (NOT top-level `const new Anthropic({})` — that evaluates at import time before `process.env` is hydrated in some Inngest cold-start / vitest paths). Per AI-SPEC §3 pitfall #2: do NOT set `timeout` on the SDK constructor — Plan 02's `withTimeout` is the liveness mechanism. The Anthropic constructor's `maxRetries: 2` is the SDK default but declared explicitly to signal intent (the hand-rolled retry at `sonnet-copywriter.ts:151-167` is removed in Plan 05 / D-16, leaving the SDK retry as the only retry layer).

The env-var fallback `GOOGLE_AI_API_KEY ?? GEMINI_API_KEY` is locked by D-10 — both names exist in the codebase historically, and removing either would break some envs.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit src/lib/ai/clients.ts &amp;&amp; grep -c "export function getAnthropic\\|export function getGoogleGenAI\\|export class MissingAIKeyError\\|export function __resetAIClientsForTests" src/lib/ai/clients.ts</automated>
  </verify>
  <done>File exists; exports `getAnthropic`, `getGoogleGenAI`, `MissingAIKeyError`, `__resetAIClientsForTests`; no `timeout` set on Anthropic constructor; lazy module-level `let` pattern (not top-level const); tsc clean.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate all 5 callers to import from lib/ai/clients</name>
  <files>campanha-ia/src/lib/ai/sonnet-copywriter.ts, campanha-ia/src/lib/ai/gemini-analyzer.ts, campanha-ia/src/lib/ai/gemini-vto-generator.ts, campanha-ia/src/lib/ai/backdrop-generator.ts, campanha-ia/src/lib/inngest/functions.ts</files>
  <action>Replace every local singleton with an import from `@/lib/ai/clients`. Five files, same mechanical change.

For each Gemini-using file (`gemini-analyzer.ts`, `gemini-vto-generator.ts`, `backdrop-generator.ts`):
1. Delete the `let _ai: GoogleGenAI | null = null;` and `function getAI(): GoogleGenAI { ... }` block (typically 12-15 lines around lines 155-170 in analyzer, 93-110 in vto-generator, 31-50 in backdrop-generator).
2. Delete the `import { GoogleGenAI } from "@google/genai";` import (only delete if `GoogleGenAI` is no longer referenced for typing — if it's still used as a type, change to `import type { GoogleGenAI } from "@google/genai";`).
3. Add `import { getGoogleGenAI } from "@/lib/ai/clients";` at the top.
4. Replace every `getAI()` call site in the file with `getGoogleGenAI()`.

For `sonnet-copywriter.ts`:
1. Delete the `let _client: Anthropic | null = null;` and `function getClient(): Anthropic { ... }` block at lines 56-64.
2. Keep the `import Anthropic from "@anthropic-ai/sdk";` (still needed for types like `Anthropic.Message`).
3. Add `import { getAnthropic } from "@/lib/ai/clients";`.
4. Replace `getClient()` call sites with `getAnthropic()`.

For `inngest/functions.ts`:
1. Find the dynamic-import block at lines 78-86 (`const { GoogleGenAI } = await import("@google/genai"); ... new GoogleGenAI({ apiKey })`).
2. Replace with a static import at the top of the file: `import { getGoogleGenAI } from "@/lib/ai/clients";`.
3. Replace the in-function `new GoogleGenAI({ apiKey })` instantiation with `getGoogleGenAI()`. Drop the inline env-var check (it's now inside `getGoogleGenAI`).

After all five edits, run `grep -rn "new GoogleGenAI\\|new Anthropic\\|process.env.GOOGLE_AI_API_KEY\\|process.env.GEMINI_API_KEY\\|process.env.ANTHROPIC_API_KEY" campanha-ia/src/lib/` — should ONLY return hits inside `campanha-ia/src/lib/ai/clients.ts`. Any hit outside is a missed migration.

Final check: `cd campanha-ia &amp;&amp; npx tsc --noEmit` clean. Run `cd campanha-ia &amp;&amp; npm test -- --run` — must stay green. If tests stub the old `getAI()`/`getClient()` symbols, update them to use `__resetAIClientsForTests()` instead.</action>
  <verify>
    <automated>cd campanha-ia &amp;&amp; npx tsc --noEmit &amp;&amp; bash -c 'hits=$(grep -rln "new GoogleGenAI\\|new Anthropic" src/lib/ | grep -v "src/lib/ai/clients.ts" | wc -l); test "$hits" -eq 0'</automated>
  </verify>
  <done>All 5 caller files import from `@/lib/ai/clients` instead of constructing SDK clients locally. The only `new GoogleGenAI(` and `new Anthropic(` references in `src/lib/` are inside `clients.ts`. No `process.env.*_API_KEY` references in `src/lib/` outside of `clients.ts`. tsc + tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Application → npm registry / installed packages | Removing `fashn` reduces attack surface; no new dependency added |
| Process env → SDK client constructors | API keys are read from env in one place (clients.ts); single audit point |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Tampering | Deleting nano-banana.ts / fal/client.ts could break a live caller | mitigate | Each delete is gated by a `grep -rn` that MUST return zero hits before `rm`; gate failure halts the sub-step and triggers a documented exception |
| T-03-02 | Information Disclosure | API keys read in 4 places → 1 place | mitigate | Centralization shrinks the audit surface; future key-rotation work touches one file |
| T-03-03 | Repudiation | Lazy singleton race: two callers in same tick → two instances | accept | JS event-loop is single-threaded; the `if (_x) return _x` check + assignment is atomic within a tick. Vitest `__resetAIClientsForTests` is the only legitimate way to swap |
| T-03-04 | Elevation of Privilege | Removing the deprecated `generateCampaignJob` removes one Inngest event-handler attack surface | mitigate | Confirmed zero producers; even if a stale legacy client sends `campaign/generate.requested`, Inngest will route to no handler and silently drop |
</threat_model>

<verification>
1. `cd campanha-ia &amp;&amp; npx tsc --noEmit` returns zero errors.
2. `cd campanha-ia &amp;&amp; npm test -- --run` exits 0.
3. `grep -c "\"fashn\"" campanha-ia/package.json` returns 0.
4. `! test -f campanha-ia/src/lib/google/nano-banana.ts &amp;&amp; ! test -f campanha-ia/src/lib/fal/client.ts` (both deleted).
5. `grep -c "generateCampaignJob" campanha-ia/src/lib/inngest/functions.ts` returns 0.
6. `grep -rln "new GoogleGenAI\\|new Anthropic" campanha-ia/src/lib/ | grep -v "src/lib/ai/clients.ts"` returns zero lines.
7. Manual: trigger one campaign generation; verify analyzer/VTO/backdrop/copy all succeed using the consolidated singletons.
</verification>

<success_criteria>
- Four deletion sub-steps complete OR documented as blocked-by-live-caller.
- `lib/ai/clients.ts` exists with the locked surface (`getAnthropic`, `getGoogleGenAI`, `MissingAIKeyError`, `__resetAIClientsForTests`).
- Five caller files migrated; no SDK client constructed outside `clients.ts`.
- `MissingAIKeyError` is throwable from one location, with consistent `code: "MISSING_AI_KEY"`.
- Tests + tsc clean.
</success_criteria>

<output>
After completion, create `.planning/phases/01-ai-pipeline-hardening/01-03-SUMMARY.md` documenting:
- Final disposition of each delete-candidate (deleted vs documented-and-kept) with the exact grep evidence used.
- The consolidated client surface so Plan 05 (D-16 Sonnet rewrite) can `import { getAnthropic } from "@/lib/ai/clients"` without rediscovery.
- Confirmation that `MissingAIKeyError` is thrown from exactly one location.
</output>
