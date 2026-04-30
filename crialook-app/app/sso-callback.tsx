/**
 * SSO callback target — Clerk redireciona o browser de volta pra cá
 * depois do flow OAuth (Google/Apple/etc). Não precisa de UI complexa:
 * o useSSO em sign-in.tsx/sign-up.tsx já trata o resultado e o AuthGate
 * leva o usuário pra rota certa assim que isSignedIn vira true.
 *
 * Visual: a thin layer of polish — instead of a generic ActivityIndicator,
 * we render the brand's particle loader over a soft mesh gradient. The
 * user is on this screen for ~200-800ms total; the visual just needs to
 * feel "the app is doing something for me" rather than "the app froze
 * mid-redirect".
 */
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { MeshGradient, ParticleLoader } from '@/components/skia';
import { useT } from '@/lib/i18n';

export default function SSOCallback() {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const { t } = useT();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MeshGradient opacity={scheme === 'dark' ? 0.4 : 0.22} style={StyleSheet.absoluteFill} />
      <ParticleLoader size={180} count={20} />
      <Text style={[styles.label, { color: colors.textSecondary }]} selectable>
        {t('signIn.sso.connecting' as any) || 'Conectando…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontSize: 14, fontWeight: '500', marginTop: 8 },
});
