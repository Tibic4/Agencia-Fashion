export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center animate-pulse-glow"
          style={{ background: "var(--gradient-brand)", color: "white" }}>
          ✨
        </div>
        <div className="w-8 h-8 border-3 border-[var(--brand-200)] border-t-[var(--brand-500)] rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}
