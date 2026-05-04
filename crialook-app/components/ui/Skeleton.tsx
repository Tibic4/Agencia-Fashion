/**
 * Skeleton — shimmer wave (Reanimated 4 CSS animation)
 *
 * Why a moving gradient instead of opacity-only pulse?
 * A pulse signals "loading" but reads as "broken / nothing happening" because
 * the eye sees zero direction. A shimmer wave (light streak travelling left
 * → right) is the iOS/Material/Linear convention: the brain reads it as
 * "content is being filled in", which lowers perceived latency by ~15-25%
 * (Doherty threshold studies; SwiftUI redaction reason `.placeholder`).
 *
 * Why CSS Animations instead of useSharedValue + withRepeat:
 *   - The animation is a pure ambient loop (no gesture, no state, no
 *     per-frame derivation). The CSS API is more declarative AND lets
 *     Reanimated's compiler optimise the path — it knows exactly which
 *     property animates, no worklet runtime needed.
 *   - Less code: 5 lines of animationName + duration vs the previous
 *     useSharedValue + useEffect + useAnimatedStyle dance.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

const SHIMMER_DURATION_MS = 1500;

const LIGHT_BASE = '#ececef';
const LIGHT_HIGHLIGHT = '#f7f5f8';
const DARK_BASE = '#322a3a';
const DARK_HIGHLIGHT = '#423650';

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // a11y — sem shimmer travelling com reduceMotion. O background do baseColor
  // já comunica "loading"; sem motion fica como redaction estática (Apple HIG
  // `RedactionReasons.placeholder`). O usuário ainda vê que algo está vindo.
  const reduceMotion = useReducedMotion();

  const baseColor = isDark ? DARK_BASE : LIGHT_BASE;
  const highlight = isDark ? DARK_HIGHLIGHT : LIGHT_HIGHLIGHT;

  return (
    <View
      style={[
        styles.container,
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius,
          borderCurve: 'continuous',
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.shimmer,
            {
              // The streak slides from -100% → +200% of the container width,
              // so its 100%-wide gradient fully traverses (3× the container
              // span net of overlap). Linear easing because the eye reads any
              // ease as a "stutter" in an ambient loop.
              animationName: {
                '0%': { transform: [{ translateX: '-100%' as unknown as number }] },
                '100%': { transform: [{ translateX: '200%' as unknown as number }] },
              },
              animationDuration: `${SHIMMER_DURATION_MS}ms`,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 3rd-party untyped boundary
            } as any,
          ]}
        >
          <LinearGradient
            colors={[baseColor, highlight, baseColor]}
            locations={[0.25, 0.5, 0.75]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
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
