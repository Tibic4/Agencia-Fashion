/**
 * Infra TanStack Query do app.
 *
 * Por que migrar do `api()` puro: o wrapper custom reimplementava retry,
 * cache TTL, stale-while-revalidate e dedup parcial. TanStack Query dá tudo
 * isso + dedup de request, cancel automático no unmount, refetch em
 * reconnect/focus, optimistic update e persistência — com menos código e
 * mais correção.
 *
 * Persistir cache no MMKV = dado instantâneo no cold start, sem spinner
 * enquanto o primeiro request voa.
 *
 * Mantemos `api()` como fetcher: continua dono de injeção de auth header,
 * retry idempotent / 401 e classificação de erro. As queries só chamam
 * `api()` do `queryFn`.
 *
 * Plano de migração: callers ficam em `apiGet*` até serem tocados. Cada tela
 * tocada troca pra `useQuery` (read) ou `useMutation` (write). Ambos os
 * caminhos compartilham os mesmos primitives de auth + cache.
 */
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { MMKV } from 'react-native-mmkv';
import { AppState } from 'react-native';
import Constants from 'expo-constants';

// Lazy-instanciado pra SSR / test runners Node (sem MMKV native) não
// quebrarem no import. Singleton de módulo dentro da função.
let _client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (_client) return _client;
  _client = new QueryClient({
    defaultOptions: {
      queries: {
        // 30s fresh por default — bate com o `apiGetCached(..., 30_000)`
        // que era baseline em todas as telas.
        staleTime: 30_000,
        // 5 min no cache depois que o último subscriber desmonta — sair
        // da tela e voltar não refaz fetch.
        gcTime: 5 * 60_000,
        retry: 2,
        retryDelay: (i: number) => Math.min(1000 * 2 ** i, 30_000),
        refetchOnReconnect: 'always',
        // RN não tem window focus; AppState é ligado abaixo via focusManager.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 1 },
    },
  });
  return _client;
}

let _wired = false;

/**
 * Liga AppState → focusManager e netinfo → onlineManager pra queries
 * pausarem/resumirem em background e reconnect. Idempotent.
 */
export function wireQueryClientLifecycle() {
  if (_wired) return;
  _wired = true;

  focusManager.setEventListener((handleFocus: (focused: boolean) => void) => {
    const sub = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active');
    });
    return () => sub.remove();
  });

  // Bridge do `@react-native-community/netinfo` (já é dep) pro
  // `onlineManager`. Listener do NetInfo dispara em toda mudança de
  // conectividade, incluindo 'unknown' → 'wifi' — queries pausam/resumem
  // certo ao alternar airplane mode no meio do voo. Dynamic import por
  // string pro test runner não tentar resolver native module em jsdom.
  import('@react-native-community/netinfo')
    .then(({ default: NetInfo }) => {
      onlineManager.setEventListener((setOnline: (online: boolean) => void) => {
        const unsub = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
          setOnline(!!state.isConnected);
        });
        return () => unsub();
      });
    })
    .catch(() => {
      /* NetInfo indisponível — refetch só via AppState */
    });
}

/**
 * Opcional: persiste o cache de query no MMKV pras telas pintarem do disco
 * no cold start. Chama uma vez depois de `getQueryClient()` se quiser esse
 * comportamento. Opt-in pra não persistir dado atrelado a auth em devices
 * onde o usuário desloga e entra como outra pessoa.
 */
export function setupQueryPersistence() {
  const storage = new MMKV({ id: 'crialook-query-cache' });
  // Dynamic import mantém o bundle de test/web magro.
  return import('@tanstack/query-sync-storage-persister').then(
    async ({ createSyncStoragePersister }) => {
      const { persistQueryClient } = await import(
        '@tanstack/react-query-persist-client'
      );
      const persister = createSyncStoragePersister({
        storage: {
          getItem: (k: string) => storage.getString(k) ?? null,
          setItem: (k: string, v: string) => storage.set(k, v),
          removeItem: (k: string) => storage.delete(k),
        },
      });
      // Buster atrelado à versão do app: toda nova versão invalida cache
      // persistido automaticamente. Evita "dado antigo com schema novo"
      // após update da app na loja. Fallback 'v1' pra dev sem versão.
      const appVersion = Constants.expoConfig?.version ?? 'v1';
      persistQueryClient({
        queryClient: getQueryClient(),
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: appVersion,
      });
    },
  );
}

/**
 * Factory centralizado de query keys. Adicionar keys aqui mantém
 * invalidation safe — `qk.campaigns.all` é source of truth única contra a
 * qual mutators chamam `invalidateQueries({ queryKey: qk.campaigns.all })`.
 */
export const qk = {
  campaigns: {
    all: ['campaigns'] as const,
    list: () => [...qk.campaigns.all, 'list'] as const,
    detail: (id: string) => [...qk.campaigns.all, 'detail', id] as const,
  },
  store: {
    all: ['store'] as const,
    usage: () => [...qk.store.all, 'usage'] as const,
    credits: () => [...qk.store.all, 'credits'] as const,
    profile: () => [...qk.store.all, 'profile'] as const,
    models: () => [...qk.store.all, 'models'] as const,
  },
};
