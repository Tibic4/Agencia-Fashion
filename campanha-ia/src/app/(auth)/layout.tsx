/**
 * Layout autenticado — agora server component.
 *
 * Antes era `"use client"` inteiro: todo o chrome (sidebar, header mobile,
 * tabs) só renderizava depois da hidratação JS, encadeando com o
 * `app/loading.tsx` global pra dar a sensação de "logo pulsando 2 vezes" em
 * navegações entre /gerar, /historico, /modelo, etc.
 *
 * Agora:
 *   - User data busca via `currentUser()` (server, sem round-trip cliente)
 *   - HTML do chrome estrutural já chega no first byte
 *   - Hooks que precisam de client (usePathname, useClerk, useStoreUsage)
 *     ficam isolados no `<AuthChrome />` (client island)
 *   - Pages dentro de `{children}` continuam podendo SSR sem virar client
 *     por arrasto
 */
import { currentUser } from "@clerk/nextjs/server";
import { StoreUsageProvider } from "@/lib/hooks/useStoreUsage";
import AuthChrome from "./_chrome";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const userName = user?.firstName || user?.fullName || "Minha Loja";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  const userInitial = userName.charAt(0).toUpperCase();
  const isAdmin =
    (user?.publicMetadata as Record<string, string> | undefined)?.role === "admin";

  return (
    <StoreUsageProvider>
      <div
        className="flex min-h-[100dvh]"
        style={{ background: "var(--background)", overflowX: "hidden", maxWidth: "100vw" }}
      >
        <AuthChrome
          userName={userName}
          userEmail={userEmail}
          userInitial={userInitial}
          isAdmin={isAdmin}
        />

        {/* Main Content */}
        <main id="main-content" className="w-full lg:flex-1 lg:ml-64 pt-14 lg:pt-0">
          <style>{`
            @media (max-width: 1023px) {
              main { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important; }
            }
          `}</style>
          <div className="px-4 py-4 sm:p-4 md:p-8 max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </StoreUsageProvider>
  );
}
