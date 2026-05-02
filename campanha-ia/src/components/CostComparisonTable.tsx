"use client";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

export default function CostComparisonTable() {
  const rows = [
    {
      feature: "Modelo / Casting",
      traditional: "R$ 500 - R$ 1.500/dia",
      crialook: "Incluso (Modelos Virtuais)"
    },
    {
      feature: "Fotógrafo",
      traditional: "R$ 800 - R$ 2.000/dia",
      crialook: "R$ 0 (Use seu celular)"
    },
    {
      feature: "Estúdio / Cenário",
      traditional: "R$ 300 - R$ 800/dia",
      crialook: "Incluso (Cenários IA)"
    },
    {
      feature: "Copywriter",
      traditional: "R$ 50 - R$ 200/post",
      crialook: "Incluso (Legenda IA)"
    },
    {
      feature: "Tempo Total",
      traditional: "2 a 3 semanas",
      crialook: "60 segundos"
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <div className="rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800" style={{ background: 'var(--surface)' }}>
        {/* Header */}
        <div className="grid grid-cols-2 md:grid-cols-2 divide-x divide-gray-200 dark:divide-gray-800">
          <div className="bg-gray-50 dark:bg-gray-900/50 p-3 sm:p-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 sm:mb-3">
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="font-display font-bold text-sm sm:text-lg md:text-xl text-gray-500 dark:text-gray-400">Tradicional</h3>
          </div>

          <div className="bg-brand-500 p-3 sm:p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 text-white flex items-center justify-center mb-2 sm:mb-3 backdrop-blur-sm border border-white/30">
              <Check className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="font-display font-bold text-sm sm:text-lg md:text-xl text-white">CriaLook</h3>
          </div>
        </div>

        {/* Rows */}
        <div className="flex flex-col">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-800 border-t border-gray-200 dark:border-gray-800">
              <div className="p-3 sm:p-4 md:p-6 text-center flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/40">
                <span className="text-2xs sm:text-xs text-gray-400 font-medium uppercase tracking-wider mb-1 leading-tight">{row.feature}</span>
                <span className="font-medium text-gray-600 dark:text-gray-300 text-xs sm:text-sm md:text-base leading-snug">{row.traditional}</span>
              </div>
              <div className="p-3 sm:p-4 md:p-6 text-center flex flex-col items-center justify-center bg-brand-50 dark:bg-brand-900/10">
                <span className="text-2xs sm:text-xs text-brand-400 dark:text-brand-300/70 font-medium uppercase tracking-wider mb-1 leading-tight">{row.feature}</span>
                <span className="font-bold text-brand-700 dark:text-brand-300 text-xs sm:text-sm md:text-base leading-snug">{row.crialook}</span>
              </div>
            </div>
          ))}

          {/* Total Row */}
          <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-800 border-t-2 border-gray-200 dark:border-gray-800">
            <div className="p-4 sm:p-6 md:p-8 text-center bg-gray-100 dark:bg-gray-800/50">
              <span className="block text-xs sm:text-sm text-gray-500 mb-2">Custo de 1 campanha</span>
              <span className="font-black text-gray-400 line-through text-base sm:text-xl md:text-2xl">R$ 1.650+</span>
            </div>
            <div className="p-4 sm:p-6 md:p-8 text-center bg-brand-600 relative overflow-visible">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-700 opacity-80 rounded-br-3xl" />
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <span className="block text-xs sm:text-sm text-brand-100 mb-1">Custo de 1 campanha</span>
                <span className="font-black text-white text-xl sm:text-2xl md:text-4xl animate-pulse-glow drop-shadow-md">Grátis</span>
                <span className="block text-2xs sm:text-xs text-brand-100 mt-1">1ª no Beta · depois a partir de R$ 5,93</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Meta ROI */}
      <div className="mt-8 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-3 sm:gap-4 bg-surface border border-border px-3 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-full shadow-lg"
        >
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Economia gerada</span>
            <span className="font-black text-success text-xl">99,1%</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-start">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">ROI Imediato</span>
            <span className="font-black text-brand-600 dark:text-brand-400 text-xl">10.907%</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
