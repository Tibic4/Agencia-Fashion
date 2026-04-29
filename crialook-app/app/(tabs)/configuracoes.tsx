import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Application from 'expo-application';
import * as MailComposer from 'expo-mail-composer';
import { Image } from 'expo-image';
import { AnimatedPressable, Button, Card, GradientText, Input, Skeleton } from '@/components/ui';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import { useTabContentPaddingBottom } from '@/components/tabBarLayout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { api, apiDelete, apiGetCached, apiPatch, invalidateApiCache } from '@/lib/api';
import { compressForUpload, buildFormDataFile } from '@/lib/images';
import { useT, type Locale } from '@/lib/i18n';

// Mantenha em sync com `app/onboarding.tsx` SEGMENTS — values têm que bater
// senão o segment salvo no onboarding nunca casa com a opção exibida aqui.
const segments = [
  { value: 'feminina', labelKey: 'segments.feminina' as const, emoji: '👗' },
  { value: 'masculina', labelKey: 'segments.masculina' as const, emoji: '👔' },
  { value: 'infantil', labelKey: 'segments.infantil' as const, emoji: '👶' },
  { value: 'plus_size', labelKey: 'segments.plus_size' as const, emoji: '💃' },
  { value: 'fitness', labelKey: 'segments.fitness' as const, emoji: '🏋️' },
  { value: 'intima', labelKey: 'segments.intima' as const, emoji: '🩱' },
  { value: 'praia', labelKey: 'segments.praia' as const, emoji: '👙' },
  { value: 'acessorios', labelKey: 'segments.acessorios' as const, emoji: '👜' },
  { value: 'multimarca', labelKey: 'segments.multimarca' as const, emoji: '🛍️' },
];

const DELETE_CONFIRMATION_WORD = 'EXCLUIR';

