/**
 * Botão "Continuar com Google" — usa o flow SSO do Clerk Expo.
 *
 * Why useSSO (vs. legacy useOAuth):
 *   - Suporta o native authentication flow (Google Sign-In nativo no Android/iOS
 *     quando configurado), com fallback automático pro browser flow quando o
 *     usuário não tem Google logado no device.
 *   - É o caminho recomendado a partir do @clerk/clerk-expo v2.
 *
 * Pré-requisitos no Clerk Dashboard:
 *   - Native applications habilitado (já feito).
 *   - Google OAuth provider ativado em "User & Authentication → Social Connections".
 *   - Em produção precisa adicionar credenciais Google próprias (OAuth Client ID
 *     do Google Cloud Console). Em dev a Clerk usa as credenciais shared dela.
 */
import { useState, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSSO } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { haptic } from '@/lib/haptics';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';

// Ícone Google em SVG inline. Mantemos sem dependência extra.
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: '#fff',
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
    >
      <Text style={{ fontSize: size * 0.7, fontWeight: '700', color: '#4285F4' }}>G</Text>
    </View>
  );
}

export function GoogleSignInButton() {
  const { startSSOFlow } = useSSO();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useT();
  const [loading, setLoading] = useState(false);

  const onPress = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      haptic.press();
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        // Where the browser redirects back to. Has to match a route in app/.
        redirectUrl: Linking.createURL('/sso-callback'),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // AuthGate em app/_layout.tsx vai redirecionar pra /onboarding ou /(tabs)/gerar.
      }
      // Se createdSessionId for null, o flow exigiu MFA/extra steps. Por ora
      // não tratamos esse caso (raro com Google) — o usuário cai de volta na
      // tela de sign-in e pode tentar de novo ou usar email/senha.
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage || e?.message;
      // Cancelamento do user (fechou o browser) não vira erro visível.
      if (msg && !/cancel|dismiss/i.test(msg)) {
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, startSSOFlow, t]);

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t('signIn.googleButton')}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: pressed || loading ? 0.7 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <GoogleLogo />
          <Text style={[styles.label, { color: colors.text }]}>
            {t('signIn.googleButton')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
