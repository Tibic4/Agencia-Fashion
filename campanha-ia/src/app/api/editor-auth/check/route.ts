import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyEditorSession } from "@/lib/editor-session";

/**
 * GET /api/editor-auth/check
 * Retorna 200 se o cookie HMAC do editor for válido (não expirado), 401 caso contrário.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("editor_session");

  if (verifyEditorSession(session?.value)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}
