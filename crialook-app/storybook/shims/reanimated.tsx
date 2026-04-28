/**
 * Web shim for react-native-reanimated.
 *
 * Stories don't need real animations — they need the components to mount
 * without crashing. So:
 *  - Animated.View / Animated.Text / Animated.createAnimatedComponent map to
 *    the underlying RN component (or its target).
 *  - Hooks return inert refs.
 *  - Entering/exiting animations are no-ops.
 */
import React from 'react';
import { View, Text, type ViewProps, type TextProps } from 'react-native';

const passthroughEntering = {
  delay: () => passthroughEntering,
  duration: () => passthroughEntering,
  springify: () => passthroughEntering,
};

const dummy = () => passthroughEntering;
export const FadeIn = passthroughEntering;
export const FadeInDown = passthroughEntering;
export const FadeInUp = passthroughEntering;
export const FadeInRight = passthroughEntering;
export const FadeOutLeft = passthroughEntering;

function makeAnimated<T extends React.ComponentType<any>>(Comp: T): T {
  // Strip animation-only props before forwarding.
  return ((props: any) => {
    const { entering, exiting, layout, ...rest } = props;
    return <Comp {...rest} />;
  }) as unknown as T;
}

const AnimatedView = makeAnimated(
  React.forwardRef<unknown, ViewProps>((props, ref) => <View {...(props as any)} ref={ref as any} />),
);
const AnimatedText = makeAnimated(
  React.forwardRef<unknown, TextProps>((props, ref) => <Text {...(props as any)} ref={ref as any} />),
);

const Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  createAnimatedComponent: <T extends React.ComponentType<any>>(C: T) => makeAnimated(C),
};

export default Animated;
export { Animated };

// Hooks
export function useSharedValue<T>(initial: T) {
  return { value: initial };
}
export function useAnimatedStyle<T>(_fn: () => T) {
  return {};
}
export function withSpring<T>(value: T) {
  return value;
}
export function withTiming<T>(value: T) {
  return value;
}
export function withRepeat<T>(value: T) {
  return value;
}
export const Easing = { linear: (t: number) => t, ease: (t: number) => t };
