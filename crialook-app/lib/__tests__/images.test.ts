import { describe, it, expect, vi } from 'vitest';
import * as ImageManipulator from 'expo-image-manipulator';
import { compressForUpload, buildFormDataFile } from '../images';
import { ApiError } from '@/types';

const manipulateMock = vi.mocked(ImageManipulator.manipulateAsync);

describe('compressForUpload', () => {
  it('rejects assets above 12MB raw', async () => {
    await expect(
      compressForUpload({ uri: 'file:///big.jpg', fileSize: 13 * 1024 * 1024 }, 'big.jpg'),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('does not resize when under MAX_DIMENSION', async () => {
    manipulateMock.mockResolvedValueOnce({ uri: 'file:///out.jpg' } as never);
    const out = await compressForUpload(
      { uri: 'file:///small.jpg', width: 800, height: 600 },
      'small.jpg',
    );
    expect(out.mimeType).toBe('image/jpeg');
    expect(out.fileName).toBe('small.jpg');
    const args = manipulateMock.mock.calls.at(-1)!;
    // No actions when dimensions known and small
    expect(args[1]).toEqual([]);
  });

  it('resizes by width when landscape and over 1600px', async () => {
    manipulateMock.mockResolvedValueOnce({ uri: 'file:///out.jpg' } as never);
    await compressForUpload(
      { uri: 'file:///hi.jpg', width: 4000, height: 2000 },
      'hi.jpg',
    );
    const actions = manipulateMock.mock.calls.at(-1)![1] as Array<{ resize: { width?: number; height?: number } }>;
    expect(actions[0].resize.width).toBe(1600);
  });

  it('resizes by height when portrait and over 1600px', async () => {
    manipulateMock.mockResolvedValueOnce({ uri: 'file:///out.jpg' } as never);
    await compressForUpload(
      { uri: 'file:///tall.jpg', width: 800, height: 3200 },
      'tall.jpg',
    );
    const actions = manipulateMock.mock.calls.at(-1)![1] as Array<{ resize: { width?: number; height?: number } }>;
    expect(actions[0].resize.height).toBe(1600);
  });

  it('always resizes to MAX_DIMENSION when width/height unknown', async () => {
    manipulateMock.mockResolvedValueOnce({ uri: 'file:///out.jpg' } as never);
    await compressForUpload({ uri: 'file:///unk.jpg' }, 'unk.jpg');
    const actions = manipulateMock.mock.calls.at(-1)![1] as Array<{ resize: { width?: number; height?: number } }>;
    expect(actions[0].resize.width).toBe(1600);
  });
});

describe('buildFormDataFile', () => {
  it('maps CompressedAsset → multipart shape', () => {
    expect(
      buildFormDataFile({ uri: 'file:///x.jpg', mimeType: 'image/jpeg', fileName: 'x.jpg' }),
    ).toEqual({ uri: 'file:///x.jpg', type: 'image/jpeg', name: 'x.jpg' });
  });
});
