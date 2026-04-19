-- RPC atômica para adicionar créditos sem race condition
CREATE OR REPLACE FUNCTION add_credits_atomic(
  p_store_id UUID,
  p_column TEXT,
  p_quantity INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_val INTEGER;
BEGIN
  IF p_column NOT IN ('credit_campaigns', 'credit_models', 'credit_regenerations') THEN
    RAISE EXCEPTION 'Coluna inválida: %', p_column;
  END IF;

  EXECUTE format(
    'UPDATE stores SET %I = COALESCE(%I, 0) + $1 WHERE id = $2 RETURNING %I',
    p_column, p_column, p_column
  )
  INTO new_val
  USING p_quantity, p_store_id;

  RETURN new_val;
END;
$$;
