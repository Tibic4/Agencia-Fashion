/**
 * AppErrorBoundary — friendly, branded error surface.
 *
 * Why empathetic copy + brand visual: when the app crashes the user blames
 * themselves first ("o que eu fiz?") and the app second. A polite, blame-free
 * recovery screen with a clearly-marked button to retry restores trust.
 *
 * Sentry capture happens on `componentDidCatch`. The "Reportar" button below
 * triggers a user feedback dialog tied to the same Sentry event so the user
 * can attach context if she wants.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, Linking } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { Sentry } from '@/lib/sentry';

interface State {
  error: Error | null;
  eventId?: string;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.warn('[ErrorBoundary]', error, info.componentStack);
    }
    // Capture and stash the event id so the "Reportar" button can deep-link
    // the user to the same Sentry event with `EventId.last()` semantics.
    try {
      const eventId = Sentry.captureException(error, {
        contexts: { react: { componentStack: info.componentStack } },
      });
      this.setState({ eventId });
    } catch {
      /* swallow — never let the boundary itself throw */
    }
  }

  reset = () => {
    this.setState({ error: null, eventId: undefined });
  };

  reportToSupport = () => {
    const subject = `Erro no app — ${this.state.eventId ?? 'sem id'}`;
    const body =
      `Olá! Encontrei um erro no app:\n\n` +
      `Mensagem: ${this.state.error?.message ?? '(sem mensagem)'}\n` +
      `ID do evento: ${this.state.eventId ?? '(não capturado)'}\n\n` +
      `Conte aqui o que você estava fazendo quando o erro aconteceu — ajuda muito a corrigir.`;
    const url = `mailto:suporte@crialook.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {});
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        {/* Soft brand glow behind the emoji — anchors the screen to the app's
            identity even in the failure state. */}
        <View style={styles.haloWrap} pointerEvents="none">
          <LinearGradient
            colors={['rgba(217,70,239,0.18)', 'rgba(217,70,239,0)']}
            style={styles.halo}
          />
        </View>

        <Animated.View entering={FadeInDown.duration(360).springify()} style={styles.content}>
          <Text style={styles.emoji}>{'\u{1FAE3}'}{/* 🫣 face peeking — friendlier than 😵 */}</Text>
          <Text style={styles.title}>{t('errorBoundary.title')}</Text>
          <Text style={styles.desc} selectable>
            {t('errorBoundary.description')}
          </Text>

          {__DEV__ && (
            <Text style={styles.errorText} numberOfLines={6} selectable>
              {this.state.error.message}
            </Text>
          )}

          {/* Primary action — retry. Big brand-tinted button. */}
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.reloadApp')}
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
          >
            <Text style={styles.buttonText}>{t('errorBoundary.cta')}</Text>
          </Pressable>

          {/* Secondary — opens a pre-filled email to support with the Sentry
              event id. Quiet ghost link so it doesn't compete with retry. */}
          <Pressable
            onPress={this.reportToSupport}
            style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Reportar problema ao suporte"
            hitSlop={8}
          >
            <Text style={styles.reportText}>Reportar ao suporte</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16131a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  haloWrap: {
    position: 'absolute',
    top: '20%',
    width: 360,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: '100%',
    height: '100%',
    borderRadius: 200,
  },
  content: { alignItems: 'center', gap: 12 },
  emoji: { fontSize: 56 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  desc: { color: '#A1A1AA', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'rgba(239,68,68,0.08)',
    padding: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    marginTop: 12,
    width: '100%',
  },
  button: {
    marginTop: 16,
    backgroundColor: Colors.brand.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderCurve: 'continuous',
    minHeight: 48,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reportBtn: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: 'center',
  },
  reportText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
});
