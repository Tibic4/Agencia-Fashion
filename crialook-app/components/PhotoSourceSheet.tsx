/**
 * PhotoSourceSheet
 *
 * Premium replacement for the native Alert that asked "Camera vs Gallery".
 * Slides up from the bottom with a blurred backdrop, two big tappable
 * option cards (each with an icon, label, and helper text), and a Cancel
 * button. Visual language matches ModelBottomSheet (gradient surface,
 * fucsia accents, rounded corners, soft shadow).
 */
import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { tokens } from '@/lib/theme/tokens';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';

interface PhotoSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
}

export function PhotoSourceSheet({
  visible,
  onClose,
  onCamera,
  onLibrary,
}: PhotoSourceSheetProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { t } = useT();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(height);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(height, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [visible, height, backdropOpacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handlePick = (action: () => void) => {
    // Use the Rigid impact to signal "your choice has snapped into place" —
    // distinct from the Medium "press" used by other primary actions, so the
    // user feels a different texture for picking a source vs submitting.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    });
    onClose();
    setTimeout(action, 180);
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={28} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
        </BlurView>
      </Animated.View>

      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <LinearGradient
          colors={colors.surfaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.sheet,
            { borderColor: colors.border, paddingBottom: 24 + insets.bottom },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>{t('generate.sourcePrompt')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('generate.sourceSheetSubtitle')}
          </Text>

          <SourceOption
            icon="camera"
            label={t('generate.sourceCamera')}
            description={t('generate.sourceCameraDesc')}
            onPress={() => handlePick(onCamera)}
            colors={colors}
          />
          <SourceOption
            icon="image"
            label={t('generate.sourceLibrary')}
            description={t('generate.sourceLibraryDesc')}
            onPress={() => handlePick(onLibrary)}
            colors={colors}
          />

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: colors.surface2, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

interface SourceOptionProps {
  icon: 'camera' | 'image';
  label: string;
  description: string;
  onPress: () => void;
  colors: typeof Colors.light;
}

function SourceOption({ icon, label, description, onPress, colors }: SourceOptionProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 320 });
        }}
        style={[
          styles.option,
          {
            backgroundColor: colors.cardElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <LinearGradient
          colors={Colors.brand.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.optionIcon}
        >
          <FontAwesome name={icon} size={20} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>{description}</Text>
        </View>
        <FontAwesome name="chevron-right" size={13} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.md,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    gap: tokens.spacing.md,
    shadowColor: '#0F0519',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: tokens.fontSize.xxl,
    fontFamily: 'Inter_700Bold',
    fontWeight: tokens.fontWeight.bold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.mdLg,
    paddingVertical: tokens.spacing.mdLg,
    paddingHorizontal: tokens.spacing.mdLg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: tokens.spacing.xs,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: tokens.fontWeight.bold,
  },
  optionDesc: {
    fontSize: tokens.fontSize.md,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    lineHeight: 16,
  },
  cancel: {
    marginTop: tokens.spacing.sm,
    paddingVertical: tokens.spacing.mdLg,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: tokens.fontWeight.bold,
  },
});
