import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-clerk-auth',
];

let initialized = false;

export function initSentry() {
  if (initialized) return;
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    debug: false,
    // Session Replay desligado: o init nativo do MediaCodec encoder + captura
    // de framebuffer + registerDefaultNetworkCallback travava o JS thread por
    // ~54s no boot do AAB de produção (Sentry RN 7.x ativa Replay por
    // default). Não usamos replay; mantemos crash reports + traces +
    // breadcrumbs, que é o que importa.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Defesa em profundidade: mesmo que Sentry mude defaults num bump
    // futuro, removemos as integrations de Replay aqui pra garantir que o
    // boot continue limpo.
    integrations: defaults =>
      defaults.filter(i => i.name !== 'MobileReplay' && i.name !== 'ReplayIntegration'),
    // Default sample rate. Critical flows override this via tracesSampler.
    tracesSampleRate: 0.2,
    tracesSampler: ctx => {
      const op = ctx.attributes?.['sentry.op'] as string | undefined;
      const name = ctx.name;
      // Always trace billing + generation: low volume, high business value.
      if (
        op === 'campaign.generate' ||
        op === 'billing.purchase' ||
        op === 'billing.restore'
      ) {
        return 1.0;
      }
      // Trace navigations into the most important screens at 50%.
      if (name === 'gerar' || name === 'plano' || name === 'gerar/resultado') {
        return 0.5;
      }
      return 0.1;
    },
    environment: __DEV__ ? 'development' : 'production',
    release: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown',
    dist: Application.nativeBuildVersion ?? undefined,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        const headers = { ...event.request.headers } as Record<string, string>;
        for (const key of Object.keys(headers)) {
          if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
            headers[key] = '[redacted]';
          }
        }
        event.request.headers = headers;
      }
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        return null;
      }
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        if (breadcrumb.data && typeof breadcrumb.data === 'object') {
          const data = breadcrumb.data as Record<string, unknown>;
          if (typeof data.url === 'string') {
            data.url = data.url.replace(/(token|auth|bearer)=[^&]+/gi, '$1=[redacted]');
          }
          delete data.request_body;
          delete data.response_body;
        }
      }
      return breadcrumb;
    },
  });
  initialized = true;
}

export function setSentryUser(id: string | null) {
  if (!initialized) return;
  if (id) Sentry.setUser({ id });
  else Sentry.setUser(null);
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    if (__DEV__) console.warn('[error]', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

/**
 * Wrap an async operation in a Sentry span. The op key is what the sampler
 * looks at — pick something stable like 'campaign.generate' or
 * 'billing.purchase'. Returns whatever the inner fn returns.
 */
export async function withSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!initialized) return fn();
  return Sentry.startSpan({ name, op }, async () => fn());
}

export { Sentry };
