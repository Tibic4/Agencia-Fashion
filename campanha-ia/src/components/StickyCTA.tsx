"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Aparece após a dobra 2 (aprox 1000px)
      const scrolledPastHero = window.scrollY > 800;
      
      // Desaparece quando chega na seção de preços ou footer
      const pricingSection = document.getElementById("precos");
      const footer = document.querySelector("footer");
      
      let pastPricing = false;
      if (pricingSection) {
        const rect = pricingSection.getBoundingClientRect();
        // Se a seção de preços estiver visível (topo dela menor que a altura da tela)
        if (rect.top <= window.innerHeight && rect.bottom >= 0) {
          pastPricing = true;
        }
      }
      if (footer) {
        const rect = footer.getBoundingClientRect();
        if (rect.top <= window.innerHeight) {
          pastPricing = true;
        }
      }

      setIsVisible(scrolledPastHero && !pastPricing);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check once on mount
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <Link
      href="/sign-up"
      aria-label="Criar primeira campanha por R$ 19,90"
      className="fixed left-3 right-3 sm:left-4 sm:right-4 z-40 md:hidden h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 gap-2 font-bold text-[13px] sm:text-[15px] animate-in slide-in-from-bottom-10 fade-in duration-300 whitespace-nowrap"
      // FASE G.4: respeita safe-area-inset-bottom (notch/home indicator iPhone)
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        background: 'var(--gradient-brand)',
        color: 'white',
        boxShadow: '0 8px 25px rgba(217,70,239,0.4)',
      }}
    >
      <Zap className="w-5 h-5 shrink-0" aria-hidden="true" />
      Criar Campanha — R$ 19,90
    </Link>
  );
}
