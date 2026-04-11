import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// TEMPORÁRIO — Endpoint para debugar o que o Clerk retorna nos sessionClaims
// Remover após resolver o problema de admin
export async function GET() {
  // Bloquear em produção — expõe dados de sessão
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const session = await auth();

    return NextResponse.json({
      userId: session.userId,
      sessionClaims: session.sessionClaims,
      // Mostrar exatamente o que o middleware vê
      metadataFromClaims: (session.sessionClaims as Record<string, unknown>)?.metadata,
      roleCheck: (session.sessionClaims?.metadata as Record<string, string>)?.role,
      // Todas as keys disponíveis
      allClaimKeys: session.sessionClaims ? Object.keys(session.sessionClaims) : [],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[debug-auth] Error:", msg);
    return NextResponse.json({ error: "Erro ao obter sessão" }, { status: 500 });
  }
}
