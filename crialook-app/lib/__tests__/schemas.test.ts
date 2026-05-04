import { describe, it, expect } from 'vitest';
import {
  CampaignSchema,
  CampaignListResponse,
  StoreModelSchema,
  StoreUsageSchema,
  StoreCreditsSchema,
  QuotaDataSchema,
  PushTokenAck,
  VerifiedSubscriptionSchema,
  parseOrApiError,
} from '../schemas';
import { ApiError } from '@/types';

const baseCampaign = {
  id: 'c1',
  title: 'My campaign',
  sequence_number: 1,
  objective: 'venda_imediata',
  status: 'completed',
  created_at: '2026-01-01T00:00:00Z',
  is_favorited: false,
  output: null,
};

describe('CampaignSchema', () => {
  it('accepts minimal valid', () => {
    const r = CampaignSchema.safeParse(baseCampaign);
    expect(r.success).toBe(true);
  });
  it('accepts nullable title and sequence_number', () => {
    const r = CampaignSchema.safeParse({ ...baseCampaign, title: null, sequence_number: null });
    expect(r.success).toBe(true);
  });
  it('accepts output with image_urls', () => {
    const r = CampaignSchema.safeParse({
      ...baseCampaign,
      output: { image_urls: ['https://x/y.jpg', null] },
    });
    expect(r.success).toBe(true);
  });
  it('rejects missing id', () => {
    const { id: _omitted, ...rest } = baseCampaign;
    const r = CampaignSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

describe('CampaignListResponse', () => {
  it('wraps an array of campaigns', () => {
    const r = CampaignListResponse.safeParse({ data: [baseCampaign, baseCampaign] });
    expect(r.success).toBe(true);
  });
  it('rejects when data is missing', () => {
    expect(CampaignListResponse.safeParse({}).success).toBe(false);
  });
});

describe('StoreModelSchema + Usage + Credits + Quota', () => {
  it('StoreModelSchema accepts minimal', () => {
    const r = StoreModelSchema.safeParse({
      id: 'm1',
      name: 'Ana',
      skin_tone: 'morena',
      hair_style: 'liso',
      body_type: 'media',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(r.success).toBe(true);
  });
  it('StoreUsageSchema requires all numeric fields', () => {
    expect(
      StoreUsageSchema.safeParse({
        plan_name: 'pro',
        campaigns_generated: 5,
        campaigns_limit: 40,
        models_used: 2,
        models_limit: 15,
      }).success,
    ).toBe(true);
    expect(StoreUsageSchema.safeParse({ plan_name: 'pro' }).success).toBe(false);
  });
  it('StoreCreditsSchema accepts {campaigns, models}', () => {
    expect(StoreCreditsSchema.safeParse({ campaigns: 3, models: 0 }).success).toBe(true);
    expect(StoreCreditsSchema.safeParse({ campaigns: '3' }).success).toBe(false);
  });
  it('QuotaDataSchema accepts numeric used/limit/credits', () => {
    expect(QuotaDataSchema.safeParse({ used: 1, limit: 10, credits: 5 }).success).toBe(true);
  });
});

describe('PushTokenAck + VerifiedSubscriptionSchema (passthrough loose)', () => {
  it('PushTokenAck accepts empty + extra fields', () => {
    expect(PushTokenAck.safeParse({}).success).toBe(true);
    expect(PushTokenAck.safeParse({ success: true, extra: 'meta' }).success).toBe(true);
  });
  it('VerifiedSubscriptionSchema requires plan + expiresAt strings', () => {
    expect(
      VerifiedSubscriptionSchema.safeParse({ plan: 'pro', expiresAt: '2026-12-01' }).success,
    ).toBe(true);
    expect(VerifiedSubscriptionSchema.safeParse({ plan: 'pro' }).success).toBe(false);
  });
  it('VerifiedSubscriptionSchema preserves extra fields', () => {
    const r = VerifiedSubscriptionSchema.safeParse({
      plan: 'pro',
      expiresAt: '2026-12-01',
      trial: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as any).trial).toBe(true);
  });
});

describe('parseOrApiError', () => {
  it('returns parsed value on success', () => {
    const v = parseOrApiError(StoreCreditsSchema, { campaigns: 1, models: 2 }, '/store/credits');
    expect(v).toEqual({ campaigns: 1, models: 2 });
  });
  it('throws ApiError with SCHEMA_MISMATCH-style message on failure', () => {
    try {
      parseOrApiError(StoreCreditsSchema, { campaigns: 'oops' }, '/store/credits');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toMatch(/Schema mismatch at \/store\/credits/);
    }
  });
});
