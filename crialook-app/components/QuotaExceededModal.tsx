import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { Button } from '@/components/ui';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';

interface Props {
  visible: boolean;
  used: number;
  limit: number;
  credits: number;
  currentPlan?: string;
  onClose: () => void;
}

const CREDIT_PACKAGES = [
  { qty: 3, price: '24,90', perUnit: '8,30' },
  { qty: 10, price: '69,90', perUnit: '6,99', popular: true },
  { qty: 20, price: '119,90', perUnit: '6,00', best: true },
];

// Plan name uses i18n key (`planNames.<id>`); price + campaign count are
// presentation tokens that don't translate.
const PLANS = [
  { id: 'essencial' as const, price: 89, campaigns: 15 },
  { id: 'pro' as const, price: 179, campaigns: 40, recommended: true },
  { id: 'business' as const, price: 379, campaigns: 100 },
];

function normalizePlanKey(raw?: string): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === 'free' || key === 'gratis' || key === 'avulso') return null;
  return key;
}

export function QuotaExceededModal({ visible, used, limit, credits, currentPlan, onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const normalizedPlan = normalizePlanKey(currentPlan);
  const isFreeTier = normalizedPlan === null;
  // Free tier (limit:0) means "no plan", not "100% used" — different visual + copy
  const [tab, setTab] = useState<'credits' | 'upgrade'>(isFreeTier ? 'upgrade' : 'credits');
  const router = useRouter();
  const { t } = useT();
  const scheme = useColorScheme();
  const themeColors = Colors[scheme];

  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const handleUpgrade = () => {
    onClose();
    router.push('/(tabs)/plano');
  };

  const handleBuyCredits = (_qty: number) => {
    onClose();
    router.push('/(tabs)/plano');
  };

  const currentIndex = normalizedPlan ? PLANS.findIndex(p => p.id === normalizedPlan) : -1;
  const availableUpgrades = PLANS.filter((_, i) => i > currentIndex);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View entering={SlideInDown.springify().damping(25)} exiting={SlideOutDown} style={[styles.sheet, { backgroundColor: themeColors.card }]}>
          <Pressable onPress={e => e.stopPropagation()}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View style={styles.rocketIcon}>
                  <Text style={{ fontSize: 20 }}>🚀</Text>
                </View>
                <View>
                  <Text style={styles.headerTitle}>
                    {isFreeTier ? t('quota.headerTitleFree') : t('quota.headerTitle')}
                  </Text>
                  <Text style={styles.headerSub}>
                    {isFreeTier ? t('quota.headerSubFree') : t('quota.headerSub')}
                  </Text>
                </View>
              </View>

              {/* Usage bar — only for paid tiers (free has no quota to show) */}
              {!isFreeTier ? (
                <View style={styles.usageBox}>
                  <View style={styles.usageRow}>
                    <Text style={styles.usageText}>{t('quota.usageText', { used, limit })}</Text>
                    <View style={styles.fullBadge}>
                      <Text style={styles.fullBadgeText}>100%</Text>
                    </View>
                  </View>
                  <View style={styles.barTrack}>
                    {/* Gradient fill (red → amber) instead of solid red — reads
                        as "you used everything" without screaming, while still
                        being clearly different from the brand-fucsia bars on
                        /plano. Reanimated 4 CSS pulse adds quiet urgency. */}
                    <Animated.View
                      style={[
                        styles.barFill,
                        {
                          width: `${usagePercent}%`,
                          overflow: 'hidden',
                          ...(reduceMotion ? {} : {
                            animationName: {
                              '0%': { opacity: 1 },
                              '50%': { opacity: 0.78 },
                              '100%': { opacity: 1 },
                            },
                            animationDuration: '2200ms',
                            animationIterationCount: 'infinite',
                            animationTimingFunction: 'ease-in-out',
                          }),
                        } as any,
                      ]}
                    >
                      <LinearGradient
                        colors={[Colors.brand.error, '#F97316']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  </View>
                  {credits > 0 && (
                    <Text style={styles.creditsAvailable}>
                      {t(credits === 1 ? 'quota.creditsOne' : 'quota.creditsOther', { n: credits })}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.usageBoxFree}>
                  <Text style={styles.usageTextFree}>{t('quota.usageTextFree')}</Text>
                </View>
              )}
            </View>

            {/* Tabs — only paid tiers see "Buy credits"; for free, jump to upgrade */}
            {!isFreeTier && (
              <View style={styles.tabs}>
                <Pressable
                  onPress={() => setTab('credits')}
                  style={[styles.tab, tab === 'credits' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === 'credits' && styles.tabTextActive]}>
                    {t('quota.tabCredits')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setTab('upgrade')}
                  style={[styles.tab, tab === 'upgrade' && styles.tabActiveUpgrade]}
                >
                  <Text style={[styles.tabText, tab === 'upgrade' && styles.tabTextActiveUpgrade]}>
                    {t('quota.tabUpgrade')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Content */}
            <ScrollView style={styles.body} contentContainerStyle={{ gap: 10 }}>
              {tab === 'credits' ? (
                <>
                  {CREDIT_PACKAGES.map(pkg => (
                    <Pressable key={pkg.qty} onPress={() => handleBuyCredits(pkg.qty)} style={[styles.pkgCard, pkg.popular && styles.pkgPopular]}>
                      {pkg.popular && <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>{t('quota.badgePopular')}</Text></View>}
                      {pkg.best && <View style={[styles.popularBadge, { backgroundColor: Colors.brand.violet }]}><Text style={styles.popularBadgeText}>{t('quota.badgeBest')}</Text></View>}
                      <View style={styles.pkgRow}>
                        <View style={[styles.qtyBadge, pkg.popular && { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                          <Text style={[styles.qtyText, pkg.popular && { color: '#34D399' }]}>+{pkg.qty}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pkgTitle}>{t('quota.pkgCampaigns', { n: pkg.qty })}</Text>
                          <Text style={styles.pkgPerUnit}>{t('quota.pkgPerUnit', { price: pkg.perUnit })}</Text>
                        </View>
                        <Text style={[styles.pkgPrice, pkg.popular && { color: '#34D399' }]}>{t('quota.pkgPrice', { price: pkg.price })}</Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  {availableUpgrades.map(plan => (
                    <Pressable key={plan.id} onPress={handleUpgrade} style={[styles.pkgCard, plan.recommended && styles.pkgRecommended]}>
                      {plan.recommended && <View style={styles.recBadge}><Text style={styles.popularBadgeText}>{t('quota.badgeRecommended')}</Text></View>}
                      <View style={styles.pkgRow}>
                        <View style={[styles.qtyBadge, plan.recommended && { backgroundColor: 'rgba(139,92,246,0.2)' }]}>
                          <Text style={[styles.qtyText, plan.recommended && { color: '#A78BFA' }]}>⭐</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pkgTitle}>{t(`planNames.${plan.id}` as const)}</Text>
                          <Text style={styles.pkgPerUnit}>{t('quota.planMonthly', { n: plan.campaigns })}</Text>
                        </View>
                        <Text style={[styles.pkgPrice, plan.recommended && { color: '#A78BFA' }]}>
                          {t('quota.planPriceMonthly', { price: plan.price })}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                  {availableUpgrades.length === 0 && (
                    <View style={styles.maxPlan}>
                      <Text style={{ fontSize: 24 }}>🏆</Text>
                      <Text style={styles.maxPlanText}>{t('quota.maxPlan')}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Close */}
            <View style={styles.footer}>
              <Button title={t('quota.closeButton')} variant="ghost" onPress={onClose} />
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    maxHeight: '90%',
  },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  rocketIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  usageBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  usageBoxFree: { backgroundColor: 'rgba(217,70,239,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(217,70,239,0.18)' },
  usageTextFree: { color: '#fff', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  usageText: { color: '#fff', fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  fullBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  fullBadgeText: { color: '#F87171', fontSize: 11, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  creditsAvailable: { color: '#34D399', fontSize: 12, marginTop: 6 },
  tabs: { flexDirection: 'row', margin: 20, marginBottom: 0, padding: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  tabActiveUpgrade: { backgroundColor: 'rgba(139,92,246,0.2)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#34D399' },
  tabTextActiveUpgrade: { color: '#A78BFA' },
  body: { padding: 20, maxHeight: 300 },
  pkgCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderCurve: 'continuous', padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pkgPopular: { borderColor: 'rgba(16,185,129,0.3)', borderWidth: 1.5 },
  pkgRecommended: { borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1.5 },
  popularBadge: { backgroundColor: Colors.brand.success, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 8 },
  recBadge: { backgroundColor: Colors.brand.violet, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 8 },
  popularBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  pkgRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
  pkgTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pkgPerUnit: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontVariant: ['tabular-nums'] },
  pkgPrice: { color: '#fff', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  maxPlan: { alignItems: 'center', padding: 20, gap: 8 },
  maxPlanText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  footer: { padding: 20, paddingBottom: 40 },
});
