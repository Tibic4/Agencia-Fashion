-- ═══════════════════════════════════════════════════════════
-- Phase 4 / 04-01 — D-05: token bucket RPC. Single round-trip per request.
-- Refill model: continuous — tokens added = floor(elapsed_seconds / refill_interval) * refill_rate.
-- Cap at `capacity`. If after refill tokens >= 1, decrement and return allowed=true.
-- Otherwise return allowed=false with retry_after_ms = ceil((1 - tokens) * refill_interval / refill_rate * 1000).
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.consume_rate_limit_token(
  p_key                    TEXT,
  p_capacity               INTEGER,
  p_refill_rate            INTEGER,           -- tokens added per refill_interval
  p_refill_interval_seconds INTEGER           -- seconds between refills
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_ms INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now            TIMESTAMPTZ := now();
  v_current_tokens NUMERIC;
  v_refilled_at    TIMESTAMPTZ;
  v_elapsed        NUMERIC;
  v_refill_amount  NUMERIC;
  v_new_tokens     NUMERIC;
BEGIN
  -- Validate input
  IF p_capacity IS NULL OR p_capacity <= 0 OR p_capacity > 1000000 THEN
    RAISE EXCEPTION 'invalid capacity: %', p_capacity;
  END IF;
  IF p_refill_rate IS NULL OR p_refill_rate <= 0 OR p_refill_rate > p_capacity THEN
    RAISE EXCEPTION 'invalid refill_rate: %', p_refill_rate;
  END IF;
  IF p_refill_interval_seconds IS NULL OR p_refill_interval_seconds <= 0 THEN
    RAISE EXCEPTION 'invalid refill_interval_seconds: %', p_refill_interval_seconds;
  END IF;

  -- Upsert + refill in one statement. ON CONFLICT updates tokens via refill formula.
  INSERT INTO public.rate_limit_buckets (key, tokens, refilled_at, updated_at)
  VALUES (p_key, p_capacity, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
    SET tokens = LEAST(
        EXCLUDED.tokens::NUMERIC, -- ignored (placeholder; we recompute below)
        public.rate_limit_buckets.tokens + (
          FLOOR(EXTRACT(EPOCH FROM (v_now - public.rate_limit_buckets.refilled_at)) / p_refill_interval_seconds)::INTEGER
          * p_refill_rate
        )
      )::INTEGER,
      refilled_at = public.rate_limit_buckets.refilled_at
        + (
          FLOOR(EXTRACT(EPOCH FROM (v_now - public.rate_limit_buckets.refilled_at)) / p_refill_interval_seconds)
          * p_refill_interval_seconds
          * INTERVAL '1 second'
        ),
      updated_at = v_now
  RETURNING public.rate_limit_buckets.tokens, public.rate_limit_buckets.refilled_at
    INTO v_current_tokens, v_refilled_at;

  -- Cap at capacity (LEAST in the UPDATE didn't apply correctly when bucket was below capacity).
  v_current_tokens := LEAST(v_current_tokens, p_capacity);

  -- Decision: do we have at least 1 token?
  IF v_current_tokens >= 1 THEN
    UPDATE public.rate_limit_buckets
      SET tokens = (v_current_tokens - 1)::INTEGER, updated_at = v_now
      WHERE key = p_key;
    RETURN QUERY SELECT TRUE, (v_current_tokens - 1)::INTEGER, 0;
  ELSE
    -- Compute time until next token: (1 - tokens) tokens * (interval / rate) seconds, in ms
    RETURN QUERY SELECT
      FALSE,
      0,
      CEIL(((1.0 - v_current_tokens) * p_refill_interval_seconds * 1000.0) / p_refill_rate)::INTEGER;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit_token(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit_token(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit_token IS
  'Phase 4 D-05: token bucket consumer. Returns (allowed, remaining, retry_after_ms). Single round-trip. Service-role only.';
