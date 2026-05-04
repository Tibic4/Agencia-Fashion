// Next.js 16 introduziu a API "proxy" como sucessora de "middleware".
// Migração agendada quando a nova API sair de status experimental e o Clerk
// publicar guidance oficial pra `clerkProxy`.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Phase 4 D-12: hash userId for Sentry tags (PII reduction).
// Edge Runtime: Node `crypto` is unavailable, so we use Web Crypto (`crypto.subtle`).
// SHA-256 → 12-hex-char prefix (collision domain still vast for tag uniqueness).
async function hashUserId(userId: string): Promise<string> {
  const data = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 6; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex; // 12 hex chars = 6 bytes
}

const IS_PROD = process.env.NODE_ENV === "production";

// Rotas que usam auth própria (não passam pelo Clerk)
const isEditorRoute = createRouteMatcher([
  "/editor(.*)",
  "/api/editor-auth(.*)",
]);

// Rotas de PÁGINA que exigem login (HTML, browser segue redirect).
// Importante: NÃO incluir rotas /api/* aqui. O `auth.protect()` em rotas
// /api/* redireciona pra /sign-in (HTML 307) quando o JWT falha — o
// mobile, que faz fetch JSON com Bearer header, recebe HTML e não
// consegue parsear, falhando todo o flow pós-login. Cada route handler
// /api/* já valida com `auth().userId` próprio e retorna 401 JSON
// quando deveria — deixar middleware fora dele.
const isProtectedRoute = createRouteMatcher([
  "/gerar(.*)",
  "/historico(.*)",
  "/modelo(.*)",
  "/configuracoes(.*)",
  "/plano(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
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

// Cookie cache p/ flag has_store — evita query Supabase a cada navegação.
// Why: middleware.ts roda em TODA rota protegida. Sem cache eram 200-500ms/click.
// Cookie é por-userId pra invalidar ao trocar de conta. TTL 1h é seguro: pior caso
// é um redirect indevido p/ /onboarding após deletar loja — fluxo raro.
const STORE_COOKIE_PREFIX = "cl_hs_";
const STORE_COOKIE_TTL = 60 * 60; // 1h em segundos

/**
 * Phase 4 D-17: middleware service-role audit — keep as-is (justified).
 *
 * Why this is NOT moved to createAdminClient():
 *  - middleware runs BEFORE any route handler, on EVERY request to a protected route
 *  - auth.protect() already gates the userId we look up here
 *  - moving to RLS would require an authenticated Supabase client per-request,
 *    significantly more expensive in middleware (multiplies by every protected hit)
 *  - the lookup is a single boolean (has_store), not user data — leak surface is
 *    minimal even if the service-role key were exposed (which it isn't; this is
 *    server-only middleware bundle)
 *
 * The service-role client lives at module scope, but the function body re-checks
 * env on every call so test harnesses can stub the env without re-importing.
 */
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
      .select("id, onboarding_completed")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();
    if (error) {
      console.warn(`[middleware/hasStore] Supabase error: ${error.message}`);
      return "unknown";
    }
    if (!data) return false;
    // O webhook clerk.user.created cria uma loja placeholder antes do user
    // fazer onboarding (clerk-side, agnóstica ao fluxo). Com isso `data` já
    // existe pra qualquer usuário recém-cadastrado e a checagem antiga
    // (!!data) sempre dava true → middleware pulava /onboarding pro /gerar.
    // Gateamos pelo flag explícito; legacy stores sem o campo (null/undefined)
    // contam como completas pra não interromper quem já tá dentro do app.
    return data.onboarding_completed !== false;
  } catch (e) {
    console.warn(`[middleware/hasStore] Exception:`, e);
    return "unknown";
  }
}

/**
 * Redireciona preservando a querystring original.
 * `new URL(path, request.url)` descarta ?params — esse helper recupera.
 */
function redirectTo(path: string, request: Request): NextResponse {
  const target = new URL(path, request.url);
  const original = new URL(request.url);
  // Preserva query params que o usuário tinha (ex: ?id=123, ?utm_*)
  original.searchParams.forEach((v, k) => {
    if (!target.searchParams.has(k)) target.searchParams.append(k, v);
  });
  return NextResponse.redirect(target);
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
      // redireciona para /sign-in (não /gerar, que pode loopar)
      console.warn("admin.deny", {
        route: new URL(request.url).pathname,
        userId_hash: null,
        reason: "no_session",
      });
      return redirectTo("/sign-in", request);
    }

    // Phase 4 D-09: precedence mirrors src/lib/admin/guard.ts.
    //   1. publicMetadata.role (canonical)
    //   2. metadata.role (back-compat)
    //   3. ADMIN_USER_IDS (break-glass) — emit admin.breakglass_used in prod
    let isAdmin = false;
    const denyReason = "not_admin";
    const claims = session.sessionClaims as Record<string, unknown> | undefined;
    const publicMetadata = claims?.publicMetadata as { role?: string } | undefined;
    const metadata = claims?.metadata as { role?: string } | undefined;
    const publicRole = publicMetadata?.role;
    const metaRole = metadata?.role;
    if (publicRole === "admin" || publicRole === "super_admin") {
      isAdmin = true;
    } else if (metaRole === "admin" || metaRole === "super_admin") {
      isAdmin = true;
    } else if (ADMIN_USER_IDS.includes(userId)) {
      isAdmin = true;
      if (IS_PROD) {
        const userId_hash = await hashUserId(userId);
        console.warn("admin.breakglass_used", {
          route: new URL(request.url).pathname,
          userId_hash,
        });
      }
    }

    if (!isAdmin) {
      // usuário logado mas sem permissão → home, não /gerar
      const userId_hash = await hashUserId(userId);
      console.warn("admin.deny", {
        route: new URL(request.url).pathname,
        userId_hash,
        reason: denyReason,
      });
      return redirectTo("/", request);
    }
  } else if (isProtectedRoute(request)) {
    await auth.protect();

    // Redirecionar server-side: /onboarding → /gerar se já tem loja
    // e /gerar,/historico etc → /onboarding se não tem loja
    const session = await auth();
    if (session.userId) {
      const cookieName = STORE_COOKIE_PREFIX + session.userId;
      const cached = request.cookies.get(cookieName)?.value;

      let storeExists: boolean | "unknown";
      if (cached === "1") storeExists = true;
      else if (cached === "0") storeExists = false;
      else storeExists = await hasStore(session.userId);

      let response: NextResponse | undefined;
      if (isOnboardingRoute(request)) {
        // se "unknown" (Supabase falhou), NÃO redireciona — deixa a página tratar.
        if (storeExists === true) {
          response = redirectTo("/gerar", request);
        }
      } else if (isAuthAppRoute(request)) {
        // só redireciona para onboarding se temos certeza que não tem loja.
        // Em erro de DB, deixamos a página carregar e tratar — evita loop/flicker.
        if (storeExists === false) {
          response = redirectTo("/onboarding", request);
        }
      }

      // Persist cache só quando bateu no DB (não sobrescreve a cada hit do cookie).
      if (cached === undefined && storeExists !== "unknown") {
        const res = response ?? NextResponse.next();
        res.cookies.set(cookieName, storeExists ? "1" : "0", {
          maxAge: STORE_COOKIE_TTL,
          path: "/",
          sameSite: "lax",
          httpOnly: true,
        });
        return res;
      }
      if (response) return response;
    }
  }
});

export const config = {
  matcher: [
    // Skip static files and internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
