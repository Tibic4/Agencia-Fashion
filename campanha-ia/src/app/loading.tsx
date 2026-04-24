/* eslint-disable @next/next/no-img-element */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
      <div className="text-center">
        <img
          src="/logo.webp"
          alt="CriaLook"
          width={64}
          height={64}
          className="mx-auto mb-4 rounded-full animate-pulse-glow"
        />
        <p className="text-lg font-bold tracking-tight mb-3" style={{ color: 'var(--foreground)' }}>
          Cria<span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Look</span>
        </p>
        <div className="w-8 h-8 border-3 border-[var(--brand-200)] border-t-[var(--brand-500)] rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}
