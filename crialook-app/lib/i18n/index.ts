/**
 * i18n setup.
 *
 * Why this shape:
 *  - i18n-js gives us interpolation + plural rules, but only takes a "flat"
 *    namespace bag. We feed it { 'pt-BR': {...}, en: {...} } and let it
 *    handle the lookup.
 *  - The locale starts from expo-localization (device locale), can be
 *    overridden by user preference (persisted in SecureStore), and we
 *    notify subscribers via a tiny event emitter so React components can
 *    re-render via useSyncExternalStore.
 *  - SSR / Node / test runners don't have SecureStore — the loader is a
 *    no-op there.
 *  - Type safety: t('plan.title') is a typed key path. A typo is a TS error.
 */
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { ptBR, en, type StringTree } from './strings';

export type Locale = 'pt-BR' | 'en';

const LOCALES: Record<Locale, StringTree> = {
  'pt-BR': ptBR,
  en,
};

const STORAGE_KEY = 'app_locale';
const DEFAULT_LOCALE: Locale = 'pt-BR';

const i18n = new I18n(LOCALES);
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;
i18n.locale = DEFAULT_LOCALE;

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function detectDeviceLocale(): Locale {
  try {
    const tags = Localization.getLocales();
    const langCode = tags?.[0]?.languageCode?.toLowerCase();
    if (langCode === 'pt') return 'pt-BR';
    if (langCode === 'en') return 'en';
  } catch {
    /* fall through */
  }
  return DEFAULT_LOCALE;
}

export async function initLocale() {
  let chosen: Locale = DEFAULT_LOCALE;
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en') chosen = stored;
    else chosen = detectDeviceLocale();
  } catch {
    chosen = detectDeviceLocale();
  }
  i18n.locale = chosen;
  notify();
}

export async function setLocale(locale: Locale) {
  i18n.locale = locale;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, locale);
  } catch {
    /* ignore — fallback to in-memory */
  }
  notify();
}

export function getLocale(): Locale {
  return (i18n.locale as Locale) || DEFAULT_LOCALE;
}

// ─── Typed key path machinery ───────────────────────────────────────────
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

type Paths<T> = T extends object
  ? { [K in keyof T]: K extends string ? K | Join<K, Paths<T[K]>> : never }[keyof T]
  : never;

export type TKey = Paths<StringTree>;

export function t(key: TKey, options?: Record<string, string | number>): string {
  return i18n.t(key, options);
}

// ─── React integration ──────────────────────────────────────────────────

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = () => i18n.locale;

/** Re-renders when the locale changes. Use the returned `t` exactly like the standalone one. */
export function useT() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { t, locale: getLocale() as Locale, setLocale };
}

export { i18n };
