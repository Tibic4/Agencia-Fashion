/**
 * Config Expo dinâmica (substitui o app.json estático).
 *
 * TS em vez de JSON pq:
 *  - APP_VARIANT (development | preview | production) define bundle id,
 *    nome e scheme — dev/preview/prod coexistem no mesmo device.
 *  - Dá pra computar a partir de env (Sentry org, runtime version policy
 *    etc.) sem duplicar em eas.json.
 *
 * Variants:
 *   APP_VARIANT=development → CriaLook (Dev), com.crialook.app.dev, scheme crialook-dev
 *   APP_VARIANT=preview     → CriaLook (Preview), com.crialook.app.preview, scheme crialook-preview
 *   (default) production    → CriaLook, com.crialook.app, scheme crialook
 *
 * Seção iOS agora presente (estava sumida no app.json antigo, o que teria
 * bloqueado qualquer build iOS e desligado Universal Links em Apple
 * silenciosamente). Strings NS*UsageDescription moram aqui pro prebuild
 * regenerar Info.plist determinístico.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

// SDK 55 transpila app.config.ts como ESM, então `require` e `__dirname`
// não existem mais. Usamos `process.cwd()` como base — Expo CLI sempre
// invoca a config a partir do root do projeto.
const projectRoot = process.cwd();

type Variant = 'development' | 'preview' | 'production';
const variant = (process.env.APP_VARIANT as Variant) || 'production';

const isDev = variant === 'development';
const isPreview = variant === 'preview';

const bundleId =
  isDev ? 'com.crialook.app.dev'
  : isPreview ? 'com.crialook.app.preview'
  : 'com.crialook.app';

const displayName =
  isDev ? 'CriaLook (Dev)'
  : isPreview ? 'CriaLook (Preview)'
  : 'CriaLook';

const scheme =
  isDev ? 'crialook-dev'
  : isPreview ? 'crialook-preview'
  : 'crialook';

// Paths de ícone por variant.
//
// Quando dev/preview/prod estão instalados lado a lado no mesmo device
// (bundle ids diferentes), todos puxam a mesma arte — tester não consegue
// distinguir no launcher. Apontar cada variant pra asset distinto (ex:
// badge "DEV"/"PREVIEW" baked no PNG) faz o launcher se autodocumentar.
//
// Fallback pra ícone de produção quando o arquivo do variant não existe —
// safe shipar essa config antes de ter a arte. Joga `icon-dev.png` /
// `icon-preview.png` (e adaptive foregrounds equivalentes) em
// assets/images/ quando estiver pronto e pega automático, sem mexer nessa
// config.
//
// Workflow do asset: copia o PNG de prod, adiciona ribbon de canto
// ("DEV"/"PREVIEW") em qualquer editor, salva com o suffix. Adaptive
// foreground tem que ficar em fundo transparente com o mesmo safe-zone.
function pickAsset(filename: string, variantSuffix: string | null): string {
  if (!variantSuffix) return `./assets/images/${filename}.png`;
  const candidate = `./assets/images/${filename}-${variantSuffix}.png`;
  // __dirname aqui = root do projeto (onde app.config.ts mora), então dá
  // pra checar o filesystem na hora de avaliar a config e cair no
  // fallback silenciosamente.
  const exists = fs.existsSync(path.join(projectRoot, candidate));
  return exists ? candidate : `./assets/images/${filename}.png`;
}

const variantSuffix = isDev ? 'dev' : isPreview ? 'preview' : null;
const iconPath = pickAsset('icon', variantSuffix);
const adaptiveIconPath = pickAsset('adaptive-icon', variantSuffix);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: displayName,
  slug: 'crialook-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: iconPath,
  scheme,
  userInterfaceStyle: 'automatic',
  // Match a cor da splash pra eliminar o flash branco que aparecia entre
  // o splash native sumindo e o primeiro frame JS pintar. Sem isso,
  // RN window background = branco default, e o usuário via 200-800ms de
  // tela em branco no cold start.
  backgroundColor: '#D946EF',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#D946EF',
    dark: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#D946EF',
    },
  },
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: true,
    // HTTPS-only e não shipamos primitivas criptográficas além de TLS,
    // então pulamos a pergunta de export-compliance que a Apple faz toda release.
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        'Permitir que o CriaLook acesse sua câmera para fotografar peças de roupa.',
      NSPhotoLibraryUsageDescription:
        'Permitir que o CriaLook acesse suas fotos para selecionar imagens de produtos.',
      NSPhotoLibraryAddUsageDescription:
        'Permitir que o CriaLook salve as campanhas geradas na sua galeria.',
    },
    // Universal Links: servido de https://crialook.com.br/.well-known/apple-app-site-association.
    // O arquivo AASA tem que listar o bundle id com prefixo do team e um
    // path component `/campaign/*` casando com o intent filter do Android.
    // Sem isso, deep link de email / SMS / Safari abre o site no browser
    // em vez do app no iOS.
    associatedDomains: ['applinks:crialook.com.br'],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: adaptiveIconPath,
      backgroundColor: '#D946EF',
      // TODO: themed icon Material You (Android 13+) — gerar
      // `./assets/images/monochrome-icon.png` (silhueta branca + alpha
      // transparente) e religar `monochromeImage` aqui. Sem o asset, o
      // EAS prebuild quebra ao processar o ícone. Por ora ficamos com o
      // adaptive padrão (sem tema dinâmico do wallpaper).
    },
    edgeToEdgeEnabled: true,
    package: bundleId,
    allowBackup: false,
    // Phase 5 / 05-01 — F-07 + F-08 + D-15: explicit permissions BEFORE first build.
    //   POST_NOTIFICATIONS — Android 13+ runtime perm for expo-notifications.
    //     Without this, the OS silently drops every push notification on devices
    //     running Android 13+ and pushOptInGate.ts no-ops (lib/pushOptInGate.ts).
    //   com.android.vending.BILLING — required for react-native-iap autolinking
    //     to register, and Play Console rejects the AAB upload otherwise.
    //   Defense-in-depth: D-16's bundletool dump manifest step verifies that the
    //   built AAB actually contains both. If the verify finds either missing,
    //   the answer is to inspect Expo prebuild output, not to revert this list.
    permissions: [
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'com.android.vending.BILLING',
    ],
    blockedPermissions: [
      'RECEIVE_BOOT_COMPLETED',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'crialook.com.br',
            pathPrefix: '/campaign',
          },
          { scheme },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Permitir que o CriaLook acesse suas fotos para selecionar imagens de produtos.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Permitir que o CriaLook acesse sua câmera para fotografar peças de roupa.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'Permitir que o CriaLook salve as campanhas geradas na sua galeria.',
        savePhotosPermission:
          'Permitir que o CriaLook salve as campanhas geradas na sua galeria.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#D946EF',
      },
    ],
    'expo-splash-screen',
    'expo-mail-composer',
    [
      'react-native-iap',
      {
        paymentProvider: 'Play Store',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          kotlinVersion: '2.1.20',
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          enableMinifyInReleaseBuilds: true,
          // Predictive back (Android 14+): quando o usuário começa o
          // gesto de back, o OS mostra um peek da tela anterior atrás da
          // atual. Polish grátis que lê como "Android 2026". Apps RN que
          // não habilitam parecem velhos.
          enablePredictiveBackGesture: true,
        },
        ios: {
          // Bate com o default do SDK 54; bumpar exige checar compat de pods.
          deploymentTarget: '15.1',
        },
      },
    ],
    // Skia 2.x não exporta mais subpath `/plugin` — autolinking do Expo cuida
    // do nativo sozinho. Native module continua exigindo rebuild quando muda
    // versão. Ver components/skia/ pros consumidores.
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        // Session Replay é evitado via lib/sentry.ts (sample rates = 0
        // impedem o init nativo). O plugin Expo do Sentry não expõe flag
        // pra desabilitar Replay no build-time, então a defesa fica
        // 100% no Sentry.init(...) JS-side.
        note: 'org/project/authToken come from SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN during EAS build.',
      },
    ],
    'expo-localization',
  ],
  runtimeVersion: { policy: 'appVersion' },
  // OTA desligado por enquanto. Tinha `enabled: true` sem `url`, daí o module
  // logava `InitializationError: invalid configuration` no boot e o
  // `checkAutomatically: 'ON_LOAD'` ainda gastava ciclos antes do React subir.
  // Pra religar quando a infra de OTA tiver pronta: rodar `eas update:configure`
  // (gera o URL `https://u.expo.dev/<projectId>`), trocar `enabled` pra true e
  // restaurar `checkAutomatically` / `fallbackToCacheTimeout`.
  updates: { enabled: false },
  experiments: { typedRoutes: true },
  extra: {
    router: {},
    eas: { projectId: '4a513aba-203b-443d-8602-9b5c0bbad9c9' },
    privacyPolicyUrl: 'https://crialook.com.br/privacidade',
    termsUrl: 'https://crialook.com.br/termos',
    appVariant: variant,
  },
  owner: 'tibic4',
});
