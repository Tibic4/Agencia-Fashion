/**
 * ModelBottomSheet
 *
 * Premium bottom-sheet preview for a fashion model in the Gerar screen.
 * Replaces the old centered modal so the user can:
 *   • Drag the sheet between 65% and 92% snap points
 *   • Pinch-to-zoom the photo (scale clamped 1..4) on the UI thread
 *   • Double-tap to toggle between 1x ↔ 2.5x with a spring
 *   • Pan around when zoomed in
 *
 * All gesture work is done with react-native-gesture-handler v2 + Reanimated 4
 * worklets, so it stays at 60fps even while the JS thread is busy.
 *
 * Architecture:
 *   - <BottomSheetModal> with snapPoints=['65%','92%'] and a blurred backdrop.
 *   - Header: drag handle (visible) + full-bleed image (top 60%) with gesture
 *     overlay (pinch + double-tap composed via Gesture.Simultaneous).
 *   - Body: name (Inter_700Bold 24), body type meta (Inter_400Regular 14),
 *     three info chips (skin/hair/body) and a primary fuchsia gradient CTA.
 *   - Haptics: Light on open (callsite), Heavy on confirm.
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { ModelItem } from '@/types';

// ─── Public API ───────────────────────────────────────────────────────────
export interface ModelBottomSheetRef {
  /** Opens the sheet for the supplied model. Plays Light haptic. */
  present: (model: ModelItem) => void;
  /** Programmatically dismiss. */
  dismiss: () => void;
}

