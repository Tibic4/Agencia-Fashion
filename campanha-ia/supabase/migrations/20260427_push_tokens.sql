-- ═══════════════════════════════════════════════════════════
-- push_tokens — Expo push tokens por usuário (Clerk).
--
-- Por que clerk_user_id e não store_id?
--   O token é do dispositivo do usuário, não da loja. Um usuário sem loja
--   (logou mas pulou onboarding) ainda pode receber push de "complete seu
--   cadastro". Vincular à store atrasaria notificações para o caso comum.
--
-- Por que UNIQUE(clerk_user_id, token)?
--   Um usuário pode logar em vários devices (Android tablet + phone). Cada
--   token é único, mas o user pode ter N tokens. UNIQUE(user, token) evita
--   duplicar quando o app re-registra o mesmo token (ex: após reinstalar).
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'expo',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT push_tokens_user_token_unique UNIQUE (clerk_user_id, token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens(clerk_user_id);

-- RLS desligado: só o backend (service_role) acessa esta tabela.
-- Não há use-case de cliente ler/escrever direto.
ALTER TABLE public.push_tokens DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- Cascade no delete_store_cascade — remove tokens quando user apaga conta.
--
-- A função delete_store_cascade não conhece push_tokens (a tabela não
-- existia quando ela foi criada). Endpoint DELETE /api/me limpa direto
-- por clerk_user_id antes de chamar a RPC. Documentado aqui caso alguém
-- futuramente expanda a RPC.
-- ═══════════════════════════════════════════════════════════
