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
import FontAwesome from '@expo/vector-icons/FontAwesome';
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

/* Emoji prefixo do pill — paritário com objectives no site. */
const OBJECTIVE_EMOJI: Record<ObjectiveKey, string> = {
  venda_imediata: '🛍',
  lancamento: '🚀',
  promocao: '🔥',
  engajamento: '💬',
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
              // `from=historico` ensina o resultado a voltar pra cá em vez de
              // cair no /gerar (default seria popar a stack do tab `gerar`).
              router.push(`/(tabs)/gerar/resultado?id=${item.id}&from=historico`);
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
              {/* (Accent stripe removido: favorito já é sinalizado pela
                  estrela preenchida, sombra brand-tinted e border brand.
                  Com thumb bleed-edge, stripe ficaria coberto.) */}

              <View style={styles.row}>
                {/* Estrela à parte (igual site mobile): 32×32 redonda, glass
                    quando inactive, gradient brand quando ativa. */}
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
                      <FontAwesome name="star" size={14} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.starInner, styles.starInnerInactive]}>
                      <FontAwesome name="star-o" size={15} color={colors.textSecondary} />
                    </View>
                  )}
                </AnimatedPressable>

                {/* Thumbnail circular — paritário com /historico do site mobile.
                    contentPosition "0% 18%" foca no rosto do modelo (que em
                    fotos full-body fica nos primeiros 15-25% do frame), e o
                    círculo cropa o resto. */}
                <View style={styles.thumbWrap}>
                  {thumb ? (
                    <Image
                      source={{ uri: thumb }}
                      style={styles.thumb}
                      contentFit="cover"
                      contentPosition={{ top: '15%', left: '50%' }}
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View
                      style={[
                        styles.thumb,
                        styles.thumbEmpty,
                        { backgroundColor: colors.backgroundSecondary },
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>
                        {item.status === 'failed' ? '⚠️' : '⏳'}
                      </Text>
                    </View>
                  )}
                  {extraCount > 0 && (
                    <View style={styles.thumbCount}>
                      <Text style={styles.thumbCountText}>+{extraCount}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.info}>
                  {/* Title — única linha bold, paritária com site /historico mobile. */}
                  <Text
                    style={[styles.headline, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {headline}
                  </Text>

                  {/* Linha única: pill (objective) + data, igual site. */}
                  <View style={styles.metaRow}>
                    {item.objective && (
                      <View
                        style={[
                          styles.objectivePill,
                          { backgroundColor: objColor + '1f', borderColor: objColor + '33' },
                        ]}
                      >
                        <Text style={styles.objectiveEmoji}>
                          {isObjectiveKey(item.objective) ? OBJECTIVE_EMOJI[item.objective] : '🎯'}
                        </Text>
                        <Text style={[styles.objectiveLabel, { color: objColor }]}>
                          {isObjectiveKey(item.objective)
                            ? t(`objectives.${item.objective}` as const)
                            : item.objective}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {formatDate(item.created_at, t, locale)}
                    </Text>
                    {statusColor && (
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    )}
                  </View>
                </View>

                <FontAwesome
                  name="angle-right"
                  size={20}
                  color={colors.textSecondary}
                />
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
          <Skeleton width={180} height={32} borderRadius={8} />
          <Skeleton width={120} height={14} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        {/* Filtros (Todos / Favoritos) */}
        <View style={styles.filters}>
          <Skeleton width={110} height={40} borderRadius={20} />
          <Skeleton width={130} height={40} borderRadius={20} />
        </View>
        {/* Cards: thumb 72×96 + padding => altura real ~124px. Borda esquerda
            mais larga simula o accent stripe dos favoritos pra ninguém estranhar
            quando o real renderizar. */}
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={78} borderRadius={14} style={{ marginBottom: 10 }} />
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
  /* Card paritário com /historico do site mobile: padding compacto, border
     sutil pra contraste no light mode (cards dissolviam no fundo antes), e
     sombra leve. Sem bleed do thumb. */
  card: {
    padding: 12,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(217,70,239,0.18)',
    shadowColor: '#0c0410',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardFavorited: {
    borderColor: Colors.brand.secondary,
    shadowColor: Colors.brand.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  /* Thumb circular 60×60 — proporção do site mobile. contentPosition
     'top 15%' foca no rosto do modelo (em fotos full-body o rosto fica nos
     primeiros 15-25% do frame). */
  thumbWrap: { width: 60, height: 60, position: 'relative' },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#0d0a14',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Badge "+N" colado no canto inferior-direito do círculo, brand-pink. */
  thumbCount: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fff',
  },
  thumbCountText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  /* Estrela 36×36 redonda — paridade com site mobile. */
  starBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  starInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  starInnerInactive: {
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.25)',
    backgroundColor: 'rgba(120,120,120,0.08)',
  },
  /* Info compacta — title + linha de meta (paridade site mobile). */
  info: { flex: 1, gap: 6, justifyContent: 'center' },
  headline: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  /* Pill com emoji prefix + label colored, paritário com o site /historico. */
  objectivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  objectiveEmoji: { fontSize: 11 },
  objectiveLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyDesc: { fontSize: 14 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
});
