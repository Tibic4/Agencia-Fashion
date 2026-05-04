import { describe, it, expect } from 'vitest';
import { clerkErrorMessage, isOAuthCanceled } from '../clerkErrors';

// Simulate `t()` from i18n: returns the key path so we can assert which
// translation key the helper reached. Real i18n returns translated strings.
const t = ((key: string) => `t(${key})`) as Parameters<typeof clerkErrorMessage>[1];

describe('isOAuthCanceled', () => {
  it('detects cancel/dismiss/user_canceled phrases in message', () => {
    expect(isOAuthCanceled({ message: 'OAuth flow was cancelled by user' })).toBe(true);
    expect(isOAuthCanceled({ message: 'user dismissed the prompt' })).toBe(true);
    expect(isOAuthCanceled({ message: 'user_canceled the operation' })).toBe(true);
  });
  it('returns false when message has no cancel signal', () => {
    expect(isOAuthCanceled({ message: 'network unreachable' })).toBe(false);
    expect(isOAuthCanceled({})).toBe(false);
    expect(isOAuthCanceled(null)).toBe(false);
    expect(isOAuthCanceled(undefined)).toBe(false);
  });
});

describe('clerkErrorMessage', () => {
  it('maps known Clerk error code to i18n key', () => {
    const err = { errors: [{ code: 'form_password_incorrect' }] };
    expect(clerkErrorMessage(err, t, 'signIn.genericError')).toBe(
      't(errors.clerk.passwordIncorrect)',
    );
  });
  it('maps rate-limiting codes to tooManyRequests key', () => {
    const a = clerkErrorMessage({ errors: [{ code: 'too_many_requests' }] }, t, 'fb');
    const b = clerkErrorMessage({ errors: [{ code: 'rate_limit_exceeded' }] }, t, 'fb');
    expect(a).toBe('t(errors.clerk.tooManyRequests)');
    expect(b).toBe('t(errors.clerk.tooManyRequests)');
  });
  it('falls back to longMessage when code unknown', () => {
    const err = {
      errors: [{ code: 'some_brand_new_code', longMessage: 'Long english explanation.' }],
    };
    expect(clerkErrorMessage(err, t, 'fb')).toBe('Long english explanation.');
  });
  it('falls back to message when no longMessage', () => {
    const err = { errors: [{ code: 'unknown', message: 'short message' }] };
    expect(clerkErrorMessage(err, t, 'fb')).toBe('short message');
  });
  it('falls back to top-level message when no errors array', () => {
    expect(clerkErrorMessage({ message: 'top level' }, t, 'fb')).toBe('top level');
  });
  it('falls back to caller fallbackKey as last resort', () => {
    expect(clerkErrorMessage({}, t, 'signIn.genericError')).toBe('t(signIn.genericError)');
    expect(clerkErrorMessage(null, t, 'signIn.genericError')).toBe('t(signIn.genericError)');
  });
  it('maps OAuth and redirect codes', () => {
    expect(clerkErrorMessage({ errors: [{ code: 'oauth_access_denied' }] }, t, 'fb')).toBe(
      't(errors.clerk.oauthDenied)',
    );
    expect(clerkErrorMessage({ errors: [{ code: 'redirect_url_invalid' }] }, t, 'fb')).toBe(
      't(errors.clerk.redirectUrlInvalid)',
    );
    expect(clerkErrorMessage({ errors: [{ code: 'form_redirect_url_invalid' }] }, t, 'fb')).toBe(
      't(errors.clerk.redirectUrlInvalid)',
    );
  });
});
