"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { friendlyError } from "@/lib/friendly-error";

const BrandColorPicker = dynamic(() => import("@/components/BrandColorPicker"), { ssr: false });

/* ═══════════════════════════════════════
   Icons (inline SVGs)
   ═══════════════════════════════════════ */
const IconSparkles = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
);
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
const IconArrowLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconZap = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
);
const IconTarget = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

/* ═══════════════════════════════════════
   Data
   ═══════════════════════════════════════ */
const segments = [
  { value: "feminina", label: "Moda Feminina", emoji: "👗", desc: "Vestidos, blusas, saias" },
  { value: "masculina", label: "Moda Masculina", emoji: "👔", desc: "Camisas, calças, bermudas" },
  { value: "infantil", label: "Infantil", emoji: "👶", desc: "Roupas para crianças" },
  { value: "plus_size", label: "Plus Size", emoji: "💃", desc: "Moda inclusiva" },
  { value: "fitness", label: "Fitness", emoji: "🏋️‍♀️", desc: "Leggings, tops, conjuntos" },
  { value: "intima", label: "Moda Íntima", emoji: "🩱", desc: "Lingerie, pijamas" },
  { value: "praia", label: "Praia", emoji: "👙", desc: "Biquínis, maiôs" },
  { value: "acessorios", label: "Acessórios", emoji: "👜", desc: "Bolsas, bijuterias" },
];

const skinTones = [
  { value: "branca", color: "#F5D0B5", label: "Clara" },
  { value: "morena_clara", color: "#D4A574", label: "Morena clara" },
  { value: "morena", color: "#A67B5B", label: "Morena" },
  { value: "negra", color: "#6B4226", label: "Negra" },
];

const hairStyles = [
  { value: "liso", label: "Liso", emoji: "💇‍♀️" },
  { value: "ondulado", label: "Ondulado", emoji: "🌊" },
  { value: "cacheado", label: "Cacheado", emoji: "🌀" },
  { value: "crespo", label: "Crespo", emoji: "✨" },
  { value: "curto", label: "Curto", emoji: "✂️" },
];

const bodyTypes = [
  { value: "magra", label: "Magra", emoji: "🧍‍♀️" },
  { value: "media", label: "Média", emoji: "👩" },
  { value: "plus_size", label: "Plus Size", emoji: "💃" },
];

const brandColors = [
  { value: "#EC4899", label: "Rosa" },
  { value: "#1A1A1A", label: "Preto" },
  { value: "#D4A853", label: "Dourado" },
  { value: "#C9A88C", label: "Nude" },
  { value: "#8B5CF6", label: "Roxo" },
  { value: "#3B82F6", label: "Azul" },
  { value: "#10B981", label: "Verde" },
  { value: "#DC2626", label: "Vermelho" },
];

