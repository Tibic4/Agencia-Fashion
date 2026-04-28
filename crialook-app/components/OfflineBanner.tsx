import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useT } from '@/lib/i18n';
import Colors from '@/constants/Colors';

export function OfflineBanner() {
  const isConnected = useNetworkStatus();
  const { t } = useT();
  if (isConnected) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{t('offline.banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.brand.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
