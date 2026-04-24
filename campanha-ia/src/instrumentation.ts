/**
 * Next.js instrumentation hook — registra Sentry para server e edge runtimes.
 * Required a partir do @sentry/nextjs v8+.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
export async function register() {
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
