/**
 * Typography presets — single source of truth for text styles.
 *
 * Mirrors the marketing site's typographic rhythm:
 *   - Display headings (h1, h2): Inter 700/800, tight tracking (-0.5).
 *   - Body: Inter 400, line-height 1.5.
 *   - Kicker (uppercase labels): Inter 600, +0.5 tracking.
 *   - Caption: Inter 400, smaller line-height.
 *
 * Why presets instead of inline styles:
 *   - Avoids drift (one place to bump a size for the whole app).
 *   - Reads like the design system: `<Text style={[fonts.h2, { color: ... }]}>`.
 *   - Letter-spacing is the part that's most often forgotten — bake it in.
 *
 * Usage:
 *   import { fonts } from '@/lib/fonts';
 *   <Text style={[fonts.h1, { color: colors.text }]}>...</Text>
 */
import { StyleSheet, type TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

const presets = StyleSheet.create({
  // Display — used for screen titles ("Suas fotos ficaram incríveis!")
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  h3: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  // Body
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySemibold: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  // Caption — secondary info
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  captionMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  // Kicker — uppercase eyebrow labels
  kicker: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },
  // Button label (matches Button.tsx primaryText)
  button: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  buttonSm: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  // Tab label
  tab: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    letterSpacing: -0.2,
  },
  // Numeric mono — for timers, counters, prices
  mono: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    letterSpacing: 0.3,
  },
});

export const fonts = presets;
