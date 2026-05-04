import { describe, it, expect } from "vitest";
import { friendlyError } from "./friendly-error";

describe("friendlyError", () => {
  it("returns fallback for non-string non-Error inputs", () => {
    expect(friendlyError(null)).toBe("Algo deu errado. Tente novamente.");
    expect(friendlyError(undefined)).toBe("Algo deu errado. Tente novamente.");
    expect(friendlyError(123)).toBe("Algo deu errado. Tente novamente.");
    expect(friendlyError({}, "custom fallback")).toBe("custom fallback");
  });

  it("translates network errors (raw lowercase or technical messages)", () => {
    // These start lowercase / contain technical fragments so looksClean=false
    // and the regex map kicks in.
    expect(friendlyError("failed to fetch")).toMatch(/Sem conexão/);
    expect(friendlyError("network error: timeout")).toMatch(/conexão/);
    expect(friendlyError("etimedout reading socket")).toMatch(/demorou demais/);
    expect(friendlyError("aborted by signal")).toMatch(/cancelada/);
  });

  it("translates HTTP-style 'Erro NNN' even when message looks clean", () => {
    expect(friendlyError("Erro 401")).toMatch(/Sessão expirada/);
    expect(friendlyError("Erro 403")).toMatch(/permissão/);
    expect(friendlyError("Erro 404")).toMatch(/não encontrado/i);
    expect(friendlyError("Erro 429")).toMatch(/Aguarde/);
    expect(friendlyError("Erro 500")).toMatch(/servidor/);
  });

  it("translates Supabase / DB errors (technical fragments fail looksClean)", () => {
    expect(friendlyError("pgrst301: relation missing")).toMatch(/Erro interno/);
    expect(friendlyError("violates not-null constraint")).toMatch(/duplicados/);
  });

  it("translates Gemini / AI errors (lowercase or with code-like fragments)", () => {
    expect(friendlyError("safety_blocked while generating")).toMatch(/peças de roupa/);
    expect(friendlyError("rate_limited by provider")).toMatch(/Alta demanda/);
    expect(friendlyError("model_overloaded right now")).toMatch(/sobrecarregado/);
    expect(friendlyError("quota exhausted, retry later")).toMatch(/Limite/);
    expect(friendlyError("invalid response from upstream")).toMatch(/Resposta inesperada/);
  });

  it("translates upload errors (lowercase passthrough)", () => {
    expect(friendlyError("file too large")).toMatch(/5MB/);
    expect(friendlyError("unsupported media type")).toMatch(/Formato/);
  });

  it("preserves clean Portuguese messages from API", () => {
    const clean = "Pagamento processado com sucesso";
    expect(friendlyError(clean)).toBe(clean);
  });

  it("converts bare Erro NNN even when message looks clean", () => {
    expect(friendlyError("Erro 500")).toMatch(/servidor/);
  });

  it("falls back to generic for truly unknown messages", () => {
    expect(friendlyError(new Error("xkcd random gibberish 9001"))).toBe(
      "Algo deu errado. Tente novamente.",
    );
  });
});
