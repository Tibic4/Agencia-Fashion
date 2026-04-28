/**
 * Gerar (orchestrator screen)
 *
 * This file is now a thin UI layer over four hooks. Each hook owns one slice
 * of the screen's behavior; the component just wires them to JSX.
 *
 *   useImagePickerSlot  → main / closeup / second photo
 *   useModelSelector    → model list, filter, selection, preview modal
 *   useCampaignGenerator → submit + polling + error/quota state
 *   (cache + AppState pause live inside the hooks; the screen is unaware)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useFloatingCtaBottom } from '@/components/tabBarLayout';
import { AnimatedPressable, Button, Card, GradientText } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { GenerationLoadingScreen } from '@/components/GenerationLoadingScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { PhotoTipsCard } from '@/components/PhotoTipsCard';
import { PolicyHint } from '@/components/PolicyHint';
import { QuotaExceededModal } from '@/components/QuotaExceededModal';
import { CameraCaptureModal } from '@/components/CameraCaptureModal';
import { PhotoSourceSheet } from '@/components/PhotoSourceSheet';
import { ensureBiometricConsent } from '@/components/BiometricConsentModal';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import {
  ModelBottomSheet,
  type ModelBottomSheetRef,
} from '@/components/ModelBottomSheet';
import {
  ModelPeekProvider,
  ModelPressable,
} from '@/components/ModelLongPressPreview';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetCached } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { isMaleModel } from '@/lib/modelGender';
import {
  useImagePickerSlot,
  useModelSelector,
  useCampaignGenerator,
  type ModelFilter,
} from '@/hooks/gerar';

// Why labelKey + t() at render time? The locale toggle (PT-BR ↔ EN) happens
// without unmounting screens, so labels must resolve fresh each render.
const audiences = [
  { value: '', labelKey: 'audiences.auto' as const },
  { value: 'mulheres_25_40', labelKey: 'audiences.mulheres_25_40' as const },
  { value: 'jovens_18_25', labelKey: 'audiences.jovens_18_25' as const },
  { value: 'homens_25_45', labelKey: 'audiences.homens_25_45' as const },
  { value: 'maes', labelKey: 'audiences.maes' as const },
  { value: 'publico_geral', labelKey: 'audiences.publico_geral' as const },
  { value: 'premium', labelKey: 'audiences.premium' as const },
];

const tones = [
  { value: '', labelKey: 'tones.auto' as const },
  { value: 'casual_energetico', labelKey: 'tones.casual_energetico' as const },
  { value: 'sofisticado', labelKey: 'tones.sofisticado' as const },
  { value: 'urgente', labelKey: 'tones.urgente' as const },
  { value: 'acolhedor', labelKey: 'tones.acolhedor' as const },
  { value: 'divertido', labelKey: 'tones.divertido' as const },
];

const BG_IMAGES: Record<string, any> = {
  branco: require('@/assets/images/bg/branco.webp'),
  estudio: require('@/assets/images/bg/estudio.webp'),
  lifestyle: require('@/assets/images/bg/lifestyle.webp'),
  urbano: require('@/assets/images/bg/urbano.webp'),
  natureza: require('@/assets/images/bg/natureza.webp'),
  interior: require('@/assets/images/bg/interior.webp'),
  boutique: require('@/assets/images/bg/boutique.webp'),
  praia: require('@/assets/images/bg/praia.webp'),
  noturno: require('@/assets/images/bg/noturno.webp'),
  tropical: require('@/assets/images/bg/tropical.webp'),
  minimalista: require('@/assets/images/bg/minimalista.webp'),
  luxo: require('@/assets/images/bg/luxo.webp'),
  rural: require('@/assets/images/bg/rural.webp'),
  neon: require('@/assets/images/bg/neon.webp'),
  arte: require('@/assets/images/bg/arte.webp'),
};

const backgrounds = [
  { value: 'branco', labelKey: 'scenes.branco' as const },
  { value: 'estudio', labelKey: 'scenes.estudio' as const },
  { value: 'lifestyle', labelKey: 'scenes.lifestyle' as const },
  { value: 'urbano', labelKey: 'scenes.urbano' as const },
  { value: 'natureza', labelKey: 'scenes.natureza' as const },
  { value: 'interior', labelKey: 'scenes.interior' as const },
  { value: 'boutique', labelKey: 'scenes.boutique' as const },
  { value: 'praia', labelKey: 'scenes.praia' as const },
  { value: 'noturno', labelKey: 'scenes.noturno' as const },
  { value: 'tropical', labelKey: 'scenes.tropical' as const },
  { value: 'minimalista', labelKey: 'scenes.minimalista' as const },
  { value: 'luxo', labelKey: 'scenes.luxo' as const },
  { value: 'rural', labelKey: 'scenes.rural' as const },
  { value: 'neon', labelKey: 'scenes.neon' as const },
  { value: 'arte', labelKey: 'scenes.arte' as const },
];

const MODEL_FILTERS: { value: ModelFilter; labelKey: 'modelFilters.all' | 'modelFilters.padrao' | 'modelFilters.curvilinea' | 'modelFilters.homem' | 'modelFilters.homem_plus' }[] = [
  { value: 'all', labelKey: 'modelFilters.all' },
  { value: 'padrao', labelKey: 'modelFilters.padrao' },
  { value: 'curvilinea', labelKey: 'modelFilters.curvilinea' },
  { value: 'homem', labelKey: 'modelFilters.homem' },
  { value: 'homem_plus', labelKey: 'modelFilters.homem_plus' },
];

// Scene cards use a 3:4 portrait ratio at 96×128 — large enough to read the
// scene at a glance, small enough that 3-4 fit horizontally on most phones.
const BG_CARD_WIDTH = 96;
const BG_CARD_HEIGHT = 128;
const BG_CARD_GAP = 12;

/**
 * BackgroundCard
 *
 * Why a sub-component? The pulsing glow uses Reanimated's useSharedValue +
 * withRepeat — those hooks must live in a component, not a `.map()` body.
 * Splitting also lets only the active card animate, avoiding re-renders on
 * the rest of the row.
 */
