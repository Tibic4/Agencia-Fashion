/**
 * Unit tests para o cliente Google Play Developer API.
 *
 * Estratégia:
 *  - Pure functions (isValidSku, planFromSku, isGooglePlayConfigured): teste
 *    direto, sem mocks.
 *  - HTTP functions (verifySubscription / acknowledge / cancel):
 *      • mock `jose` pra não precisar gerar chave RSA real,
 *      • mock `node:fs` pra não tocar disco,
 *      • mock `globalThis.fetch` pra interceptar OAuth2 token-exchange + Play API,
 *      • `vi.resetModules()` em cada teste pra limpar o `tokenCache` interno.
 *
 * Por que esse módulo importa testes: cliente novo (commit 8577f83) substituiu
 * mock-de-mock por chamadas reais à Google Play API. Falsos positivos/negativos
 * em billing têm custo direto (usuário pagante sem acesso ou usuário sem plano
 * com acesso) — esses testes pegam regressão antes de ir pra prod.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jose: precisa retornar coisas plausíveis pra fluxo seguir, mas não precisa
// assinar JWT real — o token-exchange é mockado via fetch.
vi.mock("jose", () => ({
  importPKCS8: vi.fn(async () => ({} as never)),
  SignJWT: vi.fn().mockImplementation(() => {
    const builder: any = {
      setProtectedHeader: vi.fn(() => builder),
      setIssuer: vi.fn(() => builder),
      setSubject: vi.fn(() => builder),
      setAudience: vi.fn(() => builder),
      setIssuedAt: vi.fn(() => builder),
      setExpirationTime: vi.fn(() => builder),
      sign: vi.fn(async () => "FAKE.JWT.SIGNED"),
    };
    return builder;
  }),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({
      client_email: "test-sa@project.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----",
      token_uri: "https://oauth2.googleapis.com/token",
    }),
  ),
}));

const FAKE_SA_JSON = JSON.stringify({
  client_email: "test-sa@project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----",
});

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules(); // limpa tokenCache module-level entre testes
  process.env = { ...ORIGINAL_ENV };
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.crialook.app";
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = FAKE_SA_JSON;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// Pure functions
// ─────────────────────────────────────────────────────────────────────

describe("isValidSku", () => {
  it("aceita SKUs conhecidos", async () => {
    const { isValidSku } = await import("./google-play");
    expect(isValidSku("essencial_mensal")).toBe(true);
    expect(isValidSku("pro_mensal")).toBe(true);
    expect(isValidSku("business_mensal")).toBe(true);
  });

  it("rejeita strings desconhecidas", async () => {
    const { isValidSku } = await import("./google-play");
    expect(isValidSku("free")).toBe(false);
    expect(isValidSku("essencial")).toBe(false); // sem _mensal
    expect(isValidSku("")).toBe(false);
  });

  it("rejeita não-strings", async () => {
    const { isValidSku } = await import("./google-play");
    expect(isValidSku(null)).toBe(false);
    expect(isValidSku(undefined)).toBe(false);
    expect(isValidSku(42)).toBe(false);
    expect(isValidSku({})).toBe(false);
  });
});

describe("planFromSku", () => {
  it("mapeia SKU → plan name", async () => {
    const { planFromSku } = await import("./google-play");
    expect(planFromSku("essencial_mensal")).toBe("essencial");
    expect(planFromSku("pro_mensal")).toBe("pro");
    expect(planFromSku("business_mensal")).toBe("business");
  });
});

describe("isGooglePlayConfigured", () => {
  it("true quando PACKAGE_NAME + JSON inline existem", async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.crialook.app";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = "{}";
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH;
    const { isGooglePlayConfigured } = await import("./google-play");
    expect(isGooglePlayConfigured()).toBe(true);
  });

  it("true quando PACKAGE_NAME + JSON path existem", async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.crialook.app";
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH = "/tmp/fake.json";
    const { isGooglePlayConfigured } = await import("./google-play");
    expect(isGooglePlayConfigured()).toBe(true);
  });

  it("false quando PACKAGE_NAME falta", async () => {
    delete process.env.GOOGLE_PLAY_PACKAGE_NAME;
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = "{}";
    const { isGooglePlayConfigured } = await import("./google-play");
    expect(isGooglePlayConfigured()).toBe(false);
  });

  it("false quando ambos JSON inline e path faltam", async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.crialook.app";
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH;
    const { isGooglePlayConfigured } = await import("./google-play");
    expect(isGooglePlayConfigured()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// HTTP functions — mockam fetch
// ─────────────────────────────────────────────────────────────────────

interface MockResponse {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}

function mockFetchSequence(responses: MockResponse[]) {
  let idx = 0;
  const fn = vi.fn(async (...args: unknown[]) => {
    void args;
    const r = responses[idx++];
    if (!r) throw new Error(`fetch chamado ${idx} vezes mas só ${responses.length} respostas configuradas`);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => r.text ?? "",
    } as Response;
  });
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
  return fn;
}

describe("verifySubscription", () => {
  it("OAuth + Play API: retorna status normalizado", async () => {
    const fetchSpy = mockFetchSequence([
      // 1) Token exchange
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      // 2) Play API GET subscription
      {
        ok: true,
        json: {
          paymentState: 1,
          expiryTimeMillis: "1735689600000",
          autoRenewing: true,
          acknowledgementState: 1,
        },
      },
    ]);

    const { verifySubscription } = await import("./google-play");
    const status = await verifySubscription("essencial_mensal", "purchase-token-123");

    expect(status).toEqual({
      paymentState: 1,
      expiryTimeMillis: "1735689600000",
      autoRenewing: true,
      acknowledgementState: 1,
      linkedPurchaseToken: undefined,
    });

    // OAuth call
    expect(fetchSpy.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect((fetchSpy.mock.calls[0][1] as any).method).toBe("POST");

    // Play API call: assert URL shape e auth header
    const playUrl = fetchSpy.mock.calls[1][0] as string;
    expect(playUrl).toContain("/applications/com.crialook.app/");
    expect(playUrl).toContain("/subscriptions/essencial_mensal/");
    expect(playUrl).toContain("/tokens/purchase-token-123");
    const playInit = fetchSpy.mock.calls[1][1] as RequestInit;
    expect((playInit.headers as Record<string, string>).authorization).toBe("Bearer ya29.test");
  });

  it("captura linkedPurchaseToken quando presente (upgrade/downgrade)", async () => {
    mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      {
        ok: true,
        json: {
          paymentState: 1,
          expiryTimeMillis: "1735689600000",
          autoRenewing: true,
          acknowledgementState: 1,
          linkedPurchaseToken: "old-token-abc",
        },
      },
    ]);

    const { verifySubscription } = await import("./google-play");
    const status = await verifySubscription("pro_mensal", "new-token-xyz");
    expect(status.linkedPurchaseToken).toBe("old-token-abc");
  });

  it("paymentState ausente vira null", async () => {
    mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: true, json: { expiryTimeMillis: "0", autoRenewing: false } },
    ]);

    const { verifySubscription } = await import("./google-play");
    const status = await verifySubscription("essencial_mensal", "tok");
    expect(status.paymentState).toBeNull();
    expect(status.acknowledgementState).toBe(0); // default
  });

  it("propaga erro quando OAuth falha", async () => {
    mockFetchSequence([
      { ok: false, status: 401, text: "invalid_grant" },
    ]);

    const { verifySubscription } = await import("./google-play");
    await expect(verifySubscription("essencial_mensal", "tok")).rejects.toThrow(
      /Google OAuth2 token exchange failed: 401/,
    );
  });

  it("propaga erro quando Play API retorna 404 (token inválido)", async () => {
    mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: false, status: 404, text: "purchaseToken not found" },
    ]);

    const { verifySubscription } = await import("./google-play");
    await expect(verifySubscription("pro_mensal", "tok-bad")).rejects.toThrow(
      /Play API verify failed: 404/,
    );
  });

  it("encoda token e SKU corretamente na URL (proteção contra path traversal)", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: true, json: { expiryTimeMillis: "0", paymentState: 0, acknowledgementState: 0 } },
    ]);

    const { verifySubscription } = await import("./google-play");
    await verifySubscription("essencial_mensal", "abc/def?bad");

    const playUrl = fetchSpy.mock.calls[1][0] as string;
    expect(playUrl).toContain("abc%2Fdef%3Fbad"); // encodeURIComponent
    expect(playUrl).not.toContain("abc/def?bad"); // raw NÃO deve aparecer
  });
});

describe("acknowledgeSubscription", () => {
  it("chama POST :acknowledge com Bearer + body vazio", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: true, status: 200, json: {} },
    ]);

    const { acknowledgeSubscription } = await import("./google-play");
    await acknowledgeSubscription("pro_mensal", "tok-1");

    const url = fetchSpy.mock.calls[1][0] as string;
    expect(url).toMatch(/:acknowledge$/);
    const init = fetchSpy.mock.calls[1][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer ya29.test");
    expect(init.body).toBe("{}");
  });

  it("idempotente: 410 Gone (already acknowledged) NÃO é erro", async () => {
    mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: false, status: 410, text: "already acknowledged" },
    ]);

    const { acknowledgeSubscription } = await import("./google-play");
    await expect(
      acknowledgeSubscription("pro_mensal", "tok-1"),
    ).resolves.toBeUndefined();
  });

  it("propaga erros não-410 (ex: 500)", async () => {
    mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: false, status: 500, text: "internal" },
    ]);

    const { acknowledgeSubscription } = await import("./google-play");
    await expect(
      acknowledgeSubscription("pro_mensal", "tok-1"),
    ).rejects.toThrow(/Play API acknowledge failed: 500/);
  });
});

describe("cancelSubscription", () => {
  it("chama POST :cancel com Bearer", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: true, status: 200, json: {} },
    ]);

    const { cancelSubscription } = await import("./google-play");
    await cancelSubscription("business_mensal", "tok-2");

    const url = fetchSpy.mock.calls[1][0] as string;
    expect(url).toMatch(/:cancel$/);
    const init = fetchSpy.mock.calls[1][1] as RequestInit;
    expect(init.method).toBe("POST");
  });

  it("idempotente: 410 Gone NÃO é erro", async () => {
    mockFetchSequence([
      { ok: true, json: { access_token: "ya29.test", expires_in: 3600 } },
      { ok: false, status: 410, text: "already cancelled" },
    ]);

    const { cancelSubscription } = await import("./google-play");
    await expect(
      cancelSubscription("essencial_mensal", "tok-2"),
    ).resolves.toBeUndefined();
  });
});

describe("getAccessToken cache", () => {
  it("reusa token entre 2 chamadas dentro do TTL (1 só OAuth call)", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, json: { access_token: "ya29.cached", expires_in: 3600 } },
      { ok: true, json: { paymentState: 1, expiryTimeMillis: "0", autoRenewing: true, acknowledgementState: 1 } },
      { ok: true, status: 200, json: {} },
    ]);

    const { verifySubscription, acknowledgeSubscription } = await import("./google-play");
    await verifySubscription("essencial_mensal", "tok");
    await acknowledgeSubscription("essencial_mensal", "tok");

    // 1 OAuth + 2 Play API = 3 fetches. Sem cache seriam 2 OAuth + 2 Play = 4.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
