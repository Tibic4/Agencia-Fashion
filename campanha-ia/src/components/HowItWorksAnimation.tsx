"use client";
import { motion } from "framer-motion";
import { Camera, Sparkles, TrendingUp } from "lucide-react";

export default function HowItWorksAnimation() {
  const steps = [
    {
      id: 1,
      icon: <Camera className="w-8 h-8 text-white" />,
      title: "Fotografe o Manequim",
      description: "Você não precisa de estúdio ou modelos físicas. Uma foto simples no manequim ou cabide resolve o problema em 10 segundos.",
      color: "bg-gray-800"
    },
    {
      id: 2,
      icon: <Sparkles className="w-8 h-8 text-brand-900" />,
      title: "A IA Cria Tudo",
      description: "Nossa tecnologia veste um modelo ultrarrealista com sua peça, insere em um cenário de luxo e escreve a legenda persuasiva para vender.",
      color: "bg-gradient-to-br from-brand-300 to-brand-500"
    },
    {
      id: 3,
      icon: <TrendingUp className="w-8 h-8 text-white" />,
      title: "Publique e Venda",
      description: "Em menos de 60 segundos você recebe o Post e o Story prontinhos. É só copiar, colar no Instagram e faturar.",
      color: "bg-gray-900"
    }
  ];

  return (
    <div className="relative py-12 max-w-5xl mx-auto">
      {/* Central Timeline Line (Desktop) */}
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-200 via-brand-200 to-gray-200 dark:from-gray-800 dark:via-brand-800 dark:to-gray-800 -translate-x-1/2 rounded-full" />

      <div className="space-y-16 md:space-y-24">
        {steps.map((step, index) => {
          const isEven = index % 2 === 0;
          return (
            <motion.div 
              key={step.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className={`relative flex flex-col items-center md:flex-row ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 md:gap-16`}
            >
              {/* Content Panel */}
              <div className="w-full md:w-1/2 flex flex-col md:text-left text-center">
                <div className={`md:max-w-md ${isEven ? 'ml-auto' : 'mr-auto'} p-8 rounded-2xl bg-surface border border-border shadow-lg hover:shadow-xl transition-shadow`}>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold mb-4 font-display text-xl">
                    {step.id}
                  </div>
                  <h3 className="text-2xl font-bold font-display mb-3 text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>

              {/* Timeline Center Node */}
              <div className="hidden md:flex absolute left-1/2 outline outline-8 outline-background -translate-x-1/2 w-16 h-16 rounded-full items-center justify-center shadow-lg z-10" style={{ backgroundImage: step.id === 2 ? 'linear-gradient(135deg, #ec4899, #a855f7)' : 'none', backgroundColor: step.id === 2 ? 'transparent' : '#18181b' }}>
                {step.icon}
              </div>

              {/* Visual Panel / Mockup */}
              <div className="w-full md:w-1/2 flex justify-center">
                <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800 bg-gray-900">
                  {/* Mock content inside the "phone" */}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center ${step.color}`}>
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    >
                      {step.icon}
                    </motion.div>
                    <motion.p 
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className={`mt-4 font-bold text-lg ${step.id === 2 ? 'text-brand-900' : 'text-white'}`}
                    >
                      {step.title}
                    </motion.p>
                  </div>
                  
                  {/* Phone Notch */}
                  <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-xl max-w-[120px] mx-auto" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
