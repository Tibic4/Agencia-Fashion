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
    clearAuthTokenCache();
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

/* In-memory cache do JWT do Clerk com TTL curto.
   Why: cada `apiGet`/`apiPost` chamava `clerk.session.getToken()`, que faz
   uma dança async (potencialmente network refresh). Em telas com vários
   fetches concorrentes (ex: /plano fazendo 4 paralelos), isso adiciona
   100-400ms acumulados. Tokens Clerk duram ~60s e a SDK refaz refresh
   automático — cacheamos por 30s pra ganhar latência sem risco de uso de
   token expirado.
   Nome `jwtCache` (não `tokenCache`) pra não colidir com o `tokenCache` do
   Clerk Expo definido no topo do arquivo (storage de tokens em SecureStore). */
let jwtCache: { value: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 30_000;

export async function getAuthToken(): Promise<string | null> {
  const now = Date.now();
  if (jwtCache && jwtCache.expiresAt > now) {
    return jwtCache.value;
  }
  try {
    const clerk = getClerkInstance();
    const fresh = (await clerk.session?.getToken()) ?? null;
    if (fresh) {
      jwtCache = { value: fresh, expiresAt: now + TOKEN_TTL_MS };
    }
    return fresh;
  } catch {
    return null;
  }
}

/** Invalida o cache — chamar no signOut pra evitar reuso de token antigo. */
export function clearAuthTokenCache() {
  jwtCache = null;
}
