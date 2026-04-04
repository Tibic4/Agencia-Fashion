"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const channels = [
  { id: "instagram_feed", label: "Instagram Feed", icon: "📸" },
  { id: "instagram_stories", label: "Stories", icon: "📱" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬" },
  { id: "meta_ads", label: "Meta Ads", icon: "📢" },
];

// Fallback mock data (used when no sessionStorage data)
const fallbackTexts: Record<string, { title: string; text: string; extra?: string }> = {
  instagram_feed: {
    title: "Legenda Instagram Feed",
    text: "✨ Ela chegou pra roubar a cena!\n\nVestido floral perfeito pro verão — confortável, estiloso e com aquele caimento que valoriza qualquer corpo.\n\n💕 De R$ 129,90 por apenas R$ 89,90\n\n📲 Chama no direct ou no WhatsApp que a gente te atende!\n\n#modafeminina #vestidofloral #looknovo #fashionstyle #tendencia2026 #lookdodia #modabrasileira #estiloconfortavel",
    extra: "#modafeminina #vestidofloral #looknovo #fashionstyle #tendencia2026",
  },
  instagram_stories: {
    title: "Roteiro Stories (3 slides)",
    text: "🎬 Slide 1: \"Olha essa LINDEZA que acabou de chegar! 😍\"\n\n🎬 Slide 2: \"Vestido floral, tecido fresquinho, perfeito pro calor! Caimento incrível em todos os corpos 💃\"\n\n🎬 Slide 3: \"De R$ 129,90 por R$ 89,90 — mas corre que tem pouca unidade!\"\n\n📲 CTA: \"Arrasta pra cima ou chama no direct!\"",
  },
  whatsapp: {
    title: "Mensagem WhatsApp",
    text: "Oi! 🌸\n\nAcabou de chegar vestido floral LINDO, super fresquinho pro calor!\n\nTecido macio, caimento perfeito 💃\n\nDe R$ 129,90 por apenas *R$ 89,90*\n\nTem pouca unidade, hein! Quer ver mais fotos? 📲\n\n👉 Disponível nos tamanhos P, M e G",
  },
  meta_ads: {
    title: "Anúncio Meta Ads",
    text: "Título: Vestido Floral — Conforto & Estilo\n\nTexto principal: Tecido fresquinho, caimento perfeito e preço que cabe no bolso. Vestido floral por R$ 89,90.\n\nDescrição: Frete grátis acima de R$ 150\n\nCTA: Comprar agora",
  },
};

const fallbackScore = {
  nota_geral: 87, conversao: 85, clareza: 92, urgencia: 78,
  naturalidade: 90, aprovacao_meta: 95, nivel_risco: "baixo" as const,
  pontos_fortes: [
    "Linguagem natural e próxima do público",
    "Preço com desconto gera urgência",
    "CTA claro e direto",
    "Emojis bem dosados",
  ],
  melhorias: [
    { campo: "Urgência", sugestao: "Adicionar prazo limitado (ex: 'só até sexta')" },
    { campo: "Social proof", sugestao: "Mencionar vendas anteriores ou avaliações" },
  ],
};

