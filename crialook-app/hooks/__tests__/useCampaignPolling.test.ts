/**
 * Hook integration test: useCampaignPolling.
 *
 * What we exercise:
 *  - start(id) begins polling and calls apiGet at the configured interval
 *  - terminal API responses (completed/failed) fire onStatus and stop
 *  - the wall-clock timeout fires onStatus({ kind:'timeout' })
 *  - AppState=background pauses the interval; 'active' resumes
 *  - stop() and unmount clear timers cleanly
 *
 * RN/Expo modules are mocked in vitest.setup.ts. The hook itself is unmocked.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCampaignPolling } from '../gerar/useCampaignPolling';

const apiFn = (globalThis as any).__apiFn as ReturnType<typeof vi.fn>;
const emitAppState = (globalThis as any).__emitAppState as (s: string) => void;

beforeEach(() => {
  vi.useFakeTimers();
  apiFn.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCampaignPolling', () => {
  it('reports completed when API returns success', async () => {
    apiFn.mockResolvedValue({ data: { status: 'completed' } });
    const onStatus = vi.fn();

    const { result } = renderHook(() =>
      useCampaignPolling({ onStatus, intervalMs: 1000, timeoutMs: 60_000 }),
    );

    act(() => result.current.start('uuid-123'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(apiFn).toHaveBeenCalledWith('/campaigns/uuid-123');
    expect(onStatus).toHaveBeenCalledWith({ kind: 'completed' });
  });

  it('reports failed when API returns failed status', async () => {
    apiFn.mockResolvedValue({ data: { status: 'failed' } });
    const onStatus = vi.fn();

    const { result } = renderHook(() =>
      useCampaignPolling({ onStatus, intervalMs: 1000, timeoutMs: 60_000 }),
    );

    act(() => result.current.start('uuid'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(onStatus).toHaveBeenCalledWith({ kind: 'failed' });
  });

  it('keeps polling when API throws (transient errors)', async () => {
    apiFn
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { status: 'completed' } });
    const onStatus = vi.fn();

    const { result } = renderHook(() =>
      useCampaignPolling({ onStatus, intervalMs: 1000, timeoutMs: 60_000 }),
    );

    act(() => result.current.start('uuid'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(onStatus).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(onStatus).toHaveBeenCalledWith({ kind: 'completed' });
  });

  it('fires timeout when wall-clock elapses without resolution', async () => {
    apiFn.mockResolvedValue({ data: { status: 'pending' } });
    const onStatus = vi.fn();

    const { result } = renderHook(() =>
      useCampaignPolling({ onStatus, intervalMs: 1000, timeoutMs: 5000 }),
    );

    act(() => result.current.start('uuid'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5500);
    });

    expect(onStatus).toHaveBeenCalledWith({ kind: 'timeout' });
  });

  it('pauses on AppState=background and resumes on active', async () => {
    apiFn.mockResolvedValue({ data: { status: 'pending' } });
    const onStatus = vi.fn();

    const { result } = renderHook(() =>
      useCampaignPolling({ onStatus, intervalMs: 1000, timeoutMs: 60_000 }),
    );

    act(() => result.current.start('uuid'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    const callsBeforePause = apiFn.mock.calls.length;
    expect(callsBeforePause).toBeGreaterThan(0);

    act(() => emitAppState('background'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(apiFn.mock.calls.length).toBe(callsBeforePause);

    act(() => emitAppState('active'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(apiFn.mock.calls.length).toBeGreaterThan(callsBeforePause);

    act(() => result.current.stop());
  });

  it('stop() clears timers and prevents further calls', async () => {
    apiFn.mockResolvedValue({ data: { status: 'pending' } });
    const onStatus = vi.fn();

    const { result } = renderHook(() =>
      useCampaignPolling({ onStatus, intervalMs: 1000, timeoutMs: 60_000 }),
    );

    act(() => result.current.start('uuid'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    act(() => result.current.stop());
    const callsAfterStop = apiFn.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(apiFn.mock.calls.length).toBe(callsAfterStop);
    expect(onStatus).not.toHaveBeenCalled();
  });
});
