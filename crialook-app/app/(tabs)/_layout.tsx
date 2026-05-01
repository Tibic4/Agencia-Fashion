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
 *   icons (Feather is the visual ancestor of lucide), gradient pill on the
 *   active item, fuchsia tint, brand pip on top.
 *
 *   We keep parity for the things native bars give for free: tabPress events
 *   for stack-reset, badges, accessibilityRole="tab" + selected state, haptic
 *   feedback on tap, safe-area awareness.
 *
 * Tab order matches the site exactly: Criar / Histórico / Modelo / Config /
 * Plano (Plano was second-to-last in the previous app, that drift is gone).
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const SPRING = { mass: 0.5, damping: 14, stiffness: 180 };

function TabBarItem({
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
  const inactiveColor = colors.textSecondary;
  const color = isActive ? activeColor : inactiveColor;

  const scale = useSharedValue(isActive ? 1 : 0.92);
  const translateY = useSharedValue(isActive ? -1 : 0);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1 : 0.92, SPRING);
    translateY.value = withSpring(isActive ? -1 : 0, SPRING);
  }, [isActive, scale, translateY]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const showBadge = badge != null && badge > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      style={styles.item}
      hitSlop={4}
    >
      {isActive && (
        // Gradient pill backdrop — matches the site's `var(--gradient-brand)`
        // at 12% opacity, nudged up to 14% to survive RN's blur backdrop.
        <LinearGradient
          colors={Colors.brand.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.activeFill}
        />
      )}
      {isActive && (
        // Brand pip on top — same affordance as `tab-dot` on the site.
        <View style={[styles.activeDot, { backgroundColor: activeColor }]} />
      )}

      <Animated.View style={animatedIconStyle}>
        <TabIcon route={route} color={color} size={22} />
      </Animated.View>

      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color, opacity: isActive ? 1 : 0.65 },
        ]}
      >
        {label}
      </Text>

      {showBadge && (
        <View
          style={[
            styles.badge,
            { backgroundColor: Colors.brand.primary },
          ]}
          accessibilityLabel={`${badge} novos`}
        >
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
        </View>
      )}
    </Pressable>
  );
}

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const unseenCount = useUnseenHistoricoCount();
  const navLocked = useNavigationLocked();

  // Hide the bar during long-running flows (campaign generation). The
  // generation screen takes over /gerar so the user has nowhere to navigate
  // to anyway — this matches the previous behaviour exactly.
  if (navLocked) return null;

  const bottom = Math.max(insets.bottom, 12) + TAB_BAR_BOTTOM_GAP;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.glass,
            borderColor: colors.border,
            shadowColor: scheme === 'dark' ? '#000' : '#0F0519',
          },
        ]}
      >
        <BlurView
          tint={scheme === 'dark' ? 'dark' : 'light'}
          intensity={scheme === 'dark' ? 70 : 90}
          style={StyleSheet.absoluteFillObject}
        />
        {state.routes.map((route, index) => {
          const routeName = route.name as RouteName;
          if (!TAB_ICON[routeName]) return null;

          const isActive = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              Haptics.selectionAsync();
              // navigation.navigate signature on the bottom-tab navigator
              // is overloaded; the simplest typing-friendly invocation is
              // a single object with `name` + optional `params`.
              (navigation as unknown as { navigate: (target: { name: string; params?: object | undefined }) => void }).navigate({
                name: route.name,
                params: route.params as object | undefined,
              });
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
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    borderRadius: 16,
    position: 'relative',
  },
  activeFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    opacity: 0.14,
  },
  activeDot: {
    position: 'absolute',
    top: 1,
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