export default function ResultadoCampanha() {
  const [activeChannel, setActiveChannel] = useState("instagram_feed");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [campaignData, setCampaignData] = useState<any>(null);

  // Load data from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("campaignResult");
      if (stored) {
        const parsed = JSON.parse(stored);
        setCampaignData(parsed.data);
        setIsDemo(parsed.demo === true);
      }
    } catch {}
  }, []);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Build texts from API data or fallback
  const getChannelContent = (channelId: string): { title: string; text: string; extra?: string } => {
    if (campaignData?.output) {
      const o = campaignData.output;
      switch (channelId) {
        case "instagram_feed":
          return {
            title: "Legenda Instagram Feed",
            text: o.instagram_feed || fallbackTexts.instagram_feed.text,
            extra: o.hashtags?.map((h: string) => `#${h}`).join(" "),
          };
        case "instagram_stories": {
          const s = o.instagram_stories;
          return {
            title: "Roteiro Stories (3 slides)",
            text: s ? `🎬 Slide 1: "${s.slide_1}"\n\n🎬 Slide 2: "${s.slide_2}"\n\n🎬 Slide 3: "${s.slide_3}"\n\n📲 CTA: "${s.cta_final}"` : fallbackTexts.instagram_stories.text,
          };
        }
        case "whatsapp":
          return { title: "Mensagem WhatsApp", text: o.whatsapp || fallbackTexts.whatsapp.text };
        case "meta_ads": {
          const m = o.meta_ads;
          return {
            title: "Anúncio Meta Ads",
            text: m ? `Título: ${m.titulo}\n\nTexto principal: ${m.texto_principal}\n\nDescrição: ${m.descricao}\n\nCTA: ${m.cta_button}` : fallbackTexts.meta_ads.text,
          };
        }
        default:
          return fallbackTexts[channelId];
      }
    }
    return fallbackTexts[channelId];
  };

  const scoreData = campaignData?.score || fallbackScore;
  const content = getChannelContent(activeChannel);
  const productName = campaignData?.vision?.produto?.nome_generico || "Vestido Floral";
  const durationSec = campaignData?.durationMs ? Math.round(campaignData.durationMs / 1000) : 47;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="badge badge-brand mb-2 inline-flex text-xs">✅ Campanha gerada</div>
          <h1 className="text-2xl font-bold tracking-tight">
            {productName} — <span className="gradient-text">Campanha</span>
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Gerada em {durationSec}s · Score {scoreData.nota_geral}/100 · 4 canais{isDemo && " · 🎭 Demo"}
          </p>
        </div>
        <Link href="/gerar" className="btn-secondary text-sm !py-2">
          + Nova campanha
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Channel tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
                style={{
                  background: activeChannel === ch.id ? "var(--gradient-brand)" : "var(--surface)",
                  color: activeChannel === ch.id ? "white" : "var(--muted)",
                  border: activeChannel === ch.id ? "none" : "1px solid var(--border)",
                }}
              >
                <span>{ch.icon}</span>
                {ch.label}
              </button>
            ))}
          </div>

          {/* Content card */}
          <div className="rounded-2xl p-6" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{content.title}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(content.text, activeChannel)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: copiedField === activeChannel ? "var(--success)" : "var(--brand-100)",
                    color: copiedField === activeChannel ? "white" : "var(--brand-700)",
                  }}
                >
                  {copiedField === activeChannel ? <><IconCheck /> Copiado!</> : <><IconCopy /> Copiar</>}
                </button>
                <button
                  disabled
                  title="Em breve"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium opacity-50 cursor-not-allowed"
                  style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}
                >
                  <IconRefresh /> Regerar
                </button>
              </div>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 rounded-xl" style={{ background: "var(--surface)" }}>
              {content.text}
            </div>
            {content.extra && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--brand-500)" }}>Hashtags:</span>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{content.extra}</p>
                <button
                  onClick={() => copyText(content.extra!, "hashtags")}
                  className="text-xs px-2 py-1 rounded transition"
                  style={{ color: "var(--brand-500)" }}
                >
                  {copiedField === "hashtags" ? "✓" : "Copiar"}
                </button>
              </div>
            )}
          </div>

          {/* Creative preview placeholder */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold">Criativo gerado</h3>
              <button disabled title="Em breve" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium opacity-50 cursor-not-allowed" style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}>
                <IconDownload /> Em breve
              </button>
            </div>
            <div className="aspect-square max-h-96 flex items-center justify-center" style={{ background: "var(--gradient-brand-soft)" }}>
              <div className="text-center p-8">
                <div className="text-6xl mb-4">👗</div>
                <p className="text-lg font-bold gradient-text">{productName}</p>
                <p className="text-2xl font-black mt-2">
                  {campaignData?.vision?.produto ? `R$ ${campaignData?.output?.meta_ads?.texto_principal?.match(/R\$\s*[\d.,]+/)?.[0]?.replace('R$ ', '') || '—'}` : 'R$ —'}
                </p>
                <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>
                  Criativo visual com modelo virtual — em breve
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Score */}
        <div className="space-y-4">
          {/* Score card */}
          <div className="rounded-2xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Score de qualidade</h3>
              <span className="badge badge-brand text-xs">
                Risco {scoreData.nivel_risco}
              </span>
            </div>

            {/* Overall score */}
            <div className="text-center mb-6">
              <div className="relative w-28 h-28 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke="url(#scoreGradient)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(scoreData.nota_geral / 100) * 327} 327`}
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-black gradient-text">{scoreData.nota_geral}</span>
                </div>
              </div>
            </div>

            {/* Individual scores */}
            <div className="space-y-3">
              {[
                { label: "Conversão", value: scoreData.conversao },
                { label: "Clareza", value: scoreData.clareza },
                { label: "Urgência", value: scoreData.urgencia },
                { label: "Naturalidade", value: scoreData.naturalidade },
                { label: "Meta Ads ✓", value: scoreData.aprovacao_meta },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--muted)" }}>{s.label}</span>
                    <span className="font-semibold">{s.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.value}%`,
                        background: s.value >= 80 ? "var(--success)" : s.value >= 60 ? "var(--warning)" : "var(--error)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div className="rounded-2xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--success)" }}>✅ Pontos fortes</h3>
            <div className="space-y-2">
              {scoreData.pontos_fortes.map((p: string, i: number) => (
                <p key={i} className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>• {p}</p>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div className="rounded-2xl p-5" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--warning)" }}>💡 Melhorias sugeridas</h3>
            <div className="space-y-3">
              {scoreData.melhorias.map((m: { campo: string; sugestao: string }, i: number) => (
                <div key={i}>
                  <p className="text-xs font-semibold">{m.campo}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{m.sugestao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
