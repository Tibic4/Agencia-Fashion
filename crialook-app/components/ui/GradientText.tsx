/**
 * GradientText
 *
 * Why not just `<LinearGradient>` over text? RN's LinearGradient renders a
 * solid box — we need the gradient *clipped* to the glyph silhouette so the
 * text reads as the gradient itself (the editorial hero treatment used on
 * crialook.com.br/gerar). MaskedView clips the gradient layer to the
 * underlying Text node's alpha channel, giving us a pure-text gradient with
 * no extra box affordance.
 *
 * The fallback Text underneath the mask matters for screen readers: SR will
 * read the text node, while the visible mask is the painted gradient. We
 * keep accessibilityLabel pass-through so consumers can override.
 */
import { type ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle, type StyleProp } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

type GradientTuple = readonly [string, string, ...string[]];

export interface GradientTextProps {
  children: ReactNode;
  /** Gradient stops; defaults to the brand gradient. Tuple is required by expo-linear-gradient typings. */
  colors?: GradientTuple;
  /** Text style — fontSize/weight/family applied to the mask glyph. */
  style?: StyleProp<TextStyle>;
  /** Override accessibility label (otherwise SR reads the text node). */
  accessibilityLabel?: string;
  /** Gradient direction. Defaults to 135deg-ish horizontal-with-tilt to mirror the site CSS. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export function GradientText({
  children,
  colors = ['#EC4899', '#D946EF', '#A855F7'] as const,
  style,
  accessibilityLabel,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
}: GradientTextProps) {
  // Why hide the masked Text? It only exists to define the alpha clip — the
  // gradient is what the user sees. Color must still be opaque for the mask
  // to register on Android.
  return (
    <MaskedView
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      maskElement={
        <Text style={[style, styles.maskText]} allowFontScaling>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors as unknown as readonly [string, string, ...string[]]}
        start={start}
        end={end}
      >
        {/* invisible text sets the LinearGradient's intrinsic size to match the mask */}
        <Text style={[style, styles.transparentText]} allowFontScaling>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  // backgroundColor must be opaque-ish for the mask to capture glyph alpha on Android
  maskText: { backgroundColor: 'transparent', color: '#000' },
  transparentText: { opacity: 0 },
});
