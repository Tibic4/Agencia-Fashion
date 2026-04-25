"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

type ConsentPrefs = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: number;
};

function getConsent(): ConsentPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cookieConsent");
    return raw ? (JSON.parse(raw) as ConsentPrefs) : null;
  } catch {
    return null;
  }
}

function hasAnalyticsConsent(): boolean {
  const c = getConsent();
  return !!c && c.analytics === true;
}

function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/monitoring-analytics";
  if (!key) return;
  if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: true,
    respect_dnt: true,
    // Sessão-recording só liga se usuário consentir (via posthog.startSessionRecording)
    disable_session_recording: true,
    // Denylist de props que podem vazar PII
    property_denylist: ["$ip", "$initial_referring_domain"],
  });
}

/**
 * Inicializa PostHog no client-side — só depois do consent de analytics.
 */
function PostHogInit() {
  const { user } = useUser();

  useEffect(() => {
    // Só inicializa se houver consent de analytics (LGPD-compliant)
    if (!hasAnalyticsConsent()) return;
    initPostHog();

    const onConsentChanged = () => {
      if (hasAnalyticsConsent()) initPostHog();
    };
    window.addEventListener("cookie-consent-changed", onConsentChanged);
    return () => window.removeEventListener("cookie-consent-changed", onConsentChanged);
  }, []);

  useEffect(() => {
    if (!hasAnalyticsConsent()) return;
    if (user?.id) {
      // identify apenas com userId; email/name ficam fora (LGPD minimização)
      posthog.identify(user.id);
    }
  }, [user]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      {children}
    </PHProvider>
  );
}

/**
 * Guard que garante que capture só roda se houver consent.
 */
function safeCapture(event: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* noop */
  }
}

/**
 * Eventos de negócio (funil + monetização).
 */
export const analytics = {
  // ── Funil de ativação ──
  onboardingStarted: () => safeCapture("onboarding_started"),
  onboardingCompleted: (storeId: string, segment: string) =>
    safeCapture("onboarding_completed", { store_id: storeId, segment }),
  onboardingAbandoned: (step: string) =>
    safeCapture("onboarding_abandoned", { step }),

  // ── Geração de campanha ──
  campaignGenerationStarted: () =>
    safeCapture("campaign_generation_started"),
  campaignGenerated: (campaignId: string, objective: string, durationMs: number, successCount?: number) =>
    safeCapture("campaign_generated", {
      campaign_id: campaignId,
      objective,
      duration_ms: durationMs,
      success_count: successCount,
    }),
  campaignFailed: (code: string, retryable: boolean) =>
    safeCapture("campaign_generation_failed", { code, retryable }),

  // ── Conversão ──
  plansViewed: () => safeCapture("plans_viewed"),
  checkoutStarted: (planId: string) => safeCapture("checkout_started", { plan_id: planId }),
  checkoutInProgress: (planId: string) => safeCapture("checkout_in_progress", { plan_id: planId }),

  // ── Quota e paywall ──
  quotaExceeded: (planId: string) => safeCapture("quota_exceeded", { plan_id: planId }),
  upgradeHintShown: (context: string) => safeCapture("upgrade_hint_shown", { context }),
  upgradeClicked: (context: string, targetPlan?: string) =>
    safeCapture("upgrade_clicked", { context, target_plan: targetPlan }),

  // ── Interação pós-campanha ──
  campaignCopied: (channel: string) => safeCapture("campaign_copied", { channel }),
  campaignDownloaded: (campaignId: string, format: string) =>
    safeCapture("campaign_downloaded", { campaign_id: campaignId, format }),
  campaignFavorited: (campaignId: string) =>
    safeCapture("campaign_favorited", { campaign_id: campaignId }),

  // ── Modelos ──
  modelCreated: (modelType: "custom" | "bank") => safeCapture("model_created", { type: modelType }),
};
