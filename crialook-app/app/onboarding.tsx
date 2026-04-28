import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { haptic } from '@/lib/haptics';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Button } from '@/components/ui';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiPost } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface StoreData {
  name: string;
  segment: string;
  city: string;
  instagram: string;
}

const SEGMENTS = [
  { value: 'feminino', labelKey: 'segments.feminino' as const },
  { value: 'masculino', labelKey: 'segments.masculino' as const },
  { value: 'infantil', labelKey: 'segments.infantil' as const },
  { value: 'fitness', labelKey: 'segments.fitness' as const },
  { value: 'praia', labelKey: 'segments.praia' as const },
  { value: 'intima', labelKey: 'segments.intima' as const },
  { value: 'acessorios', labelKey: 'segments.acessorios' as const },
  { value: 'multimarca', labelKey: 'segments.multimarca' as const },
];

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [storeData, setStoreData] = useState<StoreData>({
    name: '',
    segment: '',
    city: '',
    instagram: '',
  });

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return storeData.name.trim().length > 0;
    if (step === 2) return storeData.segment.length > 0;
    if (step === 3) return true;
    return true;
  };

  const handleNext = async () => {
    haptic.tap();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    try {
      // Backend `/store/onboarding` (não `/store`): cria a loja + opcionalmente
      // um modelo virtual inicial. Field names diferem dos do form local —
      // mapeamos aqui em vez de renomear o state pra preservar o vocabulário
      // que o usuário lê na UI ("nome da loja" → state.name).
      await apiPost('/store/onboarding', {
        storeName: storeData.name.trim(),
        segment: storeData.segment,
        city: storeData.city.trim() || undefined,
        instagram: storeData.instagram.trim().replace('@', '') || undefined,
        // Mobile não pede state/brandColor/model no onboarding — backend trata
        // ausência criando só a store. Deixar undefined (não null) é
        // intencional: o JSON.stringify omite undefined, e o backend faz
        // `body.state || undefined` por padrão.
      });
    } catch {
      // Falha silenciosa: usuário ainda navega para o app, o `/store/onboarding`
      // é idempotente (existing.store retorna 200 com mesma store), então
      // tentar de novo na próxima sessão funciona.
    } finally {
      setSaving(false);
    }
    router.replace('/(tabs)/gerar');
  };

  const steps = [
    <Animated.View key={0} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={styles.emoji}>{t('onboarding.welcomeEmoji')}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.welcomeTitle')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('onboarding.welcomeDesc')}
      </Text>
      <View style={styles.features}>
        {[
          t('onboarding.feature1'),
          t('onboarding.feature2'),
          t('onboarding.feature3'),
        ].map((f, i) => (
          <Text key={i} style={[styles.featureItem, { color: colors.text }]}>{f}</Text>
        ))}
      </View>
    </Animated.View>,

    <Animated.View key={1} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={styles.emoji}>🏪</Text>
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.storeNameTitle')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('onboarding.storeNameDesc')}
      </Text>
      <TextInput
        placeholder={t('onboarding.storeNamePlaceholder')}
        value={storeData.name}
        onChangeText={v => setStoreData(d => ({ ...d, name: v }))}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholderTextColor={colors.textSecondary}
        autoFocus
      />
    </Animated.View>,

    <Animated.View key={2} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={styles.emoji}>👗</Text>
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.segmentTitle')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('onboarding.segmentDesc')}
      </Text>
      <View style={styles.segmentGrid}>
        {SEGMENTS.map(s => (
          <Animated.View key={s.value} entering={FadeInRight.delay(SEGMENTS.indexOf(s) * 50)}>
            <Button
              title={t(s.labelKey)}
              variant={storeData.segment === s.value ? 'primary' : 'secondary'}
              onPress={() => {
                haptic.selection();
                setStoreData(d => ({ ...d, segment: s.value }));
              }}
              style={styles.segmentBtn}
            />
          </Animated.View>
        ))}
      </View>
    </Animated.View>,

    <Animated.View key={3} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.finalTitle')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('onboarding.finalDesc')}
      </Text>
      <TextInput
        placeholder={t('onboarding.cityPlaceholder')}
        value={storeData.city}
        onChangeText={v => setStoreData(d => ({ ...d, city: v }))}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        placeholder={t('onboarding.instagramPlaceholder')}
        value={storeData.instagram}
        onChangeText={v => setStoreData(d => ({ ...d, instagram: v }))}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
      />
    </Animated.View>,
  ];

  const ctaTitle =
    step === 0
      ? t('onboarding.cta0')
      : step < 3
      ? t('onboarding.ctaNext')
      : saving
      ? t('onboarding.ctaSaving')
      : t('onboarding.ctaFinish');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i <= step ? Colors.brand.primary : colors.border },
              i === step && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {steps[step]}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <Button
            title={t('onboarding.ctaBack')}
            variant="ghost"
            onPress={() => {
              haptic.tap();
              setStep(step - 1);
            }}
            style={{ flex: 1 }}
          />
        )}
        <Button
          title={ctaTitle}
          onPress={handleNext}
          disabled={!canProceed() || saving}
          style={{ flex: step > 0 ? 2 : 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  stepContent: { padding: 24, gap: 12, alignItems: 'center' },
  emoji: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  features: { gap: 8, marginTop: 8, alignSelf: 'stretch' },
  featureItem: { fontSize: 15, paddingVertical: 6, paddingHorizontal: 16 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginTop: 4,
  },
  segmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  segmentBtn: { paddingHorizontal: 16 },
  footer: { flexDirection: 'row', gap: 10, padding: 24, paddingBottom: 40 },
});
