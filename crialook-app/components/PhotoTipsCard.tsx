import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AnimatedPressable } from '@/components/ui';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT, type TKey } from '@/lib/i18n';

const TIPS: { icon: '✅' | '❌'; key: TKey }[] = [
  { icon: '✅', key: 'photoTips.tipBgClean' },
  { icon: '✅', key: 'photoTips.tipLight' },
  { icon: '✅', key: 'photoTips.tipFlat' },
  { icon: '❌', key: 'photoTips.tipNoModel' },
  { icon: '❌', key: 'photoTips.tipBgClutter' },
];

export function PhotoTipsCard() {
  const [expanded, setExpanded] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { t } = useT();

  return (
    <AnimatedPressable
      onPress={() => setExpanded(!expanded)}
      haptic="tap"
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{'📸'}</Text>
        <Text style={[styles.headerText, { color: colors.text }]}>{t('photoTips.header')}</Text>
        <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
      </View>
      {expanded && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.tipsList}>
          {TIPS.map(tip => (
            <View key={tip.key} style={styles.tipRow}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{t(tip.key)}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 16 },
  headerText: { flex: 1, fontSize: 13, fontWeight: '700' },
  tipsList: { marginTop: 10, gap: 6 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  tipText: { fontSize: 12, flex: 1 },
});
