/**
 * Observability — logger estruturado + wrapper do Sentry.
 *
 * Uso:
 *   import { logger, captureError } from "@/lib/observability";
 *   try { ... } catch (e) { captureError(e, { route: "checkout", userId }); throw e; }
 *   logger.info("payment_received", { amount, plan });
 */
import * as Sentry from "@sentry/nextjs";

type Ctx = Record<string, unknown>;

function log(level: "debug" | "info" | "warn" | "error", msg: string, ctx?: Ctx) {
  // Em produção, reduz verbosidade de debug
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const timestamp = new Date().toISOString();
  const line = ctx ? `${timestamp} [${level}] ${msg}  ${JSON.stringify(ctx)}` : `${timestamp} [${level}] ${msg}`;
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Ctx) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Ctx) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Ctx) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Ctx) => log("error", msg, ctx),
};

/**
 * Captura uma exception no Sentry com contexto extra.
 * Chame em catches de operações críticas (webhook, checkout, campaign/generate).
 */
export function captureError(err: unknown, ctx: Ctx = {}): void {
  try {
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(ctx)) {
        scope.setExtra(k, v);
      }
      if (err instanceof Error) {
        Sentry.captureException(err);
      } else {
        Sentry.captureException(new Error(String(err)));
      }
    });
  } catch {
    // Nunca deixar o logger quebrar a app
  }
  // Também loga no console para debug local
  logger.error(err instanceof Error ? err.message : String(err), ctx);
}

/**
 * Atribui identidade do usuário ao scope do Sentry (para filtrar erros por user).
 * NÃO passar email — só userId (Clerk) + storeId.
 */
export function identifyForSentry(userId: string | null, storeId?: string | null): void {
  try {
    if (userId) {
      Sentry.setUser({ id: userId, store_id: storeId ?? undefined });
    } else {
      Sentry.setUser(null);
    }
  } catch {
    /* noop */
  }
}
