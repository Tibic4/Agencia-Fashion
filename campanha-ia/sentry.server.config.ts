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
    // D-29 / Phase 8 verification (2026-05-04): "Pipeline:Scorer" matches the
    // LangChain LLM-scorer trace string used by the analyzer/copy steps when
    // they short-circuit. Verified (grep) that judge dispatch errors (P2's
    // judge_pending tracking) do NOT serialize as "Pipeline:Scorer" — judge
    // errors flow through Inngest with their own error names. So this filter
    // does NOT mask the judge_pending signals added in Phase 2.
    // If a future judge change starts emitting errors that match this pattern,
    // NARROW the filter to e.g. /Pipeline:Scorer:[a-z]+_abort/ instead of
    // removing it (the LLM scorer noise is real and high-volume).
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
