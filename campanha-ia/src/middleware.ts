import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware de proteção de rotas.
 *
 * Quando o Clerk estiver configurado, substitua a lógica abaixo
 * pelo middleware do Clerk:
 *
 *   import { clerkMiddleware } from "@clerk/nextjs/server";
 *   export default clerkMiddleware();
 */

// Rotas que exigem autenticação
const PROTECTED_ROUTES = ["/gerar", "/historico", "/modelo", "/configuracoes", "/plano"];

// Rotas públicas (não redireciona)
const PUBLIC_ROUTES = ["/", "/login", "/cadastro", "/onboarding", "/sobre", "/termos", "/privacidade"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes — passa direto (auth será verificada dentro da route)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Assets, _next — passa direto
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // TODO: Quando Clerk estiver configurado, descomentar:
  // const { userId } = auth();
  // if (isProtectedRoute(pathname) && !userId) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }

  // Por enquanto, permite tudo (dev mode)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
