# Rate Limit — Postgres token bucket (Phase 4 D-04/D-05)

## Current implementation

Token bucket via SECURITY DEFINER RPC `consume_rate_limit_token(key, capacity, refill_rate, refill_interval_seconds)`.
State persists in `rate_limit_buckets`. Service-role-only writes (RLS enabled, no policies).

Helper: `src/lib/rate-limit-pg.ts` → `consumeTokenBucket(key, capacity, refillRate, refillIntervalSec)`.

Failure mode: RPC error → fail OPEN (return allowed=true) + Sentry `ratelimit_pg_rpc_error_failopen`.
This avoids 429-ing paying users on a DB blip; for anon-abuse the bucket is the only gate.

## When to migrate to Redis (D-08, parking lot)

Symptoms:
- p95 RPC latency on `consume_rate_limit_token` > 20ms (target: ≤10ms per D-05).
- `rate_limit_buckets` row count > 100k and growing (no GC cron yet).
- DB CPU spikes on POST-heavy traffic spikes.

Migration path (NOT executed in M1):
1. Add `REDIS_URL` env var; install `ioredis` or `@upstash/redis`.
2. Mirror `consumeTokenBucket` API exactly — caller (e.g., `/api/campaign/generate`) only needs to swap the import.
3. Use Lua `EVAL` for atomic refill + decrement (single round-trip, mirrors D-05).
4. Run both backends in parallel for 1 week (write to both, read from Postgres, log divergence).
5. Cut over reads when divergence < 0.1%.

## GC sweep (parking lot)

Cron `DELETE FROM rate_limit_buckets WHERE updated_at < now() - interval '24 hours'` keeps the table bounded.
Index `idx_rate_limit_buckets_updated_at` already exists for this. Schedule: nightly via Vercel Cron or Inngest.
Not in M1 — table will grow ~100 rows/day per active user, well within free tier for months.
