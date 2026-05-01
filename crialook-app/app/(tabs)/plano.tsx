import { useCallback, useRef, useState } from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable, Button, Card, GradientText, Skeleton } from '@/components/ui';
import { AuraGlow, Confetti } from '@/components/skia';
import { celebrate, haptic } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { maybeRequestReview, recordSuccess } from '@/lib/reviewGate';
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
import { tokens, rounded } from '@/lib/theme/tokens';
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
  // a11y — gate da pulse > 80% e da AuraGlow do plano ativo.
  const reduceMotion = useReducedMotion();
  // Scroll-to-plans quando o trialCta é tappado. Em vez de measureLayout
  // (precisa de ref + nodeHandle, rico em race condition), capturamos o Y
  // do "Section title" via onLayout — barato e síncrono.
  const scrollRef = useRef<ScrollView>(null);
  const planSectionY = useRef(0);

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
      // Trigger the Skia confetti burst — agora é o feedback principal de
      // celebração (em vez do Alert nativo que quebrava continuidade visual).
      setShowConfetti(true);
      // Cascading haptics — semantic helper centralises the success+tap
      // pattern used in 2-3 places across the app.
      celebrate();
      // Toast.success durando 5s pra dar tempo do confetti rodar e o user
      // ler a mensagem. Combina título + mensagem na mesma linha; toast já
      // tem peso visual brand-aware (cor, haptic, tipografia) que substitui
      // bem o Alert.alert.
      toast.success(
        `${t('plan.welcomeAfterPurchaseTitle')} ${t('plan.welcomeAfterPurchaseMessage')}`,
        { durationMs: 5000 },
      );
      // Pico de NPS — purchase é o melhor momento pra in-app review depois
      // do user cumular alguns sucessos. recordSuccess() incrementa o
      // contador; maybeRequestReview() abre o nativo se passou os limites
      // (3+ sucessos, >30 dias quietos, etc).
      void recordSuccess().then(() => maybeRequestReview());
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
        <View style={[styles.content, { paddingTop: headerH + tokens.spacing.lg, paddingBottom: padBottom }]}>
          {/* Hero title + subtitle */}
          <Skeleton width={180} height={28} borderRadius={8} />
          <Skeleton width={260} height={14} borderRadius={6} style={{ marginTop: tokens.spacing.sm }} />
          {/* Usage / current plan card — header + bar + restore button */}
          <Skeleton width="100%" height={140} borderRadius={16} style={{ marginTop: tokens.spacing.lg }} />
          {/* 3 plan cards (essencial / pro / business) — antes só 2 viam,
              quando o real renderiza 3 e o eye perde o lugar quando carrega. */}
          <Skeleton width="100%" height={220} borderRadius={16} style={{ marginTop: tokens.spacing.lg }} />
          <Skeleton width="100%" height={220} borderRadius={16} style={{ marginTop: tokens.spacing.md }} />
          <Skeleton width="100%" height={220} borderRadius={16} style={{ marginTop: tokens.spacing.md }} />
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
      ref={scrollRef}
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
          <Animated.View entering={FadeInDown.delay(150)}>
            {/* Tappable agora — antes era só uma faixa decorativa com seta
                que sugeria interação sem entregar. Tap dispara haptic e
                rola pra primeira planCard (o que o usuário já queria fazer
                quando viu a seta). */}
            <AnimatedPressable
              haptic="tap"
              scale={0.98}
              accessibilityRole="button"
              accessibilityLabel={t('plan.upgradePromptTitle')}
              onPress={() => {
                const y = Math.max(0, planSectionY.current - headerH - 8);
                scrollRef.current?.scrollTo({ y, animated: true });
              }}
              style={[
                styles.trialCta,
                {
                  backgroundColor: colorScheme === 'dark'
                    ? 'rgba(217, 70, 239, 0.10)'
                    : 'rgba(217, 70, 239, 0.06)',
                  borderColor: Colors.brand.primary + '40',
                },
              ]}
            >
              {/* Hero chip com gradient brand — ancora visualmente o CTA, dá
                  a ele densidade de "card" em vez de só faixa de texto. */}
              <View style={styles.trialChip}>
                <LinearGradient
                  colors={Colors.brand.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <FontAwesome name="bolt" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trialTitle, { color: Colors.brand.primary }]}>
                  {t('plan.upgradePromptTitle')}
                </Text>
                <Text style={[styles.trialDesc, { color: colors.textSecondary }]}>
                  {t('plan.upgradePromptDesc')}
                </Text>
              </View>
              <FontAwesome
                name="chevron-right"
                size={14}
                color={Colors.brand.primary}
              />
            </AnimatedPressable>
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
                        ...(usagePercent > 80 && !reduceMotion
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

        <Text
          onLayout={(e) => { planSectionY.current = e.nativeEvent.layout.y; }}
          style={[styles.sectionTitle, { color: colors.text }]}
        >
          {isFreePlan ? t('plan.upgradeSection') : t('plan.plansSection')}
        </Text>

        {(() => {
          // Padrão "big company" (Spotify/Notion/Linear): planos abaixo do
          // atual são ESCONDIDOS, não só dimmed — usuário pago não tem o
          // que fazer com downgrade UI-side (cancelamento é via Play Store).
          // Recommendation badge é dinâmica:
          //  - free user (avulso) → Pro (mid-tier, melhor conversão)
          //  - paid user → próximo tier acima (currentRank+1)
          //  - business user (top) → ninguém marcado, e mostramos um banner
          //    "você está no plano mais completo" no fim.
          const planEntries = Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][];
          const currentRank = planEntries.findIndex(([id]) => id === currentPlanKey);
          const isPaidUser = currentRank >= 0;
          const recommendedIndex = isPaidUser
            ? currentRank + 1
            : planEntries.findIndex(([id]) => id === 'pro');

          return planEntries.map(([id, plan], index) => {
            // Esconde planos abaixo do atual (downgrade). Free user
            // (currentRank=-1) vê todos.
            if (isPaidUser && index < currentRank) return null;

            const isCurrentPlan = id === currentPlanKey;
            const sku = skuByPlan[id];
            const offering = offerings[sku];
            const priceLabel =
              offering?.subscriptionOfferDetailsAndroid?.[0]?.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice ??
              `R$ ${plan.price.toFixed(2)}`;
            const isPurchasing = purchasing === id;

            const isRecommended = !isCurrentPlan && index === recommendedIndex;
            // Mantido pra compat de styling — não há mais lower visível,
            // mas serve de fallback se a lógica de hide acima falhar.
            const isLowerPlan = false;
            return (
              <Animated.View key={id} entering={FadeInDown.delay(300 + index * 80)}>
                {/* Aura glow behind the recommended plan card. Sits in absolute
                    space so it bleeds beyond the card border and reads as
                    ambient highlight. Only the "pro" tier gets it. */}
                {isRecommended && (
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
                    isRecommended && { borderColor: Colors.brand.primary },
                    isLowerPlan && styles.planCardDim,
                  ]}
                >
                  {isCurrentPlan && (
                    <View style={[styles.currentBadge, { backgroundColor: Colors.brand.primary }]}>
                      <Text style={styles.currentBadgeText}>{t('plan.currentPlan')}</Text>
                    </View>
                  )}
                  {isRecommended && (
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

        {/* Banner "você está no topo" pro user em Business — sem upgrade
            disponível, então a tela ficaria com 1 card só. Banner reforça
            que ele tem o melhor que oferecemos. */}
        {currentPlanKey === 'business' && (
          <Animated.View
            entering={FadeInDown.delay(420)}
            style={[
              styles.topTierBanner,
              { backgroundColor: Colors.brand.success + '14', borderColor: Colors.brand.success + '40' },
            ]}
          >
            <Text style={styles.topTierEmoji}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.topTierTitle, { color: Colors.brand.success }]}>
                {t('plan.topTierTitle')}
              </Text>
              <Text style={[styles.topTierDesc, { color: colors.textSecondary }]}>
                {t('plan.topTierDesc')}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Gerenciar assinatura via Play Store — só pra usuário pago. App
            não cancela diretamente (Google Play é o source of truth do
            billing recorrente); deep-link abre a tela de subscription do
            Play onde o cancelamento mora. */}
        {!isFreePlan && (
          <AnimatedPressable
            onPress={() =>
              Linking.openURL(
                `https://play.google.com/store/account/subscriptions?package=com.crialook.app`,
              ).catch(() => toast.error(t('common.error')))
            }
            haptic="tap"
            scale={0.97}
            accessibilityRole="button"
            accessibilityLabel={t('plan.manageSubscription')}
            style={styles.restoreButton}
          >
            <Text style={[styles.restoreText, { color: Colors.brand.primary }]}>
              {t('plan.manageSubscription')}
            </Text>
          </AnimatedPressable>
        )}

        <AnimatedPressable
          onPress={handleRestore}
          disabled={restoring}
          haptic={false}
          scale={0.97}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.restorePurchases')}
          style={styles.restoreButton}
        >
          {restoring ? (
            // Skeleton inline com a mesma altura/largura do label — antes era
            // só swap de texto, parecia que travou. Agora o user vê movimento
            // (shimmer wave) confirmando que algo está rodando.
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
              <Skeleton width={18} height={18} borderRadius={9} />
              <Skeleton width={140} height={14} borderRadius={6} />
            </View>
          ) : (
            <Text style={[styles.restoreText, { color: Colors.brand.primary }]}>
              {t('plan.restorePurchases')}
            </Text>
          )}
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
  content: { padding: tokens.spacing.xl, gap: tokens.radii.lg },
  title: { fontSize: tokens.fontSize.displayLg, fontWeight: tokens.fontWeight.bold },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  // Why marginTop:-2 instead of -8: -8 was overlapping the title's descenders.
  // The marketing site uses ~4px between hero and subtitle.
  subtitle: { fontSize: tokens.fontSize.base, marginTop: -2, marginBottom: tokens.spacing.xs },
  usageCard: { gap: tokens.spacing.lg },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  planHeaderText: { flex: 1, minWidth: 0 },
  planName: { fontSize: tokens.fontSize.xxxl, fontWeight: tokens.fontWeight.bold },
  creditsText: { fontSize: tokens.fontSize.sm, marginTop: 2, fontVariant: ['tabular-nums'] },
  bars: { gap: tokens.spacing.md },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  // tabular-nums on the bar label too — pairs with barValue so labels like
  // "Campanhas" and the numeric value share the same baseline rhythm.
  barText: { fontSize: tokens.fontSize.sm, fontVariant: ['tabular-nums'] },
  // tabular-nums keeps "12/30" → "13/30" from jiggling when the digit changes.
  barValue: { fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.bold, fontVariant: ['tabular-nums'] },
  barTrack: { height: 10, borderRadius: 5, borderCurve: 'continuous', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  trialCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingVertical: 14,
    paddingHorizontal: tokens.spacing.lg,
    ...rounded(tokens.radii.xl),
    borderWidth: 1,
    marginTop: tokens.spacing.xs,
  },
  trialChip: {
    width: 36,
    height: 36,
    ...rounded(tokens.radii.md),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialTitle: { fontSize: tokens.fontSize.base, fontFamily: 'Inter_700Bold', letterSpacing: -0.1 },
  trialDesc: {
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    lineHeight: tokens.spacing.lg,
  },
  sectionTitle: { fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.bold, marginTop: tokens.spacing.sm },
  planCard: { gap: tokens.spacing.sm },
  /* Planos abaixo do atual ficam dim 50% — paridade com /plano do site.
     Não faz sentido oferecer downgrade pelo botão, então também desabilitamos
     o tap (logic acima) e mudamos o título do botão. */
  planCardDim: { opacity: 0.5 },
  currentBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: tokens.spacing.xs, borderRadius: tokens.radii.md },
  currentBadgeText: { color: '#fff', fontSize: tokens.fontSize.xs, fontWeight: tokens.fontWeight.bold },
  planCardName: { fontSize: tokens.fontSize.xxxl, fontWeight: tokens.fontWeight.bold },
  planCardPrice: { fontSize: tokens.fontSize.display, fontWeight: tokens.fontWeight.black, fontVariant: ['tabular-nums'] },
  planCardPeriod: { fontSize: tokens.fontSize.md, fontWeight: tokens.fontWeight.regular },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  featureText: { fontSize: tokens.fontSize.base },
  restoreButton: {
    alignSelf: 'center',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    minHeight: 48,
    justifyContent: 'center',
  },
  restoreText: { fontSize: tokens.fontSize.base, fontWeight: tokens.fontWeight.bold },
  topTierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: 14,
    ...rounded(tokens.radii.lg),
    borderWidth: 1,
    marginTop: tokens.spacing.sm,
  },
  topTierEmoji: { fontSize: tokens.fontSize.displayLg },
  topTierTitle: { fontSize: tokens.fontSize.base, fontFamily: 'Inter_700Bold', letterSpacing: -0.1 },
  topTierDesc: {
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
    lineHeight: tokens.spacing.lg,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: tokens.spacing.sm,
  },
  securityText: { fontSize: tokens.fontSize.sm, fontWeight: tokens.fontWeight.medium },
});
