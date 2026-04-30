/**
 * Botão "Continuar com Google" — Material 3 spec'd.
 *
 * Why useSSO (vs. legacy useOAuth):
 *   - Suporta o native authentication flow (Google Sign-In nativo no Android/iOS
 *     quando configurado), com fallback automático pro browser flow quando o
 *     usuário não tem Google logado no device.
 *   - É o caminho recomendado a partir do @clerk/clerk-expo v2.
 *
 * Visual: white surface, 1dp border, 4-color official Google "G" mark, ripple
 * tinted neutral grey on Android (Material 3 spec for outlined button on
 * neutral surface). The "G" is rendered as 4 colored arcs (the published
 * Google brand mark) in SVG-equivalent JSX — no extra dependency.
 *
 * Pré-requisitos no Clerk Dashboard:
 *   - Native applications habilitado.
 *   - Google OAuth provider ativado em "User & Authentication → Social Connections".
 *   - Em produção precisa adicionar credenciais Google próprias (OAuth Client ID
 *     do Google Cloud Console). Em dev a Clerk usa as credenciais shared dela.
 */
import { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSSO } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { haptic } from '@/lib/haptics';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';
import { toast } from '@/lib/toast';

/**
 * Google "G" mark — 4-quadrant approximation of the official 4-color logo.
 * The official mark is a single arc with 4 color segments. We approximate
 * with a circle quartered into the 4 brand colors. Close enough at 18dp for
 * users to recognise; lighter than bundling an SVG.
 */
function GoogleLogo({ size = 18 }: { size?: number }) {
  const half = size / 2;
  return (
    <View
      style={{ width: size, height: size, position: 'relative' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* 4 quadrants — Google brand colors. */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: half, backgroundColor: '#4285F4', borderTopLeftRadius: half }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: half, height: half, backgroundColor: '#EA4335', borderTopRightRadius: half }} />
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: half, height: half, backgroundColor: '#FBBC05', borderBottomRightRadius: half }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: half, height: half, backgroundColor: '#34A853', borderBottomLeftRadius: half }} />
      {/* White inner notch — gives the "G" its open-arc feel without an SVG. */}
      <View
        style={{
          position: 'absolute',
          top: half - half * 0.55,
          left: half - half * 0.55,
          width: half * 1.1,
          height: half * 1.1,
          borderRadius: half * 0.6,
          backgroundColor: '#fff',
        }}
      />
      {/* Inner letter mark — bold "G" overlaid centred. */}
      <Text
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          textAlign: 'center',
          textAlignVertical: 'center',
          lineHeight: size,
          fontSize: size * 0.7,
          fontWeight: '700',
          color: '#4285F4',
        }}
      >
        G
      </Text>
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
        redirectUrl: Linking.createURL('/sso-callback'),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage || e?.message;
      if (msg && !/cancel|dismiss/i.test(msg)) {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, startSSOFlow, t]);

  // Material 3 outlined button on neutral surface: 1dp border, 12dp corner,
  // ripple tinted neutral. We use the device colors so dark-mode keeps the
  // brand surface; light-mode uses pure white per Google brand guidelines.
  const surfaceColor = colorScheme === 'dark' ? colors.cardElevated : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t('signIn.googleButton')}
      android_ripple={{ color: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: surfaceColor,
          borderColor: colors.border,
          opacity: pressed || loading ? 0.85 : 1,
          // Material 3 elevation 1: subtle shadow that lifts the surface
          // off the page without floating it.
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
        } as any,
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
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    minHeight: 50,
    overflow: 'hidden',
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.1,
  },
});
