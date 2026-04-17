import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/editor-auth/check
 * Returns 200 if editor session cookie is valid, 401 otherwise.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("editor_session");

  if (session?.value === "authenticated") {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}
