import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  AnimatedPressable,
  Button,
  GradientText,
  Skeleton,
} from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import { useTabContentPaddingBottom } from '@/components/tabBarLayout';
import {
  CreateModelSheet,
  type CreateModelSheetRef,
  type CreateModelFormState,
  type Gender,
} from '@/components/CreateModelSheet';
import { ModelPeekProvider, ModelPressable } from '@/components/ModelLongPressPreview';
import { ModelBottomSheet, type ModelBottomSheetRef } from '@/components/ModelBottomSheet';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api, apiDelete, apiGet, apiGetCached, apiPost, invalidateApiCache } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { StoreModel } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
// 3 colunas como no site: 20px de padding lateral em cada lado + 2 gaps internos
const CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP * 2) / 3;

function PulsingBadge({ label }: { label: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.6, { duration: 800 }), -1, true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.activeBadge, animStyle]}>
      <Text style={styles.activeBadgeText}>{label}</Text>
    </Animated.View>
  );
}

/**
 * BODY_TYPES_* live here because the grid card translates the persisted
 * `body_type` value back into a localised label badge. The full create-form
 * lookup tables live inside `<CreateModelSheet />`.
 */
const BODY_TYPES_FEM = [
  { value: 'magra', labelKey: 'model.bodySlim' as const },
  { value: 'media', labelKey: 'model.bodyStandard' as const },
  { value: 'plus_size', labelKey: 'model.bodyCurvy' as const },
];

const BODY_TYPES_MASC = [
  { value: 'atletico', labelKey: 'model.bodyAthletic' as const },
  { value: 'medio', labelKey: 'model.bodyMid' as const },
  { value: 'robusto', labelKey: 'model.bodyRobust' as const },
];

const SKIN_PLACEHOLDER_COLOR: Record<string, string> = {
  branca: '#F5D0B5',
  morena_clara: '#D4A574',
  morena: '#A67B5B',
  negra: '#6B4226',
};