interface Props {
  /** Called with the model id when the user taps "Selecionar modelo". */
  onSelect: (modelId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
// Open full-screen so the photo + meta + CTA all show without the user
// having to pan up. Pan-down still dismisses.
const SNAP_POINTS = ['100%'] as const;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

/* Lookup canônico de body_type (espelha bodyTypesFem/Masc do site em
   campanha-ia/src/app/(auth)/modelo/page.tsx). Inclui keys legadas
   (`normal`, `plus`, `masculino`) pra compat com models antigos. */
const BODY_LABEL: Record<string, string> = {
  // Femininos
  magra: 'Slim',
  media: 'Padrão',
  normal: 'Padrão',
  plus_size: 'Curvilínea',
  plus: 'Curvilínea',
  // Masculinos
  atletico: 'Atlético',
  medio: 'Padrão',
  masculino: 'Padrão',
  robusto: 'Robusto',
};

const MASC_BODIES = new Set(['atletico', 'medio', 'masculino', 'robusto']);

function readField(model: ModelItem, key: string): string | undefined {
  // `ModelItem` is a typed surface but the API can decorate it with extra
  // fields (skin_tone / hair_style) coming from /model/list. We read those
  // safely without `any`.
  const record = model as unknown as Record<string, unknown>;
  const v = record[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// ─── Component ────────────────────────────────────────────────────────────
export const ModelBottomSheet = forwardRef<ModelBottomSheetRef, Props>(
  function ModelBottomSheet({ onSelect }, ref) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const sheetRef = useRef<BottomSheetModal>(null);
    const [model, setModel] = React.useState<ModelItem | null>(null);

    // ─── Imperative handle ─────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        present: (m: ModelItem) => {
          setModel(m);
          // Reset zoom whenever a new model is loaded
          scale.value = 1;
          savedScale.value = 1;
          translateX.value = 0;
          translateY.value = 0;
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    // ─── Gesture state (worklet shared values) ────────────────────────
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const resetZoom = useCallback(() => {
      'worklet';
      scale.value = withSpring(1, { mass: 0.6, damping: 14 });
      savedScale.value = 1;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

    // Pinch
    const pinch = useMemo(
      () =>
        Gesture.Pinch()
          .onUpdate(e => {
            const next = savedScale.value * e.scale;
            scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
          })
          .onEnd(() => {
            savedScale.value = scale.value;
            if (scale.value < 1.05) {
              resetZoom();
            }
          }),
      [savedScale, scale, resetZoom],
    );

    // Double-tap (1x ↔ 2.5x)
    const doubleTap = useMemo(
      () =>
        Gesture.Tap()
          .numberOfTaps(2)
          .maxDelay(250)
          .onStart(() => {
            if (scale.value > 1.05) {
              resetZoom();
            } else {
              scale.value = withSpring(DOUBLE_TAP_SCALE, {
                mass: 0.6,
                damping: 14,
              });
              savedScale.value = DOUBLE_TAP_SCALE;
            }
          }),
      [scale, savedScale, resetZoom],
    );

    // Pan (only meaningful when zoom > 1)
    const pan = useMemo(
      () =>
        Gesture.Pan()
          .minPointers(1)
          .maxPointers(2)
          .onUpdate(e => {
            if (scale.value <= 1.01) return;
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
          })
          .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
          }),
      [savedTranslateX, savedTranslateY, scale, translateX, translateY],
    );

    const composed = useMemo(
      () => Gesture.Simultaneous(pinch, pan, doubleTap),
      [pinch, pan, doubleTap],
    );

    const imageStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }));

    // ─── Backdrop renderer (with blur look via opacity) ───────────────
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.6}
          pressBehavior="close"
        />
      ),
      [],
    );

    // ─── Confirm action ────────────────────────────────────────────────
    const handleConfirm = useCallback(() => {
      if (!model) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      onSelect(model.id);
      sheetRef.current?.dismiss();
    }, [model, onSelect]);

    // ─── Auto-clear local state on full dismiss ───────────────────────
    const handleChange = useCallback((index: number) => {
      if (index === -1) {
        runOnJS(setModel)(null);
      }
    }, []);

    // ─── Derived display fields ───────────────────────────────────────
    const bodyKey = model?.body_type ?? '';
    const genderField = model ? readField(model, 'gender') : undefined;
    const bodyLabel = BODY_LABEL[bodyKey] ?? bodyKey;
    const isCustom = !!model?.is_custom;

    /* Detecta gênero: prefere o campo `gender` (canônico) e cai no body_type
       quando ausente (models antigos não têm gender). Bug anterior fazia
       startsWith('homem') no bodyKey — nenhum dos values reais começa com
       "homem", então sempre retornava "Mulher" (Rafael aparecia como Mulher). */
    const isMale = genderField === 'masculino' || MASC_BODIES.has(bodyKey);
    const genderPrefix = isMale ? 'Homem' : 'Mulher';
    const richSubtitle = bodyLabel ? `${genderPrefix} ${bodyLabel}` : '';
    /* Concordância gramatical PT-BR: "Sua modelo" (fem) / "Seu modelo" (masc).
       Inglês não tem essa distinção — manter "Your model" se i18n vier. */
    const possessive = isMale ? 'Seu' : 'Sua';
    const metaText = isCustom && richSubtitle
      ? `⭐ ${possessive} modelo · ${richSubtitle}`
      : richSubtitle;

    const photoUri = model?.image_url || model?.photo_url || '';

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS as unknown as string[]}
        index={0}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onChange={handleChange}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{
          backgroundColor: colors.textSecondary,
          width: 40,
          height: 5,
          borderRadius: 3,
        }}
      >
        {model ? (
          <BottomSheetScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 32 + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Photo (full bleed, contain) ─────────────────────────
                Why contentFit="contain": the model photos vary in aspect
                ratio (full-body, 3/4-body, head-and-shoulders). "cover"
                was clipping heads/shoulders; "contain" guarantees the
                whole person is visible and lets the black backdrop
                handle the matte. Wrapper is 4:5 (taller than 3:4) so
                most full-body shots fill nearly the entire box. */}
            <View style={styles.photoWrapper}>
              <GestureDetector gesture={composed}>
                <Animated.View style={[styles.photoInner, imageStyle]}>
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.photo}
                      contentFit="contain"
                      transition={180}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View
                      style={[styles.photo, { backgroundColor: colors.border }]}
                    />
                  )}
                </Animated.View>
              </GestureDetector>
              {/* Glassmorphic close button — sits above status bar inset so
                  it never collides with the system clock/notch. */}
              <Pressable
                onPress={() => sheetRef.current?.dismiss()}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                hitSlop={14}
                style={[styles.closeBtn, { top: 12 + insets.top }]}
              >
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={styles.closeBtnInner}
                >
                  {/* Caractere "×" puro (U+00D7) em vez de FontAwesome "close":
                      em algumas versões do Android o glyph renderizava como
                      "X dentro de bolinha" (close-circle) por fallback de
                      fonte. Text simples é determinístico em todo dispositivo. */}
                  <Text style={styles.closeBtnText}>×</Text>
                </BlurView>
              </Pressable>
            </View>

            {/* Body ────────────────────────────────────────────────── */}
            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.text }]}>
                {model.name}
              </Text>
              {metaText ? (
                <Text
                  style={[
                    styles.meta,
                    { color: isCustom ? Colors.brand.primary : colors.textSecondary },
                  ]}
                >
                  {metaText}
                </Text>
              ) : null}

              {/* Chips removidos — paridade com o site (gerar/page.tsx),
                  que mostra apenas nome + subtitle simplificado + CTA.
                  Detalhes de pele/cabelo/corpo poluíam visualmente e já
                  estavam ambíguos (skin_tone vs hair_color etc). */}

              {/* CTA ──────────────────────────────────────────────── */}
              <Pressable
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel={`Selecionar modelo ${model.name}`}
                style={styles.ctaShadow}
              >
                <LinearGradient
                  colors={Colors.brand.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}
                >
                  <Text style={styles.ctaText}>Selecionar modelo</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </BottomSheetScrollView>
        ) : null}
      </BottomSheetModal>
    );
  },
);

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  photoWrapper: {
    width: '100%',
    // 4:5 portrait — taller than 3:4 so full-body shots have headroom and
    // we don't crop heads when the source image is closer to 9:16.
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  closeBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 18,
  },
  /* Tamanho/peso ajustados pra parecer ícone proporcional ao botão de 36px.
     line-height ajustado pra visualmente centralizar (× tem baseline alta). */
  closeBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: -2,
    includeFontPadding: false,
  },
  photoInner: {
    width: '100%',
    height: '100%',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  meta: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  ctaShadow: {
    marginTop: 20,
    width: '100%',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  cta: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
  },
});
