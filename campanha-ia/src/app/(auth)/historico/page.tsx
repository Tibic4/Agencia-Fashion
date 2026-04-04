"use client";

import Link from "next/link";

const mockCampaigns = [
  { id: "1", product: "Vestido Floral", price: 89.9, score: 87, status: "completed" as const, date: "2026-04-04T10:30:00", channels: 4 },
  { id: "2", product: "Calça Jeans Skinny", price: 149.9, score: 92, status: "completed" as const, date: "2026-04-03T15:20:00", channels: 4 },
  { id: "3", product: "Blusa Cropped", price: 59.9, score: 78, status: "completed" as const, date: "2026-04-02T09:10:00", channels: 3 },
  { id: "4", product: "Saia Midi Plissada", price: 119.9, score: 85, status: "completed" as const, date: "2026-04-01T14:45:00", channels: 4 },
  { id: "5", product: "Jaqueta Jeans", price: 199.9, score: 91, status: "completed" as const, date: "2026-03-30T11:00:00", channels: 4 },
];

const emojis: Record<string, string> = {
  "Vestido": "👗", "Calça": "👖", "Blusa": "👚", "Saia": "💃", "Jaqueta": "🧥",
};

function getEmoji(name: string) {
  for (const [key, val] of Object.entries(emojis)) {
    if (name.includes(key)) return val;
  }
  return "👕";
}

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString("pt-BR");
}

export default function Historico() {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            <span className="gradient-text">Histórico</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {mockCampaigns.length} campanhas geradas
          </p>
        </div>
        <Link href="/gerar" className="btn-primary text-sm !py-2.5">
          + Nova campanha
        </Link>
      </div>

      <div className="space-y-3">
        {mockCampaigns.map((campaign, i) => (
          <Link
            key={campaign.id}
            href="/gerar/demo"
            className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:-translate-y-0.5 group"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              animationDelay: `${i * 0.05}s`,
            }}
          >
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "var(--gradient-card)" }}>
              {getEmoji(campaign.product)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm group-hover:text-[var(--brand-500)] transition truncate">
                {campaign.product}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                R$ {campaign.price.toFixed(2).replace(".", ",")} · {campaign.channels} canais · {formatDate(campaign.date)}
              </p>
            </div>

            {/* Score */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-lg font-black gradient-text">{campaign.score}</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>score</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
