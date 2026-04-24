// TODO: Next.js 16 deprecou "middleware" em favor de "proxy". Migrar quando API estabilizar.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rotas que usam auth própria (não passam pelo Clerk)
const isEditorRoute = createRouteMatcher([
  "/editor(.*)",
  "/api/editor-auth(.*)",
]);

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

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isAuthAppRoute = createRouteMatcher([
  "/gerar(.*)",
  "/historico(.*)",
  "/modelo(.*)",
  "/configuracoes(.*)",
  "/plano(.*)",
]);

// Rotas que exigem role admin
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// IDs de admin no .env (separados por vírgula)
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function hasStore(clerkUserId: string): Promise<boolean | "unknown"> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return "unknown";
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();
    if (error) {
      console.warn(`[middleware/hasStore] Supabase error: ${error.message}`);
      return "unknown";
    }
    return !!data;
  } catch (e) {
    console.warn(`[middleware/hasStore] Exception:`, e);
    return "unknown";
  }
}

export default clerkMiddleware(async (auth, request) => {
  // Editor standalone — usa auth própria (cookie), não Clerk
  if (isEditorRoute(request)) return;

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

    // Redirecionar server-side: /onboarding → /gerar se já tem loja
    // e /gerar,/historico etc → /onboarding se não tem loja
    const session = await auth();
    if (session.userId) {
      if (isOnboardingRoute(request)) {
        const storeExists = await hasStore(session.userId);
        if (storeExists) {
          return NextResponse.redirect(new URL("/gerar", request.url));
        }
      } else if (isAuthAppRoute(request)) {
        const storeExists = await hasStore(session.userId);
        if (!storeExists) {
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip static files and internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