function BackgroundCard({
  label,
  source,
  selected,
  textColor,
  onPress,
}: {
  label: string;
  source: number;
  selected: boolean;
  textColor: string;
  onPress: () => void;
}) {
  const glow = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (selected) {
      // Why pulse 0.6→1 instead of 0→1? A fully-fading glow looks like a
      // stutter; a soft breath communicates "active" without nagging.
      glow.value = withRepeat(withTiming(0.6, { duration: 1500 }), -1, true);
    } else {
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [selected, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value,
    elevation: selected ? 8 : 0,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      haptic={false}
      scale={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.bgCard}
    >
      <Animated.View
        style={[
          styles.bgImageWrapper,
          {
            borderColor: selected ? Colors.brand.primary : 'transparent',
            borderWidth: selected ? 2.5 : 0,
            shadowColor: Colors.brand.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 12,
          },
          glowStyle,
        ]}
      >
        <Image
          source={source}
          style={styles.bgImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        {selected ? (
          <View style={styles.bgCheckBadge}>
            <FontAwesome name="check" size={12} color="#fff" />
          </View>
        ) : null}
      </Animated.View>
      <Text
        style={[
          styles.bgLabel,
          { color: selected ? Colors.brand.primary : textColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export default function GerarScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { t } = useT();
  const headerH = useHeaderHeight();
  const ctaBottom = useFloatingCtaBottom();

  // ─── Photo slots ────────────────────────────────────────────────────────
  const main = useImagePickerSlot({ fileName: 'main.jpg' });
  const closeup = useImagePickerSlot({ fileName: 'closeup.jpg' });
  const second = useImagePickerSlot({ fileName: 'second.jpg' });

  // ─── Model selection ────────────────────────────────────────────────────
  const modelSel = useModelSelector();
  const sheetRef = useRef<ModelBottomSheetRef>(null);

  const handleSheetSelect = useCallback(
    (modelId: string) => {
      modelSel.setSelectedModelId(modelId);
    },
    [modelSel],
  );

  // ─── Form fields ────────────────────────────────────────────────────────
  const [campaignTitle, setCampaignTitle] = useState('');
  const [price, setPrice] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [background, setBackground] = useState('branco');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ─── Plan name (used by QuotaExceededModal) ─────────────────────────────
  const [currentPlan, setCurrentPlan] = useState('free');
  useEffect(() => {
    apiGetCached<{ data: { plan_name: string } }>('/store/usage', 60_000)
      .then(usage => {
        if (usage?.data?.plan_name) setCurrentPlan(usage.data.plan_name);
      })
      .catch(() => {});
  }, []);

  // ─── Submission + polling (handled by the hook) ────────────────────────
  const generator = useCampaignGenerator({
    onComplete: id =>
      router.push({ pathname: '/(tabs)/gerar/resultado', params: { id } }),
  });

  const confirmAndSubmit = useCallback(() => {
    if (!main.value) return;
    const submit = () =>
      generator.submit({
        mainPhoto: main.value!,
        closeUpPhoto: closeup.value,
        secondPhoto: second.value,
        campaignTitle,
        price,
        audience,
        tone,
        background,
        modelFilter: modelSel.filter,
        selectedModelId: modelSel.selectedModelId,
        models: modelSel.models,
      });

    // LGPD art. 11 — biometric data requires explicit consent. Gate the
    // upload behind the consent modal (no-op if user already accepted this
    // version of the legal text).
    const submitGated = async () => {
      const granted = await ensureBiometricConsent();
      if (!granted) return;
      submit();
    };

    if (!closeup.value && !second.value) {
      Alert.alert(
        t('generate.confirmSinglePhotoTitle'),
        t('generate.confirmSinglePhotoMessage'),
        [
          { text: t('generate.confirmAddMore'), style: 'cancel' },
          { text: t('generate.confirmGenerate'), onPress: () => { submitGated(); } },
        ],
      );
    } else {
      submitGated();
    }
  }, [
    main.value,
    closeup.value,
    second.value,
    campaignTitle,
    price,
    audience,
    tone,
    background,
    modelSel.filter,
    modelSel.selectedModelId,
    modelSel.models,
    generator,
  ]);

  if (generator.isGenerating) {
    return (
      <GenerationLoadingScreen
        isComplete={generator.generationComplete}
        onViewResults={generator.viewResults}
      />
    );
  }

  return (
    <ModelPeekProvider>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader />
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.scrollContent,
          // ScrollView pad must clear the floating CTA + tab bar so the last
          // form field is reachable on small phones (S22 base @ 6.1").
          { paddingBottom: ctaBottom + 80, paddingTop: headerH + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero: "Nova [Campanha]" — second word renders as a fucsia gradient mask, mirroring the marketing site. */}
        <View style={styles.heroRow} accessible accessibilityRole="header">
          <Text style={[styles.title, { color: colors.text }]}>{t('generate.titlePrefix')}</Text>
          <GradientText
            colors={Colors.brand.gradientPrimary}
            style={styles.title}
          >
            {t('generate.titleHighlight')}
          </GradientText>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('generate.subtitle')}
        </Text>

        {generator.error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{generator.error}</Text>
            <View style={styles.errorReassurance}>
              <Text style={styles.errorReassuranceText}>{t('generate.creditsIntact')}</Text>
              <Text style={styles.errorReassuranceDesc}>{t('generate.creditsIntactDesc')}</Text>
            </View>
            <View style={styles.errorActions}>
              <Button
                title={`🔄 ${t('common.retry')}`}
                onPress={() => {
                  generator.dismissError();
                  confirmAndSubmit();
                }}
              />
              <AnimatedPressable
                onPress={generator.dismissError}
                haptic="tap"
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={12}
              >
                <Text style={styles.errorDismiss}>{t('common.close')}</Text>
              </AnimatedPressable>
            </View>
          </Card>
        )}

        {/* Photo Upload */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('generate.photosSection')}</Text>
        <View style={styles.photoRow}>
          <AnimatedPressable
            onPress={main.openSheet}
            haptic="press"
            scale={0.97}
            style={[styles.photoSlot, styles.photoMain, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.selectMainPhoto')}
          >
            {main.value ? (
              <Image source={{ uri: main.value.uri }} style={styles.photoImage} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <FontAwesome name="camera" size={28} color={colors.textSecondary} />
                <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>{t('generate.mainPhoto')}</Text>
              </View>
            )}
          </AnimatedPressable>
          <View style={styles.photoSecondary}>
            <AnimatedPressable
              onPress={closeup.openSheet}
              haptic="press"
              scale={0.95}
              style={[styles.photoSlot, styles.photoSmall, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.selectCloseupPhoto')}
            >
              {closeup.value ? (
                <Image source={{ uri: closeup.value.uri }} style={styles.photoImage} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <FontAwesome name="search-plus" size={18} color={colors.textSecondary} />
                  <Text style={[styles.photoLabelSmall, { color: colors.textSecondary }]}>{t('generate.closeUpPhoto')}</Text>
                </View>
              )}
            </AnimatedPressable>
            <AnimatedPressable
              onPress={second.openSheet}
              haptic="press"
              scale={0.95}
              style={[styles.photoSlot, styles.photoSmall, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.selectSecondPhoto')}
            >
              {second.value ? (
                <Image source={{ uri: second.value.uri }} style={styles.photoImage} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <FontAwesome name="plus" size={18} color={colors.textSecondary} />
                  <Text style={[styles.photoLabelSmall, { color: colors.textSecondary }]}>{t('generate.secondPhoto')}</Text>
                </View>
              )}
            </AnimatedPressable>
          </View>
        </View>
        {/* Didactic policy hint: shown only until the user uploads a main photo, then auto-hides. */}
        {!main.value && <PolicyHint />}
        <PhotoTipsCard />

        {/* Model Selector */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('generate.modelSection')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {MODEL_FILTERS.map(f => (
            <AnimatedPressable
              key={f.value}
              onPress={() => {
                if (modelSel.filter !== f.value) {
                  haptic.selection();
                  modelSel.setFilter(f.value);
                }
              }}
              haptic={false}
              accessibilityRole="button"
              accessibilityState={{ selected: modelSel.filter === f.value }}
              style={[
                styles.filterTab,
                {
                  borderColor:
                    modelSel.filter === f.value ? Colors.brand.primary : colors.border,
                  backgroundColor:
                    modelSel.filter === f.value ? Colors.brand.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: modelSel.filter === f.value ? '#fff' : colors.textSecondary },
                ]}
              >
                {t(f.labelKey)}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelList}>
          {modelSel.loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.modelCard,
                  { backgroundColor: colors.card, borderColor: colors.border, padding: 2 },
                ]}
              >
                <Skeleton width="100%" height={100} borderRadius={12} />
                <View style={{ paddingVertical: 6, width: '100%', alignItems: 'center' }}>
                  <Skeleton width={60} height={10} borderRadius={4} />
                </View>
              </View>
            ))
          ) : (
            modelSel.filteredModels.map(item => {
              const hasPhoto = !!(item.image_url || item.photo_url);
              const isRandom = item.id === 'random';
              return (
                <ModelPressable
                  key={item.id}
                  model={item}
                  disablePeek={isRandom || !hasPhoto}
                  onPress={() => modelSel.setSelectedModelId(item.id)}
                  accessibilityLabel={`Selecionar modelo ${item.name}`}
                  accessibilityState={{
                    selected: modelSel.selectedModelId === item.id,
                  }}
                  style={{
                    ...styles.modelCard,
                    backgroundColor: colors.card,
                    borderColor:
                      modelSel.selectedModelId === item.id
                        ? Colors.brand.primary
                        : colors.border,
                    ...(modelSel.selectedModelId === item.id
                      ? styles.modelCardSelected
                      : null),
                  }}
                >
                  {hasPhoto ? (
                    <Image
                      source={{ uri: item.image_url || item.photo_url || '' }}
                      style={styles.modelThumb}
                      contentFit="cover"
                      contentPosition="top"
                      transition={120}
                      cachePolicy="memory-disk"
                    />
                  ) : isRandom ? (
                    // Card "Aleatória" — bg fucsia profundo + ícone grande,
                    // matching o card editorial do site (não um placeholder
                    // genérico).
                    <View style={[styles.modelThumbPlaceholder, styles.randomCard]}>
                      <Text style={styles.randomEmoji}>🎲</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.modelThumbPlaceholder,
                        { backgroundColor: colors.border },
                      ]}
                    >
                      <FontAwesome
                        name="user"
                        size={24}
                        color={colors.textSecondary}
                      />
                    </View>
                  )}
                  {item.is_custom && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>
                        {isMaleModel(item) ? '⭐ Seu' : '⭐ Sua'}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[styles.modelName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {/* Premium zoom badge — fucsia gradient + soft glow + thin
                      white ring lifts it off the photo without harshness. */}
                  {hasPhoto && !isRandom ? (
                    <AnimatedPressable
                      onPress={() => sheetRef.current?.present(item)}
                      haptic="tap"
                      scale={0.88}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Ampliar modelo ${item.name}`}
                      style={styles.infoBadge}
                    >
                      <LinearGradient
                        colors={Colors.brand.gradientPrimary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.infoBadgeInner}
                      >
                        <FontAwesome name="search-plus" size={11} color="#FFF" />
                      </LinearGradient>
                    </AnimatedPressable>
                  ) : null}
                </ModelPressable>
              );
            })
          )}
        </ScrollView>

        {/* Background Selector — site-parity redesign: 96×128 (3:4) editorial cards, pulsing fucsia glow on selected. */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('generate.backgroundSection')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bgList}
          decelerationRate="fast"
          snapToInterval={BG_CARD_WIDTH + BG_CARD_GAP}
          snapToAlignment="start"
        >
          {backgrounds.map(item => (
            <BackgroundCard
              key={item.value}
              label={t(item.labelKey)}
              source={BG_IMAGES[item.value]}
              selected={background === item.value}
              textColor={colors.textSecondary}
              onPress={() => {
                if (background !== item.value) {
                  haptic.selection();
                  setBackground(item.value);
                }
              }}
            />
          ))}
        </ScrollView>

        <AnimatedPressable
          onPress={() => setShowAdvanced(!showAdvanced)}
          haptic="tap"
          style={styles.advancedToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={showAdvanced ? 'Ocultar opções avançadas' : 'Mostrar opções avançadas'}
        >
          <Text style={[styles.advancedText, { color: Colors.brand.primary }]}>
            {showAdvanced ? t('generate.advancedHide') : t('generate.advancedToggle')}
          </Text>
          <FontAwesome
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={Colors.brand.primary}
          />
        </AnimatedPressable>

        {showAdvanced && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.advancedSection}>
            <TextInput
              placeholder={t('generate.titleField')}
              value={campaignTitle}
              onChangeText={setCampaignTitle}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('a11y.campaignTitleField')}
            />
            <TextInput
              placeholder={t('generate.priceField')}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('a11y.productPriceField')}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('generate.audienceField')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {audiences.map(a => (
                <AnimatedPressable
                  key={a.value}
                  onPress={() => {
                    if (audience !== a.value) {
                      haptic.selection();
                      setAudience(a.value);
                    }
                  }}
                  haptic={false}
                  accessibilityRole="button"
                  accessibilityLabel={t(a.labelKey)}
                  accessibilityState={{ selected: audience === a.value }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        audience === a.value ? Colors.brand.primary : 'transparent',
                      borderColor:
                        audience === a.value ? Colors.brand.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: audience === a.value ? '#fff' : colors.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {t(a.labelKey)}
                  </Text>
                </AnimatedPressable>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('generate.toneField')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {tones.map(tn => (
                <AnimatedPressable
                  key={tn.value}
                  onPress={() => {
                    if (tone !== tn.value) {
                      haptic.selection();
                      setTone(tn.value);
                    }
                  }}
                  haptic={false}
                  accessibilityRole="button"
                  accessibilityLabel={t(tn.labelKey)}
                  accessibilityState={{ selected: tone === tn.value }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor:
                        tone === tn.value ? Colors.brand.primary : 'transparent',
                      borderColor: tone === tn.value ? Colors.brand.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: tone === tn.value ? '#fff' : colors.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {t(tn.labelKey)}
                  </Text>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.floatingBtnContainer, { bottom: ctaBottom }]}
      >
        <Button
          title={main.value ? t('generate.submitReady') : t('generate.submitDisabled')}
          onPress={confirmAndSubmit}
          disabled={!main.value}
          shimmerOnEnable={!!main.value}
          haptic="confirm"
          style={styles.floatingBtn}
        />
      </View>

      {generator.quotaExceeded && (
        <QuotaExceededModal
          visible
          used={generator.quotaExceeded.used}
          limit={generator.quotaExceeded.limit}
          credits={generator.quotaExceeded.credits}
          currentPlan={currentPlan}
          onClose={generator.dismissQuota}
        />
      )}

      <CameraCaptureModal
        visible={main.cameraOpen}
        fileName="main.jpg"
        hint={t('camera.hintMain')}
        onClose={main.closeCamera}
        onCapture={main.acceptCameraAsset}
      />
      <CameraCaptureModal
        visible={closeup.cameraOpen}
        fileName="closeup.jpg"
        hint={t('camera.hintCloseup')}
        onClose={closeup.closeCamera}
        onCapture={closeup.acceptCameraAsset}
      />
      <CameraCaptureModal
        visible={second.cameraOpen}
        fileName="second.jpg"
        hint={t('camera.hintSecond')}
        onClose={second.closeCamera}
        onCapture={second.acceptCameraAsset}
      />

      <PhotoSourceSheet
        visible={main.sheetOpen}
        onClose={main.closeSheet}
        onCamera={main.openCamera}
        onLibrary={main.openLibrary}
      />
      <PhotoSourceSheet
        visible={closeup.sheetOpen}
        onClose={closeup.closeSheet}
        onCamera={closeup.openCamera}
        onLibrary={closeup.openLibrary}
      />
      <PhotoSourceSheet
        visible={second.sheetOpen}
        onClose={second.closeSheet}
        onCamera={second.openCamera}
        onLibrary={second.openLibrary}
      />

      <ModelBottomSheet ref={sheetRef} onSelect={handleSheetSelect} />
    </KeyboardAvoidingView>
    </ModelPeekProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 12 },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: -4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 8 },
  errorCard: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  errorText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  errorReassurance: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  errorReassuranceText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },
  errorReassuranceDesc: { color: '#16A34A', fontSize: 11, marginTop: 2 },
  errorActions: { gap: 8, marginTop: 8 },
  errorDismiss: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    padding: 12,
    minHeight: 48,
  },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoMain: { flex: 2, aspectRatio: 3 / 4, borderRadius: 16 },
  photoSecondary: { flex: 1, gap: 10 },
  photoSmall: { flex: 1, borderRadius: 12 },
  photoSlot: { borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  photoLabelSmall: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  modelList: { gap: 10, paddingVertical: 4 },
  modelCard: { width: 100, alignItems: 'center', borderRadius: 14, borderWidth: 2, overflow: 'hidden' },
  modelCardSelected: { borderWidth: 2.5 },
  modelThumb: { width: '100%', aspectRatio: 3 / 4 },
  modelThumbPlaceholder: { width: '100%', aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center' },
  randomCard: {
    // Same Deep Space backdrop the site uses on the editorial "Aleatória" card.
    backgroundColor: '#1A1A2E',
  },
  randomEmoji: {
    fontSize: 36,
  },
  modelName: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  customBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  bgList: { gap: BG_CARD_GAP, paddingVertical: 4, paddingRight: 4 },
  bgCard: { width: BG_CARD_WIDTH, alignItems: 'center', gap: 6 },
  bgImageWrapper: {
    width: BG_CARD_WIDTH,
    height: BG_CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  bgImage: { width: '100%', height: '100%' },
  bgLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    width: BG_CARD_WIDTH,
  },
  bgCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    minHeight: 48,
  },
  advancedText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  advancedSection: { gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 48,
  },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, minHeight: 40 },
  chipRow: { gap: 8, paddingVertical: 4 },
  floatingBtnContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  floatingBtn: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterRow: { gap: 6, paddingVertical: 4, marginBottom: 4 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, minHeight: 40 },
  filterTabText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  infoBadge: {
    position: 'absolute',
    // Anchored just above the name strip so the lupa never sits over text.
    // Name strip = 11pt font + 6+6 paddingVertical ≈ 25px; +7px breathing room.
    bottom: 32,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: '#D946EF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  infoBadgeInner: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
});
