/**
 * Verificação do JWT que o Google Pub/Sub anexa em todo POST de RTDN.
 *
 * Como funciona:
 *  - Pub/Sub coloca um Bearer JWT no header Authorization
 *  - JWT é assinado pelas chaves do Google (JWKS público em /oauth2/v3/certs)
 *  - issuer = https://accounts.google.com
 *  - aud = audience configurada no push subscription do Pub/Sub
 *    (geralmente a URL pública do endpoint)
 *  - email = service account que publica → precisa bater com o que esperamos
 *
 * Sem essa validação, qualquer um com `curl` + um base64 de payload válido
 * consegue cancelar/reativar subscription de qualquer usuário.
 *
 * Refs:
 *  - https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

// JWKS do Google é fetched lazily na primeira chamada e cacheado pelo
// próprio jose. URL fixa, nunca muda.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const GOOGLE_ISSUER = "https://accounts.google.com";

export interface PubSubAuthResult {
  ok: boolean;
  /** Mensagem de erro p/ log; não vaza pro client (só logamos). */
  reason?: string;
  /** Email do service account validado (pra observability). */
  email?: string;
}

/**
 * Valida o Authorization header de um request do Pub/Sub. Retorna
 * `{ ok: true }` quando o token é assinado pelo Google, com o
 * issuer/audience corretos, e o `email` do payload bate com o service
 * account configurado em `GOOGLE_PUBSUB_ALLOWED_SERVICE_ACCOUNT`.
 *
 * Em qualquer falha de validação retorna `{ ok: false, reason }` —
 * o caller decide o status HTTP (401/403). Nunca lança.
 */
export async function verifyPubSubJwt(
  authHeader: string | null,
): Promise<PubSubAuthResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "missing_bearer" };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return { ok: false, reason: "empty_token" };

  const audience = process.env.GOOGLE_PUBSUB_AUDIENCE;
  const allowedSa = process.env.GOOGLE_PUBSUB_ALLOWED_SERVICE_ACCOUNT;
  if (!audience || !allowedSa) {
    // Misconfig: caller deve checar isGooglePlayConfigured antes, mas
    // se chegou aqui sem env, falha fechado em vez de aberto.
    return { ok: false, reason: "missing_pubsub_env" };
  }

  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUER,
      audience,
    });

    const email = typeof payload.email === "string" ? payload.email : null;
    const emailVerified = payload.email_verified === true;
    if (!email || !emailVerified) {
      return { ok: false, reason: "email_unverified" };
    }
    if (email !== allowedSa) {
      return { ok: false, reason: `email_mismatch:${email}` };
    }
    return { ok: true, email };
  } catch (e) {
    // jose lança JWTExpired, JWSSignatureVerificationFailed,
    // JWTClaimValidationFailed etc. Todos viram 401 sem detalhe pro client.
    const reason = e instanceof Error ? e.name : "verify_failed";
    return { ok: false, reason };
  }
}
