import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
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
import { TabErrorBoundary } from '@/components/TabErrorBoundary';
import { useConfirmSheet } from '@/components/ConfirmSheet';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { tokens, rounded } from '@/lib/theme/tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiDelete, apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-client';
import { toast } from '@/lib/toast';
import { AuraGlow } from '@/components/skia';
import { useT } from '@/lib/i18n';
import type { StoreModel } from '@/types';

const CARD_GAP = 10;

// 3 colunas como no site: 20px de padding lateral em cada lado + 2 gaps internos.
// useWindowDimensions re-renderiza em rotação / split-view (iPad) — Dimensions.get
// captura o valor uma vez no module scope e quebra responsividade.
//
// Retorna o array de estilo já merged ao invés de só a width pra que cards em
// componentes filhos (FreeCard, ModelCard etc) possam aplicar com 1 linha.
function usePortraitCardStyle() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 40 - CARD_GAP * 2) / 3;
  return useMemo(() => [styles.portraitCard, { width: cardWidth }], [cardWidth]);
}

// CSS API do Reanimated 4: declarativo, otimizável (Reanimated sabe exatamente
// quais props animam, sem worklet runtime). Substitui o useEffect+useSharedValue
// imperativo da versão anterior. Veja references/animations-and-gestures.md.
// Com reduceMotion ativo, badge mostra opacity 1 estático — texto e cor já
// comunicam "ativo".
function PulsingBadge({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      style={[
        styles.activeBadge,
        !reduceMotion && ({
          animationName: { '0%': { opacity: 1 }, '50%': { opacity: 0.6 }, '100%': { opacity: 1 } },
          animationDuration: '1600ms',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        } as any),
      ]}
    >
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

// Query key for the modelo screen's own /model/list view (includes the
// `limit` field used by canCreate). Distinct from `qk.store.models()` used
// by useModelSelector — that one normalises the response into ModelItem[]
// and is shared with /gerar. Keeping them separate avoids the picker
// caching the wrong shape, but invalidating one invalidates the other via
// the prefix when needed.
const MODEL_LIST_KEY = ['modelo', 'list'] as const;

function ModeloScreenInner() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const portraitCardStyle = usePortraitCardStyle();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useT();
  const headerH = useHeaderHeight();
  const padBottom = useTabContentPaddingBottom();
  // a11y — gate da pulse do "+" card e do shimmer dos placeholders.
  const reduceMotion = useReducedMotion();
  // ConfirmSheet imperativo — substitui Alert.alert na deleção de modelo.
  const { ConfirmEl: ConfirmDeleteEl, ask: askDeleteModel } = useConfirmSheet();

  // useQuery owns: cache, dedup, refetch on focus, retry, cancellation.
  // The model-preview polling effect below mutates this cache directly via
  // queryClient.setQueryData rather than a separate useState mirror, so
  // there is exactly one source of truth for the model list on this screen.
  const modelListQ = useQuery({
    queryKey: MODEL_LIST_KEY,
    queryFn: ({ signal }) =>
      apiGet<{ models: StoreModel[]; limit: number }>('/model/list', { signal }),
    staleTime: 60_000,
  });
  const models = modelListQ.data?.models ?? [];
  const modelLimit = modelListQ.data?.limit ?? 0;
  const loadingModels = modelListQ.isPending;
  const refreshing = modelListQ.isFetching && !modelListQ.isPending;

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

  const sheetRef = useRef<CreateModelSheetRef>(null);
  // BottomSheet de preview com pinch-zoom (acionado pelo botão 🔍 do card).
  const peekSheetRef = useRef<ModelBottomSheetRef>(null);

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: MODEL_LIST_KEY });
    queryClient.invalidateQueries({ queryKey: qk.store.models() });
  }, [queryClient]);

  // Helper: mutate the cached model list in place (used by polling and
  // optimistic mutations). Centralised so we never accidentally drop the
  // `limit` field when patching `models`.
  const patchModels = useCallback(
    (mutator: (current: StoreModel[]) => StoreModel[]) => {
      queryClient.setQueryData<{ models: StoreModel[]; limit: number }>(MODEL_LIST_KEY, (old) => {
        if (!old) return old;
        return { ...old, models: mutator(old.models) };
      });
    },
    [queryClient],
  );

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

  // Refetch on focus — user may have changed plan in /plano and come back
  // without restarting the app. modelLimit must be fresh for canCreate to match.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: MODEL_LIST_KEY });
    }, [queryClient]),
  );

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
        // Patch the cached query directly — keeps the source of truth in
        // TanStack Query so other consumers (e.g. useModelSelector via
        // qk.store.models invalidation) see updates without a refetch.
        patchModels((prev) =>
          prev.map((m) => {
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

  // Mutations: create / delete / activate. Each invalidates both the
  // modelo screen's MODEL_LIST_KEY and the picker's qk.store.models() so the
  // /gerar tab also refreshes its model list without a manual call.
  const invalidateModelLists = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: MODEL_LIST_KEY }),
      queryClient.invalidateQueries({ queryKey: qk.store.models() }),
    ]);
  }, [queryClient]);

  const createMut = useMutation({
    mutationFn: () => {
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
      return api<{ id?: string; data?: { id?: string; previewUrl?: string } }>(
        '/model/create',
        { method: 'POST', body: form },
      );
    },
    onMutate: () => setCreating(true),
    onSuccess: (res) => {
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
      // Optimistic-ish: insert immediately so the grid updates without
      // waiting for the refetch. The invalidate then pulls server truth.
      patchModels((prev) => [...prev, newModel]);
      invalidateModelLists();
      sheetRef.current?.dismiss();
      resetForm();
    },
    onError: (e: { message?: string }) => {
      toast.error(e?.message || t('model.createError'));
    },
    onSettled: () => setCreating(false),
  });

  const handleCreate = () => createMut.mutate();

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/model/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: MODEL_LIST_KEY });
      const prev = queryClient.getQueryData<{ models: StoreModel[]; limit: number }>(MODEL_LIST_KEY);
      patchModels((current) => current.filter((m) => m.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(MODEL_LIST_KEY, ctx.prev);
    },
    onSettled: () => invalidateModelLists(),
  });

  const handleDelete = async (id: string) => {
    const ok = await askDeleteModel({
      title: t('model.deleteTitle'),
      message: t('model.deleteMessage'),
      variant: 'danger',
      confirmLabel: t('common.delete'),
    });
    if (ok) deleteMut.mutate(id);
  };

  const setActiveMut = useMutation({
    mutationFn: (id: string) => apiPost(`/model/${id}/activate`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: MODEL_LIST_KEY });
      const prev = queryClient.getQueryData<{ models: StoreModel[]; limit: number }>(MODEL_LIST_KEY);
      patchModels((current) => current.map((x) => ({ ...x, is_active: x.id === id })));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(MODEL_LIST_KEY, ctx.prev);
    },
    onSettled: () => invalidateModelLists(),
  });

  const handleSetActive = (id: string) => setActiveMut.mutate(id);

  const resetForm = () => {
    setGender('feminino');
    setName('');
    setSkin('morena_clara');
    setHairTexture('ondulado');
    setHairLength('medio');
    setHairColor('castanho');
    setBody('media');
  };

  /* Loading state — espelha 1:1 a estrutura real:
     - hero (title + counter)
     - botão "Nova modelo"
     - grid 3 colunas com card portrait + nome + subtitle ("Mulher Padrão") */
  if (loadingModels) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={[styles.content, { paddingTop: headerH + 16, paddingBottom: padBottom }]}>
          <View style={styles.header}>
            <View style={{ gap: 6 }}>
              <Skeleton width={210} height={32} borderRadius={8} />
              <Skeleton width={140} height={14} borderRadius={6} />
            </View>
            <Skeleton width={120} height={40} borderRadius={20} />
          </View>
          <View style={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <View key={i} style={portraitCardStyle}>
                <Skeleton width="100%" style={{ aspectRatio: 3 / 4 }} borderRadius={16} />
                <Skeleton width="70%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
                <Skeleton width="55%" height={12} borderRadius={4} style={{ marginTop: 4 }} />
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
    {ConfirmDeleteEl}
    </View>
    </ModelPeekProvider>
  );
}