export default function ModeloScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { t } = useT();
  const headerH = useHeaderHeight();
  const padBottom = useTabContentPaddingBottom();

  const [models, setModels] = useState<StoreModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelLimit, setModelLimit] = useState(0);
  // When the user has many models we collapse to 6 by default and reveal a
  // gradient "Ver todas" link — a long scroll of avatars feels overwhelming
  // and steals attention from the empty state's CTAs.
  const [showAllModels, setShowAllModels] = useState(false);

  // Form state — flattened object passed to the sheet so a single prop
  // bundles all setters and the sheet can stay agnostic to local hooks.
  const [gender, setGender] = useState<Gender>('feminino');
  const [skin, setSkin] = useState('morena_clara');
  const [hairTexture, setHairTexture] = useState('ondulado');
  const [hairLength, setHairLength] = useState('medio');
  const [hairColor, setHairColor] = useState('castanho');
  const [body, setBody] = useState('media');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sheetRef = useRef<CreateModelSheetRef>(null);
  // BottomSheet de preview com pinch-zoom (acionado pelo botão 🔍 do card).
  const peekSheetRef = useRef<ModelBottomSheetRef>(null);

  const loadModels = useCallback(async (opts?: { skipCache?: boolean }) => {
    if (opts?.skipCache) await invalidateApiCache('/model/list');
    const data = await apiGetCached<{ models: StoreModel[]; limit: number }>('/model/list', 60_000);
    setModels(data.models || []);
    setModelLimit(data.limit ?? 0);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadModels({ skipCache: true }); } catch {} finally { setRefreshing(false); }
  }, [loadModels]);

  const canCreate = models.length < modelLimit;

  const formState = useMemo<CreateModelFormState>(
    () => ({
      gender,
      setGender,
      skin,
      setSkin,
      hairTexture,
      setHairTexture,
      hairLength,
      setHairLength,
      hairColor,
      setHairColor,
      body,
      setBody,
      name,
      setName,
      // Flipping gender swaps the legal length/body options. Reset to the
      // safest default for that gender so the form never holds an invalid
      // combination (e.g. "raspado" length on a feminine model).
      resetForGender: (g: Gender) => {
        setGender(g);
        if (g === 'masculino') {
          setBody('medio');
          setHairLength('curto');
        } else {
          setBody('media');
          setHairLength('medio');
        }
      },
    }),
    [gender, skin, hairTexture, hairLength, hairColor, body, name],
  );

  useEffect(() => {
    loadModels().catch(() => {}).finally(() => setLoadingModels(false));
  }, []);

  // Poll for preview generation — stable ref prevents re-triggering on every model state change
  const pendingIdsRef = useRef<string[]>([]);
  useEffect(() => {
    pendingIdsRef.current = models.filter(m => !m.photo_url && !m.preview_failed).map(m => m.id);
  }, [models]);

  useEffect(() => {
    const pending = models.filter(m => !m.photo_url && !m.preview_failed).map(m => m.id);
    if (pending.length === 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const tick = async () => {
      const ids = pendingIdsRef.current;
      if (ids.length === 0) {
        stop();
        return;
      }
      try {
        const res = await apiGet<{ statuses: Record<string, { url?: string; status?: string }> }>(
          `/model/preview-status?ids=${ids.join(',')}`,
        );
        setModels(prev =>
          prev.map(m => {
            const s = res.statuses?.[m.id];
            if (s?.url) return { ...m, photo_url: s.url, preview_failed: false };
            if (s?.status === 'failed') return { ...m, preview_failed: true };
            return m;
          }),
        );
      } catch {
        /* keep polling */
      }
    };

    const start = () => {
      if (intervalId || stopped) return;
      intervalId = setInterval(tick, 5000);
    };

    const pause = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const stop = () => {
      stopped = true;
      pause();
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') start();
      else pause();
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', onAppState);
    timeoutId = setTimeout(stop, 3 * 60 * 1000);

    return () => {
      sub.remove();
      stop();
    };
  }, [models.length]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const form = new FormData();
      form.append('skinTone', skin);
      form.append('hairTexture', hairTexture);
      form.append('hairLength', hairLength);
      form.append('hairColor', hairColor);
      form.append('hairStyle', hairTexture);
      form.append('bodyType', body);
      form.append('style', 'casual_natural');
      form.append('ageRange', gender === 'masculino' ? 'adulto_26_35' : 'adulta_26_35');
      form.append('name', name || 'Modelo');
      form.append('gender', gender);

      const res = await api<{ id?: string; data?: { id?: string; previewUrl?: string } }>(
        '/model/create',
        { method: 'POST', body: form },
      );

      const newModel: StoreModel = {
        id: res.data?.id || res.id || Date.now().toString(),
        name: name || 'Modelo',
        skin_tone: skin,
        hair_style: hairTexture,
        hair_texture: hairTexture,
        hair_length: hairLength,
        hair_color: hairColor,
        body_type: body,
        gender,
        is_active: true,
        created_at: new Date().toISOString(),
        photo_url: res.data?.previewUrl || null,
      };
      setModels(prev => [...prev, newModel]);
      invalidateApiCache('/model/list').catch(() => {});
      sheetRef.current?.dismiss();
      resetForm();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('model.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('model.deleteTitle'), t('model.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setModels(prev => prev.filter(m => m.id !== id));
          try {
            await apiDelete(`/model/${id}`);
            invalidateApiCache('/model/list').catch(() => {});
          } catch {}
        },
      },
    ]);
  };

  const handleSetActive = async (id: string) => {
    const prev = [...models];
    setModels(m => m.map(x => ({ ...x, is_active: x.id === id })));
    try {
      await apiPost(`/model/${id}/activate`);
    } catch {
      setModels(prev);
    }
  };

  const resetForm = () => {
    setGender('feminino');
    setName('');
    setSkin('morena_clara');
    setHairTexture('ondulado');
    setHairLength('medio');
    setHairColor('castanho');
    setBody('media');
  };

  if (loadingModels) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={[styles.content, { paddingTop: headerH + 16, paddingBottom: padBottom }]}>
          <View style={styles.header}>
            <Skeleton width="60%" height={28} />
            <Skeleton width={80} height={40} borderRadius={12} />
          </View>
          <View style={styles.grid}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={styles.portraitCard}>
                <Skeleton width="100%" style={{ aspectRatio: 3 / 4 }} borderRadius={16} />
                <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
                <Skeleton width={50} height={20} borderRadius={10} style={{ marginTop: 4 }} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Models list ──
  // ModelPeekProvider habilita o long-press peek (overlay com a foto ampliada)
  // em todos os ModelPressable filhos. Precisa estar acima dos cards.
  // peekSheetRef → o card também expõe um botão "🔍 ampliar" que abre o
  // ModelBottomSheet com pinch-to-zoom (mesma UX da tela /gerar).
  return (
    <ModelPeekProvider>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader />
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: headerH + 16, paddingBottom: padBottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} colors={[Colors.brand.primary]} />}
    >
      <ModelsListBody
        peekSheetRef={peekSheetRef}
        models={models}
        modelLimit={modelLimit}
        canCreate={canCreate}
        showAllModels={showAllModels}
        setShowAllModels={setShowAllModels}
        colors={colors}
        t={t}
        onCreate={() => sheetRef.current?.present()}
        onActivatePlan={() => { haptic.warning(); router.push('/(tabs)/plano'); }}
        onSetActive={handleSetActive}
        onDelete={handleDelete}
      />
    </ScrollView>

    <CreateModelSheet
      ref={sheetRef}
      state={formState}
      creating={creating}
      onSubmit={handleCreate}
      onDismissed={resetForm}
    />
    {/* Pinch-to-zoom sheet — quando o user confirma na CTA, ativa esse modelo. */}
    <ModelBottomSheet ref={peekSheetRef} onSelect={handleSetActive} />
    </View>
    </ModelPeekProvider>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

