---
phase: 01-ai-pipeline-hardening
plan: 02
subsystem: ai
tags: [timeout, gemini, error-handling, D-17]
requires: []
provides:
  - "withTimeout<T>(promise, timeoutMs, label) generic Promise.race wrapper"
  - "AITimeoutError class (code=AI_TIMEOUT, retryable=true, PT-BR userMessage)"
  - "Label-based default timeout selection in callGeminiSafe (90s VTO / 30s other)"
affects:
  - "campanha-ia/src/lib/ai/gemini-analyzer.ts (inherits 30s timeout)"
  - "campanha-ia/src/lib/ai/gemini-vto-generator.ts (inherits 90s timeout via 'VTO' label)"
  - "campanha-ia/src/lib/ai/backdrop-generator.ts (inherits 30s timeout)"
tech-stack:
  added: []
  patterns: ["Promise.race with .finally() timer cleanup", "label-based default options"]
key-files:
  created:
    - campanha-ia/src/lib/ai/with-timeout.ts
    - campanha-ia/src/lib/ai/with-timeout.test.ts
  modified:
    - campanha-ia/src/lib/ai/gemini-error-handler.ts
decisions:
  - "Default timeout selection uses `label.includes('VTO')` ternary (not a separate enum) — keeps zero call-site changes; existing labels already encode the slow/fast distinction."
  - "AITimeoutError flows through the existing classify/retry loop via retryable=true — NO special-case branch added to callGeminiSafe (per plan §Task 2 step 4)."
  - "Pre-commit tsc gate forced TDD RED+GREEN to land in a single commit — RED was verified locally before writing the implementation; recorded in commit message rather than as a separate gate commit."
metrics:
  duration: ~7min
  completed: 2026-05-03
  tasks: 2
  commits: 2
---

# Phase 01 Plan 02: Gemini Timeout Hardening (D-17) Summary

`withTimeout<T>` generic + `AITimeoutError` lifted from AI-SPEC §4.2 into shared module; wired into `callGeminiSafe` so every Gemini call (analyzer 30s / VTO 90s / backdrop 30s / model-preview 30s) inherits a deadline well below Vercel's 300s `maxDuration`, eliminating the silent 504 path on hung Gemini calls.

## Tasks Executed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Create with-timeout.ts module + AITimeoutError class (TDD) | `830284d` | Done — 5/5 tests pass |
| 2 | Wire withTimeout into callGeminiSafe with label-based defaults | `5f8abd1` | Done — tsc clean, grep counts match |

## Exported Surface

`campanha-ia/src/lib/ai/with-timeout.ts`:

```ts
export class AITimeoutError extends Error {
  readonly code = "AI_TIMEOUT" as const;
  readonly retryable = true;
  readonly userMessage = "A IA demorou demais para responder. Tente novamente.";
  constructor(public readonly label: string, public readonly timeoutMs: number);
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T>;
```

Same shape Plan 05 (D-16) will use for `withTimeout(client.messages.create({...}), 30_000, "Sonnet Copy")`. **Do not change this signature without coordinating with Plan 05.**

## Default-Selection Rule

In `gemini-error-handler.ts#callGeminiSafe`:

```ts
timeoutMs = label.includes("VTO") ? 90_000 : 30_000
```

Caller-overridable via `options.timeoutMs`. Picks 90s for any VTO bucket (matches existing call-site labels `"VTO #1"`, `"VTO #2"`, etc. in `gemini-vto-generator.ts`); 30s for everything else (`"Analyzer"`, `"Backdrop"`, `"Gemini"` default). The retry/classify loop is **unchanged** — `AITimeoutError.retryable=true` flows through `classifyGeminiError`'s existing `msg.includes("timeout")` branch.

## Verification

| Check | Result |
|-------|--------|
| `cd campanha-ia && npx tsc --noEmit` | exit 0 |
| `cd campanha-ia && npx vitest run src/lib/ai/with-timeout.test.ts` | 5/5 pass, 17ms |
| `grep -c "withTimeout(fn()" campanha-ia/src/lib/ai/gemini-error-handler.ts` | 1 |
| `grep -c 'label.includes("VTO")' campanha-ia/src/lib/ai/gemini-error-handler.ts` | 1 |
| Manual smoke (revert) | Skipped — out of scope; covered by Sentry integration in Plan 01-07 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Pre-commit tsc gate prevented standalone TDD RED commit**

