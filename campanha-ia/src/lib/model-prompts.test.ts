import { describe, it, expect } from "vitest";
import {
  buildGeminiParts,
  buildHairDescription,
  HAIR_COLOR_DESC,
  HAIR_LENGTH_DESC,
  HAIR_TEXTURE_DESC,
  POSE_DESC,
  POSE_SIMPLE,
  SKIN_DESC,
} from "./model-prompts";

describe("descriptor maps", () => {
  it("SKIN_DESC has the 4 canonical tones", () => {
    expect(SKIN_DESC.branca).toMatch(/fair/);
    expect(SKIN_DESC.morena_clara).toMatch(/olive|honey/);
    expect(SKIN_DESC.morena).toMatch(/medium-brown/);
    expect(SKIN_DESC.negra).toMatch(/deep/);
  });
  it("HAIR_TEXTURE_DESC, HAIR_LENGTH_DESC, HAIR_COLOR_DESC all populated", () => {
    expect(Object.keys(HAIR_TEXTURE_DESC).length).toBeGreaterThan(0);
    expect(Object.keys(HAIR_LENGTH_DESC).length).toBeGreaterThan(0);
    expect(Object.keys(HAIR_COLOR_DESC).length).toBeGreaterThan(0);
  });
  it("POSE_DESC entries all reference POSE_SIMPLE (legacy aliases)", () => {
    for (const v of Object.values(POSE_DESC)) {
      expect(v).toBe(POSE_SIMPLE);
    }
  });
});

describe("buildHairDescription", () => {
  it("composes a 3-part description", () => {
    const r = buildHairDescription("ondulado", "medio", "loiro");
    expect(r).toMatch(/wavy/);
    expect(r).toMatch(/blonde/);
    expect(r).toMatch(/shoulder/);
  });
  it("falls back to defaults when fields missing", () => {
    const r = buildHairDescription();
    expect(r).toMatch(/wavy/);
    expect(r).toMatch(/brown/);
  });
  it("partial fields use only the matching map", () => {
    const r = buildHairDescription("liso");
    expect(r).toMatch(/straight/);
  });
});

describe("buildGeminiParts (text-only mode)", () => {
  const baseTraits = {
    skinTone: "morena",
    hairStyle: "liso",
    bodyType: "media",
    style: "casual_natural",
    ageRange: "adulta_26_35",
  };

  it("returns a single text part when no faceBase64 provided", () => {
    const parts = buildGeminiParts(baseTraits);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveProperty("text");
    const text = (parts[0] as { text: string }).text;
    expect(text).toMatch(/PHOTOREALISTIC/);
    expect(text).toMatch(/Brazilian woman/);
  });

  it("uses masculine wording when gender=masculino", () => {
    const parts = buildGeminiParts({ ...baseTraits, gender: "masculino" });
    const text = (parts[0] as { text: string }).text;
    expect(text).toMatch(/Brazilian man/);
  });

  it("composes hair from granular fields when present", () => {
    const parts = buildGeminiParts({
      ...baseTraits,
      hairTexture: "ondulado",
      hairLength: "longo",
      hairColor: "ruivo",
    });
    const text = (parts[0] as { text: string }).text;
    expect(text).toMatch(/wavy/);
    expect(text).toMatch(/auburn|red/);
  });
});

describe("buildGeminiParts (multimodal mode)", () => {
  const baseTraits = {
    skinTone: "branca",
    hairStyle: "ondulado",
    bodyType: "magra",
    style: "casual_natural",
    ageRange: "jovem_18_25",
  };

  it("returns inline image part + text part when faceBase64 provided", () => {
    const parts = buildGeminiParts(baseTraits, "BASE64DATA", "image/png");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty("inlineData");
    const inline = (parts[0] as { inlineData: { mimeType: string; data: string } }).inlineData;
    expect(inline.mimeType).toBe("image/png");
    expect(inline.data).toBe("BASE64DATA");
    expect(parts[1]).toHaveProperty("text");
  });

  it("defaults inline mimeType to image/jpeg", () => {
    const parts = buildGeminiParts(baseTraits, "DATA");
    const inline = (parts[0] as { inlineData: { mimeType: string; data: string } }).inlineData;
    expect(inline.mimeType).toBe("image/jpeg");
  });

  it("hairFromPhoto=true skips hair description and instructs replication", () => {
    const parts = buildGeminiParts({ ...baseTraits, hairFromPhoto: true }, "DATA");
    const text = (parts[1] as { text: string }).text;
    expect(text).toMatch(/REPLICATE the EXACT hair from the reference photo/);
  });
});
