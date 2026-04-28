/**
 * AnimatedPressable — spring-scale wrapper around Pressable
 *
 * Why a dedicated component (vs ad-hoc `useSharedValue` per screen)?
 *   1. Consistency: every tappable surface in the app springs the same way
 *      (mass 0.4, damping 15) → muscle memory, "feels like one product".
 *   2. Cheap to scale: 60 cards in a list each get a private shared value;
 *      worklet animations cost ~0 JS thread time, so this is free.
 *   3. Haptic colocation: tapping is *the* haptic moment. Centralizing
 *      haptic+animation removes the "did I forget the haptic on this card?"
 *      review burden.
 *
 * API:
 *   <AnimatedPressable scale={0.96} damping={15} mass={0.4} haptic="tap" onPress={...}>
 *
 * Notes:
 *   - `haptic` accepts the semantic kinds from `lib/haptics.ts`, or `false`
 *     to silence (e.g., when a parent already fires haptic).
 *   - We fire haptic on *press in* (not press out): iOS HIG recommends
 *     immediate confirmation that the touch was registered.
 *   - Disabled pressables don't animate or vibrate — silence is the signal.
 */
import { forwardRef } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { fireHaptic, type HapticKind } from '@/lib/haptics';

type Props = Omit<PressableProps, 'style'> & {
  /** Final scale value when pressed in. Default 0.96. */
  scale?: number;
  /** Spring damping (higher = less bounce). Default 15. */
  damping?: number;
  /** Spring mass (lower = snappier). Default 0.4. */
  mass?: number;
  /** Semantic haptic to fire on press in, or `false` to disable. */
  haptic?: HapticKind | false;
  /** Pressable style. Functional form not supported (animated wrapper takes over). */
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export const AnimatedPressable = forwardRef<View, Props>(
  function AnimatedPressable(
    {
      scale = 0.96,
      damping = 15,
      mass = 0.4,
      haptic = 'tap',
      onPressIn,
      onPressOut,
      disabled,
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const sv = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: sv.value }],
    }));

    const handlePressIn = (e: GestureResponderEvent) => {
      if (disabled) return;
      sv.value = withSpring(scale, { mass, damping });
      fireHaptic(haptic);
      onPressIn?.(e);
    };

    const handlePressOut = (e: GestureResponderEvent) => {
      sv.value = withSpring(1, { mass, damping });
      onPressOut?.(e);
    };

    return (
      <AnimatedPressableBase
        ref={ref}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[style, animatedStyle]}
        {...rest}
      >
        {children as React.ReactNode}
      </AnimatedPressableBase>
    );
  },
);
