"use client";

import { useState, useEffect } from "react";
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
  campaign_scores: { nota_geral: number }[] | null;
  campaign_outputs: { headline_principal: string }[] | null;
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse" style={{ background: "var(--gradient-brand)", color: "white" }}>
            ⏳
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Carregando campanhas...</p>
        </div>
      </div>
    );
  }

  const historyLabel = planInfo?.historyDays === 0 ? "ilimitado" : `${planInfo?.historyDays || 7} dias`;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            <span className="gradient-text">Histórico</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""} gerada{campaigns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/gerar" className="btn-primary text-sm !py-2.5">
          + Nova campanha
        </Link>
      </div>

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
          <span className="text-5xl mb-4 block">📭</span>
          <h2 className="text-xl font-bold mb-2">Nenhuma campanha ainda</h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Gere sua primeira campanha com IA em 60 segundos!
          </p>
          <Link href="/gerar" className="btn-primary inline-flex">
            ⚡ Gerar primeira campanha
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign, i) => {
            const score = campaign.campaign_scores?.[0]?.nota_geral;
            const headline = campaign.campaign_outputs?.[0]?.headline_principal || `Campanha ${campaign.objective ? objectiveLabels[campaign.objective] || campaign.objective : ""}`;

            return (
              <Link
                key={campaign.id}
                href={`/gerar/demo?id=${campaign.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:-translate-y-0.5 group"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  animationDelay: `${i * 0.05}s`,
                }}
              >
                {/* Status icon */}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "var(--gradient-card)" }}>
                  {campaign.status === "completed" ? "✅" : campaign.status === "failed" ? "❌" : "⏳"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-[var(--brand-500)] transition truncate">
                    {headline}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    R$ {Number(campaign.price).toFixed(2).replace(".", ",")} · {objectiveLabels[campaign.objective || ""] || "—"} · {formatDate(campaign.created_at)}
                  </p>
                </div>

                {/* Score */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {score ? (
                    <div className="text-right">
                      <p className="text-lg font-black gradient-text">{score}</p>
                      <p className="text-[10px]" style={{ color: "var(--muted)" }}>score</p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {campaign.status === "processing" ? "Processando..." : campaign.status === "failed" ? "Falhou" : "—"}
                      </p>
                    </div>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