export default function ConfiguracoesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signOut, user } = useAuth();
  const { t, locale, setLocale } = useT();
  const router = useRouter();
  const headerH = useHeaderHeight();
  const padBottom = useTabContentPaddingBottom();

  const [storeName, setStoreName] = useState('');
  const [city, setCity] = useState('');
  const [stateUF, setStateUF] = useState('');
  const [instagram, setInstagram] = useState('');
  const [segment, setSegment] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiGetCached<{ data: any }>('/store', 5 * 60_000)
      .then(res => {
        const s = res.data;
        if (s) {
          setStoreName(s.name || '');
          setCity(s.city || '');
          setStateUF(s.state || '');
          setInstagram(s.instagram_handle || '');
          // Backfill: usuários do onboarding antigo gravaram `feminino`/`masculino`
          // (forma neutra/masculina). UI atual usa `feminina`/`masculina`.
          // Normaliza on-read pra mostrar a opção correta.
          const rawSegment: string = s.segment_primary || '';
          const segMap: Record<string, string> = { feminino: 'feminina', masculino: 'masculina' };
          setSegment(segMap[rawSegment] ?? rawSegment);
          setLogoUrl(s.logo_url || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingLogo(true);
    try {
      const compressed = await compressForUpload(result.assets[0], 'logo.jpg');
      const form = new FormData();
      form.append('logo', buildFormDataFile(compressed) as any);

      const res = await api<{ url: string }>('/store/logo', {
        method: 'POST',
        body: form,
      });
      setLogoUrl(res.url);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('errors.logoUploadFailed'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch('/store', {
        name: storeName,
        city,
        state: stateUF,
        instagram,
        segment,
      });
      invalidateApiCache('/store').catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert(t('common.error'), t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('auth.signOutConfirmTitle'), t('auth.signOutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.signOutConfirmTitle'), style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = async () => {
    const confirmWord = t('config.deleteConfirmationWord');
    if (deleteConfirmation.trim().toUpperCase() !== confirmWord) {
      Alert.alert(t('common.error'), t('errors.deleteConfirmationInvalid'));
      return;
    }
    setDeleting(true);
    try {
      await apiDelete('/me');
      await signOut();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('errors.deleteAccountFailed'));
    } finally {
      setDeleting(false);
    }
  };

  /* Loading state — espelha a estrutura real (4 cards: Identidade, Dados,
     Segmento, Idioma + botão Salvar). Antes mostrava só 2 cards rasos com
     poucos itens, e a "transição" do skeleton pro real era jarring (a tela
     parecia ficar muito mais cheia de uma hora pra outra). */
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={[styles.content, { paddingTop: headerH + 16, paddingBottom: padBottom }]}>
          {/* Hero: title + subtitle */}
          <Skeleton width={180} height={32} borderRadius={8} />
          <Skeleton width="75%" height={14} borderRadius={6} style={{ marginTop: 4 }} />

          {/* Card 1 — Identidade da marca: section title + logo + brand color + button */}
          <Card style={styles.section}>
            <Skeleton width="50%" height={18} borderRadius={6} />
            <View style={styles.logoRow}>
              <Skeleton width={80} height={80} borderRadius={16} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="40%" height={12} borderRadius={4} />
                <Skeleton width="80%" height={36} borderRadius={10} />
              </View>
            </View>
          </Card>

          {/* Card 2 — Dados da loja: section title + 4 input rows */}
          <Card style={styles.section}>
            <Skeleton width="40%" height={18} borderRadius={6} />
            <View style={{ gap: 10 }}>
              <Skeleton height={48} borderRadius={12} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Skeleton height={48} borderRadius={12} style={{ flex: 2 }} />
                <Skeleton height={48} borderRadius={12} style={{ flex: 1 }} />
              </View>
              <Skeleton height={48} borderRadius={12} />
            </View>
          </Card>

          {/* Card 3 — Segmento: section title + grid 2x2 de cards */}
          <Card style={styles.section}>
            <Skeleton width="35%" height={18} borderRadius={6} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} height={56} borderRadius={12} style={{ width: '31%' }} />
              ))}
            </View>
          </Card>

          {/* Save button */}
          <Skeleton height={48} borderRadius={14} />

          {/* Card 4 — Idioma */}
          <Card style={styles.section}>
            <Skeleton width="30%" height={18} borderRadius={6} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Skeleton height={44} borderRadius={12} style={{ flex: 1 }} />
              <Skeleton height={44} borderRadius={12} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: headerH + 16, paddingBottom: padBottom }} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        {/* Hero: full title rendered as fucsia gradient mask. */}
        <GradientText colors={Colors.brand.gradientPrimary} style={styles.title}>
          {t('config.titleHighlight')}
        </GradientText>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('config.subtitle')}
        </Text>

        {/* Logo */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('config.brandIdentity')}</Text>
          <View style={styles.logoRow}>
            <AnimatedPressable
              onPress={handleLogoUpload}
              haptic="tap"
              style={[styles.logoBox, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.uploadStoreLogo')}
            >
              {uploadingLogo ? (
                <ActivityIndicator color={Colors.brand.primary} />
              ) : logoUrl ? (
                /* contentFit="contain" — paritário com o site /configuracoes.
                   Logos circulares/quadradas (caso CriaLook) ocupam quase o
                   quadrado inteiro; retangulares cabem sem crop. */
                <Image source={{ uri: logoUrl }} style={styles.logoImg} contentFit="contain" />
              ) : (
                <Text style={{ fontSize: 32 }}>📷</Text>
              )}
            </AnimatedPressable>
            {/* Why View flex:1: Button defaults to width:100%, which on a row
                next to a 80px logoBox + 16px gap would overflow the Card on
                phones <380px (e.g. Galaxy S22 portrait). Wrapping in a
                flex:1 column constrains the Button to the leftover width. */}
            <View style={{ flex: 1 }}>
              <Button
                title={logoUrl ? t('config.changeLogo') : t('config.uploadLogo')}
                variant="secondary"
                onPress={handleLogoUpload}
              />
            </View>
          </View>
        </Card>

        {/* Store data */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('config.storeData')}</Text>
          <Input label={t('config.storeName')} value={storeName} onChangeText={setStoreName} />
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Input label={t('config.city')} value={city} onChangeText={setCity} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label={t('config.state')} value={stateUF} onChangeText={setStateUF} maxLength={2} autoCapitalize="characters" />
            </View>
          </View>
          <Input label={t('config.instagram')} value={instagram} onChangeText={setInstagram} placeholder="@sualoja" />
        </Card>

        {/* Segment */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('config.segment')}</Text>
          <View style={styles.segmentGrid}>
            {segments.map(seg => (
              <AnimatedPressable
                key={seg.value}
                onPress={() => setSegment(seg.value)}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={t(seg.labelKey)}
                accessibilityState={{ selected: segment === seg.value }}
                style={[
                  styles.segmentBtn,
                  { borderColor: colors.border },
                  segment === seg.value && { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
                ]}
              >
                <Text style={styles.segmentEmoji}>{seg.emoji}</Text>
                <Text
                  style={[styles.segmentLabel, { color: segment === seg.value ? '#fff' : colors.text }]}
                  numberOfLines={1}
                >
                  {t(seg.labelKey)}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </Card>

        <Button
          title={saving ? t('common.loading') : saved ? t('common.success') : t('common.save')}
          onPress={handleSave}
          loading={saving}
          disabled={saving}
        />

        {/* Language */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Idioma · Language</Text>
          <View style={styles.langRow}>
            {(['pt-BR', 'en'] as Locale[]).map(code => (
              <AnimatedPressable
                key={code}
                onPress={() => setLocale(code)}
                haptic="selection"
                accessibilityRole="button"
                accessibilityState={{ selected: locale === code }}
                style={[
                  styles.langBtn,
                  { borderColor: colors.border },
                  locale === code && {
                    backgroundColor: Colors.brand.primary,
                    borderColor: Colors.brand.primary,
                  },
                ]}
              >
                <Text style={{ fontSize: 20 }}>{code === 'pt-BR' ? '🇧🇷' : '🇺🇸'}</Text>
                <Text
                  style={[
                    styles.langLabel,
                    { color: locale === code ? '#fff' : colors.text },
                  ]}
                >
                  {code === 'pt-BR' ? 'Português' : 'English'}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </Card>

        {/* Sign out */}
        <View style={styles.signOutSection}>
          <Text style={[styles.signOutTitle, { color: colors.text }]}>{t('config.accountSecurity')}</Text>
          <Text style={[styles.signOutDesc, { color: colors.textSecondary }]}>{user?.email}</Text>
          <Button title={t('auth.signOut')} variant="outline" onPress={handleSignOut} style={{ borderColor: Colors.brand.error }} />
        </View>

        {/* Account deletion */}
        <Card style={[styles.dangerCard, { borderColor: 'rgba(239,68,68,0.4)' }]}>
          <Text style={[styles.dangerTitle, { color: Colors.brand.error }]}>{t('config.deleteAccount')}</Text>
          <Text style={[styles.dangerDesc, { color: colors.textSecondary }]}>
            {t('config.deleteAccountDesc')}
          </Text>
          {!showDeleteSection ? (
            <AnimatedPressable
              onPress={() => setShowDeleteSection(true)}
              haptic="warning"
              accessibilityRole="button"
              accessibilityLabel={t('config.deleteAccountStart')}
              style={styles.dangerToggle}
            >
              <Text style={[styles.dangerToggleText, { color: Colors.brand.error }]}>
                {t('config.deleteAccountStart')}
              </Text>
            </AnimatedPressable>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={[styles.dangerHint, { color: colors.text }]}>
                {t('config.deleteAccountConfirmHint')}
              </Text>
              <TextInput
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder={t('config.deleteConfirmationWord')}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t('config.deleteAccount')}
                style={[
                  styles.dangerInput,
                  { color: colors.text, borderColor: Colors.brand.error },
                ]}
              />
              <Button
                title={deleting ? t('common.loading') : t('config.deleteAccountConfirmButton')}
                variant="outline"
                onPress={handleDeleteAccount}
                loading={deleting}
                disabled={
                  deleting ||
                  deleteConfirmation.trim().toUpperCase() !== t('config.deleteConfirmationWord')
                }
                style={{ borderColor: Colors.brand.error }}
              />
              <AnimatedPressable
                onPress={() => {
                  setShowDeleteSection(false);
                  setDeleteConfirmation('');
                }}
                haptic="tap"
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={styles.dangerCancel}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  {t('common.cancel')}
                </Text>
              </AnimatedPressable>
            </View>
          )}
        </Card>

        {/* Legal — links to in-app legal screens (terms, privacy, dpo, etc.) */}
        <Card style={styles.legalCard}>
          <Text style={[styles.legalTitle, { color: colors.text }]}>Legal</Text>
          {(
            [
              { href: '/(legal)/termos', label: 'Termos de Uso' },
              { href: '/(legal)/privacidade', label: 'Política de Privacidade' },
              { href: '/(legal)/dpo', label: 'Encarregado (DPO)' },
              { href: '/(legal)/subprocessadores', label: 'Subprocessadores' },
              { href: '/(legal)/consentimento-biometrico', label: 'Consentimento Biométrico' },
            ] as const
          ).map((item) => (
            <AnimatedPressable
              key={item.href}
              onPress={() => router.push(item.href as any)}
              haptic="tap"
              accessibilityRole="link"
              accessibilityLabel={item.label}
              style={styles.legalLinkRow}
            >
              <Text style={[styles.legalLinkLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.legalChevron, { color: colors.textSecondary }]}>›</Text>
            </AnimatedPressable>
          ))}
        </Card>

        {/* Support & version */}
        <View style={styles.signOutSection}>
          <Button
            title={t('config.contactSupport')}
            variant="ghost"
            onPress={async () => {
              const body = `\n\n---\nApp: ${Application.nativeApplicationVersion} (${Application.nativeBuildVersion})\nOS: ${Platform.OS} ${Platform.Version}`;
              const subject = `Suporte CriaLook v${Application.nativeApplicationVersion || '1.0.0'}`;
              try {
                const available = await MailComposer.isAvailableAsync();
                if (!available) {
                  Alert.alert(
                    t('common.error'),
                    `suporte@crialook.com.br\n\n${body.trim()}`,
                  );
                  return;
                }
                await MailComposer.composeAsync({
                  recipients: ['suporte@crialook.com.br'],
                  subject,
                  body,
                });
              } catch {
                Alert.alert(
                  t('common.error'),
                  `suporte@crialook.com.br\n\n${body.trim()}`,
                );
              }
            }}
          />
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            CriaLook v{Application.nativeApplicationVersion || '1.0.0'} ({Application.nativeBuildVersion || '1'})
          </Text>
          {__DEV__ && (
            <AnimatedPressable
              onPress={() => router.push('/__catalog' as any)}
              haptic="tap"
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Open dev catalog"
              style={{ paddingVertical: 8, minHeight: 40, justifyContent: 'center' }}
            >
              <Text style={{ color: Colors.brand.primary, fontSize: 12, fontWeight: '600' }}>
                🧪 Dev catalog
              </Text>
            </AnimatedPressable>
          )}
        </View>
      </View>
    </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: '700' },
  // Why marginTop:-4 instead of -12: -12 made the subtitle visually attached
  // to the title's descenders (g, p) on Inter; -4 keeps the duo tight without
  // collision and matches the marketing site's hero spacing.
  subtitle: { fontSize: 14, marginTop: -4, marginBottom: 4 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', gap: 12 },
  segmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
  },
  segmentEmoji: { fontSize: 16 },
  segmentLabel: { fontSize: 13, fontWeight: '500' },
  signOutSection: { alignItems: 'center', paddingTop: 20, gap: 8 },
  signOutTitle: { fontSize: 18, fontWeight: '600' },
  signOutDesc: { fontSize: 14, marginBottom: 8 },
  versionText: { fontSize: 12, marginTop: 4 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
  },
  langLabel: { fontSize: 14, fontWeight: '600' },
  dangerCard: { gap: 12, borderWidth: 1.5, marginTop: 12 },
  legalCard: { gap: 4, marginTop: 12 },
  legalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  legalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 48,
  },
  legalLinkLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  legalChevron: { fontSize: 22, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  dangerTitle: { fontSize: 16, fontWeight: '700' },
  dangerDesc: { fontSize: 13, lineHeight: 19 },
  dangerToggle: { paddingVertical: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  dangerToggleText: { fontSize: 14, fontWeight: '700' },
  dangerHint: { fontSize: 13, lineHeight: 19 },
  dangerInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    minHeight: 48,
  },
  dangerCancel: { paddingVertical: 12, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
});
