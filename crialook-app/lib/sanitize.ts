/**
 * Pure functions to scrub tokens/secrets out of values before they reach
 * Sentry, console, or any other sink. No imports — keep this trivially
 * testable in any runtime.
 */

const TOKEN_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /sk_(test|live)_[A-Za-z0-9]+/g,
  /pk_(test|live)_[A-Za-z0-9]+/g,
];

export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    let result = value;
    for (const pattern of TOKEN_PATTERNS) {
      result = result.replace(pattern, '[redacted]');
    }
    return result;
  }
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeForLog(v);
    }
    return out;
  }
  return value;
}
