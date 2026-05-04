/**
 * Phase 02 M-15: Centralized dryRun gating for pipeline side effects.
 *
 * Pipeline code (pipeline.ts + gemini-vto-generator.ts) currently has 5+
 * `if (!input.dryRun) { ... }` gates around DB writes and cost logs. A new
 * fire-and-forget side effect added later can easily skip the gate and leak
 * under dryRun, breaking evals/run.ts which uses dryRun=true to drive the
 * pipeline against golden-set entries.
 *
 * This helper consolidates the gate. Callers wrap any side-effecting block:
 *
 *   await sideEffect(input, async () => {
 *     await supabase.from("api_cost_logs").insert({ ... });
 *   });
 *
 * Under dryRun, returns null and skips fn() entirely. Otherwise, awaits and
 * returns fn()'s value.
 *
 * Intentionally minimal — no retry, no logging, no Sentry. Those concerns
 * are owned by the helpers being wrapped (logModelCost, captureError, etc.).
 *
 * Migration to use this helper is gradual — Plan 02-03 adopts it inside the
 * pipeline-resilience refactor; existing manual gates are not rewritten in
 * a single sweep (low value, high diff churn).
 */

export interface DryRunFlag {
  dryRun?: boolean;
}

export async function sideEffect<T>(
  input: DryRunFlag,
  fn: () => Promise<T>,
): Promise<T | null> {
  if (input.dryRun) return null;
  return await fn();
}
