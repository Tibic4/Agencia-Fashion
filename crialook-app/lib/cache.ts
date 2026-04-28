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
