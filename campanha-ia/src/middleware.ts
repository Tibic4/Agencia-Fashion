import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rotas que exigem login
const isProtectedRoute = createRouteMatcher([
  "/gerar(.*)",
  "/historico(.*)",
  "/modelo(.*)",
  "/configuracoes(.*)",
  "/plano(.*)",
  "/onboarding(.*)",
  "/api/campaigns(.*)",
  "/api/store(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip static files and internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
