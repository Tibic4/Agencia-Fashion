/**
 * app/(tabs)/_layout.tsx
 *
 * Why: the marketing site's tab bar uses a solid fucsia "pill" behind the
 * active tab with the label visible. Our previous implementation only tinted
 * the icon and showed a tiny dot — visually weaker than the web. This file
 * implements a Reanimated pill that grows/shrinks smoothly, the active label
 * fades in inside the pill, and inactive tabs collapse to icon-only.
 *
 * Animation choices:
 *   - withSpring(mass: 0.4, damping: 14) — snappy but settles cleanly.
 *   - Pill width is driven by `onLayout` measurements (active vs inactive),
 *     not a hard-coded number, so translations of varying length still work.
 *   - Haptics.selectionAsync (lighter than Light impact) — Apple's pattern
 *     for tab swaps.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';
import { useTabBarBottomInset } from '@/components/tabBarLayout';
import { useNavigationLocked } from '@/lib/navigationLock';

const SPRING: WithSpringConfig = { mass: 0.4, damping: 14 };
const ICON_ONLY_WIDTH = 44;

type IconName = React.ComponentProps<typeof FontAwesome>['name'];

const ICONS: Record<string, IconName> = {
  gerar: 'magic',
  historico: 'history',
  modelo: 'user',
  plano: 'star',
  configuracoes: 'cog',
};

type TFn = ReturnType<typeof useT>['t'];

function tabLabelFromI18n(name: string, t: TFn): string {
  switch (name) {
    case 'gerar':
      return t('tabs.gerar');
    case 'historico':
      return t('tabs.historico');
    case 'modelo':
      return t('tabs.modelo');
    case 'plano':
      return t('tabs.plano');
    case 'configuracoes':
      return t('tabs.configuracoes');
    default:
      return name;
  }
}

interface TabItemProps {
  routeName: string;
  focused: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  label: string;
}

function TabItem({ routeName, focused, onPress, accessibilityLabel, label }: TabItemProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];

  // Measured label width drives the spring target so the pill grows to fit
  // whatever the i18n string ends up being (PT vs EN), avoiding clipping.
  const [labelWidth, setLabelWidth] = useState<number>(0);
  const labelWidthRef = useRef<number>(0);

  // ICON_ONLY_WIDTH ≈ 44 (icon + side padding). When focused, the pill grows
  // by the label width + a 6 px gap.
  const targetWidth = focused ? ICON_ONLY_WIDTH + labelWidth + 6 : ICON_ONLY_WIDTH;

  const widthSV = useSharedValue<number>(targetWidth);
  const opacitySV = useSharedValue<number>(focused ? 1 : 0);
  const bgOpacitySV = useSharedValue<number>(focused ? 1 : 0);

  // Drive shared values whenever focus or measured width changes.
  useEffect(() => {
    widthSV.value = withSpring(targetWidth, SPRING);
    opacitySV.value = withTiming(focused ? 1 : 0, { duration: 180 });
    bgOpacitySV.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [targetWidth, focused, widthSV, opacitySV, bgOpacitySV]);

  const trackStyle = useAnimatedStyle(() => ({
    width: widthSV.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacitySV.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: opacitySV.value,
  }));

  const onMeasureLabel = useCallback((e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (labelWidthRef.current === w) return;
    labelWidthRef.current = w;
    setLabelWidth(w);
  }, []);

  const iconName = ICONS[routeName] ?? 'circle';
  const inactiveColor = colors.tabIconDefault;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      style={styles.tabItem}
      hitSlop={8}
    >
      <Animated.View style={[styles.pillTrack, trackStyle]}>
        {/* Gradient fill — fades in/out, sits behind the icon + label. */}
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.pillBackdrop, bgStyle]}>
          <LinearGradient
            colors={Colors.brand.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Visible content — icon (always) + label (focused only). */}
        <View style={styles.pillContent}>
          <FontAwesome
            size={20}
            name={iconName}
            color={focused ? '#FFFFFF' : inactiveColor}
          />
          {focused && (
            <Animated.Text
              style={[styles.label, labelStyle]}
              numberOfLines={1}
              accessible={false}
            >
              {label}
            </Animated.Text>
          )}
        </View>

        {/* Hidden measurer — same font/text we render so the pill knows the
            true label width before the user activates this tab. */}
        <Text
          style={[styles.label, styles.labelMeasurer]}
          numberOfLines={1}
          onLayout={onMeasureLabel}
          accessible={false}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const { t } = useT();
  // Shared helper guarantees the tab bar honours the OS gesture-bar inset
  // (needed on Galaxy S22 + most Android gesture-nav phones).
  const bottomOffset = useTabBarBottomInset();
  // Why: a long-running flow (campaign generation) sets a global lock so
  // taps on tabs can't break the loading-screen context mid-flight. We
  // dim the bar to communicate the locked state.
  const navLocked = useNavigationLocked();

  if (navLocked) return null;

  return (
    <View
      style={[styles.tabBarContainer, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={scheme === 'dark' ? 50 : 70}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[
          styles.blurView,
          {
            backgroundColor: colors.glass,
            borderColor: colors.border,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = tabLabelFromI18n(route.name, t);

          const onPress = () => {
            if (navLocked) return;
            if (!isFocused) Haptics.selectionAsync();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              focused={isFocused}
              onPress={onPress}
              accessibilityLabel={t('tabs.selectTab', { label })}
              label={label}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="gerar" />
      <Tabs.Screen name="historico" />
      <Tabs.Screen name="modelo" />
      <Tabs.Screen name="plano" />
      <Tabs.Screen name="configuracoes" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  blurView: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  tabItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  pillTrack: {
    height: 44,
    minWidth: ICON_ONLY_WIDTH,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillBackdrop: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: Colors.brand.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  label: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: -0.2,
  },
  labelMeasurer: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
    top: -9999,
  },
});
