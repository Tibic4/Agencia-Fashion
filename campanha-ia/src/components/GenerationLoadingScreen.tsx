"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import FashionFactsCarousel from "./FashionFactsCarousel";
import "./GenerationLoadingScreen.css";

/* ─── Step Icons (SVG inline) ─── */
const IconSearch = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const IconPen = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
  </svg>
);

const IconCamera = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const IconCheck = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

interface Step {
  label: string;
  progress: number;
}

interface GenerationLoadingScreenProps {
  step: number;
  steps: Step[];
}

/**
 * Map step index to which icon group to show:
 * 0-2 → search, 3-5 → pen, 6-8 → camera, 9+ → check
 */
function getIconPhase(stepIdx: number): "search" | "pen" | "camera" | "check" {
  if (stepIdx <= 2) return "search";
  if (stepIdx <= 5) return "pen";
  if (stepIdx <= 8) return "camera";
  return "check";
}

/** Dynamic title per phase */
function getPhaseTitle(phase: string, isComplete: boolean): string {
  if (isComplete) return "Sua campanha está pronta! ✨";
  switch (phase) {
    case "search": return "Analisando sua peça";
    case "pen": return "Criando o editorial";
    case "camera": return "Fotografando com IA";
    default: return "Finalizando";
  }
}

/** Dynamic subtitle per phase */
function getPhaseSubtitle(phase: string, isComplete: boolean): string {
  if (isComplete) return "Suas 3 fotos editoriais estão prontas para vender!";
  switch (phase) {
    case "search": return "Identificando tecido, cor, modelagem e cada detalhe";
    case "pen": return "Escrevendo 3 roteiros fotográficos únicos";
    case "camera": return "Gerando fotos profissionais com modelo virtual";
    default: return "Salvando tudo para você";
  }
}

/* ── Behind-the-scenes messages per phase ── */
const behindTheScenes: Record<string, string[]> = {
  search: [
    "🔍 Analisando tons e saturação da peça…",
    "🧵 Identificando tipo de tecido pelo brilho e textura…",
    "📐 Mapeando caimento e modelagem…",
    "🎨 Extraindo a paleta de cores principal…",
    "✂️ Detectando detalhes: costuras, botões, estampas…",
  ],
  pen: [
    "✍️ Escrevendo direção de arte para o fotógrafo…",
    "💡 Definindo iluminação ideal para esta peça…",
    "🎬 Criando 3 poses diferentes para a campanha…",
    "👠 Selecionando sapatos que combinam com o look…",
    "🪄 Montando paleta de cenário e acessórios…",
  ],
  camera: [
    "📸 Posicionando a modelo no cenário escolhido…",
    "💫 Ajustando caimento natural do tecido no corpo…",
    "🌟 Renderizando iluminação e sombras realistas…",
    "✨ Aplicando acabamento editorial profissional…",
    "🎯 Finalizando enquadramento corpo inteiro…",
  ],
};

/* ── Pipeline phases for visual timeline ── */
const pipelinePhases = [
  { key: "search", emoji: "🔍", label: "Análise" },
  { key: "pen", emoji: "✍️", label: "Editorial" },
  { key: "camera", emoji: "📸", label: "Fotos" },
  { key: "check", emoji: "✨", label: "Pronto" },
];

/* ─── Confetti colors ─── */
const confettiColors = [
  "#ec4899", "#a855f7", "#f97316", "#10b981",
  "#3b82f6", "#f472b6", "#c084fc", "#fbbf24",
];

