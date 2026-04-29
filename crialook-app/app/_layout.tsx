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
import { BiometricConsentMount } from '@/components/BiometricConsentModal';
import { initBilling, shutdownBilling } from '@/lib/billing';
import { initSentry, Sentry } from '@/lib/sentry';
import { initLocale } from '@/lib/i18n';
import * as WebBrowser from 'expo-web-browser';

initSentry();
initLocale();
// Sweep cache stale no boot — sem isso entradas com TTL longo nunca lidas
// vazam no AsyncStorage até bater no soft-cap de 6MB do Android.
pruneApiCache().catch(() => {});

// Fecha auth session pendente quando o app é reaberto após o OAuth redirect.
// Sem isso o flow useSSO pode travar esperando um resultado que nunca chega.
WebBrowser.maybeCompleteAuthSession();

export { ErrorBoundary } from 'expo-router';

// .catch evita unhandled rejection se a splash já foi escondida por race
// (acontece com fast-refresh e cold start em Hermes).
SplashScreen.preventAutoHideAsync().catch(() => {});

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
  /* `appReady` = fontes carregadas + auth resolveu pra rota correta.
     Antes só dependia de fontes, então a splash sumia enquanto o Clerk
     ainda estava hidratando e a tela errada aparecia atrás. */
  const [authReady, setAuthReady] = useState(false);
  const appReady = loaded && authReady;

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  if (!loaded) return null;

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <BottomSheetModalProvider>
                <NavigationTheme value={navTheme}>
                  <StatusBar style="auto" />
                  <OfflineBanner />
                  <AuthGate onReady={() => setAuthReady(true)} />
                  <BiometricConsentMount />
                </NavigationTheme>
              </BottomSheetModalProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
