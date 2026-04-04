"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const IconSparkles = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);
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

const navItems = [
  { href: "/gerar", label: "Nova Campanha", icon: <IconPlus /> },
  { href: "/historico", label: "Histórico", icon: <IconHistory /> },
  { href: "/modelo", label: "Modelo Virtual", icon: <IconUser /> },
  { href: "/configuracoes", label: "Configurações", icon: <IconSettings /> },
  { href: "/plano", label: "Meu Plano", icon: <IconCreditCard /> },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface)" }}>
      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30"
        style={{
          background: "var(--background)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-brand)", color: "white" }}
          >
            <IconSparkles />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Campanha <span className="gradient-text">IA</span>
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
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
        </nav>

        {/* Usage indicator */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="rounded-xl p-3" style={{ background: "var(--gradient-card)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                Campanhas usadas
              </span>
              <span className="text-xs font-bold gradient-text">2/3</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: "66%", background: "var(--gradient-brand)" }}
              />
            </div>
            <p className="text-[10px] mt-2" style={{ color: "var(--muted)" }}>
              Plano Grátis · Renova em 28 dias
            </p>
          </div>
        </div>

        {/* User */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--brand-100)", color: "var(--brand-600)" }}
            >
              L
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Loja Fashion</p>
              <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
                loja@email.com
              </p>
            </div>
            <button className="p-1.5 rounded-lg transition hover:bg-red-50" style={{ color: "var(--muted)" }}>
              <IconLogOut />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 glass h-14 flex items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-brand)", color: "white" }}
          >
            <IconSparkles />
          </div>
          <span className="text-base font-bold">
            Campanha <span className="gradient-text">IA</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {navItems.slice(0, 3).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="p-2 rounded-lg transition"
                style={{ color: isActive ? "var(--brand-500)" : "var(--muted)" }}
              >
                {item.icon}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
