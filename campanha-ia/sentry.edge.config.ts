import * as Sentry from "@sentry/nextjs";

// Edge runtime (middleware): config minimal, sem Node APIs
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV || "development",
  sendDefaultPii: false,

  ignoreErrors: ["AbortError", "The user aborted a request"],

  beforeSend(event) {
    // No edge, só redact headers óbvios (sem recursão cara)
    if (event.request?.headers) {
      const redacted: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        redacted[k] = /authorization|cookie|token|secret/i.test(k)
          ? "[redacted]"
          : String(v);
      }
      event.request.headers = redacted;
    }
    return event;
  },
});
