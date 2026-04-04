import { Inngest } from "inngest";

/**
 * Cliente Inngest para jobs assíncronos do CriaLook.
 *
 * Usado para:
 * - Pipeline de IA com retry automático
 * - Processos de try-on que demoram (polling do Fashn.ai)
 * - Envio de emails transacionais
 */
export const inngest = new Inngest({
  id: "crialook",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
