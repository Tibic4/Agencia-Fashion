import { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable, Button, Card, GradientText, Skeleton } from '@/components/ui';
import { AuraGlow, Confetti } from '@/components/skia';
import { celebrate, haptic } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import { TabErrorBoundary } from '@/components/TabErrorBoundary';
import { useTabContentPaddingBottom } from '@/components/tabBarLayout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGet } from '@/lib/api';
import { qk } from '@/lib/query-client';
import { StoreCreditsResponse, StoreUsageResponse } from '@/lib/schemas';
import { useFocusEffect } from 'expo-router';
import { PLANS } from '@/lib/plans';
import { useT, type TKey } from '@/lib/i18n';
import {
  isUserCancelledError,
  loadSubscriptionOfferings,
  purchaseSubscription,
  restorePurchases,
  type SubscriptionSku,
} from '@/lib/billing';
import type { ProductSubscription, ProductSubscriptionAndroid } from 'react-native-iap';

const PLAN_BADGES: Record<string, string> = { essencial: '💡', pro: '🚀', business: '🏢' };

// Server returns plan_name as one of: gratis | free | essencial | pro | business.
// We map to a localized display name via t('planNames.<key>'). The "Avulso" /
// "Pay-as-you-go" tier covers both gratis and free for legacy reasons.
type PlanKey = 'avulso' | 'essencial' | 'pro' | 'business';
function planKeyFromServer(name: string | undefined | null): PlanKey {
  if (!name || name === 'gratis' || name === 'free') return 'avulso';
  if (name === 'essencial' || name === 'pro' || name === 'business') return name;
  return 'avulso';
}

const skuByPlan: Record<keyof typeof PLANS, SubscriptionSku> = {
  essencial: 'essencial_mensal',
  pro: 'pro_mensal',
  business: 'business_mensal',
};

