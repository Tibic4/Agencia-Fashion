/**
 * Validação tipada de variáveis de ambiente.
 *
 * Por que existe: em vez de espalhar `process.env.X` no código (e descobrir
 * em runtime que uma var faltava só quando o request bate na rota), aqui a
 * gente parseia tudo no boot. Se faltar alguma required, o server quebra
 * agora — não dois deploys depois quando alguém finalmente bate na rota.
 *
 * Uso:
 *   import { env } from "@/lib/env";
 *   const token = env.MERCADOPAGO_ACCESS_TOKEN;  // tipado, validado.
 *
 * O parse roda automaticamente em `src/instrumentation.ts` (Next.js carrega
 * no boot do server e do edge), então qualquer var faltando aborta antes
 * do primeiro request.
 *
 * Os arquivos legados que ainda fazem `process.env.X` continuam funcionando;
 * migramos pra `env.X` gradualmente.
 */
import { z } from "zod";

// Helper: var obrigatória só em produção. Em dev/test/CI a gente tolera placeholder.
//
// Schema é deliberadamente conservador: só checa "existe e tem tamanho mínimo
// razoável", não impõe prefixo/formato específico. Formatos de chave de
// fornecedor (pk_/sk_/sk-ant-/APP_USR-) mudam ao longo do tempo e travar boot
// só por causa disso é mais frágil do que útil.
const requiredInProd = (schema: z.ZodString) =>
  process.env.NODE_ENV === "production" ? schema : schema.optional();

const EnvSchema = z.object({
  // ── Core: nunca pode faltar em prod ──
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),

  // ── Supabase ──
  NEXT_PUBLIC_SUPABASE_URL: requiredInProd(z.string().min(10)),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredInProd(z.string().min(10)),
  SUPABASE_SERVICE_ROLE_KEY: requiredInProd(z.string().min(10)),

  // ── Clerk ──
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: requiredInProd(z.string().min(10)),
  CLERK_SECRET_KEY: requiredInProd(z.string().min(10)),
  CLERK_WEBHOOK_SECRET: requiredInProd(z.string().min(10)),
  CLERK_JWT_KEY: z.string().optional(),

  // ── Mercado Pago ──
  MERCADOPAGO_ACCESS_TOKEN: requiredInProd(z.string().min(10)),
  MERCADOPAGO_WEBHOOK_SECRET: requiredInProd(z.string().min(8)),

  // ── IA ──
  ANTHROPIC_API_KEY: requiredInProd(z.string().min(10)),
  // Aceita qualquer um dos 3 nomes — código tem fallback chain.
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  AI_MODEL_GEMINI_FLASH: z.string().optional(),
  FAL_KEY: z.string().optional(),
  FASHN_API_KEY: z.string().optional(),
  FASHN_API_URL: z.string().default("https://api.fashn.ai/v1"),

  // ── Editor standalone (auth próprio fora do Clerk) ──
  EDITOR_PASSWORD: z.string().optional(),
  EDITOR_SESSION_SECRET: z.string().optional(),

  // ── Admin / cron ──
  ADMIN_USER_IDS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  HEALTH_CHECK_SECRET: z.string().optional(),

  // ── Observability (build-time + runtime) ──
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),

  // ── Inngest ──
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // ── Mini-trial / experimentos ──
  // Killswitch fica como string flexível — quem consome decide o que é
  // truthy ("1"/"true"/"on"). Schema enum aqui era frágil: qualquer valor
  // fora da lista travava o boot inteiro.
  MINI_TRIAL_KILLSWITCH: z.string().optional(),
  MINI_TRIAL_TOTAL_SLOTS: z.coerce.number().int().positive().optional(),

  // ── Google Play (RTDN / Pub-Sub auth + service-account creds) ──
  // Used by /api/billing/rtdn + lib/payments/google-play.ts.
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH: z.string().optional(),
  GOOGLE_PUBSUB_AUDIENCE: z.string().optional(),
  GOOGLE_PUBSUB_ALLOWED_SERVICE_ACCOUNT: z.string().optional(),

  // ── Image proxy hardening ──
  // Comma-separated list of allowed image hosts (used by lib/security/image-host-allowlist).
  IMAGE_HOST_ALLOWLIST: z.string().optional(),

  // ── Misc ──
  USD_BRL_EXCHANGE_RATE: z.coerce.number().positive().optional(),
  API_BUDGET_MONTHLY_BRL: z.coerce.number().positive().optional(),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().optional(),
});

type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Faz parse e cacheia. Se falhar, joga erro com nomes das vars problemáticas.
 * Chamado de instrumentation.ts no boot — falha cedo.
 */
export function loadEnv(): Env {
  if (cached) return cached;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Não loga valor; só nome + razão. Evita vazar segredo no log.
    throw new Error(
      `[env] Variáveis de ambiente inválidas ou faltando:\n${issues}\n\n` +
        `Veja .env.example para o template completo.`,
    );
  }

  cached = result.data;
  return cached;
}

/**
 * Acesso tipado às vars validadas. Lazy: parseia na primeira leitura.
 *
 * Em prod, instrumentation.ts força parse no boot, então qualquer acesso
 * a `env.X` aqui já encontra o cache populado.
 *
 * Em testes que usam `vi.stubEnv` / mutam `process.env` por `it`, o cache
 * persistido entre cases pode vazar valores do primeiro parse. Ao invés
 * disso, no ambiente de teste o Proxy re-parseia em toda leitura — custo
 * desprezível em vitest e elimina toda uma classe de bugs flakey.
 */
const IS_TEST_ENV = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const env = new Proxy({} as Env, {
  get(_, key: string) {
    if (IS_TEST_ENV) {
      // Re-parseia toda chamada — vi.stubEnv / process.env mutations
      // entre `it` viram visíveis. Bypass cache só em test.
      const result = EnvSchema.safeParse(process.env);
      if (result.success) return result.data[key as keyof Env];
      // Em test, se schema falha, devolve o valor cru (test pode estar
      // testando edge cases inválidos).
      return process.env[key];
    }
    const e = loadEnv();
    return e[key as keyof Env];
  },
});

/**
 * Test-only escape hatch: limpa o cache do parse. Útil quando o test code
 * faz `vi.resetModules()` mas quer ter certeza que o próximo loadEnv lê
 * process.env atual.
 */
export function __resetEnvCacheForTests(): void {
  cached = null;
}
