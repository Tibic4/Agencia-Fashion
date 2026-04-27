import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError, logger } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * POST /api/store/push-token
 *
 * Registro/atualização do token Expo Push do dispositivo do usuário.
 *
 * Body:
 *   { token: string | null }
 *
 * Comportamentos:
 *   - token === null  → remove TODOS os tokens deste user (logout / disable)
 *   - token === ''    → trata como null (defesa contra clientes que mandam string vazia)
 *   - token válido    → upsert: insere ou atualiza last_seen_at
 *
 * Por que aceitar `null`?
 *   `lib/auth.tsx:43` chama com `null` no signOut, garantindo que push pare
 *   imediatamente naquele device sem esperar o GC. O endpoint aceita ambos
 *   semânticas no mesmo path para manter o cliente trivial.
 *
 * Não há rate-limit dedicado: o app só chama 1x na inicialização e 1x no
 * signOut. Caso vire abuso, mover para o middleware geral de rate-limit.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    const raw = body.token;
    const token =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

    const supabase = createAdminClient();

    // Caso de logout / disable: limpa todos os tokens do user
    if (token === null) {
      const { error } = await supabase
        .from("push_tokens")
        .delete()
        .eq("clerk_user_id", userId);
      if (error) {
        captureError(error, { route: "POST /api/store/push-token", phase: "delete_all" });
        return NextResponse.json({ error: "Erro ao remover token" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, removed: true });
    }

    // Validação leve: tokens Expo seguem `ExponentPushToken[xxx]` ou `ExpoPushToken[xxx]`.
    // Não validamos formato exato pra não rejeitar futuros prefixos do SDK Expo,
    // mas barramos lixo óbvio (>200 chars, ou contém quebras de linha).
    if (token.length > 200 || /[\r\n]/.test(token)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    // Upsert: se este (user, token) já existe, atualiza last_seen_at.
    // O ON CONFLICT usa a constraint UNIQUE(clerk_user_id, token).
    const { error } = await supabase.from("push_tokens").upsert(
      {
        clerk_user_id: userId,
        token,
        platform: "expo",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id,token" },
    );

    if (error) {
      captureError(error, { route: "POST /api/store/push-token", phase: "upsert" });
      return NextResponse.json({ error: "Erro ao registrar token" }, { status: 500 });
    }

    logger.info("push_token_registered", {
      user_id: userId,
      token_prefix: token.slice(0, 20),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    captureError(e, { route: "POST /api/store/push-token" });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
