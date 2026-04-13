"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, RefreshCw, Wand2, CheckCircle2 } from "lucide-react";
import Image from "next/image";

/* ═══════════════════════════════════════
   Demo campaigns — each with image + unique caption
   ═══════════════════════════════════════ */
const demos = [
  {
    image: "/demo-download.jpg",
    alt: "Cropped laranja + bermuda jeans — campanha gerada pela IA",
    caption: `☀️ Casual chic que funciona de segunda a sábado.

Cropped canelado laranja + bermuda jeans destroyed — o combo que toda cliente pede e nunca acha pronto. Agora achou. 🔥

Tecido premium com elastano que abraça sem apertar. Lavagem clara vintage que combina com tudo.

🏷️ Cropped: R$ 59 | Bermuda: R$ 89
Combo lançamento R$ 129 (economize R$ 19) 💸

📲 Chama no direct ou toque no link da bio!
#ModaFeminina #LookDoDia #JeansDestroyed #CroppedCanelado #ModaCasual`,
    jsx: (
      <>
        ☀️ Casual chic que funciona de segunda a sábado. <br/><br/>
        Cropped canelado laranja + bermuda jeans destroyed — o combo que toda cliente pede e nunca acha pronto. Agora achou. 🔥 <br/><br/>
        Tecido premium com elastano que abraça sem apertar. Lavagem clara vintage que combina com tudo. <br/><br/>
        🏷️ Cropped: R$ 59 | Bermuda: R$ 89 <br/>
        Combo lançamento R$ 129 (economize R$ 19) 💸 <br/><br/>
        📲 Chama no direct ou toque no link da bio! <br/>
        #ModaFeminina #LookDoDia #JeansDestroyed #CroppedCanelado #ModaCasual
      </>
    ),
  },
  {
    image: "/demo-2.png",
    alt: "Vestido longo tropical com flores e araras — campanha gerada pela IA",
    caption: `🌺 A estampa que para o feed e faz o dedo clicar.

Vestido longo tropical com decote V, manga 3/4 e cintura marcada com cordão — caimento solto que valoriza todos os corpos. Estampa exclusiva com flores e araras. 🦜

Tecido viscose leve que não amassa e acompanha cada movimento com elegância.

🏷️ R$ 189 à vista ou 3x de R$ 63
Frete grátis acima de R$ 150 🚚

📲 Garanta o seu antes que esgote — link na bio!
#VestidoLongo #EstampaTropical #ModaVerão #LookPraia #ModaFeminina`,
    jsx: (
      <>
        🌺 A estampa que para o feed e faz o dedo clicar. <br/><br/>
        Vestido longo tropical com decote V, manga 3/4 e cintura marcada com cordão — caimento solto que valoriza todos os corpos. Estampa exclusiva com flores e araras. 🦜 <br/><br/>
        Tecido viscose leve que não amassa e acompanha cada movimento com elegância. <br/><br/>
        🏷️ R$ 189 à vista ou 3x de R$ 63 <br/>
        Frete grátis acima de R$ 150 🚚 <br/><br/>
        📲 Garanta o seu antes que esgote — link na bio! <br/>
        #VestidoLongo #EstampaTropical #ModaVerão #LookPraia #ModaFeminina
      </>
    ),
  },
  {
    image: "/demo-3.png",
    alt: "Vestido verde esmeralda ombro único — campanha gerada pela IA",
    caption: `💚 A cor que domina a temporada — e o closet da sua cliente.

Vestido curto verde esmeralda com modelagem ombro único, manga ampla e faixa na cintura. Elegância descomplicada que funciona do brunch ao happy hour. ✨

Tecido texturizado com caimento impecável. Não marca, não transparece, não decepciona.

🏷️ R$ 149 à vista
Parcelamos em até 3x sem juros 💳

📲 Corre que verde esmeralda esgota rápido — chama no direct!
#VestidoVerde #OmbroÚnico #LookFesta #ModaElegante #ModaFeminina`,
    jsx: (
      <>
        💚 A cor que domina a temporada — e o closet da sua cliente. <br/><br/>
        Vestido curto verde esmeralda com modelagem ombro único, manga ampla e faixa na cintura. Elegância descomplicada que funciona do brunch ao happy hour. ✨ <br/><br/>
        Tecido texturizado com caimento impecável. Não marca, não transparece, não decepciona. <br/><br/>
        🏷️ R$ 149 à vista <br/>
        Parcelamos em até 3x sem juros 💳 <br/><br/>
        📲 Corre que verde esmeralda esgota rápido — chama no direct! <br/>
        #VestidoVerde #OmbroÚnico #LookFesta #ModaElegante #ModaFeminina
      </>
    ),
  },
  {
    image: "/demo-4.png",
    alt: "Macaquinho estampado tropical floral — campanha gerada pela IA",
    caption: `🌸 Peça única, estilo de sobra — é vestir e sair arrasando.

Macaquinho estampado tropical com decote V, manga ampla e amarração na cintura. Estampa vibrante com flores vermelhas e detalhes étnicos que chamam atenção de longe. 🔥

Tecido fluido ultraleve — perfeito pro calor sem perder a elegância.

🏷️ R$ 129 à vista ou 2x de R$ 64,50
Compre 2 peças e ganhe 10% OFF 🎉

📲 Peça pronta-entrega — chama agora no direct!
#Macaquinho #LookVerão #EstampaFloral #ModaTropical #ModaFeminina`,
    jsx: (
      <>
        🌸 Peça única, estilo de sobra — é vestir e sair arrasando. <br/><br/>
        Macaquinho estampado tropical com decote V, manga ampla e amarração na cintura. Estampa vibrante com flores vermelhas e detalhes étnicos que chamam atenção de longe. 🔥 <br/><br/>
        Tecido fluido ultraleve — perfeito pro calor sem perder a elegância. <br/><br/>
        🏷️ R$ 129 à vista ou 2x de R$ 64,50 <br/>
        Compre 2 peças e ganhe 10% OFF 🎉 <br/><br/>
        📲 Peça pronta-entrega — chama agora no direct! <br/>
        #Macaquinho #LookVerão #EstampaFloral #ModaTropical #ModaFeminina
      </>
    ),
  },
];

