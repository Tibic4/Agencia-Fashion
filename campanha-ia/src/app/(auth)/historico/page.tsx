"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Campaign {
  id: string;
  price: number;
  objective: string | null;
  target_audience: string | null;
  status: string;
  created_at: string;
  pipeline_duration_ms: number | null;
  regen_count: number | null;
  preview_token: string | null;
  is_favorited: boolean;
  campaign_scores: { nota_geral: number }[] | null;
  campaign_outputs: { headline_principal: string }[] | null;
  // Pipeline v3: output JSONB from campaigns table
  output: {
    version?: string;
    analise?: {
      tipo_peca?: string;
      cor_principal?: { nome?: string; hex?: string };
    };
    image_urls?: (string | null)[];
    success_count?: number;
  } | null;
}

interface PlanInfo {
  name: string;
  historyDays: number;
  regenLimit: number;
  fullScore: boolean;
  allChannels: boolean;
  previewLink: boolean;
}

const objectiveLabels: Record<string, string> = {
  venda_imediata: "💰 Venda",
  lancamento: "🚀 Lançamento",
  promocao: "🔥 Promoção",
  engajamento: "💬 Engajamento",
};

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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /** Toggle favorito — optimistic UI */
  const toggleFavorite = useCallback(async (campaignId: string, currentState: boolean) => {
    setTogglingId(campaignId);

    // Optimistic: atualiza instantaneamente na UI
    setCampaigns(prev =>
      prev.map(c => c.id === campaignId ? { ...c, is_favorited: !currentState } : c)
    );

    try {
      const res = await fetch(`/api/campaign/${campaignId}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: !currentState }),
      });

      if (!res.ok) {
        // Rollback on error
        setCampaigns(prev =>
          prev.map(c => c.id === campaignId ? { ...c, is_favorited: currentState } : c)
        );
      }
    } catch {
      // Rollback on network error
      setCampaigns(prev =>
        prev.map(c => c.id === campaignId ? { ...c, is_favorited: currentState } : c)
      );
    } finally {
      setTogglingId(null);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/campaigns");
        if (!res.ok) {
          if (res.status === 404) {
            setCampaigns([]);
            return;
          }
          throw new Error(`Erro ${res.status}`);
        }
        const data = await res.json();
        setCampaigns(data.data || []);
        if (data.plan) setPlanInfo(data.plan);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao carregar";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="skeleton skeleton-title" style={{ width: '140px' }} />
            <div className="skeleton skeleton-text" style={{ width: '100px' }} />
          </div>
          <div className="skeleton" style={{ width: '140px', height: '40px' }} />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-4">
                <div className="skeleton" style={{ width: '56px', height: '56px', borderRadius: '12px' }} />
                <div className="flex-1">
                  <div className="skeleton skeleton-title" style={{ width: `${60 + i * 10}%` }} />
                  <div className="skeleton skeleton-text" style={{ width: `${40 + i * 10}%` }} />
                </div>
                <div className="skeleton" style={{ width: '60px', height: '28px', borderRadius: '999px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const historyLabel = planInfo?.historyDays === 0 ? "ilimitado" : `${planInfo?.historyDays || 7} dias`;
  const favCount = campaigns.filter(c => c.is_favorited).length;
  const filteredCampaigns = filter === "favorites" ? campaigns.filter(c => c.is_favorited) : campaigns;

  return (
    <div className="animate-fade-in-up" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            <span className="gradient-text">Histórico</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""} gerada{campaigns.length !== 1 ? "s" : ""}
            {favCount > 0 && (
              <span> · <span style={{ color: "var(--brand-500)" }}>⭐ {favCount} favorita{favCount !== 1 ? "s" : ""}</span></span>
            )}
          </p>
        </div>
        <Link href="/gerar" className="btn-primary text-sm !py-2 min-h-[44px] flex items-center justify-center flex-shrink-0" style={{ whiteSpace: 'nowrap' }}>
          + Nova
        </Link>
      </div>

      {/* Filter tabs */}
      {campaigns.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter("all")}
            className="text-xs font-semibold px-4 py-2 rounded-full transition-all min-h-[36px]"
            style={{
              background: filter === "all" ? "var(--brand-500)" : "var(--surface)",
              color: filter === "all" ? "white" : "var(--muted)",
              border: filter === "all" ? "none" : "1px solid var(--border)",
            }}
          >
            Todas ({campaigns.length})
          </button>
          <button
            onClick={() => setFilter("favorites")}
            className="text-xs font-semibold px-4 py-2 rounded-full transition-all min-h-[36px]"
            style={{
              background: filter === "favorites" ? "var(--brand-500)" : "var(--surface)",
              color: filter === "favorites" ? "white" : "var(--muted)",
              border: filter === "favorites" ? "none" : "1px solid var(--border)",
            }}
          >
            ⭐ Favoritas ({favCount})
          </button>
        </div>
      )}

      {/* Aviso de expiração de histórico */}
      {planInfo && planInfo.historyDays > 0 && (
        <div className="mb-6 p-3 rounded-xl flex items-center gap-3 text-xs" style={{ background: "var(--brand-50)", border: "1px solid var(--brand-200)" }}>
          <span>📅</span>
          <p>
            Seu plano mostra campanhas dos últimos <strong>{historyLabel}</strong>.{" "}
            <Link href="/plano" className="font-semibold underline" style={{ color: "var(--brand-600)" }}>
              Faça upgrade
            </Link>{" "}
            para histórico mais longo.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <span>⚠️</span>
          <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          {/* SVG illustration instead of emoji */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ background: 'var(--gradient-card)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
              <circle cx="15" cy="15" r="2" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Nenhuma campanha ainda</h2>
          <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: "var(--muted)" }}>
            Gere sua primeira campanha com IA em 60 segundos!
          </p>
          <Link href="/gerar" className="btn-primary inline-flex min-h-[48px] items-center">
            ⚡ Gerar primeira campanha
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filter === "favorites" && filteredCampaigns.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">⭐</div>
              <p className="font-semibold mb-1">Nenhuma campanha favorita</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Toque na ⭐ para proteger campanhas do arquivamento automático
              </p>
            </div>
          )}
          {filteredCampaigns.map((campaign, i) => {
            const score = campaign.campaign_scores?.[0]?.nota_geral;
            // v3: nome da peça vem de output.analise | v2: headline_principal de campaign_outputs
            const v3Name = campaign.output?.analise?.tipo_peca;
            const v3Color = campaign.output?.analise?.cor_principal?.nome;
            const v2Name = campaign.campaign_outputs?.[0]?.headline_principal;
            const objLabel = campaign.objective ? objectiveLabels[campaign.objective] || campaign.objective : "";
            const headline = v2Name
              || (v3Name ? `${v3Name} ${objLabel}${v3Color ? ` — ${v3Color}` : ""}` : `Campanha ${objLabel}`);
            const isFav = campaign.is_favorited;
            const isToggling = togglingId === campaign.id;

            return (
              <div
                key={campaign.id}
                className="flex items-center gap-2 p-3 rounded-2xl transition-all group min-h-[60px]"
                style={{
                  background: isFav ? "var(--brand-50, rgba(236,72,153,0.04))" : "var(--background)",
                  border: isFav ? "1px solid var(--brand-200, rgba(236,72,153,0.2))" : "1px solid var(--border)",
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
              >
                {/* Star favorite button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(campaign.id, isFav);
                  }}
                  disabled={isToggling}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 min-h-[36px]"
                  style={{
                    background: isFav ? "var(--brand-100, rgba(236,72,153,0.12))" : "var(--surface)",
                    border: isFav ? "1px solid var(--brand-300, rgba(236,72,153,0.3))" : "1px solid var(--border)",
                    opacity: isToggling ? 0.6 : 1,
                    cursor: isToggling ? "wait" : "pointer",
                  }}
                  title={isFav ? "Remover dos favoritos" : "Favoritar — protege do arquivamento"}
                  aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <svg
                    width="18" height="18"
                    viewBox="0 0 24 24"
                    fill={isFav ? "var(--brand-500, #ec4899)" : "none"}
                    stroke={isFav ? "var(--brand-500, #ec4899)" : "var(--muted)"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: "all 0.2s ease" }}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>

                {/* Clickable area → navigate to campaign */}
                <Link
                  href={`/gerar/demo?id=${campaign.id}`}
                  className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0"
                >
                  {/* Status icon */}
                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-base sm:text-xl flex-shrink-0" style={{ background: "var(--gradient-card)" }}>
                    {campaign.status === "completed" ? "✅" : campaign.status === "failed" ? "❌" : "⏳"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="font-semibold text-sm truncate">
                      {headline}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
                      R$ {Number(campaign.price).toFixed(2).replace(".", ",")} · {objectiveLabels[campaign.objective || ""] || "—"} · {formatDate(campaign.created_at)}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {score ? (
                      <div className="text-right">
                        <p className="text-base sm:text-lg font-black gradient-text">{score}</p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-[10px] sm:text-xs" style={{ color: "var(--muted)" }}>
                          {campaign.status === "processing" ? "..." : campaign.status === "failed" ? "❌" : ""}
                        </p>
                      </div>
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
