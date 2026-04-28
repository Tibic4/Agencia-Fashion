/**
 * Storybook on Vite, set up to render the same React Native UI primitives
 * (Button/Input/Card/Skeleton) the app uses, via react-native-web.
 *
 * Why a separate "web" Storybook instead of on-device:
 *  - Designers and non-engineers can open a URL and review every state of
 *    every component without setting up an Android device.
 *  - CI can publish a static build (npm run storybook:build) to S3/Vercel/
 *    Netlify so PR reviewers see what changed visually.
 *  - On-device Storybook for RN duplicates Metro and slows iteration; we
 *    keep that surface — and the Expo Router /__catalog route — for
 *    in-app dev only.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { StorybookConfig } from '@storybook/react-vite';

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(here, '..');
const shim = (name: string) => resolve(rootDir, 'storybook/shims', name);

const config: StorybookConfig = {
  stories: ['../storybook/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-vite', options: {} },
  viteFinal: async cfg => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias as Record<string, string> | undefined),
      'react-native$': 'react-native-web',
      'react-native': 'react-native-web',
      'expo-haptics': shim('expo-haptics.ts'),
      'expo-linear-gradient': shim('expo-linear-gradient.tsx'),
      'expo-blur': shim('expo-blur.tsx'),
      'expo-image': shim('expo-image.tsx'),
      'react-native-reanimated': shim('reanimated.tsx'),
      '@': rootDir,
    };
    cfg.define = {
      ...(cfg.define ?? {}),
      __DEV__: 'true',
    };
    return cfg;
  },
};

export default config;
