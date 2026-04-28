import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
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
  { qty: 3, price: '49,90', perUnit: '16,63' },
  { qty: 10, price: '149,90', perUnit: '14,99', popular: true },
  { qty: 20, price: '249,00', perUnit: '12,45', best: true },
];

// Plan name uses i18n key (`planNames.<id>`); price + campaign count are
// presentation tokens that don't translate.
const PLANS = [
  { id: 'essencial' as const, price: 179, campaigns: 15 },
  { id: 'pro' as const, price: 359, campaigns: 40, recommended: true },
  { id: 'business' as const, price: 749, campaigns: 100 },
];

export function QuotaExceededModal({ visible, used, limit, credits, currentPlan, onClose }: Props) {
  const [tab, setTab] = useState<'credits' | 'upgrade'>('credits');
  const router = useRouter();
  const { t } = useT();
  const scheme = useColorScheme();
  const themeColors = Colors[scheme];

  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;

  const handleUpgrade = () => {
    onClose();
    router.push('/(tabs)/plano');
  };

  const handleBuyCredits = (_qty: number) => {
    onClose();
    router.push('/(tabs)/plano');
  };

  const currentIndex = PLANS.findIndex(p => p.id === currentPlan?.toLowerCase());
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
                  <Text style={styles.headerTitle}>{t('quota.headerTitle')}</Text>
                  <Text style={styles.headerSub}>{t('quota.headerSub')}</Text>
                </View>
              </View>

              {/* Usage bar */}
              <View style={styles.usageBox}>
                <View style={styles.usageRow}>
                  <Text style={styles.usageText}>{t('quota.usageText', { used, limit })}</Text>
                  <View style={styles.fullBadge}>
                    <Text style={styles.fullBadgeText}>100%</Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${usagePercent}%` }]} />
                </View>
                {credits > 0 && (
                  <Text style={styles.creditsAvailable}>
                    {t(credits === 1 ? 'quota.creditsOne' : 'quota.creditsOther', { n: credits })}
                  </Text>
                )}
              </View>
            </View>

            {/* Tabs */}
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
    maxHeight: '90%',
  },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  rocketIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  usageBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  usageText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  fullBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  fullBadgeText: { color: '#F87171', fontSize: 11, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: '#EF4444' },
  creditsAvailable: { color: '#34D399', fontSize: 12, marginTop: 6 },
  tabs: { flexDirection: 'row', margin: 20, marginBottom: 0, padding: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  tabActiveUpgrade: { backgroundColor: 'rgba(139,92,246,0.2)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#34D399' },
  tabTextActiveUpgrade: { color: '#A78BFA' },
  body: { padding: 20, maxHeight: 300 },
  pkgCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pkgPopular: { borderColor: 'rgba(16,185,129,0.3)', borderWidth: 1.5 },
  pkgRecommended: { borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1.5 },
  popularBadge: { backgroundColor: Colors.brand.success, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 8 },
  recBadge: { backgroundColor: Colors.brand.violet, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 8 },
  popularBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  pkgRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
  pkgTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pkgPerUnit: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  pkgPrice: { color: '#fff', fontSize: 16, fontWeight: '700' },
  maxPlan: { alignItems: 'center', padding: 20, gap: 8 },
  maxPlanText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  footer: { padding: 20, paddingBottom: 40 },
});
