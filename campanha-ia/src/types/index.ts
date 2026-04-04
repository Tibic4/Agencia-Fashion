// ═══════════════════════════════════════
// Tipos do banco de dados Supabase
// ═══════════════════════════════════════

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  stripe_price_id: string | null;
  campaigns_per_month: number;
  channels_per_campaign: number;
  models_limit: number;
  model_creations_per_month: number;
  regenerations_per_campaign: number;
  history_days: number;
  score_level: 'basic' | 'complete';
  has_preview_link: boolean;
  has_white_label: boolean;
  has_api_access: boolean;
  support_channel: string;
  is_active: boolean;
  sort_order: number;
}

export interface Store {
  id: string;
  clerk_user_id: string;
  name: string;
  segment_primary: string;
  segments_secondary: string[];
  city: string | null;
  state: string | null;
  logo_url: string | null;
  instagram_handle: string | null;
  brand_colors: Record<string, string>;
  plan_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  plan?: Plan;
}

export interface StoreModel {
  id: string;
  store_id: string;
  name: string;
  skin_tone: string;
  hair_style: string;
  body_type: string;
  style: string;
  age_range: string;
  eye_color: string;
  fashn_model_id: string | null;
  preview_url: string | null;
  is_active: boolean;
  created_at: string;
}

export type CampaignStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type BackgroundType = 'branco' | 'estudio' | 'lifestyle' | 'personalizado';

export interface Campaign {
  id: string;
  store_id: string;
  product_photo_url: string;
  product_photo_storage_path: string;
  price: number;
  target_audience: string | null;
  objective: string;
  tone_override: string | null;
  channels: string[];
  use_model: boolean;
  model_id: string | null;
  background_type: BackgroundType;
  background_value: string | null; // cor hex, preset name, ou URL custom
  status: CampaignStatus;
  pipeline_step: string | null;
  pipeline_started_at: string | null;
  pipeline_completed_at: string | null;
  pipeline_duration_ms: number | null;
  error_message: string | null;
  retry_count: number;
  generation_number: number;
  parent_campaign_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  outputs?: CampaignOutput;
  score?: CampaignScore;
}

export interface CampaignOutput {
  id: string;
  campaign_id: string;
  vision_analysis: VisionAnalysis | null;
  strategy: Strategy | null;
  headline_principal: string | null;
  headline_variacao_1: string | null;
  headline_variacao_2: string | null;
  instagram_feed: string | null;
  instagram_stories: InstagramStories | null;
  whatsapp: string | null;
  meta_ads: MetaAds | null;
  hashtags: string[];
  product_image_clean_url: string | null;
  model_image_url: string | null;
  lifestyle_image_url: string | null;
  creative_feed_url: string | null;
  creative_stories_url: string | null;
  refinements: Refinement[] | null;
}

export interface CampaignScore {
  id: string;
  campaign_id: string;
  nota_geral: number;
  conversao: number;
  clareza: number;
  urgencia: number;
  naturalidade: number;
  aprovacao_meta: number;
  nivel_risco: 'baixo' | 'medio' | 'alto' | 'critico';
  resumo: string | null;
  pontos_fortes: string[] | null;
  melhorias: ScoreMelhoria[] | null;
  alertas_meta: AlertaMeta[] | null;
}

export interface StoreUsage {
  id: string;
  store_id: string;
  period_start: string;
  period_end: string;
  campaigns_generated: number;
  campaigns_limit: number;
  regenerations_used: number;
  models_created: number;
  total_api_cost: number;
}

export interface CreditPurchase {
  id: string;
  store_id: string;
  type: 'campaigns' | 'models' | 'regenerations';
  quantity: number;
  price_brl: number;
  stripe_payment_id: string | null;
  period_start: string;
  period_end: string;
  consumed: number;
}

// ═══════════════════════════════════════
// Tipos do pipeline de IA
// ═══════════════════════════════════════

export interface VisionAnalysis {
  produto: {
    nome_generico: string;
    categoria: string;
    subcategoria: string;
  };
  segmento: string;
  atributos_visuais: {
    cor_principal: string;
    cor_secundaria: string | null;
    material_aparente: string;
    estampa: string;
  };
  qualidade_foto: {
    resolucao: 'boa' | 'media' | 'baixa';
    necessita_tratamento: boolean;
  };
  nicho_sensivel: false | { tipo: string; alerta: string };
  mood: string[];
}

export interface Strategy {
  angulo: string;
  gatilho: string;
  tom: string;
  publico_ideal: string;
  contra_objecao: string;
  cta_sugerido: string;
}

export interface InstagramStories {
  slide_1: string;
  slide_2: string;
  slide_3: string;
  cta_final: string;
}

export interface MetaAds {
  titulo: string;
  texto_principal: string;
  descricao: string;
  cta_button: string;
}

export interface Refinement {
  campo: string;
  antes: string;
  depois: string;
  motivo: string;
}

export interface ScoreMelhoria {
  campo: string;
  problema: string;
  sugestao: string;
}

export interface AlertaMeta {
  trecho: string;
  politica: string;
  nivel: string;
  correcao: string;
}

// ═══════════════════════════════════════
// Tipos auxiliares
// ═══════════════════════════════════════

export type PipelineStep =
  | 'vision'
  | 'strategy'
  | 'copywriter'
  | 'refiner'
  | 'scorer'
  | 'image_processing'
  | 'composition'
  | 'done';

export interface PipelineProgress {
  step: PipelineStep;
  label: string;
  progress: number; // 0-100
}

export const PIPELINE_STEPS: Record<PipelineStep, { label: string; progress: number }> = {
  vision: { label: 'Analisando produto...', progress: 10 },
  strategy: { label: 'Criando estratégia...', progress: 25 },
  copywriter: { label: 'Escrevendo textos...', progress: 45 },
  refiner: { label: 'Refinando copy...', progress: 60 },
  scorer: { label: 'Avaliando qualidade...', progress: 75 },
  image_processing: { label: 'Processando imagem...', progress: 85 },
  composition: { label: 'Montando criativo...', progress: 95 },
  done: { label: 'Pronto!', progress: 100 },
};

export const BACKGROUND_OPTIONS = [
  { value: 'branco', label: 'Fundo Branco', description: 'E-commerce clássico', preview: '#ffffff' },
  { value: 'estudio', label: 'Fundo Estúdio', description: 'Cores suaves profissionais' },
  { value: 'lifestyle', label: 'Fundo Lifestyle', description: 'Cenário IA (rua, café, praia)', ai: true },
  { value: 'personalizado', label: 'Seu Fundo', description: 'Envie sua própria imagem', upload: true },
] as const;

export const STUDIO_COLORS = [
  { name: 'Rosa Suave', hex: '#F5E6E0' },
  { name: 'Cinza Neutro', hex: '#E8E8E8' },
  { name: 'Bege Areia', hex: '#F0E6D3' },
  { name: 'Azul Gelo', hex: '#E0EAF0' },
  { name: 'Verde Menta', hex: '#E0F0E8' },
  { name: 'Lavanda', hex: '#E8E0F0' },
] as const;
