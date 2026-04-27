-- ═══════════════════════════════════════════════════════════
-- subscriptions — Estado de assinaturas Google Play por usuário.
--
-- Por que clerk_user_id como PK em vez de user_id (UUID)?
--   `users` table não existe neste schema (auth é Clerk-first, não há
--   espelho local). `stores.clerk_user_id` é a chave canônica de "quem é
--   o dono". Manter o mesmo padrão aqui evita JOINs desnecessários no
--   /billing/verify e simplifica o RTDN handler.
--
-- Por que purchase_token UNIQUE em vez de PK?
--   Um usuário pode trocar de plano (essencial → pro): o purchase_token
--   muda mas o user é o mesmo. Queremos sempre 1 row por user (estado
--   atual), então PK no user. UNIQUE no token garante idempotência:
--   se RTDN entrega o mesmo evento 2x, o ON CONFLICT detecta.
--
-- Por que sku separado de plan?
--   `sku` é o ID na Play Store (`pro_mensal`); `plan` é o nome interno
--   usado em `stores.plan` (`pro`). Um SKU pode mudar sem alterar o
--   plano (ex: trocar preço), e o backend já tem lógica baseada em
--   nome de plano em vários lugares (getModelLimitForPlan, etc).
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscriptions (
  clerk_user_id text PRIMARY KEY,
  sku text NOT NULL,
  plan text NOT NULL,
  purchase_token text NOT NULL,
  expiry_time timestamptz NOT NULL,
  state text NOT NULL,
  auto_renewing boolean NOT NULL DEFAULT true,
  acknowledged boolean NOT NULL DEFAULT false,
  linked_purchase_token text,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_purchase_token_unique UNIQUE (purchase_token)
);

CREATE INDEX IF NOT EXISTS subscriptions_state_idx ON public.subscriptions(state);
CREATE INDEX IF NOT EXISTS subscriptions_expiry_idx ON public.subscriptions(expiry_time);

-- Trigger para updated_at automático.
CREATE OR REPLACE FUNCTION public.set_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_subscriptions_updated_at();

-- RLS desligado — só backend (service_role) lê/escreve.
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- Estados conhecidos do RTDN (para referência — não enforced):
--   PURCHASED, RENEWED, IN_GRACE_PERIOD, ON_HOLD, PAUSED,
--   CANCELED, EXPIRED, REVOKED, RESTARTED, RECOVERED,
--   PRICE_CHANGE_CONFIRMED, DEFERRED, PAUSE_SCHEDULE_CHANGED
-- ═══════════════════════════════════════════════════════════
