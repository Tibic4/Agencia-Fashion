"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * Inicializa PostHog no client-side.
 */
function PostHogInit() {
  const { user } = useUser();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

    if (!key) return;

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      autocapture: true,
    });
  }, []);

  // Identificar usuário quando logar via Clerk
  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    }
  }, [user]);

  return null;
}

/**
 * Provider que wrapa a app com PostHog.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      {children}
    </PHProvider>
  );
}

/**
 * Eventos customizados para tracking de funil.
 */
export const analytics = {
  /** Quando completa o onboarding */
  onboardingCompleted: (storeId: string, segment: string) => {
    posthog.capture("onboarding_completed", { store_id: storeId, segment });
  },

  /** Quando gera uma campanha */
  campaignGenerated: (campaignId: string, objective: string, durationMs: number) => {
    posthog.capture("campaign_generated", {
      campaign_id: campaignId,
      objective,
      duration_ms: durationMs,
    });
  },

  /** Quando inicia checkout */
  checkoutStarted: (planId: string) => {
    posthog.capture("checkout_started", { plan_id: planId });
  },

  /** Quando visualiza página de planos */
  plansViewed: () => {
    posthog.capture("plans_viewed");
  },

  /** Quando copia texto da campanha */
  campaignCopied: (channel: string) => {
    posthog.capture("campaign_copied", { channel });
  },

  /** Quando atinge limite de quota */
  quotaExceeded: (planId: string) => {
    posthog.capture("quota_exceeded", { plan_id: planId });
  },
};
