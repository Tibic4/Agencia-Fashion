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
      features: ["Modelos Virtuais Exclusivos", "Legenda e Hashtags IA", "Fundo Inteligente Adaptável", "Suporte WhatsApp"],
      popular: false,
    },
    {
      name: "Pro",
      qty: "40 Campanhas / mês",
      price: "359",
      sub: "R$ 8,98 por campanha",
      features: ["Modelos Virtuais Exclusivos", "Legenda e Hashtags IA", "Alta Prioridade na Fila", "Fundo Inteligente Adaptável", "Suporte WhatsApp"],
      popular: true,
    },
    {
      name: "Business",
      qty: "100 Campanhas / mês",
      price: "749",
      sub: "R$ 7,49 por campanha",
      features: ["Modelos Virtuais Exclusivos", "Legenda e Hashtags IA", "Prioridade Máxima na Fila", "Fundo Inteligente Adaptável", "Suporte VIP Dedicado"],
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
              className={`relative flex flex-col rounded-3xl p-8 bg-surface border transition-all duration-300 ${plan.popular ? 'border-brand-500 shadow-[0_0_40px_rgba(217,70,239,0.15)] md:-translate-y-4 hover:-translate-y-6' : 'border-border shadow-md hover:shadow-xl hover:-translate-y-2'}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-500 text-brand-950 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                  <Zap className="w-3 h-3" /> Mais Popular
                </div>
              )}
              
              <h3 className="font-display font-medium text-xl text-muted-foreground mb-4">{plan.name}</h3>
              <div className="mb-2">
                <span className="text-4xl md:text-5xl font-black text-foreground">
                  <span className="text-xl md:text-2xl font-bold opacity-60 mr-1">R$</span>
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
        <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mb-4 uppercase tracking-widest">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          Pagamento 100% Seguro
        </div>
        <div className="flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-all duration-300">
           {/* Mercado Pago official logo (handshake + wordmark) */}
           <div className="flex items-center gap-2.5">
             {/* MP Handshake Icon */}
             <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mercado Pago">
               <circle cx="24" cy="24" r="24" fill="#009EE3"/>
               <path d="M34.5 20.5c-1.2-1.8-3.5-2.5-5.5-2.5-1.5 0-2.8.4-3.8 1.2-.3.2-.5.2-.8 0C23.4 18.4 22 18 20.5 18c-2 0-4.3.7-5.5 2.5-1.5 2.2-1 5.2.8 7.2l7.5 7.5c.4.4 1 .4 1.4 0l7.5-7.5c1.8-2 2.3-5 .8-7.2z" fill="white" opacity="0.95"/>
               <path d="M16 25c0-2 1-3.5 2.5-4s3 0 4 1c.3.3.7.3 1 0 1-1 2.5-1.5 4-1s2.5 2 2.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
             </svg>
             {/* Mercado Pago wordmark */}
             <div className="flex flex-col items-start leading-none">
               <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Checkout oficial</span>
               <span className="text-lg font-black tracking-tight" style={{ color: '#009EE3' }}>
                 mercado<span style={{ color: '#009EE3', fontWeight: 900 }}>pago</span>
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
