import { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useUser, getClerkInstance } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';
import { apiPost } from './api';
import { invalidateAll } from './cache';
import { setSentryUser } from './sentry';

const tokenCache: TokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async clearToken(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};

type AuthState = {
  isSignedIn: boolean;
  user: { id: string; email?: string } | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function AuthInner({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user } = useUser();

  const authUser = user
    ? { id: user.id, email: user.primaryEmailAddress?.emailAddress }
    : null;

  useEffect(() => {
    setSentryUser(authUser?.id ?? null);
  }, [authUser?.id]);

  const signOut = async () => {
    await apiPost('/store/push-token', { token: null }).catch(() => {});
    await invalidateAll();
    setSentryUser(null);
    await clerkSignOut();
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: !!isSignedIn,
        user: authUser,
        loading: !isLoaded,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing');
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthInner>{children}</AuthInner>
    </ClerkProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const clerk = getClerkInstance();
    return (await clerk.session?.getToken()) ?? null;
  } catch {
    return null;
  }
}
