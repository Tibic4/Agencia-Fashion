/**
 * ModelLongPressPreview
 *
 * iOS-style "peek" preview for a model card. Wrap each card with
 * <ModelPressable model={...} onPress={...}>{children}</ModelPressable>.
 *
 * Behavior:
 *   • Tap (short press) → calls `onPress` (selects the model).
 *   • Long-press 350ms  → activates a peek:
 *       - card scales to 0.96 with an animated fuchsia glow ring
 *       - Selection haptic fires
 *       - a floating overlay shows the photo at 1.4x in the center of the screen
 *       - releasing the finger closes the overlay (no selection)
 *
 * The overlay is rendered in a sibling <ModelPeekOverlay/> portal-like component
 * driven by a small zustand-free context, so each card doesn't have to mount its
 * own RN <Modal>.
 *
 * All animations live on the UI thread (Reanimated worklets).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { haptic } from '@/lib/haptics';
import type { ModelItem } from '@/types';

// ─── Context ──────────────────────────────────────────────────────────────
interface PeekState {
  show: (model: ModelItem) => void;
  hide: () => void;
  current: ModelItem | null;
}

const PeekContext = createContext<PeekState | null>(null);

/**
 * Mount once near the root of the screen that hosts the model list.
 * Renders the floating peek overlay and provides show/hide to children.
 */
export function ModelPeekProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ModelItem | null>(null);

  const value = useMemo<PeekState>(
    () => ({
      show: m => setCurrent(m),
      hide: () => setCurrent(null),
      current,
    }),
    [current],
  );

  return (
    <PeekContext.Provider value={value}>
      {children}
      <ModelPeekOverlay model={current} />
    </PeekContext.Provider>
  );
}

function usePeek(): PeekState {
  const ctx = useContext(PeekContext);
  if (!ctx) {
    throw new Error('ModelPressable must be used inside <ModelPeekProvider>');
  }
  return ctx;
}

// ─── Card wrapper ─────────────────────────────────────────────────────────
interface PressableProps {
  model: ModelItem;
  onPress: () => void;
  children: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  /** Skip peek (e.g. for the random card with no photo). */
  disablePeek?: boolean;
}

export function ModelPressable({
  model,
  onPress,
  children,
  style,
  accessibilityLabel,
  accessibilityState,
  disablePeek,
}: PressableProps) {
  const peek = usePeek();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedGlow = useAnimatedStyle(() => ({
    opacity: glow.value,
    // The shadow itself is in stylesheet; we only animate opacity for cheapness.
  }));

  const startPeek = useCallback(() => {
    if (disablePeek) return;
    haptic.selection();
    scale.value = withSpring(0.96, { mass: 0.5, damping: 14 });
    glow.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
    peek.show(model);
  }, [disablePeek, glow, model, peek, scale]);

  const endPeek = useCallback(() => {
    scale.value = withSpring(1, { mass: 0.5, damping: 14 });
    glow.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) });
    peek.hide();
  }, [glow, peek, scale]);

  return (
    <Animated.View style={[animatedCard, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glowRing, animatedGlow]}
      />
      <Pressable
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onLongPress={startPeek}
        delayLongPress={350}
        onPressOut={() => {
          // onPressOut fires on both tap-release and long-press-release; we
          // only want to close the peek if it was actually opened.
          if (!disablePeek) endPeek();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={styles.pressable}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────
function ModelPeekOverlay({ model }: { model: ModelItem | null }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const visible = !!model;

  const opacity = useSharedValue(0);
  const previewScale = useSharedValue(0.9);

  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 140 });
      previewScale.value = withSpring(1.4, { mass: 0.6, damping: 16 });
    } else {
      opacity.value = withTiming(0, { duration: 120 });
      previewScale.value = withTiming(0.9, { duration: 120 });
    }
  }, [opacity, previewScale, visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: previewScale.value }],
  }));

  if (!model) return null;

  const photoUri = model.image_url || model.photo_url || '';

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
    >
      <Animated.View
        style={[
          styles.peekCard,
          { backgroundColor: colors.card, borderColor: Colors.brand.primary },
          cardStyle,
        ]}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={styles.peekImage}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.peekImage, { backgroundColor: colors.border }]} />
        )}
        <Text style={[styles.peekName, { color: colors.text }]} numberOfLines={1}>
          {model.name}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.brand.glow,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  peekCard: {
    width: 200,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  peekImage: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  peekName: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
});
