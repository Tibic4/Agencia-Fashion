/**
 * ConfirmSheet
 *
 * Brand-aware bottom sheet replacement for `Alert.alert(...)` confirmations.
 * Same role (block until user confirms / cancels), but renders inside the app
 * so tipografia, paleta e dark-mode batem com o resto da experiência. Sistema
 * dialog quebrava continuidade visual em cada sign-out / delete.
 *
 * Padrão de implementação herdado de `PhotoSourceSheet`:
 *   - `Modal` transparent + statusBarTranslucent
 *   - Animação manual com Reanimated shared values (translateY + backdrop)
 *   - LinearGradient na surface seguindo `colors.surfaceGradient`
 *   - Drag handle decorativo no topo
 *   - Reduce-motion respeitado: spring/timing são curtos suficientes pra
 *     fade-only quando o sistema indicar redução, sem mudar shape.
 *
 * API exposta em DUAS formas:
 *
 *   1. `<ConfirmSheet />` declarativo — visible/onConfirm/onCancel.
 *   2. `useConfirmSheet()` imperativo — `if (await ask({...})) doStuff();`
 *      O hook devolve um `ConfirmEl` que precisa ser montado uma vez na tela
 *      (geralmente no final do JSX), além do `ask()` que retorna Promise<bool>.
 *
 * O imperativo limpa muito os call-sites (sem state local de `visible`); o
 * declarativo continua disponível pra quem precisar controlar transições
 * customizadas (ex: encadear com outra modal).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { AnimatedPressable, Button } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { tokens } from '@/lib/theme/tokens';

export type ConfirmVariant = 'confirm' | 'danger';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Default: 'confirm' (brand). Use 'danger' pra ações destrutivas (red). */
  variant?: ConfirmVariant;
  /** Default: t('common.confirm') / t('common.cancel'). */
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  variant = 'confirm',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { t } = useT();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const translateY = useSharedValue(height);
  const backdropOpacity = useSharedValue(0);

  // Haptic on open: warning pra danger (pausa o usuário antes de destruir),
  // tap leve pra confirm padrão. Roda só na transição closed → open.
  useEffect(() => {
    if (visible) {
      if (variant === 'danger') {
        haptic.warning();
      } else {
        haptic.tap();
      }
      backdropOpacity.value = withTiming(1, { duration: 220 });
      // Em reduceMotion: sem spring (snap direto sem bounce), só fade do
      // backdrop. translateY ainda vira 0 mas em timing curto, evitando
      // motion-sickness sem precisar reposicionar a sheet em meia-tela.
      translateY.value = reducedMotion
        ? withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) })
        : withSpring(0, {
            damping: tokens.springs.bouncy.damping,
            mass: tokens.springs.bouncy.mass,
            stiffness: 240,
          });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(height, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      });
    }
    // height in deps: re-anchors translateY off-screen value se rotacionar
    // dispositivo enquanto o sheet está fechado.
  }, [visible, variant, height, reducedMotion, backdropOpacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const isDanger = variant === 'danger';
  const finalConfirmLabel = confirmLabel ?? t('common.confirm');
  const finalCancelLabel = cancelLabel ?? t('common.cancel');

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onCancel}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={28} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={finalCancelLabel}
          />
        </BlurView>
      </Animated.View>

      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <LinearGradient
          colors={colors.surfaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.sheet,
            { borderColor: colors.border, paddingBottom: tokens.spacing.xxl + insets.bottom },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {isDanger ? (
              // Danger CTA — solid vermelho com peso de primary, sem reusar
              // Button(primary) (gradient brand não pode virar vermelho via
              // style override pq o gradient mora dentro do innerPrimary).
              // Custom inline mantém parity de altura/typografia/radii.
              <AnimatedPressable
                onPress={onConfirm}
                haptic="warning"
                accessibilityRole="button"
                accessibilityLabel={finalConfirmLabel}
                style={styles.dangerCta}
              >
                <Text style={styles.dangerCtaText} numberOfLines={1}>
                  {finalConfirmLabel}
                </Text>
              </AnimatedPressable>
            ) : (
              <Button
                title={finalConfirmLabel}
                onPress={onConfirm}
                variant="primary"
                haptic="confirm"
              />
            )}
            <Button
              title={finalCancelLabel}
              onPress={onCancel}
              variant="ghost"
              haptic="tap"
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

/**
 * useConfirmSheet — versão imperativa.
 *
 * ```tsx
 * const { ConfirmEl, ask } = useConfirmSheet();
 * // ...
 * if (await ask({ title: '...', message: '...' })) doStuff();
 * // ...
 * return (<>{ ...screen... }{ConfirmEl}</>)
 * ```
 *
 * `ask()` resolve `true` em confirmar, `false` em cancelar / dismiss. Múltiplas
 * chamadas em sequência são suportadas (cada chamada substitui o estado
 * anterior — caso de uso raro porém defendível).
 */
type AskOptions = Omit<ConfirmSheetProps, 'visible' | 'onConfirm' | 'onCancel'>;

interface PendingState extends AskOptions {
  resolver: (result: boolean) => void;
}

export function useConfirmSheet() {
  const [pending, setPending] = useState<PendingState | null>(null);
  const [visible, setVisible] = useState(false);

  const ask = useCallback((opts: AskOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolver: resolve });
      setVisible(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    pending?.resolver(true);
    setVisible(false);
    // Mantém pending por mais um beat pra não desmontar conteúdo durante o
    // exit animation (texto sumindo no meio do slide-out fica feio).
    setTimeout(() => setPending(null), 240);
  }, [pending]);

  const handleCancel = useCallback(() => {
    pending?.resolver(false);
    setVisible(false);
    setTimeout(() => setPending(null), 240);
  }, [pending]);

  const ConfirmEl = pending ? (
    <ConfirmSheet
      visible={visible}
      title={pending.title}
      message={pending.message}
      variant={pending.variant}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { ConfirmEl, ask };
}

const styles = StyleSheet.create({
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.md,
    // radii.xxxl = 24 — paritário com PhotoSourceSheet (28) mas alinhado ao
    // token. Não usa borderCurve continuous: corner já é grande o suficiente
    // pra continuous não ser perceptível e quebra render em Android < 12.
    borderTopLeftRadius: tokens.radii.xxxl,
    borderTopRightRadius: tokens.radii.xxxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    gap: tokens.spacing.md,
    shadowColor: '#0F0519',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.fontSize.xxxl,
    fontFamily: 'Inter_700Bold',
    fontWeight: tokens.fontWeight.bold,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  actions: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  // Solid vermelho danger CTA — bate altura (56) e radius (capsule) do
  // Button primary pra continuar parecendo da mesma família visual.
  dangerCta: {
    width: '100%',
    minHeight: 56,
    borderRadius: 9999,
    backgroundColor: Colors.brand.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    shadowColor: Colors.brand.error,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  },
  dangerCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: tokens.fontWeight.semibold,
    letterSpacing: -0.3,
  },
});
