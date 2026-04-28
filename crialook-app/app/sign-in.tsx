import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { haptic } from '@/lib/haptics';
import { useSignIn } from '@clerk/clerk-expo';
import { Button, Input } from '@/components/ui';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';

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
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage || e?.message || t('signIn.genericError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      Alert.alert(t('signIn.forgotTitle'), t('signIn.forgotPromptMissingEmail'));
      return;
    }
    if (!isLoaded || !signIn) return;
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: trimmed,
      });
      Alert.alert(
        t('signIn.forgotEmailSentTitle'),
        t('signIn.forgotEmailSentBody', { email: trimmed }),
      );
    } catch {
      Alert.alert(t('common.error'), t('signIn.forgotError'));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors.brand.primary }]} accessibilityRole="header">
          {t('signIn.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('signIn.subtitle')}</Text>

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

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
  error: { color: Colors.brand.error, textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium' },
  link: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 8 },
  forgotLink: { textAlign: 'center', fontSize: 13, marginTop: -4, fontFamily: 'Inter_400Regular' },
});
