import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { parseXSignature, validateMpSignature } from "./mp-signature";

const SECRET = "test-secret";
const DATA_ID = "1234567890";
const X_REQUEST_ID = "req-abc";

function sign(ts: number, dataId = DATA_ID, reqId = X_REQUEST_ID, secret = SECRET): string {
  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const hmac = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${hmac}`;
}

describe("parseXSignature", () => {
  it("parseia formato padrão", () => {
    expect(parseXSignature("ts=123,v1=abc")).toEqual({ ts: "123", v1: "abc" });
  });
  it("tolera espaços", () => {
    expect(parseXSignature("ts=123 , v1=abc")).toEqual({ ts: "123", v1: "abc" });
  });
  it("retorna undefined quando campos faltam", () => {
    expect(parseXSignature("foo=bar")).toEqual({});
  });
});

describe("validateMpSignature", () => {
  const now = 1_700_000_000;

  it("aceita assinatura válida dentro da janela", () => {
    const header = sign(now, DATA_ID, X_REQUEST_ID);
    expect(
      validateMpSignature({
        secret: SECRET,
        xSignatureHeader: header,
        xRequestId: X_REQUEST_ID,
        dataId: DATA_ID,
        nowSec: now,
      }),
    ).toBe(true);
  });

  it("rejeita assinatura expirada (>5min)", () => {
    const header = sign(now - 500);
    expect(
      validateMpSignature({
        secret: SECRET,
        xSignatureHeader: header,
        xRequestId: X_REQUEST_ID,
        dataId: DATA_ID,
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("rejeita assinatura com secret errado", () => {
    const header = sign(now, DATA_ID, X_REQUEST_ID, "wrong-secret");
    expect(
      validateMpSignature({
        secret: SECRET,
        xSignatureHeader: header,
        xRequestId: X_REQUEST_ID,
        dataId: DATA_ID,
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("rejeita se dataId foi adulterado", () => {
    const header = sign(now, DATA_ID);
    expect(
      validateMpSignature({
        secret: SECRET,
        xSignatureHeader: header,
        xRequestId: X_REQUEST_ID,
        dataId: "different-id",
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("rejeita se xRequestId foi adulterado", () => {
    const header = sign(now, DATA_ID, X_REQUEST_ID);
    expect(
      validateMpSignature({
        secret: SECRET,
        xSignatureHeader: header,
        xRequestId: "other-req-id",
        dataId: DATA_ID,
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("rejeita secret vazio", () => {
    const header = sign(now);
    expect(
      validateMpSignature({
        secret: "",
        xSignatureHeader: header,
        xRequestId: X_REQUEST_ID,
        dataId: DATA_ID,
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("rejeita header malformado (sem v1)", () => {
    expect(
      validateMpSignature({
        secret: SECRET,
        xSignatureHeader: `ts=${now}`,
        xRequestId: X_REQUEST_ID,
        dataId: DATA_ID,
        nowSec: now,
      }),
    ).toBe(false);
  });

  it("tolera timestamp em ms (MP às vezes envia assim)", () => {
    const tsMs = now * 1000;
    // Usa sign com string "tsMs" para bater o manifest; mas validateMpSignature
    // normaliza: ts > 1e12 → dividir por 1000.
    const manifest = `id:${DATA_ID};request-id:${X_REQUEST_ID};ts:${tsMs};`;
    const hmac = createHmac("sha256", SECRET).update(manifest).digest("hex");
    expect(
      validateMpSignature({
        secret: SECRET,
        xSignatureHeader: `ts=${tsMs},v1=${hmac}`,
        xRequestId: X_REQUEST_ID,
        dataId: DATA_ID,
        nowSec: now,
      }),
    ).toBe(true);
  });
});
