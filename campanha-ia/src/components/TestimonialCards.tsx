"use client";
import { Star } from "lucide-react";
import Image from "next/image";

export default function TestimonialCards() {
  const testimonials = [
    {
      name: "Mariana Souza",
      store: "Donna Elegance Boutique",
      avatar: "M",
      result: "ROI: 320% em 48h",
      quote: "Antes eu perdia 2h descendo nas costas da minha vendedora pra ela tirar foto. Hoje uso o manequim que fica no canto da loja e o Catarina AI (CriaLook) converte em fotos absurdas. Vendi todas as 15 peças do lote no primeiro teste de Meta Ads.",
      bg: "bg-fuchsia-50 dark:bg-fuchsia-950/20"
    },
    {
      name: "Letícia Ribeiro",
      store: "Letícia Store Moda Praia",
      avatar: "L",
      result: "Custo por foto: R$ 0,00",
      quote: "Sempre que chegava mercadoria, era o desespero: arrumar modelo, pagar fotógrafo. Parei de fazer lançamento por causa do custo de produção. Quando vi as imagens do CriaLook, não acreditei. Em 5 minutos fiz o carrossel do mês.",
      bg: "bg-surface"
    },
    {
      name: "Camila Fetter",
      store: "CiaBrand Shoes",
      avatar: "C",
      result: "CTR saltou de 1.2% para 4.8%",
      quote: "Com as legendas persuasivas geradas automaticamente, meus anúncios estão clicando 4x mais barato. E as fotos dos calçados ficam prontas em cenários luxuosos que eu nunca poderia bancar na vida real. Jogo virou.",
      bg: "bg-surface"
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-8">
      {/* Testimonial Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className={`flex flex-col relative rounded-3xl p-5 sm:p-8 border border-border shadow-sm transition-transform hover:-translate-y-1 ${t.bg}`}
          >
            {/* Stars */}
            <div className="flex gap-1 mb-4 sm:mb-6 text-brand-500">
              {[...Array(5)].map((_, index) => (
                <Star key={index} fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5" />
              ))}
            </div>

            {/* Quote */}
            <p className="text-foreground/90 italic leading-relaxed text-sm sm:text-base mb-5 sm:mb-8 flex-1">
              &ldquo;{t.quote}&rdquo;
            </p>

            {/* Result Badge */}
            <div className="mb-4 sm:mb-6">
              <span className="inline-flex items-center text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 sm:px-3 py-1.5 rounded-md bg-success/10 text-success border border-success/20 whitespace-normal leading-tight">
                {t.result}
              </span>
            </div>

            {/* Author */}
            <div className="flex items-center gap-3 mt-auto border-t border-border pt-4 sm:pt-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-200 dark:bg-brand-900 flex items-center justify-center font-bold text-base sm:text-lg text-brand-700 dark:text-brand-300 shrink-0">
                {t.avatar}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-foreground text-sm truncate">{t.name}</h4>
                <p className="text-xs text-muted-foreground truncate">{t.store}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
