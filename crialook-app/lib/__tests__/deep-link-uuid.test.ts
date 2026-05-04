/**
 * deep-link-uuid.test.ts — locks in strict UUID validation for deep-link
 * campaignId routing (CONCERNS §7, CRIALOOK-PLAY-READINESS.md §5).
 *
 * The regex must be STRICT: any future "loosening" (allow non-hex chars
 * to support legacy IDs, drop hyphens for compactness, etc.) opens deep-
 * link injection / IDOR. These tests are the regression lock.
 */
import { describe, expect, it } from 'vitest';
import { UUID_REGEX, isValidCampaignId } from '@/lib/_layout-deep-link';

describe('deep-link UUID validation', () => {
  describe('valid UUIDs are accepted', () => {
    it('accepts a canonical lowercase UUID v4', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('accepts an uppercase UUID', () => {
      expect(isValidCampaignId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('accepts a mixed-case UUID', () => {
      expect(isValidCampaignId('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });

    it('accepts UUIDs of any version (regex is version-agnostic, matches our use case)', () => {
      // v1 (time-based)
      expect(isValidCampaignId('c232ab00-9414-11ec-b3c8-9e6bdeced846')).toBe(true);
      // v7 (sortable, recent draft)
      expect(isValidCampaignId('018e4f30-7c3a-7000-8123-456789abcdef')).toBe(true);
    });
  });

  describe('malformed UUIDs are rejected', () => {
    it('rejects a UUID missing a hyphen', () => {
      expect(isValidCampaignId('550e8400e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('rejects a UUID with extra hyphens', () => {
      expect(isValidCampaignId('550e-8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('rejects a UUID one character too short', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
    });

    it('rejects a UUID one character too long', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-4466554400000')).toBe(false);
    });

    it('rejects a UUID with non-hex characters', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-44665544000Z')).toBe(false);
    });

    it('rejects a UUID with leading whitespace', () => {
      expect(isValidCampaignId(' 550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('rejects a UUID with trailing whitespace', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000 ')).toBe(false);
    });
  });

  describe('attack-shaped inputs are rejected', () => {
    it('rejects a path-traversal attempt', () => {
      expect(isValidCampaignId('../../../../etc/passwd')).toBe(false);
    });

    it('rejects a SQL-injection-shaped string', () => {
      expect(isValidCampaignId("' OR '1'='1")).toBe(false);
    });

    it('rejects a JS injection attempt', () => {
      expect(isValidCampaignId('<script>alert(1)</script>')).toBe(false);
    });

    it('rejects a UUID with a query string appended', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000?evil=1')).toBe(false);
    });

    it('rejects a UUID with a fragment appended', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000#evil')).toBe(false);
    });

    it('rejects a UUID with appended path segments', () => {
      expect(isValidCampaignId('550e8400-e29b-41d4-a716-446655440000/admin')).toBe(false);
    });
  });

  describe('non-string types are rejected', () => {
    it('rejects undefined', () => {
      expect(isValidCampaignId(undefined)).toBe(false);
    });

    it('rejects null', () => {
      expect(isValidCampaignId(null)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidCampaignId('')).toBe(false);
    });

    it('rejects a number', () => {
      expect(isValidCampaignId(550840029)).toBe(false);
    });

    it('rejects an object', () => {
      expect(isValidCampaignId({ id: '550e8400-e29b-41d4-a716-446655440000' })).toBe(false);
    });

    it('rejects an array', () => {
      expect(isValidCampaignId(['550e8400-e29b-41d4-a716-446655440000'])).toBe(false);
    });
  });

  describe('UUID_REGEX export sanity', () => {
    it('UUID_REGEX is a RegExp instance', () => {
      expect(UUID_REGEX).toBeInstanceOf(RegExp);
    });

    it('UUID_REGEX is anchored at both ends (^ and $) to prevent partial matches', () => {
      expect(UUID_REGEX.source).toMatch(/^\^/);
      expect(UUID_REGEX.source).toMatch(/\$$/);
    });
  });
});
