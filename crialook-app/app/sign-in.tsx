import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { haptic } from '@/lib/haptics';
import { useSignIn } from '@clerk/clerk-expo';
import { Button, Input } from '@/components/ui';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';
import { MeshGradient } from '@/components/skia';
import { toast } from '@/lib/toast';
import { clerkErrorMessage } from '@/lib/clerkErrors';

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signIn, setActive, isLoaded } = useSignIn();
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSignIn = async () => {
    if (!isLoaded || !signIn) return;
    if (!email.trim()) { setError(t('signIn.fillEmail')); return; }
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setError(t('signIn.invalidEmail')); return; }
    if (!password) { setError(t('signIn.fillPassword')); return; }

    setLoading(true);
    setError('');
    try {
      haptic.press();
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete' && setActive) {
        await setActive({ session: result.createdSessionId });
      }
    } catch (e: unknown) {
      setError(clerkErrorMessage(e, t, 'signIn.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      toast.warning(t('signIn.forgotPromptMissingEmail'));
      return;
    }
    if (!isLoaded || !signIn) return;
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: trimmed,
      });
      // Important confirmation but action is "check inbox" — toast is enough
      // and doesn't block. Longer duration so user reads the email reference.
      toast.success(t('signIn.forgotEmailSentBody', { email: trimmed }), {
        durationMs: 6000,
      });
    } catch {
      toast.error(t('signIn.forgotError'));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Subtle brand mesh — same atmosphere as onboarding, lower opacity so
          inputs and labels stay legible. Drifts slowly: ~14-18s per blob. */}
      <MeshGradient
        opacity={colorScheme === 'dark' ? 0.28 : 0.14}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors.brand.primary }]} accessibilityRole="header">
          {t('signIn.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('signIn.subtitle')}</Text>

        <GoogleSignInButton />

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerLabel, { color: colors.textSecondary }]}>{t('signIn.orDivider')}</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Input
          label={t('signIn.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <Input
          label={t('signIn.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
        />
        {/* Inline error sits between the last input and the submit button —
            Material 3 / iOS form pattern. The user reads the failure right
            where she'll act, instead of scrolling back to a top banner. */}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            ⚠ {error}
          </Text>
        ) : null}
        <Button title={t('signIn.submit')} onPress={handleEmailSignIn} loading={loading} />

        <Pressable
          onPress={handleForgotPassword}
          accessibilityRole="link"
          accessibilityLabel={t('signIn.forgot')}
          hitSlop={8}
          style={{ minHeight: 40, justifyContent: 'center' }}
        >
          <Text style={[styles.forgotLink, { color: colors.textSecondary }]}>{t('signIn.forgot')}</Text>
        </Pressable>
        <Link href="/sign-up" style={[styles.link, { color: Colors.brand.primary }]} accessibilityRole="link">
          {t('signIn.noAccount')}
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 36, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 8, fontFamily: 'Inter_400Regular' },
  // Left-aligned, smaller, sits with the form (not the page hero). Reads as
  // form supporting text in Material 3 / HIG style.
  error: { color: Colors.brand.error, textAlign: 'left', fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: -8 },
  link: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 8 },
  forgotLink: { textAlign: 'center', fontSize: 13, marginTop: -4, fontFamily: 'Inter_400Regular' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
