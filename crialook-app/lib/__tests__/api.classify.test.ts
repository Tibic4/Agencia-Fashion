/**
 * Validates the error-code classifier mirrors the contract documented in
 * types/index.ts (ApiErrorCode union). Pure function, no network.
 */
import { describe, expect, it } from 'vitest';

type ApiErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'MODEL_OVERLOADED'
  | 'SAFETY_BLOCKED'
  | 'IMAGE_GENERATION_BLOCKED'
  | 'BAD_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UNKNOWN';

function classifyStatus(status: number, payloadCode?: string): ApiErrorCode {
  if (
    payloadCode &&
    [
      'QUOTA_EXCEEDED',
      'RATE_LIMITED',
      'MODEL_OVERLOADED',
      'SAFETY_BLOCKED',
      'IMAGE_GENERATION_BLOCKED',
      'BAD_REQUEST',
      'TIMEOUT',
    ].includes(payloadCode)
  ) {
    return payloadCode as ApiErrorCode;
  }
  if (status === 408) return 'TIMEOUT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 400) return 'BAD_REQUEST';
  return 'UNKNOWN';
}

function shouldRetry(method: string, status?: number): boolean {
  if (method !== 'GET') return false;
  if (!status) return true;
  return status === 408 || status === 429 || status >= 500;
}

describe('classifyStatus', () => {
  it('prefers payload code when known', () => {
    expect(classifyStatus(500, 'QUOTA_EXCEEDED')).toBe('QUOTA_EXCEEDED');
    expect(classifyStatus(400, 'SAFETY_BLOCKED')).toBe('SAFETY_BLOCKED');
  });

  it('ignores unknown payload codes and falls back to status', () => {
    expect(classifyStatus(429, 'RANDOM')).toBe('RATE_LIMITED');
    expect(classifyStatus(400, 'WHATEVER')).toBe('BAD_REQUEST');
  });

  it('maps standard HTTP statuses', () => {
    expect(classifyStatus(408)).toBe('TIMEOUT');
    expect(classifyStatus(429)).toBe('RATE_LIMITED');
    expect(classifyStatus(400)).toBe('BAD_REQUEST');
  });

  it('uses UNKNOWN as last resort', () => {
    expect(classifyStatus(500)).toBe('UNKNOWN');
    expect(classifyStatus(403)).toBe('UNKNOWN');
  });
});

describe('shouldRetry', () => {
  it('only retries GETs', () => {
    expect(shouldRetry('POST', 500)).toBe(false);
    expect(shouldRetry('PATCH', 503)).toBe(false);
    expect(shouldRetry('DELETE', 500)).toBe(false);
  });

  it('retries network errors (no status)', () => {
    expect(shouldRetry('GET')).toBe(true);
  });

  it('retries 408/429/5xx on GET', () => {
    expect(shouldRetry('GET', 408)).toBe(true);
    expect(shouldRetry('GET', 429)).toBe(true);
    expect(shouldRetry('GET', 500)).toBe(true);
    expect(shouldRetry('GET', 503)).toBe(true);
  });

  it('does not retry 4xx (except 408/429)', () => {
    expect(shouldRetry('GET', 400)).toBe(false);
    expect(shouldRetry('GET', 401)).toBe(false);
    expect(shouldRetry('GET', 404)).toBe(false);
  });
});
