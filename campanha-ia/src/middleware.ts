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

// Rotas que exigem role admin (publicMetadata.role === "admin")
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// ⚠️ TESTING MODE — auth desabilitado para testes via tunnel
// TODO: Restaurar auth.protect() antes de deploy em produção
export default clerkMiddleware(async (_auth, _request) => {
  // pass-through — sem proteção de rota para testes
});

export const config = {
  matcher: [
    // Skip static files and internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
