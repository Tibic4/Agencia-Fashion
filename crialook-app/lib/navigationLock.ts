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
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

// Safety timeout — se o lock não for liberado em 5min (geração mais longa
// possível + buffer), libera sozinho. Sem isso, um crash mid-generation
// deixa a tab bar travada até o usuário reiniciar o app.
const SAFETY_TIMEOUT_MS = 5 * 60 * 1000;

function notify() {
  for (const cb of listeners) cb();
}

function clearSafetyTimer() {
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
}

export function setNavigationLocked(value: boolean) {
  if (locked === value) return;
  locked = value;
  clearSafetyTimer();
  if (value) {
    safetyTimer = setTimeout(() => {
      locked = false;
      safetyTimer = null;
      notify();
    }, SAFETY_TIMEOUT_MS);
  }
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
