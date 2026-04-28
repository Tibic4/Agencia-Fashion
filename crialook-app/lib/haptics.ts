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

export const haptic = {
  selection: () => {
    Haptics.selectionAsync().catch(() => {});
  },
  tap: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  press: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  confirm: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  },
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {},
    );
  },
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {},
    );
  },
} as const;

export type HapticKind = keyof typeof haptic;

/**
 * Convenience: trigger a haptic by name, or skip if `false` is passed.
 * Used by AnimatedPressable to allow `haptic={false}`.
 */
export function fireHaptic(kind: HapticKind | false | undefined): void {
  if (!kind) return;
  haptic[kind]();
}
