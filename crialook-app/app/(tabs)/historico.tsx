import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as LegacyFS from 'expo-file-system/legacy';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect, useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable, Card, GradientText, Skeleton } from '@/components/ui';
import {
  CampaignPeekProvider,
  CampaignPressable,
  type CampaignPeekData,
} from '@/components/CampaignLongPressPreview';
import { TabErrorBoundary } from '@/components/TabErrorBoundary';
import { haptic } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import { useTabContentPaddingBottom } from '@/components/tabBarLayout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { tokens, rounded } from '@/lib/theme/tokens';
import { apiGet, apiPatch } from '@/lib/api';
import { qk } from '@/lib/query-client';
import { CampaignListResponse } from '@/lib/schemas';
import { useT } from '@/lib/i18n';
import { markHistoricoSeen } from '@/lib/unseenGenerations';
import { isTrialCampaign, type Campaign } from '@/types';

// ─── Presentation tokens ───────────────────────────────────────────────────
type ObjectiveKey = 'venda_imediata' | 'lancamento' | 'promocao' | 'engajamento';

const objectiveColors: Record<ObjectiveKey, string> = {
  venda_imediata: Colors.brand.success,
  // No `brand.info` token exists; `#3b82f6` (cold blue) was off-palette.
  // Fallback to brand violet — `lancamento` semantically maps to the brand.
  lancamento: Colors.brand.violet,
  promocao: Colors.brand.error,
  engajamento: Colors.brand.violet,
};

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

// ─── Date bucketing for section headers ────────────────────────────────────
type Bucket = 'thisWeek' | 'thisMonth' | 'older';

function bucketOf(dateStr: string, nowMs: number): Bucket {
  const ageMs = nowMs - new Date(dateStr).getTime();
  const days = ageMs / 86400000;
  if (days < 7) return 'thisWeek';
  if (days < 30) return 'thisMonth';
  return 'older';
}

function bucketLabel(b: Bucket, t: TFn): string {
  if (b === 'thisWeek') return t('history.sectionThisWeek');
  if (b === 'thisMonth') return t('history.sectionThisMonth');
  return t('history.sectionOlder');
}

// ─── Status meta ────────────────────────────────────────────────────────────
type StatusMeta = { label: string; color: string; icon: 'check-circle' | 'spinner' | 'exclamation-triangle' };

function getStatusMeta(status: string, t: TFn): StatusMeta | null {
  if (status === 'completed') {
    return { label: t('history.statusCompleted'), color: Colors.brand.success, icon: 'check-circle' };
  }
  if (status === 'processing' || status === 'queued') {
    return { label: t('history.statusProcessing'), color: Colors.brand.warning, icon: 'spinner' };
  }
  if (status === 'failed') {
    return { label: t('history.statusFailed'), color: Colors.brand.error, icon: 'exclamation-triangle' };
  }
  return null;
}

// ─── Mixed list item type (FlashList recycles per type) ────────────────────
type ListItem =
  | { type: 'header'; key: string; title: string }
  | { type: 'campaign'; key: string; campaign: Campaign; index: number };

// ─── Section header (sticky-ish via FlashList recycling) ───────────────────
function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color }]} selectable={false}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Context menu (3-dots) ────────────────────────────────────────────────
interface ContextMenuButtonProps {
  onShare: () => void;
  /** Optional — quando undefined, esconde a opção "Excluir" (ex: enquanto o
   *  endpoint DELETE no backend não existe). */
  onDelete?: () => void;
  t: TFn;
  textColor: string;
  surfaceColor: string;
  borderColor: string;
}

