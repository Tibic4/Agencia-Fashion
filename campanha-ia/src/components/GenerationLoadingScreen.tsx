"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import FashionFactsCarousel from "./FashionFactsCarousel";
import "./GenerationLoadingScreen.css";

/* ─── Props (mantém compatibilidade com a page pai) ─── */
interface Step {
  label: string;
  progress: number;
}

interface GenerationLoadingScreenProps {
  step: number;
  steps: Step[];
}

/* ═══════════════════════════════════════
   Phases — 100% baseado em TEMPO
   
   Pipeline real:
   • Gemini Analyzer: ~10-15s
   • VTO Generation (3 paralelas): ~50-60s
   • Upload + save: ~5-10s
   Total: ~65-90s (média ~80s)
   ═══════════════════════════════════════ */

type Phase = "analyzing" | "editorial" | "shooting" | "polishing" | "almostDone";

function getPhase(elapsed: number, isComplete: boolean): Phase {
  if (isComplete) return "polishing"; // won't render — completion area shows instead
  if (elapsed < 12) return "analyzing";
  if (elapsed < 30) return "editorial";
  if (elapsed < 60) return "shooting";
  if (elapsed < 85) return "polishing";
  return "almostDone";
}

const PHASE_CONFIG: Record<Phase, {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
}> = {
  analyzing: {
    icon: "🔍",
    title: "Analisando sua peça",
    subtitle: "Identificando tecido, cor, modelagem e cada detalhe",
    color: "#818cf8",
  },
  editorial: {
    icon: "✍️",
    title: "Criando o editorial",
    subtitle: "Escrevendo 3 roteiros fotográficos únicos",
    color: "#f472b6",
  },
  shooting: {
    icon: "📸",
    title: "Fotografando com IA",
    subtitle: "Gerando fotos profissionais com modelo virtual",
    color: "#a855f7",
  },
  polishing: {
    icon: "✨",
    title: "Finalizando detalhes",
    subtitle: "Aplicando acabamento editorial profissional",
    color: "#f59e0b",
  },
  almostDone: {
    icon: "🎯",
    title: "Quase lá...",
    subtitle: "Salvando suas fotos em alta qualidade",
    color: "#10b981",
  },
};

/* ── Behind-the-scenes messages per phase ── */
const BEHIND_SCENES: Record<Phase, string[]> = {
  analyzing: [
    "🔍 Analisando tons e saturação da peça…",
    "🧵 Identificando tipo de tecido pelo brilho e textura…",
    "📐 Mapeando caimento e modelagem…",
    "🎨 Extraindo a paleta de cores principal…",
    "✂️ Detectando detalhes: costuras, botões, estampas…",
  ],
  editorial: [
    "✍️ Escrevendo direção de arte para o fotógrafo…",
    "💡 Definindo iluminação ideal para esta peça…",
    "🎬 Criando 3 poses diferentes para a campanha…",
    "👠 Selecionando sapatos que combinam com o look…",
    "🪄 Montando paleta de cenário e acessórios…",
  ],
  shooting: [
    "📸 Posicionando a modelo no cenário escolhido…",
    "💫 Ajustando caimento natural do tecido no corpo…",
    "🌟 Renderizando iluminação e sombras realistas…",
    "✨ Aplicando acabamento editorial profissional…",
    "🎯 Finalizando enquadramento corpo inteiro…",
  ],
  polishing: [
    "🖼️ Otimizando resolução e nitidez…",
    "🎨 Equilibrando cores e contraste…",
    "💎 Verificando qualidade final de cada foto…",
    "📤 Preparando para salvar suas criações…",
    "✅ Últimos ajustes de qualidade…",
  ],
  almostDone: [
    "⏳ Finalizando os últimos detalhes…",
    "💾 Salvando em alta resolução…",
    "🎁 Preparando suas 3 fotos editoriais…",
    "🚀 Quase pronto, só mais um instante…",
    "✨ Sua campanha está ficando incrível…",
  ],
};

/* ── Motivational messages ── */
const MOTIVATIONAL = [
  "Cada foto é feita sob medida para sua peça ✨",
  "Resultado de estúdio profissional, direto no celular 📱",
  "Lojas que usam fotos com modelo vendem até 3x mais 📈",
  "Sua peça merece uma campanha de alto nível 💎",
  "Em instantes você terá 3 fotos prontas para vender 🚀",
];

/* ── Confetti colors ── */
const CONFETTI_COLORS = [
  "#ec4899", "#a855f7", "#f97316", "#10b981",
  "#3b82f6", "#f472b6", "#c084fc", "#fbbf24",
];

