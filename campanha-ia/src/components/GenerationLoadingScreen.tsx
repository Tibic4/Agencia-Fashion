"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import FashionFactsCarousel from "./FashionFactsCarousel";
import "./GenerationLoadingScreen.css";

/* ─── Props ─── */
interface Step {
  label: string;
  progress: number;
}

interface GenerationLoadingScreenProps {
  step: number;
  steps: Step[];
  /** Callback opcional para cancelar a geração. */
  onCancel?: () => void;
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
  if (isComplete) return "polishing";
  if (elapsed < 12) return "analyzing";
  if (elapsed < 30) return "editorial";
  if (elapsed < 60) return "shooting";
  if (elapsed < 85) return "polishing";
  return "almostDone";
}

const PHASE_CONFIG: Record<Phase, {
  icon: string;
  title: string;
  color: string;
}> = {
  analyzing: {
    icon: "🔍",
    title: "Analisando sua peça",
    color: "#818cf8",
  },
  editorial: {
    icon: "✍️",
    title: "Criando o editorial",
    color: "#f472b6",
  },
  shooting: {
    icon: "📸",
    title: "Fotografando com IA",
    color: "#a855f7",
  },
  polishing: {
    icon: "✨",
    title: "Finalizando detalhes",
    color: "#d946ef",
  },
  almostDone: {
    icon: "🎯",
    title: "Quase lá...",
    color: "#10b981",
  },
};

/* ── Status messages per phase (replaces both subtitle + BTS) ── */
const STATUS_MESSAGES: Record<Phase, string[]> = {
  analyzing: [
    "Analisando tons e saturação da peça",
    "Identificando tipo de tecido",
    "Mapeando caimento e modelagem",
    "Extraindo paleta de cores",
  ],
  editorial: [
    "Escrevendo direção de arte",
    "Definindo iluminação ideal",
    "Criando 3 poses para a campanha",
    "Montando cenário e acessórios",
  ],
  shooting: [
    "Posicionando modelo no cenário",
    "Ajustando caimento do tecido",
    "Renderizando iluminação e sombras",
    "Finalizando enquadramento",
  ],
  polishing: [
    "Otimizando resolução e nitidez",
    "Equilibrando cores e contraste",
    "Verificando qualidade final",
  ],
  almostDone: [
    "Salvando em alta resolução",
    "Preparando suas 3 fotos",
    "Quase pronto...",
  ],
};

/* ── Confetti colors ── */
const CONFETTI_COLORS = [
  "#ec4899", "#a855f7", "#f97316", "#10b981",
  "#3b82f6", "#f472b6", "#c084fc", "#d946ef",
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
export default function GenerationLoadingScreen({ step, steps, onCancel }: GenerationLoadingScreenProps) {
  const isComplete = step >= steps.length - 1;

  // ── Single elapsed timer (drives everything) ──
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (isComplete) return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isComplete]);

  // Phase from TIME only
  const phase = getPhase(elapsed, isComplete);
  const config = PHASE_CONFIG[phase];

  // ── Status message — derived from elapsed, no extra interval ──
  const statusMessages = STATUS_MESSAGES[phase];
  const statusIndex = Math.floor(elapsed / 4) % statusMessages.length;
  const statusText = statusMessages[statusIndex];

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

  // ── Phase timeline ──
  const PHASE_KEYS: Phase[] = ["analyzing", "editorial", "shooting", "polishing"];
  const currentPhaseIdx = PHASE_KEYS.indexOf(phase === "almostDone" ? "polishing" : phase);

  return (
    <div className="gen-loading animate-fade-in" role="status" aria-busy="true">
      {/* live region para screenreaders. Atualiza a cada mudança de fase/status */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Gerando campanha. Etapa atual: {statusText}. Tempo decorrido: {elapsed} segundos.
      </span>
      {/* Animated gradient background */}
      <div className="gen-loading-bg" aria-hidden="true" />


      {/* Floating particles */}
      <div className="gen-particles">
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
        {/* ─── Ring with timer inside ─── */}
        <div className="gen-icon-area">
          <div
            className="gen-breathing-ring"
            style={{ borderColor: `${config.color}40`, boxShadow: `0 0 30px ${config.color}15` }}
          />
          <div className="gen-emoji-icon" style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}cc)` }} key={phase}>
            {isComplete ? (
              <span className="gen-emoji-text">🎉</span>
            ) : (
              <>
                <span className="gen-emoji-text">{config.icon}</span>
                <span className="gen-timer-inside">{formatTime(elapsed)}</span>
              </>
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="gen-title" key={`title-${phase}`}>
          {isComplete ? "Sua campanha está pronta!" : config.title}
        </h2>

        {/* Status message (replaces both subtitle AND behind-the-scenes) */}
        {!isComplete && (
          <p className="gen-status" key={`status-${phase}-${statusIndex}`}>
            {statusText}
          </p>
        )}

        {/* ── Minimal phase dots ── */}
        {!isComplete && (
          <div className="gen-dots">
            {PHASE_KEYS.map((key, i) => (
              <div
                key={key}
                className={`gen-dot ${
                  i < currentPhaseIdx ? "gen-dot-done" :
                  i === currentPhaseIdx ? "gen-dot-active" :
                  ""
                }`}
                style={i <= currentPhaseIdx ? { background: config.color } : undefined}
              />
            ))}
          </div>
        )}

        {/* ── Estimated time hint (only first 15s) ── */}
        {!isComplete && elapsed < 15 && (
          <p className="gen-hint">Geralmente leva ~80 segundos</p>
        )}

        {/* ── Fashion Facts Carousel ── */}
        {!isComplete && <FashionFactsCarousel />}

        {/* botão cancelar aparece após 30s — útil em mobile quando travou */}
        {!isComplete && elapsed > 30 && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 text-xs underline opacity-60 hover:opacity-100 transition"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
            aria-label="Cancelar geração da campanha"
          >
            Cancelar geração
          </button>
        )}

        {/* hint "mantenha tela aberta" após 60s */}
        {!isComplete && elapsed > 60 && (
          <p className="gen-hint" style={{ marginTop: 8, opacity: 0.7 }}>
            💡 Mantenha esta aba aberta enquanto gera — se fechar, você perde o progresso
          </p>
        )}

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
