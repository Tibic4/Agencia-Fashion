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
 * 0-2 → search, 3-6 → pen, 7-9 → camera, 10 → check
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

/* ── Waiting messages that cycle when stuck at a step ── */
const waitMessages = [
  "Fique tranquila, estamos caprichando ✨",
  "Nossa IA analisa cada detalhe da peça…",
  "Buscando o melhor ângulo e cenário…",
  "Quase lá! Ajustando a iluminação…",
  "Trabalhando para um resultado incrível…",
  "Cada segundo vale — a foto fica perfeita 💅",
];

/* ─── Confetti colors ─── */
const confettiColors = [
  "#ec4899", "#a855f7", "#f97316", "#10b981",
  "#3b82f6", "#f472b6", "#c084fc", "#fbbf24",
];

export default function GenerationLoadingScreen({ step, steps }: GenerationLoadingScreenProps) {
  const currentStep = steps[step];
  const phase = getIconPhase(step);
  const isComplete = step >= steps.length - 1;

  // Track how long we've been on the same step
  const [stuckTime, setStuckTime] = useState(0);
  const [waitMsgIndex, setWaitMsgIndex] = useState(0);
  const [lastStep, setLastStep] = useState(step);

  useEffect(() => {
    if (step !== lastStep) {
      setStuckTime(0);
      setLastStep(step);
    }
  }, [step, lastStep]);

  // Cycle waiting messages when stuck for more than 5s
  useEffect(() => {
    const timer = setInterval(() => {
      setStuckTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stuckTime > 5 && stuckTime % 4 === 0) {
      setWaitMsgIndex(prev => (prev + 1) % waitMessages.length);
    }
  }, [stuckTime]);

  // Generate confetti pieces (memoized so they don't re-render)
  const confettiPieces = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => ({
      color: confettiColors[i % confettiColors.length],
      left: `${10 + Math.random() * 80}%`,
      top: `${30 + Math.random() * 20}%`,
      delay: `${i * 0.08}s`,
      rotation: `${Math.random() * 360}deg`,
      size: 6 + Math.random() * 6,
    }));
  }, []);

  // Show only relevant window of steps (last 3 done + current + next 2)
  const visibleSteps = steps
    .map((s, i) => ({ ...s, index: i }))
    .filter((_, i) => {
      if (i < step - 2) return false; // hide old steps
      if (i > step + 2) return false; // hide far future steps
      return true;
    });

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

          <div className="gen-icon-stage" data-active={phase === "search"}>
            <IconSearch />
          </div>
          <div className="gen-icon-stage" data-active={phase === "pen"}>
            <IconPen />
          </div>
          <div className="gen-icon-stage" data-active={phase === "camera"}>
            <IconCamera />
          </div>
          <div className="gen-icon-stage" data-active={phase === "check"}>
            <IconCheck />
          </div>
        </div>

        {/* Title — dynamic per phase */}
        <h2 className="gen-title">
          {getPhaseTitle(phase, isComplete)}
        </h2>

        {/* Phase subtitle */}
        <p className="gen-subtitle" key={phase}>
          {getPhaseSubtitle(phase, isComplete)}
        </p>

        {/* Extra waiting message when stuck */}
        {stuckTime > 8 && !isComplete && (
          <p className="gen-wait-msg" key={waitMsgIndex}>
            {waitMessages[waitMsgIndex]}
          </p>
        )}

        {/* Progress bar */}
        <div className="gen-progress-wrapper">
          <div className="gen-progress-track">
            <div
              className="gen-progress-fill"
              style={{ width: `${currentStep.progress}%` }}
            />
          </div>
          <div
            className="gen-progress-glow"
            style={{ width: `${currentStep.progress}%` }}
          />
          <div className="gen-progress-percent">
            {currentStep.progress}%
          </div>
        </div>

        {/* Fashion Facts Carousel */}
        <FashionFactsCarousel />

        {/* Steps list — windowed (only nearby steps visible) */}
        <div className="gen-steps">
          {visibleSteps.map((s) => {
            const state = s.index < step ? "done" : s.index === step ? "active" : "pending";
            return (
              <div
                key={s.index}
                className={`gen-step ${state === "active" ? "gen-step-enter" : ""}`}
                data-state={state}
              >
                <span className="gen-step-icon" data-state={state}>
                  {state === "done" ? "✓" : state === "active" ? "●" : "·"}
                </span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* CTA when complete */}
        {isComplete && (
          <div className="gen-result-btn">
            <Link href="/gerar/demo" className="btn-primary">
              <IconZap />
              Ver minhas fotos →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
