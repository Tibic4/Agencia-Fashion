import { DarkTheme, DefaultTheme, ThemeProvider as NavigationTheme } from '@react-navigation/native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider, SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { ThemeProvider } from '@/lib/theme';
import Colors from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/lib/auth';
import { registerForPushNotifications, addNotificationResponseListener, getLastNotificationResponseAsync } from '@/lib/notifications';
import { apiPost, apiGet, pruneApiCache } from '@/lib/api';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AppErrorBoundary } from '@/components/ErrorBoundary';
import { AppFadeIn } from '@/components/AppFadeIn';
import { BiometricConsentMount } from '@/components/BiometricConsentModal';
import { ToastHost } from '@/components/ToastHost';
import { initBilling, shutdownBilling } from '@/lib/billing';
// Sentry religado com Session Replay desligado em 3 camadas — ver
// lib/sentry.ts (enableMobileReplay: false + sample rate 0 + filter de
// integrations) e app.config.ts (plugin Expo com enableSessionReplay:
// false). Antes o native module RNSentry inicializava o Session Replay
// (MediaCodec encoder + registerDefaultNetworkCallback) que travava o
// JS thread por ~51s no boot do AAB de produção, mesmo com
// replaysSessionSampleRate: 0. Confirmado via logcat.
import { initSentry, Sentry } from '@/lib/sentry';
import { initLocale } from '@/lib/i18n';
import {
  getQueryClient,
  wireQueryClientLifecycle,
  setupQueryPersistence,
} from '@/lib/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

initSentry();
initLocale();
// Sweep cache stale no boot — entradas com TTL longo nunca relidas continuam
// ocupando espaço no MMKV file mapping até serem expiradas.
pruneApiCache().catch(() => {});

// TanStack Query lifecycle: AppState → focus, expo-network → online. Persist
// query cache to MMKV so cold-start screens paint instantly. See
// lib/query-client.ts. Idempotent — safe at module scope.
wireQueryClientLifecycle();
setupQueryPersistence().catch(() => {});

// Fecha auth session pendente quando o app é reaberto após o OAuth redirect.
// Sem isso o flow useSSO pode travar esperando um resultado que nunca chega.
WebBrowser.maybeCompleteAuthSession();

export { ErrorBoundary } from 'expo-router';

// .catch evita unhandled rejection se a splash já foi escondida por race
// (acontece com fast-refresh e cold start em Hermes).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Safety net: força hideAsync após 12s independentemente do React tree
// resolver. Se algo no init quebrou silenciosamente (env faltando, native
// module crash, font load preso) e o `<AppFadeIn>` nunca chama hideAsync,
// o usuário fica preso na splash native pra sempre. Aqui garantimos que
// pelo menos a UI do JS aparece — mesmo que seja a tela de erro do
// AppErrorBoundary, é melhor que splash eterna.
const SPLASH_SAFETY_TIMEOUT_MS = 12_000;
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, SPLASH_SAFETY_TIMEOUT_MS);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidCampaignId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/* `routeReady` semaphore — `true` quando a rota mostrada já é a "certa"
   pra esse estado de auth. Render do `<Slot />` é gateado por isso pra
   evitar pintar a tela errada antes do `router.replace` rodar (anti-padrão
   "render then redirect" → vira "resolve then render"). */
