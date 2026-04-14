"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function PricingTabs() {
  const [activeTab, setActiveTab] = useState<"assinaturas" | "avulsos">("assinaturas");

  interface PlanType {
    name: string;
    qty: string;
    price: string;
    sub: string;
    popular: boolean;
    features?: string[];
    original?: string;
  }

  const assinaturas: PlanType[] = [
    {
      name: "Essencial",
      qty: "15 Campanhas / mês",
      price: "179",
      sub: "R$ 11,93 por campanha",
      features: ["5 Modelos Virtuais", "Legenda e Hashtags IA", "Fundo Inteligente Adaptável", "Suporte WhatsApp"],
      popular: false,
    },
    {
      name: "Pro",
      qty: "40 Campanhas / mês",
      price: "359",
      sub: "R$ 8,98 por campanha",
      features: ["15 Modelos Virtuais", "Legenda e Hashtags IA", "Alta Prioridade na Fila", "Fundo Inteligente Adaptável", "Suporte WhatsApp"],
      popular: true,
    },
    {
      name: "Business",
      qty: "100 Campanhas / mês",
      price: "749",
      sub: "R$ 7,49 por campanha",
      features: ["40 Modelos Virtuais", "Legenda e Hashtags IA", "Prioridade Máxima na Fila", "Fundo Inteligente Adaptável", "Suporte VIP Dedicado"],
      popular: false,
    }
  ];

  const packs: PlanType[] = [
    {
      name: "Starter",
      qty: "3 Campanhas avulsas",
      original: "59,70",
      price: "49,90",
      sub: "R$ 16,63 por campanha",
      popular: false,
    },
    {
      name: "Smart",
      qty: "10 Campanhas avulsas",
      original: "199,00",
      price: "149,90",
      sub: "R$ 14,99 por campanha",
      popular: true,
    },
    {
      name: "Volume",
      qty: "20 Campanhas avulsas",
      original: "398,00",
      price: "249,00",
      sub: "R$ 12,45 por campanha",
      popular: false,
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-12">
      <div className="flex justify-center mb-10 px-4">
        <div className="bg-gray-100 dark:bg-gray-900 p-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm relative grid grid-cols-2 w-full max-w-md">
          <button 
            onClick={() => setActiveTab("assinaturas")}
            className={`relative z-10 px-3 md:px-6 py-3 rounded-full text-xs md:text-sm font-bold transition-colors text-center ${activeTab === "assinaturas" ? "text-brand-900" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
          >
            <span className="block">Assinaturas Mensais</span>
            <span className="mt-0.5 inline-block px-2 text-[9px] md:text-[10px] uppercase tracking-wider bg-brand-500/20 text-brand-700 dark:text-brand-400 rounded-full font-bold">
              Recomendado
            </span>
          </button>
          <button 
            onClick={() => setActiveTab("avulsos")}
            className={`relative z-10 px-3 md:px-6 py-3 rounded-full text-xs md:text-sm font-bold transition-colors text-center ${activeTab === "avulsos" ? "text-brand-900" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
          >
            Packs Avulsos
          </button>
          
          {/* Active indicator */}
          <div 
            className="absolute top-1 bottom-1 bg-white dark:bg-gray-800 rounded-full shadow-sm transition-all duration-300 ease-out border border-gray-200/50 dark:border-gray-700"
            style={{ 
              left: activeTab === "assinaturas" ? '4px' : '50%',
              right: activeTab === "assinaturas" ? '50%' : '4px',
            }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 ${activeTab === 'avulsos' && 'max-w-4xl mx-auto'}`}
        >
          {(activeTab === "assinaturas" ? assinaturas : packs).map((plan, i) => (
            <div 
              key={i} 
              className={`relative flex flex-col rounded-3xl p-6 sm:p-8 bg-surface border transition-all duration-300 ${plan.popular ? 'border-brand-500 shadow-[0_0_40px_rgba(217,70,239,0.15)] mt-6 md:mt-0 md:-translate-y-4 hover:-translate-y-6' : 'border-border shadow-md hover:shadow-xl hover:-translate-y-2'}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-500 text-brand-950 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                  <Zap className="w-3 h-3" /> Mais Popular
                </div>
              )}
              
              <h3 className="font-display font-medium text-xl text-muted-foreground mb-4">{plan.name}</h3>
              <div className="mb-2">
                <span className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground">
                  <span className="text-lg sm:text-xl md:text-2xl font-bold opacity-60 mr-1">R$</span>
                  {plan.price}
                </span>
                {activeTab === "assinaturas" && <span className="text-muted-foreground font-medium">/mês</span>}
              </div>
              <p className="text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-500/10 inline-block px-3 py-1 rounded-full w-fit mb-6">
                {plan.sub}
              </p>

              {plan.original && (
                <div className="text-sm text-muted-foreground line-through mb-4">
                  De: R$ {plan.original}
                </div>
              )}

              <div className="text-lg font-bold mb-6 border-b border-border pb-6">{plan.qty}</div>

              {activeTab === "assinaturas" && plan.features && (
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="w-5 h-5 text-success shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              <Link 
                href="/sign-up" 
                className={`mt-auto w-full py-4 rounded-full text-center font-bold transition-all duration-200 inline-flex items-center justify-center ${plan.popular ? 'btn-primary shadow-brand' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground'}`}
              >
                Assinar {plan.name}
              </Link>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Security Seals — Mercado Pago */}
      <div className="mt-16 border-t border-border pt-8 flex flex-col items-center">
        <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-5 uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          Pagamento 100% Seguro
        </div>
        <div className="flex flex-col items-center gap-4 opacity-70 hover:opacity-100 transition-all duration-300">
           {/* Mercado Pago official handshake logo + wordmark */}
           <div className="flex items-center gap-3">
             {/* MP Handshake Icon — official style */}
             <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mercado Pago">
               <circle cx="24" cy="24" r="24" fill="#00AAFF"/>
               {/* Left hand */}
               <path d="M13 27.5c0 0 1.5-1 3-1s2.5.8 3.5.8c1.2 0 2-.5 2-.5l5.5-5c.8-.7 2-.6 2.7.2.6.7.5 1.8-.2 2.4l-3 2.6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
               {/* Right hand */}
               <path d="M35 27.5c0 0-1.5-1-3-1s-2.5.8-3.5.8c-1.2 0-2-.5-2-.5l-5.5-5c-.8-.7-2-.6-2.7.2-.6.7-.5 1.8.2 2.4l3 2.6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
               {/* Clasped center */}
               <path d="M21 27c1 .8 2.2 1.2 3 1.2s2-.4 3-1.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
               {/* Sleeves */}
               <path d="M10 28.5c0-.8.7-1.5 1.5-1.5h2c.4 0 .5.3.5.7v4.3c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-3.5z" fill="white" opacity="0.9"/>
               <path d="M38 28.5c0-.8-.7-1.5-1.5-1.5h-2c-.4 0-.5.3-.5.7v4.3c0 .6.4 1 1 1h2c.6 0 1-.4 1-1v-3.5z" fill="white" opacity="0.9"/>
             </svg>
             {/* Mercado Pago wordmark */}
             <div className="flex flex-col items-start leading-none">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Checkout oficial</span>
               <span className="text-xl font-black tracking-tight" style={{ color: '#00AAFF' }}>
                 mercado<span className="font-black">pago</span>
               </span>
             </div>
           </div>
           {/* Payment methods accepted */}
           <div className="flex items-center gap-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
             <span>PIX</span>
             <span className="w-1 h-1 rounded-full bg-current opacity-30" />
             <span>Cartão</span>
             <span className="w-1 h-1 rounded-full bg-current opacity-30" />
             <span>Boleto</span>
           </div>
        </div>
      </div>
    </div>
  );
}