- **Found during:** Task 1, attempting RED gate commit
- **Issue:** Repo's `pre-commit` hook runs `tsc --noEmit` before every commit. The RED gate test file imports `./with-timeout` which doesn't exist at RED time → `tsc` fails with `Cannot find module` → commit rejected.
- **Fix:** Wrote RED tests first, verified they fail under vitest (`Cannot find module './with-timeout'`), then wrote the implementation, ran vitest again to confirm GREEN (5/5), then committed both files together as the GREEN commit. The RED gate is documented in the commit message rather than as a separate commit. This is a TDD-vs-tsc-gate friction, not a semantic deviation — the test was demonstrably failing before the implementation existed.
- **Files modified:** none additional
- **Commit:** `830284d` (commit message documents the RED gate verification)

**2. [Test count] Wrote 5 tests instead of 4**

- **Found during:** Task 1 RED phase
- **Issue:** Plan §Task 1 lists 4 behaviors (resolve, reject, timer-cleared-on-resolve, userMessage). I split AITimeoutError field assertions into a dedicated `describe("AITimeoutError")` block (1 test) and added an additional `timer-cleared-on-reject` test (covers symmetry of the `.finally()` cleanup).
- **Why:** The plan's `<done>` criterion requires "timer is cleared on both resolve and reject paths"; without a reject-path test there's no automated assertion that this holds. The userMessage assertion lives inside the AITimeoutError describe block, so all 4 named behaviors are still covered.
- **Net:** strict superset of plan coverage, no behavior change.

### Auto-fixed bugs

None. The reference `withTimeout` implementation lifted verbatim from AI-SPEC §4.2 worked first-try.

### Concurrency observations

- Plan 01-01 ran in parallel and landed `prompt-version.ts` mid-execution. A transient `tsc` error (`Cannot find module './prompt-version'` from `prompt-version.test.ts`) was visible during Task 2 verification but resolved itself before final verification. Documented in `deferred-items.md`. **No file-level conflict** — 01-01 touched `prompt-version*` files and (per its plan) cost-logger files; 01-02 only touched `with-timeout*` and `gemini-error-handler.ts`. Used **Edit (not Write)** on the existing `gemini-error-handler.ts` so any concurrent additions would have been preserved (none were needed).

## Authentication Gates

None — purely internal refactor, no external service touched.

## Known Stubs

None.

## TDD Gate Compliance

- RED gate (vitest reports missing module): verified locally before implementation, documented in commit `830284d` message body.
- GREEN gate (`feat(ai): add withTimeout...`): commit `830284d` — 5/5 tests pass.
- REFACTOR gate: not needed — implementation is the verbatim AI-SPEC §4.2 reference.
- **Note:** The pre-commit `tsc --noEmit` gate enforces a green compile tree at all times, which means a literal RED commit (broken imports) is structurally impossible in this repo. RED is verified at the test runner level before each GREEN commit, not as a separate commit.

## Follow-ups for Other Plans

| For Plan | What it should know |
|----------|---------------------|
| **01-04 (logModelCost)** | The 30s/90s timeout buckets are now in place. When wiring cost logging, you can add a `timeoutMs` row to the cost log payload from the same `options` destructure if useful for diagnosis. |
| **01-05 (Sonnet tool use)** | The signature `withTimeout(promise, ms, label)` is locked. Reuse it directly instead of porting `sonnet-copywriter.ts:139-167`'s inline `callWithTimeout`. |
| **All Wave 2/3 plans** | `AITimeoutError` is exported and `instanceof`-checkable. Sentry integration in 01-07 should special-case `AITimeoutError` for tagging (`ai.timeout=true`, `ai.label=<label>`). |

## Intentionally NOT Done

The inline `callWithTimeout` at `campanha-ia/src/lib/ai/sonnet-copywriter.ts:139-167` is **intentionally untouched** — it is removed by Plan 05 (D-16) when the Sonnet copywriter is rewritten end-to-end with tool-use. Removing it now would leave the file in a half-migrated state and conflict with Plan 05's diff.

## Self-Check: PASSED

- `campanha-ia/src/lib/ai/with-timeout.ts` — FOUND
- `campanha-ia/src/lib/ai/with-timeout.test.ts` — FOUND
- `campanha-ia/src/lib/ai/gemini-error-handler.ts` — FOUND (modified)
- Commit `830284d` (Task 1) — FOUND
- Commit `5f8abd1` (Task 2) — FOUND
- `withTimeout(fn()` count in gemini-error-handler.ts: 1 (matches plan)
- `label.includes("VTO")` count in gemini-error-handler.ts: 1 (matches plan)
- vitest: 5/5 pass; tsc --noEmit: exit 0