function AuthGate({ onReady }: { onReady?: () => void }) {
  const { isSignedIn, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pushTokenSyncedRef = useRef(false);
  const [routeReady, setRouteReady] = useState(false);

  useEffect(() => {
    if (loading) return;

    const inTabs = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';
    const inAuth = segments[0] === 'sign-in' || segments[0] === 'sign-up' || segments[0] === 'sso-callback';

    // Caso 1: deslogado num lugar protegido → mandar pra sign-in
    if (!isSignedIn && (inTabs || inOnboarding)) {
      setRouteReady(false);
      router.replace('/sign-in');
      return;
    }

    // Caso 2: deslogado em rota pública (sign-in/up/sso-callback ou root)
    if (!isSignedIn) {
      setRouteReady(true);
      return;
    }

    // Caso 3: logado em rota não-app (sign-in, root) → checar onboarding
    if (isSignedIn && !inTabs && !inOnboarding && !inAuth) {
      setRouteReady(false);
      checkOnboardingThenRedirect();
      return;
    }

    // Caso 4: logado em (tabs)/onboarding/auth — destino correto
    setRouteReady(true);
  }, [isSignedIn, loading, segments]);

  // Callback pra parent (RootLayout) saber quando esconder a splash.
  useEffect(() => {
    if (routeReady && !loading) onReady?.();
  }, [routeReady, loading, onReady]);

  const checkOnboardingThenRedirect = async () => {
    try {
      const res = await apiGet<{ data: { name?: string } | null }>('/store');
      const hasStore = !!res.data?.name;
      router.replace(hasStore ? '/(tabs)/gerar' : '/onboarding');
    } catch {
      router.replace('/(tabs)/gerar');
    }
    // setRouteReady fica em false até o router.replace acionar nova
    // execução do useEffect acima e cair em "Caso 4".
  };

  useEffect(() => {
    if (!isSignedIn) {
      pushTokenSyncedRef.current = false;
      shutdownBilling().catch(() => {});
      return;
    }

    initBilling().catch(() => {});

    const syncToken = async () => {
      if (pushTokenSyncedRef.current) return;
      try {
        // IMPORTANT: don't ask for permission here — opt-in rate is 4-5×
        // higher when we ask AFTER the user has experienced the value
        // (a successful generation in resultado.tsx). At boot we just
        // try to fetch the token IF permission was already granted in a
        // previous session. `registerForPushNotifications()` no-ops the
        // request when permission is `denied` and only requests when
        // `undetermined` — see lib/notifications.ts. To be conservative
        // here, we skip the call entirely and let resultado.tsx own
        // the timing of the first prompt.
        const { getPermissionsAsync } = await import('expo-notifications');
        const { status } = await getPermissionsAsync();
        if (status !== 'granted') return;
        const token = await registerForPushNotifications();
        if (!token) return;
        await apiPost('/store/push-token', { token });
        pushTokenSyncedRef.current = true;
      } catch {
        /* will retry on next foreground */
      }
    };

    syncToken();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') syncToken();
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    const handleNotifResponse = (response: any) => {
      const data = response?.notification?.request?.content?.data;
      const id = data?.campaignId;
      if (isValidCampaignId(id)) {
        router.push({ pathname: '/(tabs)/gerar/resultado', params: { id } });
      }
    };
    const notifSub = addNotificationResponseListener(handleNotifResponse);

    // App aberto por toque em push (cold start): listener acima registra DEPOIS
    // do sistema entregar o evento. Esse fetch puxa o último response para que
    // o deep link de campanha não seja silenciosamente perdido.
    getLastNotificationResponseAsync().then(last => {
      if (last) handleNotifResponse(last);
    });

    return () => {
      sub.remove();
      notifSub.remove();
    };
  }, [isSignedIn]);

  // Drop the 'top' edge inside (tabs) — AppHeader handles its own insets via
  // useSafeAreaInsets(). For other screens (auth, onboarding) we keep top.
  const inTabs = segments[0] === '(tabs)';
  const edges = useMemo<Edge[]>(
    () => (inTabs ? ['left', 'right'] : ['top', 'left', 'right']),
    [inTabs],
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={edges}>
      {/* Só renderiza Slot quando a rota mostrada bate com o estado de auth.
          Antes disso, `null` mantém a SplashScreen visível (ela só esconde
          via onReady → RootLayout). Sem isso, a tela errada pintava por
          ~50-500ms enquanto o router.replace acontecia. */}
      {routeReady ? <Slot /> : null}
    </SafeAreaView>
  );
}

function RootLayout() {
  const colorScheme = useColorScheme();
  // Override RN Navigation theme so route transitions don't flash pure
  // white/black behind the screen during the swap. Uses our design tokens.
  const navTheme = useMemo(() => {
    const isDark = colorScheme === 'dark';
    const palette = Colors[isDark ? 'dark' : 'light'];
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.background,
        card: palette.card,
        text: palette.text,
        border: palette.border,
        primary: Colors.brand.primary,
      },
    };
  }, [colorScheme]);

  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  /* `appReady` = fontes carregadas.
     Antes era `loaded && authReady`, com authReady setado pelo callback do
     AuthGate. Mas o AuthGate ficava DENTRO do <AppFadeIn ready={appReady}>,
     que retornava null enquanto !ready — então o AuthGate nunca montava,
     onReady nunca disparava, authReady ficava false pra sempre. Deadlock
     fresh-install: toda nova instalação travava em splash + tela branca
     após o safety net forçar hideAsync.
     AuthGate controla seu próprio render do <Slot/> via routeReady, então
     mostrar a árvore com o fade-in assim que as fontes carregarem é
     seguro — o conteúdo da rota só pinta depois que routeReady confirmar. */
  const appReady = loaded;

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // SplashScreen.hideAsync is now called by AppFadeIn the moment it starts
  // the cross-fade — so the native splash disappears AT the same frame the
  // JS content begins to fade in (no gap, no double-cut). Don't double-call.

  if (!loaded) return null;

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={getQueryClient()}>
            <ThemeProvider>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <NavigationTheme value={navTheme}>
                    <StatusBar style="auto" />
                    <AppFadeIn ready={appReady}>
                      <OfflineBanner />
                      <AuthGate />
                      <BiometricConsentMount />
                      {/* Toast host sits at root so any screen can call
                          `toast.success(...)` / `toast.error(...)` and the
                          message floats above the tab bar. */}
                      <ToastHost />
                    </AppFadeIn>
                  </NavigationTheme>
                </BottomSheetModalProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

// Sentry.wrap envolve o root component em uma boundary de error capture +
// route tracing. Religado junto com initSentry — ver comentário no topo.
export default Sentry.wrap(RootLayout);
