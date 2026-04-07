"use client";

import { useMemo } from "react";
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
 * 0-1 → search, 2-3 → pen, 4-5 → camera, 6 → check
 */
function getIconPhase(stepIdx: number): "search" | "pen" | "camera" | "check" {
  if (stepIdx <= 1) return "search";
  if (stepIdx <= 3) return "pen";
  if (stepIdx <= 5) return "camera";
  return "check";
}

/* ─── Confetti colors ─── */
const confettiColors = [
  "#ec4899", "#a855f7", "#f97316", "#10b981",
  "#3b82f6", "#f472b6", "#c084fc", "#fbbf24",
];

export default function GenerationLoadingScreen({ step, steps }: GenerationLoadingScreenProps) {
  const currentStep = steps[step];
  const phase = getIconPhase(step);
  const isComplete = step >= steps.length - 1;

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

        {/* Title */}
        <h2 className="gen-title">
          {isComplete ? "Campanha pronta! ✨" : "Gerando sua campanha"}
        </h2>

        {/* Current step label */}
        <p className="gen-subtitle" key={step}>
          {currentStep.label}
        </p>

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

        {/* Steps list */}
        <div className="gen-steps">
          {steps.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <div
                key={i}
                className={`gen-step ${state === "active" ? "gen-step-enter" : ""}`}
                data-state={state}
              >
                <span className="gen-step-icon" data-state={state}>
                  {state === "done" ? "✓" : state === "active" ? "●" : (i + 1)}
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
              Ver resultado →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
