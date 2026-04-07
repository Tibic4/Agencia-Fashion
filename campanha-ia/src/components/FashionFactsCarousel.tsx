"use client";

import { useState, useEffect, useCallback } from "react";

interface FashionFact {
  emoji: string;
  category: string;
  text: string;
  source?: string;
}

const fashionFacts: FashionFact[] = [
  // ── Curiosidades Históricas ──
  { emoji: "👖", category: "Curiosidade", text: "O jeans foi inventado em 1873 por Levi Strauss para mineradores da Califórnia", source: "Levi's Archives" },
  { emoji: "👗", category: "Curiosidade", text: "Coco Chanel popularizou o pretinho básico em 1926 — antes, preto era só para luto", source: "Vogue" },
  { emoji: "👠", category: "Curiosidade", text: "O salto alto foi criado para homens no século XVII na corte de Luís XIV" },
  { emoji: "👜", category: "Curiosidade", text: "A bolsa Birkin da Hermès nasceu de um encontro casual em um avião em 1984" },
  { emoji: "🧵", category: "Curiosidade", text: "O zíper foi inventado em 1893, mas só foi usado em roupas 20 anos depois" },
  { emoji: "👔", category: "Curiosidade", text: "A gravata surgiu no século XVII inspirada nos lenços de soldados croatas" },
  { emoji: "🩱", category: "Curiosidade", text: "O biquíni foi inventado em 1946 e batizado com o nome de um atol nuclear" },
  { emoji: "🧤", category: "Curiosidade", text: "Até o século XIX, mulheres usavam até 6 pares de luvas por dia em eventos sociais" },
  { emoji: "👒", category: "Curiosidade", text: "O chapéu panamá na verdade é originário do Equador, não do Panamá" },
  { emoji: "🥿", category: "Curiosidade", text: "Sapatilhas ballet viraram moda depois que Audrey Hepburn as usou nos anos 50" },

  // ── Dados de Mercado ──
  { emoji: "📊", category: "Dado", text: "O mercado de moda brasileiro movimenta mais de R$ 190 bilhões por ano", source: "ABIT 2025" },
  { emoji: "📈", category: "Dado", text: "O e-commerce de moda cresceu 27% no Brasil em 2025", source: "SBVC" },
  { emoji: "🛒", category: "Dado", text: "63% dos brasileiros compram roupas online pelo menos 1x por mês", source: "Opinion Box" },
  { emoji: "📱", category: "Dado", text: "78% das compras de moda online no Brasil são feitas pelo celular", source: "E-bit 2025" },
  { emoji: "💳", category: "Dado", text: "O ticket médio de moda online no Brasil é de R$ 195", source: "Nuvemshop 2025" },
  { emoji: "🌎", category: "Dado", text: "O Brasil é o 5º maior mercado de moda do mundo", source: "McKinsey" },
  { emoji: "👩‍💼", category: "Dado", text: "Mulheres representam 73% das compras de moda no Brasil", source: "IEMI" },
  { emoji: "🏪", category: "Dado", text: "O Brasil tem mais de 1,3 milhão de lojas de vestuário", source: "ABIT" },
  { emoji: "♻️", category: "Dado", text: "45% dos consumidores brasileiros preferem marcas com práticas sustentáveis", source: "Nielsen 2025" },
  { emoji: "🔄", category: "Dado", text: "Lojas que postam diariamente vendem em média 2,5x mais que as que postam semanalmente", source: "Meta Business" },

  // ── Dicas para Lojistas ──
  { emoji: "💡", category: "Dica", text: "Fotos com modelo vestindo a roupa vendem 3x mais que fotos flat lay", source: "Shopify 2025" },
  { emoji: "🎯", category: "Dica", text: "Descrever o tecido e caimento no texto aumenta a conversão em 28%", source: "Baymard Institute" },
  { emoji: "⏰", category: "Dica", text: "Os melhores horários para postar moda no Instagram são 11h e 19h", source: "Sprout Social" },
  { emoji: "📸", category: "Dica", text: "Use no mínimo 3 fotos por produto: frente, costas e detalhe do tecido" },
  { emoji: "✍️", category: "Dica", text: "Legendas com pergunta geram 2x mais comentários do que legendas declarativas", source: "Hootsuite" },
  { emoji: "🏷️", category: "Dica", text: "Mostrar o preço diretamente no post reduz perguntas no DM em 40%" },
  { emoji: "📦", category: "Dica", text: "Oferecer frete grátis acima de um valor mínimo aumenta o ticket médio em 30%", source: "E-commerce Brasil" },
  { emoji: "🎨", category: "Dica", text: "Manter uma paleta de cores consistente no feed aumenta seguidores em 25%" },
  { emoji: "📝", category: "Dica", text: "Incluir medidas na descrição reduz trocas e devoluções em até 35%" },
  { emoji: "🤝", category: "Dica", text: "Responder DMs em até 1 hora aumenta as chances de venda em 7x", source: "Harvard Business Review" },

  // ── Tendências ──
  { emoji: "🔥", category: "Tendência", text: "Cores terrosas e tons de marrom continuam dominando as coleções em 2026" },
  { emoji: "🌿", category: "Tendência", text: "Moda sustentável e tecidos orgânicos são a maior tendência de 2026", source: "WGSN" },
  { emoji: "✨", category: "Tendência", text: "O estilo 'quiet luxury' — minimalismo sofisticado — segue em alta" },
  { emoji: "🩵", category: "Tendência", text: "Azul celeste e lavanda são as cores que mais crescem nas buscas de moda" },
  { emoji: "👟", category: "Tendência", text: "Tênis e sapatilhas com visual retrô dominam o streetwear feminino" },
  { emoji: "🪡", category: "Tendência", text: "Peças artesanais com crochê e bordado ganharam +180% em buscas" },

  // ── Psicologia de Vendas ──
  { emoji: "🧠", category: "Psicologia", text: "A cor do fundo da foto do produto influencia 62% da decisão de compra", source: "Journal of Consumer Research" },
  { emoji: "💭", category: "Psicologia", text: "Clientes decidem em 7 segundos se gostam de um produto pela foto" },
  { emoji: "❤️", category: "Psicologia", text: "Usar palavras sensoriais como 'macio' e 'fresquinho' aumenta desejo em 45%" },
  { emoji: "🏃‍♀️", category: "Psicologia", text: "Senso de urgência ('últimas peças!') aumenta conversão em 30-35%" },
  { emoji: "⭐", category: "Psicologia", text: "Avaliações com foto do cliente comprovam 65% mais credibilidade" },
  { emoji: "🪞", category: "Psicologia", text: "Clientes que se veem representados na modelo compram 4x mais", source: "McKinsey Fashion" },

  // ── Instagram & Social Tips ──
  { emoji: "📱", category: "Social", text: "Reels com música trending têm 48% mais alcance que posts estáticos", source: "Instagram @creators" },
  { emoji: "🎬", category: "Social", text: "Vídeos de 'provando a roupa' geram 5x mais salvamentos que fotos" },
  { emoji: "💬", category: "Social", text: "Stories com enquete têm 40% mais interação que stories sem" },
  { emoji: "#️⃣", category: "Social", text: "Usar entre 8 e 15 hashtags é o ponto ideal para alcance no Instagram" },
  { emoji: "🛍️", category: "Social", text: "Instagram Shopping aumenta cliques em 130% comparado a link na bio", source: "Meta Business" },
  { emoji: "📲", category: "Social", text: "WhatsApp Business com catálogo gera 45% mais conversões que só texto", source: "Meta" },
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function FashionFactsCarousel() {
  const [facts] = useState(() => shuffleArray(fashionFacts));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const nextFact = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % facts.length);
      setIsVisible(true);
    }, 300);
  }, [facts.length]);

  useEffect(() => {
    const interval = setInterval(nextFact, 5000);
    return () => clearInterval(interval);
  }, [nextFact]);

  const fact = facts[currentIndex];

  // Category color mapping
  const categoryColors: Record<string, string> = {
    Curiosidade: "var(--accent-500)",
    Dado: "var(--info)",
    Dica: "var(--success)",
    "Tendência": "var(--brand-500)",
    Psicologia: "var(--warning)",
    Social: "#8b5cf6",
  };

  return (
    <div className="fashion-facts-wrapper">
      <div
        className="fashion-fact-card"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(8px)" }}
      >
        <span className="fashion-fact-emoji">{fact.emoji}</span>
        <span
          className="fashion-fact-category"
          style={{ color: categoryColors[fact.category] || "var(--muted)" }}
        >
          {fact.category}
        </span>
        <p className="fashion-fact-text">{fact.text}</p>
        {fact.source && (
          <span className="fashion-fact-source">— {fact.source}</span>
        )}
      </div>

      {/* Progress dots */}
      <div className="fashion-fact-dots">
        {Array.from({ length: Math.min(facts.length, 6) }).map((_, i) => {
          const isActive = currentIndex % 6 === i;
          return (
            <span
              key={i}
              className="fashion-fact-dot"
              style={{
                background: isActive ? "var(--brand-500)" : "var(--border)",
                transform: isActive ? "scale(1.3)" : "scale(1)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
