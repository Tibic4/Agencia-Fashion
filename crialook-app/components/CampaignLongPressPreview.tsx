/**
 * CampaignLongPressPreview
 *
 * Long-press peek for campaign cards in the history screen — same UX as
 * `ModelLongPressPreview` but adapted for campaign data:
 *
 *   • Tap (short press) → `onPress` (opens the campaign result).
 *   • Long-press 350 ms → activates a peek overlay:
 *       - card scales to 0.96 with a fuchsia glow ring
 *       - selection haptic fires
 *       - floating overlay shows the first generated photo at 1.4×
 *       - releasing the finger closes the overlay
 *
 * Why a separate component instead of generic? `ModelLongPressPreview`
 * carries opinionated typing/styling for `ModelItem`. Campaigns have a
 * different shape (title + first image url + status). Keeping them split
 * is cheaper than over-abstracting now.
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
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { haptic } from '@/lib/haptics';

export interface CampaignPeekData {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  /** Optional subtitle (e.g. "3 fotos · há 2 dias"). */
  subtitle?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────
interface PeekState {
  show: (data: CampaignPeekData) => void;
  hide: () => void;
  current: CampaignPeekData | null;
}

const PeekContext = createContext<PeekState | null>(null);

/**
 * Mount once near the root of the screen that hosts the campaign list.
 * Renders the floating peek overlay and provides show/hide to children.
 */
export function CampaignPeekProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<CampaignPeekData | null>(null);

  const value = useMemo<PeekState>(
    () => ({
      show: (data) => setCurrent(data),
      hide: () => setCurrent(null),
      current,
    }),
    [current],
  );

  return (
    <PeekContext.Provider value={value}>
      {children}
      <CampaignPeekOverlay data={current} />
    </PeekContext.Provider>
  );
}

function usePeek(): PeekState {
  const ctx = useContext(PeekContext);
  if (!ctx) {
    throw new Error('CampaignPressable must be used inside <CampaignPeekProvider>');
  }
  return ctx;
}

// ─── Card wrapper ─────────────────────────────────────────────────────────
interface PressableProps {
  data: CampaignPeekData;
  onPress: () => void;
  children: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Skip peek (e.g. for failed campaigns with no thumbnail). */
  disablePeek?: boolean;
}

export function CampaignPressable({
  data,
  onPress,
  children,
  style,
  accessibilityLabel,
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
  }));

  const startPeek = useCallback(() => {
    if (disablePeek || !data.thumbnailUrl) return;
    haptic.tap(); // Light reveal — Apple HIG pattern for peek/preview
    scale.value = withSpring(0.96, { mass: 0.5, damping: 14 });
    glow.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
    peek.show(data);
  }, [disablePeek, data, glow, peek, scale]);

  const endPeek = useCallback(() => {
    scale.value = withSpring(1, { mass: 0.5, damping: 14 });
    glow.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) });
    peek.hide();
  }, [glow, peek, scale]);

  return (
    <Animated.View style={[animatedCard, style]}>
      <Animated.View pointerEvents="none" style={[styles.glowRing, animatedGlow]} />
      <Pressable
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onLongPress={startPeek}
        delayLongPress={350}
        onPressOut={() => {
          if (!disablePeek) endPeek();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? data.title}
        style={styles.pressable}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────
function CampaignPeekOverlay({ data }: { data: CampaignPeekData | null }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const visible = !!data;

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

  if (!data) return null;

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
        {data.thumbnailUrl ? (
          <Image
            source={{ uri: data.thumbnailUrl }}
            style={styles.peekImage}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.peekImage, { backgroundColor: colors.border }]} />
        )}
        <View style={styles.peekFooter}>
          <Text style={[styles.peekTitle, { color: colors.text }]} numberOfLines={1}>
            {data.title}
          </Text>
          {data.subtitle && (
            <Text style={[styles.peekSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {data.subtitle}
            </Text>
          )}
        </View>
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
    borderRadius: 16,
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
    width: 220,
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
  peekFooter: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  peekTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  peekSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
