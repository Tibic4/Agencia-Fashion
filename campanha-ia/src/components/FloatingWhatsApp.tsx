"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const WHATSAPP_URL =
  "https://wa.me/553498223001?text=Oi!%20Vi%20o%20CriaLook%20e%20queria%20bater%20um%20papo%20para%20entender%20melhor.";

export default function FloatingWhatsApp() {
  const [pulse, setPulse] = useState(false);

  // Pulse sutil a cada 8 segundos (tipo batimento cardíaco)
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }, 8000);

    // Primeiro pulse após 3s para chamar atenção inicial
    const first = setTimeout(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(first);
    };
  }, []);

  return (
    <>
      <style jsx>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          25% { transform: scale(1.1); }
          40% { transform: scale(1); }
          55% { transform: scale(1.07); }
          70% { transform: scale(1); }
          100% { transform: scale(1); }
        }
        @keyframes ringExpand {
          0% { transform: scale(0.9); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .wa-btn {
          position: fixed;
          bottom: 80px;
          right: 16px;
          z-index: 9999;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                      filter 0.3s ease;
        }
        @media (min-width: 640px) {
          .wa-btn {
            bottom: 24px;
            right: 24px;
          }
        }
        .wa-btn:hover {
          transform: scale(1.05) translateY(-4px) !important;
          filter: drop-shadow(0 8px 20px rgba(236, 72, 153, 0.4));
        }
        .wa-btn:active {
          transform: scale(0.95) !important;
        }
        .wa-heartbeat {
          animation: heartbeat 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .wa-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(236, 72, 153, 0.35);
          animation: ringExpand 0.8s ease-out;
          pointer-events: none;
        }
      `}</style>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco pelo WhatsApp"
        title="Fale conosco no WhatsApp"
        className={`wa-btn ${pulse ? "wa-heartbeat" : ""}`}
      >
        {pulse && <span className="wa-ring" />}
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 drop-shadow-2xl">
          <Image
            src="/zap-buton.png"
            alt="WhatsApp"
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      </a>
    </>
  );
}
