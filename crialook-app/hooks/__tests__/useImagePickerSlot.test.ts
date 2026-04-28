/**
 * Hook integration test: useImagePickerSlot.
 *
 * Focus on the gallery branch (camera path is exercised end-to-end via the
 * CameraCaptureModal). What matters here:
 *   - successful pick goes through compressForUpload and lands in `value`
 *   - canceled picker leaves value untouched
 *   - busy flips true during the pick and back to false after
 *   - acceptCameraAsset writes to value (camera-modal handoff)
 *   - cameraOpen toggles from openCamera/closeCamera
 *   - clear() resets value to null
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as ImagePicker from 'expo-image-picker';
import { useImagePickerSlot } from '../gerar/useImagePickerSlot';

const launchLibrary = ImagePicker.launchImageLibraryAsync as unknown as ReturnType<
  typeof vi.fn
>;

describe('useImagePickerSlot — gallery', () => {
  it('compresses and stores the chosen asset', async () => {
    launchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg', width: 4000, height: 3000 }],
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useImagePickerSlot({ fileName: 'main.jpg', onSuccess }),
    );

    await act(async () => {
      await result.current.openLibrary();
    });

    await waitFor(() => {
      expect(result.current.value?.fileName).toBe('main.jpg');
    });
    expect(result.current.value?.uri).toContain('#compressed');
    expect(result.current.busy).toBe(false);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('leaves value null when the user cancels', async () => {
    launchLibrary.mockResolvedValueOnce({ canceled: true, assets: [] });

    const { result } = renderHook(() =>
      useImagePickerSlot({ fileName: 'x.jpg' }),
    );

    await act(async () => {
      await result.current.openLibrary();
    });

    expect(result.current.value).toBeNull();
    expect(result.current.busy).toBe(false);
  });
});

describe('useImagePickerSlot — camera handoff', () => {
  it('openCamera/closeCamera flips cameraOpen', () => {
    const { result } = renderHook(() =>
      useImagePickerSlot({ fileName: 'x.jpg' }),
    );
    expect(result.current.cameraOpen).toBe(false);
    act(() => result.current.openCamera());
    expect(result.current.cameraOpen).toBe(true);
    act(() => result.current.closeCamera());
    expect(result.current.cameraOpen).toBe(false);
  });

  it('acceptCameraAsset stores the asset and fires onSuccess', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useImagePickerSlot({ fileName: 'x.jpg', onSuccess }),
    );
    const asset = { uri: 'file:///cam.jpg', mimeType: 'image/jpeg', fileName: 'x.jpg' };
    act(() => result.current.acceptCameraAsset(asset));
    expect(result.current.value).toEqual(asset);
    expect(onSuccess).toHaveBeenCalledWith(asset);
  });
});

describe('useImagePickerSlot — clear', () => {
  it('resets value to null', () => {
    const { result } = renderHook(() =>
      useImagePickerSlot({ fileName: 'x.jpg' }),
    );
    act(() =>
      result.current.setValue({
        uri: 'file:///x',
        mimeType: 'image/jpeg',
        fileName: 'x.jpg',
      }),
    );
    expect(result.current.value).not.toBeNull();
    act(() => result.current.clear());
    expect(result.current.value).toBeNull();
  });
});
