import { describe, expect, it } from 'vitest';
import { sanitizeForLog } from '../sanitize';

describe('sanitizeForLog', () => {
  it('redacts JWTs in strings', () => {
    const input = 'token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature';
    expect(sanitizeForLog(input)).toBe('token: [redacted]');
  });

  it('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer abc123XYZ.def_456';
    expect(sanitizeForLog(input)).toBe('Authorization: [redacted]');
  });

  it('redacts Clerk live keys', () => {
    expect(sanitizeForLog('pk_live_AbCdEf123456')).toBe('[redacted]');
    expect(sanitizeForLog('sk_test_HelloWorld42')).toBe('[redacted]');
  });

  it('walks objects recursively', () => {
    const out = sanitizeForLog({
      headers: { auth: 'Bearer secrettoken123' },
      nested: { token: 'eyJabc.def.ghi' },
      safe: 'just a normal string',
    });
    expect(out).toEqual({
      headers: { auth: '[redacted]' },
      nested: { token: '[redacted]' },
      safe: 'just a normal string',
    });
  });

  it('walks arrays', () => {
    const out = sanitizeForLog(['Bearer xyz.abc.123', 'safe']);
    expect(out).toEqual(['[redacted]', 'safe']);
  });

  it('passes through non-string primitives', () => {
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog(null)).toBe(null);
    expect(sanitizeForLog(undefined)).toBe(undefined);
    expect(sanitizeForLog(true)).toBe(true);
  });
});
