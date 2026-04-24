import * as Sentry from "@sentry/nextjs";

// Chaves sensíveis a redatar em contextos e breadcrumbs
const SENSITIVE_KEYS = [
  "authorization", "cookie", "set-cookie",
  "access_token", "refresh_token", "api_key",
  "password", "token", "secret",
  "cpf", "cnpj",
  "credit_card", "card_number", "cvv",
];

function redactObject<T>(obj: T): T {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactObject) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((sk) => k.toLowerCase().includes(sk))) {
      out[k] = "[redacted]";
    } else {
      out[k] = redactObject(v);
    }
  }
  return out as unknown as T;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: captura 20% das transações
  tracesSampleRate: 0.2,

  // Replay: captura sessões com erro, com PII mascarada
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  environment: process.env.NODE_ENV || "development",
  // Desliga PII-by-default (email, IP) — redact explícito controla o resto.
  sendDefaultPii: false,

  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    "Load failed",
    "AbortError",
    "The user aborted a request",
    "NetworkError when attempting to fetch resource",
    "Failed to fetch",
    "cancelled",
    "The operation was aborted",
  ],

  denyUrls: [
    /\/api\/health/, // health endpoint — noise
  ],

  beforeSend(event) {
    if (event.request) {
      if (event.request.headers) event.request.headers = redactObject(event.request.headers);
      if (event.request.data) event.request.data = redactObject(event.request.data);
      if (event.request.cookies) event.request.cookies = redactObject(event.request.cookies);
    }
    if (event.contexts) event.contexts = redactObject(event.contexts);
    if (event.extra) event.extra = redactObject(event.extra);
    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data) breadcrumb.data = redactObject(breadcrumb.data);
    return breadcrumb;
  },
});
