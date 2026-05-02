/**
 * Design tokens — aligned with the marketing site (crialook.com.br).
 *
 * Source of truth: `campanha-ia/src/app/globals.css` (overhaul 2026-04-26/27).
 *
 * Why these specific values:
 *   - Background is NOT pure white (#fff) or pure black (#000). The site
 *     overhaul learned that pure black creates an "island effect" where
 *     gradient cards look like patches glued onto the canvas. Off-white
 *     (#faf9fa) and warm-grey (#16131a) let the cards "breathe" with the
 *     surrounding canvas, no visible transition.
 *   - Surface gradient ENDS at the background colour, not above it. That's
 *     what makes the bottom edge of a card dissolve into the canvas instead
 *     of forming a hard line between adjacent cards.
 *   - Border in light is barely visible (#f3f1f5). The shadow does the work
 *     of elevating the card; a hard border looks dated.
 *   - Border in dark stays neutral (#2c2730) — no purple tint that would
 *     fight the brand gradient.
 *
 * Reference (site globals.css):
 *   --background: #faf9fa (light) / #16131a (dark)
 *   --surface: #ffffff (light) / #1f1a25 (dark)
 *   --surface-gradient: linear-gradient(165deg, surfaceTop, surfaceBottom)
 *   --border: #f3f1f5 (light) / #2c2730 (dark)
 *   --gradient-brand: linear-gradient(135deg, #ec4899, #d946ef, #a855f7)
 */
const brand = {
  // Primary palette — fuchsia, matches site --brand-500/600
  primary: '#D946EF',
  primaryLight: '#E879F9',
  primaryDark: '#A21CAF',
  // Hot pink — same role as site --gradient-brand start
  secondary: '#EC4899',
  // Violet — gradient end + accent
  violet: '#A855F7',
  // Functional
  accent: '#F59E0B',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  // Gradients matching the site --gradient-brand exactly
  gradientPrimary: ['#EC4899', '#D946EF', '#A855F7'] as const,
  gradientSecondary: ['#F472B6', '#EC4899'] as const,
  // Surface gradients per scheme — the value of `end` is intentionally
  // the same as `colors.background` for that scheme so the card's bottom
  // dissolves into the canvas (no visible seam between adjacent cards).
  surfaceGradientLight: ['#ffffff', '#faf9fa'] as readonly [string, string],
  surfaceGradientDark: ['#211b27', '#1a151f'] as readonly [string, string],
  // Glow used for selected states / focused inputs — three intensities
  // map to the three shadow layers on the site (1px → 4-5px → 24px).
  glow: 'rgba(217,70,239,0.35)',
  glowStrong: 'rgba(217,70,239,0.28)',
  glowMid: 'rgba(217,70,239,0.18)',
  glowSoft: 'rgba(217,70,239,0.12)',
  // Violet glass — translucent overlay using the canonical brand violet
  // (#A855F7 = rgba(168,85,247,…)) at 12% alpha. Replaces ad-hoc
  // rgba(124,58,237,…) (=#7C3AED) which was off-palette and read as a
  // colder violet on the result screen vs the rest of the app.
  violetGlass: 'rgba(168,85,247,0.12)',
};

export default {
  brand,
  light: {
    text: '#1a1620',
    textSecondary: '#636369',
    background: '#faf9fa',
    backgroundSecondary: '#f7f4f8',
    tint: brand.primary,
    border: '#f3f1f5',
    borderHover: '#d4d4d8',
    borderGlow: 'rgba(217,70,239,0.18)',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: brand.primary,
    card: '#FFFFFF',
    cardElevated: '#fdfcfd',
    surface2: '#f7f4f8',
    glass: 'rgba(250,249,250,0.78)',
    glassStrong: 'rgba(250,249,250,0.92)',
    overlay: 'rgba(15,5,25,0.5)',
    surfaceGradient: brand.surfaceGradientLight,
    // Semantic shadow tokens — used by Card and floating containers
    shadowCard: '#0F0519',
    shadowAmbient: 'rgba(15,5,25,0.08)',
  },
  dark: {
    text: '#f5f3f7',
    textSecondary: '#a1a1aa',
    // Warm-dark instead of pure black — paper-on-desk effect with cards
    background: '#16131a',
    backgroundSecondary: '#1c1722',
    tint: brand.primaryLight,
    border: '#322a3a',
    borderHover: '#423650',
    borderGlow: 'rgba(217,70,239,0.28)',
    tabIconDefault: '#52525B',
    tabIconSelected: brand.primaryLight,
    card: '#1f1a25',
    cardElevated: '#261f2d',
    surface2: '#261f2d',
    glass: 'rgba(22,19,26,0.78)',
    glassStrong: 'rgba(22,19,26,0.92)',
    overlay: 'rgba(0,0,0,0.65)',
    surfaceGradient: brand.surfaceGradientDark,
    shadowCard: '#000',
    shadowAmbient: 'rgba(0,0,0,0.6)',
  },
};
