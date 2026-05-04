import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted lifts the bag above vi.mock so the factory can read FakeMMKV.
const { store, FakeMMKV } = vi.hoisted(() => {
  const store = new Map<string, boolean>();
  class FakeMMKV {
    getBoolean(key: string): boolean | undefined {
      return store.has(key) ? store.get(key) : undefined;
    }
    set(key: string, value: boolean): void {
      store.set(key, value);
    }
  }
  return { store, FakeMMKV };
});
vi.mock('react-native-mmkv', () => ({ MMKV: FakeMMKV }));

import { getPreference, setPreference } from '../preferences';

beforeEach(() => {
  store.clear();
});

describe('preferences', () => {
  it('returns default true for hapticsEnabled when unset', () => {
    expect(getPreference('hapticsEnabled')).toBe(true);
  });

  it('returns default true for remindCampaignReady when unset', () => {
    expect(getPreference('remindCampaignReady')).toBe(true);
  });

  it('persists explicit false value', () => {
    setPreference('hapticsEnabled', false);
    expect(getPreference('hapticsEnabled')).toBe(false);
  });

  it('persists explicit true value (overrides default lookup path)', () => {
    setPreference('hapticsEnabled', true);
    expect(getPreference('hapticsEnabled')).toBe(true);
  });

  it('round-trips both preferences independently', () => {
    setPreference('hapticsEnabled', false);
    setPreference('remindCampaignReady', false);
    expect(getPreference('hapticsEnabled')).toBe(false);
    expect(getPreference('remindCampaignReady')).toBe(false);

    setPreference('hapticsEnabled', true);
    expect(getPreference('hapticsEnabled')).toBe(true);
    expect(getPreference('remindCampaignReady')).toBe(false);
  });
});
