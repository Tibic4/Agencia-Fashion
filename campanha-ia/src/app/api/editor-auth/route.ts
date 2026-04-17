import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * POST /api/editor-auth
 * Validates a simple password for the standalone editor.
 * Password is set via EDITOR_PASSWORD in .env.local.
 */
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const correctPassword = process.env.EDITOR_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json(
        { error: "Editor password not configured on server." },
        { status: 500 }
      );
    }

    if (password !== correctPassword) {
      return NextResponse.json(
        { error: "Senha incorreta." },
        { status: 401 }
      );
    }

    // Set a session cookie (httpOnly, 30 days)
    const cookieStore = await cookies();
    cookieStore.set("editor_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 }
    );
  }
}
