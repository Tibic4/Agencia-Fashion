/**
 * CriaLook — Generic Promise timeout wrapper (D-17).
 *
 * Por que existe: a Google Gemini SDK tem timeout interno de ~10min, muito
 * acima do `maxDuration = 300s` que a gente declara nas rotas Vercel. Sem
 * um wrapper, uma chamada pendurada come o budget inteiro da rota e vira
 * um 504 silencioso sem diagnóstico.
 *
 * Uso:
 *   await withTimeout(geminiCall(), 30_000, "Analyzer")
 *
 * Wireup principal: `gemini-error-handler.ts#callGeminiSafe` — todas as
 * chamadas Gemini (Analyzer, VTO, Backdrop, model-preview) herdam o
 * deadline sem mudar call sites. Default selection é label-based:
 * "VTO" → 90s, demais → 30s (ver AI-SPEC §4.2).
 *
 * Reuso futuro: Plan 05 (D-16) vai chamar `withTimeout(client.messages.
 * create(...), 30_000, "Sonnet Copy")` direto na migração do copywriter.
 *
 * Limitação conhecida (T-02-03 no threat model do plan 01-02): quando o
 * timeout vence, a fetch subjacente continua rodando até a Vercel encerrar
 * a route. Não é leak de processo em prod (route morre em 300s) mas é uma
 * janela de waste compute. Hardening futuro = AbortController.
 */

export class AITimeoutError extends Error {
  readonly code = "AI_TIMEOUT" as const;
  readonly retryable = true;
  readonly userMessage = "A IA demorou demais para responder. Tente novamente.";
  constructor(
    public readonly label: string,
    public readonly timeoutMs: number,
  ) {
    super(`[${label}] timeout after ${timeoutMs}ms`);
  }
}

/**
 * Race uma Promise contra um timeout. Se o timeout vence, rejeita com
 * `AITimeoutError` (retryable=true → callGeminiSafe vai tentar de novo
 * via fluxo existente). O timer é sempre limpo via `.finally()` pra não
 * vazar handles (vitest reclama; Node em produção não tanto, mas é higiene).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AITimeoutError(label, timeoutMs)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
