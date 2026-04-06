/**
 * Admin guard — verifica se o usuário autenticado é admin.
 * Usado por TODAS as rotas /api/admin/*.
 *
 * Estratégia: checa `stores.role` no Supabase (fonte de verdade do DB)
 * O middleware já filtra por sessionClaims (Clerk), esta é a segunda camada.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verifica se o user atual é admin.
 * Retorna { isAdmin: true, userId } se sim, ou { isAdmin: false, userId: null } se não.
 */
export async function requireAdmin(): Promise<{ isAdmin: true; userId: string } | { isAdmin: false; userId: null }> {
  const session = await auth();
  if (!session.userId) {
    return { isAdmin: false, userId: null };
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("stores")
    .select("role")
    .eq("clerk_user_id", session.userId)
    .single();

  const role = data?.role;
  if (role === "admin" || role === "super_admin") {
    return { isAdmin: true, userId: session.userId };
  }

  return { isAdmin: false, userId: null };
}
