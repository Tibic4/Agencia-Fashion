/**
 * components/useColorScheme.web.ts
 *
 * Why: web SSR cannot use Reanimated/Appearance the same way; reuse the same
 * theme context — it's already SSR-safe (no native deps in lib/theme.tsx
 * besides expo-secure-store, which is no-op-friendly on web).
 */
import { useEffectiveColorScheme } from '@/lib/theme';

export function useColorScheme(): 'light' | 'dark' {
  return useEffectiveColorScheme();
}
