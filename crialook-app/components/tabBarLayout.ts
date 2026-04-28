/**
 * Shared layout constants for the floating tab bar.
 *
 * The tab bar is rendered as a glass pill that hovers above the system
 * gesture bar. Floating CTAs on individual screens (e.g. "Gerar") need to
 * sit *above* this pill, with a clean gap, on every device — including
 * gesture-bar phones (Galaxy S22, Pixel 7) where `insets.bottom` is non-zero.
 *
 * Centralising the math here avoids drift between the bar and the CTAs.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Visual height of the pill (44 icon + 8+8 vertical padding). */
export const TAB_BAR_HEIGHT = 60;
/** Gap between the bottom safe-area edge and the tab bar pill. */
export const TAB_BAR_BOTTOM_GAP = 12;
/** Extra breathing room between the tab bar top edge and a floating CTA. */
export const TAB_BAR_CTA_GAP = 12;

/**
 * Y-offset (px from the bottom of the window) at which the tab bar pill is
 * rendered. Honours the OS gesture-bar inset.
 */
export function useTabBarBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + TAB_BAR_BOTTOM_GAP;
}

/**
 * Total bottom space a floating CTA must clear so it sits above the tab bar
 * (and therefore the OS nav bar) on any device.
 */
export function useFloatingCtaBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + TAB_BAR_CTA_GAP;
}

/**
 * `paddingBottom` value for ScrollView content on tab screens that don't have
 * their own floating CTA — keeps the last row of content from disappearing
 * underneath the tab bar pill on every device.
 */
export function useTabContentPaddingBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + 24;
}