function ContextMenuButton({
  onShare,
  onDelete,
  t,
  textColor,
  surfaceColor,
  borderColor,
}: ContextMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggerRef = useRef<View>(null);

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    // Mede a posição do trigger no viewport e ancora o Modal lá.
    // Sem Modal, o menu é clipado pelo Card (overflow: hidden) — o usuário
    // só via metade do "Compartilhar".
    triggerRef.current?.measureInWindow((x, y, _w, h) => {
      setAnchor({ x, y: y + h + 4 });
      setOpen(true);
    });
  }, []);

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={(e) => {
          // Prevent the parent CampaignPressable from receiving this tap.
          e.stopPropagation();
          haptic.tap();
          openMenu();
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('history.menuMoreActions')}
        style={styles.menuTrigger}
      >
        <FontAwesome name="ellipsis-v" size={16} color={textColor} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <View
            style={[
              styles.menu,
              {
                backgroundColor: surfaceColor,
                borderColor,
                // Ancora pelo right: alinhado à direita do trigger menos a
                // largura mínima do menu (170 + 16 de respiro).
                top: anchor.y,
                right: 16,
              },
            ]}
            // Stop propagation: tapping inside the menu shouldn't close it
            // before the row's onPress fires.
            onStartShouldSetResponder={() => true}
          >
            <MenuRow
              icon="share-square-o"
              label={t('history.menuShare')}
              color={textColor}
              onPress={() => {
                close();
                onShare();
              }}
            />
            {/* Favoritar/desfavoritar foi removido daqui — já temos 2 affordances
                redundantes pra mesma ação (swipe pra esquerda + tap na estrela
                inline no card). Adicionar aqui só polui o menu. */}
            {onDelete && (
              <MenuRow
                icon="trash"
                label={t('history.menuDelete')}
                color={Colors.brand.error}
                onPress={() => {
                  close();
                  onDelete();
                }}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuRow({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      android_ripple={{ color: 'rgba(217,70,239,0.12)' }}
      style={styles.menuRow}
    >
      <FontAwesome name={icon} size={14} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Swipe action surfaces (left = favorite, right = delete) ───────────────
function FavoriteSwipeAction({ favorited }: { favorited: boolean }) {
  return (
    <View style={[styles.swipeAction, { backgroundColor: Colors.brand.primary }]}>
      <FontAwesome name={favorited ? 'star' : 'star-o'} size={20} color="#fff" />
    </View>
  );
}

function DeleteSwipeAction() {
  return (
    <View style={[styles.swipeAction, { backgroundColor: Colors.brand.error }]}>
      <FontAwesome name="trash" size={20} color="#fff" />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────
function HistoricoScreenInner() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { t, locale } = useT();
  const headerH = useHeaderHeight();
  const padBottom = useTabContentPaddingBottom();
  const queryClient = useQueryClient();
  // a11y WCAG 2.3.3 — sem isso o pulse infinito em cards favoritados +
  // stagger de entrada disparam mesmo com "Remover animações" ligado.
  const reduceMotion = useReducedMotion();

  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Track open swipeables so opening a new one closes the previous — Material 3
  // pattern (only one swipe surface visible at a time).
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const lastOpenedRef = useRef<string | null>(null);

  const {
    data,
    isPending,
    isFetching,
    refetch,
    isError: loadError,
  } = useQuery({
    queryKey: qk.campaigns.list(),
    queryFn: ({ signal }) =>
      apiGet('/campaigns', { signal, schema: CampaignListResponse }),
    staleTime: 30_000,
  });
  const campaigns = data?.data ?? [];
  const loading = isPending;
  const refreshing = isFetching && !isPending;

  useFocusEffect(
    useCallback(() => {
      // Antes: refetch() em todo focus — flash de skeleton mesmo com data
      // fresh (o staleTime de 30s era ignorado). Agora deixa o tanstack-query
      // decidir: se os dados estão stale, ele refetch sozinho ao montar; se
      // não, mantém o cache. Sem flicker quando o user só pula entre tabs.
      // Stamp "seen now" so the tab badge clears. Cleared on every focus —
      // any new campaigns that complete while this tab is active won't show
      // a badge until the user navigates away and the next one finishes.
      markHistoricoSeen();
    }, []),
  );

  const onRefresh = useCallback(() => {
    haptic.pull();
    queryClient.invalidateQueries({ queryKey: qk.campaigns.list() });
  }, [queryClient]);

  // ─── Mutations ──────────────────────────────────────────────────────────
  const toggleFavoriteMut = useMutation({
    mutationFn: ({ id, favorited }: { id: string; favorited: boolean }) =>
      apiPatch(`/campaign/${id}/favorite`, { favorited }),
    onMutate: async ({ id, favorited }) => {
      await queryClient.cancelQueries({ queryKey: qk.campaigns.list() });
      const prev = queryClient.getQueryData<{ data: Campaign[] }>(qk.campaigns.list());
      queryClient.setQueryData<{ data: Campaign[] }>(qk.campaigns.list(), (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((c) => (c.id === id ? { ...c, is_favorited: favorited } : c)),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk.campaigns.list(), ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.campaigns.list() });
    },
  });

  const toggleFavorite = useCallback(
    (id: string, current: boolean) => toggleFavoriteMut.mutate({ id, favorited: !current }),
    [toggleFavoriteMut],
  );

  /**
   * NOTE: o backend ainda NÃO expõe DELETE /campaigns/[id]
   * (só GET — ver `campanha-ia/src/app/api/campaigns/[id]/route.ts`). A
   * mutation + UI de delete estavam mocadas e teriam 404 silencioso. Até
   * o endpoint nascer, a opção de excluir fica fora da UI: removemos a
   * swipe-right e a entrada "Excluir" do menu 3-dots.
   */
  const deleteSupported = false;

  /**
   * Share — opens native share sheet with a deep link to the campaign. The
   * user's friends/colleagues land on resultado screen if they have the app
   * (deep link), or on the website otherwise.
   */
  const shareCampaign = useCallback(
    async (campaign: Campaign) => {
      // Paridade com o share da resultado.tsx: compartilha o ARQUIVO da
      // foto (download → cache → Sharing.shareAsync), não a URL. Assim o
      // usuário escolhe Insta/Stories/WhatsApp e a imagem é enviada
      // diretamente em vez de cair num link externo.
      const imageUrl = campaign.output?.image_urls?.find((u) => !!u) ?? null;
      if (!imageUrl) {
        // Campanha em processing/failed sem foto pronta — não tem o que
        // compartilhar. Avisa em vez de cair em erro silencioso.
        toast.warning(t('history.shareUnavailable'));
        return;
      }
      try {
        haptic.tap();
        const localUri = `${LegacyFS.cacheDirectory}crialook_share_${campaign.id}_${Date.now()}.jpg`;
        await LegacyFS.downloadAsync(imageUrl, localUri);
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          toast.error(t('common.error'));
          return;
        }
        await Sharing.shareAsync(localUri, {
          mimeType: 'image/jpeg',
          dialogTitle: t('history.menuShare'),
        });
      } catch {
        toast.error(t('common.error'));
      }
    },
    [t],
  );

  // ─── Derived data ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = filter === 'favorites' ? campaigns.filter((c) => c.is_favorited) : campaigns;
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter(
        (c) =>
          (c.title?.toLowerCase().includes(q) ?? false) ||
          (c.objective?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [campaigns, filter, searchQuery]);

  const favCount = useMemo(
    () => campaigns.filter((c) => c.is_favorited).length,
    [campaigns],
  );

  /** Hero counter — campanhas dos últimos 30 dias. Mais relevante que total
   *  histórico (que pode passar de 100 e perder significado). */
  const thisMonthCount = useMemo(() => {
    const now = Date.now();
    const month30 = 30 * 86400000;
    return campaigns.filter((c) => now - new Date(c.created_at).getTime() < month30).length;
  }, [campaigns]);

  /** Mixed list with section headers interleaved between campaign cards.
   *  FlashList recycles per type via getItemType so sections never re-layout
   *  during scroll. Bucket recomputed once per render against current Date.now().
   */
  const items = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];
    const nowMs = Date.now();
    let lastBucket: Bucket | null = null;
    filtered.forEach((c, i) => {
      const b = bucketOf(c.created_at, nowMs);
      if (b !== lastBucket) {
        result.push({ type: 'header', key: `header-${b}`, title: bucketLabel(b, t) });
        lastBucket = b;
      }
      result.push({ type: 'campaign', key: c.id, campaign: c, index: i });
    });
    return result;
  }, [filtered, t]);

  // ─── Render ─────────────────────────────────────────────────────────────
  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  // No-op when delete isn't supported — keeps the menu prop type intact
  // without leaking unused references in dependency arrays.
  const noopDelete = useCallback(() => {}, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) => {
      if (item.type === 'header') {
        return <SectionHeader title={item.title} color={colors.textSecondary} />;
      }

      const c = item.campaign;
      const allThumbs = c.output?.image_urls?.filter(Boolean) ?? [];
      const thumb = allThumbs[0];
      const isTrial = isTrialCampaign(c);
      const lockedCount = isTrial ? c.output?.lockedTeaserUrls?.length ?? 0 : 0;
      const extraCount = isTrial ? lockedCount : Math.max(0, allThumbs.length - 1);
      const seqSuffix = c.sequence_number ? ` #${c.sequence_number}` : '';
      const headline = c.title
        ? `${c.title}${seqSuffix}`
        : `${t('history.title')}${seqSuffix}`;
      const objColor =
        c.objective && isObjectiveKey(c.objective)
          ? objectiveColors[c.objective]
          : colors.textSecondary;
      // Stagger expandido pra 12 (era 6) — FlashList recicla entre o stagger
      // e o scroll, então 12 entradas únicas = bom equilíbrio entre vivo e
      // não-cansativo. Acima disso vira pulse contínuo desnecessário.
      // Com reduceMotion, sem stagger — entrada instantânea.
      const animationDelay = reduceMotion ? 0 : Math.min(item.index, 12) * 45;

      const statusMeta = getStatusMeta(c.status, t);
      const peekData: CampaignPeekData = {
        id: c.id,
        title: headline,
        thumbnailUrl: thumb ?? null,
        subtitle: formatDate(c.created_at, t, locale),
      };

      const onCardPress = () => {
        router.push(`/(tabs)/gerar/resultado?id=${c.id}&from=historico`);
      };

      return (
        <Animated.View entering={FadeInDown.delay(animationDelay).duration(380).springify()}>
          <Swipeable
            ref={(ref) => {
              if (ref) swipeableRefs.current.set(c.id, ref);
              else swipeableRefs.current.delete(c.id);
            }}
            onSwipeableWillOpen={() => {
              const last = lastOpenedRef.current;
              if (last && last !== c.id) {
                swipeableRefs.current.get(last)?.close();
              }
              lastOpenedRef.current = c.id;
              haptic.snap();
            }}
            renderLeftActions={() => <FavoriteSwipeAction favorited={c.is_favorited} />}
            // Right swipe (delete) intentionally omitted — backend não tem
            // DELETE /campaigns/[id] ainda. Restaurar quando endpoint sair.
            onSwipeableOpen={(direction) => {
              if (direction === 'left') {
                toggleFavorite(c.id, c.is_favorited);
                swipeableRefs.current.get(c.id)?.close();
              }
            }}
            overshootLeft={false}
          >
            <CampaignPressable
              data={peekData}
              onPress={onCardPress}
              accessibilityLabel={t('a11y.viewCampaign', { headline })}
              disablePeek={!thumb}
            >
              <Card
                style={[
                  styles.card,
                  c.is_favorited && styles.cardFavorited,
                  /* Reanimated 4 CSS pulse on the brand shadow when favorited
                     — quiet glow that says "this is the saved one" without
                     screaming. Gate em reduceMotion: vira box-shadow estática. */
                  c.is_favorited && !reduceMotion && ({
                    animationName: {
                      '0%': { boxShadow: `0 4px 12px rgba(236,72,153,0.15)` },
                      '50%': { boxShadow: `0 6px 20px rgba(236,72,153,0.32)` },
                      '100%': { boxShadow: `0 4px 12px rgba(236,72,153,0.15)` },
                    },
                    animationDuration: '2800ms',
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'ease-in-out',
                  } as any),
                  c.is_favorited && reduceMotion && ({
                    boxShadow: '0 4px 12px rgba(236,72,153,0.22)',
                  } as any),
                ]}
              >
                <View style={styles.row}>
                  {/* Star pressable — kept inline so single-tap favorite is
                      reachable without committing to a swipe. */}
                  <AnimatedPressable
                    onPress={() => toggleFavorite(c.id, c.is_favorited)}
                    haptic="press"
                    scale={0.85}
                    hitSlop={10}
                    style={styles.starBtn}
                    accessibilityRole="button"
                    accessibilityLabel={
                      c.is_favorited ? t('a11y.removeFavorite') : t('a11y.addFavorite')
                    }
                  >
                    {c.is_favorited ? (
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

                  {/* Thumbnail. For processing campaigns we render a Skeleton
                      shimmer inside the circle so the row reads as "in flight"
                      instead of stuck/broken. */}
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
                    ) : c.status === 'processing' || c.status === 'queued' ? (
                      <View style={[styles.thumb, styles.thumbEmpty]}>
                        <Skeleton width="100%" height={60} borderRadius={30} />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.thumb,
                          styles.thumbEmpty,
                          { backgroundColor: colors.backgroundSecondary },
                        ]}
                      >
                        <Text style={{ fontSize: 18 }}>{c.status === 'failed' ? '⚠️' : '⏳'}</Text>
                      </View>
                    )}
                    {extraCount > 0 && (
                      <View
                        style={[
                          styles.thumbCount,
                          isTrial && {
                            backgroundColor: 'rgba(15,5,25,0.85)',
                            borderColor: Colors.brand.primary,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        {isTrial && (
                          <FontAwesome name="lock" size={8} color="#fff" style={{ marginRight: 2 }} />
                        )}
                        <Text style={styles.thumbCountText}>+{extraCount}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.info}>
                    <Text style={[styles.headline, { color: colors.text }]} numberOfLines={1}>
                      {headline}
                    </Text>
                    <View style={styles.metaRow}>
                      {/* Status pill expandida (substitui o statusDot 7px que
                          o usuário ignorava). Só renderiza pra estados não-completed
                          de quando há feedback útil; completed é o caso normal e
                          não merece ruído visual. */}
                      {statusMeta && c.status !== 'completed' && (
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: statusMeta.color + '1f',
                              borderColor: statusMeta.color + '33',
                            },
                          ]}
                        >
                          <FontAwesome name={statusMeta.icon} size={9} color={statusMeta.color} />
                          <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                            {statusMeta.label}
                          </Text>
                        </View>
                      )}
                      {/* Trial pill takes precedence over objective pill for trials. */}
                      {isTrial ? (
                        <View
                          style={[
                            styles.objectivePill,
                            {
                              backgroundColor: 'rgba(217,70,239,0.14)',
                              borderColor: 'rgba(217,70,239,0.32)',
                            },
                          ]}
                        >
                          <Text style={styles.objectiveEmoji}>🔒</Text>
                          <Text style={[styles.objectiveLabel, { color: Colors.brand.primary }]}>
                            {t('history.trialBadge')}
                          </Text>
                        </View>
                      ) : (
                        c.objective && c.status === 'completed' && (
                          <View
                            style={[
                              styles.objectivePill,
                              { backgroundColor: objColor + '1f', borderColor: objColor + '33' },
                            ]}
                          >
                            <Text style={styles.objectiveEmoji}>
                              {isObjectiveKey(c.objective) ? OBJECTIVE_EMOJI[c.objective] : '🎯'}
                            </Text>
                            <Text style={[styles.objectiveLabel, { color: objColor }]}>
                              {isObjectiveKey(c.objective)
                                ? t(`objectives.${c.objective}` as const)
                                : c.objective}
                            </Text>
                          </View>
                        )
                      )}
                      {/* Score badge — paridade com o site, lê o nota_geral
                          do campaign_scores que vem da query Supabase
                          (relação 1:N, mas só usamos a primeira entrada).
                          Só aparece em status=completed e quando score existe. */}
                      {(() => {
                        const score = c.campaign_scores?.[0]?.nota_geral;
                        if (c.status !== 'completed' || score == null) return null;
                        // Cores por banda: ≥8 verde, 6–7.99 âmbar, <6 vermelho.
                        // Foreground via Colors.brand pra ficar atrelado ao
                        // ramp da paleta; background/border permanecem rgba()
                        // pra controle fino do alpha (14% bg, 32% border).
                        const band =
                          score >= 8
                            ? { bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.32)', fg: Colors.brand.success }
                            : score >= 6
                              ? { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.32)', fg: Colors.brand.warning }
                              : { bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.32)', fg: Colors.brand.error };
                        return (
                          <View
                            style={[
                              styles.objectivePill,
                              { backgroundColor: band.bg, borderColor: band.border },
                            ]}
                            accessibilityLabel={`Nota ${score.toFixed(1)} de 10`}
                          >
                            <FontAwesome name="star" size={9} color={band.fg} />
                            <Text style={[styles.objectiveLabel, { color: band.fg }]}>
                              {score.toFixed(1)}
                            </Text>
                          </View>
                        );
                      })()}
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {formatDate(c.created_at, t, locale)}
                      </Text>
                    </View>
                  </View>

                  {/* 3-dots context menu — replaces the static angle-right
                      affordance with actionable surface. Menu opens inline,
                      tap outside to close (handled by setting open=false on
                      the scroll listener if needed; for now it stays open
                      until a row is picked or user taps the trigger again). */}
                  <ContextMenuButton
                    onShare={() => shareCampaign(c)}
                    onDelete={deleteSupported ? noopDelete : undefined}
                    t={t}
                    textColor={colors.textSecondary}
                    surfaceColor={colors.cardElevated}
                    borderColor={colors.border}
                  />
                </View>
              </Card>
            </CampaignPressable>
          </Swipeable>
        </Animated.View>
      );
    },
    [colors, deleteSupported, locale, noopDelete, router, shareCampaign, t, toggleFavorite],
  );

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={[styles.header, { paddingTop: headerH + 8 }]}>
          <Skeleton width={180} height={32} borderRadius={8} />
          <Skeleton width={120} height={14} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.searchRow}>
          <Skeleton width="100%" height={44} borderRadius={12} />
        </View>
        <View style={styles.filters}>
          <Skeleton width={110} height={40} borderRadius={20} />
          <Skeleton width={130} height={40} borderRadius={20} />
        </View>
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
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
        <GradientText colors={Colors.brand.gradientPrimary} style={styles.title}>
          {t('history.titleHighlight')}
        </GradientText>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {/* Hero counter migrou de "{n} campanhas" total pra "{n} este mês" —
              número mais útil pra usuária que gera 5-30 por mês saber se está
              produtiva. Total histórico ainda aparece nos filter pills abaixo. */}
          {t('history.thisMonthCount', { n: thisMonthCount })}
        </Text>
      </View>

      {/* Search input — só aparece quando há > 5 campanhas. Pra listas curtas
          é ruído visual. Quando aparece, tap-to-focus + tem clear button. */}
      {campaigns.length > 5 && (
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.surface2, borderColor: colors.border },
            ]}
          >
            <FontAwesome name="search" size={14} color={colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('history.searchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('history.searchClear')}
              >
                <FontAwesome name="times-circle" size={14} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {campaigns.length > 0 && (
        <View style={styles.filters}>
          {(['all', 'favorites'] as const).map((f) => {
            const selected = filter === f;
            return (
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
                accessibilityState={{ selected }}
                style={[
                  styles.filterBtn,
                  {
                    borderColor: selected ? Colors.brand.primary : colors.border,
                    backgroundColor: selected ? Colors.brand.primary : colors.surface2,
                    boxShadow: selected ? `0 4px 10px ${Colors.brand.glowStrong}` : 'none',
                    transitionProperty: ['backgroundColor', 'borderColor', 'boxShadow'],
                    transitionDuration: '180ms',
                    transitionTimingFunction: 'ease-out',
                  } as any,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: selected ? '#fff' : colors.textSecondary,
                      transitionProperty: ['color'],
                      transitionDuration: '180ms',
                    } as any,
                  ]}
                >
                  {f === 'all'
                    ? t('history.filterAll', { n: campaigns.length })
                    : t('history.filterFavorites', { n: favCount })}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      )}

      <FlashList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        // Distinct types so FlashList recycles cards / headers / favorited
        // separately. Without this, scrolling from a header into a card
        // forces a remount.
        getItemType={(item) =>
          item.type === 'header' ? 'header' : item.campaign.is_favorited ? 'fav' : 'normal'
        }
        contentContainerStyle={{ ...styles.list, paddingBottom: padBottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brand.primary}
            // Android-only: cycles the spinner through the brand gradient
            // so even the system pull spinner reads on-brand.
            colors={[Colors.brand.primary, Colors.brand.secondary, Colors.brand.violet]}
            progressBackgroundColor={colors.card}
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
                  onPress={() => refetch()}
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
            ) : searchQuery.trim().length > 0 ? (
              // Distinguish "no search results" from "empty history" — tells
              // the user the data is there, just not matching.
              <>
                <Text style={{ fontSize: 40 }}>🔎</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {t('history.searchEmptyTitle')}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {t('history.searchEmptyDesc')}
                </Text>
                <AnimatedPressable
                  onPress={() => setSearchQuery('')}
                  haptic="tap"
                  hitSlop={16}
                  style={{ minHeight: 48, justifyContent: 'center' }}
                >
                  <Text style={{ color: Colors.brand.primary, fontWeight: '600', marginTop: 8 }}>
                    {t('history.filterAll', { n: campaigns.length })}
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
                {filter !== 'favorites' && (
                  <AnimatedPressable
                    onPress={() => router.push('/(tabs)/gerar')}
                    haptic="tap"
                    scale={0.97}
                    accessibilityRole="button"
                    accessibilityLabel={t('history.emptyCta')}
                    style={styles.emptyCtaButton}
                  >
                    <LinearGradient
                      colors={Colors.brand.gradientPrimary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.emptyCtaInner}
                    >
                      <Text style={styles.emptyCtaText}>{t('history.emptyCta')}</Text>
                    </LinearGradient>
                  </AnimatedPressable>
                )}
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

/**
 * Wrapped in CampaignPeekProvider so the long-press peek overlay can render
 * at the screen root (above the FlashList scroll surface). Without this
 * wrapper CampaignPressable throws — see CampaignLongPressPreview.tsx:85.
 */
export default function HistoricoScreen() {
  return (
    <TabErrorBoundary screen="historico">
      <CampaignPeekProvider>
        <HistoricoScreenInner />
      </CampaignPeekProvider>
    </TabErrorBoundary>
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
  header: { paddingHorizontal: tokens.spacing.xl, paddingTop: tokens.spacing.lg, gap: 2 },
  title: { fontSize: tokens.fontSize.displayLg, fontWeight: tokens.fontWeight.bold },
  // tabular-nums on the running campaign count so the number doesn't reflow
  // mid-fetch when the value updates.
  count: { fontSize: tokens.fontSize.base, fontVariant: ['tabular-nums'] },
  // ─── Search bar ─────────────────────────────────────────────
  searchRow: { paddingHorizontal: tokens.spacing.xl, paddingTop: tokens.spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: tokens.spacing.md,
    minHeight: 44,
    ...rounded(tokens.radii.md),
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_500Medium',
    paddingVertical: 0,
    minHeight: 44,
  },
  // ─── Filters ─────────────────────────────────────────────
  filters: { flexDirection: 'row', paddingHorizontal: tokens.spacing.xl, paddingTop: tokens.spacing.md, gap: tokens.spacing.sm },
  filterBtn: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    ...rounded(tokens.radii.xxl),
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: tokens.fontSize.md, fontWeight: tokens.fontWeight.semibold },
  list: { padding: tokens.spacing.lg },
  // ─── Section headers (FlashList interleaved) ─────────────
  sectionHeader: {
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: tokens.spacing.xs,
  },
  sectionHeaderText: {
    fontSize: tokens.fontSize.xs,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  // ─── Card ─────────────────────────────────────────────────
  card: {
    padding: tokens.spacing.md,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: tokens.radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(217,70,239,0.18)',
    shadowColor: '#0c0410',
    shadowOffset: { width: 0, height: tokens.spacing.xs },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
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
  thumbCount: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: tokens.radii.full,
    borderWidth: 2,
    borderColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbCountText: { color: '#fff', fontSize: 9, fontWeight: tokens.fontWeight.black },
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
  info: { flex: 1, gap: 6, justifyContent: 'center' },
  headline: { fontSize: tokens.fontSize.lg, fontWeight: tokens.fontWeight.bold, lineHeight: tokens.spacing.xl },
  // ─── Status pill (substitui o statusDot 7px) ─────────────
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 10, fontWeight: tokens.fontWeight.bold, letterSpacing: 0.2 },
  // ─── Objective / trial pill ─────────────────────────────
  objectivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
  },
  objectiveEmoji: { fontSize: tokens.fontSize.xs },
  objectiveLabel: { fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.bold, letterSpacing: 0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.medium },
  // ─── Empty / error states ───────────────────────────────
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: tokens.spacing.xxl, gap: tokens.spacing.sm },
  emptyTitle: { fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.semibold, textAlign: 'center' },
  emptyDesc: { fontSize: tokens.fontSize.base, textAlign: 'center', lineHeight: tokens.spacing.xl },
  emptyCtaButton: {
    marginTop: 18,
    borderRadius: tokens.radii.full,
    overflow: 'hidden',
    minHeight: 48,
  },
  emptyCtaInner: {
    paddingHorizontal: tokens.spacing.xxl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: { color: '#fff', fontSize: tokens.fontSize.lg, fontWeight: tokens.fontWeight.bold },
  // ─── Context menu (3-dots) ──────────────────────────────
  menuTrigger: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    top: 36,
    right: 0,
    minWidth: 170,
    ...rounded(tokens.radii.md),
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: tokens.spacing.xs,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: tokens.spacing.sm },
    shadowOpacity: 0.32,
    shadowRadius: tokens.spacing.lg,
    elevation: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingHorizontal: 14,
    paddingVertical: tokens.spacing.md,
    minHeight: 44,
  },
  menuLabel: { fontSize: tokens.fontSize.base, fontWeight: tokens.fontWeight.semibold },
  // ─── Swipe action surfaces ──────────────────────────────
  swipeAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...rounded(tokens.radii.lg),
  },
});
