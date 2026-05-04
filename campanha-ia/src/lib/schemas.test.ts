import { describe, it, expect } from "vitest";
import {
  CampaignInputSchema,
  VisionOutputSchema,
  StrategyOutputSchema,
  CopyOutputSchema,
  ScoreOutputSchema,
  StoreOnboardingSchema,
  ModelCreateSchema,
} from "./schemas";

describe("CampaignInputSchema", () => {
  it("accepts minimal valid input (only price)", () => {
    const r = CampaignInputSchema.safeParse({ price: 99.9 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.objective).toBe("venda_imediata"); // default
      expect(r.data.use_model).toBe(true);
      expect(r.data.background_type).toBe("branco");
      expect(r.data.channels).toContain("instagram_feed");
    }
  });
  it("rejects negative or zero price", () => {
    expect(CampaignInputSchema.safeParse({ price: 0 }).success).toBe(false);
    expect(CampaignInputSchema.safeParse({ price: -10 }).success).toBe(false);
  });
  it("rejects invalid enum values", () => {
    const r = CampaignInputSchema.safeParse({ price: 1, objective: "xpto" });
    expect(r.success).toBe(false);
  });
  it("rejects non-uuid model_id", () => {
    const r = CampaignInputSchema.safeParse({ price: 1, model_id: "abc" });
    expect(r.success).toBe(false);
  });
});

describe("VisionOutputSchema", () => {
  it("supplies defaults for an empty object", () => {
    const r = VisionOutputSchema.parse({});
    expect(r.produto.nome_generico).toBe("Produto de moda");
    expect(r.segmento).toBe("feminino");
    expect(r.atributos_visuais.cor_principal).toBe("Não identificada");
    expect(r.qualidade_foto.resolucao).toBe("media");
    expect(r.nicho_sensivel).toBe(false);
    expect(r.mood).toEqual(["moda"]);
  });
  it("accepts nicho_sensivel as object", () => {
    const r = VisionOutputSchema.parse({
      nicho_sensivel: { tipo: "infantil", alerta: "menor de idade" },
    });
    expect(r.nicho_sensivel).toEqual({ tipo: "infantil", alerta: "menor de idade" });
  });
});

describe("StrategyOutputSchema + CopyOutputSchema", () => {
  it("StrategyOutputSchema requires all strategy fields", () => {
    const ok = StrategyOutputSchema.safeParse({
      angulo: "x",
      gatilho: "x",
      tom: "x",
      publico_ideal: "x",
      contra_objecao: "x",
      cta_sugerido: "x",
    });
    expect(ok.success).toBe(true);
    expect(StrategyOutputSchema.safeParse({}).success).toBe(false);
  });
  it("CopyOutputSchema enforces meta_ads max-length constraints", () => {
    const longTitle = "a".repeat(41);
    const r = CopyOutputSchema.safeParse({
      headline_principal: "x",
      headline_variacao_1: "x",
      headline_variacao_2: "x",
      instagram_feed: "x",
      instagram_stories: { slide_1: "x", slide_2: "x", slide_3: "x", cta_final: "x" },
      whatsapp: "x",
      meta_ads: {
        titulo: longTitle,
        texto_principal: "x",
        descricao: "x",
        cta_button: "x",
      },
      hashtags: ["#a", "#b", "#c", "#d", "#e"],
    });
    expect(r.success).toBe(false);
  });
});

describe("ScoreOutputSchema", () => {
  it("accepts a valid score payload", () => {
    const r = ScoreOutputSchema.safeParse({
      nota_geral: 80,
      conversao: 70,
      clareza: 75,
      urgencia: 60,
      naturalidade: 90,
      aprovacao_meta: 85,
      nivel_risco: "baixo",
      resumo: "ok",
      pontos_fortes: ["x"],
      melhorias: [],
      alertas_meta: null,
    });
    expect(r.success).toBe(true);
  });
  it("rejects nota_geral > 100 or unknown nivel_risco", () => {
    expect(
      ScoreOutputSchema.safeParse({
        nota_geral: 101,
        conversao: 0,
        clareza: 0,
        urgencia: 0,
        naturalidade: 0,
        aprovacao_meta: 0,
        nivel_risco: "baixo",
        resumo: "",
        pontos_fortes: [],
        melhorias: [],
        alertas_meta: null,
      }).success,
    ).toBe(false);
    expect(
      ScoreOutputSchema.safeParse({
        nota_geral: 1,
        conversao: 0,
        clareza: 0,
        urgencia: 0,
        naturalidade: 0,
        aprovacao_meta: 0,
        nivel_risco: "extremo",
        resumo: "",
        pontos_fortes: [],
        melhorias: [],
        alertas_meta: null,
      }).success,
    ).toBe(false);
  });
});

describe("StoreOnboardingSchema + ModelCreateSchema", () => {
  it("StoreOnboardingSchema rejects too-short name", () => {
    expect(
      StoreOnboardingSchema.safeParse({ name: "a", segment_primary: "moda" }).success,
    ).toBe(false);
  });
  it("StoreOnboardingSchema accepts minimal", () => {
    expect(
      StoreOnboardingSchema.safeParse({ name: "Minha Loja", segment_primary: "moda" }).success,
    ).toBe(true);
  });
  it("ModelCreateSchema accepts canonical enum values", () => {
    const r = ModelCreateSchema.safeParse({
      skin_tone: "morena",
      hair_texture: "ondulado",
      hair_length: "medio",
      hair_color: "castanho",
      body_type: "media",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.style).toBe("casual_natural"); // default
      expect(r.data.age_range).toBe("adulta_26_35"); // default
    }
  });
  it("ModelCreateSchema rejects invalid skin_tone", () => {
    const r = ModelCreateSchema.safeParse({
      skin_tone: "neon",
      hair_texture: "liso",
      hair_length: "curto",
      hair_color: "preto",
      body_type: "media",
    });
    expect(r.success).toBe(false);
  });
});
