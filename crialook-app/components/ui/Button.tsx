/**
 * Button — production-grade CTA, parity with site `.btn-primary`.
 *
 * Reference: Stripe / Linear / Vercel button patterns.
 *
 * The depth comes from FIVE layered surfaces, not a single gradient:
 *   1. Base brand gradient (#EC4899 → #D946EF → #A855F7)
 *   2. Top reflection — 12% white fading over the upper half (light from above)
 *   3. Inset highlight — 1 px white at 18% opacity along the very top edge
 *   4. Inset shade — 1 px black at 8% opacity along the very bottom edge
 *   5. Press darken overlay — black 10% that fades in only while pressed,
 *      simulating "brightness down" without RN filters
 *
 * Plus three drop-shadow layers for the brand halo (compressed into one
 * RN shadow because RN can't stack multiple shadows on a single View — we
 * compensate with a 14 px radius and high opacity to approximate the mid
 * + ambient layers from the web spec).
 *
 * Disabled state is desaturated, NOT greyed out, by overlaying 45% white
 * (preserving the brand identity). This matches Apple's HIG guidance and
 * the site's `filter: saturate(0.55) opacity(0.55)`.
 *
 * Shimmer is one-shot: when transitioning disabled → enabled, a single
 * 1.5 s sweep plays and stops. No casino-button perpetual loops.
 */
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  cancelAnimation,
  useReducedMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { haptic } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Plays a single shimmer sweep when transitioning disabled → enabled. */
  shimmerOnEnable?: boolean;
  /** Override default semantic haptic. Pass `false` to silence. */
  haptic?: 'selection' | 'tap' | 'press' | 'confirm' | 'success' | 'warning' | 'error' | false;
  style?: ViewStyle;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Smaller variant — for tertiary CTAs. */
  size?: 'md' | 'sm';
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const SHIMMER_DURATION = 1500;
const SPRING_PRESS = { mass: 0.5, damping: 15 } as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  shimmerOnEnable = false,
  haptic: hapticKind = 'press',
  style,
  leadingIcon,
  trailingIcon,
  size = 'md',
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const isDark = scheme === 'dark';
  const isDisabled = !!disabled || !!loading;
  const reducedMotion = useReducedMotion();

  const scale = useSharedValue(1);
  const pressOverlay = useSharedValue(0);
  const shimmerProgress = useSharedValue(0);
  const wasDisabled = useRef(isDisabled);

  // One-shot shimmer when disabled → enabled
  useEffect(() => {
    if (!shimmerOnEnable || reducedMotion) {
      cancelAnimation(shimmerProgress);
      shimmerProgress.value = 0;
      wasDisabled.current = isDisabled;
      return;
    }
    if (wasDisabled.current && !isDisabled) {
      shimmerProgress.value = 0;
      shimmerProgress.value = withTiming(1, {
        duration: SHIMMER_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }
    wasDisabled.current = isDisabled;
  }, [isDisabled, shimmerOnEnable, shimmerProgress, reducedMotion]);

  const handlePressIn = () => {
    if (reducedMotion) return;
    scale.value = withSpring(0.96, SPRING_PRESS);
    pressOverlay.value = withTiming(0.10, { duration: 80 });
  };
  const handlePressOut = () => {
    if (reducedMotion) {
      pressOverlay.value = 0;
      return;
    }
    scale.value = withSpring(1, SPRING_PRESS);
    pressOverlay.value = withTiming(0, { duration: 200 });
  };

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const pressOverlayStyle = useAnimatedStyle(() => ({
    opacity: pressOverlay.value,
  }));
  const shimmerStyle = useAnimatedStyle(() => {
    const tx = interpolate(shimmerProgress.value, [0, 1], [-1, 1]);
    return {
      transform: [{ translateX: `${tx * 100}%` }],
      opacity: interpolate(shimmerProgress.value, [0, 0.2, 0.8, 1], [0, 0.55, 0.55, 0]),
    };
  });

  const padding = size === 'sm' ? styles.padSmall : styles.padDefault;
  const minH = size === 'sm' ? 44 : 56;
  const fontSize = size === 'sm' ? 14 : 16;
  const radiusPill = 9999;

  const a11yProps = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: accessibilityLabel ?? title,
    accessibilityHint,
    accessibilityState: { disabled: isDisabled, busy: !!loading },
  };

  const fireHaptic = () => {
    if (!hapticKind) return;
    if (hapticKind in haptic) (haptic as Record<string, () => void>)[hapticKind]();
  };

  // Primary -------------------------------------------------------------------
  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={() => { fireHaptic(); onPress(); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        {...a11yProps}
        style={[
          styles.outerPrimary,
          { borderRadius: radiusPill, minHeight: minH },
          containerAnimStyle,
          isDisabled && { opacity: 0.55 },
          style,
        ]}
      >
        <View style={[styles.innerPrimary, { borderRadius: radiusPill, minHeight: minH }]}>
          {/* 1. Base brand gradient */}
          <LinearGradient
            colors={Colors.brand.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* 2. Top reflection — light from above */}
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
            locations={[0, 0.5]}
            style={[StyleSheet.absoluteFill, { height: '50%' }]}
          />
          {/* 3. Inset highlight — top edge */}
          <View pointerEvents="none" style={styles.insetHighlightTop} />
          {/* 4. Inset shade — bottom edge */}
          <View pointerEvents="none" style={styles.insetShadeBottom} />
          {/* 5. Shimmer streak (one-shot) */}
          {shimmerOnEnable && !reducedMotion && (
            <AnimatedLinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              locations={[0.3, 0.5, 0.7]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[StyleSheet.absoluteFill, shimmerStyle]}
            />
          )}
          {/* Press darken overlay */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, pressOverlayStyle]}
          />
          {/* Disabled desaturate overlay */}
          {isDisabled && !loading && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.45)' }]}
            />
          )}
          {/* Content */}
          <View style={[styles.contentRow, padding]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                {leadingIcon}
                <Text style={[styles.primaryText, { fontSize }]} numberOfLines={1}>{title}</Text>
                {trailingIcon}
              </>
            )}
          </View>
        </View>
      </AnimatedPressable>
    );
  }

  // Secondary -----------------------------------------------------------------
  if (variant === 'secondary') {
    return (
      <AnimatedPressable
        onPress={() => { fireHaptic(); onPress(); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        {...a11yProps}
        style={[
          styles.outerNeutral,
          {
            minHeight: minH,
            borderRadius: radiusPill,
            borderColor: colors.border,
          },
          isDark && styles.darkAmbient,
          containerAnimStyle,
          isDisabled && { opacity: 0.5 },
          style,
        ]}
      >
        <LinearGradient
          colors={colors.surfaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radiusPill }]}
        />
        {isDark && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: radiusPill,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: 'rgba(255,255,255,0.06)',
              },
            ]}
          />
        )}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#000' : '#000' }, pressOverlayStyle]}
        />
        <View style={[styles.contentRow, padding]}>
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              {leadingIcon}
              <Text style={[styles.neutralText, { fontSize, color: colors.text }]} numberOfLines={1}>{title}</Text>
              {trailingIcon}
            </>
          )}
        </View>
      </AnimatedPressable>
    );
  }

  // Outline -------------------------------------------------------------------
  if (variant === 'outline') {
    return (
      <AnimatedPressable
        onPress={() => { fireHaptic(); onPress(); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        {...a11yProps}
        style={[
          styles.outerNeutral,
          {
            minHeight: minH,
            borderRadius: radiusPill,
            borderColor: colors.border,
            backgroundColor: 'transparent',
          },
          containerAnimStyle,
          isDisabled && { opacity: 0.5 },
          style,
        ]}
      >
        <View style={[styles.contentRow, padding]}>
          {leadingIcon}
          <Text style={[styles.neutralText, { fontSize, color: colors.text }]} numberOfLines={1}>{title}</Text>
          {trailingIcon}
        </View>
      </AnimatedPressable>
    );
  }

  // Ghost ---------------------------------------------------------------------
  if (variant === 'ghost') {
    return (
      <AnimatedPressable
        onPress={() => { fireHaptic(); onPress(); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        {...a11yProps}
        style={[
          {
            minHeight: minH,
            borderRadius: radiusPill,
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          },
          containerAnimStyle,
          isDisabled && { opacity: 0.5 },
          style,
        ]}
      >
        <View style={[styles.contentRow, padding]}>
          {leadingIcon}
          <Text style={[styles.neutralText, { fontSize, color: Colors.brand.primary }]} numberOfLines={1}>{title}</Text>
          {trailingIcon}
        </View>
      </AnimatedPressable>
    );
  }

  // Glass — used in floating contexts (e.g. sticky CTA over imagery)
  return (
    <AnimatedPressable
      onPress={() => { fireHaptic(); onPress(); }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      {...a11yProps}
      style={[
        styles.outerNeutral,
        {
          minHeight: minH,
          borderRadius: radiusPill,
          borderColor: colors.border,
          backgroundColor: colors.glass,
        },
        containerAnimStyle,
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      <View style={[styles.contentRow, padding]}>
        {leadingIcon}
        <Text style={[styles.neutralText, { fontSize, color: colors.text }]} numberOfLines={1}>{title}</Text>
        {trailingIcon}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  outerPrimary: {
    width: '100%',
    // 3-layer shadow approximated as a tighter, fuchsia-tinted drop shadow.
    // RN doesn't stack shadows on a single View; this is the best compromise.
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  },
  innerPrimary: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerNeutral: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkAmbient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
  insetHighlightTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  insetShadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  padDefault: {
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  padSmall: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primaryText: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.08)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  neutralText: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
  },
});
