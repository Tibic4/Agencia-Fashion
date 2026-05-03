// campanha-ia/src/lib/ai/clients.ts
//
// Single source of truth for Anthropic + GoogleGenAI singletons (D-10).
//
// Why centralize:
// - 4 files used to instantiate the same SDKs with subtly different env-var
//   fallback chains and inconsistent error messages (sonnet-copywriter,
//   gemini-analyzer, gemini-vto-generator, backdrop-generator + a dynamic
//   import in inngest/functions.ts). This module collapses them to one
//   factory per provider, one fallback chain, one MissingAIKeyError.
// - Lazy `let _x: T | null = null` (NOT top-level `const new X({})`) so
//   `process.env` is read at first call — safe for Inngest cold starts and
//   Vitest setups where env vars are populated post-import.
// - No `timeout` set on the SDK constructor. Liveness is enforced by the
//   external withTimeout helper (Plan 02). The Anthropic `maxRetries: 2`
//   is the SDK default — declared explicitly to signal intent now that the
//   hand-rolled retry in sonnet-copywriter is being removed in Plan 05.
//
// Env-var fallback (LOCKED by D-10 — both names exist historically):
//   anthropic: ANTHROPIC_API_KEY
//   google:    GOOGLE_AI_API_KEY ?? GEMINI_API_KEY
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
  // maxRetries: 2 is the SDK default — declared explicitly so future readers
  // know it's intentional. Do NOT set `timeout` here — withTimeout (Plan 02)
  // is the liveness mechanism.
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
