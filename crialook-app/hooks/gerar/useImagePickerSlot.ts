/**
 * Why a hook?
 *  Each photo slot needs the same machinery: pick an image, compress it,
 *  surface failures, expose busy state. Inlining this per slot is ~30 lines
 *  of boilerplate; the hook collapses it to:
 *
 *    const main = useImagePickerSlot({ fileName: 'main.jpg' });
 *    <Pressable onPress={main.openSheet}>{main.value && <Image ... />}</Pressable>
 *
 *  Each slot owns its own busy flag, so per-slot spinners work without a
 *  global "uploading" state that would block the rest of the screen.
 *
 *  The hook also exposes `openCamera` separately so the screen can mount our
 *  custom CameraCaptureModal (branded UX) instead of the OS picker — the
 *  caller still gets a CompressedAsset back the same way.
 */
import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { compressForUpload, type CompressedAsset } from '@/lib/images';
import { logger } from '@/lib/logger';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface UseImagePickerSlotOptions {
  fileName: string;
  onSuccess?: (asset: CompressedAsset) => void;
}

interface UseImagePickerSlotResult {
  value: CompressedAsset | null;
  busy: boolean;
  /** True while the consumer's <CameraCaptureModal /> should be visible. */
  cameraOpen: boolean;
  /** True while the consumer's <PhotoSourceSheet /> should be visible. */
  sheetOpen: boolean;
  /** Show our branded source-picker sheet (camera vs gallery). */
  openSheet: () => void;
  /** Dismiss the source-picker sheet. */
  closeSheet: () => void;
  /** Open the gallery picker directly. */
  openLibrary: () => Promise<void>;
  /** Open our branded camera modal (sets cameraOpen=true; caller renders the modal). */
  openCamera: () => void;
  /** Called by CameraCaptureModal's onCapture callback. */
  acceptCameraAsset: (asset: CompressedAsset) => void;
  closeCamera: () => void;
  clear: () => void;
  setValue: (asset: CompressedAsset | null) => void;
}

const LIBRARY_OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1,
  allowsEditing: false,
};

export function useImagePickerSlot({
  fileName,
  onSuccess,
}: UseImagePickerSlotOptions): UseImagePickerSlotResult {
  const [value, setValue] = useState<CompressedAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openLibrary = useCallback(async () => {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync(LIBRARY_OPTS);
      if (result.canceled || !result.assets[0]) return;
      const compressed = await compressForUpload(result.assets[0], fileName);
      setValue(compressed);
      onSuccess?.(compressed);
    } catch (e: any) {
      logger.warn('library pick failed', { message: e?.message });
      toast.error(e?.message || t('errors.imageProcessFailed'));
    } finally {
      setBusy(false);
    }
  }, [fileName, onSuccess]);

  const openCamera = useCallback(() => setCameraOpen(true), []);
  const closeCamera = useCallback(() => setCameraOpen(false), []);

  const acceptCameraAsset = useCallback(
    (asset: CompressedAsset) => {
      setValue(asset);
      onSuccess?.(asset);
    },
    [onSuccess],
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const clear = useCallback(() => setValue(null), []);

  return {
    value,
    busy,
    cameraOpen,
    sheetOpen,
    openSheet,
    closeSheet,
    openLibrary,
    openCamera,
    acceptCameraAsset,
    closeCamera,
    clear,
    setValue,
  };
}