/**
 * ModelsListBody
 *
 * Why split this out? The orchestrator screen above is already heavy with
 * state hooks; pulling the JSX here keeps the render path readable and lets
 * the show-all/show-less collapse + dashed "Nova" card live near each other.
 */
type TFunc = ReturnType<typeof useT>['t'];
type ColorPalette = (typeof Colors)['light'];

function ModelsListBody({
  peekSheetRef,
  models,
  modelLimit,
  canCreate,
  showAllModels,
  setShowAllModels,
  colors,
  t,
  onCreate,
  onActivatePlan,
  onSetActive,
  onDelete,
}: {
  peekSheetRef: React.RefObject<ModelBottomSheetRef | null>;
  models: StoreModel[];
  modelLimit: number;
  canCreate: boolean;
  showAllModels: boolean;
  setShowAllModels: (v: boolean) => void;
  colors: ColorPalette;
  t: TFunc;
  onCreate: () => void;
  onActivatePlan: () => void;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Threshold matches the marketing site: show 6, then "Ver todas (X mais)".
  const COLLAPSE_THRESHOLD = 6;
  const totalShown = models.length;
  const shouldCollapse = totalShown > COLLAPSE_THRESHOLD && !showAllModels;
  const visibleModels = useMemo(
    () => (shouldCollapse ? models.slice(0, COLLAPSE_THRESHOLD) : models),
    [models, shouldCollapse],
  );
  const hiddenCount = totalShown - COLLAPSE_THRESHOLD;

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {/* Hero: full title rendered as fucsia gradient mask. */}
          <GradientText
            colors={Colors.brand.gradientPrimary}
            style={styles.titleHero}
          >
            {t('model.title')}
          </GradientText>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('model.countLabel', { n: models.length, limit: modelLimit })}
          </Text>
        </View>
        {/* Counter pill replaces the old "+ Nova" button — creation moved into the grid. */}
        {modelLimit > 0 && (
          <View
            style={[styles.counterPill, { borderColor: colors.border }]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${models.length} de ${modelLimit}`}
          >
            <Text style={[styles.counterPillText, { color: colors.text }]}>
              {models.length}/{modelLimit}
            </Text>
          </View>
        )}
      </View>

      {models.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Text style={{ fontSize: 48 }}>👗</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('model.emptyTitle')}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {modelLimit === 0 ? t('model.emptyNeedsPlan') : t('model.emptyHasSlots')}
          </Text>
          {modelLimit === 0 ? (
            <Button title={t('model.activatePlan')} onPress={onActivatePlan} />
          ) : (
            <Button title={t('model.createFirst')} onPress={onCreate} />
          )}
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {visibleModels.map((model, index) => (
              <ModelGridCard
                key={model.id}
                model={model}
                index={index}
                colors={colors}
                t={t}
                onSetActive={onSetActive}
                onDelete={onDelete}
                onZoom={() => peekSheetRef.current?.present(model as never)}
              />
            ))}

            {/* + Nova modelo card — appears only after the user already has at
                 least one model AND still has slots free. Matches the dashed
                 placeholder on the marketing site. */}
            {canCreate && !shouldCollapse && (
              <Animated.View
                entering={FadeInDown.delay(visibleModels.length * 80)
                  .duration(400)
                  .springify()}
                style={styles.portraitCard}
              >
                <AnimatedPressable
                  onPress={onCreate}
                  haptic="press"
                  scale={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={t('model.newModelCardLabel')}
                  style={[
                    styles.portraitImageWrap,
                    styles.newModelCard,
                    {
                      borderColor: Colors.brand.primary,
                      backgroundColor: colors.cardElevated,
                    },
                  ]}
                >
                  <Text
                    style={[styles.newModelPlus, { color: Colors.brand.primary }]}
                  >
                    +
                  </Text>
                  <Text
                    style={[styles.newModelLabel, { color: Colors.brand.primary }]}
                  >
                    {t('model.newModelCardLabel')}
                  </Text>
                  <Text
                    style={[
                      styles.newModelCounter,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t('model.newModelCardCounter', {
                      n: models.length,
                      limit: modelLimit,
                    })}
                  </Text>
                </AnimatedPressable>
              </Animated.View>
            )}
          </View>

          {/* Collapse/expand control — only render if we'd actually hide cards. */}
          {totalShown > COLLAPSE_THRESHOLD && (
            <AnimatedPressable
              onPress={() => setShowAllModels(!showAllModels)}
              haptic="tap"
              style={styles.viewAllBtn}
              accessibilityRole="button"
              accessibilityLabel={
                showAllModels ? t('model.showLess') : t('model.viewAll', { n: hiddenCount })
              }
            >
              <GradientText
                colors={Colors.brand.gradientPrimary}
                style={styles.viewAllText}
              >
                {showAllModels
                  ? t('model.showLess')
                  : t('model.viewAll', { n: hiddenCount })}
              </GradientText>
            </AnimatedPressable>
          )}
        </>
      )}
    </View>
  );
}

function ModelGridCard({
  model,
  index,
  colors,
  t,
  onSetActive,
  // TODO: long-press não pode ser usado pra delete (conflita com peek preview).
  // Mover delete pra um botão na BottomSheet ou menu de contexto.
  onDelete: _onDelete,
  onZoom,
}: {
  model: StoreModel;
  index: number;
  colors: ColorPalette;
  t: TFunc;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
  onZoom: () => void;
}) {
  const matchFem = BODY_TYPES_FEM.find(b => b.value === model.body_type);
  const matchMasc = BODY_TYPES_MASC.find(b => b.value === model.body_type);
  const labelBody = matchFem
    ? t(matchFem.labelKey)
    : matchMasc
    ? t(matchMasc.labelKey)
    : model.body_type;
  // Subtitle paritário com o site: "Mulher Padrão" / "Homem Atlético" etc.
  // Inline em vez de i18n porque os keys existentes (genderMale/Female) trazem
  // símbolo ♂♀ que poluiria a frase. O site também usa literais aqui.
  const genderPrefix = matchMasc ? 'Homem' : 'Mulher';
  const subtitle = `${genderPrefix} ${labelBody}`;

  const hasPhoto = !!model.photo_url;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(400).springify()}
      style={styles.portraitCard}
    >
      {/* ModelPressable: tap = ativa modelo, long-press = peek preview overlay
          (mesma UX da tela /gerar). Substitui o AnimatedPressable que tinha
          long-press deletando — agora delete vai pra um menu explícito (TODO).
          Border permanente (transparente quando inactive) + shadow só via
          glow ring overlay corrige o flicker "preta e some" no Android: sem
          mudança de elevation, layout fica estável entre seleções. */}
      <ModelPressable
        model={model as never}
        disablePeek={!hasPhoto}
        onPress={() => onSetActive(model.id)}
        accessibilityLabel={`Ativar modelo ${model.name}`}
        style={{
          ...styles.portraitImageWrap,
          borderWidth: 2,
          borderColor: model.is_active ? Colors.brand.primary : 'transparent',
        }}
      >
        {hasPhoto ? (
          <Image
            source={{ uri: model.photo_url! }}
            style={styles.portraitImage}
            contentFit="cover"
            contentPosition="top"
          />
        ) : (
          <View
            style={[
              styles.modelPlaceholder,
              {
                backgroundColor:
                  SKIN_PLACEHOLDER_COLOR[model.skin_tone] || '#D4A574',
              },
            ]}
          >
            <Text style={{ fontSize: 32 }}>
              {model.preview_failed ? '⚠️' : '⏳'}
            </Text>
            {!model.preview_failed && (
              <Text style={styles.generatingText}>
                {t('model.statusGenerating')}
              </Text>
            )}
          </View>
        )}
        {model.is_active && <PulsingBadge label={t('model.statusActive')} />}

        {/* Botão de ampliar — fucsia gradient, abre o ModelBottomSheet com
            pinch-to-zoom. Mesma UX que /gerar. */}
        {hasPhoto && (
          <AnimatedPressable
            onPress={onZoom}
            haptic="tap"
            scale={0.88}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Ampliar modelo ${model.name}`}
            style={styles.zoomBadge}
          >
            <LinearGradient
              colors={Colors.brand.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.zoomBadgeInner}
            >
              <FontAwesome name="search-plus" size={11} color="#FFF" />
            </LinearGradient>
          </AnimatedPressable>
        )}
      </ModelPressable>

      <Text
        style={[styles.modelName, { color: colors.text }]}
        numberOfLines={1}
      >
        {model.name}
      </Text>
      {/* Subtitle simples — espelha o card do site (gerar/page.tsx). Substitui
          o "bodyBadge" que mostrava só "Médio" sem contexto de gênero. */}
      <Text
        style={[styles.modelSubtitle, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleHero: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, marginTop: 2 },
  counterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterPillText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  newModelCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  newModelPlus: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    lineHeight: 36,
  },
  newModelLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  newModelCounter: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  viewAllBtn: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  portraitCard: {
    width: CARD_WIDTH,
    gap: 6,
  },
  portraitImageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  portraitImage: { width: '100%', height: '100%' },
  modelPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  generatingText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
  activeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.brand.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  zoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  zoomBadgeInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  modelName: { fontSize: 14, fontWeight: '600' },
  modelSubtitle: { fontSize: 12, fontWeight: '500', marginTop: -2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(139,92,246,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
});
