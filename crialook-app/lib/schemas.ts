/**
 * Validators runtime de respostas da API (zod).
 *
 * Os tipos em `@/types/index.ts` descrevem o que esperamos do backend, mas a
 * rede não dá garantia em compile-time. Sem validação runtime, uma regressão
 * que remove um campo aparece como "Cannot read properties of undefined" no
 * fundo de algum render. Com zod o erro é pego na fronteira da API com o
 * path exato do campo, dá pra degradar gracefully ou reportar pro Sentry com
 * payload útil.
 *
 * Uso:
 *   const data = await apiGet('/store/usage', { schema: StoreUsageResponse });
 *
 * Migração: callers adotam um endpoint de cada vez. Schemas são aditivos —
 * endpoints sem `schema` mantêm o cast `T` antigo.
 */
import { z } from 'zod';

export const CampaignSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  sequence_number: z.number().nullable(),
  objective: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  is_favorited: z.boolean(),
  pipeline_duration_ms: z.number().nullable().optional(),
  output: z
    .object({
      image_urls: z.array(z.string().nullable()).optional(),
      // Sinal de trial — ver isTrialCampaign() em @/types. Backend manda
      // camelCase; coluna no postgres é snake_case mas o serializer renomeia.
      lockedTeaserUrls: z.tuple([z.string(), z.string()]).optional(),
    })
    .nullable(),
});
export type CampaignZ = z.infer<typeof CampaignSchema>;

export const CampaignListResponse = z.object({
  data: z.array(CampaignSchema),
});

export const CampaignDetailResponse = z.object({
  data: CampaignSchema.extend({
    success: z.boolean().optional(),
  }),
});

export const StoreModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  skin_tone: z.string(),
  hair_style: z.string(),
  hair_texture: z.string().optional(),
  hair_length: z.string().optional(),
  hair_color: z.string().optional(),
  body_type: z.string(),
  gender: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  photo_url: z.string().nullable().optional(),
  preview_failed: z.boolean().optional(),
});

export const StoreUsageSchema = z.object({
  plan_name: z.string(),
  campaigns_generated: z.number(),
  campaigns_limit: z.number(),
  models_used: z.number(),
  models_limit: z.number(),
});
export const StoreUsageResponse = z.object({ data: StoreUsageSchema });

export const StoreCreditsSchema = z.object({
  campaigns: z.number(),
  models: z.number(),
});
export const StoreCreditsResponse = z.object({ data: StoreCreditsSchema });

export const StoreProfileResponse = z.object({
  data: z
    .object({
      name: z.string().optional(),
    })
    .nullable(),
});

export const QuotaDataSchema = z.object({
  used: z.number(),
  limit: z.number(),
  credits: z.number(),
});

export const PushTokenAck = z.object({ success: z.boolean().optional() }).passthrough();

/**
 * Subscription verificado retornado por `POST /billing/verify`. Loose de
 * propósito — dá pra estender o payload do backend (ex: info de trial) sem
 * quebrar clients antigos no shape estrito.
 */
export const VerifiedSubscriptionSchema = z
  .object({
    plan: z.string(),
    expiresAt: z.string(),
  })
  .passthrough();

/**
 * Helper genérico: parse + throw `ApiError` tipado em vez de erro zod cru.
 * Regressão de backend aparece como `code: 'SCHEMA_MISMATCH'` legível no
 * Sentry com o path do campo problemático em `body`.
 */
import { ApiError } from '@/types';

export function parseOrApiError<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const where = issue?.path?.join('.') ?? '<root>';
  const msg = issue?.message ?? 'invalid response';
  throw new ApiError(
    `Schema mismatch at ${path}: ${where} — ${msg}`,
    0,
    'UNKNOWN',
    JSON.stringify(r.error.issues).slice(0, 500),
  );
}
