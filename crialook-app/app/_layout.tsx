import { DarkTheme, DefaultTheme, ThemeProvider as NavigationTheme } from '@react-navigation/native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider, SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { ThemeProvider } from '@/lib/theme';
import Colors from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/lib/auth';
import { registerForPushNotifications, addNotificationResponseListener } from '@/lib/notifications';
import { apiPost, apiGet } from '@/lib/api';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AppErrorBoundary } from '@/components/ErrorBoundary';
import { BiometricConsentMount } from '@/components/BiometricConsentModal';
import { initBilling, shutdownBilling } from '@/lib/billing';
import { initSentry, Sentry } from '@/lib/sentry';
import { initLocale } from '@/lib/i18n';

initSentry();
initLocale();

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidCampaignId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function AuthGate() {
  const { isSignedIn, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pushTokenSyncedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    const inTabs = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!isSignedIn && (inTabs || inOnboarding)) {
      router.replace('/sign-in');
    } else if (isSignedIn && !inTabs && !inOnboarding) {
      checkOnboardingThenRedirect();
    }
  }, [isSignedIn, loading, segments]);

  const checkOnboardingThenRedirect = async () => {
    try {
      const res = await apiGet<{ data: { name?: string } | null }>('/store');
      const hasStore = !!res.data?.name;
      router.replace(hasStore ? '/(tabs)/gerar' : '/onboarding');
    } catch {
      router.replace('/(tabs)/gerar');
    }
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

    const notifSub = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      const id = data?.campaignId;
      if (isValidCampaignId(id)) {
        router.push({ pathname: '/(tabs)/gerar/resultado', params: { id } });
      }
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
      <Slot />
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

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

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
                  <AuthGate />
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
