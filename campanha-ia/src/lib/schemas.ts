import { z } from 'zod';

// ═══════════════════════════════════════
// Input: Dados para gerar campanha
// ═══════════════════════════════════════
export const CampaignInputSchema = z.object({
  price: z.number().positive('Preço deve ser positivo').max(999999),
  audience: z.enum([
    'mulheres_25_40',
    'jovens_18_25',
    'homens_25_45',
    'maes',
    'publico_geral',
    'premium',
  ]).optional(),
  objective: z.enum([
    'venda_imediata',
    'lancamento',
    'promocao',
    'engajamento',
  ]).default('venda_imediata'),
  tone: z.enum([
    'casual_energetico',
    'sofisticado',
    'urgente',
    'acolhedor',
    'divertido',
  ]).optional(),
  channels: z.array(
    z.enum(['instagram_feed', 'instagram_stories', 'whatsapp', 'meta_ads'])
  ).default(['instagram_feed', 'instagram_stories', 'whatsapp', 'meta_ads']),
  use_model: z.boolean().default(true),
  model_id: z.string().uuid().optional(),
  background_type: z.enum(['branco', 'estudio', 'lifestyle', 'personalizado']).default('branco'),
  background_value: z.string().optional(),
});

export type CampaignInput = z.infer<typeof CampaignInputSchema>;

// ═══════════════════════════════════════
// Output: Vision Analyzer
// ═══════════════════════════════════════
export const VisionOutputSchema = z.object({
  produto: z.object({
    nome_generico: z.string(),
    categoria: z.string(),
    subcategoria: z.string(),
  }),
  segmento: z.string(),
  atributos_visuais: z.object({
    cor_principal: z.string(),
    cor_secundaria: z.string().nullable(),
    material_aparente: z.string(),
    estampa: z.string(),
  }),
  qualidade_foto: z.object({
    resolucao: z.enum(['boa', 'media', 'baixa']),
    necessita_tratamento: z.boolean(),
  }),
  nicho_sensivel: z.union([
    z.literal(false),
    z.object({ tipo: z.string(), alerta: z.string() }),
  ]),
  mood: z.array(z.string()).min(1).max(5),
});

// ═══════════════════════════════════════
// Output: Estrategista
// ═══════════════════════════════════════
export const StrategyOutputSchema = z.object({
  angulo: z.string(),
  gatilho: z.string(),
  tom: z.string(),
  publico_ideal: z.string(),
  contra_objecao: z.string(),
  cta_sugerido: z.string(),
});

// ═══════════════════════════════════════
// Output: Copywriter
// ═══════════════════════════════════════
export const CopyOutputSchema = z.object({
  headline_principal: z.string(),
  headline_variacao_1: z.string(),
  headline_variacao_2: z.string(),
  instagram_feed: z.string(),
  instagram_stories: z.object({
    slide_1: z.string(),
    slide_2: z.string(),
    slide_3: z.string(),
    cta_final: z.string(),
  }),
  whatsapp: z.string(),
  meta_ads: z.object({
    titulo: z.string().max(40),
    texto_principal: z.string().max(125),
    descricao: z.string().max(30),
    cta_button: z.string(),
  }),
  hashtags: z.array(z.string()).min(5).max(15),
});

// ═══════════════════════════════════════
// Output: Scorer
// ═══════════════════════════════════════
export const ScoreOutputSchema = z.object({
  nota_geral: z.number().min(0).max(100),
  conversao: z.number().min(0).max(100),
  clareza: z.number().min(0).max(100),
  urgencia: z.number().min(0).max(100),
  naturalidade: z.number().min(0).max(100),
  aprovacao_meta: z.number().min(0).max(100),
  nivel_risco: z.enum(['baixo', 'medio', 'alto', 'critico']),
  resumo: z.string(),
  pontos_fortes: z.array(z.string()),
  melhorias: z.array(z.object({
    campo: z.string(),
    problema: z.string(),
    sugestao: z.string(),
  })),
  alertas_meta: z.array(z.object({
    trecho: z.string(),
    politica: z.string(),
    nivel: z.string(),
    correcao: z.string(),
  })).nullable(),
});

// ═══════════════════════════════════════
// Onboarding
// ═══════════════════════════════════════
export const StoreOnboardingSchema = z.object({
  name: z.string().min(2, 'Nome da loja deve ter pelo menos 2 caracteres').max(100),
  segment_primary: z.string().min(1, 'Selecione um segmento'),
  city: z.string().optional(),
  state: z.string().optional(),
  instagram_handle: z.string().optional(),
});

export const ModelCreateSchema = z.object({
  skin_tone: z.enum(['branca', 'morena_clara', 'morena', 'negra']),
  hair_style: z.enum(['liso', 'ondulado', 'cacheado', 'crespo', 'curto']),
  body_type: z.enum(['magra', 'media', 'plus_size']),
  style: z.enum(['casual_natural', 'elegante', 'esportivo', 'urbano']),
  age_range: z.enum(['jovem_18_25', 'adulta_26_35', 'madura_36_50']),
  name: z.string().max(20).optional(),
});

export type StoreOnboarding = z.infer<typeof StoreOnboardingSchema>;
export type ModelCreate = z.infer<typeof ModelCreateSchema>;