function PlanoScreenInner() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useT();
  const headerH = useHeaderHeight();
  const padBottom = useTabContentPaddingBottom();
  const queryClient = useQueryClient();

  // Three independent reads in parallel: server-side usage + credits, and the
  // local Play Billing offerings (which doesn't hit our API but still benefits
  // from query state — caching, refetch on focus, isFetching for refresh UX).
  // useQueries runs them concurrently and exposes a flat array to destructure.
  const [usageQ, creditsQ, offeringsQ] = useQueries({
    queries: [
      {
        queryKey: qk.store.usage(),
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          apiGet('/store/usage', { signal, schema: StoreUsageResponse }),
        staleTime: 60_000,
      },
      {
        queryKey: qk.store.credits(),
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          apiGet('/store/credits', { signal, schema: StoreCreditsResponse }),
        staleTime: 60_000,
      },
      {
        queryKey: ['billing', 'offerings'] as const,
        // loadSubscriptionOfferings hits Google Play, not our API, so signal
        // wouldn't help — we just let the platform call run. 5 min staleTime
        // because Play caches its own catalog and our prices rarely change.
        queryFn: () => loadSubscriptionOfferings(),
        staleTime: 5 * 60_000,
      },
    ],
  });

  const usage = usageQ.data?.data;
  const credits = creditsQ.data?.data;
  const offerings: Record<string, ProductSubscriptionAndroid> = (() => {
    const list = (offeringsQ.data ?? []) as ProductSubscription[];
    const android = list.filter(
      (o): o is ProductSubscriptionAndroid =>
        'subscriptionOfferDetailsAndroid' in o && (o as { platform?: string }).platform === 'android',
    );
    return Object.fromEntries(android.map(o => [o.id, o]));
  })();

  const loading = usageQ.isPending || creditsQ.isPending || offeringsQ.isPending;
  const refreshing =
    (usageQ.isFetching || creditsQ.isFetching || offeringsQ.isFetching) && !loading;

  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  // Triggers a single Skia confetti burst on successful purchase. Set true
  // when the mutation lands; auto-resets after Confetti calls onComplete.
  const [showConfetti, setShowConfetti] = useState(false);

  const currentPlanKey = planKeyFromServer(usage?.plan_name);
  const currentPlan = t(`planNames.${currentPlanKey}`);
  const isFreePlan = currentPlanKey === 'avulso';
  const campaignsUsed = usage?.campaigns_generated ?? 0;
  const campaignsLimit = usage?.campaigns_limit ?? 0;
  const usagePercent = campaignsLimit > 0 ? (campaignsUsed / campaignsLimit) * 100 : 0;

  const refetchAll = useCallback(() => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.store.usage() }),
      queryClient.invalidateQueries({ queryKey: qk.store.credits() }),
      queryClient.invalidateQueries({ queryKey: ['billing', 'offerings'] }),
    ]);
  }, [queryClient]);

  // Refetch on focus — user may have purchased on another device, or cancelled
  // their subscription via Play Store outside the app. Skipped during a live
  // purchase to avoid swapping offerings under the user mid-flow.
  useFocusEffect(
    useCallback(() => {
      if (purchasing) return;
      refetchAll();
    }, [purchasing, refetchAll]),
  );

  const onRefresh = useCallback(() => {
    if (purchasing) return;
    return refetchAll();
  }, [purchasing, refetchAll]);

  // Mutation = subscribe. Optimistic over Play Billing's own dialog isn't
  // useful (the OS UI is the source of truth), so we just refetch on success.
  const subscribeMut = useMutation({
    mutationFn: (planId: keyof typeof PLANS) => purchaseSubscription(skuByPlan[planId]),
    onMutate: (planId) => {
      haptic.confirm();
      setPurchasing(planId);
    },
    onSuccess: async () => {
      // Bust caches before refetch — server already wrote the new plan, but
      // our 60s staleTime would otherwise serve the old usage row.
      await refetchAll();
      // Trigger the Skia confetti burst BEFORE the alert so the user sees
      // the celebration through the alert backdrop (Android dialogs are
      // dimmed but transparent over the screen).
      setShowConfetti(true);
      // Cascading haptics — semantic helper centralises the success+tap
      // pattern used in 2-3 places across the app.
      celebrate();
      Alert.alert(
        t('plan.welcomeAfterPurchaseTitle'),
        t('plan.welcomeAfterPurchaseMessage'),
      );
    },
    onError: (e) => {
      if (isUserCancelledError(e)) return;
      // Toast handles haptic.error.
      toast.error(t('plan.purchaseError'));
    },
    onSettled: () => {
      setPurchasing(null);
    },
  });

  const handleSubscribe = (planId: keyof typeof PLANS) => {
    // Guard: prevent double-tap on any Subscribe button while another is
    // processing (Google Play already queues, but avoids 2 native dialogs).
    if (purchasing) return;
    subscribeMut.mutate(planId);
  };

  const restoreMut = useMutation({
    mutationFn: () => restorePurchases(),
    onMutate: () => {
      haptic.tap();
      setRestoring(true);
    },
    onSuccess: async (res) => {
      if (res.restored > 0) {
        await refetchAll();
        // Toast handles haptic.success.
        toast.success(t('plan.restoredMessage'));
      } else {
        toast.info(t('plan.nothingToRestoreMessage'));
      }
    },
    onError: () => {
      toast.error(t('plan.restoreError'));
    },
    onSettled: () => {
      setRestoring(false);
    },
  });

  const handleRestore = () => restoreMut.mutate();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={[styles.content, { paddingTop: headerH + 16, paddingBottom: padBottom }]}>
          <Skeleton width={180} height={28} borderRadius={8} />
          <Skeleton width={260} height={14} borderRadius={6} style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={140} borderRadius={16} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={260} borderRadius={16} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={260} borderRadius={16} style={{ marginTop: 12 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <AppHeader />
    {showConfetti && (
      <Confetti
        count={80}
        durationMs={2400}
        onComplete={() => setShowConfetti(false)}
      />
    )}
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: headerH + 16, paddingBottom: padBottom }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.brand.primary}
          colors={[Colors.brand.primary]}
        />
      }
    >
      <View style={styles.content}>
        {/* Hero: "Meu [Plano]" — second word renders as a fucsia gradient mask. */}
        <Animated.View entering={FadeInDown.delay(50)} style={styles.heroRow}>
          <Text style={[styles.title, { color: colors.text }]}>Meu </Text>
          <GradientText colors={Colors.brand.gradientPrimary} style={styles.title}>
            {t('plan.titleHighlight')}
          </GradientText>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100)} style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('plan.subtitle')}
        </Animated.Text>

        {isFreePlan && (
          <Animated.View
            entering={FadeInDown.delay(150)}
            style={[
              styles.trialCta,
              {
                backgroundColor: scheme === 'dark'
                  ? 'rgba(217, 70, 239, 0.10)'
                  : 'rgba(217, 70, 239, 0.06)',
                borderColor: Colors.brand.primary + '40',
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.trialTitle, { color: Colors.brand.primary }]}>
                {t('plan.upgradePromptTitle')}
              </Text>
              <Text style={[styles.trialDesc, { color: colors.textSecondary }]}>
                {t('plan.upgradePromptDesc')}
              </Text>
            </View>
            <FontAwesome
              name="arrow-right"
              size={14}
              color={Colors.brand.primary}
            />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200)}>
          <Card style={styles.usageCard}>
            <View style={styles.planHeader}>
              <Text style={{ fontSize: 28 }}>
                {isFreePlan ? '💳' : PLAN_BADGES[usage?.plan_name || ''] || '⭐'}
              </Text>
              <View style={styles.planHeaderText}>
                <Text
                  style={[styles.planName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {currentPlan}
                </Text>
                {isFreePlan && (
                  <Text style={[styles.creditsText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {t('plan.freePlanCampaignsLabel')}
                  </Text>
                )}
                {credits && (credits.campaigns > 0 || credits.models > 0) && (
                  <Text
                    style={[styles.creditsText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {credits.campaigns > 0 ? t('plan.extraCampaigns', { n: credits.campaigns }) : ''}
                    {credits.campaigns > 0 && credits.models > 0 ? ' · ' : ''}
                    {credits.models > 0 ? t('plan.extraModels', { n: credits.models }) : ''}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.bars}>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`${t('plan.campaignsBar')}: ${campaignsUsed} / ${campaignsLimit > 0 ? campaignsLimit : '—'}`}
                accessibilityValue={{
                  min: 0,
                  max: campaignsLimit > 0 ? campaignsLimit : 100,
                  now: campaignsUsed,
                }}
              >
                <View style={styles.barLabel}>
                  <Text style={[styles.barText, { color: colors.textSecondary }]}>{t('plan.campaignsBar')}</Text>
                  <Text style={[styles.barValue, { color: colors.text }]}>
                    {campaignsLimit > 0 ? `${campaignsUsed}/${campaignsLimit}` : '—'}
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                  {/* When usage > 80% the fill pulses subtly via Reanimated 4 CSS
                      animation — quiet visual urgency cue, not alarm. Reads as
                      "you're running low, plan ahead". */}
                  <Animated.View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(usagePercent, 100)}%`,
                        backgroundColor:
                          usagePercent > 80 ? Colors.brand.warning : Colors.brand.primary,
                        ...(usagePercent > 80
                          ? ({
                              animationName: {
                                '0%': { opacity: 1 },
                                '50%': { opacity: 0.7 },
                                '100%': { opacity: 1 },
                              },
                              animationDuration: '1800ms',
                              animationIterationCount: 'infinite',
                              animationTimingFunction: 'ease-in-out',
                            } as any)
                          : {}),
                      },
                    ]}
                  />
                </View>
              </View>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`${t('plan.modelsBar')}: ${usage?.models_used ?? 0} / ${usage?.models_limit ?? 0}`}
                accessibilityValue={{
                  min: 0,
                  max: usage?.models_limit ?? 100,
                  now: usage?.models_used ?? 0,
                }}
              >
                <View style={styles.barLabel}>
                  <Text style={[styles.barText, { color: colors.textSecondary }]}>{t('plan.modelsBar')}</Text>
                  <Text style={[styles.barValue, { color: colors.text }]}>
                    {(usage?.models_limit ?? 0) > 0
                      ? `${usage?.models_used ?? 0}/${usage?.models_limit ?? 0}`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${
                          usage?.models_limit
                            ? ((usage?.models_used ?? 0) / usage.models_limit) * 100
                            : 0
                        }%`,
                        backgroundColor: Colors.brand.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {isFreePlan ? t('plan.upgradeSection') : t('plan.plansSection')}
        </Text>

        {(() => {
          // Rank do plano atual — usa pra dimmar planos abaixo (downgrade não
          // faz sentido pro usuário). Mesma lógica do site /plano.
          const planEntries = Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][];
          const currentRank = planEntries.findIndex(([id]) => id === currentPlanKey);
          return planEntries.map(([id, plan], index) => {
            const isCurrentPlan = id === currentPlanKey;
            // Plano de rank menor que o atual = "downgrade" → dim 0.5 e disable.
            // Pro user em "Avulso" (rank -1), nada é lower (todos são upgrade).
            const isLowerPlan = currentRank >= 0 && index < currentRank && !isCurrentPlan;
            const sku = skuByPlan[id];
            const offering = offerings[sku];
            const priceLabel =
              offering?.subscriptionOfferDetailsAndroid?.[0]?.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice ??
              `R$ ${plan.price.toFixed(2)}`;
            const isPurchasing = purchasing === id;

            const isHighlightedPro = id === 'pro' && !isCurrentPlan && !isLowerPlan;
            return (
              <Animated.View key={id} entering={FadeInDown.delay(300 + index * 80)}>
                {/* Aura glow behind the recommended plan card. Sits in absolute
                    space so it bleeds beyond the card border and reads as
                    ambient highlight. Only the "pro" tier gets it. */}
                {isHighlightedPro && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -20,
                      left: -20,
                      right: -20,
                      bottom: -20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AuraGlow size={360} color={Colors.brand.secondary} opacityMin={0.2} opacityMax={0.45} />
                  </View>
                )}
                <Card
                  selected={isCurrentPlan}
                  style={[
                    styles.planCard,
                    isHighlightedPro && { borderColor: Colors.brand.primary },
                    isLowerPlan && styles.planCardDim,
                  ]}
                >
                  {isCurrentPlan && (
                    <View style={[styles.currentBadge, { backgroundColor: Colors.brand.primary }]}>
                      <Text style={styles.currentBadgeText}>{t('plan.currentPlan')}</Text>
                    </View>
                  )}
                  {isHighlightedPro && (
                    <View style={[styles.currentBadge, { backgroundColor: Colors.brand.secondary }]}>
                      <Text style={styles.currentBadgeText}>{t('plan.recommended')}</Text>
                    </View>
                  )}

                  <Text style={{ fontSize: 24 }}>{PLAN_BADGES[id] || '⭐'}</Text>
                  <Text style={[styles.planCardName, { color: colors.text }]}>{plan.name}</Text>
                  <Text style={[styles.planCardPrice, { color: Colors.brand.primary }]}>
                    {priceLabel}
                    <Text style={styles.planCardPeriod}>{t('plan.monthlySuffix')}</Text>
                  </Text>

                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <FontAwesome name="check" size={14} color={Colors.brand.success} />
                      <Text style={[styles.featureText, { color: colors.text }]}>
                        {t(`features.${f.key}` as TKey, f.vars)}
                      </Text>
                    </View>
                  ))}

                  <Button
                    title={
                      isCurrentPlan
                        ? t('plan.currentPlan')
                        : isLowerPlan
                        ? t('plan.lowerPlan')
                        : isPurchasing
                        ? t('plan.processing')
                        : t('plan.subscribeButton', { plan: plan.name })
                    }
                    onPress={() => handleSubscribe(id)}
                    /* Trava todos os botões enquanto purchasing!=null pra evitar
                       dois dialogs do Play Billing abrindo em sequência. */
                    disabled={isCurrentPlan || isLowerPlan || purchasing !== null}
                    loading={isPurchasing}
                    variant={isCurrentPlan ? 'secondary' : 'primary'}
                    style={{ marginTop: 12 }}
                  />
                </Card>
              </Animated.View>
            );
          });
        })()}

        <AnimatedPressable
          onPress={handleRestore}
          disabled={restoring}
          haptic={false}
          scale={0.97}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.restorePurchases')}
          style={styles.restoreButton}
        >
          <Text style={[styles.restoreText, { color: Colors.brand.primary }]}>
            {restoring ? t('plan.restoring') : t('plan.restorePurchases')}
          </Text>
        </AnimatedPressable>

        <View style={styles.securityBadge}>
          <FontAwesome name="lock" size={14} color={Colors.brand.success} />
          <Text style={[styles.securityText, { color: colors.textSecondary }]}>
            {t('plan.securityBadge')}
          </Text>
        </View>
      </View>
    </ScrollView>
    </View>
  );
}

