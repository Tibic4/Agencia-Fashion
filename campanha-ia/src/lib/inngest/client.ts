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
});
