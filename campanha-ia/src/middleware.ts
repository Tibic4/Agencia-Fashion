// TODO: Next.js 16 deprecou "middleware" em favor de "proxy". Migrar quando API estabilizar.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Rotas que exigem login
const isProtectedRoute = createRouteMatcher([
  "/gerar(.*)",
  "/historico(.*)",
  "/modelo(.*)",
  "/configuracoes(.*)",
  "/plano(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
  "/api/campaigns(.*)",
  "/api/store(.*)",
]);

// Rotas que exigem role admin
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// IDs de admin no .env (separados por vírgula)
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export default clerkMiddleware(async (auth, request) => {
  if (isAdminRoute(request)) {
    // 1. Exige login
    await auth.protect();

    // 2. Verifica se é admin
    const session = await auth();
    const userId = session.userId;

    if (!userId) {
      return NextResponse.redirect(new URL("/gerar", request.url));
    }

    let isAdmin = ADMIN_USER_IDS.includes(userId);

    if (!isAdmin) {
      // Checar publicMetadata.role via session claims
      const claims = session.sessionClaims as Record<string, unknown> | undefined;
      const metadata = claims?.metadata as { role?: string } | undefined;
      const publicMetadata = claims?.publicMetadata as { role?: string } | undefined;
      const role = metadata?.role || publicMetadata?.role;
      isAdmin = role === "admin" || role === "super_admin";
    }

    if (!isAdmin) {
      return NextResponse.redirect(new URL("/gerar", request.url));
    }
  } else if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip static files and internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
