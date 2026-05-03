/**
 * Hook integration test: useModelSelector.
 *
 * Por que .tsx: precisa do <QueryClientProvider> wrapper.
 *
 * Por que mockar @/lib/query-client e @/lib/i18n: o módulo real importa
 * react-native-mmkv + expo-constants em runtime — em jsdom isso explode com
 * "Unexpected token 'typeof'". A gente só precisa de `qk.store.models()` pra
 * keys de query, então o stub abaixo basta.
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/query-client', () => ({
  qk: {
    store: {
      models: () => ['store', 'models'] as const,
    },
  },
}));

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => (key === 'modelNames.random' ? 'Aleatório' : key),
}));

import { useModelSelector } from '../gerar/useModelSelector';

const apiFn = (globalThis as any).__apiFn as ReturnType<typeof vi.fn>;

function makeWrapper() {
  // Cliente novo por teste — gcTime 0 + retry false evitam que estado
  // de teste anterior (cache, retries pendentes) atravesse fronteiras.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return Wrapper;
}

beforeEach(() => {
  apiFn.mockReset();
});

describe('useModelSelector', () => {
  it('merges bank + custom models (custom first) and exposes loading', async () => {
    apiFn.mockImplementation((path: string) => {
      if (path === '/models/bank') {
        return Promise.resolve({
          models: [{ id: 'b1', name: 'Stock Ana', body_type: 'padrao' }],
        });
      }
      if (path === '/model/list') {
        return Promise.resolve({
          models: [{ id: 'c1', name: 'My Model', body_type: 'curvilinea', photo_url: 'x' }],
        });
      }
      return Promise.resolve({ models: [] });
    });

    const { result } = renderHook(() => useModelSelector(), { wrapper: makeWrapper() });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Custom comes first.
    expect(result.current.models[0].id).toBe('c1');
    expect(result.current.models[0].is_custom).toBe(true);
    expect(result.current.models[1].id).toBe('b1');
    expect(result.current.models[1].is_custom).toBe(false);

    // Custom mapeia photo_url → image_url (compatibilidade entre fontes).
    expect(result.current.models[0].image_url).toBe('x');
  });

  it('filtered list always starts with the random sentinel', async () => {
    apiFn.mockResolvedValue({
      models: [{ id: 'b1', name: 'A', body_type: 'padrao' }],
    });
    const { result } = renderHook(() => useModelSelector(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.filteredModels[0].id).toBe('random');
    expect(result.current.filteredModels[0].name).toBe('Aleatório');
  });

  it('filter narrows by body_type — including raw DB values from /model/list', async () => {
    // Mix de tags do stock-library (`padrao`, `curvilinea`, `homem`,
    // `homem_plus`) com valores raw do form (`media`, `plus_size`, `medio`,
    // `robusto`) que o backend persiste pra modelos custom. O matcher tem
    // que colapsar os dois vocabulários no tab certo.
    apiFn.mockImplementation((path: string) => {
      if (path === '/models/bank') {
        return Promise.resolve({
          models: [
            { id: 'b1', name: 'Padrao Stock', body_type: 'padrao' },
            { id: 'b2', name: 'Curvy Stock', body_type: 'curvilinea' },
            { id: 'b3', name: 'Homem Stock', body_type: 'homem' },
            { id: 'b4', name: 'Homem Plus Stock', body_type: 'homem_plus' },
          ],
        });
      }
      if (path === '/model/list') {
        return Promise.resolve({
          models: [
            { id: 'c1', name: 'Custom Mulher', body_type: 'media' },
            { id: 'c2', name: 'Custom Plus', body_type: 'plus_size' },
            { id: 'c3', name: 'Custom Homem', body_type: 'medio' },
            { id: 'c4', name: 'Custom Homem Plus', body_type: 'robusto' },
          ],
        });
      }
      return Promise.resolve({ models: [] });
    });

    const { result } = renderHook(() => useModelSelector(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilter('padrao'));
    expect(result.current.filteredModels.map((m) => m.id).sort()).toEqual(
      ['b1', 'c1', 'random'].sort(),
    );

    act(() => result.current.setFilter('curvilinea'));
    expect(result.current.filteredModels.map((m) => m.id).sort()).toEqual(
      ['b2', 'c2', 'random'].sort(),
    );

    act(() => result.current.setFilter('homem'));
    expect(result.current.filteredModels.map((m) => m.id).sort()).toEqual(
      ['b3', 'c3', 'random'].sort(),
    );

    act(() => result.current.setFilter('homem_plus'));
    expect(result.current.filteredModels.map((m) => m.id).sort()).toEqual(
      ['b4', 'c4', 'random'].sort(),
    );

    act(() => result.current.setFilter('all'));
    expect(result.current.filteredModels.length).toBe(9); // 8 modelos + sentinel
  });

  it('isCustomSelection reflects current selectedModelId', async () => {
    apiFn.mockImplementation((path: string) => {
      if (path === '/models/bank') {
        return Promise.resolve({
          models: [{ id: 'b1', name: 'Stock', body_type: 'padrao' }],
        });
      }
      if (path === '/model/list') {
        return Promise.resolve({
          models: [{ id: 'c1', name: 'Mine', body_type: 'padrao' }],
        });
      }
      return Promise.resolve({ models: [] });
    });

    const { result } = renderHook(() => useModelSelector(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isCustomSelection).toBe(false); // default 'random'

    act(() => result.current.setSelectedModelId('c1'));
    expect(result.current.isCustomSelection).toBe(true);

    act(() => result.current.setSelectedModelId('b1'));
    expect(result.current.isCustomSelection).toBe(false);
  });

  it('survives a /model/list failure (renders bank-only)', async () => {
    apiFn.mockImplementation((path: string) => {
      if (path === '/models/bank') {
        return Promise.resolve({
          models: [{ id: 'b1', name: 'Stock', body_type: 'padrao' }],
        });
      }
      return Promise.reject(new Error('network'));
    });

    const { result } = renderHook(() => useModelSelector(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Bank carregou; custom falhou silenciosamente. Antes do refactor pra
    // useQueries, um `.catch(() => ({ models: [] }))` global escondia isso —
    // hoje o erro fica em `customQ.error`. Mesmo com erro, o picker tem que
    // renderizar o que tem (bank), pra UX não travar quando só uma das duas
    // fontes fica indisponível.
    expect(result.current.models.map((m) => m.id)).toEqual(['b1']);
  });
});
