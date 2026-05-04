import { describe, it, expect } from 'vitest';
import { isMaleModel, MASC_BODY_TYPES } from '../modelGender';

describe('isMaleModel', () => {
  it('honors explicit gender field first', () => {
    expect(isMaleModel({ gender: 'masculino', body_type: 'magra' })).toBe(true);
    expect(isMaleModel({ gender: 'feminino', body_type: 'atletico' })).toBe(false);
  });
  it('falls back to body_type when no gender', () => {
    expect(isMaleModel({ body_type: 'atletico' })).toBe(true);
    expect(isMaleModel({ body_type: 'medio' })).toBe(true);
    expect(isMaleModel({ body_type: 'masculino' })).toBe(true);
    expect(isMaleModel({ body_type: 'robusto' })).toBe(true);
    expect(isMaleModel({ body_type: 'magra' })).toBe(false);
    expect(isMaleModel({ body_type: 'plus_size' })).toBe(false);
  });
  it('returns false when neither field present', () => {
    expect(isMaleModel({})).toBe(false);
  });
  it('MASC_BODY_TYPES set has the documented 4 entries', () => {
    expect(MASC_BODY_TYPES.size).toBe(4);
    expect(MASC_BODY_TYPES.has('atletico')).toBe(true);
    expect(MASC_BODY_TYPES.has('robusto')).toBe(true);
  });
});
