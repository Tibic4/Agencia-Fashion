import { Inngest } from "inngest";

/**
 * Cliente Inngest para jobs assíncronos do CriaLook.
 *
 * Usado para:
 * - Pipeline de IA com retry automático
 * - Processos de geração de imagem (Gemini 3.1 Flash Image)
 * - Envio de emails transacionais
 */
export const inngest = new Inngest({
  id: "crialook",
  eventKey: process.env.INNGEST_EVENT_KEY,
  // D-28 / L-8: explicit signingKey for serve-side verification.
  // The serve handler (api/inngest/route.ts) may pull INNGEST_SIGNING_KEY from
  // env automatically, but explicit beats implicit — defends against env-var
  // refactors that leave the implicit pickup broken. If the env is unset,
  // production will fail to verify Inngest cloud webhooks (loud, not silent).
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
