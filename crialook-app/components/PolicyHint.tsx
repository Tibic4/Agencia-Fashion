/**
 * PolicyHint
 *
 * Why this exists: the AI safety filter blocks non-fashion or NSFW input,
 * but the user only learns that *after* they hit "generate" and burn time
 * waiting. Telling them up-front (as the marketing site does, right under
 * the photo slot) avoids the wasted-attempt frustration and sets the right
 * mental model — "this is a fashion tool, not a face-swap toy".
 *
 * It's intentionally didactic-then-quiet: once the user uploads the main
 * photo, the hint disappears so it doesn't squat permanent UI real estate.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function PolicyHint() {
  const { t } = useT();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('generate.policyHint')}
    >
      <Text style={styles.icon}>🚫</Text>
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {t('generate.policyHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  icon: { fontSize: 11 },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    flexShrink: 1,
    textAlign: 'center',
  },
});