export default function ModeloScreen() {
  return (
    <TabErrorBoundary screen="modelo">
      <ModeloScreenInner />
    </TabErrorBoundary>
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
  const router = useRouter();
  // Threshold matches the marketing site: show 6, then "Ver todas (X mais)".
  const COLLAPSE_THRESHOLD = 6;
  const totalShown = models.length;
  const shouldCollapse = totalShown > COLLAPSE_THRESHOLD && !showAllModels;
  const visibleModels = useMemo(
    () => (shouldCollapse ? models.slice(0, COLLAPSE_THRESHOLD) : models),
    [models, shouldCollapse],
  );
  const hiddenCount = totalShown - COLLAPSE_THRESHOLD;
  const portraitCardStyle = usePortraitCardStyle();
  // a11y — gate da pulse do "+" card. Variável local porque ModelsListBody é
  // um sub-componente próprio; ModeloScreenInner já tem outra `reduceMotion`
  // no escopo dele, então sem hoist viral.
  const reduceMotion = useReducedMotion();

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
            <View style={styles.emptyCtaStack}>
              <Button title={t('model.activatePlan')} onPress={onActivatePlan} />
              <Button
                title={t('model.emptyUseStockCta')}
                variant="ghost"
                onPress={() => router.push('/(tabs)/gerar')}
              />
            </View>
          ) : (
            // canCreate: ainda 2 CTAs — primária "criar primeiro modelo",
            // escape pra galeria de modelos prontos. Antes era só uma e o
            // usuário sem inspiração ficava travado.
            <View style={styles.emptyCtaStack}>
              <Button title={t('model.createFirst')} onPress={onCreate} />
              <Button
                title={t('model.emptyUseStockCta')}
                variant="ghost"
                onPress={() => router.push('/(tabs)/gerar')}
              />
            </View>
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
                style={portraitCardStyle}
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
                      // Subtle brand glow + hover-able look. Reads as
                      // "tap me — there's more to add" instead of just
                      // "empty slot". Reanimated 4 CSS pulse keeps it alive
                      // without being noisy. Com reduceMotion, glow estática.
                      boxShadow: `0 0 12px ${Colors.brand.glowMid}`,
                      ...(reduceMotion ? {} : {
                        animationName: {
                          '0%': { boxShadow: `0 0 8px ${Colors.brand.glowSoft}` },
                          '50%': { boxShadow: `0 0 16px ${Colors.brand.glowMid}` },
                          '100%': { boxShadow: `0 0 8px ${Colors.brand.glowSoft}` },
                        },
                        animationDuration: '2400ms',
                        animationIterationCount: 'infinite',
                        animationTimingFunction: 'ease-in-out',
                      }),
                    } as any,
                  ]}
                >
                  {/* Plus glyph in a brand-tinted soft circle — replaces the
                      flat "+" with a Material-3-flavoured action chip look. */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: Colors.brand.glowSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={[styles.newModelPlus, { color: Colors.brand.primary, fontSize: 28, lineHeight: 32 }]}
                    >
                      +
                    </Text>
                  </View>
                  <Text
                    style={[styles.newModelLabel, { color: Colors.brand.primary }]}
                  >
                    {t('model.newModelCardLabel')}
                  </Text>
                  <Text
                    style={[
                      styles.newModelCounter,
                      { color: colors.textSecondary, fontVariant: ['tabular-nums'] },
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
  // Delete é exposto via prop, mas não está cabeado a um gesto neste card —
  // long-press fica reservado pro peek preview (paridade com /gerar).
  // O delete vive na ModelBottomSheet (botão dedicado quando aplicável).
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
  // a11y — gate do shimmer do placeholder enquanto o preview do modelo gera.
  const reduceMotion = useReducedMotion();
  const matchFem = BODY_TYPES_FEM.find(b => b.value === model.body_type);
  const matchMasc = BODY_TYPES_MASC.find(b => b.value === model.body_type);
  const labelBody = matchFem
    ? t(matchFem.labelKey)
    : matchMasc
    ? t(matchMasc.labelKey)
    : model.body_type;
  // Subtitle paritário com o site: "Mulher Padrão" / "Homem Atlético" etc.
  // Keys dedicadas (genderPrefix.male/female) — os keys genderMale/Female
  // trazem símbolo ♂♀ pro form e poluiriam a frase aqui.
  const genderPrefix = t(matchMasc ? 'model.genderPrefix.male' : 'model.genderPrefix.female');
  const subtitle = `${genderPrefix} ${labelBody}`;

  const hasPhoto = !!model.photo_url;
  const portraitCardStyle = usePortraitCardStyle();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(400).springify()}
      style={portraitCardStyle}
    >
      {/* AuraGlow brand-tinted halo behind active models — same Skia
          component used on the Pro plan card in /plano, intentional to
          reinforce "this is the chosen one" visually across screens.
          Sized to bleed outside the card edges (negative offsets) so the
          glow halos the silhouette instead of being clipped by the card
          border. */}
      {model.is_active && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -16,
            left: -16,
            right: -16,
            bottom: -16,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: -1,
          }}
        >
          <AuraGlow
            size={Math.max(160, 200)}
            color={Colors.brand.secondary}
            opacityMin={0.18}
            opacityMax={0.42}
            periodMs={3200}
          />
        </View>
      )}
      {/* ModelPressable: tap = ativa modelo, long-press = peek preview overlay
          (paridade com a tela /gerar). Border permanente (transparente quando
          inactive) + sem mudança de elevation entre estados — deixa o layout
          estável durante seleção, evitando flicker de re-render no Android. */}
      <ModelPressable
        model={model as never}
        disablePeek={!hasPhoto}
        onPress={() => onSetActive(model.id)}
        accessibilityLabel={t('model.activateAria', { name: model.name })}
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
            {/* While the preview generates, the placeholder has a slow shimmer
                wave overlay (Reanimated CSS API) that signals "this is being
                worked on" without using a spinner — feels less mechanical.
                Com reduceMotion, overlay constante a 0.18 (já comunica "vazio"). */}
            {!model.preview_failed && !reduceMotion && (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    animationName: {
                      '0%': { opacity: 0 },
                      '50%': { opacity: 0.6 },
                      '100%': { opacity: 0 },
                    },
                    animationDuration: '1800ms',
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'ease-in-out',
                  } as any,
                ]}
              />
            )}
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
        {model.is_active && (
          <PulsingBadge
            label={t(matchMasc ? 'model.statusActiveMasc' : 'model.statusActive')}
          />
        )}

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
  content: { padding: tokens.spacing.xl, gap: tokens.spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleHero: {
    fontSize: tokens.fontSize.displayLg,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  // tabular-nums on the "{n}/{limit} criados" label so digits don't jiggle
  // mid-fetch when the count updates after a create/delete.
  subtitle: { fontSize: tokens.fontSize.base, marginTop: 2, fontVariant: ['tabular-nums'] },
  counterPill: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterPillText: {
    fontSize: tokens.fontSize.md,
    fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
  },
  newModelCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
  newModelPlus: {
    fontSize: tokens.spacing.xxxl,
    fontFamily: 'Inter_700Bold',
    lineHeight: 36,
  },
  newModelLabel: {
    fontSize: tokens.fontSize.md,
    fontFamily: 'Inter_700Bold',
  },
  newModelCounter: {
    fontSize: tokens.fontSize.xs,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  viewAllBtn: {
    alignSelf: 'center',
    paddingVertical: tokens.spacing.mdLg,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  portraitCard: {
    // width injetado dinamicamente via useCardWidth() pra responder a rotação / split-view.
    gap: tokens.spacing.sm,
  },
  portraitImageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    ...rounded(tokens.radii.xl),
    overflow: 'hidden',
    position: 'relative',
  },
  portraitImage: { width: '100%', height: '100%' },
  modelPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  generatingText: { color: '#fff', fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.semibold, marginTop: tokens.spacing.xs },
  activeBadge: {
    position: 'absolute',
    top: tokens.spacing.sm,
    right: tokens.spacing.sm,
    backgroundColor: Colors.brand.success,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: 10,
  },
  activeBadgeText: { color: '#fff', fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.black },
  // Pareado com infoBadge/infoBadgeInner do /gerar pra paridade visual:
  // mesmo formato redondo, glow fucsia, ring branco. Antes ficava
  // visualmente "hexagonal" porque o inner não tinha borderRadius e o
  // border de 1px desenhava reto sobre o gradient clipado pelo outer.
  zoomBadge: {
    position: 'absolute',
    bottom: tokens.spacing.sm,
    right: tokens.spacing.sm,
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  zoomBadgeInner: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  modelName: { fontSize: tokens.fontSize.base, fontWeight: tokens.fontWeight.semibold },
  modelSubtitle: { fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.medium, marginTop: -2 },
  empty: { alignItems: 'center', paddingTop: tokens.spacing.huge, gap: tokens.spacing.lg },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(139,92,246,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xs,
  },
  emptyTitle: { fontSize: tokens.fontSize.xxxl, fontWeight: tokens.fontWeight.bold, textAlign: 'center' },
  emptyDesc: { fontSize: tokens.fontSize.base, textAlign: 'center', paddingHorizontal: tokens.spacing.xxl, lineHeight: tokens.spacing.xl },
  emptyCtaStack: { gap: tokens.spacing.sm, alignSelf: 'stretch', paddingHorizontal: tokens.spacing.xxxl, marginTop: tokens.spacing.md },
});
