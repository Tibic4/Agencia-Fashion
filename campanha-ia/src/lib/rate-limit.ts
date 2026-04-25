/**
 * Rate limiter simples em memória por IP
 * Previne abuso de geração de campanhas (múltiplas contas, spam)
 * 
 * Limites ANÔNIMOS (sem auth):
 * - Máx 3 campanhas por IP por hora
 * - Máx 8 campanhas por IP por dia
 * 
 * Limites AUTENTICADOS (com Clerk userId):
 * - Máx 15 campanhas por IP por hora
 * - Máx 50 campanhas por IP por dia
 * (Usuários autenticados já têm limite de plano, rate limit é só anti-abuso)
 * 
 * NOTA: Este rate limiter é IN-MEMORY e perde estado no restart.
 * Ideal para VPS com processo único. Para multi-instância, usar Redis.
 */

interface RateEntry {
  count: number;
  resetAt: number;
}

const hourlyMap = new Map<string, RateEntry>();
const dailyMap = new Map<string, RateEntry>();

// Limites para usuários NÃO autenticados (anti-abuso)
const ANON_HOURLY_LIMIT = 3;
const ANON_DAILY_LIMIT = 8;

// Limites para usuários autenticados (bem mais generosos)
const AUTH_HOURLY_LIMIT = 15;
const AUTH_DAILY_LIMIT = 50;

// Limpa entradas expiradas a cada 10 minutos.
// guarda o interval no globalThis para limpar em HMR (Next dev).
// Em produção roda só uma vez porque module cache não é invalidado.
declare global {
  // eslint-disable-next-line no-var
  var __crialook_ratelimit_interval: ReturnType<typeof setInterval> | undefined;
}
if (globalThis.__crialook_ratelimit_interval) {
  clearInterval(globalThis.__crialook_ratelimit_interval);
}
globalThis.__crialook_ratelimit_interval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hourlyMap) {
    if (now > entry.resetAt) hourlyMap.delete(key);
  }
  for (const [key, entry] of dailyMap) {
    if (now > entry.resetAt) dailyMap.delete(key);
  }
}, 10 * 60 * 1000);

export function checkRateLimit(
  ip: string,
  options?: { authenticated?: boolean }
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const isAuth = options?.authenticated ?? false;
  const hourlyLimit = isAuth ? AUTH_HOURLY_LIMIT : ANON_HOURLY_LIMIT;
  const dailyLimit = isAuth ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;

  // Chave separada para auth vs anon (evita poluição cruzada)
  const key = isAuth ? `auth:${ip}` : ip;

  // ── Check horário ──
  const hourly = hourlyMap.get(key);
  if (hourly) {
    if (now > hourly.resetAt) {
      hourlyMap.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    } else if (hourly.count >= hourlyLimit) {
      return { allowed: false, retryAfterMs: hourly.resetAt - now };
    } else {
      hourly.count++;
    }
  } else {
    hourlyMap.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
  }

  // ── Check diário ──
  const daily = dailyMap.get(key);
  if (daily) {
    if (now > daily.resetAt) {
      dailyMap.set(key, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    } else if (daily.count >= dailyLimit) {
      return { allowed: false, retryAfterMs: daily.resetAt - now };
    } else {
      daily.count++;
    }
  } else {
    dailyMap.set(key, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  }

  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════
// Login brute-force limiter (uso: editor-auth, futuros logins)
// Janela deslizante: N tentativas em M minutos
// ═══════════════════════════════════════════════════════════

interface AttemptsEntry {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number;
}

const loginAttempts = new Map<string, AttemptsEntry>();

export interface LoginLimitOptions {
  key: string; // e.g. "editor-auth:<ip>"
  maxAttempts?: number; // default 5
  windowMs?: number; // default 15min
  blockDurationMs?: number; // default 1h
}

export function checkLoginRateLimit(opts: LoginLimitOptions): {
  allowed: boolean;
  retryAfterMs?: number;
  attemptsRemaining?: number;
} {
  const now = Date.now();
  const max = opts.maxAttempts ?? 5;
  const window = opts.windowMs ?? 15 * 60 * 1000;
  const blockDur = opts.blockDurationMs ?? 60 * 60 * 1000;
  const entry = loginAttempts.get(opts.key);

  // Bloqueado?
  if (entry && now < entry.blockedUntil) {
    return { allowed: false, retryAfterMs: entry.blockedUntil - now };
  }

  // Janela expirou: reinicia
  if (!entry || now - entry.firstAttemptAt > window) {
    loginAttempts.set(opts.key, { count: 1, firstAttemptAt: now, blockedUntil: 0 });
    return { allowed: true, attemptsRemaining: max - 1 };
  }

  // Dentro da janela
  entry.count++;
  if (entry.count > max) {
    entry.blockedUntil = now + blockDur;
    return { allowed: false, retryAfterMs: blockDur };
  }
  return { allowed: true, attemptsRemaining: max - entry.count };
}

export function resetLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}
