/**
 * Rate limiter simples em memória por IP
 * Previne abuso de geração de campanhas (múltiplas contas, spam)
 * 
 * Limites:
 * - Máx 5 campanhas por IP por hora
 * - Máx 15 campanhas por IP por dia
 */

interface RateEntry {
  count: number;
  resetAt: number;
}

const hourlyMap = new Map<string, RateEntry>();
const dailyMap = new Map<string, RateEntry>();

const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 15;

// Limpa entradas expiradas a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hourlyMap) {
    if (now > entry.resetAt) hourlyMap.delete(key);
  }
  for (const [key, entry] of dailyMap) {
    if (now > entry.resetAt) dailyMap.delete(key);
  }
}, 10 * 60 * 1000);

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();

  // ── Check horário ──
  const hourly = hourlyMap.get(ip);
  if (hourly) {
    if (now > hourly.resetAt) {
      hourlyMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    } else if (hourly.count >= HOURLY_LIMIT) {
      return { allowed: false, retryAfterMs: hourly.resetAt - now };
    } else {
      hourly.count++;
    }
  } else {
    hourlyMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
  }

  // ── Check diário ──
  const daily = dailyMap.get(ip);
  if (daily) {
    if (now > daily.resetAt) {
      dailyMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    } else if (daily.count >= DAILY_LIMIT) {
      return { allowed: false, retryAfterMs: daily.resetAt - now };
    } else {
      daily.count++;
    }
  } else {
    dailyMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  }

  return { allowed: true };
}
