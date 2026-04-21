-- Campo opcional de título para campanhas + número sequencial por loja
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- Preencher sequence_number nas campanhas existentes (por loja, ordem de criação)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at ASC) AS seq
  FROM campaigns
)
UPDATE campaigns c
SET sequence_number = n.seq
FROM numbered n
WHERE c.id = n.id AND c.sequence_number IS NULL;

-- Função para auto-gerar sequence_number ao inserir
CREATE OR REPLACE FUNCTION set_campaign_sequence_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sequence_number IS NULL THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1
    INTO NEW.sequence_number
    FROM campaigns
    WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_sequence ON campaigns;
CREATE TRIGGER trg_campaign_sequence
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION set_campaign_sequence_number();
