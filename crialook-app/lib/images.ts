import * as ImageManipulator from 'expo-image-manipulator';
import { ApiError } from '@/types';

const MAX_DIMENSION = 1600;
const TARGET_QUALITY = 0.75;
const MAX_RAW_BYTES = 12 * 1024 * 1024;

export interface CompressedAsset {
  uri: string;
  mimeType: string;
  fileName: string;
}

/**
 * Minimal shape we need from any image source (ImagePicker, expo-camera, etc).
 * Width/height are optional — when missing we always compress (skip the
 * "is it big enough to need a resize?" shortcut).
 */
export interface ImageSourceLike {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export async function compressForUpload(
  asset: ImageSourceLike,
  fileName: string,
): Promise<CompressedAsset> {
  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_RAW_BYTES) {
    throw new ApiError('Imagem muito grande. Use uma foto de até 12 MB.', 0, 'BAD_REQUEST');
  }

  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  const needsResize = w > MAX_DIMENSION || h > MAX_DIMENSION;

  const actions: ImageManipulator.Action[] = needsResize
    ? [
        {
          resize:
            w >= h
              ? { width: MAX_DIMENSION }
              : { height: MAX_DIMENSION },
        },
      ]
    : w === 0 && h === 0
    ? [{ resize: { width: MAX_DIMENSION } }]
    : [];

  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: TARGET_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    fileName,
  };
}

export function buildFormDataFile(
  asset: CompressedAsset,
): { uri: string; type: string; name: string } {
  return { uri: asset.uri, type: asset.mimeType, name: asset.fileName };
}
