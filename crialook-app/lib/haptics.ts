/**
 * Semantic haptic helpers
 *
 * Why semantic, not stylistic? iOS/Android haptic engines map physical
 * impulses to *meanings* — selection (tick), tap (light press), confirm
 * (heavy commit), success/warning/error (system notifications). Calling
 * `Haptics.impactAsync(Light)` everywhere drowns the system: every tap
 * feels the same as every selection. Picking the right semantic verb
 * makes the app feel native (Apple HIG: "Use haptics consistently to
 * convey meaning, not just attention").
 *
 * Pattern matrix:
 *   selection → switching tabs, filters, segmented control (tiniest tick)
 *   tap       → selecting an item from a list (chip, photo slot, model)
 *   press     → primary button tap, opening sheets/modals
 *   confirm   → committing a destructive/important action (Generate)
 *   success   → async op finished OK (saved photo, restored purchase)
 *   warning   → user intent that deserves a pause (delete confirmation)
 *   error     → async op failed (API down, permission denied)
 *
 * All calls are fire-and-forget (Promise<void> ignored). They never throw
 * on devices without a Taptic engine — expo-haptics no-ops gracefully.
 */
import * as Haptics from 'expo-haptics';
import { getPreference } from './preferences';

// User can opt out of haptics in Settings → Acessibilidade. We check on every
// fire because the cost is a sync MMKV read (~microseconds) and it lets the
// toggle take effect immediately without remounting consumers.
function hapticsAllowed(): boolean {
  try {
    return getPreference('hapticsEnabled');
  } catch {
    return true;
  }
}

export const haptic = {
  selection: () => {
    if (!hapticsAllowed()) return;
    Haptics.selectionAsync().catch(() => {});
  },
  tap: () => {
    if (!hapticsAllowed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  press: () => {
    if (!hapticsAllowed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  confirm: () => {
    if (!hapticsAllowed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  success: () => {
    if (!hapticsAllowed()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  },
  warning: () => {
    if (!hapticsAllowed()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
  },
  error: () => {
    if (!hapticsAllowed()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {},
    );
  },
  /**
   * Pull-to-refresh gesture start. Lighter than `tap` because the refresh
   * itself is the user's action — the haptic just confirms "I felt your pull".
   * Mirrors iOS Mail / Twitter pull haptic.
   */
  pull: () => {
    if (!hapticsAllowed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {
      // Soft was added in expo-haptics 13. On older runtimes, fall back to Light.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    });
  },
  /**
   * Rigid impact — for "snap into place" moments (modal docking, slider tick).
   * Distinct from `tap` because it's not a touch-confirmation — it's an
   * outcome-confirmation.
   */
  snap: () => {
    if (!hapticsAllowed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    });
  },
} as const;

export type HapticKind = keyof typeof haptic;

/**
 * Cascading celebration — fires `success` then a soft `tap` ~180ms later.
 * Apple Pay / iMessage send pattern: the "double-tap" creates a sense of
 * milestone passing, useful for purchase / first-time-success moments.
 *
 * Returns a cleanup function so callers can cancel the second pulse if the
 * component unmounts before it fires (avoids a haptic on a screen the user
 * already navigated away from).
 */
export function celebrate(): () => void {
  haptic.success();
  const timer = setTimeout(() => haptic.tap(), 180);
  return () => clearTimeout(timer);
}

/**
 * Convenience: trigger a haptic by name, or skip if `false` is passed.
 * Used by AnimatedPressable to allow `haptic={false}`.
 */
export function fireHaptic(kind: HapticKind | false | undefined): void {
  if (!kind) return;
  haptic[kind]();
}
