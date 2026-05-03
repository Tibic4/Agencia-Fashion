import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
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

/* Timeout de fallback pro init do Clerk.
   Se o SDK não hidratar em INIT_TIMEOUT_MS (offline / Clerk API lenta /
   Client Trust OFF forçando round-trip), libera `loading: false` mesmo
   assim. App segue pra /sign-in se !isSignedIn, em vez de splash eterna.
   Quando Clerk hidratar depois (rede voltou), `isSignedIn` atualiza
   normalmente e o AuthGate recoloca a rota.

   ▶ Reativar Client Trust: Quando o app for aprovado no Play Store,
     re-habilitar Client Trust no Clerk Dashboard (Sessions → Token settings).
     Isso reduz round-trips de getToken() e melhora latência de boot.
     Após reativar, `INIT_TIMEOUT_MS` provavelmente não será mais atingido em
     cenários normais — manter o fallback mesmo assim, mas considerar reduzir
     pra 3000ms. Atualizar a memória de projeto `project_clerk_client_trust`. */
const INIT_TIMEOUT_MS = 6_000;

function AuthInner({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user } = useUser();
  const [initTimedOut, setInitTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setInitTimedOut(true), INIT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isLoaded]);

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
        // Considera "carregado" quando Clerk resolveu OU quando passou do timeout.
        // `loading` é o sinal de gate do AuthGate em app/_layout.tsx.
        loading: !(isLoaded || initTimedOut),
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

/** Retorna o Clerk user.id atual (sync, sem network). Pode ser usado fora
 *  do React tree (ex: lib/billing.ts) pra anexar identidade a chamadas de
 *  billing nativo (`obfuscatedAccountIdAndroid`). */
export function getCurrentUserId(): string | null {
  try {
    const clerk = getClerkInstance();
    return clerk.user?.id ?? null;
  } catch {
    return null;
  }
}
