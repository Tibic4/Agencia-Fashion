/**
 * Next.js instrumentation hook — registra Sentry para server e edge runtimes.
 * Required a partir do @sentry/nextjs v8+.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 *
 * Também faz parse das envs no boot via `loadEnv()` — se faltar var
 * obrigatória em produção, o server quebra agora em vez de falhar
 * silenciosamente em runtime no primeiro request à rota afetada.
 */
export async function register() {
  // Validação de envs em ambos os runtimes. Não usa `await import("./lib/env")`
  // pra não pegar paths-aliased no edge bundler — loadEnv é puro Zod, não tem
  // side effects de runtime.
  const { loadEnv } = await import("./lib/env");
  loadEnv();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Sentry v10+: captureRequestError (v8 usava onRequestError)
import * as Sentry from "@sentry/nextjs";
export const onRequestError = Sentry.captureRequestError;
