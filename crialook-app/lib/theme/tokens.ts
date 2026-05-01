/**
 * Design tokens — não-cor (tokens de cor ficam em `constants/Colors.ts`).
 *
 * `Colors.ts` já encoda a paleta de marca + gradientes de surface por
 * scheme. Spacing/radii/typography/timing estavam espalhados como números
 * inline pelas telas — esse arquivo centraliza num source of truth pro
 * ritmo visual.
 *
 * Os números seguem grid 4px (spacing) + type ramp escalado:
 *   - Grid 4px: bate com Material 3 dp + iOS HIG 4pt → feel cross-platform.
 *   - Type ramp: minor-third (1.2×), cap em displayXL=34 pra hero grande
 *     não overflowar em Android pequeno (Galaxy S22 narrow).
 *   - Radii ramp: capsule (full=9999) NÃO leva `borderCurve: continuous`
 *     pq superellipse só faz sentido em rect não-circular.
 */

export const spacing = {
  /** 2 — gap hairline em rows densas */
  xxs: 2,
  /** 4 — gap tight de ícone/texto */
  xs: 4,
  /** 8 — padding de chip, gap de list-row */
  sm: 8,
  /** 12 — gap confortável entre elementos dentro de card */
  md: 12,
  /** 16 — padding de card, padding de borda de tela */
  lg: 16,
  /** 20 — respiro de seção (paritário com /historico) */
  xl: 20,
  /** 24 — blocos hero, padding de modal */
  xxl: 24,
  /** 32 — seções maiores, respiro de splash */
  xxxl: 32,
  /** 48 — centro vertical de empty state */
  huge: 48,
} as const;

export const radii = {
  /** 4 — baseline de input, pills inline (não capsule) */
  xs: 4,
  /** 8 — chips pequenos */
  sm: 8,
  /** 12 — botões, inputs */
  md: 12,
  /** 14 — cards (paritário com lista de campanhas) */
  lg: 14,
  /** 16 — card editorial primário */
  xl: 16,
  /** 20 — sheets, modais */
  xxl: 20,
  /** 24 — hero / card de paywall */
  xxxl: 24,
  /** 9999 — capsule. NUNCA `borderCurve: 'continuous'` aqui — círculo não é superellipse. */
  full: 9999,
} as const;

/**
 * Type ramp — Inter carregada em 400/500/600/700.
 * Line heights pensadas: ~1.45 pra body (15-16), tighter pra display.
 */
export const fontSize = {
  /** 11 — labels de pill, status dots */
  xs: 11,
  /** 12 — meta / caption / versão */
  sm: 12,
  /** 13 — body pequeno / footer / label de divider */
  md: 13,
  /** 14 — body secundário, button label small */
  base: 14,
  /** 15 — body primário, título de list-row */
  lg: 15,
  /** 16 — input / body em destaque */
  xl: 16,
  /** 18 — heading de seção */
  xxl: 18,
  /** 20 — nome de card / nome de plano */
  xxxl: 20,
  /** 24 — subtítulo hero */
  display: 24,
  /** 28 — título hero (paritário com /historico, /plano) */
  displayLg: 28,
  /** 34 — splash / hero maior */
  displayXl: 34,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  /** Usa com parcimônia — só pra ênfase onde já mora um 700 */
  black: '800',
} as const;

export const lineHeight = {
  /** 1.0 — só pra display (contadores, números grandes) */
  none: 1.0,
  /** 1.2 — títulos hero, headings tight */
  tight: 1.2,
  /** 1.35 — títulos de seção */
  snug: 1.35,
  /** 1.45 — body default */
  normal: 1.45,
  /** 1.6 — descrições longas, legal */
  relaxed: 1.6,
} as const;

/** Timings de animação em ms. Usa o slot nomeado, não o número cru. */
export const durations = {
  /** 80 — micro feedback (chip select, checkbox) */
  micro: 80,
  /** 150 — transições rápidas (fade, snap) */
  fast: 150,
  /** 200 — transição padrão (drawer, sheet abrindo) */
  base: 200,
  /** 300 — fade-in de card, entrada de list item */
  slow: 300,
  /** 400 — elemento de stagger hero */
  slower: 400,
  /** 600 — transição de step de onboarding */
  slowest: 600,
  /** 1200 — pulse, breathing */
  pulse: 1200,
  /** 1600 — loop ambient lento (badge respirando) */
  ambient: 1600,
} as const;

