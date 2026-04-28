/**
 * Validates that the strings tree shape matches between locales and that
 * interpolation placeholders survive translation. We don't load the full
 * lib/i18n module here (it pulls expo-localization, which needs native
 * runtime); we run the dictionaries through a minimal i18n-js instance.
 */
import { I18n } from 'i18n-js';
import { describe, expect, it } from 'vitest';
import { ptBR, en } from '../i18n/strings';

const i18n = new I18n({ 'pt-BR': ptBR, en });
i18n.enableFallback = true;
i18n.defaultLocale = 'pt-BR';

describe('i18n strings', () => {
  it('has matching key sets in both locales', () => {
    function flatten(o: any, prefix = ''): string[] {
      const keys: string[] = [];
      for (const [k, v] of Object.entries(o)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null) keys.push(...flatten(v, path));
        else keys.push(path);
      }
      return keys.sort();
    }
    expect(flatten(ptBR)).toEqual(flatten(en));
  });

  it('looks up nested keys in both locales', () => {
    i18n.locale = 'pt-BR';
    expect(i18n.t('common.save')).toBe('Salvar');
    expect(i18n.t('plan.title')).toBe('Meu Plano');

    i18n.locale = 'en';
    expect(i18n.t('common.save')).toBe('Save');
    expect(i18n.t('plan.title')).toBe('My plan');
  });

  it('interpolates placeholders', () => {
    i18n.locale = 'pt-BR';
    expect(i18n.t('plan.subscribeButton', { plan: 'Pro' })).toBe('Assinar Pro');
    expect(i18n.t('history.countOther', { n: 5 })).toBe('5 campanhas');

    i18n.locale = 'en';
    expect(i18n.t('plan.subscribeButton', { plan: 'Pro' })).toBe('Subscribe to Pro');
    expect(i18n.t('history.countOther', { n: 5 })).toBe('5 campaigns');
  });
});
