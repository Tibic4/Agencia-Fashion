/**
 * lib/theme.tsx
 *
 * Why: device-level color scheme is not enough — the user wants to override
 * light/dark independent of OS, with the choice persisted across launches and
 * available via a cheap subscription (useSyncExternalStore) so any component
 * (header, tab bar, screen) can read the current effective scheme without
 * prop drilling or context re-render storms.
 *
 * Storage key:  app_theme  (SecureStore — same lib already used for Clerk tokens)
 * Values:       'light' | 'dark' | 'system'
 *
 * Public API:
 *   <ThemeProvider />            — root wrapper (kicks off async load)
 *   useAppTheme()                — { mode, scheme, setTheme }
 *   useEffectiveColorScheme()    — 'light' | 'dark' (resolved)
 */
import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark' | 'system';
export type EffectiveScheme = 'light' | 'dark';

const STORAGE_KEY = 'app_theme';

// Tiny external store --------------------------------------------------------
let mode: ThemeMode = 'system';
let deviceScheme: EffectiveScheme = (Appearance.getColorScheme() as EffectiveScheme) || 'light';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

type Snapshot = { mode: ThemeMode; scheme: EffectiveScheme };
let snapshot: Snapshot = { mode, scheme: deviceScheme };

function recomputeSnapshot() {
  const scheme: EffectiveScheme = mode === 'system' ? deviceScheme : mode;
  // Stable identity when nothing changed — important for useSyncExternalStore.
  if (snapshot.mode === mode && snapshot.scheme === scheme) return;
  snapshot = { mode, scheme };
  emit();
}

function getSnapshot(): Snapshot {
  return snapshot;
}

// Public mutators ------------------------------------------------------------
export async function loadPersistedTheme(): Promise<void> {
  try {
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') {
      mode = v;
      recomputeSnapshot();
    }
  } catch {
    // SecureStore can fail silently — fall back to 'system' default.
  }
}

export function setTheme(next: ThemeMode) {
  if (mode === next) return;
  mode = next;
  recomputeSnapshot();
  // Fire-and-forget persistence; UI shouldn't wait on disk I/O.
  SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
}

// Hooks ----------------------------------------------------------------------
export function useAppTheme(): { mode: ThemeMode; scheme: EffectiveScheme; setTheme: typeof setTheme } {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { mode: snap.mode, scheme: snap.scheme, setTheme };
}

export function useEffectiveColorScheme(): EffectiveScheme {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snap.scheme;
}

// Provider -------------------------------------------------------------------
/**
 * ThemeProvider — kicks off persisted-theme load and subscribes to OS color
 * scheme changes so 'system' mode stays in sync if the user flips the device
 * setting while the app is running.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    void loadPersistedTheme();
    const sub = Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
      const next: EffectiveScheme = colorScheme === 'dark' ? 'dark' : 'light';
      if (deviceScheme === next) return;
      deviceScheme = next;
      recomputeSnapshot();
    });
    return () => sub.remove();
  }, []);

  return <>{children}</>;
}
