"use client";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/utils/analytics";

export function useScrollTracking() {
  const trackedDepths = useRef(new Set<number>());

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollY = window.scrollY;

      // Porcentagem rolada
      const scrollPercent = (scrollY / (scrollHeight - clientHeight)) * 100;
      
      const depthMarks = [25, 50, 75, 90, 100];
      
      depthMarks.forEach(mark => {
        if (scrollPercent >= mark && !trackedDepths.current.has(mark)) {
          trackedDepths.current.add(mark);
          trackEvent("scroll_depth", { depth: `${mark}%` });
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
}
