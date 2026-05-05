/**
 * Next.js instrumentation hook — registra Sentry para server e edge runtimes.
 * Required a partir do @sentry/nextjs v8+.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 *
 * Também faz parse das envs no boot via `loadEnv()` — se faltar var
 * obrigatória em produção, o server quebra agora em vez de falhar
 * silenciosamente em runtime no primeiro request à rota afetada.
 */
export async function register() {
  // Validação de envs em ambos os runtimes. Não usa `await import("./lib/env")`
  // pra não pegar paths-aliased no edge bundler — loadEnv é puro Zod, não tem
  // side effects de runtime.
  const { loadEnv } = await import("./lib/env");
  const env = loadEnv();

  // D-24 / M-9: single boot log so ops can verify a deploy actually had the right env.
  // NEVER log values — only key count + NODE_ENV. PII-safe by construction.
  const keyCount = Object.keys(env).length;
  console.info(
    `[boot] env loaded: NODE_ENV=${env.NODE_ENV ?? "unset"}, validated_keys=${keyCount}, runtime=${process.env.NEXT_RUNTIME ?? "unknown"}`,
  );

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // ── IPv4-forced global undici dispatcher (2026-05-05) ──────────────────
    // VPS Locaweb tem IPv6 stack mas SEM rota outbound:
    //   nc -zv -6 2607:6bc0::10 443 → "Network is unreachable" (kernel reject)
    // Node 24 happy-eyeballs (undici) tenta IPv6 first quando DNS retorna AAAA,
    // trava em ETIMEDOUT, NÃO faz fallback rápido pra IPv4. Resultado:
    // pipeline.ts:288 catch fires intermitente para Sonnet → fallback hardcoded
    // entregue ao usuário.
    //
    // PM2 NODE_OPTIONS="--dns-result-order=ipv4first --network-family-autoselection=false"
    // resolve a maioria dos casos mas escapa em ~25% (undici cria sockets via
    // path próprio que ignora DNS lookup order em retries internos).
    //
    // Fix definitivo: setGlobalDispatcher com Agent { connect: { family: 4 } }
    // força TODA fetch global (Anthropic SDK, Gemini, futuras integrações) a
    // criar sockets IPv4 EXCLUSIVAMENTE. IPv6 path nunca tentado.
    //
    // Quando Locaweb (ou novo provider) tiver IPv6 outbound funcionando, remove
    // este bloco — happy-eyeballs default volta a funcionar.
    const { setGlobalDispatcher, Agent } = await import("undici");
    setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
    console.info("[boot] undici global dispatcher: IPv4-only (VPS routing fix)");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Sentry v10+: captureRequestError (v8 usava onRequestError)
import * as Sentry from "@sentry/nextjs";
export const onRequestError = Sentry.captureRequestError;
