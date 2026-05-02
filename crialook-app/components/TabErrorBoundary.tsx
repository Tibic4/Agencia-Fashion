/**
 * TabErrorBoundary — isolamento de falha por tab.
 *
 * O `AppErrorBoundary` root é catch-all — se /modelo crasha, a árvore de
 * render dele estoura e o app INTEIRO vira tela de erro, mesmo com
 * /historico e /plano renderizando bem. Boundary por tab deixa uma tela
 * ruim falhar no lugar enquanto o resto (header, tabs, outras telas)
 * continua funcionando. Usuário troca de tab e recupera a sessão.
 *
 * Padrão: card inline pequeno com retry — diferente do `AppErrorBoundary`
 * full-screen pq aqui só temos o real estate da tab, não a janela inteira.
 * Sentry capture continua disparando.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { tokens } from '@/lib/theme/tokens';
import { Sentry } from '@/lib/sentry';

interface State {
  error: Error | null;
}

interface Props extends React.PropsWithChildren {
  /** Nome da tela — vai como tag Sentry pra filtrar dashboards. */
  screen: string;
}

export class TabErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.warn(`[TabErrorBoundary:${this.props.screen}]`, error, info.componentStack);
    }
    try {
      Sentry.captureException(error, {
        tags: { screen: this.props.screen, scope: 'tab-boundary' },
        contexts: { react: { componentStack: info.componentStack } },
      });
    } catch {
      /* nunca dá throw do boundary */
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>{'\u{1F614}'}{/* 😔 */}</Text>
        <Text style={styles.title}>Esta tela travou</Text>
        <Text style={styles.desc} selectable>
          Toca em "Tentar de novo" — as outras abas continuam funcionando
          normalmente.
        </Text>
        {/* Mensagem visível em release enquanto Sentry DSN não está
            configurado nas builds preview. Reverter pra `__DEV__` depois
            que o EXPO_PUBLIC_SENTRY_DSN entrar no eas.json. */}
        {!!this.state.error.message && (
          <Text style={styles.errorText} numberOfLines={8} selectable>
            {this.state.error.message}
          </Text>
        )}
        <Pressable
          onPress={this.reset}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Tentar de novo"
          android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
        >
          <Text style={styles.buttonText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: tokens.fontWeight.bold, color: Colors.dark.text },
  desc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    color: Colors.dark.textSecondary,
  },
  errorText: {
    color: Colors.brand.error,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'rgba(239,68,68,0.08)',
    padding: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    marginTop: 8,
    width: '100%',
  },
  button: {
    marginTop: 12,
    backgroundColor: Colors.brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderCurve: 'continuous',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: tokens.fontWeight.bold },
});
