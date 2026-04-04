import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance: captura 20% das transações no servidor
  tracesSampleRate: 0.2,

  // Ambiente
  environment: process.env.NODE_ENV || "development",
});
