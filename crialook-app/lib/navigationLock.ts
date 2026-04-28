/**
 * Global navigation lock.
 *
 * Why a singleton instead of context: the lock is read by the tab bar
 * (root-level layout) and written by the generation screen (deep in the
 * tree). Threading a context through the tabs layout for a single boolean
 * is not worth the boilerplate and re-renders. A subscribe/getSnapshot
 * pair plays nicely with `useSyncExternalStore` for component reads.
 *
 * The lock blocks tab presses while a long-running flow (campaign
 * generation) is in progress, preventing the user from accidentally
 * navigating away and breaking the UX (the polling itself survives, but
 * losing the loading screen mid-flight is disorienting).
 */
import { useSyncExternalStore } from 'react';

let locked = false;
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

export function setNavigationLocked(value: boolean) {
  if (locked === value) return;
  locked = value;
  notify();
}

export function isNavigationLocked(): boolean {
  return locked;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = () => locked;

/** React hook — re-renders when the lock state flips. */
export function useNavigationLocked(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
