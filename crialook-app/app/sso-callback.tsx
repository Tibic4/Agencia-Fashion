/**
 * SSO callback target — Clerk redireciona o browser de volta pra cá
 * depois do flow OAuth (Google/Apple/etc). Não precisa de UI complexa:
 * o useSSO em sign-in.tsx/sign-up.tsx já trata o resultado e o AuthGate
 * leva o usuário pra rota certa assim que isSignedIn vira true.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function SSOCallback() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={Colors.brand.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
