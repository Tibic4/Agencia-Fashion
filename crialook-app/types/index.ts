export interface Campaign {
  id: string;
  title: string | null;
  sequence_number: number | null;
  objective: string | null;
  status: string;
  created_at: string;
  is_favorited: boolean;
  /**
   * Token público pra compartilhamento (rota /preview/[token] do site).
   * Sem isso, o share manda pra /campaign/[id] que retorna 404 — não
   * existe rota pública por id, só por token.
   */
  preview_token?: string | null;
  /* Tempo total do pipeline (analyze + VTO ×3 + copy). Usado pra exibir no
     history como "23s" / "1m 12s" — varia bastante por geração, então
     mostrar o tempo real é mais honesto que um placeholder fixo. */
  pipeline_duration_ms?: number | null;
  output: {
    image_urls?: (string | null)[];
    /**
     * Trial-only: 2 thumbnails da foto da modelo blurada como teaser dos
     * "outros 2 ângulos" não gerados (slot esquerdo + direito). Quando
     * presente, resultado.tsx renderiza tira 3-thumb (locked · hero · locked)
     * abaixo da foto principal e abre paywall ao tap.
     *
     * Naming: backend serializa em camelCase no endpoint REST (ver
     * `campanha-ia/src/app/api/campaigns/[id]/route.ts`). A coluna do
     * Postgres é `locked_teaser_urls` mas o JSON saída é camelCase pra
     * convenção do app. **Não** mude pra snake_case sem alinhar o backend.
     */
    lockedTeaserUrls?: [string, string];
  } | null;
  /**
   * Nota geral da campanha (0–10) calculada pelo analisador no backend.
   * Vem como array (Postgres relação 1:N), mas hoje sempre é 0 ou 1 entrada.
   * Mostrado como badge no card do histórico — paridade com o site
   * (`campanha-ia/src/app/(auth)/historico/page.tsx`).
   */
  campaign_scores?: Array<{ nota_geral: number | null }>;
}

/** Trial campaign = a primeira (grátis) que mostra 1 foto + 2 ângulos
 *  blurados como teaser. Detecta-se pela presença de `lockedTeaserUrls`
 *  no payload. Single source of truth pra historico, resultado e qualquer
 *  futuro consumidor (analytics, badges, banner). */
export function isTrialCampaign(c: Pick<Campaign, 'output'>): boolean {
  return Array.isArray(c.output?.lockedTeaserUrls) && c.output!.lockedTeaserUrls!.length === 2;
}

export interface ModelItem {
  id: string;
  name: string;
  body_type: string;
  image_url?: string;
  thumbnail_url?: string | null;
  photo_url?: string | null;
  is_custom?: boolean;
}

export interface StoreModel {
  id: string;
  name: string;
  skin_tone: string;
  hair_style: string;
  hair_texture?: string;
  hair_length?: string;
  hair_color?: string;
  body_type: string;
  gender?: string;
  is_active: boolean;
  created_at: string;
  photo_url?: string | null;
  preview_failed?: boolean;
}

export interface StoreUsage {
  plan_name: string;
  campaigns_generated: number;
  campaigns_limit: number;
  models_used: number;
  models_limit: number;
}

export interface StoreCredits {
  campaigns: number;
  models: number;
}

export interface QuotaData {
  used: number;
  limit: number;
  credits: number;
}

export type ApiErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'MODEL_OVERLOADED'
  | 'SAFETY_BLOCKED'
  | 'IMAGE_GENERATION_BLOCKED'
  | 'BAD_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UNKNOWN';

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  body?: string;

  constructor(message: string, status: number, code: ApiErrorCode = 'UNKNOWN', body?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}
