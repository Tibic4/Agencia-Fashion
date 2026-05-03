import { clearAuthTokenCache, getAuthToken } from './auth';
import { ApiError, type ApiErrorCode } from '@/types';
import { readCache, writeCache, invalidateCache, invalidateCachePrefix, pruneExpiredCache } from './cache';
import { logger } from './logger';
import { getLocale } from './i18n';
import type { ZodType } from 'zod';
import { parseOrApiError } from './schemas';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 600;

function shouldRetry(method: string, status?: number): boolean {
  if (method !== 'GET') return false;
  if (!status) return true;
  return status === 408 || status === 429 || status >= 500;
}

function classifyStatus(status: number, payloadCode?: string): ApiErrorCode {
  if (payloadCode && [
    'QUOTA_EXCEEDED',
    'RATE_LIMITED',
    'MODEL_OVERLOADED',
    'SAFETY_BLOCKED',
    'IMAGE_GENERATION_BLOCKED',
    'BAD_REQUEST',
    'TIMEOUT',
  ].includes(payloadCode)) {
    return payloadCode as ApiErrorCode;
  }
  if (status === 408) return 'TIMEOUT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 400) return 'BAD_REQUEST';
  return 'UNKNOWN';
}

function sanitizeBody(body: string): string {
  return body.length > 500 ? body.slice(0, 500) + '…' : body;
}

/**
 * Common headers for every API call.
 * Why: backend pipelines (Sonnet copy in particular) need to know which
 * locale the UI is in so they can output copy in the right language.
 * Adding it here means every new call gets it for free.
 */
async function getCommonHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'X-App-Locale': getLocale() };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  return getCommonHeaders();
}

/**
 * If the caller passed a `signal` (e.g. TanStack Query's `queryFn` injects
 * one for cancelation on unmount/invalidation), we still apply the timeout
 * via a child controller so caller-cancel and timeout-abort cohabit.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const callerSignal = init.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener?.('abort', onCallerAbort);
  }
}

interface ApiOptions<T = unknown> extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  timeoutMs?: number;
  retries?: number;
  cacheMs?: number;
  cacheKey?: string;
  /**
   * Optional zod schema. When supplied, the parsed JSON response is validated
   * before returning; mismatches throw an `ApiError(code: 'UNKNOWN')` with the
   * offending path. Callers without a schema keep the legacy `as T` cast.
   */
  schema?: ZodType<T>;
}

/**
 * In-flight GET dedup. Two screens calling `apiGetCached('/store/usage')` at
 * the same time shared no state before — both fired the request. Now the
 * second call await the first's promise. Holds only during the lifetime of
 * the request; failures and successes are removed immediately so retries
 * after a true network error are not glued to a stale rejection.
 *
 * Skipped for non-GET, FormData (caller likely cares about response identity)
 * and requests with a caller-provided `signal` (cancelation semantics would
 * leak across callers).
 */
const inflightGets = new Map<string, Promise<unknown>>();

export async function api<T = unknown>(
  path: string,
  options: ApiOptions<T> = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isFormData = options.body instanceof FormData;
  const timeoutMs = options.timeoutMs ?? (isFormData ? 120_000 : DEFAULT_TIMEOUT_MS);
  const maxRetries = options.retries ?? (method === 'GET' ? MAX_RETRIES : 0);

  const cacheKey = options.cacheKey ?? path;
  const useCache = method === 'GET' && options.cacheMs && options.cacheMs > 0;

  if (useCache) {
    const cached = await readCache<T>(cacheKey);
    if (cached !== null) {
      revalidateInBackground<T>(path, options, cacheKey).catch(() => {});
      return cached;
    }
  }

  // Dedup concurrent GETs to the same path. See `inflightGets` comment.
  const dedupKey =
    method === 'GET' && !isFormData && !options.signal ? cacheKey : null;
  if (dedupKey) {
    const inflight = inflightGets.get(dedupKey) as Promise<T> | undefined;
    if (inflight) return inflight;
  }

  const exec = async (): Promise<T> => {
    const authHeaders = await getAuthHeaders();
    const headers: Record<string, string> = {
      ...authHeaders,
      ...(options.headers as Record<string, string>),
    };
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetchWithTimeout(
          `${BASE_URL}${path}`,
          { ...options, method, headers },
          timeoutMs,
        );

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          let payloadCode: string | undefined;
          try {
            const parsed = JSON.parse(text);
            payloadCode = parsed?.code;
          } catch {
            /* not JSON */
          }
          const code = classifyStatus(res.status, payloadCode);
          const err = new ApiError(`API ${res.status}`, res.status, code, sanitizeBody(text));

          // 401 → JWT cacheado pode estar stale. Limpa o cache e tenta de novo
          // uma vez (em qualquer método). Sem isso, o usuário fica em loop de
          // erro até o TTL de 30s do JWT expirar e o Clerk gerar um novo.
          if (res.status === 401 && attempt === 0) {
            clearAuthTokenCache();
            const refreshed = await getAuthHeaders();
            headers.Authorization = refreshed.Authorization || headers.Authorization;
            continue;
          }

          if (attempt < maxRetries && shouldRetry(method, res.status)) {
            await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)));
            lastError = err;
            continue;
          }
          if (res.status >= 500 || code === 'UNKNOWN') {
            logger.warn(`API ${method} ${path} failed`, { status: res.status, code });
          }
          throw err;
        }

        const raw = await res.json();
        const data: T = options.schema
          ? parseOrApiError(options.schema, raw, path)
          : (raw as T);
        if (useCache) await writeCache(cacheKey, data, options.cacheMs!);
        return data;
      } catch (e: any) {
        if (e instanceof ApiError) {
          lastError = e;
          throw e;
        }
        const isAbort = e?.name === 'AbortError';
        const code: ApiErrorCode = isAbort ? 'TIMEOUT' : 'NETWORK';
        const err = new ApiError(isAbort ? 'Request timed out' : 'Network error', 0, code);

        if (attempt < maxRetries && shouldRetry(method)) {
          await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)));
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new ApiError('Unknown error', 0, 'UNKNOWN');
  };

  if (!dedupKey) return exec();

  const promise = exec().finally(() => {
    // Always evict so a follow-up request after a failure isn't glued to a
    // stale rejected promise.
    inflightGets.delete(dedupKey);
  });
  inflightGets.set(dedupKey, promise);
  return promise;
}

