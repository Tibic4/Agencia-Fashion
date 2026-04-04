import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: captura 20% das transações
  tracesSampleRate: 0.2,

  // Replay: captura sessões com erro
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Ambiente
  environment: process.env.NODE_ENV || "development",

  // Filtros
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    "Load failed",
  ],
});