export default function LiveCampaignDemo() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentDemo, setCurrentDemo] = useState(0);

  // Pick a random demo on first render
  useEffect(() => {
    setCurrentDemo(Math.floor(Math.random() * demos.length));
  }, []);

  const demo = demos[currentDemo];

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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(demo.caption);
    } catch { /* fallback: textarea copy */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [demo.caption]);

  const handleDownloadDemo = useCallback(() => {
    const link = document.createElement("a");
    link.href = demo.image;
    link.download = `campanha-crialook-demo.${demo.image.endsWith('.png') ? 'png' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [demo.image]);

  const resetDemo = () => {
    setIsDone(false);
    setProgress(0);
    setCopied(false);
    // Pick a different random demo
    let next = Math.floor(Math.random() * demos.length);
    while (next === currentDemo && demos.length > 1) {
      next = Math.floor(Math.random() * demos.length);
    }
    setCurrentDemo(next);
    setIsGenerating(true);
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-surface shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left Side: Empty State / Generating / Result Image */}
        <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 relative flex items-center justify-center p-8 min-h-[400px] md:min-h-[500px]">
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
                  className="btn-primary w-full text-lg shadow-[0_0_20px_rgba(217,70,239,0.4)]"
                >
                  <Wand2 className="w-5 h-5 mr-2" /> Gerar Demonstração Grátis
                </button>
              </motion.div>
            )}

            {isGenerating && (
              <motion.div 
                key="generating"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center px-4"
              >
                {/* Circular Progress */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 mb-6 mx-auto">
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
                    <span className="text-2xl md:text-3xl font-black">{Math.round(progress)}%</span>
                  </div>
                </div>
                
                {/* Status text jumping updates based on progress */}
                <div className="h-8 overflow-hidden text-sm md:text-lg font-bold text-brand-600 dark:text-brand-400 text-center w-full">
                  <AnimatePresence mode="wait">
                    {progress < 30 && <motion.span key="1" className="block text-center" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Recortando peça...</motion.span>}
                    {progress >= 30 && progress < 60 && <motion.span key="2" className="block text-center" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Gerando modelo realista...</motion.span>}
                    {progress >= 60 && progress < 90 && <motion.span key="3" className="block text-center" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Criando cenário de luxo...</motion.span>}
                    {progress >= 90 && <motion.span key="4" className="block text-center" initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:-20, opacity:0}}>Escrevendo Copy Persuasiva...</motion.span>}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {isDone && (
              <motion.div 
                key={`done-${currentDemo}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full absolute inset-0"
              >
                <Image 
                  src={demo.image} 
                  alt={demo.alt} 
                  fill 
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover" 
                  priority 
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Copy & Actions */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col bg-surface relative">
            {!isDone ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 grayscale blur-[2px]">
                {/* Skeleton UI for text */}
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mb-4" />
                <div className="w-3/4 h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="w-5/6 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
                <div className="w-full h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
              </div>
            ) : (
              <motion.div 
                key={`text-${currentDemo}`}
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
                    <p>{demo.jsx}</p>
                    <button 
                      onClick={handleCopy}
                      className="absolute top-3 right-3 p-2 bg-white dark:bg-gray-800 rounded-lg shadow opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center min-w-[44px] min-h-[44px]"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button onClick={handleDownloadDemo} className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-bold hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors min-h-[44px]">
                      <Download className="w-4 h-4" />
                      Baixar Foto
                    </button>
                    <button onClick={handleCopy} className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold hover:bg-black dark:hover:bg-white transition-colors min-h-[44px]">
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copiado!" : "Copiar Texto"}
                    </button>
                  </div>

                  {/* CTA de conversão pós-demo */}
                  <a href="/sign-up" className="btn-primary w-full text-sm !py-3 min-h-[44px] hover:animate-pulse-glow">
                    ✨ Quero criar a minha — R$ 19,90
                  </a>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 mt-auto flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Tempo real: ~60s</span>
                  <button onClick={resetDemo} className="text-xs font-bold flex items-center gap-1 text-gray-500 hover:text-brand-600 transition-colors min-h-[44px] px-3">
                    <RefreshCw className="w-3.5 h-3.5" /> Gerar Outra
                  </button>
                </div>
              </motion.div>
            )}
        </div>
      </div>
    </div>
  );
}
