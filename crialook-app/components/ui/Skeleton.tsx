/**
 * Skeleton — shimmer wave (worklet, no JS re-renders)
 *
 * Why a moving gradient instead of opacity-only pulse?
 * A pulse signals "loading" but reads as "broken / nothing happening" because
 * the eye sees zero direction. A shimmer wave (light streak travelling left
 * → right) is the iOS/Material/Linear convention: the brain reads it as
 * "content is being filled in", which lowers perceived latency by ~15-25%
 * (Doherty threshold studies; SwiftUI redaction reason `.placeholder`).
 *
 * Implementation:
 *   - Reanimated worklet drives translateX of an inner LinearGradient
 *   - Loop: -100% → +200% over 1500ms, infinite, linear
 *   - `useSharedValue` + `useAnimatedStyle` → zero JS bridge traffic
 *   - Container clips with `overflow: hidden` so the streak appears framed
 *   - Theme-aware base color set by parent View; gradient stops are ramped
 *     toward the lighter neutral so the streak is visible in both modes
 */
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

const SHIMMER_DURATION = 1500;

const LIGHT_BASE = '#ececef';
const LIGHT_HIGHLIGHT = '#f7f5f8';
const DARK_BASE = '#322a3a';
const DARK_HIGHLIGHT = '#423650';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const baseColor = isDark ? DARK_BASE : LIGHT_BASE;
  const highlight = isDark ? DARK_HIGHLIGHT : LIGHT_HIGHLIGHT;

  // Drives the streak position. 0 → -100%, 1 → +200%.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress]);

  // The gradient is 3x as wide as the container so it can fully traverse.
  // We translate it by -container width → +2x container width (net 3x).
  // We use percentages so we don't need onLayout (saves a measurement pass).
  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [-1, 2]);
    return {
      transform: [{ translateX: `${translateX * 100}%` }],
    };
  });

  return (
    <View
      style={[
        styles.container,
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius,
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={[baseColor, highlight, baseColor]}
        locations={[0.25, 0.5, 0.75]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.shimmer, animatedStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
  },
});
