/**
 * regenerateCampaign — D-12 contract test (Phase 02).
 *
 * Strategy: bypass the global vi.mock('@/lib/api') stub from vitest.setup.ts
 * so we can exercise the REAL `regenerateCampaign` against a stubbed
 * `globalThis.fetch`. We assert call shape (POST + body present/absent),
 * the typed RegenerateReason union, and the BAD_REQUEST classification path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/lib/api');

// Stub EXPO_PUBLIC_API_URL so BASE_URL resolves to a deterministic origin.
process.env.EXPO_PUBLIC_API_URL = 'https://api.test';

// Async dynamic import AFTER unmock so the real module loads.
async function loadApi() {
  return await import('@/lib/api');
}

interface RecordedCall {
  url: string;
  init: RequestInit;
}

let calls: RecordedCall[] = [];

function stubFetchOk<T>(payload: T, status = 200) {
  (globalThis as any).fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function stubFetchError(status: number, payload: unknown) {
  (globalThis as any).fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('regenerateCampaign', () => {
  it('Test 1 — no reason → POSTs without body, resolves to legacy paid payload', async () => {
    const { regenerateCampaign } = await loadApi();
    stubFetchOk({
      success: true,
      data: { used: 1, limit: 3, free: false },
    });

    const out = await regenerateCampaign('camp-123');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/campaign/camp-123/regenerate');
    expect(calls[0].init.method).toBe('POST');
    // Legacy path = no body.
    expect(calls[0].init.body).toBeUndefined();
    expect(out).toEqual({
      success: true,
      data: { used: 1, limit: 3, free: false },
    });
  });

  it('Test 2 — reason supplied → POSTs JSON body, resolves to free payload', async () => {
    const { regenerateCampaign } = await loadApi();
    stubFetchOk({
      success: true,
      data: { reason: 'face_wrong', free: true },
    });

    const out = await regenerateCampaign('camp-456', 'face_wrong');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/campaign/camp-456/regenerate');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe(JSON.stringify({ reason: 'face_wrong' }));
    expect(out).toEqual({
      success: true,
      data: { reason: 'face_wrong', free: true },
    });
  });

  it('Test 3 — unknown reason string fails to compile (TS-level guard)', async () => {
    const { regenerateCampaign } = await loadApi();
    stubFetchOk({ success: true, data: { reason: 'face_wrong', free: true } });

    // The TypeScript union should reject any string outside the 5 enum values.
    // Run-time still resolves (the compiler is the gate), but tsc --noEmit
    // would fail without the @ts-expect-error hint below.
    // @ts-expect-error — 'invalid_reason_xyz' is not a member of RegenerateReason
    await regenerateCampaign('camp-789', 'invalid_reason_xyz');
    expect(calls[0].init.body).toBe(
      JSON.stringify({ reason: 'invalid_reason_xyz' }),
    );
  });

  it('Test 4 — backend 400 INVALID_REASON → ApiError with code BAD_REQUEST', async () => {
    const { regenerateCampaign, ApiError } = await loadApi();
    stubFetchError(400, {
      error: 'Invalid reason',
      code: 'INVALID_REASON',
      validReasons: [
        'face_wrong',
        'garment_wrong',
        'copy_wrong',
        'pose_wrong',
        'other',
      ],
    });

    await expect(
      regenerateCampaign('camp-999', 'face_wrong'),
    ).rejects.toMatchObject({
      status: 400,
      // INVALID_REASON is not in the recognized payloadCode allow-list inside
      // classifyStatus, so the status-based fallback kicks in: 400 → BAD_REQUEST.
      code: 'BAD_REQUEST',
    });

    // Sanity: the rejection is an ApiError instance (not a plain Error).
    await expect(
      regenerateCampaign('camp-999', 'face_wrong'),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
