/**
 * components/useColorScheme.ts
 *
 * Why: every screen reads `useColorScheme()` to pick from `Colors.light` /
 * `Colors.dark`. Previously this just re-exported RN's `useColorScheme`,
 * meaning the user could not override light/dark without flipping the device
 * setting. Now the hook reads the resolved scheme from our ThemeContext
 * (which itself falls back to the device setting in 'system' mode).
 */
import { useEffectiveColorScheme } from '@/lib/theme';

export function useColorScheme(): 'light' | 'dark' {
  return useEffectiveColorScheme();
}
