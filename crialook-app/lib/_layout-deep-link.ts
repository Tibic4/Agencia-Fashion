/**
 * Deep-link UUID validation extracted from app/_layout.tsx so the validator
 * is testable in isolation (without dragging in initSentry, initLocale,
 * react-native-* native modules etc. that the layout module side-effects).
 *
 * Used by:
 *   - app/_layout.tsx — validates `campaignId` from incoming deep links
 *     before navigating to /campaign/[id].
 *
 * Why strict UUID regex: prevents arbitrary route injection
 * (`crialook://campaign/../../../../etc/passwd` style) AND ensures the
 * downstream `apiGet('/campaigns/${id}')` doesn't pass a malformed id to
 * the backend (the backend would reject it but failing fast at the entry
 * point is cheaper).
 */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCampaignId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
