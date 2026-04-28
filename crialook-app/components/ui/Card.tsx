/**
 * Card — Editorial Premium surface (RN parity with site `.surface-card`).
 *
 * Why this shape:
 *   - The surface is a `LinearGradient` from `colors.surfaceGradient[0]` to
 *     `colors.surfaceGradient[1]`. The end stop is intentionally equal to
 *     `colors.background` for that scheme, so the card's bottom edge
 *     dissolves into the canvas. This kills the "island" effect we hit on
 *     the web when adjacent cards revealed a sharp seam between them.
 *   - In dark, we layer an inset highlight (top + left hairline at 4%
 *     white) and a subtle brand halo (32px radius, 8% fuchsia) — same
 *     trick used by the site for its dark-mode surface card.
 *   - In light, the site has `box-shadow: none` because pure-white insets
 *     on a near-white card are imperceptible AND the off-white background
 *     plus the gradient already do the elevation work. We follow the same
 *     rule here: light = no shadow, just gradient + hairline border.
 *
 * Variants:
 *   - default: standard editorial card (radius-lg = 16, padding 16)
 *   - glass:   BlurView-backed translucent surface (used over imagery)
 *   - hero:    larger radius + brand-tinged shadow (Suas fotos / paywalls)
 *
 * `interactive` adds a hover/press shadow ramp via Reanimated for cards
 * that act as buttons (history items, model cards, etc.).
 */
import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { PropsWithChildren } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Variant = 'default' | 'glass' | 'hero';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  variant?: Variant;
  /** Removes the default 16 px padding when you need full-bleed content. */
  noPadding?: boolean;
  /** Highlights the card with a brand glow (use for "selected" states). */
  selected?: boolean;
  /** When true, wraps in Pressable + adds hover/press elevation. */
  interactive?: boolean;
  /** Forward Pressable props when `interactive` is true. */
  onPress?: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress'];
  accessibilityLabel?: string;
  accessibilityHint?: string;
}>;

const SPRING_CFG = { mass: 0.5, damping: 18 } as const;

export function Card({
  children,
  style,
  variant = 'default',
  noPadding = false,
  selected = false,
  interactive = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';

  const radius = variant === 'hero' ? 24 : 16;
  const padding = noPadding ? 0 : 16;

  const innerContentStyle = useMemo<ViewStyle>(
    () => ({ padding, position: 'relative' }),
    [padding],
  );

  const baseShadow = useMemo<ViewStyle>(() => {
    if (selected) {
      return {
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isDark ? 0.45 : 0.22,
        shadowRadius: 16,
        elevation: 12,
      };
    }
    if (variant === 'hero') {
      return {
        shadowColor: Colors.brand.primary,
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: isDark ? 0.32 : 0.18,
        shadowRadius: 60,
        elevation: 16,
      };
    }
    if (isDark) {
      return {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.55,
        shadowRadius: 40,
        elevation: 10,
      };
    }
    // Light: shadow is intentionally absent — gradient + border do the work
    return {};
  }, [isDark, variant, selected]);

  // Glass variant — BlurView surface, no gradient
  if (variant === 'glass') {
    return (
      <View style={[styles.cardBase, { borderRadius: radius, borderColor: colors.border }, baseShadow, style]}>
        <BlurView
          intensity={isDark ? 30 : 50}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        />
        <View style={innerContentStyle}>{children}</View>
      </View>
    );
  }

  const surfaceContent = (
    <>
      <LinearGradient
        colors={colors.surfaceGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
      />
      {/* Inset highlight — only meaningful in dark (white insets vanish on
          a near-white surface in light). */}
      {isDark && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(255,255,255,0.04)',
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderLeftColor: 'rgba(255,255,255,0.02)',
            },
          ]}
        />
      )}
      {/* Brand halo overlay for "selected" states */}
      {selected && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius,
              borderWidth: 1,
              borderColor: Colors.brand.primary,
            },
          ]}
        />
      )}
      <View style={innerContentStyle}>{children}</View>
    </>
  );

  if (interactive) {
    return (
      <InteractiveCard
        radius={radius}
        borderColor={selected ? Colors.brand.primary : colors.border}
        baseShadow={baseShadow}
        style={style}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {surfaceContent}
      </InteractiveCard>
    );
  }

  return (
    <View
      style={[
        styles.cardBase,
        { borderRadius: radius, borderColor: selected ? 'transparent' : colors.border },
        baseShadow,
        style,
      ]}
    >
      {surfaceContent}
    </View>
  );
}

// ---------- Interactive wrapper ----------------------------------------------
interface InteractiveProps extends PropsWithChildren<{
  radius: number;
  borderColor: string;
  baseShadow: ViewStyle;
  style?: StyleProp<ViewStyle>;
  onPress?: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress'];
  accessibilityLabel?: string;
  accessibilityHint?: string;
}> {}

function InteractiveCard({
  children,
  radius,
  borderColor,
  baseShadow,
  style,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}: InteractiveProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, baseShadow, style]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => { scale.value = withSpring(0.985, SPRING_CFG); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING_CFG); }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[styles.cardBase, { borderRadius: radius, borderColor }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
