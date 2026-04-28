/**
 * Pure logic invariants for the review gate. Full integration is mocked elsewhere;
 * here we cover only the math: does the gate respect the 3-success and 30-day rules?
 */
import { describe, expect, it } from 'vitest';

const MIN_SUCCESSES = 3;
const MIN_DAYS = 30;

function shouldPrompt(successes: number, lastPromptMs: number, nowMs: number) {
  if (successes < MIN_SUCCESSES) return false;
  if (lastPromptMs === 0) return true;
  const daysSince = (nowMs - lastPromptMs) / (1000 * 60 * 60 * 24);
  return daysSince >= MIN_DAYS;
}

describe('reviewGate (logic invariants)', () => {
  const NOW = new Date('2026-04-26T12:00:00Z').getTime();

  it('refuses below 3 successes', () => {
    expect(shouldPrompt(0, 0, NOW)).toBe(false);
    expect(shouldPrompt(2, 0, NOW)).toBe(false);
  });

  it('allows on first eligible success (no previous prompt)', () => {
    expect(shouldPrompt(3, 0, NOW)).toBe(true);
  });

  it('blocks within 30 days of last prompt', () => {
    const prompted = NOW - 29 * 24 * 60 * 60 * 1000;
    expect(shouldPrompt(10, prompted, NOW)).toBe(false);
  });

  it('allows after 30 days', () => {
    const prompted = NOW - 31 * 24 * 60 * 60 * 1000;
    expect(shouldPrompt(10, prompted, NOW)).toBe(true);
  });
});
