/**
 * ZoomablePhoto — pinch + double-tap zoom on hero photos.
 *
 * Why a dedicated component:
 *   - Web can't do native pinch-to-zoom on touch images without ugly
 *     workarounds. The app should leverage Gesture Handler + Reanimated
 *     for buttery 60 fps zoom that matches Photos.app/Instagram.
 *   - Double-tap toggles between fit (1×) and a fixed zoom (2.5×).
 *   - Pinch updates `scale` continuously; on release, springs back to 1×
 *     if it's below 1.1× (so accidental tiny pinches snap back).
 *   - Pan only kicks in while zoomed (prevents fighting parent scroll).
 *
 * Reduced motion: zoom still works, but the spring is replaced by an
 * instant snap to avoid motion sickness.
 */
import { Image, type ImageProps } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '@/lib/haptics';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SNAP_THRESHOLD = 1.1;

interface Props extends Omit<ImageProps, 'style'> {
  imageStyle?: ImageProps['style'];
  containerStyle?: StyleProp<ViewStyle>;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

export function ZoomablePhoto({
  imageStyle,
  containerStyle,
  ...imageProps
}: Props) {
  const reducedMotion = useReducedMotion();

  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const baseTx = useSharedValue(0);
  const baseTy = useSharedValue(0);

  const reset = (animate = true) => {
    'worklet';
    if (animate && !reducedMotion) {
      scale.value = withSpring(1, { mass: 0.5, damping: 14 });
      tx.value = withSpring(0, { mass: 0.5, damping: 14 });
      ty.value = withSpring(0, { mass: 0.5, damping: 14 });
    } else {
      scale.value = withTiming(1, { duration: 0 });
      tx.value = withTiming(0, { duration: 0 });
      ty.value = withTiming(0, { duration: 0 });
    }
    baseScale.value = 1;
    baseTx.value = 0;
    baseTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      baseScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = baseScale.value * e.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE * 0.7), MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value < SNAP_THRESHOLD) {
        reset(true);
        runOnJS(haptic.tap)();
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE, { mass: 0.5, damping: 14 });
      }
      baseScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      baseTx.value = tx.value;
      baseTy.value = ty.value;
    })
    .onUpdate((e) => {
      // Only pan while zoomed in; otherwise let the parent scroll
      if (scale.value <= 1) return;
      tx.value = baseTx.value + e.translationX;
      ty.value = baseTy.value + e.translationY;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(haptic.tap)();
      if (scale.value > 1) {
        reset(true);
      } else if (reducedMotion) {
        scale.value = DOUBLE_TAP_SCALE;
        baseScale.value = DOUBLE_TAP_SCALE;
      } else {
        scale.value = withSpring(DOUBLE_TAP_SCALE, { mass: 0.5, damping: 14 });
        baseScale.value = DOUBLE_TAP_SCALE;
      }
    });

  // Compose: pinch + pan run simultaneously; double-tap is exclusive
  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, containerStyle]} collapsable={false}>
        <AnimatedImage {...imageProps} style={[styles.image, imageStyle, animStyle]} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
