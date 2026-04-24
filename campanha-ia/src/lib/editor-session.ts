/**
 * Editor standalone — cookie de sessão assinado (HMAC).
 * Substitui o antigo cookie `editor_session=authenticated` (sem entropia/assinatura).
 */
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

function getSecret(): string {
  return process.env.EDITOR_SESSION_SECRET || process.env.EDITOR_PASSWORD || "";
}

/** Gera um token session: `issuedAt.nonce.hmac` (base64url) */
export function signEditorSession(ttlSeconds = 60 * 60 * 24 * 30): string {
  const secret = getSecret();
  if (!secret) throw new Error("EDITOR_SESSION_SECRET não configurado");
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const nonce = randomBytes(12).toString("hex");
  const payload = `${issuedAt}.${expiresAt}.${nonce}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

export function verifyEditorSession(token: string | undefined | null): boolean {
  const secret = getSecret();
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [issuedAtStr, expiresAtStr, nonce, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt)) return false;
  if (Math.floor(Date.now() / 1000) >= expiresAt) return false;
  const payload = `${issuedAtStr}.${expiresAtStr}.${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Comparação timing-safe de strings (para password compare). */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // Se lengths diferem, ainda comparar contra o maior para não vazar length.
  const len = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(len);
  const paddedB = Buffer.alloc(len);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  const eq = timingSafeEqual(paddedA, paddedB);
  return eq && bufA.length === bufB.length;
}
