import { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/lib/haptics';
import Animated, { FadeInRight, FadeOutLeft, FadeInDown } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Button, Input } from '@/components/ui';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiPost } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { MeshGradient } from '@/components/skia';
import { tokens } from '@/lib/theme/tokens';

interface StoreData {
  name: string;
  segment: string;
  city: string;
  instagram: string;
}

// Values precisam bater com `configuracoes.tsx` segments, senão o segment
// salvo no onboarding nunca casa com a opção exibida em Configurações.
const SEGMENTS = [
  { value: 'feminina', labelKey: 'segments.feminino' as const },
  { value: 'masculina', labelKey: 'segments.masculino' as const },
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
  const insets = useSafeAreaInsets();
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

  // Hardware back button no Android: navega entre steps em vez de sair do app.
  // No step 0 deixa o sistema lidar (sair do app), pra não prender o usuário.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        haptic.tap();
        setStep(s => s - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

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
      // Instagram: aceita "@user", "user", "https://instagram.com/user/", etc.
      // e devolve só o handle limpo. Sem isso, o backend gravava URL crua.
      const igInput = storeData.instagram.trim();
      const igMatch = igInput.match(/(?:instagram\.com\/)?@?([a-zA-Z0-9._]+)/);
      const igHandle = igMatch?.[1] || '';
      await apiPost('/store/onboarding', {
        storeName: storeData.name.trim(),
        segment: storeData.segment,
        city: storeData.city.trim() || undefined,
        instagram: igHandle || undefined,
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
    // Step 0 (welcome) gets a stagger across the inner blocks: emoji →
    // title → description → each feature row. Reads as "the app is
    // unfolding for you" instead of one slab fading in.
    <Animated.View key={0} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <Animated.View entering={FadeInDown.delay(80).duration(420).springify()}>
        <FontAwesome name="magic" size={48} color={Colors.brand.primary} />
      </Animated.View>
      <Animated.Text
        entering={FadeInDown.delay(160).duration(420).springify()}
        style={[styles.title, { color: colors.text }]}
      >
        {t('onboarding.welcomeTitle')}
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(240).duration(420).springify()}
        style={[styles.description, { color: colors.textSecondary }]}
      >
        {t('onboarding.welcomeDesc')}
      </Animated.Text>
      <View style={styles.features}>
        {[
          t('onboarding.feature1'),
          t('onboarding.feature2'),
          t('onboarding.feature3'),
        ].map((f, i) => (
          <Animated.Text
            key={i}
            entering={FadeInDown.delay(320 + i * 80).duration(380).springify()}
            style={[styles.featureItem, { color: colors.text }]}
          >
            {f}
          </Animated.Text>
        ))}
      </View>
    </Animated.View>,

    <Animated.View key={1} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <FontAwesome name="shopping-bag" size={48} color={Colors.brand.primary} />
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.storeNameTitle')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('onboarding.storeNameDesc')}
      </Text>
      <View style={styles.formArea}>
        <Input
          placeholder={t('onboarding.storeNamePlaceholder')}
          value={storeData.name}
          onChangeText={v => setStoreData(d => ({ ...d, name: v }))}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>
    </Animated.View>,

    <Animated.View key={2} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <FontAwesome name="th-large" size={48} color={Colors.brand.primary} />
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.segmentTitle')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('onboarding.segmentDesc')}
      </Text>
      {/* Grid 2 colunas — cada slot fica 48% pra os botões terem largura uniforme.
          Sem `width` os botões dimensionavam pelo texto e ficavam tortos. */}
      <View style={styles.segmentGrid}>
        {SEGMENTS.map(s => (
          <View key={s.value} style={styles.segmentSlot}>
            <Button
              title={t(s.labelKey)}
              variant={storeData.segment === s.value ? 'primary' : 'secondary'}
              onPress={() => {
                haptic.selection();
                setStoreData(d => ({ ...d, segment: s.value }));
              }}
            />
          </View>
        ))}
      </View>
    </Animated.View>,

    <Animated.View key={3} entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
      <FontAwesome name="map-marker" size={48} color={Colors.brand.primary} />
      <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.finalTitle')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('onboarding.finalDesc')}
      </Text>
      <View style={styles.formArea}>
        <Input
          placeholder={t('onboarding.cityPlaceholder')}
          value={storeData.city}
          onChangeText={v => setStoreData(d => ({ ...d, city: v }))}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Input
          placeholder={t('onboarding.instagramPlaceholder')}
          value={storeData.instagram}
          onChangeText={v => setStoreData(d => ({ ...d, instagram: v }))}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>
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

  /* Why KeyboardAvoidingView: nos passos com input (1 e 3), o teclado iOS
     subia por cima do footer. iOS usa "padding" (push do footer pra cima);
     Android usa "height" (resize do container). Padding no iOS é mais
     suave; height no Android evita problemas com WindowSoftInputMode. */
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Brand mesh gradient backdrop — slow-drifting blobs of fuchsia / pink /
          violet behind the whole flow. opacity 0.35 so it reads as ambient
          atmosphere, not noise behind the copy. Skia, GPU thread. */}
      <MeshGradient
        opacity={colorScheme === 'dark' ? 0.35 : 0.18}
        style={StyleSheet.absoluteFill}
      />

      {/* Top: progress dots respeitando safe area (notch / status bar) */}
      <View style={[styles.dotsRow, { paddingTop: insets.top + 16 }]}>
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {steps[step]}
      </ScrollView>

      {/* Footer respeita home-indicator (iOS) / nav-bar (Android) via insets.bottom.
          Antes era paddingBottom: 40 fixo, que cortava em telas com gestos. */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopColor: colors.border,
          },
        ]}
      >
        {step > 0 && (
          <View style={styles.footerBack}>
            <Button
              title={t('onboarding.ctaBack')}
              variant="ghost"
              onPress={() => {
                haptic.tap();
                setStep(step - 1);
              }}
            />
          </View>
        )}
        <View style={[styles.footerNext, step === 0 && styles.footerNextSolo]}>
          <Button
            title={ctaTitle}
            onPress={handleNext}
            disabled={!canProceed() || saving}
            loading={saving}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: tokens.spacing.sm, paddingBottom: tokens.spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: tokens.spacing.xxl },
  stepContent: { paddingHorizontal: tokens.spacing.xxl, gap: 14, alignItems: 'center' },
  emoji: { fontSize: 48 },
  title: { fontSize: tokens.fontSize.displayLg, fontWeight: tokens.fontWeight.black, textAlign: 'center' },
  description: { fontSize: tokens.fontSize.xl, textAlign: 'center', lineHeight: 24, paddingHorizontal: tokens.spacing.sm },
  features: { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm, alignSelf: 'stretch' },
  featureItem: { fontSize: tokens.fontSize.lg, paddingVertical: 6, paddingHorizontal: tokens.spacing.lg, lineHeight: 22 },
  formArea: { width: '100%', gap: tokens.spacing.md, marginTop: tokens.spacing.sm },
  /* Grid 2 colunas: row + wrap + slot 48% (gap 8 ÷ 2 = 4 de cada lado).
     Garante botões de mesma largura — antes a grid centralizava itens
     com larguras intrínsecas e ficava "tortinho". */
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    marginTop: tokens.spacing.sm,
  },
  segmentSlot: { width: '48%' },
  /* Footer com border-top sutil pra separar visualmente do content quando
     o usuário rola e o conteúdo "passa" por baixo. */
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBack: { flex: 1 },
  footerNext: { flex: 2 },
  footerNextSolo: { flex: 1 }, // step 0 sem voltar — botão "Começar" full-width
});
