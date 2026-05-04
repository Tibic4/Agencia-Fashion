-- ═══════════════════════════════════════════════════════════
-- Phase 4 / 04-01 — D-04, D-07: Postgres-backed rate limit (token bucket)
-- Survives PM2 restart (closes H-8). Single PK on `key`, no FKs (key is opaque
-- composite — `<route>:<store_id-or-ip-hash>`). RLS enabled with NO policies →
-- only service_role bypass-RLS can read/write. Mirrors webhook_events pattern.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key          TEXT PRIMARY KEY,
  tokens       INTEGER NOT NULL,
  refilled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- INTENTIONAL: no policies. Service-role bypasses RLS; anon/authenticated have zero access.
-- Matches webhook_events / push_tokens / subscriptions pattern.

-- Index supports the future GC sweep (delete buckets unused for >24h).
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_updated_at
  ON public.rate_limit_buckets (updated_at);

COMMENT ON TABLE public.rate_limit_buckets IS
  'Phase 4 D-04: Postgres-backed token bucket. key = `<route>:<client_id>`. Service-role-only writes; anon/authenticated have zero access (RLS enabled, no policies). Survives PM2 restart (H-8).';
