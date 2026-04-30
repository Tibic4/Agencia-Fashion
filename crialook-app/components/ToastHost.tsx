/**
 * ToastHost — renderiza o toast atual de `lib/toast.ts`.
 *
 * Monta uma vez no root, ACIMA da navegação e ABAIXO da modal layer (flutua
 * sobre o conteúdo de tela mas sheet/modal ainda cobre). Auto-dismiss após
 * `durationMs`, re-render a cada `toast.*`.
 *
 * Visual: surface em pill bottom-aligned (slot snackbar do Material 3), tint
 * por kind: success=verde, error=vermelho, warning=âmbar, info=brand.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissCurrentToast, useCurrentToast, type ToastKind } from '@/lib/toast';
import Colors from '@/constants/Colors';
import { haptic } from '@/lib/haptics';

const ICONS: Record<ToastKind, React.ComponentProps<typeof FontAwesome>['name']> = {
  success: 'check-circle',
  error: 'exclamation-circle',
  warning: 'exclamation-triangle',
  info: 'info-circle',
};

const COLORS: Record<ToastKind, string> = {
  success: Colors.brand.success,
  error: Colors.brand.error,
  warning: Colors.brand.warning,
  info: Colors.brand.primary,
};

const DEFAULT_DURATION = 3500;

export function ToastHost() {
  const t = useCurrentToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!t) return;
    // Casa o haptic com o kind — pequeno mas reforça o sentido.
    if (t.kind === 'success') haptic.success();
    else if (t.kind === 'error') haptic.error();
    else if (t.kind === 'warning') haptic.warning();
    const timer = setTimeout(dismissCurrentToast, t.durationMs ?? DEFAULT_DURATION);
    return () => clearTimeout(timer);
  }, [t]);

  if (!t) return null;

  const accent = COLORS[t.kind];
  const icon = ICONS[t.kind];

  return (
    <Animated.View
      key={t.id}
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[
        styles.host,
        { paddingBottom: Math.max(insets.bottom, 16) + 80 /* livre acima da tab bar */ },
      ]}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { borderColor: accent }]}
      >
        <FontAwesome name={icon} size={16} color={accent} />
        <Text style={styles.text} numberOfLines={2} selectable>
          {t.text}
        </Text>
        {t.action && (
          <Pressable
            onPress={() => {
              t.action?.onPress();
              dismissCurrentToast();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.action.label}
          >
            <Text style={[styles.action, { color: accent }]}>{t.action.label.toUpperCase()}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1f1a25',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    maxWidth: 480,
    minWidth: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 12,
  },
  text: {
    color: '#fff',
    fontSize: 13.5,
    flex: 1,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  action: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
});
