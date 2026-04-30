/**
 * Preferências do usuário (toggles boolean) — persistidas via MMKV.
 *
 * MMKV aqui pq leitura é síncrona — o check de haptics dentro de
 * `fireHaptic()` não paga taxa async em cada press.
 *
 * Pra adicionar uma preferência: estende o enum `Preference` + adiciona
 * default em `defaultPrefs`. Usa `usePreference()` em código React;
 * `getPreference` direto fora do React (ex: lib/haptics.ts).
 */
import { MMKV } from 'react-native-mmkv';
import { useSyncExternalStore } from 'react';

const storage = new MMKV({ id: 'crialook-prefs' });

export type Preference = 'hapticsEnabled' | 'remindCampaignReady';

const defaultPrefs: Record<Preference, boolean> = {
  hapticsEnabled: true,
  remindCampaignReady: true,
};

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function getPreference(key: Preference): boolean {
  const v = storage.getBoolean(key);
  return v === undefined ? defaultPrefs[key] : v;
}

export function setPreference(key: Preference, value: boolean): void {
  storage.set(key, value);
  notify();
}

export function usePreference(key: Preference): [boolean, (v: boolean) => void] {
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };
  const getSnapshot = () => getPreference(key);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setter = (v: boolean) => setPreference(key, v);
  return [value, setter];
}