async function revalidateInBackground<T>(
  path: string,
  options: ApiOptions<T>,
  cacheKey: string,
) {
  try {
    const fresh = await api<T>(path, { ...options, cacheMs: 0 });
    if (options.cacheMs && options.cacheMs > 0) {
      await writeCache(cacheKey, fresh, options.cacheMs);
    }
  } catch {
    /* keep stale */
  }
}

export async function invalidateApiCache(path: string) {
  await invalidateCache(path);
}

/** Invalida tudo que começa com `prefix` (ex: invalidateApiCachePrefix('/campaigns')
 *  para limpar lista + cada campaign individual). */
export async function invalidateApiCachePrefix(prefix: string) {
  await invalidateCachePrefix(prefix);
}

/** Sweep de TTLs vencidos. Chamar no boot pra evitar leak no AsyncStorage. */
export async function pruneApiCache() {
  await pruneExpiredCache();
}

export const apiGet = <T = unknown>(path: string, options?: ApiOptions<T>) =>
  api<T>(path, { ...options, method: 'GET' });

export const apiGetCached = <T = unknown>(path: string, ttlMs: number, options?: ApiOptions<T>) =>
  api<T>(path, { ...options, method: 'GET', cacheMs: ttlMs });

export const apiPost = <T = unknown>(path: string, body?: unknown, options?: ApiOptions<T>) =>
  api<T>(path, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiPatch = <T = unknown>(path: string, body?: unknown, options?: ApiOptions<T>) =>
  api<T>(path, {
    ...options,
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T = unknown>(path: string, options?: ApiOptions<T>) =>
  api<T>(path, { ...options, method: 'DELETE' });

/**
 * Fetch cru com headers de auth e BASE_URL aplicados — pra endpoints que
 * retornam binário (PNG, blob, etc) onde `api()` não serve por sempre fazer
 * `JSON.parse`. Caller é responsável por consumir a Response (blob/stream/etc).
 */
export async function apiFetchRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...((init.headers as Record<string, string>) || {}),
  };
  return fetch(`${BASE_URL}${path}`, { ...init, headers });
}

// ─── Regenerate (Phase 02 D-12) ──────────────────────────────────────
/**
 * Mirror of campanha-ia VALID_REGENERATE_REASONS. Keep this union in sync
 * by hand — backend is the source of truth (see
 * campanha-ia/src/lib/db/index.ts:272-286). A future codegen step is
 * possible but not in Phase 02 scope.
 */
export type RegenerateReason =
  | 'face_wrong'
  | 'garment_wrong'
  | 'copy_wrong'
  | 'pose_wrong'
  | 'other';

export interface RegenerateResponse {
  success: boolean;
  data: { reason?: RegenerateReason; free: boolean; used?: number; limit?: number };
}

/**
 * D-12 (Phase 02 quality-loop): POST regenerate with optional reason.
 * - reason supplied → backend takes the FREE reason-capture path (D-03 Phase 01)
 *   and persists campaigns.regenerate_reason. Used by the 5-option picker.
 * - reason undefined → legacy paid path (consumes a regen credit). Kept for
 *   backwards-compat with any existing call site that hasn't been migrated yet.
 */
export const regenerateCampaign = (id: string, reason?: RegenerateReason) =>
  apiPost<RegenerateResponse>(
    `/campaign/${id}/regenerate`,
    reason !== undefined ? { reason } : undefined,
  );

export { ApiError } from '@/types';
