"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { haptics } from "@/lib/utils/haptics";

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
      pecas?: string[];
      cor_principal?: { nome?: string; hex?: string };
      mood?: string;
      modelagem?: string;
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

const objectiveColors: Record<string, { bg: string; color: string }> = {
  venda_imediata: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
  lancamento: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  promocao: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  engajamento: { bg: "rgba(168,85,247,0.1)", color: "#a855f7" },
};

const ITEMS_PER_PAGE = 10;

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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Historico() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  /** Toggle favorito — optimistic UI */
  const toggleFavorite = useCallback(async (campaignId: string, currentState: boolean) => {
    setTogglingId(campaignId);
    
    // Trigger haptic feedback when favoriting/unfavoriting
    if (currentState) {
      haptics.light(); // Unfavorite
    } else {
      haptics.success(); // Favorite (positive action)
    }

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

  // ── Filtered campaigns + pagination ──
  const favCount = campaigns.filter(c => c.is_favorited).length;
  const filteredCampaigns = useMemo(
    () => filter === "favorites" ? campaigns.filter(c => c.is_favorited) : campaigns,
    [campaigns, filter]
  );
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE));
  const paginatedCampaigns = useMemo(
    () => filteredCampaigns.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredCampaigns, currentPage]
  );

  // Reset to page 1 when filter changes
  useEffect(() => { setCurrentPage(1); }, [filter]);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="mb-8">
          <div className="skeleton skeleton-title" style={{ width: '140px' }} />
          <div className="skeleton skeleton-text" style={{ width: '160px' }} />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl p-5" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-4">
                <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
                <div className="flex-1">
                  <div className="skeleton skeleton-title" style={{ width: `${50 + i * 10}%` }} />
                  <div className="skeleton skeleton-text" style={{ width: `${30 + i * 10}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const historyLabel = planInfo?.historyDays === 0 ? "ilimitado" : `${planInfo?.historyDays || 7} dias`;

  return (
    <div className="animate-fade-in-up">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              <span className="gradient-text">Histórico</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""} gerada{campaigns.length !== 1 ? "s" : ""}
              {favCount > 0 && (
                <span> · <span style={{ color: "var(--brand-500)" }}>⭐ {favCount}</span></span>
              )}
            </p>
          </div>
          <Link
            href="/gerar"
            className="btn-primary text-sm !py-2.5 !px-5 min-h-[44px] flex items-center justify-center flex-shrink-0"
          >
            + Nova
          </Link>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      {campaigns.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2 snap-x hide-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
          <button
            onClick={() => setFilter("all")}
            className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all min-h-[44px] whitespace-nowrap snap-start"
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
            className="text-sm font-semibold px-5 py-2.5 rounded-full transition-all min-h-[44px] whitespace-nowrap snap-start"
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
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3 text-sm" style={{ background: "var(--brand-50)", border: "1px solid var(--brand-200)" }}>
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
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "var(--error, #EF4444)" }}>
          <span className="text-lg">⚠️</span>
          <p className="text-sm font-medium" style={{ color: "#991B1B" }}>
            Não foi possível carregar o histórico. Tente recarregar a página.
          </p>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
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
            Gere sua primeira campanha com IA — só precisa de uma foto!
          </p>
          <Link href="/gerar" className="btn-primary inline-flex min-h-[48px] items-center">
            ⚡ Gerar primeira campanha
          </Link>
        </div>
      ) : (
        <>
          {filter === "favorites" && filteredCampaigns.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">⭐</div>
              <p className="font-semibold mb-1">Nenhuma campanha favorita</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Toque na ⭐ para proteger campanhas do arquivamento automático
              </p>
            </div>
          )}

          {/* ── Campaign Cards ── */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {paginatedCampaigns.map((campaign) => {
                const score = campaign.campaign_scores?.[0]?.nota_geral;
                const v3Analise = campaign.output?.analise;
                const v2Name = campaign.campaign_outputs?.[0]?.headline_principal;
                const objLabel = campaign.objective ? objectiveLabels[campaign.objective] || campaign.objective : "";

                // Build smart headline:
                // Prioridade: pecas[0] (descritivo) > tipo_peca + cor > v2 headline > fallback
                let headline = "";
                if (v2Name) {
                  headline = v2Name;
                } else if (v3Analise) {
                  const firstPeca = v3Analise.pecas?.[0];
                  const tipoPeca = v3Analise.tipo_peca;
                  const cor = v3Analise.cor_principal?.nome;
                  const mood = v3Analise.mood;

                  if (firstPeca && firstPeca.length > 3) {
                    // Use the descriptive name (e.g. "Blusa cropped com manga bufante")
                    headline = capitalize(firstPeca);
                  } else if (tipoPeca) {
                    headline = capitalize(tipoPeca);
                    if (cor) headline += ` ${capitalize(cor)}`;
                  }

                  // Append mood as subtitle (e.g. "· Urbano moderno")
                  if (mood && mood.length > 2 && headline.length < 40) {
                    headline += ` · ${capitalize(mood)}`;
                  }
                }
                if (!headline) headline = `Campanha ${objLabel}`.trim();
                const isFav = campaign.is_favorited;
                const isToggling = togglingId === campaign.id;
                const objStyle = objectiveColors[campaign.objective || ""] || { bg: "var(--surface)", color: "var(--muted)" };

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    key={campaign.id}
                    className="rounded-2xl p-3 sm:p-4 transition-all group overflow-hidden"
                    style={{
                      background: isFav ? "var(--brand-50, rgba(236,72,153,0.04))" : "var(--background)",
                      border: isFav ? "1px solid var(--brand-200, rgba(236,72,153,0.2))" : "1px solid var(--border)",
                    }}
                  >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {/* Star favorite button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(campaign.id, isFav);
                      }}
                      disabled={isToggling}
                      className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all active:scale-90"
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
                      className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0"
                    >
                      {/* Thumbnail or status icon */}
                      {campaign.output?.image_urls?.find(Boolean) ? (
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border)" }}>
                          <img
                            src={campaign.output.image_urls.find(Boolean) as string}
                            alt={headline}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-xl flex-shrink-0" style={{ background: "var(--gradient-card)" }}>
                          {campaign.status === "completed" ? "✅" : campaign.status === "failed" ? "❌" : "⏳"}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-semibold text-[13px] sm:text-[15px] leading-snug truncate">
                          {headline}
                        </p>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <span
                            className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 truncate max-w-[50%]"
                            style={{ background: objStyle.bg, color: objStyle.color }}
                          >
                            {objLabel || "—"}
                          </span>
                          <span className="text-[10px] sm:text-xs truncate" style={{ color: "var(--muted)" }}>
                            {campaign.price > 0 ? `R$ ${Number(campaign.price).toFixed(2).replace(".", ",")}` : ""} · {formatDate(campaign.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Score + Arrow */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {score ? (
                          <div className="text-right">
                            <p className="text-lg font-black gradient-text">{score}</p>
                          </div>
                        ) : null}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 text-sm font-semibold px-3 py-2.5 rounded-xl transition-all min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="flex items-center gap-1 flex-wrap justify-center">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // Show max 5 page buttons: first, last, current ±1
                  if (totalPages <= 5 || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center"
                        style={{
                          background: page === currentPage ? "var(--brand-500)" : "transparent",
                          color: page === currentPage ? "white" : "var(--muted)",
                        }}
                      >
                        {page}
                      </button>
                    );
                  }
                  // Show dots for gaps
                  if (page === 2 && currentPage > 3) {
                    return <span key="dots-start" className="text-xs px-0.5" style={{ color: "var(--muted)" }}>…</span>;
                  }
                  if (page === totalPages - 1 && currentPage < totalPages - 2) {
                    return <span key="dots-end" className="text-xs px-0.5" style={{ color: "var(--muted)" }}>…</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 text-sm font-semibold px-3 py-2.5 rounded-xl transition-all min-h-[44px] disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <span className="hidden sm:inline">Próxima</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          )}

          {/* Page info */}
          {totalPages > 1 && (
            <p className="text-center text-xs mt-3" style={{ color: "var(--muted)" }}>
              Página {currentPage} de {totalPages} · {filteredCampaigns.length} campanha{filteredCampaigns.length !== 1 ? "s" : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
