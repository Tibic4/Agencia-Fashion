import { getAuthToken } from './auth';
import { ApiError, type ApiErrorCode } from '@/types';
import { readCache, writeCache, invalidateCache } from './cache';
import { logger } from './logger';
import { getLocale } from './i18n';

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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  timeoutMs?: number;
  retries?: number;
  cacheMs?: number;
  cacheKey?: string;
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
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
        const text = await res.text();
        let payloadCode: string | undefined;
        try {
          const parsed = JSON.parse(text);
          payloadCode = parsed?.code;
        } catch {
          /* not JSON */
        }
        const code = classifyStatus(res.status, payloadCode);
        const err = new ApiError(`API ${res.status}`, res.status, code, sanitizeBody(text));

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

      const data = (await res.json()) as T;
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
}

async function revalidateInBackground<T>(
  path: string,
  options: ApiOptions,
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

export const apiGet = <T = unknown>(path: string, options?: ApiOptions) =>
  api<T>(path, { ...options, method: 'GET' });

export const apiGetCached = <T = unknown>(path: string, ttlMs: number, options?: ApiOptions) =>
  api<T>(path, { ...options, method: 'GET', cacheMs: ttlMs });

export const apiPost = <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
  api<T>(path, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiPatch = <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
  api<T>(path, {
    ...options,
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T = unknown>(path: string, options?: ApiOptions) =>
  api<T>(path, { ...options, method: 'DELETE' });

export { ApiError } from '@/types';
