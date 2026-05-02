/**
 * QuotaExceededModal — sheet modal disparado quando o usuário tenta gerar
 * uma campanha sem cota / sem créditos avulsos. Oferece dois caminhos:
 * comprar pacote de créditos avulsos (only paid tier) ou fazer upgrade
 * de plano (free + paid).
 *
 * Polish v2:
 *   - Cores 100% theme-aware (antes era #fff hardcoded sobre `themeColors.card`,
 *     o que quebrava em light mode — texto branco sobre card branco).
 *   - Tokens (fontSize/fontWeight/spacing/radii) em vez dos magic numbers
 *     antigos. `rounded()` helper aplicado em radii ≥16 (continuous superellipse).
 *   - Hero icon trocou o emoji 🚀 (PT-only feel + no-brand) pela `bolt` do
 *     FontAwesome com gradient brand atrás — coerente com a credits chip
 *     do AppHeader.
 *   - Haptic.selection ao trocar tab + haptic.tap nos packages/upgrades.
 *   - SlideInDown agora usa tokens.springs.bouncy em vez de damping inline.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Button } from '@/components/ui';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { tokens, rounded } from '@/lib/theme/tokens';

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
  const c = Colors[scheme];

  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const handleUpgrade = () => {
    haptic.tap();
    onClose();
    router.push('/(tabs)/plano');
  };

  const handleBuyCredits = (_qty: number) => {
    haptic.tap();
    onClose();
    router.push('/(tabs)/plano');
  };

  const switchTab = (next: 'credits' | 'upgrade') => {
    if (next === tab) return;
    haptic.selection();
    setTab(next);
  };

  const currentIndex = normalizedPlan ? PLANS.findIndex(p => p.id === normalizedPlan) : -1;
  const availableUpgrades = PLANS.filter((_, i) => i > currentIndex);

  // Tonal surfaces — não hardcoded white-on-white. `surface2` do theme já é
  // o nosso "raised dentro de card" (light: f7f4f8 / dark: 261f2d).
  const cardBg = c.card;
  const innerBg = c.surface2;
  const innerBorder = c.border;
  const successGlow = scheme === 'dark' ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.10)';
  const violetGlow = scheme === 'dark' ? 'rgba(168,85,247,0.20)' : 'rgba(168,85,247,0.10)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Animated.View
          entering={SlideInDown.springify().damping(tokens.springs.bouncy.damping).mass(tokens.springs.bouncy.mass)}
          exiting={SlideOutDown}
          style={[styles.sheet, { backgroundColor: cardBg, borderColor: c.border }]}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            {/* Drag handle — neutralizado pra theme */}
            <View style={[styles.dragHandle, { backgroundColor: c.borderHover }]} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: c.border }]}>
              <View style={styles.headerRow}>
                {/* Brand chip com bolt (paritário com a credits chip do AppHeader) */}
                <View style={styles.heroChip}>
                  <LinearGradient
                    colors={Colors.brand.gradientPrimary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <FontAwesome name="bolt" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.headerTitle, { color: c.text }]}>
                    {isFreeTier ? t('quota.headerTitleFree') : t('quota.headerTitle')}
                  </Text>
                  <Text style={[styles.headerSub, { color: c.textSecondary }]}>
                    {isFreeTier ? t('quota.headerSubFree') : t('quota.headerSub')}
                  </Text>
                </View>
              </View>

              {/* Usage bar — only for paid tiers (free has no quota to show) */}
              {!isFreeTier ? (
                <View style={[styles.usageBox, { backgroundColor: innerBg, borderColor: innerBorder }]}>
                  <View style={styles.usageRow}>
                    <Text style={[styles.usageText, { color: c.text }]}>
                      {t('quota.usageText', { used, limit })}
                    </Text>
                    <View style={[styles.fullBadge, { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.25)' }]}>
                      <Text style={styles.fullBadgeText}>100%</Text>
                    </View>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: c.border }]}>
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
                    <Text style={[styles.creditsAvailable, { color: Colors.brand.success }]}>
                      {t(credits === 1 ? 'quota.creditsOne' : 'quota.creditsOther', { n: credits })}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={[styles.usageBoxFree, { backgroundColor: Colors.brand.glowSoft, borderColor: Colors.brand.glowMid }]}>
                  <Text style={[styles.usageTextFree, { color: c.text }]}>{t('quota.usageTextFree')}</Text>
                </View>
              )}
            </View>

            {/* Tabs — only paid tiers see "Buy credits"; for free, jump to upgrade */}
            {!isFreeTier && (
              <View style={[styles.tabs, { backgroundColor: innerBg }]}>
                <Pressable
                  onPress={() => switchTab('credits')}
                  style={[
                    styles.tab,
                    tab === 'credits' && { backgroundColor: successGlow, borderColor: 'rgba(16,185,129,0.3)', borderWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[styles.tabText, { color: tab === 'credits' ? Colors.brand.success : c.textSecondary }]}>
                    {t('quota.tabCredits')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => switchTab('upgrade')}
                  style={[
                    styles.tab,
                    tab === 'upgrade' && { backgroundColor: violetGlow, borderColor: 'rgba(168,85,247,0.3)', borderWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[styles.tabText, { color: tab === 'upgrade' ? Colors.brand.violet : c.textSecondary }]}>
                    {t('quota.tabUpgrade')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Content */}
            <ScrollView style={styles.body} contentContainerStyle={{ gap: tokens.spacing.sm + 2 }}>
              {tab === 'credits' ? (
                <>
                  {CREDIT_PACKAGES.map(pkg => (
                    <Pressable
                      key={pkg.qty}
                      onPress={() => handleBuyCredits(pkg.qty)}
                      style={[
                        styles.pkgCard,
                        { backgroundColor: innerBg, borderColor: innerBorder },
                        pkg.popular && { borderColor: 'rgba(16,185,129,0.5)', borderWidth: 1.5 },
                        pkg.best && { borderColor: 'rgba(168,85,247,0.5)', borderWidth: 1.5 },
                      ]}
                    >
                      {pkg.popular && (
                        <View style={[styles.badge, { backgroundColor: Colors.brand.success }]}>
                          <Text style={styles.badgeText}>{t('quota.badgePopular')}</Text>
                        </View>
                      )}
                      {pkg.best && (
                        <View style={[styles.badge, { backgroundColor: Colors.brand.violet }]}>
                          <Text style={styles.badgeText}>{t('quota.badgeBest')}</Text>
                        </View>
                      )}
                      <View style={styles.pkgRow}>
                        <View style={[
                          styles.qtyBadge,
                          { backgroundColor: pkg.popular ? successGlow : pkg.best ? violetGlow : c.border },
                        ]}>
                          <Text style={[styles.qtyText, { color: pkg.popular ? Colors.brand.success : pkg.best ? Colors.brand.violet : c.textSecondary }]}>+{pkg.qty}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pkgTitle, { color: c.text }]}>{t('quota.pkgCampaigns', { n: pkg.qty })}</Text>
                          <Text style={[styles.pkgPerUnit, { color: c.textSecondary }]}>{t('quota.pkgPerUnit', { price: pkg.perUnit })}</Text>
                        </View>
                        <Text style={[styles.pkgPrice, { color: pkg.popular ? Colors.brand.success : pkg.best ? Colors.brand.violet : c.text }]}>
                          {t('quota.pkgPrice', { price: pkg.price })}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  {availableUpgrades.map(plan => (
                    <Pressable
                      key={plan.id}
                      onPress={handleUpgrade}
                      style={[
                        styles.pkgCard,
                        { backgroundColor: innerBg, borderColor: innerBorder },
                        plan.recommended && { borderColor: 'rgba(168,85,247,0.5)', borderWidth: 1.5 },
                      ]}
                    >
                      {plan.recommended && (
                        <View style={[styles.badge, { backgroundColor: Colors.brand.violet }]}>
                          <Text style={styles.badgeText}>{t('quota.badgeRecommended')}</Text>
                        </View>
                      )}
                      <View style={styles.pkgRow}>
                        <View style={[styles.qtyBadge, { backgroundColor: plan.recommended ? violetGlow : c.border }]}>
                          <FontAwesome name="star" size={16} color={plan.recommended ? Colors.brand.violet : c.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pkgTitle, { color: c.text }]}>{t(`planNames.${plan.id}` as const)}</Text>
                          <Text style={[styles.pkgPerUnit, { color: c.textSecondary }]}>
                            {t('quota.planMonthly', { n: plan.campaigns })}
                          </Text>
                        </View>
                        <Text style={[styles.pkgPrice, { color: plan.recommended ? Colors.brand.violet : c.text }]}>
                          {t('quota.planPriceMonthly', { price: plan.price })}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                  {availableUpgrades.length === 0 && (
                    <View style={styles.maxPlan}>
                      <FontAwesome name="trophy" size={28} color={Colors.brand.accent} />
                      <Text style={[styles.maxPlanText, { color: c.text }]}>{t('quota.maxPlan')}</Text>
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    ...rounded(tokens.radii.xxxl),
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: tokens.radii.xs / 2,
    alignSelf: 'center',
    marginTop: tokens.spacing.md,
  },
  header: {
    padding: tokens.spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  heroChip: {
    width: 48,
    height: 48,
    ...rounded(tokens.radii.xl),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: tokens.fontSize.xxxl,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  usageBox: {
    ...rounded(tokens.radii.md),
    padding: tokens.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  usageBoxFree: {
    ...rounded(tokens.radii.md),
    padding: tokens.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  usageTextFree: {
    fontSize: tokens.fontSize.md,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  usageText: {
    fontSize: tokens.fontSize.md,
    fontFamily: 'Inter_500Medium',
    fontVariant: ['tabular-nums'],
  },
  fullBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fullBadgeText: {
    color: '#F87171',
    fontSize: tokens.fontSize.xs,
    fontFamily: 'Inter_700Bold',
  },
  barTrack: {
    height: 8,
    borderRadius: tokens.radii.xs,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: tokens.radii.xs,
  },
  creditsAvailable: {
    fontSize: tokens.fontSize.sm,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 6,
  },
  tabs: {
    flexDirection: 'row',
    margin: tokens.spacing.xl,
    marginBottom: 0,
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    gap: tokens.spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: tokens.spacing.sm + 2,
    borderRadius: tokens.radii.sm,
    alignItems: 'center',
  },
  tabText: {
    fontSize: tokens.fontSize.md,
    fontFamily: 'Inter_600SemiBold',
  },
  body: {
    padding: tokens.spacing.xl,
    maxHeight: 320,
  },
  pkgCard: {
    ...rounded(tokens.radii.xl),
    padding: tokens.spacing.md + 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    alignSelf: 'flex-end',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
    marginBottom: tokens.spacing.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: tokens.fontSize.xs,
    fontFamily: 'Inter_700Bold',
  },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  qtyBadge: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_700Bold',
  },
  pkgTitle: {
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_600SemiBold',
  },
  pkgPerUnit: {
    fontSize: tokens.fontSize.sm,
    fontFamily: 'Inter_400Regular',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  pkgPrice: {
    fontSize: tokens.fontSize.xl,
    fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
  },
  maxPlan: {
    alignItems: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  maxPlanText: {
    fontSize: tokens.fontSize.base,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    padding: tokens.spacing.xl,
    paddingBottom: 40,
  },
});
