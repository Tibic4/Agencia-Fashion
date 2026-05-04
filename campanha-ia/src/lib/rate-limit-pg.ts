/**
 * Phase 4 D-04 / D-05: Postgres-backed token bucket via consume_rate_limit_token RPC.
 *
 * Why: in-memory Map (src/lib/rate-limit.ts) loses state on PM2 restart (H-8).
 * Cloudflare also collapses every CF-fronted user to one bucket without
 * cf-connecting-ip preference (D-06).
 *
 * Failure mode: RPC errors → fail OPEN (return allowed=true) BUT capture via Sentry.
 * For anon-abuse the bucket is the gate of last resort, but a DB blip should NOT
 * 429 paying users. Caller decides on stricter behavior if the use case is more
 * sensitive (e.g., login brute-force should fail closed).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";

export interface BucketResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function consumeTokenBucket(
  key: string,
  capacity: number,
  refillRate: number,
  refillIntervalSec: number,
): Promise<BucketResult> {
  if (!key) {
    throw new Error("consumeTokenBucket: key required");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_rate_limit_token", {
    p_key: key,
    p_capacity: capacity,
    p_refill_rate: refillRate,
    p_refill_interval_seconds: refillIntervalSec,
  });
  if (error) {
    captureError(error, { route: "rate-limit-pg", key, phase: "rpc" });
    logger.warn("ratelimit_pg_rpc_error_failopen", { key, message: error.message });
    return { allowed: true, remaining: capacity - 1, retryAfterMs: 0 };
  }
  // .rpc on TABLE returns array of rows
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { allowed: true, remaining: capacity - 1, retryAfterMs: 0 };
  }
  return {
    allowed: !!row.allowed,
    remaining: Number(row.remaining ?? 0),
    retryAfterMs: Number(row.retry_after_ms ?? 0),
  };
}