export default function PlanoScreen() {
  return (
    <TabErrorBoundary screen="plano">
      <PlanoScreenInner />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: '700' },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  // Why marginTop:-2 instead of -8: -8 was overlapping the title's descenders.
  // The marketing site uses ~4px between hero and subtitle.
  subtitle: { fontSize: 14, marginTop: -2, marginBottom: 4 },
  usageCard: { gap: 16 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planHeaderText: { flex: 1, minWidth: 0 },
  planName: { fontSize: 20, fontWeight: '700' },
  creditsText: { fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  bars: { gap: 12 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barText: { fontSize: 12 },
  // tabular-nums keeps "12/30" → "13/30" from jiggling when the digit changes.
  barValue: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  barTrack: { height: 10, borderRadius: 5, borderCurve: 'continuous', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  trialCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    marginTop: 4,
  },
  trialTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: -0.1 },
  trialDesc: {
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  planCard: { gap: 8 },
  /* Planos abaixo do atual ficam dim 50% — paridade com /plano do site.
     Não faz sentido oferecer downgrade pelo botão, então também desabilitamos
     o tap (logic acima) e mudamos o título do botão. */
  planCardDim: { opacity: 0.5 },
  currentBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  currentBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  planCardName: { fontSize: 20, fontWeight: '700' },
  planCardPrice: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  planCardPeriod: { fontSize: 13, fontWeight: '400' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14 },
  restoreButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: 'center',
  },
  restoreText: { fontSize: 14, fontWeight: '700' },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  securityText: { fontSize: 12, fontWeight: '500' },
});
