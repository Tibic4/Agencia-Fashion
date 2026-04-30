/**
 * Setup Jest pra teste de componente / tela.
 *
 * Mocka módulos Expo e stacks RN gesture/reanimated que não rodam no test
 * renderer. Adicionar mock aqui é preferível a mock por teste — mantém os
 * testes focados em asserção em vez de plumbing.
 */
import '@testing-library/react-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => store.set(k, String(v)),
      delete: (k: string) => store.delete(k),
      getAllKeys: () => Array.from(store.keys()),
      clearAll: () => store.clear(),
    })),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  useFocusEffect: jest.fn(),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  Slot: () => null,
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, signOut: jest.fn() }),
  useUser: () => ({ user: { id: 'test-user', primaryEmailAddress: { emailAddress: 'a@b.com' } } }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  getClerkInstance: () => ({ session: { getToken: () => Promise.resolve('token') }, user: { id: 'test-user' } }),
}));

// Cala warnings de scheduled-animation não tratados do RN test renderer.
jest.useFakeTimers();
