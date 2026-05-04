-- ═══════════════════════════════════════════════════════════
-- Phase 1 / 01-01 — D-05/D-06/D-07/D-08: webhook_events dedup table
-- Provider+event_id PK gives crash-safe dedup for MP, Clerk, Google Play RTDN.
-- Pattern: handler INSERTs first; ON CONFLICT (PK violation 23505) → duplicate, return 200.
-- payload kept JSONB for forensics (D-08; retention is parking-lot, not M1).
-- RLS enabled with NO policies → only service_role bypass-RLS can read/write.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.webhook_events (
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload      JSONB,
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- INTENTIONAL: no policies created. Service-role bypasses RLS; anon/authenticated get zero access.
-- Matches push_tokens / subscriptions pattern (20260427_*.sql).

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
  ON public.webhook_events (received_at DESC);

COMMENT ON TABLE public.webhook_events IS
  'Phase 1 D-05: provider+event_id dedup for MP / Clerk / Google Play RTDN. Service-role-only writes; anon/authenticated have zero access (RLS enabled, no policies). Retention policy: parking-lot (not M1).';