const howItWorksSteps = [
  {
    icon: <IconCamera />,
    title: "Tire a foto",
    desc: "Qualquer fundo serve — a IA resolve",
  },
  {
    icon: <IconZap />,
    title: "IA trabalha",
    desc: "Textos, modelo virtual e score — tudo automático",
  },
  {
    icon: <IconDownload />,
    title: "Publique",
    desc: "Copie, baixe e poste nas redes",
  },
];

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */
export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = welcome, 1 = store, 2 = model, 3 = done
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [storeName, setStoreName] = useState("");
  const [segment, setSegment] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [instagram, setInstagram] = useState("");
  const [skin, setSkin] = useState("morena_clara");
  const [hair, setHair] = useState("ondulado");
  const [body, setBody] = useState("media");
  const [brandColor, setBrandColor] = useState("");
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFreeTier, setIsFreeTier] = useState<boolean>(true);
  const [checking, setChecking] = useState(true);

  // Confetti state for step 3
  const [confettiPieces, setConfettiPieces] = useState<{ left: string; delay: string; color: string; size: number }[]>([]);

  const totalSteps = 4; // 0-3

  useEffect(() => {
    fetch("/api/store")
      .then((res) => {
        if (res.status === 404) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) { setChecking(false); return; }
        if (data.success && data.data?.id) {
          router.replace("/gerar");
          return;
        }
        if (data.success && data.data) {
          const plan = data.data.plan_name;
          setIsFreeTier(!plan || plan === "gratis" || plan === "free");
        }
        setChecking(false);
      })
      .catch(() => { setIsFreeTier(true); setChecking(false); });
  }, [router]);

  useEffect(() => {
    if (step === 3) {
      const colors = ["#ec4899", "#a855f7", "#f97316", "#10b981", "#3b82f6", "#fbbf24", "#f472b6", "#c084fc"];
      setConfettiPieces(
        Array.from({ length: 24 }).map((_, i) => ({
          left: `${5 + Math.random() * 90}%`,
          delay: `${i * 0.06}s`,
          color: colors[i % colors.length],
          size: 6 + Math.random() * 6,
        }))
      );
    }
  }, [step]);

  function goNext() {
    setDirection("forward");
    if (step === 1 && isFreeTier) {
      saveOnboarding(true); // Skip model creation for new free accounts
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  }

  function goBack() {
    setDirection("back");
    setStep((s) => Math.max(s - 1, 0));
  }

  const saveOnboarding = useCallback(
    async (skippedModel: boolean) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/store/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeName,
            segment: segment.join(","),
            city: city || undefined,
            instagram: instagram || undefined,
            brandColor: brandColor || undefined,
            model: skippedModel ? { skip: true } : { skin, hair, body },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(friendlyError(data.error || `Erro ${res.status}`, "Erro ao salvar. Tente novamente."));
        }

        setDirection("forward");
        setStep(3);
      } catch (err: unknown) {
        const message = friendlyError(err, "Erro ao salvar. Tente novamente.");
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [storeName, segment, city, instagram, skin, hair, body, brandColor]
  );

  // Animation class for step transition
  const slideClass = direction === "forward" ? "onb-slide-in-right" : "onb-slide-in-left";

  if (checking) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gradient-hero)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--brand-500)", animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* ═══ Onboarding Styles ═══ */
        .onb-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--gradient-hero);
          position: relative;
          overflow: hidden;
        }

        /* Background decorations */
        .onb-bg-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .onb-bg-blob-1 {
          top: -15%;
          right: -10%;
          width: 400px;
          height: 400px;
          background: var(--brand-400);
          opacity: 0.08;
        }
        .onb-bg-blob-2 {
          bottom: -10%;
          left: -15%;
          width: 500px;
          height: 500px;
          background: var(--accent-400);
          opacity: 0.06;
        }

        /* Top bar */
        .onb-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          position: relative;
          z-index: 10;
        }
        .onb-logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .onb-logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-brand);
          color: white;
        }
        .onb-logo-text {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        /* Progress bar */
        .onb-progress {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .onb-progress-dot {
          width: 32px;
          height: 4px;
          border-radius: 99px;
          transition: all 0.4s ease;
        }

        /* Main content */
        .onb-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 20px 32px;
          position: relative;
          z-index: 10;
        }
        .onb-card-wrapper {
          width: 100%;
          max-width: 480px;
        }

        /* Step animations */
        .onb-slide-in-right {
          animation: onb-slideRight 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .onb-slide-in-left {
          animation: onb-slideLeft 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes onb-slideRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onb-slideLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }

        /* Welcome specific */
        .onb-emoji-hero {
          font-size: 56px;
          line-height: 1;
          display: block;
          margin-bottom: 16px;
          animation: onb-bounce 2s ease-in-out infinite;
        }
        @keyframes onb-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .onb-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin-bottom: 8px;
          color: var(--foreground);
        }
        .onb-subtitle {
          font-size: 15px;
          color: var(--muted);
          line-height: 1.5;
          margin-bottom: 28px;
        }

        /* How it works cards (welcome step) */
        .onb-how-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 32px;
        }
        .onb-how-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 14px;
          background: var(--background);
          border: 1px solid var(--border);
          text-align: left;
        }
        .onb-how-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--gradient-card);
          color: var(--brand-500);
        }
        .onb-how-title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 2px;
        }
        .onb-how-desc {
          font-size: 12px;
          color: var(--muted);
        }

        /* Form card */
        .onb-form-card {
          border-radius: 20px;
          padding: 24px;
          background: var(--background);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-lg);
        }

        /* Section header in cards */
        .onb-section-title {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 10px;
          color: var(--foreground);
        }

        /* Segment chips */
        .onb-segments {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .onb-segment-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.25s ease;
          border: 1px solid var(--border);
          background: var(--surface);
          position: relative;
          overflow: hidden;
          min-height: 44px;
        }
        .onb-segment-btn[data-active="true"] {
          border-color: var(--brand-300);
          background: var(--gradient-card);
        }
        .onb-segment-btn[data-active="true"]::after {
          content: '✓';
          position: absolute;
          top: 6px;
          right: 8px;
          font-size: 10px;
          font-weight: 700;
          color: var(--brand-500);
        }
        .onb-segment-emoji {
          font-size: 22px;
          line-height: 1;
        }
        .onb-segment-label {
          font-size: 12px;
          font-weight: 600;
        }
        .onb-segment-desc {
          font-size: 10px;
          color: var(--muted);
        }

        /* Input fields */
        .onb-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--foreground);
        }
        .onb-input:focus {
          border-color: var(--brand-300);
          box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.1);
        }
        .onb-input::placeholder {
          color: var(--muted);
        }
        .onb-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--foreground);
        }

        /* Input row (2 cols) */
        .onb-input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        /* Skin tone picker */
        .onb-skins {
          display: flex;
          gap: 16px;
          justify-content: center;
          padding: 8px 0;
        }
        .onb-skin-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .onb-skin-circle {
          width: 48px;
          height: 48px;
          min-width: 44px;
          min-height: 44px;
          border-radius: 50%;
          transition: all 0.25s ease;
          border: 3px solid transparent;
        }
        .onb-skin-btn[data-active="true"] .onb-skin-circle {
          border-color: var(--brand-500);
          box-shadow: 0 0 16px rgba(236, 72, 153, 0.3);
          transform: scale(1.1);
        }
        .onb-skin-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--muted);
          transition: color 0.2s;
        }
        .onb-skin-btn[data-active="true"] .onb-skin-label {
          color: var(--brand-600);
        }

        /* Pill buttons (hair, body) */
        .onb-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }
        .onb-pill {
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          min-height: 44px;
          display: flex;
          align-items: center;
        }
        .onb-pill[data-active="true"] {
          background: var(--gradient-brand);
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.25);
        }

        /* Body type cards */
        .onb-body-cards {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .onb-body-card {
          padding: 14px 8px;
          border-radius: 14px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s ease;
          border: 1px solid var(--border);
          background: var(--surface);
        }
        .onb-body-card[data-active="true"] {
          background: var(--gradient-brand);
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.25);
        }
        .onb-body-emoji {
          font-size: 24px;
          line-height: 1;
          margin-bottom: 4px;
        }
        .onb-body-label {
          font-size: 12px;
          font-weight: 600;
        }

        /* Buttons */
        .onb-btn-row {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .onb-skip-btn {
          display: block;
          width: 100%;
          text-align: center;
          font-size: 12px;
          padding: 12px;
          min-height: 44px;
          color: var(--muted);
          cursor: pointer;
          transition: color 0.2s;
          background: none;
          border: none;
          margin-top: 10px;
        }
        .onb-skip-btn:hover {
          color: var(--foreground);
        }

        /* Completion step */
        .onb-done-icon {
          width: 80px;
          height: 80px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          background: var(--gradient-brand);
          color: white;
          animation: onb-scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          box-shadow: 0 8px 30px rgba(236, 72, 153, 0.3);
        }
        @keyframes onb-scaleIn {
          from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        .onb-summary {
          border-radius: 16px;
          padding: 20px;
          background: var(--background);
          border: 1px solid var(--border);
          margin-bottom: 24px;
          text-align: left;
        }
        .onb-summary-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          font-size: 14px;
          color: var(--muted);
        }
        .onb-summary-row strong {
          color: var(--foreground);
        }

        /* Confetti */
        .onb-confetti-container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 50;
          overflow: hidden;
        }
        .onb-confetti {
          position: absolute;
          border-radius: 2px;
          animation: onb-confetti-fall 3s ease-out forwards;
        }
        @keyframes onb-confetti-fall {
          0% { transform: translateY(-40px) rotate(0deg) scale(0); opacity: 0; }
          8% { opacity: 1; transform: translateY(0) rotate(90deg) scale(1); }
          100% { transform: translateY(100vh) rotate(720deg) scale(0.4); opacity: 0; }
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .onb-topbar {
            padding: 12px 16px;
          }
          .onb-content {
            padding: 4px 16px 24px;
            align-items: flex-start;
          }
          .onb-title {
            font-size: 24px;
          }
          .onb-subtitle {
            font-size: 14px;
            margin-bottom: 20px;
          }
          .onb-emoji-hero {
            font-size: 44px;
          }
          .onb-form-card {
            padding: 18px;
            border-radius: 16px;
          }
          .onb-segment-btn {
            padding: 10px;
            min-height: 44px;
          }
          .onb-segment-emoji {
            font-size: 18px;
          }
          .onb-segment-label {
            font-size: 11px;
          }
          .onb-segment-desc {
            font-size: 9px;
          }
          .onb-skins {
            gap: 12px;
          }
          .onb-skin-circle {
            width: 44px;
            height: 44px;
          }
          .onb-pill {
            padding: 10px 14px;
            font-size: 12px;
            min-height: 44px;
          }
          .onb-how-card {
            padding: 12px 14px;
          }
          .onb-how-icon {
            width: 38px;
            height: 38px;
          }
          .onb-done-icon {
            width: 64px;
            height: 64px;
            border-radius: 18px;
          }
        }

        /* Small height phones (landscape or compact) */
        @media (max-height: 700px) {
          .onb-content {
            padding-top: 0;
            align-items: flex-start;
          }
          .onb-emoji-hero {
            font-size: 36px;
            margin-bottom: 8px;
          }
          .onb-title {
            font-size: 22px;
          }
          .onb-subtitle {
            font-size: 13px;
            margin-bottom: 12px;
          }
          .onb-how-cards {
            gap: 8px;
            margin-bottom: 16px;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .onb-slide-in-right,
          .onb-slide-in-left {
            animation: none;
            opacity: 1;
          }
          .onb-emoji-hero {
            animation: none;
          }
          .onb-done-icon {
            animation: none;
            opacity: 1;
          }
          .onb-confetti {
            animation: none;
            display: none;
          }
        }
      `}</style>

      <div className="onb-page">
        {/* Background decorations */}
        <div className="onb-bg-blob onb-bg-blob-1" />
        <div className="onb-bg-blob onb-bg-blob-2" />

        {/* Top bar */}
        <div className="onb-topbar">
          <div className="onb-logo">
            <Image src="/logo.webp" alt="CriaLook" width={36} height={36} style={{ borderRadius: '10px' }} />
            <span className="onb-logo-text">
              Cria<span className="gradient-text">Look</span>
            </span>
          </div>

          {/* Progress dots */}
          <div className="onb-progress">
            {[0, 1, 2, 3].map((s) => (
              <div
                key={s}
                className="onb-progress-dot"
                style={{
                  background:
                    step >= s
                      ? "var(--gradient-brand)"
                      : "var(--border)",
                  width: step === s ? "40px" : "32px",
                }}
              />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="onb-content">
          <div className="onb-card-wrapper">
            {/* Error banner */}
            {error && (
              <div
                className="mb-4 p-3 rounded-xl flex items-center gap-3"
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                }}
              >
                <span>⚠️</span>
                <p className="text-sm font-medium" style={{ color: "#DC2626" }}>
                  {error}
                </p>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-sm"
                  style={{ color: "#DC2626" }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════
               Step 0: Welcome
            ═══════════════════════════════════════ */}
            {step === 0 && (
              <div key="step-0" className={slideClass} style={{ textAlign: "center" }}>
                <span className="onb-emoji-hero">✨</span>
                <h1 className="onb-title">
                  Bem-vindo ao <span className="gradient-text">CriaLook</span>
                </h1>
                <p className="onb-subtitle">
                  Só com uma foto, a IA cria sua campanha completa — pronta pra postar.
                  Vamos configurar tudo em 2 minutos!
                </p>

                {/* How it works mini cards */}
                <div className="onb-how-cards">
                  {howItWorksSteps.map((s, i) => (
                    <div
                      key={i}
                      className="onb-how-card"
                      style={{ animationDelay: `${0.1 + i * 0.1}s` }}
                    >
                      <div className="onb-how-icon">{s.icon}</div>
                      <div>
                        <p className="onb-how-title">{s.title}</p>
                        <p className="onb-how-desc">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={goNext} className="btn-primary w-full !py-3.5">
                  Começar configuração <IconArrowRight />
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════
               Step 1: Store Info
            ═══════════════════════════════════════ */}
            {step === 1 && (
              <div key="step-1" className={slideClass}>
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                  <span className="onb-emoji-hero" style={{ animationDuration: "3s" }}>🏪</span>
                  <h1 className="onb-title">Sobre sua loja</h1>
                  <p className="onb-subtitle" style={{ marginBottom: "16px" }}>
                    Personalizaremos os textos de campanha com essas informações
                  </p>
                </div>

                <div className="onb-form-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Store name */}
                  <div>
                    <label className="onb-label">Nome da loja *</label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Ex: Boutique da Ana, Moda Bella..."
                      className="onb-input"
                      autoFocus
                    />
                  </div>

                  {/* Segments */}
                  <div>
                    <label className="onb-label">Segmento principal * <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "11px" }}>(até 2)</span></label>
                    <div className="onb-segments">
                      {segments.map((seg) => (
                        <button
                          key={seg.value}
                          onClick={() => {
                            setSegment((prev) => {
                              if (prev.includes(seg.value)) {
                                return prev.filter((s) => s !== seg.value);
                              }
                              if (prev.length >= 2) return prev; // Max 2
                              return [...prev, seg.value];
                            });
                          }}
                          className="onb-segment-btn"
                          data-active={segment.includes(seg.value)}
                        >
                          <span className="onb-segment-emoji">{seg.emoji}</span>
                          <div>
                            <p className="onb-segment-label">{seg.label}</p>
                            <p className="onb-segment-desc">{seg.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* City + Instagram row */}
                  <div className="onb-input-row">
                    <div>
                      <label className="onb-label">Cidade</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="São Paulo"
                        className="onb-input"
                      />
                    </div>
                    <div>
                      <label className="onb-label">Instagram</label>
                      <input
                        type="text"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="@sualoja"
                        className="onb-input"
                      />
                    </div>
                  </div>

                   {/* Brand color picker — with Canvas extractor */}
                   <div>
                     <label className="onb-label">{"🎨"} Cor da sua marca <span style={{ fontWeight: 400, color: "var(--muted)" }}>(opcional)</span></label>
                     <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "10px" }}>Usaremos nos fundos das suas campanhas</p>

                     {/* Canvas color extractor CTA */}
                     <button
                       onClick={() => setShowColorPicker(true)}
                       style={{ width: "100%", marginBottom: "12px", padding: "12px", background: "var(--brand-50)", border: "2px dashed var(--brand-300)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                     >
                       <span style={{ fontSize: "24px" }}>{"📤"}</span>
                       <div style={{ textAlign: "left" }}>
                         <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)" }}>Extrair cor da logo</p>
                         <p style={{ fontSize: "11px", color: "var(--muted)" }}>Envie sua logo e toque na cor desejada</p>
                       </div>
                     </button>

                     {showColorPicker && (
                       <BrandColorPicker
                         currentColor={brandColor}
                         onColorSelected={(hex) => { setBrandColor(hex); setShowCustomColor(false); setShowColorPicker(false); }}
                         onClose={() => setShowColorPicker(false)}
                       />
                     )}

                     {/* Extracted color preview */}
                     {brandColor && (
                       <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", padding: "10px", background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                         <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: brandColor, border: "2px solid var(--border)", flexShrink: 0 }} />
                         <div>
                           <p style={{ fontSize: "13px", fontWeight: 700, fontFamily: "monospace" }}>{brandColor}</p>
                           <p style={{ fontSize: "11px", color: "var(--muted)" }}>Cor selecionada</p>
                         </div>
                         <button onClick={() => setBrandColor("")} style={{ marginLeft: "auto", fontSize: "12px", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>{"✕"}</button>
                       </div>
                     )}

                     <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px", textAlign: "center" }}>ou escolha uma cor:</p>
                     <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                       {brandColors.map((bc) => (
                         <button
                           key={bc.value}
                           onClick={() => { setBrandColor(bc.value); setShowCustomColor(false); }}
                           className="onb-skin-btn"
                           data-active={brandColor === bc.value}
                           title={bc.label}
                         >
                           <div className="onb-skin-circle" style={{ background: bc.value, width: "44px", height: "44px" }} />
                           <span className="onb-skin-label">{bc.label}</span>
                         </button>
                       ))}
                       <button
                         onClick={() => { setShowCustomColor(!showCustomColor); }}
                         className="onb-skin-btn"
                         data-active={showCustomColor || Boolean(brandColor && !brandColors.find(c => c.value === brandColor))}
                         title="Outra cor"
                       >
                         <div className="onb-skin-circle" style={{ background: (brandColor && !brandColors.find(c => c.value === brandColor)) ? brandColor : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)", width: "44px", height: "44px" }} />
                         <span className="onb-skin-label">Outra</span>
                       </button>
                     </div>
                     {showCustomColor && (
                       <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
                         <input type="color" value={brandColor || "#EC4899"} onChange={(e) => setBrandColor(e.target.value)} style={{ width: "44px", height: "44px", border: "none", borderRadius: "12px", cursor: "pointer", padding: 0 }} />
                         <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>{brandColor || "#EC4899"}</span>
                       </div>
                     )}
                   </div>

                   {/* Buttons */}
                   <div className="onb-btn-row">
                     <button onClick={goBack} className="btn-secondary flex-1 !py-3" disabled={saving}>
                       <IconArrowLeft /> Voltar
                     </button>
                     <button
                       onClick={goNext}
                       disabled={!storeName || segment.length === 0 || saving}
                       className="btn-primary flex-1 !py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                     >
                       {saving ? "Salvando..." : <>Continuar <IconArrowRight /></>}
                     </button>
                   </div>
                 </div>
               </div>
             )}

            {/* ═══════════════════════════════════════
               Step 2: Virtual Model
            ═══════════════════════════════════════ */}
            {step === 2 && (
              <div key="step-2" className={slideClass}>
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                  <span className="onb-emoji-hero" style={{ animationDuration: "2.5s" }}>👩</span>
                  <h1 className="onb-title">Modelo virtual</h1>
                  <p className="onb-subtitle" style={{ marginBottom: "16px" }}>
                    Crie uma modelo IA para vestir suas roupas nas campanhas
                  </p>
                </div>

                <div className="onb-form-card" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Skin tone */}
                  <div>
                    <label className="onb-section-title">Tom de pele</label>
                    <div className="onb-skins">
                      {skinTones.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setSkin(s.value)}
                          className="onb-skin-btn"
                          data-active={skin === s.value}
                          aria-label={`Tom de pele: ${s.label}`}
                        >
                          <div
                            className="onb-skin-circle"
                            style={{ background: s.color }}
                          />
                          <span className="onb-skin-label">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hair */}
                  <div>
                    <label className="onb-section-title">Cabelo</label>
                    <div className="onb-pills">
                      {hairStyles.map((h) => (
                        <button
                          key={h.value}
                          onClick={() => setHair(h.value)}
                          className="onb-pill"
                          data-active={hair === h.value}
                        >
                          {h.emoji} {h.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body type */}
                  <div>
                    <label className="onb-section-title">Tipo de corpo</label>
                    <div className="onb-body-cards">
                      {bodyTypes.map((b) => (
                        <button
                          key={b.value}
                          onClick={() => setBody(b.value)}
                          className="onb-body-card"
                          data-active={body === b.value}
                        >
                          <div className="onb-body-emoji">{b.emoji}</div>
                          <div className="onb-body-label">{b.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="onb-btn-row">
                    <button onClick={goBack} className="btn-secondary flex-1 !py-3" disabled={saving}>
                      <IconArrowLeft /> Voltar
                    </button>
                    <button
                      onClick={() => saveOnboarding(false)}
                      className="btn-primary flex-1 !py-3"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              border: "2px solid rgba(255,255,255,0.3)",
                              borderTopColor: "white",
                              borderRadius: "50%",
                              display: "inline-block",
                              animation: "spin 0.8s linear infinite",
                            }}
                          />
                          Salvando...
                        </>
                      ) : (
                        <>Criar modelo <IconArrowRight /></>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => saveOnboarding(true)}
                    className="onb-skip-btn"
                    disabled={saving}
                  >
                    {saving ? "Salvando..." : "Pular — usar modelos stock"}
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════
               Step 3: Complete
            ═══════════════════════════════════════ */}
            {step === 3 && (
              <div key="step-3" className={slideClass} style={{ textAlign: "center" }}>
                {/* Confetti */}
                <div className="onb-confetti-container">
                  {confettiPieces.map((p, i) => (
                    <div
                      key={i}
                      className="onb-confetti"
                      style={{
                        left: p.left,
                        top: "-20px",
                        width: p.size,
                        height: p.size,
                        background: p.color,
                        animationDelay: p.delay,
                      }}
                    />
                  ))}
                </div>

                {/* Check icon */}
                <div className="onb-done-icon">
                  <IconCheck />
                </div>

                <h1 className="onb-title">Tudo pronto! 🎉</h1>
                <p className="onb-subtitle">
                  Sua loja <strong style={{ color: "var(--foreground)" }}>{storeName || "Fashion"}</strong> está configurada.
                  Agora é só tirar uma foto e deixar a IA fazer o resto!
                </p>

                {/* Summary card */}
                <div className="onb-summary">
                  <div className="onb-summary-row">
                    <span>🏪</span>
                    <span>
                      <strong>{storeName || "Sua loja"}</strong>
                    </span>
                  </div>
                  <div className="onb-summary-row">
                    <span>👗</span>
                    <span>
                      {segment.map((s) => segments.find((seg) => seg.value === s)?.label).filter(Boolean).join(", ") || "Moda"}
                    </span>
                  </div>
                  {city && (
                    <div className="onb-summary-row">
                      <span>📍</span>
                      <span>{city}</span>
                    </div>
                  )}
                  {instagram && (
                    <div className="onb-summary-row">
                      <span>📸</span>
                      <span>{instagram}</span>
                    </div>
                  )}
                  {!isFreeTier && (
                    <div className="onb-summary-row">
                      <span>👩</span>
                      <span>{body === "media" && skin && !saving ? "Modelo personalizada" : "Modelo stock"}</span>
                    </div>
                  )}
                </div>

                <Link
                  href="/gerar"
                  className="btn-primary w-full !py-4 text-base animate-pulse-glow"
                >
                  <IconZap />
                  Gerar minha primeira campanha
                  <IconArrowRight />
                </Link>

                {!isFreeTier && (
                  <Link
                    href="/modelo"
                    className="onb-skip-btn"
                    style={{ marginTop: "16px", display: "inline-block" }}
                  >
                    Ou configurar modelo virtual primeiro →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
