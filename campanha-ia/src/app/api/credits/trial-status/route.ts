import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/credits/trial-status — DEPRECATED
 *
 * Existia pra detectar se o usuário já tinha comprado o trial pago de
 * R$19,90. Esse pacote saiu — o trial agora é gratuito (1 campanha, 1
 * foto) via `/api/credits/{claim,}-mini-trial`.
 *
 * Endpoint mantido como stub pra não quebrar caches do front antigo nem
 * smoke/load tests externos. Sempre retorna `used: false`. Pode sair
 * depois que o cache global expirar (~30d) ou no próximo round de cleanup.
 */
export async function GET() {
  return NextResponse.json({ used: false, deprecated: true });
}
