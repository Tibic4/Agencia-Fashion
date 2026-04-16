"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface FAQ {
  q: string;
  a: string;
}

const faqs: FAQ[] = [
  {
    q: "Como a CriaLook funciona na prática?",
    a: "Você tira uma foto da sua roupa num manequim, cabide ou no chão. Nossa IA recorta a peça, ajusta a luz, veste em um modelo virtual ultrarrealista com o seu biotipo escolhido, coloca em um cenário de luxo e gera uma legenda com gatilhos mentais pronta para o Instagram."
  },
  {
    q: "Preciso de conhecimento em marketing ou edição?",
    a: "Nenhum! Cuidamos de tudo: desde o recorte da foto e geração do modelo, até o texto persuasivo focando em escassez e desejo. Você só clica, copia e posta."
  },
  {
    q: "As pessoas vão perceber que é IA?",
    a: "Nossa Modelagem Fotorealista 4.0 resolve imperfeições que outras ferramentas deixam. Dedos, texturas e costuras ficam impecáveis. Seus clientes vão achar que você pagou R$ 3.000 em um estúdio fotográfico."
  },
  {
    q: "Como funciona a garantia incondicional?",
    a: "Se você gerar sua primeira campanha e não ficar impressionado com a qualidade do modelo, não conseguir usar no Instagram, ou simplesmente não gostar da legenda, devolvemos 100% dos seus créditos imediatamente. Risco Zero."
  },
  {
    q: "Posso mudar o rosto ou tipo físico do modelo?",
    a: "Sim. Assinantes têm acesso à nossa biblioteca de modelos diversos (plus size, diferentes etnias, biotipos) e podem criar um 'Modelo Proprietário' que só a sua marca usa."
  },
  {
    q: "Serve para peças masculinas e infantis?",
    a: "Com certeza. A CriaLook tem cenários e manequins virtuais adaptados para moda feminina, masculina, infantil e até acessórios."
  },
  {
    q: "O que acontece se meus créditos acabarem?",
    a: "Você pode fazer um upgrade do seu plano a qualquer momento ou comprar Packs Avulsos de campanhas sem perder seu histórico."
  },
  {
    q: "Quero assinar. É seguro?",
    a: "Utilizamos o Mercado Pago para pagamentos — a maior plataforma de pagamentos da América Latina. Seus dados estão 100% protegidos e você pode cancelar a assinatura com 1 clique no painel, sem taxas escondidas."
  }
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // Open first by default for engagement

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div 
            key={index} 
            className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isOpen ? 'bg-surface border-brand-300 shadow-md' : 'bg-transparent border-border hover:border-gray-400'}`}
          >
            <button
              onClick={() => toggle(index)}
              className="w-full flex items-center justify-between p-4 sm:p-5 md:p-6 text-left focus:outline-none min-h-[44px]"
            >
              <span className={`font-medium text-sm sm:text-base md:text-lg transition-colors ${isOpen ? 'text-brand-600 dark:text-brand-400' : 'text-foreground'}`}>
                {faq.q}
              </span>
              <motion.div
                initial={false}
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className={`flex-shrink-0 ml-4 ${isOpen ? 'text-brand-500' : 'text-muted-foreground'}`}
              >
                <ChevronDown className="w-5 h-5" />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
