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
    console.log("[Admin Guard] No userId — not authenticated");
    return { isAdmin: false, userId: null };
  }

  // Debug: ver toda a estrutura de claims
  const claims = session.sessionClaims;
  console.log("[Admin Guard] userId:", session.userId);
  console.log("[Admin Guard] sessionClaims keys:", claims ? Object.keys(claims) : "null");
  console.log("[Admin Guard] metadata:", JSON.stringify((claims as Record<string, unknown>)?.metadata));
  console.log("[Admin Guard] publicMetadata:", JSON.stringify((claims as Record<string, unknown>)?.publicMetadata));
  console.log("[Admin Guard] public_metadata:", JSON.stringify((claims as Record<string, unknown>)?.public_metadata));

  // Tentar múltiplos paths possíveis
  const metadata = (claims as Record<string, unknown>)?.metadata as { role?: string } | undefined;
  const publicMetadata = (claims as Record<string, unknown>)?.publicMetadata as { role?: string } | undefined;
  const publicMeta2 = (claims as Record<string, unknown>)?.public_metadata as { role?: string } | undefined;
  
  const role = metadata?.role || publicMetadata?.role || publicMeta2?.role;

  console.log("[Admin Guard] Resolved role:", role);

  if (role === "admin" || role === "super_admin") {
    return { isAdmin: true, userId: session.userId };
  }

  return { isAdmin: false, userId: null };
}
