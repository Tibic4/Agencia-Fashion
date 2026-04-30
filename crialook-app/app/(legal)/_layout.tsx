/**
 * Legal stack — minimal header that respects the design tokens.
 *
 * Why a separate stack:
 *   - These screens are linked from `configuracoes` and from the biometric
 *     consent modal. They aren't tabs; they're a flow with back navigation.
 *   - We want a clean Stack header (back arrow + title) instead of the
 *     glassy AppHeader used inside (tabs).
 *
 * Reading-mode treatment:
 *   - `headerLargeTitle: true` on iOS gives Apple Mail / Notes-style large
 *     titles that collapse on scroll. On Android the option is ignored
 *     (regular header), so cross-platform safe.
 *   - `contentStyle.padding` is bumped to give the body breathing room
 *     when individual screens just dump <Markdown /> or <Text> children.
 *   - Stack animation `slide_from_right` matches the rest of the app's
 *     navigation rhythm (modal-style would feel jarring for legal flows).
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
        headerLargeTitle: true,
        headerLargeTitleStyle: {
          fontFamily: 'Inter_700Bold',
          fontSize: 30,
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
