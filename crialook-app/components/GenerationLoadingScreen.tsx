/**
 * GenerationLoadingScreen — site-parity, native-grade.
 *
 * Mirrors `crialook.com.br/gerar` loading state with mobile-only finishing:
 *   • Animated gradient blobs (brand fucsia + accent purple) that pulse
 *     behind the content. Same effect the site renders via CSS bg-pulse.
 *   • Floating particles drifting up — 4 dots, staggered, GPU-cheap.
 *   • Breathing ring around a phase-tinted icon with the elapsed timer
 *     stamped inside (so the user always sees progress without parsing
 *     a number out of context).
 *   • Categorized fashion facts carousel — auto-rotates every 6s with a
 *     coloured category badge + optional source. Pause control respects
 *     WCAG 2.2.2 (Pause/Stop/Hide).
 *   • Completion area with confetti, 3 stat cards, and the CTA.
 *
 * Navigation is intentionally **locked** while a generation is in flight:
 *   • Android hardware back consumed (BackHandler returns true).
 *   • Tab presses inside (tabs) layout cannot interrupt — the parent screen
 *     mounts this component as the entire return value, so even if the user
 *     navigates away mid-flight, the polling continues; but to avoid the
 *     half-broken UX of switching tabs and losing context, we also block
 *     the navigation `beforeRemove` event.
 *   • A "please wait" hint is shown for the first 4 s so the user
 *     understands the lock isn't a freeze.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Dimensions, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInUp,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { Button } from '@/components/ui';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT, type TKey } from '@/lib/i18n';
import { setNavigationLocked } from '@/lib/navigationLock';
import { Sentry } from '@/lib/sentry';
import { Confetti, MeshGradient } from '@/components/skia';
import { apiGet } from '@/lib/api';

type Phase = 'analyzing' | 'editorial' | 'shooting' | 'polishing' | 'almostDone';

function getPhase(elapsed: number, isComplete: boolean): Phase {
  if (isComplete) return 'polishing';
  if (elapsed < 12) return 'analyzing';
  if (elapsed < 30) return 'editorial';
  if (elapsed < 60) return 'shooting';
  if (elapsed < 85) return 'polishing';
  return 'almostDone';
}

// Phase config carries presentation tokens (icon, color) + an i18n title key.
// Status messages are also lookup keys so the locale toggle re-translates the
// running ticker without remounting the screen.
const PHASE_CONFIG: Record<Phase, { icon: string; titleKey: TKey; color: string }> = {
  analyzing: { icon: '\u{1F50D}', titleKey: 'loading.phaseAnalyzingTitle', color: '#818cf8' },
  editorial: { icon: '✍️', titleKey: 'loading.phaseEditorialTitle', color: '#f472b6' },
  shooting: { icon: '\u{1F4F8}', titleKey: 'loading.phaseShootingTitle', color: '#a855f7' },
  polishing: { icon: '✨', titleKey: 'loading.phasePolishingTitle', color: '#d946ef' },
  almostDone: { icon: '\u{1F3AF}', titleKey: 'loading.phaseAlmostDoneTitle', color: '#10b981' },
};

const STATUS_KEYS: Record<Phase, TKey[]> = {
  analyzing: [
    'loading.statusAnalyzing1',
    'loading.statusAnalyzing2',
    'loading.statusAnalyzing3',
    'loading.statusAnalyzing4',
  ],
  editorial: [
    'loading.statusEditorial1',
    'loading.statusEditorial2',
    'loading.statusEditorial3',
    'loading.statusEditorial4',
  ],
  shooting: [
    'loading.statusShooting1',
    'loading.statusShooting2',
    'loading.statusShooting3',
    'loading.statusShooting4',
  ],
  polishing: [
    'loading.statusPolishing1',
    'loading.statusPolishing2',
    'loading.statusPolishing3',
  ],
  almostDone: [
    'loading.statusAlmostDone1',
    'loading.statusAlmostDone2',
    'loading.statusAlmostDone3',
  ],
};

const PHASE_KEYS: Phase[] = ['analyzing', 'editorial', 'shooting', 'polishing'];

const PROGRESS_STEPS: { key: Phase; labelKey: TKey }[] = [
  { key: 'analyzing', labelKey: 'loading.stepAnalyzing' },
  { key: 'editorial', labelKey: 'loading.stepEditorial' },
  { key: 'shooting', labelKey: 'loading.stepShooting' },
  { key: 'polishing', labelKey: 'loading.stepPolishing' },
];

// ─── Categorized facts (parity with the site's FashionFactsCarousel) ────
// Why parallel-array instead of mutating `facts.*` schema: avoids touching the
// existing keys that other locales/tests depend on, and lets us evolve the
// metadata (emoji, category, source) without churning translations.
type FactCategoryKey =
  | 'loading.catCuriosity'
  | 'loading.catData'
  | 'loading.catTip'
  | 'loading.catTrend'
  | 'loading.catPsychology'
  | 'loading.catSocial';

interface FactMeta {
  textKey: TKey;
  emoji: string;
  categoryKey: FactCategoryKey;
  categoryColor: string;
  source?: string;
}

// 6-color category palette — same hues the site uses (data=cyan, tip=green,
// trend=fucsia, psychology=amber, social=violet, curiosity=pink-purple).
const CAT_COLOR = {
  curiosity: '#f472b6',
  data: '#06b6d4',
  tip: '#10b981',
  trend: '#d946ef',
  psychology: '#f59e0b',
  social: '#8b5cf6',
} as const;

const FACTS: FactMeta[] = [
  { textKey: 'facts.f1', emoji: '🤖', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data },
  { textKey: 'facts.f2', emoji: '💸', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data, source: 'McKinsey' },
  { textKey: 'facts.f3', emoji: '🎨', categoryKey: 'loading.catTip', categoryColor: CAT_COLOR.tip },
  { textKey: 'facts.f4', emoji: '🖼️', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data },
  { textKey: 'facts.f5', emoji: '💡', categoryKey: 'loading.catTip', categoryColor: CAT_COLOR.tip },
  { textKey: 'facts.f6', emoji: '👖', categoryKey: 'loading.catCuriosity', categoryColor: CAT_COLOR.curiosity, source: "Levi's Archives" },
  { textKey: 'facts.f7', emoji: '📊', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data },
  { textKey: 'facts.f8', emoji: '👗', categoryKey: 'loading.catCuriosity', categoryColor: CAT_COLOR.curiosity, source: 'Vogue' },
  { textKey: 'facts.f9', emoji: '🌎', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data, source: 'ABIT' },
  { textKey: 'facts.f10', emoji: '🖤', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data },
  { textKey: 'facts.f11', emoji: '🌱', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data },
  { textKey: 'facts.f12', emoji: '📸', categoryKey: 'loading.catData', categoryColor: CAT_COLOR.data, source: 'Shopify' },
  { textKey: 'facts.f13', emoji: '🩰', categoryKey: 'loading.catTip', categoryColor: CAT_COLOR.tip },
  { textKey: 'facts.f14', emoji: '📈', categoryKey: 'loading.catSocial', categoryColor: CAT_COLOR.social, source: 'Meta' },
  { textKey: 'facts.f15', emoji: '✨', categoryKey: 'loading.catTrend', categoryColor: CAT_COLOR.trend },
  { textKey: 'facts.f16', emoji: '🎯', categoryKey: 'loading.catPsychology', categoryColor: CAT_COLOR.psychology },
  { textKey: 'facts.f17', emoji: '📐', categoryKey: 'loading.catTip', categoryColor: CAT_COLOR.tip },
  { textKey: 'facts.f18', emoji: '#️⃣', categoryKey: 'loading.catSocial', categoryColor: CAT_COLOR.social },
];

const FACT_ROTATION_MS = 6000;

const CONFETTI_COLORS = ['#818cf8', '#f472b6', '#a855f7', '#d946ef', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'];
const CONFETTI_COUNT = 24;

function generateConfettiPieces() {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 300 - 150,
    y: -(Math.random() * 400 + 100),
    rotation: Math.random() * 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: Math.random() * 8 + 4,
    delay: Math.random() * 600,
  }));
}

function ConfettiPiece({ piece }: { piece: ReturnType<typeof generateConfettiPieces>[0] }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: 1200 }),
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [piece.y, 80], Extrapolation.CLAMP);
    const translateX = interpolate(progress.value, [0, 1], [0, piece.x], Extrapolation.CLAMP);
    const rotate = interpolate(progress.value, [0, 1], [0, piece.rotation], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    const scale = interpolate(progress.value, [0, 0.5, 1], [0, 1.2, 0.6], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: piece.size,
          height: piece.size * 0.6,
          backgroundColor: piece.color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

// ─── Animated background blobs (site parity: bg-pulse) ──────────────────
// Two giant blurred radial gradients sliding in opposite directions, opacity
// breathing 0.04 → 0.12. The fucsia / purple combo is identical to the site.
//
// Migrated from worklets to Reanimated 4 CSS animations: declarative ambient
// loop, no useSharedValue / useAnimatedStyle / useEffect dance. The two blobs
// breathe in counter-phase via animationDirection=alternate on each.
function GradientBlobs({ color1, color2 }: { color1: string; color2: string }) {
  const { width, height } = Dimensions.get('window');
  const size1 = Math.max(width, 360) * 0.95;
  const size2 = Math.max(width, 360) * 1.1;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -size1 * 0.25,
            left: -size1 * 0.2,
            width: size1,
            height: size1,
            borderRadius: size1,
            backgroundColor: color1,
            // Blob 1 grows + brightens forward, then alternates back.
            animationName: {
              '0%': { opacity: 0.15, transform: [{ scale: 1 }] },
              '100%': { opacity: 0.32, transform: [{ scale: 1.15 }] },
            },
            animationDuration: '6000ms',
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationTimingFunction: 'ease-in-out',
          } as any,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: -size2 * 0.3,
            right: -size2 * 0.2,
            width: size2,
            height: size2,
            borderRadius: size2,
            backgroundColor: color2,
            // Blob 2 starts in the opposite phase: large + dim → small + bright.
            // Same timing so they breathe coupled in counter-phase.
            animationName: {
              '0%': { opacity: 0.32, transform: [{ scale: 1.15 }] },
              '100%': { opacity: 0.15, transform: [{ scale: 1 }] },
            },
            animationDuration: '6000ms',
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationTimingFunction: 'ease-in-out',
          } as any,
        ]}
      />
      {/* Subtle dim overlay so blobs read as background light, not flat color. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      <View style={{ height, width: 0 }} />
    </View>
  );
}

// ─── Floating particles (4 dots) ───────────────────────────────────────
// CSS keyframes express the same opacity/translate envelope as the previous
// worklet: rises 40dp while drifting +8dp then -4dp horizontally, opacity
// breathes 0 → 0.4 → 0.15 → 0.3 → 0 over 8s. animationDelay handles the
// per-particle stagger without per-instance useSharedValue.
function Particle({ left, top, delay, size }: { left: string; top: string; delay: number; size: number }) {
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: left as `${number}%`,
          top: top as `${number}%`,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: '#f472b6',
          animationName: {
            '0%':   { opacity: 0,    transform: [{ translateY: 0 },   { translateX: 0 }] },
            '20%':  { opacity: 0.4,  transform: [{ translateY: -8 },  { translateX: 3 }] },
            '50%':  { opacity: 0.15, transform: [{ translateY: -20 }, { translateX: 8 }] },
            '80%':  { opacity: 0.3,  transform: [{ translateY: -32 }, { translateX: 2 }] },
            '100%': { opacity: 0,    transform: [{ translateY: -40 }, { translateX: -4 }] },
          },
          animationDuration: '8000ms',
          animationDelay: `${delay}ms`,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        } as any,
      ]}
    />
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}`;
  return `0:${secs.toString().padStart(2, '0')}`;
}

interface Props {
  isComplete: boolean;
  onViewResults: () => void;
  /** Optional — when provided, the loading screen prefetches the result
   *  images the moment `isComplete` flips true, so when the user taps
   *  "Ver fotos" the resultado screen renders instantly with everything
   *  warmed in the expo-image disk + memory cache. */
  campaignId?: string | null;
}

