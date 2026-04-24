/**
 * Validador de assinatura Mercado Pago (extraído do webhook route para permitir testes unitários).
 * https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
import { createHmac, timingSafeEqual } from "crypto";

export interface MpSignatureParams {
  secret: string;
  xSignatureHeader: string; // "ts=1704,v1=abc..."
  xRequestId: string;
  dataId: string;
  skewSec?: number; // default 300 (5min)
  nowSec?: number; // para testes
}

export function parseXSignature(header: string): { ts?: string; v1?: string } {
  const out: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [k, ...v] = part.trim().split("=");
    if (k && v.length) out[k] = v.join("=");
  }
  return { ts: out.ts, v1: out.v1 };
}

export function validateMpSignature(p: MpSignatureParams): boolean {
  const { secret, xSignatureHeader, xRequestId, dataId, skewSec = 300 } = p;
  if (!secret) return false;

  const { ts, v1 } = parseXSignature(xSignatureHeader);
  if (!ts || !v1) return false;

  const tsNum = parseInt(ts, 10);
  if (Number.isFinite(tsNum)) {
    const nowSec = p.nowSec ?? Math.floor(Date.now() / 1000);
    const tsSec = tsNum > 1e12 ? Math.floor(tsNum / 1000) : tsNum;
    if (Math.abs(nowSec - tsSec) > skewSec) return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