/**
 * Strings de easing — Reanimated 4 só aceita os 7 nomes predefinidos no CSS
 * Animations API (não parseia `cubic-bezier(...)` literal). Curvas Material 3
 * mapeadas pros equivalentes mais próximos: standard/decelerate ≈ ease-out,
 * accelerate ≈ ease-in, emphasized ≈ ease-in-out.
 * `springs` (abaixo) é pra `withSpring` imperativo (config worklet).
 */
export const easings = {
  /** Material 3 standard — decelerate-ish, pra motion geral */
  standard: 'ease-out',
  /** Decelerate — elementos entrando na tela */
  decelerate: 'ease-out',
  /** Accelerate — elementos saindo da tela */
  accelerate: 'ease-in',
  /** Emphasized — transições hero/importantes */
  emphasized: 'ease-in-out',
  /** Linear — loops ambient (shimmer wave) */
  linear: 'linear',
  /** EaseInOut — breathing / pulse */
  easeInOut: 'ease-in-out',
} as const;

/**
 * Presets de spring pra worklet Reanimated. Usa em
 * `withSpring(value, springs.X)` em vez de inventar config por componente.
 * Nomes seguem Apple HIG.
 */
export const springs = {
  /** Press scale — snappy, sem bounce */
  snappy: { mass: 0.4, damping: 15 } as const,
  /** Default — pouso gentil */
  smooth: { mass: 0.5, damping: 18 } as const,
  /** Modal / sheet — bounce leve */
  bouncy: { mass: 0.7, damping: 14 } as const,
  /** Entrada hero — bounce pronunciado */
  expressive: { mass: 0.8, damping: 12 } as const,
} as const;

/**
 * Presets de shadow — níveis semânticos. Usa o `boxShadow` em string (não
 * `shadowOffset`/`shadowOpacity` legacy) pra render consistente em iOS +
 * Android + web.
 */
export const shadows = {
  /** Hairline — separação quase invisível (card em light mode) */
  none: 'none',
  /** Sutil — list row, chip */
  xs: '0 1px 2px rgba(15, 5, 25, 0.05)',
  /** Soft — card em estado de repouso */
  sm: '0 4px 10px rgba(15, 5, 25, 0.06)',
  /** Médio — card hovered, dropdown */
  md: '0 8px 20px rgba(15, 5, 25, 0.10)',
  /** Alto — sheet, modal */
  lg: '0 12px 32px rgba(15, 5, 25, 0.18)',
  /** Brand glow — selected state (usa com `boxShadow` + tint de marca) */
  brandGlow: '0 0 16px rgba(217, 70, 239, 0.32)',
} as const;

/**
 * Helper de estilo: retorna `{ borderRadius: r, borderCurve: 'continuous' }`.
 *
 * Superellipse Apple (curvatura contínua) lê como mais refinado que canto
 * circular — perceptível em retina/high-DPI. iOS suporta nativo; RN passa
 * direto pro native shadow path. Android pré-12 no-op (canto circular normal).
 *
 * Não usa pra capsule (`borderRadius: 9999` / `radii.full`) — círculo
 * perfeito não pode ser superellipse por definição.
 */
export function rounded(borderRadius: number) {
  return { borderRadius, borderCurve: 'continuous' as const };
}

/** Presets de hit slop — Apple HIG 44pt min, Material 48dp min. */
export const hitSlops = {
  /** Usa em botões icon-only */
  small: { top: 8, bottom: 8, left: 8, right: 8 } as const,
  /** Usa em links inline / chevrons */
  medium: { top: 12, bottom: 12, left: 12, right: 12 } as const,
  /** Quando o target é sub-32pt e precisa de alcance */
  large: { top: 16, bottom: 16, left: 16, right: 16 } as const,
} as const;

/**
 * Re-export agrupado — `import { tokens } from '@/lib/theme/tokens'` pra
 * callers que querem um namespace só.
 */
export const tokens = {
  spacing,
  radii,
  fontSize,
  fontWeight,
  lineHeight,
  durations,
  easings,
  springs,
  shadows,
  hitSlops,
} as const;

export default tokens;
