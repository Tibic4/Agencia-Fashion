/**
 * Why a hook?
 *  Polling has subtle invariants that are easy to break when inlined:
 *    1. Stop polling when the component unmounts.
 *    2. Pause polling when the app backgrounds (battery).
 *    3. Resume cleanly on foreground.
 *    4. Hard-stop after a wall-clock timeout to avoid runaway intervals.
 *  Encapsulating it gives the caller a tiny API: start(id), stop(), and a
 *  status callback. The hook handles the rest.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { apiGet } from '@/lib/api';

export type PollingStatus =
  | { kind: 'completed' }
  | { kind: 'failed'; reason?: string }
  | { kind: 'timeout' };

interface UseCampaignPollingOptions {
  /** Called when polling reaches a terminal state. */
  onStatus: (status: PollingStatus) => void;
  /** Polling interval in ms. Default 5s. */
  intervalMs?: number;
  /** Wall-clock timeout in ms. Default 3 min. */
  timeoutMs?: number;
}

export function useCampaignPolling({
  onStatus,
  intervalMs = 5000,
  timeoutMs = 180_000,
}: UseCampaignPollingOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const onStatusRef = useRef(onStatus);

  // Keep the callback fresh without restarting the interval.
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    activeIdRef.current = null;
    clearTimers();
  }, [clearTimers]);

  const tick = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    try {
      const res = await apiGet<{ data: { success?: boolean; status?: string } }>(
        `/campaigns/${id}`,
      );
      const data = res?.data;
      if (data?.success || data?.status === 'completed') {
        stop();
        onStatusRef.current({ kind: 'completed' });
      } else if (data?.status === 'failed') {
        stop();
        onStatusRef.current({ kind: 'failed' });
      }
    } catch {
      /* keep polling — transient network errors shouldn't kill the loop */
    }
  }, [stop]);

  const start = useCallback(
    (id: string) => {
      clearTimers();
      activeIdRef.current = id;
      intervalRef.current = setInterval(tick, intervalMs);
      timeoutRef.current = setTimeout(() => {
        if (activeIdRef.current) {
          stop();
          onStatusRef.current({ kind: 'timeout' });
        }
      }, timeoutMs);
    },
    [tick, intervalMs, timeoutMs, clearTimers, stop],
  );

  // Pause/resume on AppState transitions.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      const id = activeIdRef.current;
      if (state !== 'active') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      if (id && !intervalRef.current) {
        intervalRef.current = setInterval(tick, intervalMs);
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [tick, intervalMs]);

  // Cleanup on unmount.
  useEffect(() => stop, [stop]);

  return { start, stop };
}
