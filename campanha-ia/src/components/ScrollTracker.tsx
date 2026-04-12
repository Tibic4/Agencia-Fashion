"use client";
import { useEffect } from "react";
import { useScrollTracking } from "@/hooks/useScrollTracking";
import { trackCtaClick } from "@/utils/analytics";

export default function ScrollTracker() {
  useScrollTracking();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find closest anchor or button
      const target = (e.target as HTMLElement).closest("a, button");
      if (target) {
        const text = target.textContent?.trim() || "";
        const href = target.getAttribute("href") || "";
        
        // Only track meaningful CTAs that go somewhere or look like primary actions
        if (href.includes("sign-up") || href.includes("sign-in") || text.includes("Começar") || text.includes("Assinar") || text.includes("Criar Campanha")) {
          trackCtaClick("landing_page", text.substring(0, 50));
        }
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
