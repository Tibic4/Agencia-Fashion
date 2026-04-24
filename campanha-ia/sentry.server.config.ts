import * as Sentry from "@sentry/nextjs";

const SENSITIVE_KEYS = [
  "authorization", "cookie", "set-cookie",
  "access_token", "refresh_token", "api_key",
  "password", "token", "secret",
  "cpf", "cnpj",
  "credit_card", "card_number", "cvv",
  "mercadopago_access_token", "clerk_secret",
  "anthropic_api_key", "google_ai_api_key", "gemini_api_key", "fashn_api_key", "fal_key",
  "supabase_service_role_key", "supabase_access_token",
  "health_check_secret", "editor_password", "editor_session_secret",
  "mercadopago_webhook_secret",
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
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV || "development",
  sendDefaultPii: false,

  ignoreErrors: [
    "AbortError",
    "The user aborted a request",
    "Pipeline:Scorer",
    "Failed to fetch",
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
