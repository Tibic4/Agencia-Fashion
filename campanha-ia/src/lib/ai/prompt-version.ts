// campanha-ia/src/lib/ai/prompt-version.ts
//
// D-15 (AI Pipeline Hardening, Phase 01): produce a stable, short identifier
// for a given system-prompt string so every api_cost_logs row can carry
// `metadata.prompt_version`. With this in place, "did Tuesday's prompt edit
// cause Friday's quality dip?" becomes a single SQL query instead of an
// archaeology dig through git history.
import crypto from "node:crypto";

/**
 * 12-char hex SHA-256 prefix of a system prompt.
 *
 * Stored in api_cost_logs.metadata.prompt_version so we can correlate
 * cost/quality regressions to specific prompt revisions.
 *
 * Computed once at module load by callers (cache the constant), NOT per-call:
 *   const SONNET_PROMPT_VERSION = computePromptVersion(SYSTEM_PROMPT);
 *
 * The function itself is pure — no module-level memo here on purpose, so
 * each prompt-owning module owns its own constant and there is no shared
 * cache to invalidate when prompts change.
 */
export function computePromptVersion(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 12);
}
