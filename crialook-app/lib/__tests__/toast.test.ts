import { describe, it, expect, beforeEach } from 'vitest';
import { toast, useCurrentToast, dismissCurrentToast } from '../toast';
import { renderHook, act } from '@testing-library/react';

describe('toast queue', () => {
  beforeEach(() => {
    dismissCurrentToast();
  });

  it('exposes the latest toast via useCurrentToast', () => {
    const { result } = renderHook(() => useCurrentToast());
    expect(result.current).toBeNull();
    act(() => {
      toast.success('saved');
    });
    expect(result.current?.kind).toBe('success');
    expect(result.current?.text).toBe('saved');
  });

  it('error toasts get a 5000ms default duration', () => {
    const { result } = renderHook(() => useCurrentToast());
    act(() => {
      toast.error('boom');
    });
    expect(result.current?.kind).toBe('error');
    expect(result.current?.durationMs).toBe(5000);
  });

  it('warning toasts get 4500ms; info has no duration override', () => {
    const { result } = renderHook(() => useCurrentToast());
    act(() => {
      toast.warning('careful');
    });
    expect(result.current?.durationMs).toBe(4500);
    act(() => {
      toast.info('hi');
    });
    expect(result.current?.kind).toBe('info');
    expect(result.current?.durationMs).toBeUndefined();
  });

  it('dismissCurrentToast clears the slot', () => {
    const { result } = renderHook(() => useCurrentToast());
    act(() => {
      toast.success('a');
    });
    expect(result.current).not.toBeNull();
    act(() => {
      dismissCurrentToast();
    });
    expect(result.current).toBeNull();
  });

  it('caller-provided durationMs and action are preserved', () => {
    const { result } = renderHook(() => useCurrentToast());
    const onPress = () => {};
    act(() => {
      toast.success('done', { durationMs: 2000, action: { label: 'Undo', onPress } });
    });
    expect(result.current?.durationMs).toBe(2000);
    expect(result.current?.action?.label).toBe('Undo');
  });
});
