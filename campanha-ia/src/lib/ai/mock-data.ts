/**
 * Dados mock para funcionar sem API key.
 * Usado quando ANTHROPIC_API_KEY não está configurada.
 */

import type { VisionAnalysis, Strategy, CampaignOutput, CampaignScore } from "@/types";

export const MOCK_VISION: VisionAnalysis = {
  produto: {
    nome_generico: "Vestido midi floral",
    categoria: "Vestidos",
    subcategoria: "Midi",
  },
  segmento: "feminino",
  atributos_visuais: {
    cor_principal: "Rosa",
    cor_secundaria: "Verde (folhas)",
    material_aparente: "Viscose",
    estampa: "Floral tropical",
  },
  qualidade_foto: {
    resolucao: "boa",
    necessita_tratamento: false,
  },
  nicho_sensivel: false,
  mood: ["feminino", "romântico", "verão", "tropical"],
};

export const MOCK_STRATEGY: Strategy = {
  angulo: "Vestido perfeito para arrasar no verão — elegante, confortável e com estampa que é puro desejo",
  gatilho: "desejo",
  tom: "casual_energetico",
  publico_ideal: "Mulheres 25-45 anos, classes B/C, que compram moda pelo Instagram e valorizam conforto com estilo",
  contra_objecao: "Tecido leve que não amassa e caimento que favorece todos os corpos",
  cta_sugerido: "Chama no direct que a gente envia para você! 💬",
};

export const MOCK_OUTPUT: Omit<CampaignOutput, "id" | "campaign_id"> = {
  vision_analysis: MOCK_VISION,
  strategy: MOCK_STRATEGY,
  headline_principal: "O vestido que vai ser seu favorito nesse verão 🌺",
  headline_variacao_1: "Estampa floral + conforto = match perfeito",
  headline_variacao_2: "Peça coringa dos dias quentes chegou!",
  instagram_feed: `🌺 Gente, olha essa PERFEIÇÃO que acabou de chegar!

Vestido midi floral com estampa tropical — aquele tipo de peça que você veste e já se sente linda, sabe?

✨ Tecido leve de viscose (não amassa!)
✨ Caimento que favorece todos os corpos
✨ Versatilidade: vai do almoço ao happy hour

De R$ 189,90 💰

Poucas unidades! Corre no direct antes que esgote 💬

#modafeminina #vestidofloral #vestidimidi #lookdodia #modaverão #tendencia2026`,
  instagram_stories: {
    slide_1: "🌺 NOVIDADE NA LOJA! Swipe pra ver →",
    slide_2: "Vestido midi floral em viscose — leve, fresco e LINDO demais!",
    slide_3: "R$ 189,90 ✨ Últimas unidades!",
    cta_final: "Responde esse story com 'EU QUERO' 💬",
  },
  whatsapp: `Oi! 😊

Acabou de chegar uma peça que é a SUA cara!

*Vestido Midi Floral* 🌺
Tecido de viscose super leve, estampa tropical linda e caimento maravilhoso!

*R$ 189,90*

Disponível nos tamanhos P ao GG.
Poucas unidades, viu? 😉

Quer reservar o seu? Me manda o tamanho! 💬`,
  meta_ads: {
    titulo: "Vestido Midi Floral — Novidade!",
    texto_principal: "Estampa tropical + tecido leve = look perfeito para o verão. A partir de R$ 189,90",
    descricao: "Disponível do P ao GG",
    cta_button: "shop_now",
  },
  hashtags: [
    "modafeminina", "vestidofloral", "vestidimidi", "lookdodia",
    "modaverão", "tendencia2026", "roupasfemininas", "estilobrasileiro",
    "modapraia", "lookdeverão", "viscose", "estampafloral",
  ],
  product_image_clean_url: null,
  model_image_url: null,
  lifestyle_image_url: null,
  creative_feed_url: null,
  creative_stories_url: null,
  refinements: [
    {
      campo: "instagram_feed",
      antes: "Compre já",
      depois: "Corre no direct antes que esgote",
      motivo: "Tom mais natural e pessoal, típico de lojistas de Instagram",
    },
  ],
};

export const MOCK_SCORE: Omit<CampaignScore, "id" | "campaign_id"> = {
  nota_geral: 87,
  conversao: 85,
  clareza: 92,
  urgencia: 78,
  naturalidade: 90,
  aprovacao_meta: 88,
  nivel_risco: "baixo",
  resumo: "Campanha forte com tom natural e boa estrutura. Textos persuasivos sem parecer spam.",
  pontos_fortes: [
    "Tom de voz autêntico e natural",
    "Preço bem posicionado no texto",
    "CTA claro em todos os canais",
  ],
  melhorias: [
    {
      campo: "instagram_stories",
      problema: "Slide 3 poderia ter mais urgência",
      sugestao: "Adicionar 'Só hoje' ou 'Últimas 5 peças' para criar mais FOMO",
    },
  ],
  alertas_meta: [],
};

/**
 * Simula o pipeline com delay para parecer real
 */
export async function runMockPipeline(delayMs = 800): Promise<{
  vision: VisionAnalysis;
  strategy: Strategy;
  output: Omit<CampaignOutput, "id" | "campaign_id">;
  score: Omit<CampaignScore, "id" | "campaign_id">;
  durationMs: number;
}> {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, delayMs));
  return {
    vision: MOCK_VISION,
    strategy: MOCK_STRATEGY,
    output: MOCK_OUTPUT,
    score: MOCK_SCORE,
    durationMs: Date.now() - start,
  };
}
