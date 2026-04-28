import { captureError, captureMessage } from './sentry';
import { sanitizeForLog } from './sanitize';

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    if (__DEV__) console.log(`[info] ${message}`, context ?? '');
    captureMessage(message, 'info');
  },
  warn(message: string, context?: Record<string, unknown>) {
    if (__DEV__) console.warn(`[warn] ${message}`, context ?? '');
    captureMessage(message, 'warning');
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    if (__DEV__) console.error(`[error] ${message}`, error, context ?? '');
    captureError(error ?? new Error(message), {
      message,
      ...(context ? (sanitizeForLog(context) as Record<string, unknown>) : {}),
    });
  },
};

export { sanitizeForLog };
