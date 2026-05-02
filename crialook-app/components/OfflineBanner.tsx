/**
 * OfflineBanner — Material 3 snackbar style.
 *
 * Why a banner not an Alert: Alert blocks the user; the offline state is
 * informational, not modal. Material 3 snackbar is the right pattern —
 * floating bar at the top with icon + message that slides in/out smoothly.
 *
 * When the user comes BACK online we briefly flash a green "Voltou" banner
 * with a haptic.success — quiet positive feedback that the network is OK
 * without ever asking the user to dismiss anything.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import Colors from '@/constants/Colors';
import { tokens } from '@/lib/theme/tokens';

const BACK_ONLINE_DURATION_MS = 2400;

export function OfflineBanner() {
  const isConnected = useNetworkStatus();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  // Tracks "we were just offline → showing the recovery flash". Lives long
  // enough for the 2.4s back-online toast to play, then resets.
  const [showRecovered, setShowRecovered] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setWasOffline(true);
      return;
    }
    if (wasOffline) {
      haptic.success();
      setShowRecovered(true);
      const t = setTimeout(() => {
        setShowRecovered(false);
        setWasOffline(false);
      }, BACK_ONLINE_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [isConnected, wasOffline]);

  if (isConnected && !showRecovered) return null;

  const isOffline = !isConnected;
  const bg = isOffline ? Colors.brand.error : Colors.brand.success;
  const icon = isOffline ? 'wifi' : 'check-circle';
  const message = isOffline ? t('offline.banner') : 'De volta online';

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[
        styles.banner,
        {
          backgroundColor: bg,
          paddingTop: insets.top + 8,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <FontAwesome name={icon} size={14} color="#fff" />
        <Text style={styles.text} selectable>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: 10,
    paddingHorizontal: 16,
    // Soft shadow underneath so it floats above the underlying header.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: tokens.fontWeight.semibold,
    letterSpacing: -0.1,
  },
});