/* ─── Format time ─── */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}`;
  return `0:${secs.toString().padStart(2, "0")}`;
}

export default function GenerationLoadingScreen({ step, steps }: GenerationLoadingScreenProps) {
  const currentStep = steps[step];
  const phase = getIconPhase(step);
  const isComplete = step >= steps.length - 1;

  // ── Smooth progress interpolation (no jumps) ──
  const [displayProgress, setDisplayProgress] = useState(currentStep.progress);
  useEffect(() => {
    const target = currentStep.progress;
    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= target) { clearInterval(interval); return target; }
        // Smooth ease toward target — never jumps more than 0.5% per tick
        const gap = target - prev;
        const increment = Math.max(0.15, gap * 0.06);
        return Math.min(prev + increment, target);
      });
    }, 150);
    return () => clearInterval(interval);
  }, [currentStep.progress]);

  // ── Behind-the-scenes cycling ──
  const [btsIndex, setBtsIndex] = useState(0);
  const btsMessages = behindTheScenes[phase] || behindTheScenes.search;
  useEffect(() => {
    setBtsIndex(0);
    const interval = setInterval(() => {
      setBtsIndex(prev => (prev + 1) % btsMessages.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [phase, btsMessages.length]);

  // ── Elapsed timer ──
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (isComplete) return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isComplete]);

  // ── Photo count ──
  const photosReady = phase === "check"
    ? 3
    : phase === "camera"
      ? Math.max(0, step - 5)
      : 0;

  // ── Confetti ──
  const confettiPieces = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      color: confettiColors[i % confettiColors.length],
      left: `${10 + Math.random() * 80}%`,
      top: `${30 + Math.random() * 20}%`,
      delay: `${i * 0.08}s`,
      size: 6 + Math.random() * 6,
    }));
  }, []);

  const roundedProgress = Math.round(displayProgress);

  return (
    <div className="gen-loading animate-fade-in">
      {/* Animated background */}
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
                top: piece.top,
                background: piece.color,
                animationDelay: piece.delay,
                width: piece.size,
                height: piece.size,
              }}
            />
          ))}
        </div>
      )}

      <div className="gen-loading-content">
        {/* Dynamic icon */}
        <div className="gen-icon-container">
          <div className="gen-icon-ring" />
          <div className="gen-icon-stage" data-active={phase === "search"}><IconSearch /></div>
          <div className="gen-icon-stage" data-active={phase === "pen"}><IconPen /></div>
          <div className="gen-icon-stage" data-active={phase === "camera"}><IconCamera /></div>
          <div className="gen-icon-stage" data-active={phase === "check"}><IconCheck /></div>
        </div>

        {/* Title — dynamic per phase */}
        <h2 className="gen-title">{getPhaseTitle(phase, isComplete)}</h2>

        {/* Phase subtitle */}
        <p className="gen-subtitle" key={phase}>
          {getPhaseSubtitle(phase, isComplete)}
        </p>

        {/* Progress bar + timer */}
        <div className="gen-progress-wrapper">
          <div className="gen-progress-track">
            <div
              className="gen-progress-fill"
              style={{ width: `${roundedProgress}%` }}
            />
          </div>
          <div
            className="gen-progress-glow"
            style={{ width: `${roundedProgress}%` }}
          />
          <div className="gen-progress-meta">
            <span className="gen-progress-percent">{roundedProgress}%</span>
            {!isComplete && (
              <span className="gen-elapsed">⏱ {formatTime(elapsed)}</span>
            )}
          </div>
        </div>

        {/* ── Visual Pipeline (replaces boring step list) ── */}
        <div className="gen-pipeline">
          {pipelinePhases.map((p, i) => {
            const phaseOrder = ["search", "pen", "camera", "check"];
            const currentIdx = phaseOrder.indexOf(phase);
            const thisIdx = phaseOrder.indexOf(p.key);
            const state = thisIdx < currentIdx ? "done" : thisIdx === currentIdx ? "active" : "pending";
            return (
              <div key={p.key} className="gen-pipeline-item" data-state={state}>
                <div className="gen-pipeline-dot" data-state={state}>
                  {state === "done" ? "✓" : p.emoji}
                </div>
                <span className="gen-pipeline-label">{p.label}</span>
                {i < pipelinePhases.length - 1 && (
                  <div className="gen-pipeline-line" data-state={state} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Behind-the-scenes (what IA is doing NOW) ── */}
        {!isComplete && (
          <div className="gen-bts" key={`${phase}-${btsIndex}`}>
            {btsMessages[btsIndex]}
          </div>
        )}

        {/* ── Photo counter (appears during camera phase) ── */}
        {phase === "camera" && !isComplete && photosReady > 0 && (
          <div className="gen-photo-counter animate-fade-in-up">
            <div className="gen-photo-pills">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className="gen-photo-pill"
                  data-ready={n <= photosReady}
                >
                  {n <= photosReady ? "📸" : "⏳"} Look {n}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Fashion Facts Carousel (already exists — keep as-is) ── */}
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
                <span className="gen-stat-value">Pro</span>
                <span className="gen-stat-label">Qualidade</span>
              </div>
            </div>
            <div className="gen-result-btn">
              <Link href="/gerar/demo" className="btn-primary">
                <IconZap />
                Ver minhas fotos →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
