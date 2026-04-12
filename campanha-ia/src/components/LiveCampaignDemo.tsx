"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, RefreshCw, Wand2, CheckCircle2, Image as ImageIcon } from "lucide-react";

export default function LiveCampaignDemo() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Simula o timer acelerado na página de LP (para não entediar o usuário)
  useEffect(() => {
    if (isGenerating) {
      setProgress(0);
      const duration = 6000; // 6 seconds for demo purposes
      const intervalDelay = 50;
      const step = 100 / (duration / intervalDelay);
      
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsGenerating(false);
            setIsDone(true);
            return 100;
          }
          return prev + step;
        });
      }, intervalDelay);
      
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetDemo = () => {
    setIsDone(false);
    setProgress(0);
    setIsGenerating(true);
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-surface shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left Side: Empty State / Generating / Result Image */}
        <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 relative flex flex-col items-center justify-center p-8">
          <AnimatePresence mode="wait">
            {!isGenerating && !isDone && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center max-w-sm"
              >
                <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg mb-6">
                  <Wand2 className="w-10 h-10 text-brand-500" />
                </div>
                <h3 className="text-2xl font-bold font-display mb-2">Veja a mágica acontecer</h3>
                <p className="text-muted-foreground mb-8">
                  Clique no botão abaixo para simular a criação de uma campanha completa a partir de uma foto de manequim.
                </p>
                <button 
                  onClick={() => setIsGenerating(true)}
                  className="btn-primary w-full text-lg shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                >
                  <Wand2 className="w-5 h-5 mr-2" /> Gerar Demonstração (60s)
                </button>
              </motion.div>
            )}

            {isGenerating && (
              <motion.div 
                key="generating"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center w-full"
              >
                {/* Circular Progress */}
                <div className="relative w-40 h-40 mb-6">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200 dark:text-gray-800" />
                    <circle 
                      cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                      className="text-brand-500 transition-all duration-75"
                      strokeDasharray="283"
                      strokeDashoffset={283 - (283 * progress) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black">{Math.round(progress)}%</span>
                  </div>
                </div>
                
                {/* Status text jumping updates based on progress */}
                <div className="h-8 overflow-hidden text-lg font-bold text-brand-600 dark:text-brand-400">
                  <AnimatePresence mode="wait">
                    {progress < 30 && <motion.span key="1" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Recortando peça...</motion.span>}
                    {progress >= 30 && progress < 60 && <motion.span key="2" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Gerando modelo realista...</motion.span>}
                    {progress >= 60 && progress < 90 && <motion.span key="3" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Criando cenário de luxo...</motion.span>}
                    {progress >= 90 && <motion.span key="4" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Escrevendo Copy Persuasiva...</motion.span>}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {isDone && (
              <motion.div 
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full absolute inset-0 bg-gray-100" // Image overlay
              >
                {/* Fake image representation since we don't have the actual generated image file for the mock */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-100 dark:bg-gray-800 text-brand-900 dark:text-brand-300">
                   <ImageIcon className="w-16 h-16 opacity-50 mb-2" />
                   <span className="font-bold opacity-70">Imagem da Campanha</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Copy & Actions */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col bg-surface relative">
            {!isDone ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 grayscale blur-[2px]">
                {/* Skeleton UI for text */}
                <div className="w-12 h-12 bg-gray-200 rounded-full mb-4" />
                <div className="w-3/4 h-6 bg-gray-200 rounded mb-2" />
                <div className="w-full h-4 bg-gray-200 rounded mb-2" />
                <div className="w-5/6 h-4 bg-gray-200 rounded mb-6" />
                <div className="w-full h-12 bg-gray-200 rounded-xl" />
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col h-full"
              >
                <div className="flex items-center gap-2 mb-6 text-brand-600 dark:text-brand-400 font-bold text-sm uppercase tracking-wider">
                  <CheckCircle2 className="w-5 h-5" />
                  Campanha Pronta
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                    <span className="font-bold text-sm">Legenda para Feed (Alta Conversão)</span>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 text-sm leading-relaxed mb-6 text-foreground relative group">
                    <p>
                      ✨ Aquele look que a gente veste e o dia muda... <br/><br/>
                      Vestido Tropical Bloom — porque você merece um verão dentro de você. Caimento fluido, decote estruturado e toque acetinado premium. 🌺 <br/><br/>
                      Apenas 5 unidades disponíveis nessa estampa. <br/>
                      De R$ 189 por R$ 149 na promo de lançamento. 🛍️ <br/><br/>
                      👉 Toque no link da bio e garanta o seu antes que esgote!
                    </p>
                    <button 
                      onClick={handleCopy}
                      className="absolute top-3 right-3 p-2 bg-white dark:bg-gray-800 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-50 text-brand-700 font-bold hover:bg-brand-100 transition-colors">
                      <Download className="w-4 h-4" />
                      Baixar Foto
                    </button>
                    <button onClick={handleCopy} className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-colors">
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      Copiar Texto
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 mt-auto flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Tempo gasto: 60s</span>
                  <button onClick={resetDemo} className="text-xs font-bold flex items-center gap-1 text-gray-500 hover:text-brand-600 transition-colors">
                    <RefreshCw className="w-3 h-3" /> Gerar Outra
                  </button>
                </div>
              </motion.div>
            )}
        </div>
      </div>
    </div>
  );
}
