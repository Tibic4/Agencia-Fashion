import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';

interface State {
  error: Error | null;
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
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😵</Text>
        <Text style={styles.title}>{t('errorBoundary.title')}</Text>
        <Text style={styles.desc}>{t('errorBoundary.description')}</Text>
        {__DEV__ && (
          <Text style={styles.errorText} numberOfLines={6}>
            {this.state.error.message}
          </Text>
        )}
        <Pressable
          onPress={this.reset}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.reloadApp')}
        >
          <Text style={styles.buttonText}>{t('errorBoundary.cta')}</Text>
        </Pressable>
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
    gap: 12,
  },
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
    marginTop: 12,
    width: '100%',
  },
  button: {
    marginTop: 16,
    backgroundColor: Colors.brand.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    minHeight: 48,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
