import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { Image } from 'expo-image';
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
      const thumb = item.output?.image_urls?.find(Boolean);
      const seqSuffix = item.sequence_number ? ` #${item.sequence_number}` : '';
      const headline = item.title
        ? `${item.title}${seqSuffix}`
        : `${t('history.title')}${seqSuffix}`;
      const objColor =
        item.objective && isObjectiveKey(item.objective)
          ? objectiveColors[item.objective]
          : colors.textSecondary;
      const animationDelay = Math.min(index, 8) * 60;

      return (
        <Animated.View entering={FadeInDown.delay(animationDelay).duration(400).springify()}>
          <AnimatedPressable
            onPress={() => {
              router.push(`/(tabs)/gerar/resultado?id=${item.id}`);
            }}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={t('a11y.viewCampaign', { headline })}
          >
            <Card
              style={[
                styles.card,
                item.is_favorited && { borderColor: Colors.brand.secondary },
              ]}
            >
              <View style={styles.row}>
                <AnimatedPressable
                  onPress={() => {
                    toggleFavorite(item.id, item.is_favorited);
                  }}
                  haptic="press"
                  scale={0.85}
                  hitSlop={12}
                  style={styles.starBtn}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.is_favorited ? t('a11y.removeFavorite') : t('a11y.addFavorite')
                  }
                >
                  <Text style={{ fontSize: 20 }}>{item.is_favorited ? '⭐' : '☆'}</Text>
                </AnimatedPressable>

                {thumb ? (
                  <Image
                    source={{ uri: thumb }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={120}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View
                    style={[
                      styles.thumb,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <Text>
                      {item.status === 'completed'
                        ? '✅'
                        : item.status === 'failed'
                        ? '❌'
                        : '⏳'}
                    </Text>
                  </View>
                )}

                <View style={styles.info}>
                  <Text
                    style={[styles.headline, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {headline}
                  </Text>
                  <View style={styles.metaRow}>
                    {item.objective && (
                      <Text style={[styles.badge, { color: objColor }]}>
                        {isObjectiveKey(item.objective)
                          ? t(`objectives.${item.objective}` as const)
                          : item.objective}
                      </Text>
                    )}
                    <Text style={[styles.date, { color: colors.textSecondary }]}>
                      {formatDate(item.created_at, t, locale)}
                    </Text>
                    {item.status === 'completed' && (
                      <View style={[styles.statusDot, { backgroundColor: Colors.brand.success }]} />
                    )}
                    {item.status === 'failed' && (
                      <View style={[styles.statusDot, { backgroundColor: Colors.brand.error }]} />
                    )}
                    {item.status === 'processing' && (
                      <View style={[styles.statusDot, { backgroundColor: Colors.brand.warning }]} />
                    )}
                  </View>
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
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
  list: { padding: 20, gap: 10 },
  card: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  starBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden' },
  info: { flex: 1, gap: 4 },
  headline: { fontSize: 14, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { fontSize: 12, fontWeight: '600' },
  date: { fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyDesc: { fontSize: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
