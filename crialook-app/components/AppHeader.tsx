/**
 * components/AppHeader.tsx
 *
 * Why: the marketing site (crialook.com.br/gerar) ships with a sticky header
 * showing logo + theme toggle + credits chip — and the app currently has no
 * global header at all. This file is the app's answer: a glass-blurred,
 * safeArea-aware header that floats over each tab screen, exposes the live
 * theme cycle (light → dark → system → light), and shows credits-remaining
 * with a traffic-light pill (green/amber/red).
 *
 * Layout contract:
 *   - position: 'absolute' top:0 — screens add `paddingTop: HEADER_TOTAL_HEIGHT(insets)`
 *   - exports `useHeaderHeight()` so screens can compute that padding
 */
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withSequence } from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppTheme, type ThemeMode } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { apiGetCached } from '@/lib/api';

export const HEADER_HEIGHT = 56;

/**
 * useHeaderHeight — total vertical space the header consumes, including the
 * device's top safe area. Use this for screen `paddingTop`.
 */
export function useHeaderHeight(): number {
  const insets = useSafeAreaInsets();
  return computeHeaderHeight(insets);
}

function computeHeaderHeight(insets: EdgeInsets): number {
  return insets.top + HEADER_HEIGHT;
}

// ---------- credits hook ----------------------------------------------------
type StoreUsage = {
  campaigns_generated?: number;
  campaigns_limit?: number;
};

interface CreditState {
  used: number;
  limit: number;
  ready: boolean;
}

/**
 * useCredits — fetches /store/usage (used/limit pair) with a 60s in-memory
 * cache. /store/credits is intentionally NOT consulted: it tracks "avulso"
 * (one-shot) purchases and has no limit field, so it can't drive the chip
 * pill colour math.
 */
