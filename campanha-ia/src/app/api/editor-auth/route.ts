import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/rate-limit";
import { signEditorSession, timingSafeStringEqual } from "@/lib/editor-session";

/**
 * POST /api/editor-auth
 * Valida senha do editor standalone e seta cookie HMAC-assinado.
 * - Rate-limit: 5 tentativas / 15min por IP, bloqueio de 1h após exceder.
 * - Compare timing-safe.
 * - Cookie com HMAC + expiração (não é string literal).
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  // ── Rate-limit brute-force ──
  const rl = checkLoginRateLimit({
    key: `editor-auth:${ip}`,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  let password: unknown;
  try {
    const body = await req.json();
    password = body?.password;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const correctPassword = process.env.EDITOR_PASSWORD;
  if (!correctPassword) {
    return NextResponse.json(
      { error: "Editor password não configurado no servidor." },
      { status: 500 },
    );
  }

  if (typeof password !== "string" || !timingSafeStringEqual(password, correctPassword)) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  // Sucesso → libera rate-limit para este IP
  resetLoginRateLimit(`editor-auth:${ip}`);

  // Seta cookie HMAC-assinado (30 dias)
  const token = signEditorSession(60 * 60 * 24 * 30);
  const cookieStore = await cookies();
  cookieStore.set("editor_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
