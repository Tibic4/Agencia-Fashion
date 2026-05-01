/**
 * app/(tabs)/_layout.tsx — Custom floating glass tab bar that mirrors the
 * marketing site's mobile bottom nav (campanha-ia/.../auth/_chrome.tsx).
 *
 * Why we moved off NativeTabs:
 *   The Material 3 / UIKit native bar gave us ripples and a11y for free, but
 *   its system-icon glyphs (`ic_menu_add`, `btn_star`, …) and chrome looked
 *   nothing like the site's mobile shell. Users move between site and app
 *   constantly — brand continuity beats native chrome at this scale. This
 *   custom bar matches the site's MobileTabBar 1:1: lucide-style outline
 *   icons (Feather is the visual ancestor of lucide), a gradient pill that
 *   *slides* between tabs (mirrors framer-motion's `layoutId`), fuchsia tint,
 *   brand pip on top.
 *
 *   We keep parity for the things native bars give for free: tabPress events
 *   for stack-reset, badges, accessibilityRole="tab" + selected state, haptic
 *   feedback on tap, safe-area awareness, Android ripple.
 *
 * Tab order matches the site exactly: Criar / Histórico / Modelo / Config /
 * Plano (Plano was second-to-last in the previous app, that drift is gone).
 *
 * Layered structure:
 *   wrapper (absolute, transparent)
 *     └─ shadowLayer (rounded, NO overflow:hidden — shadows only render with
 *                     overflow:visible; classic RN gotcha)
 *          └─ clipLayer (rounded + overflow:hidden — clips BlurView, indicator)
 *               ├─ BlurView
 *               ├─ sliding gradient indicator (animated left+width)
 *               └─ N × Pressable items
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';
import { useNavigationLocked } from '@/lib/navigationLock';
import { useUnseenHistoricoCount } from '@/lib/unseenGenerations';
import {
  TAB_BAR_BOTTOM_GAP,
  TAB_BAR_HEIGHT,
} from '@/components/tabBarLayout';

type RouteName = 'gerar' | 'historico' | 'modelo' | 'configuracoes' | 'plano';

// Feather is the original of lucide (lucide forked from Feather), so the
// stroke weight and glyph shapes match the site's outline SVGs 1:1 — except
// `history`, which lucide added later. We draw that one with MaterialIcons
// since its history glyph is the closest match to lucide's clock+arrow.
const TAB_ICON: Record<RouteName, { lib: 'feather' | 'mi'; name: string }> = {
  gerar: { lib: 'feather', name: 'plus' },
  historico: { lib: 'mi', name: 'history' },
  modelo: { lib: 'feather', name: 'user' },
  configuracoes: { lib: 'feather', name: 'settings' },
  plano: { lib: 'feather', name: 'credit-card' },
};

// Spring tuned to match framer-motion's stiffness:380 damping:32 from the
// site (motion.div animate={{ left, width }}). Higher stiffness = snappier
// snap into place; mass kept light so the bar feels weightless.
const INDICATOR_SPRING = { mass: 0.6, damping: 26, stiffness: 320 };
const ICON_SPRING = { mass: 0.5, damping: 14, stiffness: 180 };
const BAR_PADDING_X = 4;

function TabIcon({
  route,
  color,
  size,
}: {
  route: RouteName;
  color: string;
  size: number;
}) {
  const cfg = TAB_ICON[route];
  if (cfg.lib === 'mi') {
    // MI history is slightly smaller visually than Feather glyphs at the
    // same px size — bump 2px so it matches the optical weight of `plus`.
    return <MaterialIcons name={cfg.name as 'history'} size={size + 2} color={color} />;
  }
  return (
    <Feather
      name={cfg.name as 'plus' | 'user' | 'settings' | 'credit-card'}
      size={size}
      color={color}
    />
  );
}

const TabBarItem = memo(function TabBarItem({
  route,
  label,
  isActive,
  onPress,
  onLongPress,
  badge,
  scheme,
}: {
  route: RouteName;
  label: string;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badge?: number;
  scheme: 'light' | 'dark';
}) {
  const colors = Colors[scheme];
  const activeColor =
    scheme === 'dark' ? Colors.brand.primaryLight : Colors.brand.primary;
  const color = isActive ? activeColor : colors.textSecondary;

  const scale = useSharedValue(isActive ? 1 : 0.92);
  const translateY = useSharedValue(isActive ? -1 : 0);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1 : 0.92, ICON_SPRING);
    translateY.value = withSpring(isActive ? -1 : 0, ICON_SPRING);
  }, [isActive, scale, translateY]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const showBadge = badge != null && badge > 0;

  // Android ripple: brand-tinted, contained inside the rounded bounds. iOS
  // gets opacity feedback via the function-style style prop (no ripple).
  const androidRipple = {
    color: scheme === 'dark' ? Colors.brand.glowMid : Colors.brand.glowSoft,
    borderless: false,
    foreground: true,
  } as const;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={androidRipple}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.item,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Animated.View style={animatedIconStyle}>
        <TabIcon route={route} color={color} size={22} />
      </Animated.View>

      <Text
        numberOfLines={1}
        style={[styles.label, { color, opacity: isActive ? 1 : 0.65 }]}
      >
        {label}
      </Text>

      {showBadge && (
        <View
          style={[styles.badge, { backgroundColor: Colors.brand.primary }]}
          accessibilityLabel={`${badge} ${badge === 1 ? 'novo' : 'novos'}`}
        >
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
        </View>
      )}
    </Pressable>
  );
});

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const unseenCount = useUnseenHistoricoCount();
  const navLocked = useNavigationLocked();

  const [barWidth, setBarWidth] = useState(0);
  const isFirstLayout = useRef(true);

  // The active pill is a single shared element that slides between tabs —
  // mirrors framer-motion's `layoutId` on the site. Animating left/width
  // beats fade-in-fade-out: zero flicker, the eye tracks the indicator
  // through the transition.
  const indicatorLeft = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const tabCount = state.routes.length;
  const tabWidth = barWidth > 0 ? (barWidth - BAR_PADDING_X * 2) / tabCount : 0;

  useEffect(() => {
    if (tabWidth <= 0) return;
    const targetLeft = BAR_PADDING_X + state.index * tabWidth;
    if (isFirstLayout.current) {
      // First mount: snap into place without springing from x=0 (looks
      // janky and draws attention to a non-event).
      indicatorLeft.value = targetLeft;
      indicatorWidth.value = tabWidth;
      isFirstLayout.current = false;
      return;
    }
    indicatorLeft.value = withSpring(targetLeft, INDICATOR_SPRING);
    indicatorWidth.value = withSpring(tabWidth, INDICATOR_SPRING);
  }, [state.index, tabWidth, indicatorLeft, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorLeft.value,
    width: indicatorWidth.value,
  }));

  if (navLocked) return null;
  const bottom = Math.max(insets.bottom, 12) + TAB_BAR_BOTTOM_GAP;

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const activeRouteKey = state.routes[state.index]?.key;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom }]}>
      <View
        style={[
          styles.shadowLayer,
          { shadowColor: scheme === 'dark' ? '#000' : '#0F0519' },
        ]}
      >
        <View
          onLayout={onBarLayout}
          style={[
            styles.clipLayer,
            { backgroundColor: colors.glass, borderColor: colors.border },
          ]}
        >
          <BlurView
            tint={scheme === 'dark' ? 'dark' : 'light'}
            intensity={scheme === 'dark' ? 70 : 90}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Sliding active pill — single LinearGradient that animates between
              tabs instead of N gradients fading in/out. Brand pip lives inside
              so it slides as one element. pointerEvents="none" lets taps fall
              through to the Pressable underneath. */}
          {tabWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, indicatorStyle]}
            >
              <LinearGradient
                colors={Colors.brand.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.indicatorFill}
              />
              <View
                style={[
                  styles.indicatorDot,
                  {
                    backgroundColor:
                      scheme === 'dark' ? Colors.brand.primaryLight : Colors.brand.primary,
                  },
                ]}
              />
            </Animated.View>
          )}

          {state.routes.map((route, index) => {
            const routeName = route.name as RouteName;
            if (!TAB_ICON[routeName]) return null;
            const isActive = route.key === activeRouteKey;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isActive && !event.defaultPrevented) {
                Haptics.selectionAsync();
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TabBarItem
                key={route.key}
                route={routeName}
                label={t(`tabs.${routeName}` as 'tabs.gerar')}
                isActive={isActive}
                onPress={onPress}
                onLongPress={onLongPress}
                badge={routeName === 'historico' ? unseenCount : undefined}
                scheme={scheme}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The wrapper around our custom tabBar is absolute + transparent so
        // screens can run edge-to-edge underneath the floating pill (the
        // screens already pad themselves via useTabContentPaddingBottom).
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 0,
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      {/* Order matches the site exactly: Criar / Histórico / Modelo /
          Config / Plano. */}
      <Tabs.Screen name="gerar" />
      <Tabs.Screen name="historico" />
      <Tabs.Screen name="modelo" />
      <Tabs.Screen name="configuracoes" />
      <Tabs.Screen name="plano" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: TAB_BAR_HEIGHT,
    zIndex: 30,
  },
  // Shadow ONLY here — overflow stays visible so iOS actually paints the
  // drop shadow (overflow:hidden silently kills shadows on iOS).
  shadowLayer: {
    flex: 1,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  // Clip layer — overflow:hidden is required so the BlurView and the sliding
  // gradient indicator both respect the rounded corners.
  clipLayer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PADDING_X,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden', // keep Android ripple inside rounded bounds
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  indicatorFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
  },
  indicatorDot: {
    position: 'absolute',
    top: -3,
    alignSelf: 'center',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    lineHeight: 12,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: '22%',
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    lineHeight: 11,
  },
});
