/**
 * Legal stack — minimal header that respects the design tokens.
 *
 * Why a separate stack:
 *   - These screens are linked from `configuracoes` and from the biometric
 *     consent modal. They aren't tabs; they're a flow with back navigation.
 *   - We want a clean Stack header (back arrow + title) instead of the
 *     glassy AppHeader used inside (tabs).
 */
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function LegalLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Inter_700Bold',
          fontSize: 17,
          color: colors.text,
        },
        headerBackTitle: 'Voltar',
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="termos" options={{ title: 'Termos de Uso' }} />
      <Stack.Screen name="privacidade" options={{ title: 'Privacidade' }} />
      <Stack.Screen name="dpo" options={{ title: 'Encarregado (DPO)' }} />
      <Stack.Screen name="subprocessadores" options={{ title: 'Subprocessadores' }} />
      <Stack.Screen
        name="consentimento-biometrico"
        options={{ title: 'Consentimento Biométrico' }}
      />
    </Stack>
  );
}
