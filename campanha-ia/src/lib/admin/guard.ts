/**
 * Admin guard — verifica se o usuário autenticado é admin.
 * Usado por TODAS as rotas /api/admin/*.
 *
 * Estratégia:
 * 1. Checa ADMIN_USER_IDS no .env (lista separada por vírgula)
 * 2. Fallback: checa publicMetadata.role via sessionClaims do Clerk
 */

import { auth } from "@clerk/nextjs/server";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Verifica se o user atual é admin.
 * Retorna { isAdmin: true, userId } se sim, ou { isAdmin: false, userId: null } se não.
 */
export async function requireAdmin(): Promise<{ isAdmin: true; userId: string } | { isAdmin: false; userId: null }> {
  const session = await auth();
  if (!session.userId) {
    return { isAdmin: false, userId: null };
  }

  // 1. Checar por ID direto (mais confiável)
  if (ADMIN_USER_IDS.includes(session.userId)) {
    return { isAdmin: true, userId: session.userId };
  }

  // 2. Checar por publicMetadata.role no Clerk
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const metadata = claims?.metadata as { role?: string } | undefined;
  const publicMetadata = claims?.publicMetadata as { role?: string } | undefined;
  const role = metadata?.role || publicMetadata?.role;

  if (role === "admin" || role === "super_admin") {
    return { isAdmin: true, userId: session.userId };
  }

  return { isAdmin: false, userId: null };
}
