import { useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable, Button, Card, GradientText, Skeleton } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { AppHeader, useHeaderHeight } from '@/components/AppHeader';
import { useTabContentPaddingBottom } from '@/components/tabBarLayout';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { apiGetCached } from '@/lib/api';
import { PLANS } from '@/lib/plans';
import { useT, type TKey } from '@/lib/i18n';
import {
  isUserCancelledError,
  loadSubscriptionOfferings,
  purchaseSubscription,
  restorePurchases,
  type SubscriptionSku,
} from '@/lib/billing';
import type { StoreUsage, StoreCredits } from '@/types';
import type { ProductSubscriptionAndroid } from 'react-native-iap';

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

export default function PlanoScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useT();
  const headerH = useHeaderHeight();
  const padBottom = useTabContentPaddingBottom();

  const [usage, setUsage] = useState<StoreUsage | null>(null);
  const [credits, setCredits] = useState<StoreCredits | null>(null);
  const [offerings, setOfferings] = useState<Record<string, ProductSubscriptionAndroid>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const currentPlanKey = planKeyFromServer(usage?.plan_name);
  const currentPlan = t(`planNames.${currentPlanKey}`);
  const isFreePlan = currentPlanKey === 'avulso';
  const campaignsUsed = usage?.campaigns_generated ?? 0;
  const campaignsLimit = usage?.campaigns_limit ?? 0;
  const usagePercent = campaignsLimit > 0 ? (campaignsUsed / campaignsLimit) * 100 : 0;

  const loadData = async () => {
    const [usageRes, creditsRes, offeringsRes] = await Promise.all([
      apiGetCached<{ data: StoreUsage }>('/store/usage', 60_000).catch(() => null),
      apiGetCached<{ data: StoreCredits }>('/store/credits', 60_000).catch(() => null),
      loadSubscriptionOfferings().catch(() => []),
    ]);
    if (usageRes?.data) setUsage(usageRes.data);
    if (creditsRes?.data) setCredits(creditsRes.data);
    const androidOfferings = (offeringsRes as ProductSubscriptionAndroid[]).filter(
      o => 'subscriptionOfferDetailsAndroid' in o && o.platform === 'android',
    );
    setOfferings(
      Object.fromEntries(androidOfferings.map(o => [o.id, o])),
    );
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSubscribe = async (planId: keyof typeof PLANS) => {
    haptic.confirm();
    const sku = skuByPlan[planId];
    setPurchasing(planId);
    try {
      await purchaseSubscription(sku);
      await loadData();
      // Cascading haptics for celebration: success ping + light follow-up
      // creates a "double-tap" sensation that feels like a tiny milestone.
      haptic.success();
      setTimeout(() => haptic.tap(), 180);
      Alert.alert(
        '🎉 Bem-vindo ao plano!',
        'Sua assinatura está ativa. Aproveite todas as funções.',
      );
    } catch (e) {
      if (isUserCancelledError(e)) return;
      haptic.error();
      Alert.alert(t('common.error'), t('plan.purchaseError'));
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    haptic.tap();
    setRestoring(true);
    try {
      const res = await restorePurchases();
      if (res.restored > 0) {
        await loadData();
        haptic.success();
        Alert.alert(t('plan.restoredTitle'), t('plan.restoredMessage'));
      } else {
        Alert.alert(t('plan.nothingToRestoreTitle'), t('plan.nothingToRestoreMessage'));
      }
    } catch {
      haptic.error();
      Alert.alert(t('common.error'), t('plan.restoreError'));
    } finally {
      setRestoring(false);
    }
  };

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
          <Animated.View entering={FadeInDown.delay(150)}>
            <LinearGradient
              colors={Colors.brand.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.trialCta}
            >
              <Text style={{ fontSize: 22 }}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.trialTitle}>{t('plan.upgradePromptTitle')}</Text>
                <Text style={styles.trialDesc}>
                  {t('plan.upgradePromptDesc')}
                </Text>
              </View>
              <View style={styles.trialChevron}>
                <FontAwesome name="chevron-right" size={12} color="#fff" />
              </View>
            </LinearGradient>
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
                  {`${t('plan.title').split(' ')[0]} ${currentPlan}`}
                </Text>
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
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(usagePercent, 100)}%`,
                        backgroundColor:
                          usagePercent > 80 ? Colors.brand.warning : Colors.brand.primary,
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

            return (
              <Animated.View key={id} entering={FadeInDown.delay(300 + index * 80)}>
                <Card
                  selected={isCurrentPlan}
                  style={[
                    styles.planCard,
                    id === 'pro' && !isCurrentPlan && !isLowerPlan && { borderColor: Colors.brand.primary },
                    isLowerPlan && styles.planCardDim,
                  ]}
                >
                  {isCurrentPlan && (
                    <View style={[styles.currentBadge, { backgroundColor: Colors.brand.primary }]}>
                      <Text style={styles.currentBadgeText}>{t('plan.currentPlan')}</Text>
                    </View>
                  )}
                  {id === 'pro' && !isCurrentPlan && !isLowerPlan && (
                    <View style={[styles.currentBadge, { backgroundColor: Colors.brand.secondary }]}>
                      <Text style={styles.currentBadgeText}>{t('plan.recommended')}</Text>
                    </View>
                  )}

                  <Text style={{ fontSize: 24 }}>{PLAN_BADGES[id] || '⭐'}</Text>
                  <Text style={[styles.planCardName, { color: colors.text }]}>{plan.name}</Text>
                  <Text style={[styles.planCardPrice, { color: Colors.brand.primary }]}>
                    {priceLabel}
                    <Text style={styles.planCardPeriod}>/mês</Text>
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
                    disabled={isCurrentPlan || isLowerPlan || isPurchasing}
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
  creditsText: { fontSize: 12, marginTop: 2 },
  bars: { gap: 12 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barText: { fontSize: 12 },
  barValue: { fontSize: 12, fontWeight: '700' },
  barTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  trialCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginTop: 4,
    shadowColor: '#D946EF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  trialTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  trialDesc: { fontSize: 12.5, marginTop: 2, color: 'rgba(255,255,255,0.92)' },
  trialChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
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
  planCardPrice: { fontSize: 24, fontWeight: '800' },
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