function useCredits(): CreditState {
  const [state, setState] = useState<CreditState>({ used: 0, limit: 0, ready: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGetCached<{ data: StoreUsage }>('/store/usage', 60_000);
        if (cancelled) return;
        const used = res.data?.campaigns_generated ?? 0;
        const limit = res.data?.campaigns_limit ?? 0;
        setState({ used, limit, ready: true });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, ready: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// ---------- pieces ----------------------------------------------------------
/* Logo real (icon.png — mesma rodinha purple/hanger usada no app icon e
   no sign-in). Antes era um anel gradient + Text "C" — ruído visual já
   que o logo verdadeiro já é redondo + brand-colored. */
function LogoMark() {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      style={styles.logoMark}
      resizeMode="contain"
    />
  );
}

/**
 * Toggle simples light ↔ dark. O modo 'system' continua sendo o default
 * inicial (lib/theme.tsx) — quando o usuário abre o app pela primeira vez
 * ele acompanha o device. Mas uma vez que ele toca o botão, escolhe
 * explicitamente. Antes existia um terceiro estado "🖥️ system" no ciclo
 * que confundia: o ícone do PC não tornava óbvio que era "automático".
 */
function nextThemeMode(mode: ThemeMode, effectiveScheme: 'light' | 'dark'): ThemeMode {
  const current = mode === 'system' ? effectiveScheme : mode;
  return current === 'light' ? 'dark' : 'light';
}

function themeModeIcon(mode: ThemeMode, effectiveScheme: 'light' | 'dark'): 'sun' | 'moon' {
  // Em modo 'system' mostra o ícone DO MODO ATUAL DO DEVICE.
  // Antes usávamos emoji ☀️/🌙 — em algumas skins de dark mode (warm-grey
  // bg + 78% glass blur) o emoji ficava com pouquíssimo contraste e o
  // affordance "tem tema aqui" sumia. Trocamos por Feather sun/moon que
  // herdam currentColor — sempre fuchsia brand, sempre legível.
  const visual = mode === 'system' ? effectiveScheme : mode;
  return visual === 'light' ? 'sun' : 'moon';
}

function pillColorFor(used: number, limit: number, fallback: string): { bg: string; fg: string } {
  // Three-stop traffic-light: brand fuchsia (>50% remaining), amber (20–50%),
  // red (<20%). The "no plan" fallback uses brand glow so it still looks
  // intentional, not greyed-out.
  if (limit <= 0) return { bg: Colors.brand.glowSoft, fg: fallback };
  const remaining = limit - used;
  const pct = (remaining / limit) * 100;
  if (pct > 50) return { bg: 'rgba(16,185,129,0.16)', fg: Colors.brand.success };
  if (pct >= 20) return { bg: 'rgba(245,158,11,0.18)', fg: Colors.brand.warning };
  return { bg: 'rgba(239,68,68,0.16)', fg: Colors.brand.error };
}

// ---------- main ------------------------------------------------------------
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const { mode, setTheme } = useAppTheme();
  const { t } = useT();
  const router = useRouter();
  const credits = useCredits();

  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  const onToggleTheme = useCallback(() => {
    Haptics.selectionAsync();
    
    // Design Spell: Magical theme morph icon spin + bounce
    rotation.value = withSpring(rotation.value + 180, { mass: 0.5, damping: 12 });
    scale.value = withSequence(
      withSpring(0.7, { mass: 0.2, damping: 10 }),
      withSpring(1, { mass: 0.5, damping: 12 })
    );

    setTheme(nextThemeMode(mode, scheme));
  }, [mode, scheme, setTheme]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ]
  }));

  const onPressCredits = useCallback(() => {
    Haptics.selectionAsync();
    router.push('/(tabs)/plano');
  }, [router]);

  const blurIntensity = scheme === 'dark' ? 70 : 90;
  const pill = pillColorFor(credits.used, credits.limit, colors.text);
  const showCredits = credits.ready && credits.limit > 0;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          paddingTop: insets.top,
          height: computeHeaderHeight(insets),
        },
      ]}
    >
      <BlurView
        intensity={blurIntensity}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.glass,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: hexToRgba(colors.border, 0.5),
          },
        ]}
      />

      <View style={styles.row}>
        {/* Left: logo + wordmark */}
        <View style={styles.leftCluster}>
          <LogoMark />
          <View style={styles.wordmarkRow}>
            <Text style={[styles.wordmark, { color: colors.text }]}>Cria</Text>
            <MaskedGradientText text="Look" />
          </View>
        </View>

        {/* Right: theme toggle + credits chip */}
        <View style={styles.rightCluster}>
          <Pressable
            onPress={onToggleTheme}
            accessibilityRole="button"
            accessibilityLabel={t('header.toggleTheme')}
            accessibilityHint={
              mode === 'light'
                ? t('header.toggleThemeLight')
                : mode === 'dark'
                  ? t('header.toggleThemeDark')
                  : t('header.toggleThemeSystem')
            }
            hitSlop={12}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                // Brand-glow tinted backdrop instead of plain surface2 — the
                // toggle now reads as a clearly tappable brand affordance in
                // both modes (dark surface2 + 78% glass made it disappear).
                backgroundColor: Colors.brand.glowSoft,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: scheme === 'dark' ? Colors.brand.glowMid : Colors.brand.glowSoft,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Animated.View style={animatedIconStyle}>
              <Feather
                name={themeModeIcon(mode, scheme)}
                size={16}
                color={scheme === 'dark' ? Colors.brand.primaryLight : Colors.brand.primary}
              />
            </Animated.View>
          </Pressable>

          {showCredits && (
            <Pressable
              onPress={onPressCredits}
              accessibilityRole="button"
              accessibilityLabel={t('header.creditsAccessibility', { used: credits.used, limit: credits.limit })}
              hitSlop={12}
              style={({ pressed }) => [
                styles.creditsChip,
                { backgroundColor: pill.bg },
                pressed && { opacity: 0.75 },
              ]}
            >
              <FontAwesome name="bolt" size={11} color={pill.fg} style={{ marginRight: 4 }} />
              <Text style={[styles.creditsText, { color: pill.fg }]}>
                {t('header.creditsChip', { used: credits.used, limit: credits.limit })}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ---------- helpers ---------------------------------------------------------
/**
 * MaskedGradientText — RN Web/Native cannot do CSS background-clip:text without
 * a heavy lib. We approximate the gradient-text effect by painting the same
 * fucsia gradient as a thin underline + tinting the glyph with the secondary
 * brand color. Visually distinct from plain text while staying dependency-free.
 */
function MaskedGradientText({ text }: { text: string }) {
  return (
    <View style={styles.gradTextWrap}>
      <Text style={[styles.wordmark, { color: Colors.brand.secondary }]}>{text}</Text>
      <LinearGradient
        colors={Colors.brand.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradUnderline}
      />
    </View>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  // Accept rgba/hsla strings as-is.
  if (!hex.startsWith('#')) return hex;
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------- styles ----------------------------------------------------------
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /* Logo real — mesmo asset do app icon, redondo, fundo brand já incluído. */
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmark: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.4,
  },
  gradTextWrap: {
    position: 'relative',
    paddingBottom: 2,
  },
  gradUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: 2,
    opacity: 0.85,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  creditsText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
    // tabular-nums keeps "12/30" → "13/30" stable when the digit changes,
    // avoiding the jiggle that the variable-width Inter glyphs would cause.
    fontVariant: ['tabular-nums'],
  },
});
