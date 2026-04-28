import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedPressable, Card, GradientText, Skeleton } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import { useTabContentPaddingBottom } from '@/components/tabBarLayout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGet, apiGetCached, apiPatch, invalidateApiCache } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Campaign } from '@/types';

// Colors are presentation tokens — kept here. Labels move to i18n
// (`objectives.<key>`) so EN users see "Sale / Launch / Promo / Engagement".
type ObjectiveKey = 'venda_imediata' | 'lancamento' | 'promocao' | 'engajamento';

const objectiveColors: Record<ObjectiveKey, string> = {
  venda_imediata: '#10b981',
  lancamento: '#3b82f6',
  promocao: '#ef4444',
  engajamento: '#a855f7',
};

function isObjectiveKey(v: string | null | undefined): v is ObjectiveKey {
  return v === 'venda_imediata' || v === 'lancamento' || v === 'promocao' || v === 'engajamento';
}

type TFn = ReturnType<typeof useT>['t'];

function formatDate(d: string, t: TFn, locale: string) {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return t('date.today');
  if (diffDays === 1) return t('date.yesterday');
  if (diffDays < 7) return t('date.daysAgo', { n: diffDays });
  return date.toLocaleDateString(locale);
}

export default function HistoricoScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { t, locale } = useT();
  const headerH = useHeaderHeight();
  const padBottom = useTabContentPaddingBottom();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (opts?: { skipCache?: boolean }) => {
    setLoadError(false);
    try {
      if (opts?.skipCache) await invalidateApiCache('/campaigns');
      const data = await apiGetCached<{ data: Campaign[] }>('/campaigns', 30_000);
      setCampaigns(data.data || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ skipCache: true });
  }, [load]);

  const toggleFavorite = useCallback(async (id: string, current: boolean) => {
    setCampaigns(prev =>
      prev.map(c => (c.id === id ? { ...c, is_favorited: !current } : c)),
    );
    try {
      await apiPatch(`/campaign/${id}/favorite`, { favorited: !current });
      invalidateApiCache('/campaigns').catch(() => {});
    } catch {
      setCampaigns(prev =>
        prev.map(c => (c.id === id ? { ...c, is_favorited: current } : c)),
      );
    }
  }, []);

  const filtered = useMemo(
    () => (filter === 'favorites' ? campaigns.filter(c => c.is_favorited) : campaigns),
    [campaigns, filter],
  );

  const favCount = useMemo(
    () => campaigns.filter(c => c.is_favorited).length,
    [campaigns],
  );

  const keyExtractor = useCallback((item: Campaign) => item.id, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Campaign>) => {
      const allThumbs = item.output?.image_urls?.filter(Boolean) ?? [];
      const thumb = allThumbs[0];
      const extraCount = Math.max(0, allThumbs.length - 1);
      const seqSuffix = item.sequence_number ? ` #${item.sequence_number}` : '';
      const headline = item.title
        ? `${item.title}${seqSuffix}`
        : `${t('history.title')}${seqSuffix}`;
      const objColor =
        item.objective && isObjectiveKey(item.objective)
          ? objectiveColors[item.objective]
          : colors.textSecondary;
      // Limita o stagger de animação aos primeiros itens — em listas longas
      // o stagger acumulado fica cansativo.
      const animationDelay = Math.min(index, 6) * 50;

      const statusColor =
        item.status === 'completed'
          ? Colors.brand.success
          : item.status === 'failed'
          ? Colors.brand.error
          : item.status === 'processing'
          ? Colors.brand.warning
          : null;

      return (
        <Animated.View entering={FadeInDown.delay(animationDelay).duration(380).springify()}>
          <AnimatedPressable
            onPress={() => {
              router.push(`/(tabs)/gerar/resultado?id=${item.id}`);
            }}
            haptic="tap"
            scale={0.98}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.viewCampaign', { headline })}
          >
            <Card
              style={[
                styles.card,
                item.is_favorited && styles.cardFavorited,
              ]}
            >
              {/* Accent stripe na esquerda (favoritados) — visual editorial
                  estilo Slack starred / Linear focused. 4px brand-gradient
                  vertical, marca instantaneamente o item sem peso visual. */}
              {item.is_favorited && (
                <LinearGradient
                  colors={Colors.brand.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.favoriteAccent}
                  pointerEvents="none"
                />
              )}

              <View style={styles.row}>
                {/* Thumbnail editorial — 4:5 com `contain` em vez de cover.
                    Antes mesmo com top-anchor o crop ainda cortava parte
                    relevante das fotos verticais. `contain` preserva a foto
                    inteira; o fundo gradient sutil disfarça letterbox. */}
                <View style={styles.thumbWrap}>
                  {thumb ? (
                    <View style={styles.thumb}>
                      <LinearGradient
                        colors={['rgba(217,70,239,0.10)', 'rgba(168,85,247,0.06)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Image
                        source={{ uri: thumb }}
                        style={StyleSheet.absoluteFill}
                        contentFit="contain"
                        contentPosition="top"
                        transition={150}
                        cachePolicy="memory-disk"
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.thumb,
                        styles.thumbEmpty,
                        { backgroundColor: colors.backgroundSecondary },
                      ]}
                    >
                      <Text style={{ fontSize: 24 }}>
                        {item.status === 'failed' ? '⚠️' : '⏳'}
                      </Text>
                    </View>
                  )}

                  {extraCount > 0 && (
                    <View style={styles.thumbCount}>
                      <Text style={styles.thumbCountText}>+{extraCount}</Text>
                    </View>
                  )}

                  {/* Estrela: gradient brand-pink quando favoritada (presença
                      forte), bg escuro semi-transparente quando não. Tamanho
                      maior (34×34) com sombra dá peso de botão de ação real. */}
                  <AnimatedPressable
                    onPress={() => {
                      toggleFavorite(item.id, item.is_favorited);
                    }}
                    haptic="press"
                    scale={0.85}
                    hitSlop={10}
                    style={styles.starBtn}
                    accessibilityRole="button"
                    accessibilityLabel={
                      item.is_favorited ? t('a11y.removeFavorite') : t('a11y.addFavorite')
                    }
                  >
                    {item.is_favorited ? (
                      <LinearGradient
                        colors={Colors.brand.gradientPrimary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.starInner}
                      >
                        <Text style={styles.starTextActive}>★</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.starInner, styles.starInnerInactive]}>
                        <Text style={styles.starTextInactive}>☆</Text>
                      </View>
                    )}
                  </AnimatedPressable>
                </View>

                <View style={styles.info}>
                  <Text
                    style={[styles.headline, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {headline}
                  </Text>
                  {item.objective && (
                    <View style={styles.objectiveRow}>
                      <View style={[styles.objectiveDot, { backgroundColor: objColor }]} />
                      <Text style={[styles.objectiveLabel, { color: objColor }]}>
                        {isObjectiveKey(item.objective)
                          ? t(`objectives.${item.objective}` as const)
                          : item.objective}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={[styles.date, { color: colors.textSecondary }]}>
                      {formatDate(item.created_at, t, locale)}
                    </Text>
                    {statusColor && (
                      <>
                        <Text style={[styles.metaSep, { color: colors.textSecondary }]}>
                          ·
                        </Text>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      </>
                    )}
                  </View>
                </View>
              </View>
            </Card>
          </AnimatedPressable>
        </Animated.View>
      );
    },
    [colors, router, toggleFavorite, t, locale],
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={[styles.header, { paddingTop: headerH + 8 }]}>
          <Skeleton width={140} height={28} borderRadius={8} />
          <Skeleton width={100} height={14} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.list}>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} height={100} borderRadius={14} style={{ marginBottom: 12 }} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={[styles.header, { paddingTop: headerH + 8 }]}>
        {/* Hero: full title rendered as fucsia gradient mask. */}
        <GradientText colors={Colors.brand.gradientPrimary} style={styles.title}>
          {t('history.titleHighlight')}
        </GradientText>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {t(campaigns.length === 1 ? 'history.countOne' : 'history.countOther', {
            n: campaigns.length,
          })}
        </Text>
      </View>

      {campaigns.length > 0 && (
        <View style={styles.filters}>
          {(['all', 'favorites'] as const).map(f => (
            <AnimatedPressable
              key={f}
              onPress={() => {
                if (filter !== f) {
                  haptic.selection();
                  setFilter(f);
                }
              }}
              haptic={false}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f }}
              style={[
                styles.filterBtn,
                { borderColor: colors.border, backgroundColor: colors.surface2 },
                filter === f && {
                  backgroundColor: Colors.brand.primary,
                  borderColor: Colors.brand.primary,
                  shadowColor: Colors.brand.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.32,
                  shadowRadius: 10,
                  elevation: 4,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filter === f ? '#fff' : colors.textSecondary },
                ]}
              >
                {f === 'all'
                  ? t('history.filterAll', { n: campaigns.length })
                  : t('history.filterFavorites', { n: favCount })}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      )}

      <FlashList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ ...styles.list, paddingBottom: padBottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brand.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {loadError ? (
              <>
                <Text style={{ fontSize: 40 }}>⚠️</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {t('history.loadErrorTitle')}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {t('history.loadErrorDesc')}
                </Text>
                <AnimatedPressable
                  onPress={() => load({ skipCache: true })}
                  haptic="tap"
                  hitSlop={16}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
                  style={{ minHeight: 48, justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      color: Colors.brand.primary,
                      fontWeight: '600',
                      marginTop: 8,
                    }}
                  >
                    {t('common.retry')}
                  </Text>
                </AnimatedPressable>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 40 }}>{'\u{1F4CB}'}</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {filter === 'favorites'
                    ? t('history.emptyFavoritesTitle')
                    : t('history.emptyTitle')}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {filter === 'favorites'
                    ? t('history.emptyFavoritesDesc')
                    : t('history.emptyDesc')}
                </Text>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

/* Why FlashList over FlatList here?
 * FlashList recycles cells (RecyclerView-style) instead of mounting/unmounting
 * components as the user scrolls. For a list of campaigns the user might scroll
 * through hundreds of times, this means:
 *  - dramatically lower memory pressure (cells are reused, not re-created)
 *  - smoother frame times (no GC stalls during fast flicks)
 *  - works better with the optimistic favorite toggle (recycled cells re-bind
 *    instantly to the new is_favorited state instead of remounting Animated.View)
 *
 * v2 dropped estimatedItemSize, getItemLayout, windowSize — the autosizer
 * does it all. Less to tune, less to break.
 */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, gap: 2 },
  title: { fontSize: 28, fontWeight: '700' },
  count: { fontSize: 14 },
  filters: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16 },
  /* marginBottom em cada card — FlashList não aplica `gap` em
     contentContainerStyle. 14px alinha com o "respiro" de listas dos grandes
     (Apple Photos, Linear). Padding-left maior pra deixar espaço pro accent
     stripe da esquerda quando favoritado. */
  card: {
    padding: 14,
    paddingLeft: 18,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  cardFavorited: {
    borderColor: Colors.brand.secondary,
    shadowColor: Colors.brand.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  /* Accent vertical stripe — left edge do card. 4px brand gradient.
     Pointer-events none pra não roubar o tap do card. */
  favoriteAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  /* Thumb wrap permite estrela flutuar fora do thumb. */
  thumbWrap: { width: 72, height: 96, position: 'relative' },
  /* Border sutil + bg gradient-soft pra letterbox de fotos com fundo branco
     não ficar gritante (o gradient pinkish dá feel editorial). */
  thumb: {
    width: 72,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(217,70,239,0.14)',
    backgroundColor: '#0d0a14',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCount: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  thumbCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  /* Estrela: 34×34, posicionada saindo levemente do canto. Sombra dá lift
     visual; gradient quando ativa, glass-bg quando inativa. */
  starBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  starInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 17,
  },
  starInnerInactive: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  starTextActive: { color: '#fff', fontSize: 16, lineHeight: 18, includeFontPadding: false },
  starTextInactive: { color: '#fff', fontSize: 16, lineHeight: 18, includeFontPadding: false },
  info: { flex: 1, gap: 6, minHeight: 96, justifyContent: 'center' },
  headline: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  objectiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  objectiveDot: { width: 8, height: 8, borderRadius: 4 },
  objectiveLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaSep: { fontSize: 12 },
  date: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyDesc: { fontSize: 14 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
});
