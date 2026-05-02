/**
 * PhotoTipsCard — collapsible quick-shot guide.
 *
 * Visual: collapsed = 1 row with header. Expanded = auto-rotating carrossel
 * cycling through 5 do/don't tips, 3.5s each. The user can tap the indicator
 * dots to jump, or the card itself to collapse.
 *
 * Why a carousel instead of a list:
 *   - The collapsed→expanded transition exposing 5 lines at once feels heavy.
 *   - Rotating through one tip at a time keeps the screen tight and means
 *     the user actually READS each tip (lists get scanned, then ignored).
 *   - Pause after first user interaction (tap on a dot) so a curious user
 *     who's reading carefully isn't fighting the rotation.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AnimatedPressable } from '@/components/ui';
import Colors from '@/constants/Colors';
import { tokens } from '@/lib/theme/tokens';
import { useColorScheme } from '@/components/useColorScheme';
import { useT, type TKey } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';

const TIPS: { icon: '✅' | '❌'; key: TKey }[] = [
  { icon: '✅', key: 'photoTips.tipBgClean' },
  { icon: '✅', key: 'photoTips.tipLight' },
  { icon: '✅', key: 'photoTips.tipFlat' },
  { icon: '❌', key: 'photoTips.tipNoModel' },
  { icon: '❌', key: 'photoTips.tipBgClutter' },
];

const ROTATION_MS = 3500;

export function PhotoTipsCard() {
  const [expanded, setExpanded] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useT();

  // Auto-rotate while expanded and not paused. The interval only runs when
  // the card is open; collapsing the card stops it via the cleanup.
  useEffect(() => {
    if (!expanded || paused) return;
    const id = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, [expanded, paused]);

  // Reset to first tip whenever we expand fresh — gives the user a stable
  // entry point. (Without this, recollapsing/expanding picks up wherever the
  // last rotation left off, which feels random.)
  const prevExpanded = useRef(false);
  useEffect(() => {
    if (expanded && !prevExpanded.current) {
      setTipIndex(0);
      setPaused(false);
    }
    prevExpanded.current = expanded;
  }, [expanded]);

  const tip = TIPS[tipIndex];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <AnimatedPressable
        onPress={() => setExpanded(!expanded)}
        haptic="tap"
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Recolher dicas' : 'Ver dicas de foto'}
        accessibilityState={{ expanded }}
        androidRipple={false}
      >
        <Text style={styles.headerIcon}>📸</Text>
        <Text style={[styles.headerText, { color: colors.text }]}>
          {t('photoTips.header')}
        </Text>
        <FontAwesome
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={colors.textSecondary}
        />
      </AnimatedPressable>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.body}>
          {/* Single tip slot — fades in/out as tipIndex changes. minHeight
              fixes layout so different-length tips don't pop the card. */}
          <View style={styles.tipSlot}>
            <Animated.View
              key={tipIndex}
              entering={FadeIn.duration(250)}
              exiting={FadeOut.duration(180)}
              style={styles.tipRow}
            >
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]} selectable>
                {t(tip.key)}
              </Text>
            </Animated.View>
          </View>

          {/* Pagination dots — tap to jump. The active dot is wider + brand
              colored, mirroring the same dot style used in onboarding. */}
          <View style={styles.dotsRow}>
            {TIPS.map((_, i) => {
              const active = i === tipIndex;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    haptic.selection();
                    setPaused(true);
                    setTipIndex(i);
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Ir para dica ${i + 1} de ${TIPS.length}`}
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: active ? Colors.brand.primary : colors.border,
                        width: active ? 18 : 6,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 16 },
  headerText: { flex: 1, fontSize: 13, fontWeight: tokens.fontWeight.bold },
  body: { marginTop: 12, gap: 12 },
  tipSlot: {
    minHeight: 44,
    justifyContent: 'center',
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  tipText: { fontSize: 13, lineHeight: 18, flex: 1 },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
