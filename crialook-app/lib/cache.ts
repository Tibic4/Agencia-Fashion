import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@crialook/cache:';

interface Entry<T> {
  value: T;
  expires: number;
}

const memory = new Map<string, Entry<unknown>>();

function now() {
  return Date.now();
}

export async function readCache<T>(key: string): Promise<T | null> {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && mem.expires > now()) return mem.value;

  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (parsed.expires <= now()) {
      AsyncStorage.removeItem(PREFIX + key).catch(() => {});
      return null;
    }
    memory.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T, ttlMs: number) {
  const entry: Entry<T> = { value, expires: now() + ttlMs };
  memory.set(key, entry);
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export async function invalidateCache(key: string) {
  memory.delete(key);
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/**
 * Invalida tudo que começa com `prefix`. Útil pra invalidar
 * `/campaigns/*` (lista + cada campaign individual) com 1 chamada após
 * criar/deletar uma campanha.
 */
export async function invalidateCachePrefix(prefix: string) {
  for (const k of [...memory.keys()]) {
    if (k.startsWith(prefix)) memory.delete(k);
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const fullPrefix = PREFIX + prefix;
    const matches = keys.filter(k => k.startsWith(fullPrefix));
    if (matches.length) await AsyncStorage.multiRemove(matches);
  } catch {
    /* ignore */
  }
}

/**
 * Sweeps stale entries (TTL expirado) tanto da memória quanto do AsyncStorage.
 * Sem isso, chaves nunca relidas (ex: cache de campanha visualizada uma vez)
 * vazam para sempre — Android tem soft-cap de 6MB no AsyncStorage.
 *
 * Idempotente, seguro chamar no boot.
 */
export async function pruneExpiredCache() {
  const t = now();
  for (const [k, v] of memory) {
    if (v.expires <= t) memory.delete(k);
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(k => k.startsWith(PREFIX));
    if (!ours.length) return;
    const pairs = await AsyncStorage.multiGet(ours);
    const stale: string[] = [];
    for (const [k, raw] of pairs) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Entry<unknown>;
        if (parsed.expires <= t) stale.push(k);
      } catch {
        stale.push(k);
      }
    }
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch {
    /* ignore */
  }
}

export async function invalidateAll() {
  memory.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(k => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    /* ignore */
  }
}

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await readCache<T>(key);
  if (cached !== null) {
    fetcher()
      .then(fresh => writeCache(key, fresh, ttlMs))
      .catch(() => {});
    return cached;
  }
  const fresh = await fetcher();
  await writeCache(key, fresh, ttlMs);
  return fresh;
}
