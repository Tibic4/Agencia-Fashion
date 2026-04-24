"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const ThemeToggle = dynamic(() => import("@/components/ThemeToggle"), { ssr: false });

const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);
const IconHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconCreditCard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
);
const IconLogOut = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
);
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
);

const navItems = [
  { href: "/gerar", label: "Nova Campanha", shortLabel: "Criar", icon: <IconPlus /> },
  { href: "/historico", label: "Histórico", shortLabel: "Histórico", icon: <IconHistory /> },
  { href: "/modelo", label: "Modelo Virtual", shortLabel: "Modelo", icon: <IconUser /> },
  { href: "/configuracoes", label: "Configurações", shortLabel: "Config", icon: <IconSettings /> },
  { href: "/plano", label: "Meu Plano", shortLabel: "Plano", icon: <IconCreditCard /> },
];

interface UsageData {
  campaigns_generated: number;
  campaigns_limit: number;
}

type NavItem = { href: string; label: string; shortLabel: string; icon: React.ReactNode };

function MobileTabBar({ navItems, pathname }: { navItems: NavItem[]; pathname: string }) {
  const navRef = useRef<HTMLElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const activeIndex = navItems.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  useEffect(() => {
    if (!navRef.current || activeIndex < 0) return;
    const el = navRef.current.children[activeIndex] as HTMLElement;
    if (!el) return;
    setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeIndex]);

  return (
    <nav
      ref={navRef}
      className="lg:hidden fixed left-3 right-3 z-30 flex px-1 py-1 rounded-2xl glass"
      style={{
        bottom: "calc(10px + env(safe-area-inset-bottom))",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)",
      }}
    >
      {indicatorStyle.width > 0 && (
        <motion.div
          className="absolute top-1 bottom-1 rounded-xl"
          style={{
            background: "var(--gradient-brand)",
            opacity: 0.12,
          }}
          animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}

      {navItems.map((item, i) => {
        const isActive = i === activeIndex;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl min-h-[48px] justify-center relative"
            aria-label={item.label}
          >
            <motion.div
              className="flex-shrink-0 [&_svg]:w-[22px] [&_svg]:h-[22px]"
              animate={{
                scale: isActive ? 1 : 0.9,
                y: isActive ? -1 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              style={{ color: isActive ? "var(--brand-500)" : "var(--muted)" }}
            >
              {item.icon}
            </motion.div>
            <motion.span
              className="block text-[10px] font-bold leading-none text-center"
              animate={{
                opacity: isActive ? 1 : 0.55,
                scale: isActive ? 1 : 0.95,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              style={{ color: isActive ? "var(--brand-500)" : "var(--muted)" }}
            >
              {item.shortLabel}
            </motion.span>
            {isActive && (
              <motion.div
                layoutId="tab-dot"
                className="absolute -top-0.5 w-1 h-1 rounded-full"
                style={{ background: "var(--brand-500)" }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [storeChecked, setStoreChecked] = useState(false);

  // Carregar usage da loja (middleware já garante que loja existe)
  useEffect(() => {
    if (!isLoaded) return;

    fetch("/api/store/usage")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.data) setUsage(data.data);
        }
        setStoreChecked(true);
      })
      .catch(() => {
        setStoreChecked(true);
      });
  }, [isLoaded]);

  const userName = user?.firstName || user?.fullName || "Minha Loja";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  const isAdmin = (user?.publicMetadata as Record<string, string>)?.role === "admin";
  const userInitial = userName.charAt(0).toUpperCase();

  const campaignsUsed = usage?.campaigns_generated ?? 0;
  const campaignsLimit = usage?.campaigns_limit ?? 0;
  const usagePercent = campaignsLimit > 0 ? Math.min((campaignsUsed / campaignsLimit) * 100, 100) : 0;

  // Bloquear renderização enquanto verificação de loja está pendente
  if (!storeChecked) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]" style={{ background: "var(--surface)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-spin" style={{ border: "3px solid var(--border)", borderTopColor: "var(--brand-500)" }} />
          <span className="text-sm" style={{ color: "var(--muted)" }}>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh]" style={{ background: "var(--surface)", overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Sidebar — Desktop */}
      <aside
        className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30"
        style={{
          background: "var(--background)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <Image src="/logo.webp" alt="CriaLook" width={40} height={40} className="rounded-full" />
          <span className="text-lg font-bold tracking-tight">
            Cria<span className="gradient-text">Look</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]"
                style={{
                  background: isActive ? "var(--gradient-card)" : "transparent",
                  color: isActive ? "var(--brand-600)" : "var(--muted)",
                  borderLeft: isActive ? "3px solid var(--brand-500)" : "3px solid transparent",
                }}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
          {/* Admin link — only visible for admins */}
          {isAdmin && (
            <>
              <div className="my-2 mx-3" style={{ borderTop: "1px solid var(--border)" }} />
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: pathname.startsWith("/admin") ? "linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.03))" : "transparent",
                  color: pathname.startsWith("/admin") ? "#ef4444" : "var(--muted)",
                  borderLeft: pathname.startsWith("/admin") ? "3px solid #ef4444" : "3px solid transparent",
                }}
              >
                <IconShield />
                Painel Admin
              </Link>
            </>
          )}
        </nav>

        {/* Usage indicator — real data */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="rounded-xl p-3" style={{ background: "var(--gradient-card)" }}>
            {!usage ? (
              /* Loading state */
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-24 rounded" style={{ background: "var(--border)" }} />
                <div className="h-2 rounded-full" style={{ background: "var(--border)" }} />
                <div className="h-2 w-16 rounded" style={{ background: "var(--border)" }} />
              </div>
            ) : campaignsLimit === 0 ? (
              /* Sem plano — CTA para comprar */
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                    Comece a criar
                  </span>
                </div>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "var(--muted)" }}>
                  Assine um plano e gere fotos profissionais com IA.
                </p>
                <Link
                  href="/plano"
                  className="block w-full text-center text-xs font-bold py-2.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "var(--gradient-brand)",
                    color: "white",
                    boxShadow: "0 4px 12px rgba(236,72,153,0.2)",
                  }}
                >
                  ⚡ Ativar plano →
                </Link>
              </>
            ) : (
              /* Com plano — barra de progresso */
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    Campanhas usadas
                  </span>
                  <span className="text-xs font-bold gradient-text">
                    {`${campaignsUsed}/${campaignsLimit}`}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${usagePercent}%`,
                      background: usagePercent > 80 ? "var(--warning)" : "var(--gradient-brand)",
                    }}
                  />
                </div>
                <p className="text-[10px] mt-2" style={{ color: "var(--muted)" }}>
                  Créditos disponíveis
                </p>
              </>
            )}
          </div>
        </div>

        {/* User — real data from Clerk */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm"
              style={{ background: "var(--gradient-brand)", color: "white" }}
            >
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{userName}</p>
              <p className="text-xs truncate font-medium" style={{ color: "var(--muted)" }}>
                {userEmail}
              </p>
            </div>
            <ThemeToggle />
            <button
              onClick={() => signOut()}
              className="p-2 rounded-xl transition-all duration-300 min-h-[44px] flex items-center justify-center hover:scale-105 active:scale-95"
              style={{ 
                color: "var(--foreground)", 
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }}
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <IconLogOut />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 glass h-14 flex items-center justify-between px-4 shadow-sm"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link href="/gerar" className="flex items-center gap-2 active:scale-95 transition-transform">
          <Image src="/logo.webp" alt="CriaLook" width={34} height={34} className="rounded-full" />
          <span className="text-base font-bold">
            Cria<span className="gradient-text">Look</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {usage && campaignsLimit === 0 ? (
            <Link 
              href="/plano" 
              className="text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 min-h-[32px] active:scale-95 transition-transform"
              style={{ background: "var(--gradient-brand)", color: "white", boxShadow: "0 2px 8px rgba(236,72,153,0.3)" }}
            >
              ⚡ Ativar plano
            </Link>
          ) : usage ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              {`${campaignsUsed}/${campaignsLimit}`}
            </span>
          ) : null}
        </div>
      </header>

      {/* Mobile Bottom Tab Bar — Floating Island Style */}
      <MobileTabBar navItems={navItems} pathname={pathname} />

      {/* Main Content */}
      <main className="w-full lg:flex-1 lg:ml-64 pt-14 lg:pt-0">
        <style>{`
          @media (max-width: 1023px) {
            main { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important; }
          }
        `}</style>
        <div className="px-4 py-4 sm:p-4 md:p-8 max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