/* ── Format time ── */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}`;
  return `0:${secs.toString().padStart(2, "0")}`;
}

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */
export default function GenerationLoadingScreen({ step, steps }: GenerationLoadingScreenProps) {
  const isComplete = step >= steps.length - 1;

  // ── Elapsed timer (drives everything) ──
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (isComplete) return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isComplete]);

  // Phase from TIME only
  const phase = getPhase(elapsed, isComplete);
  const config = PHASE_CONFIG[phase];

  // ── Behind-the-scenes cycling ──
  const [btsIndex, setBtsIndex] = useState(0);
  const btsMessages = BEHIND_SCENES[phase];
  useEffect(() => {
    setBtsIndex(0);
    const interval = setInterval(() => {
      setBtsIndex(prev => (prev + 1) % btsMessages.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [phase, btsMessages.length]);

  // ── Motivational message cycling ──
  const [motIndex, setMotIndex] = useState(0);
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setMotIndex(prev => (prev + 1) % MOTIVATIONAL.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isComplete]);

  // ── Confetti (memoized) ──
  const confettiPieces = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${5 + Math.random() * 90}%`,
      delay: `${i * 0.1}s`,
      size: 6 + Math.random() * 6,
      duration: `${1.5 + Math.random() * 1.5}s`,
    }));
  }, []);

  // ── Phase timeline for dots ──
  const PHASE_KEYS: Phase[] = ["analyzing", "editorial", "shooting", "polishing"];
  const currentPhaseIdx = PHASE_KEYS.indexOf(phase);

  return (
    <div className="gen-loading animate-fade-in">
      {/* Animated gradient background */}
      <div className="gen-loading-bg" />

      {/* Floating particles */}
      <div className="gen-particles">
        <div className="gen-particle" />
        <div className="gen-particle" />
        <div className="gen-particle" />
        <div className="gen-particle" />
        <div className="gen-particle" />
        <div className="gen-particle" />
      </div>

      {/* Confetti on completion */}
      {isComplete && (
        <div className="gen-confetti">
          {confettiPieces.map((piece, i) => (
            <div
              key={i}
              className="gen-confetti-piece"
              style={{
                left: piece.left,
                background: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                width: piece.size,
                height: piece.size,
              }}
            />
          ))}
        </div>
      )}

      <div className="gen-loading-content">
        {/* ─── Breathing ring + animated emoji ─── */}
        <div className="gen-icon-area">
          <div
            className="gen-breathing-ring"
            style={{ borderColor: `${config.color}40`, boxShadow: `0 0 40px ${config.color}20` }}
          />
          <div
            className="gen-breathing-ring gen-breathing-ring-2"
            style={{ borderColor: `${config.color}20` }}
          />
          <div className="gen-emoji-icon" key={phase}>
            <span className="gen-emoji-text">{isComplete ? "🎉" : config.icon}</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="gen-title" key={`title-${phase}`}>
          {isComplete ? "Sua campanha está pronta! ✨" : config.title}
        </h2>

        {/* Subtitle */}
        <p className="gen-subtitle" key={`sub-${phase}`}>
          {isComplete ? "Suas 3 fotos editoriais estão prontas para vender!" : config.subtitle}
        </p>

        {/* ── Timer ── */}
        {!isComplete && (
          <div className="gen-timer">
            <span className="gen-timer-icon">⏱</span>
            <span className="gen-timer-value">{formatTime(elapsed)}</span>
            {elapsed < 10 && (
              <span className="gen-timer-hint">Geralmente leva ~80s</span>
            )}
          </div>
        )}

        {/* ── Phase dots (simple, no progress bar) ── */}
        {!isComplete && (
          <div className="gen-phase-dots">
            {PHASE_KEYS.map((key, i) => (
              <div key={key} className="gen-phase-dot-group">
                <div
                  className={`gen-phase-dot ${
                    i < currentPhaseIdx ? "gen-phase-done" :
                    i === currentPhaseIdx ? "gen-phase-active" :
                    "gen-phase-pending"
                  }`}
                  style={i <= currentPhaseIdx ? { background: config.color } : undefined}
                >
                  {i < currentPhaseIdx ? "✓" : PHASE_CONFIG[key].icon}
                </div>
                {i < PHASE_KEYS.length - 1 && (
                  <div
                    className={`gen-phase-line ${i < currentPhaseIdx ? "gen-phase-line-done" : ""}`}
                    style={i < currentPhaseIdx ? { background: config.color } : undefined}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Behind-the-scenes ── */}
        {!isComplete && (
          <div className="gen-bts" key={`${phase}-${btsIndex}`}>
            {btsMessages[btsIndex]}
          </div>
        )}

        {/* ── Motivational ── */}
        {!isComplete && (
          <div className="gen-motivational" key={`mot-${motIndex}`}>
            {MOTIVATIONAL[motIndex]}
          </div>
        )}

        {/* ── Fashion Facts Carousel ── */}
        {!isComplete && <FashionFactsCarousel />}

        {/* ── Completion area ── */}
        {isComplete && (
          <div className="gen-result-area">
            <div className="gen-result-stats">
              <div className="gen-stat">
                <span className="gen-stat-value">3</span>
                <span className="gen-stat-label">Fotos</span>
              </div>
              <div className="gen-stat-divider" />
              <div className="gen-stat">
                <span className="gen-stat-value">{formatTime(elapsed)}</span>
                <span className="gen-stat-label">Tempo</span>
              </div>
              <div className="gen-stat-divider" />
              <div className="gen-stat">
                <span className="gen-stat-value">HD</span>
                <span className="gen-stat-label">Qualidade</span>
              </div>
            </div>
            <div className="gen-result-btn">
              <Link href="/gerar/demo" className="btn-primary">
                ⚡ Ver minhas fotos →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
