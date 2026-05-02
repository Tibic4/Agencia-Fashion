"use client";

import { useState, useTransition } from "react";
import { markCampaignFailed, markAllStuckFailed } from "./actions";

interface StuckCampaign {
  id: string;
  status: string;
  created_at: string;
  store_id: string;
  stores: { name: string } | null;
}

export function StuckCampaignsSection({
  campaigns,
}: {
  campaigns: StuckCampaign[];
}) {
  const [items, setItems] = useState(campaigns);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  const handleFixOne = (id: string) => {
    startTransition(async () => {
      const result = await markCampaignFailed(id);
      if (result.success) {
        setItems((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  const handleFixAll = () => {
    startTransition(async () => {
      const result = await markAllStuckFailed();
      if (result.success) {
        setItems([]);
      }
    });
  };

  return (
    <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-amber-500/20 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-amber-300">
            ⚠️ Campanhas presas ({items.length})
          </h2>
          <span className="text-2xs text-amber-500">
            processing &gt; 5 min
          </span>
        </div>
        {items.length > 1 && (
          <button
            onClick={handleFixAll}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition disabled:opacity-50"
          >
            {isPending ? "Corrigindo..." : `🔧 Corrigir todas (${items.length})`}
          </button>
        )}
      </div>
      <div className="divide-y divide-amber-500/10 max-h-64 overflow-y-auto">
        {items.map((c) => {
          const stuckSince = new Date(c.created_at);
          const minutesStuck = Math.round(
            (Date.now() - stuckSince.getTime()) / 60000
          );
          return (
            <div
              key={c.id}
              className="px-4 md:px-6 py-3 flex items-center justify-between"
            >
              <div>
                <span className="text-sm text-amber-200">
                  {c.stores?.name || "Loja"}
                </span>
                <span className="text-2xs text-amber-500 ml-2">
                  presa há {minutesStuck} min
                </span>
                <p className="text-2xs text-gray-500 font-mono mt-0.5">
                  {c.id.slice(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => handleFixOne(c.id)}
                disabled={isPending}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/30 transition disabled:opacity-50"
              >
                {isPending ? "..." : "🔧 Marcar falha"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
