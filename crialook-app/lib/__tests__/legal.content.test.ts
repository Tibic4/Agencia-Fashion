import { describe, it, expect } from 'vitest';
import {
  SITE_BASE,
  termos,
  privacidade,
  dpo,
  subprocessadores,
  consentimentoBiometrico,
} from '../legal/content';

const all = { termos, privacidade, dpo, subprocessadores, consentimentoBiometrico };

describe('legal/content exports', () => {
  it('SITE_BASE points to crialook.com.br', () => {
    expect(SITE_BASE).toBe('https://crialook.com.br');
  });

  it('every export has a non-empty title + subtitle + lastUpdated + siteSlug', () => {
    for (const [name, page] of Object.entries(all)) {
      expect(typeof page.title, name).toBe('string');
      expect(page.title.length, `${name}.title`).toBeGreaterThan(0);
      expect(typeof page.subtitle, name).toBe('string');
      expect(page.subtitle.length, `${name}.subtitle`).toBeGreaterThan(0);
      expect(typeof page.lastUpdated, name).toBe('string');
      expect(typeof page.siteSlug, name).toBe('string');
      expect(page.siteSlug.length, `${name}.siteSlug`).toBeGreaterThan(0);
    }
  });

  it('siteSlug values are URL-safe (no leading slash, no spaces)', () => {
    for (const [name, page] of Object.entries(all)) {
      expect(page.siteSlug).not.toMatch(/^\//);
      expect(page.siteSlug, `${name}.siteSlug`).not.toMatch(/\s/);
    }
  });

  it('blocks array is non-empty and uses only known block types', () => {
    const knownTypes = new Set(['heading', 'paragraph', 'list', 'link', 'kicker', 'spacer']);
    for (const [name, page] of Object.entries(all)) {
      expect(Array.isArray(page.blocks), `${name}.blocks`).toBe(true);
      expect(page.blocks.length, `${name}.blocks`).toBeGreaterThan(0);
      for (const block of page.blocks) {
        expect(knownTypes.has((block as { type: string }).type)).toBe(true);
      }
    }
  });

  it('list blocks have a non-empty items array', () => {
    for (const page of Object.values(all)) {
      for (const block of page.blocks) {
        if ((block as { type: string }).type === 'list') {
          const items = (block as { items: string[] }).items;
          expect(Array.isArray(items)).toBe(true);
          expect(items.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all 5 mandatory legal pages exist (termos, privacidade, dpo, subprocessadores, consentimentoBiometrico)', () => {
    expect(Object.keys(all).sort()).toEqual(
      ['consentimentoBiometrico', 'dpo', 'privacidade', 'subprocessadores', 'termos'].sort(),
    );
  });
});
