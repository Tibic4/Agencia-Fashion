"use client";

/**
 * ModelPlaceholder — Preview visual instantâneo para modelos sem foto.
 *
 * Exibe silhueta feminina SVG colorizada pelo tom de pele,
 * shimmer animation premium, e badge de status contextual.
 * Substitui o spinner "Gerando..." por uma experiência visual confiável.
 */

interface ModelPlaceholderProps {
  skinTone?: string;
  bodyType?: string;
  name?: string;
  /** Se true, exibe shimmer + badge "Processando" */
  isGenerating?: boolean;
  /** Se true, exibe botão de retry */
  showRetry?: boolean;
  onRetry?: () => void;
}

const SKIN_COLORS: Record<string, { fill: string; gradient: [string, string] }> = {
  branca:       { fill: "#F5D0B5", gradient: ["#FFF5EE", "#FFE4D6"] },
  morena_clara: { fill: "#D4A574", gradient: ["#FFF0E0", "#F5DCC0"] },
  morena:       { fill: "#A67B5B", gradient: ["#F5E6D8", "#E8D0B8"] },
  negra:        { fill: "#6B4226", gradient: ["#E8D5C4", "#D4B89A"] },
};

const BODY_GRADIENTS: Record<string, [string, string]> = {
  magra:     ["#FFF0F5", "#FFE4EE"],
  media:     ["#FFF0F5", "#F5E0F0"],
  plus_size: ["#FFF5F0", "#FFE8E0"],
};

export default function ModelPlaceholder({
  skinTone = "morena_clara",
  bodyType = "media",
  name,
  isGenerating = false,
  showRetry = false,
  onRetry,
}: ModelPlaceholderProps) {
  const skin = SKIN_COLORS[skinTone] || SKIN_COLORS.morena_clara;
  const bgGradient = BODY_GRADIENTS[bodyType] || BODY_GRADIENTS.media;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: `linear-gradient(165deg, ${bgGradient[0]}, ${bgGradient[1]})`,
      }}
    >
      {/* Silhueta SVG feminina */}
      <svg
        viewBox="0 0 80 140"
        width="60%"
        height="70%"
        style={{ opacity: 0.55, maxWidth: "100px" }}
      >
        {/* Cabeça */}
        <ellipse cx="40" cy="22" rx="12" ry="14" fill={skin.fill} />
        {/* Pescoço */}
        <rect x="36" y="34" width="8" height="6" rx="2" fill={skin.fill} />
        {/* Torso (camiseta branca sugerida) */}
        <path
          d="M24 40 Q24 38 28 36 L36 36 Q40 42 44 36 L52 36 Q56 38 56 40 L58 72 Q58 74 56 74 L24 74 Q22 74 22 72 Z"
          fill="white"
          stroke={skin.fill}
          strokeWidth="0.5"
          opacity="0.85"
        />
        {/* Braços */}
        <path
          d="M24 40 L16 60 Q15 62 17 63 L20 62 L26 46"
          fill={skin.fill}
          opacity="0.9"
        />
        <path
          d="M56 40 L64 60 Q65 62 63 63 L60 62 L54 46"
          fill={skin.fill}
          opacity="0.9"
        />
        {/* Shorts (preto sugerido) */}
        <path
          d="M24 74 L22 96 Q22 97 24 97 L38 97 L40 78 L42 97 L56 97 Q58 97 58 96 L56 74 Z"
          fill="#333"
          opacity="0.7"
        />
        {/* Pernas */}
        <rect x="28" y="97" width="8" height="30" rx="3" fill={skin.fill} opacity="0.85" />
        <rect x="44" y="97" width="8" height="30" rx="3" fill={skin.fill} opacity="0.85" />
        {/* Pés */}
        <ellipse cx="32" cy="128" rx="5" ry="3" fill={skin.fill} opacity="0.7" />
        <ellipse cx="48" cy="128" rx="5" ry="3" fill={skin.fill} opacity="0.7" />
      </svg>

      {/* Shimmer overlay (animação horizontal) */}
      {isGenerating && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Badge de status */}
      <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
        {name && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.85)",
              color: "#6B4226",
              backdropFilter: "blur(4px)",
            }}
          >
            {name}
          </span>
        )}
        {isGenerating && !showRetry && (
          <span
            className="text-[9px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{
              background: "rgba(212,160,23,0.15)",
              color: "#8B6914",
              border: "1px solid rgba(212,160,23,0.3)",
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: "#D4A017",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            Processando...
          </span>
        )}
        {showRetry && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="text-[9px] font-semibold px-2.5 py-1 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{
              background: "rgba(236,72,153,0.1)",
              color: "#DB2777",
              border: "1px solid rgba(236,72,153,0.3)",
            }}
          >
            🔄 Gerar preview
          </button>
        )}
      </div>

      {/* Keyframes inline (shimmer + pulse) */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
