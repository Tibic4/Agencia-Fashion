"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
);
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconCampaign = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);
const IconCosts = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconLogs = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
);
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: <IconDashboard /> },
  { href: "/admin/clientes", label: "Clientes", icon: <IconUsers /> },
  { href: "/admin/campanhas", label: "Campanhas", icon: <IconCampaign /> },
  { href: "/admin/custos", label: "Custos", icon: <IconCosts /> },
  { href: "/admin/logs", label: "Logs", icon: <IconLogs /> },
  { href: "/admin/vitrine", label: "Vitrine", icon: <span className="text-sm">🖼️</span> },
  { href: "/admin/configuracoes", label: "Ajustes", icon: <IconSettings /> },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#050505] text-[#FAFAFA] selection:bg-fuchsia-500/30">
      {/* Sidebar — Desktop */}
      <aside className="hidden lg:flex flex-col w-[260px] fixed inset-y-0 left-0 z-30 bg-[#050505] border-r border-white/5">
        {/* Logo */}
        <div className="h-20 flex items-center gap-3 px-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white text-xs font-black shadow-[0_0_15px_rgba(217,70,239,0.2)]">
            A
          </div>
          <span className="text-lg font-bold tracking-tight">
            Cria<span className="text-fuchsia-400">Look</span>
            <span className="text-[10px] ml-1.5 uppercase tracking-widest text-[#A1A1AA] font-semibold">Admin</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all min-h-[44px] ${
                  isActive
                    ? "text-white bg-white/5 shadow-[inset_0_1px_rgba(255,255,255,0.05)] border-l-[2px] border-fuchsia-400"
                    : "text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/[0.02] border-l-[2px] border-transparent"
                }`}
              >
                <div className={isActive ? "text-fuchsia-400" : "opacity-70"}>{item.icon}</div>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to app */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <Link
            href="/gerar"
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium text-[#A1A1AA] hover:text-white hover:bg-white/5 transition min-h-[44px]"
          >
            <span className="opacity-70"><IconArrowLeft /></span>
            Voltar ao painel cliente
          </Link>
          <div className="flex items-center gap-3 px-4 py-2 mt-2">
            <UserButton />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate">Administrador</p>
              <p className="text-[10px] uppercase tracking-widest text-[#71717A] truncate">System</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header (Minimalist) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#050505]/80 backdrop-blur-2xl h-14 flex items-center justify-between px-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white text-[10px] font-black">
            A
          </div>
          <span className="text-sm font-bold tracking-tight">
            Cria<span className="text-fuchsia-400">Look</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/gerar" className="text-xs text-[#A1A1AA] hover:text-white font-medium flex items-center gap-1 transition">
            Voltar
          </Link>
          <UserButton />
        </div>
      </header>

      {/* Mobile Floating Glass Dock */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-50 bg-[#121212]/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center overflow-x-auto px-2 py-1.5 scrollbar-hide pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {adminNav.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[64px] min-h-[48px] justify-center shrink-0 ${
                isActive 
                  ? "bg-white/10 text-white shadow-[inset_0_1px_rgba(255,255,255,0.05)]" 
                  : "text-[#71717A] hover:text-white"
              }`}
            >
              <span className={isActive ? "text-fuchsia-400" : ""}>{item.icon}</span>
              <span className={`text-[9px] font-bold tracking-wide truncate max-w-[60px] ${isActive ? "opacity-100" : "opacity-0 h-0 hidden"}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 lg:ml-[260px] pt-14 pb-24 lg:pb-0 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
