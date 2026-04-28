export interface Campaign {
  id: string;
  title: string | null;
  sequence_number: number | null;
  objective: string | null;
  status: string;
  created_at: string;
  is_favorited: boolean;
  /* Tempo total do pipeline (analyze + VTO ×3 + copy). Usado pra exibir no
     history como "23s" / "1m 12s" — varia bastante por geração, então
     mostrar o tempo real é mais honesto que um placeholder fixo. */
  pipeline_duration_ms?: number | null;
  output: {
    image_urls?: (string | null)[];
  } | null;
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
