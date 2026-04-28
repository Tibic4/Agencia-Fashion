import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { haptic } from '@/lib/haptics';
import { useSignUp } from '@clerk/clerk-expo';
import { Button, Input } from '@/components/ui';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';

export default function SignUpScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signUp, setActive, isLoaded } = useSignUp();
  const { t } = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    if (!email.trim()) { setError(t('signIn.fillEmail')); return; }
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setError(t('signIn.invalidEmail')); return; }
    if (password.length < 6) { setError(t('signUp.passwordTooShort')); return; }

    setLoading(true);
    setError('');
    try {
      haptic.press();
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage || e?.message || t('signUp.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete' && setActive) {
        await setActive({ session: result.createdSessionId });
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage || e?.message || t('signUp.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: Colors.brand.primary }]}>{t('signUp.verifyTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('signUp.verifySubtitle', { email })}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Input
            label={t('signUp.verifyCode')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoFocus
          />
          <Button title={t('signUp.verifySubmit')} onPress={handleVerify} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors.brand.primary }]} accessibilityRole="header">
          {t('signUp.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('signUp.subtitle')}</Text>

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

        <GoogleSignInButton />

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerLabel, { color: colors.textSecondary }]}>{t('signIn.orDivider')}</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Input
          label={t('signUp.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <Input
          label={t('signUp.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
        />
        <Button title={t('signUp.submit')} onPress={handleSignUp} loading={loading} />
        <Link href="/sign-in" style={[styles.link, { color: Colors.brand.primary }]} accessibilityRole="link">
          {t('signUp.haveAccount')}
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
  error: { color: Colors.brand.error, textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium' },
  link: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
