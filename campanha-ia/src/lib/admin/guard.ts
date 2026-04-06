/**
 * Admin guard — verifica se o usuário autenticado é admin.
 * Usado por TODAS as rotas /api/admin/*.
 *
 * Estratégia: checa `publicMetadata.role` via sessionClaims do Clerk.
 * A publicMetadata é configurada no Dashboard do Clerk por usuário.
 */

import { auth } from "@clerk/nextjs/server";

/**
 * Verifica se o user atual é admin.
 * Retorna { isAdmin: true, userId } se sim, ou { isAdmin: false, userId: null } se não.
 */
export async function requireAdmin(): Promise<{ isAdmin: true; userId: string } | { isAdmin: false; userId: null }> {
  const session = await auth();
  if (!session.userId) {
    return { isAdmin: false, userId: null };
  }

  // Clerk expõe publicMetadata como sessionClaims.metadata
  const metadata = session.sessionClaims?.metadata as { role?: string } | undefined;
  const role = metadata?.role;

  if (role === "admin" || role === "super_admin") {
    return { isAdmin: true, userId: session.userId };
  }

  return { isAdmin: false, userId: null };
}