interface CampaignDetailPayload {
  data?: {
    images?: ({ imageUrl?: string } | null)[];
    lockedTeaserUrls?: [string, string];
  };
}

export function GenerationLoadingScreen({ isComplete, onViewResults, campaignId }: Props) {
  useKeepAwake();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const bgColor = '#0a0a14'; // Always dark — this is a "hero" screen, not a card.
  const { t } = useT();

  // ─── Lock navigation while generating ──────────────────────────────
  // Android hardware back: consume the event so the user can't bail out
  // mid-flight and lose the loading-screen context. Tab presses are blocked
  // by a global lock the tab bar reads (see `lib/navigationLock.ts`).
  useFocusEffect(
    useCallback(() => {
      if (isComplete) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [isComplete]),
  );

  // The lock toggles whenever this screen mounts/unmounts or the completion
  // state flips. Once `isComplete`, we release it — the user can safely tap
  // the CTA or any tab.
  useEffect(() => {
    setNavigationLocked(!isComplete);
    if (isComplete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    return () => setNavigationLocked(false);
  }, [isComplete]);

  // Prefetch result images the moment polling reports `completed` so resultado
  // screen lands with images already in expo-image cache. Even on flaky 4G the
  // user sees the hero photo without a spinner — premium "instant" feel.
  // Cancellation: if the user taps a tab and unmounts before fetch resolves,
  // we still prefetch into the cache (no-op on dispose since prefetch is
  // best-effort). Errors are swallowed — prefetch failures should never gate
  // the success flow.
  useEffect(() => {
    if (!isComplete || !campaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ data: CampaignDetailPayload }>(`/campaigns/${campaignId}`);
        if (cancelled) return;
        const urls: string[] = [];
        for (const img of res?.data?.data?.images ?? []) {
          if (img?.imageUrl) urls.push(img.imageUrl);
        }
        for (const teaser of res?.data?.data?.lockedTeaserUrls ?? []) {
          if (teaser) urls.push(teaser);
        }
        if (urls.length > 0) {
          // expo-image's prefetch warms both memory + disk cache. Returns a
          // promise of bool[] — we don't await individually.
          ExpoImage.prefetch(urls).catch(() => {});
        }
      } catch {
        /* swallow — prefetch is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isComplete, campaignId]);

  const [elapsed, setElapsed] = useState(0);
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * FACTS.length));
  const [factsPaused, setFactsPaused] = useState(false);

  // Breathing icon scale + ring opacity migrated to Reanimated 4 CSS API —
  // pure ambient loops, no state read needed. See `ringStyle` consumer below
  // (kept inline-styled via animationName instead of useAnimatedStyle).

  useEffect(() => {
    if (isComplete) return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isComplete]);

  const factOpacity = useSharedValue(1);

  const advanceFact = useCallback(() => {
    setFactIndex((prev) => (prev + 1) % FACTS.length);
  }, []);

  useEffect(() => {
    if (isComplete || factsPaused) return;
    const timer = setInterval(() => {
      // Fade out, swap, fade in (handled by separate effect below).
      factOpacity.value = withTiming(0, { duration: 350 }, (finished) => {
        if (finished) {
          runOnJS(advanceFact)();
        }
      });
    }, FACT_ROTATION_MS);
    return () => clearInterval(timer);
  }, [isComplete, factsPaused, advanceFact]);

  // Fade in after factIndex changes — independent from the rotation timer so
  // manual swaps (via dot tap, future) also benefit from the transition.
  useEffect(() => {
    factOpacity.value = withTiming(1, { duration: 350 });
  }, [factIndex]);

  const factAnimStyle = useAnimatedStyle(() => ({
    opacity: factOpacity.value,
    transform: [{ translateY: interpolate(factOpacity.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
  }));

  const confettiPieces = useMemo(() => generateConfettiPieces(), []);

  const phase = getPhase(elapsed, isComplete);
  const config = PHASE_CONFIG[phase];
  const statusKeys = STATUS_KEYS[phase];
  const statusText = t(statusKeys[Math.floor(elapsed / 4) % statusKeys.length]);
  const currentPhaseIdx = PHASE_KEYS.indexOf(phase === 'almostDone' ? 'polishing' : phase);

  // Sentry breadcrumbs — each phase transition leaves a trail so we can
  // diagnose generations that stall on a specific stage (e.g. shooting).
  const lastPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastPhaseRef.current !== phase) {
      lastPhaseRef.current = phase;
      Sentry.addBreadcrumb({
        category: 'generation',
        message: `phase:${phase}`,
        level: 'info',
        data: { elapsed },
      });
    }
  }, [phase, elapsed]);

  // Breathing ring style — CSS keyframes for scale + opacity, paired
  // counter-phase (when scale peaks at 1.08, opacity dips to 0.2).
  const ringStyle = {
    animationName: {
      '0%':   { transform: [{ scale: 1 }],    opacity: 0.6 },
      '50%':  { transform: [{ scale: 1.08 }], opacity: 0.2 },
      '100%': { transform: [{ scale: 1 }],    opacity: 0.6 },
    },
    animationDuration: '3000ms',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  } as any;

  const togglePauseFacts = useCallback(() => {
    setFactsPaused((p) => !p);
  }, []);

  const fact = FACTS[factIndex];
  const factText = t(fact.textKey);
  const factCategory = t(fact.categoryKey as TKey);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Status bar must read as light over the dark hero — the OS otherwise
          inherits whatever the previous screen had. iOS auto-restores on
          unmount; on Android the StatusBar component handles it both ways. */}
      <StatusBar style="light" backgroundColor="transparent" translucent />

      {/* Animated gradient blobs — site parity. Kept as the base layer because
          the existing implementation pulses the *current phase color* (which
          we still want — the screen visibly changes hue per phase). */}
      <GradientBlobs color1={config.color} color2="#a855f7" />

      {/* MeshGradient adds a slow-drifting brand wash on top of the blobs.
          This brings the same Skia-driven atmosphere we use on auth/onboarding
          into the long-form loading screen, so the visual language is
          consistent across the app's "atmosphere" moments. Low opacity so
          the phase-coloured blobs still drive the dominant hue. */}
      <MeshGradient opacity={0.18} blurSigma={80} style={StyleSheet.absoluteFill} />

      {/* Floating particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Particle left="15%" top="22%" delay={0} size={3} />
        <Particle left="78%" top="18%" delay={2000} size={3} />
        <Particle left="22%" top="68%" delay={4000} size={4} />
        <Particle left="74%" top="62%" delay={6000} size={3} />
      </View>

      {/* Live region for screenreaders */}
      <Text style={styles.srOnly} accessibilityLiveRegion="polite">
        {isComplete ? t('loading.completedTitle') : `${t(config.titleKey)}. ${statusText}.`}
      </Text>

      <View style={styles.content}>
        {/* Icon with breathing ring */}
        <View style={styles.iconArea}>
          <Animated.View
            style={[
              styles.breathingRing,
              { borderColor: `${config.color}66` },
              ringStyle,
            ]}
          />
          <View
            style={[
              styles.emojiIcon,
              {
                backgroundColor: config.color,
                shadowColor: config.color,
              },
            ]}
          >
            {isComplete ? (
              <Text style={styles.emojiText}>{'\u{1F389}'}</Text>
            ) : (
              <>
                <Text style={styles.emojiText}>{config.icon}</Text>
                <Text style={styles.timerInside}>{formatTime(elapsed)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Title */}
        <Animated.Text entering={FadeIn} key={`title-${phase}-${isComplete}`} style={styles.title}>
          {isComplete ? t('loading.completedTitle') : t(config.titleKey)}
        </Animated.Text>

        {/* Status message */}
        {!isComplete && (
          <Animated.Text entering={FadeIn} exiting={FadeOut} key={`status-${phase}-${statusText}`} style={styles.status}>
            {statusText}
          </Animated.Text>
        )}

        {/* Progress bar + step labels */}
        {!isComplete && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: config.color,
                    width: `${Math.min(((currentPhaseIdx + 1) / PROGRESS_STEPS.length) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.stepsRow}>
              {PROGRESS_STEPS.map((step, i) => {
                const isActive = i === currentPhaseIdx;
                const isDone = i < currentPhaseIdx;
                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        isDone && { backgroundColor: config.color },
                        isActive && { backgroundColor: config.color, ...styles.stepDotActive },
                      ]}
                    />
                    <Text
                      style={[
                        styles.stepLabel,
                        (isActive || isDone) && { color: 'rgba(255,255,255,0.7)' },
                      ]}
                    >
                      {t(step.labelKey)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Time hint + please-wait nudge */}
        {!isComplete && elapsed < 4 && (
          <Text style={styles.hint}>{t('loading.pleaseWait')}</Text>
        )}
        {!isComplete && elapsed >= 4 && elapsed < 15 && (
          <Text style={styles.hint}>{t('loading.durationHint')}</Text>
        )}

        {/* Categorized fact card */}
        {!isComplete && (
          <Animated.View style={[styles.factCard, factAnimStyle]}>
            <View style={styles.factHeader}>
              <Text style={styles.factEmoji}>{fact.emoji}</Text>
              <Text style={[styles.factCategory, { color: fact.categoryColor }]}>
                {factCategory.toUpperCase()}
              </Text>
              <View style={{ flex: 1 }} />
              <Text
                accessibilityRole="button"
                accessibilityLabel={factsPaused ? 'Retomar curiosidades' : 'Pausar curiosidades'}
                onPress={togglePauseFacts}
                suppressHighlighting
                style={styles.pauseBtn}
              >
                {factsPaused ? '▶' : '⏸'}
              </Text>
            </View>
            <Text style={styles.factText}>{factText}</Text>
            {/* Slot sempre renderizado (mesmo vazio) pra altura ficar estável entre facts com e sem source. */}
            <Text style={styles.factSource}>{fact.source ? `— ${fact.source}` : ' '}</Text>
            {/* Dots */}
            <View style={styles.factDots}>
              {Array.from({ length: 5 }).map((_, i) => {
                const active = factIndex % 5 === i;
                return (
                  <View
                    key={i}
                    style={[
                      styles.factDot,
                      active && { backgroundColor: config.color, width: 16 },
                    ]}
                  />
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Completion */}
        {isComplete && (
          <>
            {/* Skia confetti — GPU-thread, ~60 particles with gravity arc.
                Keeps the original DIY confetti as a fallback visual layer
                because it's already wired and the Skia burst is additive
                celebration, not replacement. */}
            <Confetti count={70} durationMs={2400} />

            {/* Legacy confetti (kept) */}
            <View style={styles.confettiContainer} pointerEvents="none">
              {confettiPieces.map((piece) => (
                <ConfettiPiece key={piece.id} piece={piece} />
              ))}
            </View>

            <Animated.Text
              entering={FadeIn.delay(200)}
              style={styles.completionTitle}
            >
              {t('loading.completedHero')}
            </Animated.Text>

            <Animated.View entering={FadeInUp.delay(500)} style={styles.resultArea}>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>3</Text>
                  <Text style={styles.statLabel}>{t('loading.statPhotos')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formatTime(elapsed)}</Text>
                  <Text style={styles.statLabel}>{t('loading.statTime')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>HD</Text>
                  <Text style={styles.statLabel}>{t('loading.statQuality')}</Text>
                </View>
              </View>
              <Button title={t('loading.viewPhotos')} onPress={onViewResults} />
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 14,
    width: '100%',
    maxWidth: 380,
    zIndex: 1,
  },
  iconArea: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  breathingRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  emojiIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  emojiText: { fontSize: 32 },
  timerInside: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  status: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', minHeight: 20 },
  progressContainer: { width: '100%', gap: 10, marginTop: 4 },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    textAlign: 'center',
  },
  hint: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center' },
  // ─── Fact card ─────────────────────────────────────────────
  /* Why minHeight: o texto da curiosidade varia de 1 a 4 linhas. Sem isso o
     card encolhe/expande a cada rotação (6s) e a tela inteira pula. Fixamos
     altura suficiente pro pior caso (4 linhas + source) e deixamos o conteúdo
     alinhado ao topo — espaço extra fica em branco em facts mais curtas, que
     é o padrão usado em apps tipo Duolingo/Instagram em loaders rotativos. */
  factCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 6,
    minHeight: 168,
    justifyContent: 'flex-start',
  },
  factHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factEmoji: { fontSize: 18, lineHeight: 22 },
  factCategory: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  pauseBtn: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 28,
    minHeight: 28,
    textAlign: 'center',
  },
  /* Slot fixo de 4 linhas (4 × 20 lineHeight) — evita pulo entre fact curta e longa.
     Texto se ancora no topo; sobra preenche com whitespace. */
  factText: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20, minHeight: 80 },
  /* minHeight reserva slot mesmo quando fact não tem source (evita +/− 16px). */
  factSource: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontStyle: 'italic', minHeight: 16 },
  factDots: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    marginTop: 8,
    height: 6,
    alignItems: 'center',
  },
  factDot: {
    width: 5,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  // ─── Completion ────────────────────────────────────────────
  confettiContainer: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  completionTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 4,
  },
  resultArea: { width: '100%', gap: 16, marginTop: 8 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    gap: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stat: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
});
