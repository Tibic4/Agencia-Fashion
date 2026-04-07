"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";

const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
);
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconCampaign = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);
const IconCosts = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconLogs = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
);
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);
const IconX = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: <IconDashboard /> },
  { href: "/admin/clientes", label: "Clientes", icon: <IconUsers /> },
  { href: "/admin/campanhas", label: "Campanhas", icon: <IconCampaign /> },
  { href: "/admin/custos", label: "Custos API", icon: <IconCosts /> },
  { href: "/admin/logs", label: "Logs", icon: <IconLogs /> },
  { href: "/admin/vitrine", label: "Vitrine", icon: <span className="text-base">🖼️</span> },
  { href: "/admin/configuracoes", label: "Configurações", icon: <IconSettings /> },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar — Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 bg-gray-900 border-r border-gray-800">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-6 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold">
            A
          </div>
          <span className="text-lg font-bold text-white tracking-tight">
            Cria<span className="text-amber-400">Look</span>
            <span className="text-xs ml-1 text-amber-400/60 font-normal">Admin</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                  isActive
                    ? "bg-amber-500/10 text-amber-400 border-l-[3px] border-amber-500"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border-l-[3px] border-transparent"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to app */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <Link
            href="/gerar"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition min-h-[44px]"
          >
            <IconArrowLeft />
            Voltar ao app
          </Link>
          <div className="flex items-center gap-3 px-3">
            <UserButton />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Administrador</p>
              <p className="text-xs text-gray-500 truncate">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header — hamburger + bottom nav */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-xl h-14 flex items-center justify-between px-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold">
            A
          </div>
          <span className="text-base font-bold text-white">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/gerar" className="p-2 rounded-lg text-gray-500 hover:text-white transition min-h-[44px] min-w-[44px] flex items-center justify-center">
            <IconArrowLeft />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-400 hover:text-white transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {mobileMenuOpen ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute top-14 right-0 w-56 bg-gray-900 border-l border-b border-gray-800 rounded-bl-2xl shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="p-3 space-y-1">
              {adminNav.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                      isActive
                        ? "bg-amber-500/10 text-amber-400"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-gray-800">
              <div className="flex items-center gap-3 px-3 py-2">
                <UserButton />
                <p className="text-xs text-gray-400">Administrador</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav — quick access to top 5 items */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800 flex items-center justify-around px-1 py-1 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {adminNav.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition min-w-0 min-h-[48px] justify-center ${
                isActive ? "text-amber-400" : "text-gray-500"
              }`}
            >
              <span className="scale-90">{item.icon}</span>
              <span className="text-[9px] font-medium truncate max-w-[52px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 pb-16 lg:pb-0 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
