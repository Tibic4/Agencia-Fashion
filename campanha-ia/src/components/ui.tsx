import Link from "next/link";

/**
 * Header público com logo e CTA — usado nas páginas públicas
 */
export function PublicHeader({ showCta = true }: { showCta?: boolean }) {
  return (
    <header className="glass fixed top-0 left-0 right-0 z-50" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="container flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-brand)", color: "white" }}>
            ✨
          </div>
          <span className="text-lg font-bold">
            <span className="gradient-text">CriaLook</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: "var(--muted)" }}>
          <Link href="/sobre" className="hover:text-[var(--foreground)] transition">Sobre</Link>
          <Link href="/#precos" className="hover:text-[var(--foreground)] transition">Preços</Link>
          <Link href="/sign-in" className="hover:text-[var(--foreground)] transition font-medium">Entrar</Link>
          {showCta && (
            <Link href="/sign-up" className="btn-primary text-sm !py-2 !px-3 sm:!py-2.5 sm:!px-5">
              <span className="sm:hidden">Começar</span>
              <span className="hidden sm:inline">Testar na prática</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

/**
 * Footer público com links legais e copyright
 */
export function PublicFooter() {
  return (
    <footer className="py-12" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ background: "var(--gradient-brand)", color: "white" }}>
              ✨
            </div>
            <span className="text-sm font-bold"><span className="gradient-text">CriaLook</span></span>
          </div>
          <nav className="flex items-center gap-6 text-xs" style={{ color: "var(--muted)" }}>
            <Link href="/sobre" className="hover:text-[var(--foreground)] transition">Sobre</Link>
            <Link href="/termos" className="hover:text-[var(--foreground)] transition">Termos</Link>
            <Link href="/privacidade" className="hover:text-[var(--foreground)] transition">Privacidade</Link>
          </nav>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            © {new Date().getFullYear()} CriaLook
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Badge / Tag reutilizável
 */
export function Badge({
  children,
  variant = "brand",
}: {
  children: React.ReactNode;
  variant?: "brand" | "success" | "warning" | "danger";
}) {
  const styles: Record<string, { bg: string; color: string }> = {
    brand: { bg: "var(--brand-50)", color: "var(--brand-600)" },
    success: { bg: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" },
    warning: { bg: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--warning)" },
    danger: { bg: "color-mix(in srgb, var(--error) 12%, transparent)", color: "var(--error)" },
  };
  const s = styles[variant] || styles.brand;
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

/**
 * Card com glassmorphism
 */
export function GlassCard({
  children,
  className = "",
  padding = "p-6",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-2xl ${padding} ${className}`}
      style={{
        background: "var(--background)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Score indicator (circular)
 */
export function ScoreCircle({
  score,
  size = 64,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <span className="text-lg font-bold" style={{ color, marginTop: -size / 2 - 10, position: "relative" }}>
        {score}
      </span>
      {label && <span className="text-2xs mt-2" style={{ color: "var(--muted)" }}>{label}</span>}
    </div>
  );
}
