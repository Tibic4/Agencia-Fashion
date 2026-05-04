import { describe, it, expect } from 'vitest';
import { PLANS } from '../plans';

describe('mobile PLANS', () => {
  it('has 3 paid tiers with id matching key', () => {
    expect(PLANS.essencial.id).toBe('essencial');
    expect(PLANS.pro.id).toBe('pro');
    expect(PLANS.business.id).toBe('business');
  });
  it('campaigns_per_month and models monotonically increase', () => {
    expect(PLANS.essencial.campaigns_per_month).toBeLessThan(PLANS.pro.campaigns_per_month);
    expect(PLANS.pro.campaigns_per_month).toBeLessThan(PLANS.business.campaigns_per_month);
    expect(PLANS.essencial.models).toBeLessThan(PLANS.pro.models);
    expect(PLANS.pro.models).toBeLessThan(PLANS.business.models);
  });
  it('price monotonically increases', () => {
    expect(PLANS.essencial.price).toBeLessThan(PLANS.pro.price);
    expect(PLANS.pro.price).toBeLessThan(PLANS.business.price);
  });
  it('every feature uses i18n key (no raw PT strings)', () => {
    for (const plan of Object.values(PLANS)) {
      for (const f of plan.features) {
        expect(typeof f.key).toBe('string');
        expect(f.key.length).toBeGreaterThan(0);
        // Check vars are objects with primitive values when present
        if (f.vars) {
          for (const v of Object.values(f.vars)) {
            expect(['string', 'number'].includes(typeof v)).toBe(true);
          }
        }
      }
    }
  });
  it('campaignsPerMonth feature var n matches campaigns_per_month', () => {
    for (const plan of Object.values(PLANS)) {
      const cp = plan.features.find((f) => f.key === 'campaignsPerMonth');
      expect(cp?.vars?.n).toBe(plan.campaigns_per_month);
    }
  });
  it('virtualModels feature var n matches models count', () => {
    for (const plan of Object.values(PLANS)) {
      const vm = plan.features.find((f) => f.key === 'virtualModels');
      expect(vm?.vars?.n).toBe(plan.models);
    }
  });
});
