/**
 * API response cache backed by MMKV (synchronous, memory-mapped).
 *
 * Why we migrated off AsyncStorage:
 *   - AsyncStorage is async + JSON-bridged; every read does
 *     setImmediate → bridge → JSON.parse. In hot screens that fire
 *     `apiGetCached` dozens of times per session this adds real latency
 *     to the JS thread.
 *   - AsyncStorage on Android has a soft-cap of ~6MB (the SQLite-backed
 *     implementation). This cache had no eviction beyond TTL, so
 *     long-tail keys (a campaign opened once, never re-read) leaked until
 *     they hit that cap and started failing silently.
 *   - MMKV is sync, memory-mapped, ~10–100x faster, and naturally
 *     survives a corrupted entry without taking the whole storage down.
 *
 * The public API is intentionally identical to the previous
 * AsyncStorage-backed module so callers (lib/api.ts, lib/auth.tsx) don't
 * need to change. The internal in-memory `Map` cache is kept too: even
 * MMKV adds a JSON.parse cost per read, and serving from the JS-side Map
 * is free.
 */
import { MMKV } from 'react-native-mmkv';

const PREFIX = '@crialook/cache:';

// Single namespaced instance. Multiple MMKV instances are cheap but a
// single namespaced one keeps `getAllKeys` predictable for prefix sweeps.
//
// LAZY init com try/catch: `new MMKV()` chamado em module scope teria
// crashado o import inteiro de cache.ts (e via cascata o api.ts e o
// _layout.tsx) se o native module ou o nitro modules ainda não estivessem
// prontos no boot. Resultado prático observado: tela branca pós-splash
// porque o JSBundle nunca chegava a montar a árvore React.
//
// Agora a primeira chamada tenta instanciar; se falhar, marca um flag e
// caímos pra cache só em memória (Map abaixo). A app continua de pé,
// só perde persistência entre cold starts.
let _storage: MMKV | null = null;
let _storageInitFailed = false;

function getStorage(): MMKV | null {
  if (_storageInitFailed) return null;
  if (_storage) return _storage;
  try {
    _storage = new MMKV({ id: 'crialook-api-cache' });
    return _storage;
  } catch (e) {
    _storageInitFailed = true;
    if (__DEV__) {
      console.warn('[cache] MMKV init failed, falling back to in-memory only', e);
    }
    return null;
  }
}

interface Entry<T> {
  value: T;
  expires: number;
}

const memory = new Map<string, Entry<unknown>>();

function now() {
  return Date.now();
}

function k(key: string): string {
  return PREFIX + key;
}

export async function readCache<T>(key: string): Promise<T | null> {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && mem.expires > now()) return mem.value;

  try {
    const s = getStorage();
    if (!s) return null;
    const raw = s.getString(k(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (parsed.expires <= now()) {
      // Async-shaped delete to avoid touching MMKV inline if reader
      // is in a tight loop; MMKV.delete is sync and cheap, but we keep
      // the same shape as before so callers still don't await it.
      s.delete(k(key));
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
    getStorage()?.set(k(key), JSON.stringify(entry));
  } catch {
    /* MMKV throws only on encryption mismatch; safe to swallow */
  }
}

export async function invalidateCache(key: string) {
  memory.delete(key);
  try {
    getStorage()?.delete(k(key));
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
  for (const mk of [...memory.keys()]) {
    if (mk.startsWith(prefix)) memory.delete(mk);
  }
  try {
    const s = getStorage();
    if (!s) return;
    const fullPrefix = PREFIX + prefix;
    const keys = s.getAllKeys();
    for (const sk of keys) {
      if (sk.startsWith(fullPrefix)) s.delete(sk);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Sweeps stale entries (TTL expirado) tanto da memória quanto do MMKV.
 * Idempotente, seguro chamar no boot. Ainda relevante mesmo com MMKV
 * porque chaves nunca relidas continuam ocupando espaço (ex: cache de
 * campanha visualizada uma vez). MMKV não tem cap rígido como
 * AsyncStorage, mas mantemos o sweep pra não inflar o file mapping
 * indefinidamente.
 */
export async function pruneExpiredCache() {
  const t = now();
  for (const [mk, v] of memory) {
    if (v.expires <= t) memory.delete(mk);
  }
  try {
    const s = getStorage();
    if (!s) return;
    const keys = s.getAllKeys();
    for (const sk of keys) {
      if (!sk.startsWith(PREFIX)) continue;
      const raw = s.getString(sk);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Entry<unknown>;
        if (parsed.expires <= t) s.delete(sk);
      } catch {
        // Corrupted entry — drop it.
        s.delete(sk);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function invalidateAll() {
  memory.clear();
  try {
    const s = getStorage();
    if (!s) return;
    const keys = s.getAllKeys();
    for (const sk of keys) {
      if (sk.startsWith(PREFIX)) s.delete(sk);
    }
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
