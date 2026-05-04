import { describe, it, expect } from "vitest";
import {
  AGE_MAP,
  BODY_MAP,
  HAIR_COLOR_MAP,
  HAIR_LENGTH_MAP,
  HAIR_TEXTURE_MAP,
  POSE_BANK,
  POSE_BANK_TOTAL,
  POSE_HISTORY_CAP,
  SKIN_TONE_MAP,
  buildIdentityLock,
  getStreakBlockedPose,
  isMaleGender,
  resolvePoseIndex,
  updatePoseHistory,
  validatePoseIndex,
} from "./identity-translations";

describe("translation maps", () => {
  it("SKIN_TONE_MAP covers the 4 canonical tones", () => {
    expect(SKIN_TONE_MAP.branca).toMatch(/fair/);
    expect(SKIN_TONE_MAP.morena_clara).toMatch(/light-medium/);
    expect(SKIN_TONE_MAP.morena).toMatch(/medium-to-dark/);
    expect(SKIN_TONE_MAP.negra).toMatch(/dark/);
  });
  it("BODY_MAP includes both feminine and masculine entries", () => {
    expect(BODY_MAP.media).toBeTruthy();
    expect(BODY_MAP.atletico).toBeTruthy();
    expect(BODY_MAP.robusto).toMatch(/male/);
  });
  it("HAIR_COLOR_MAP entries pair label + hex", () => {
    for (const v of Object.values(HAIR_COLOR_MAP)) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.hex).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
  it("HAIR_TEXTURE_MAP and HAIR_LENGTH_MAP have entries", () => {
    expect(Object.keys(HAIR_TEXTURE_MAP).length).toBeGreaterThan(0);
    expect(Object.keys(HAIR_LENGTH_MAP).length).toBeGreaterThan(0);
  });
  it("AGE_MAP supports both feminine and masculine adult variants", () => {
    expect(AGE_MAP.adulta_26_35).toMatch(/woman/);
    expect(AGE_MAP.adulto_26_35).toMatch(/man/);
  });
});

describe("isMaleGender", () => {
  it("recognizes masculino/male/m", () => {
    expect(isMaleGender("masculino")).toBe(true);
    expect(isMaleGender("male")).toBe(true);
    expect(isMaleGender("m")).toBe(true);
  });
  it("returns false for feminine or unknown values", () => {
    expect(isMaleGender("feminino")).toBe(false);
    expect(isMaleGender(undefined)).toBe(false);
    expect(isMaleGender("")).toBe(false);
  });
});

describe("buildIdentityLock", () => {
  it("returns null when modelInfo is undefined", () => {
    expect(buildIdentityLock(undefined)).toBeNull();
  });
  it("returns null when no recognizable traits", () => {
    expect(buildIdentityLock({ skinTone: "unknown" })).toBeNull();
  });
  it("renders header for woman by default", () => {
    const r = buildIdentityLock({ skinTone: "branca" });
    expect(r).toContain("woman");
    expect(r).toContain("IDENTITY LOCK");
  });
  it("renders header for man when gender masculino", () => {
    const r = buildIdentityLock({ skinTone: "branca", gender: "masculino" });
    expect(r).toContain("man in IMAGE 1");
  });
  it("includes hair color + texture + length when all provided", () => {
    const r = buildIdentityLock({
      hairColor: "loiro",
      hairTexture: "ondulado",
      hairLength: "medio",
    });
    expect(r).toMatch(/Hair:.*color is .*blonde/);
    expect(r).toContain("texture is wavy");
    expect(r).toContain("length is medium-length past shoulders");
  });
  it("includes skin/body/age when present", () => {
    const r = buildIdentityLock({
      skinTone: "negra",
      bodyType: "magra",
      ageRange: "jovem_18_25",
    });
    expect(r).toContain("Skin:");
    expect(r).toContain("Body:");
    expect(r).toContain("Age:");
  });
});

describe("Pose Bank constants", () => {
  it("POSE_BANK_TOTAL matches POSE_BANK length", () => {
    expect(POSE_BANK_TOTAL).toBe(POSE_BANK.length);
    expect(POSE_BANK_TOTAL).toBe(8);
  });
  it("POSE_HISTORY_CAP is 3", () => {
    expect(POSE_HISTORY_CAP).toBe(3);
  });
});

describe("resolvePoseIndex", () => {
  it("returns the pose for a valid index", () => {
    expect(resolvePoseIndex(0)).toBe(POSE_BANK[0]);
    expect(resolvePoseIndex(7)).toBe(POSE_BANK[7]);
  });
  it("throws for out-of-range index", () => {
    expect(() => resolvePoseIndex(-1)).toThrow(/inválido/);
    expect(() => resolvePoseIndex(POSE_BANK_TOTAL)).toThrow(/inválido/);
  });
});

describe("validatePoseIndex", () => {
  it("returns [] for valid index", () => {
    expect(validatePoseIndex(0)).toEqual([]);
    expect(validatePoseIndex(7)).toEqual([]);
  });
  it("rejects non-integer values", () => {
    expect(validatePoseIndex(1.5)[0]).toMatch(/inteiro/);
    expect(validatePoseIndex("3")[0]).toMatch(/inteiro/);
    expect(validatePoseIndex(null)[0]).toMatch(/inteiro/);
  });
  it("rejects out-of-range values", () => {
    expect(validatePoseIndex(-1)[0]).toMatch(/fora do range/);
    expect(validatePoseIndex(99)[0]).toMatch(/fora do range/);
  });
  it("rejects when matches the blocked streak index", () => {
    const r = validatePoseIndex(4, 4);
    expect(r[0]).toMatch(/bloqueado/);
  });
});

describe("getStreakBlockedPose", () => {
  it("returns null below cap", () => {
    expect(getStreakBlockedPose([])).toBeNull();
    expect(getStreakBlockedPose([1])).toBeNull();
    expect(getStreakBlockedPose([4, 4])).toBeNull();
  });
  it("returns the pose when streak hits cap with same value", () => {
    expect(getStreakBlockedPose([4, 4, 4])).toBe(4);
  });
  it("returns null when cap reached but values differ", () => {
    expect(getStreakBlockedPose([4, 4, 1])).toBeNull();
    expect(getStreakBlockedPose([4, 1, 4])).toBeNull();
  });
});

describe("updatePoseHistory", () => {
  it("prepends new index", () => {
    expect(updatePoseHistory([1, 2], 5)).toEqual([5, 1, 2]);
  });
  it("trims to POSE_HISTORY_CAP slots", () => {
    expect(updatePoseHistory([1, 2, 3], 5)).toEqual([5, 1, 2]);
    expect(updatePoseHistory([1, 2, 3, 4, 5], 9)).toHaveLength(POSE_HISTORY_CAP);
  });
  it("works on empty history", () => {
    expect(updatePoseHistory([], 7)).toEqual([7]);
  });
});
