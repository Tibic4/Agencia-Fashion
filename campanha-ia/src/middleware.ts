// TODO: Next.js 16 deprecou "middleware" em favor de "proxy". Migrar quando API estabilizar.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware(async (auth, request) => {
  if (isAdminRoute(request)) {
    // Verifica login primeiro
    const session = await auth.protect();
    // Verifica role admin via publicMetadata
    const role = (session.sessionClaims?.metadata as { role?: string })?.role;
    if (role !== "admin") {
      return Response.redirect(new URL("/", request.url));
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
