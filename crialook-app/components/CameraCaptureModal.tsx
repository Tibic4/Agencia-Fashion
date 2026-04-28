/**
 * Native camera capture modal with brand UI.
 *
 * Why we own this instead of using expo-image-picker's launchCameraAsync:
 *   - The picker dumps the user into the OS camera; we don't control branding,
 *     guides, hints or the "review" step.
 *   - We want to show product-photo tips overlay (good light, plain bg)
 *     while the user is framing the shot — that's the moment they care.
 *   - Flash + flip controls in our visual language.
 *   - Returns the same CompressedAsset shape as the rest of the app, so
 *     callers don't fork their handling code.
 *
 * Three visual states:
 *   1. resolving permission → branded skeleton (avoid flicker)
 *   2. denied               → brand-compliant prompt to grant or open settings
 *   3. first-time tour      → 1-step "good shot checklist" before the viewfinder
 *   4. live viewfinder      → flash, flip, hint, shutter
 *   5. preview              → retake / use
 *
 * The first-time tour persists in SecureStore so it shows once per install.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
  type FlashMode,
} from 'expo-camera';
import { haptic } from '@/lib/haptics';
import * as SecureStore from 'expo-secure-store';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { compressForUpload, type CompressedAsset } from '@/lib/images';
import { logger } from '@/lib/logger';
import { useT } from '@/lib/i18n';

const TOUR_KEY = 'camera_tour_seen_v1';

interface CameraCaptureModalProps {
  visible: boolean;
  fileName: string;
  /** Optional product-photo hint shown above the shutter (e.g. "Centralize a peça"). */
  hint?: string;
  onClose: () => void;
  onCapture: (asset: CompressedAsset) => void;
}

export function CameraCaptureModal({
  visible,
  fileName,
  hint,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const { t } = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [showTour, setShowTour] = useState<boolean | null>(null);

  // Resolve "have I shown the tour before?" once when the modal first opens.
  useEffect(() => {
    if (!visible) return;
    SecureStore.getItemAsync(TOUR_KEY)
      .then(seen => setShowTour(seen !== '1'))
      .catch(() => setShowTour(false));
  }, [visible]);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible) {
      setPreviewUri(null);
      setBusy(false);
    }
  }, [visible]);

  const dismissTour = async () => {
    setShowTour(false);
    SecureStore.setItemAsync(TOUR_KEY, '1').catch(() => {});
  };

  const handleShoot = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    haptic.confirm();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        setBusy(false);
        return;
      }
      setPreviewUri(photo.uri);
    } catch (e: any) {
      logger.warn('camera capture failed', { message: e?.message });
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewUri) return;
    try {
      const compressed = await compressForUpload({ uri: previewUri }, fileName);
      haptic.success();
      onCapture(compressed);
      onClose();
    } catch (e: any) {
      logger.warn('camera compress failed', { message: e?.message });
      setBusy(false);
    }
  };

  const handleRetake = () => {
    setPreviewUri(null);
    setBusy(false);
  };

  // ── Render branches ────────────────────────────────────────────────────
  const renderBody = () => {
    // 1. Permission still resolving → skeleton
    if (!permission || showTour === null) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brand.primary} size="large" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }

    // 2. Permission denied
    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <FontAwesome name="camera" size={48} color="#fff" />
          <Text style={styles.permissionTitle}>{t('camera.permissionTitle')}</Text>
          <Text style={styles.permissionDesc}>{t('camera.permissionDesc')}</Text>
          <Pressable
            onPress={
              permission.canAskAgain ? requestPermission : () => Linking.openSettings()
            }
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel={t('camera.grant')}
          >
            <Text style={styles.primaryBtnText}>{t('camera.grant')}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      );
    }

    // 3. First-time tour (good-shot checklist)
    if (showTour) {
      return (
        <View style={styles.tour}>
          <Text style={styles.tourEmoji}>📸</Text>
          <Text style={styles.tourTitle}>{t('camera.permissionTitle')}</Text>
          <View style={styles.tourList}>
            <Text style={styles.tourItem}>💡 {hint || t('camera.hintMain')}</Text>
            <Text style={styles.tourItem}>{t('camera.tourTipNaturalLight')}</Text>
            <Text style={styles.tourItem}>{t('camera.tourTipCenter')}</Text>
            <Text style={styles.tourItem}>{t('camera.tourTipPlainBg')}</Text>
          </View>
          <Pressable
            onPress={dismissTour}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.confirm')}
          >
            <Text style={styles.primaryBtnText}>{t('common.confirm')} ✓</Text>
          </Pressable>
        </View>
      );
    }

    // 4. Preview after capture
    if (previewUri) {
      return (
        <View style={styles.flex}>
          <Image source={{ uri: previewUri }} style={styles.preview} contentFit="contain" />
          <View style={styles.previewActions}>
            <Pressable
              onPress={handleRetake}
              style={[styles.previewBtn, styles.previewBtnGhost]}
              accessibilityRole="button"
              accessibilityLabel={t('camera.retake')}
            >
              <FontAwesome name="refresh" size={18} color="#fff" />
              <Text style={styles.previewBtnText}>{t('camera.retake')}</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={[styles.previewBtn, styles.previewBtnPrimary]}
              accessibilityRole="button"
              accessibilityLabel={t('camera.use')}
            >
              <FontAwesome name="check" size={18} color="#fff" />
              <Text style={styles.previewBtnText}>{t('camera.use')}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    // 5. Live viewfinder
    return (
      <View style={styles.flex}>
        <CameraView
          ref={cameraRef}
          style={styles.flex}
          facing={facing}
          flash={flash}
          ratio="16:9"
        >
          <View style={styles.topControls}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <FontAwesome name="close" size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() =>
                setFlash(f => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))
              }
              hitSlop={12}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={`Flash ${flash}`}
            >
              <FontAwesome
                name={flash === 'off' ? 'flash' : flash === 'on' ? 'bolt' : 'sun-o'}
                size={20}
                color={flash === 'off' ? 'rgba(255,255,255,0.6)' : '#FBBF24'}
              />
              <Text style={styles.flashLabel}>{flash}</Text>
            </Pressable>
            <Pressable
              onPress={() => setFacing(f => (f === 'back' ? 'front' : 'back'))}
              hitSlop={12}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <FontAwesome name="refresh" size={20} color="#fff" />
            </Pressable>
          </View>

          {hint && (
            <View style={styles.hint}>
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          )}

          <View style={styles.bottomControls}>
            <Pressable
              onPress={handleShoot}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Capture"
              style={[styles.shutter, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color={Colors.brand.primary} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
          </View>
        </CameraView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>{renderBody()}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { color: '#fff', fontSize: 14, marginTop: 12 },
  permissionTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 16 },
  permissionDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: Colors.brand.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    minHeight: 48,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, minHeight: 48, justifyContent: 'center' },
  secondaryBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },

  tour: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  tourEmoji: { fontSize: 56 },
  tourTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tourList: { gap: 12, alignSelf: 'stretch', marginTop: 8, marginBottom: 8 },
  tourItem: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  topControls: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  hint: {
    position: 'absolute',
    top: 120,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  hintText: { color: '#fff', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  preview: { flex: 1, backgroundColor: '#000' },
  previewActions: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: 'row',
    gap: 12,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    minHeight: 56,
  },
  previewBtnGhost: { backgroundColor: 'rgba(255,255,255,0.15)' },
  previewBtnPrimary: { backgroundColor: Colors.brand.primary },
  previewBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
