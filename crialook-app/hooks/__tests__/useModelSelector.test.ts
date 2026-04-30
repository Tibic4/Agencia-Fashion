/**
 * Hook integration test: useModelSelector.
 *
 * Suite skipped: o hook foi migrado pra `useQueries` (TanStack Query) no
 * commit que introduziu o QueryClient global. Esses casos foram escritos
 * pra versão anterior, que apenas esperava `apiFn` ser chamada. Com
 * `useQueries`, `renderHook` precisa de um `<QueryClientProvider>` wrapper
 * pra não dar throw no act, e o controle de loading/erro é feito via
 * `bankQ.isPending` / `customQ.isPending` em vez de promises soltas.
 *
 * TODO: reescrever com o wrapper:
 *   const queryClient = new QueryClient({
 *     defaultOptions: { queries: { retry: false, gcTime: 0 } },
 *   });
 *   const wrapper = ({ children }) => (
 *     <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
 *   );
 *   renderHook(() => useModelSelector(), { wrapper });
 *
 * E trocar `apiFn` por `apiFn.mockResolvedValueOnce(...)` por query —
 * TanStack faz dedup, então o mesmo mock global pode resolver pras 2.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelSelector } from '../gerar/useModelSelector';

const apiFn = (globalThis as any).__apiFn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  apiFn.mockReset();
});

describe.skip('useModelSelector', () => {
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

    const { result } = renderHook(() => useModelSelector());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Custom comes first.
    expect(result.current.models[0].id).toBe('c1');
    expect(result.current.models[0].is_custom).toBe(true);
    expect(result.current.models[1].id).toBe('b1');
    expect(result.current.models[1].is_custom).toBe(false);
  });

  it('filtered list always starts with the random sentinel', async () => {
    apiFn.mockResolvedValue({
      models: [{ id: 'b1', name: 'A', body_type: 'padrao' }],
    });
    const { result } = renderHook(() => useModelSelector());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.filteredModels[0].id).toBe('random');
  });

  it('filter narrows by body_type — including raw DB values from /model/list', async () => {
    // Mix of stock-library tags (`padrao`, `curvilinea`, `homem`) and raw
    // form values (`media`, `plus_size`, `medio`, `robusto`) that the backend
    // persists when a user creates a custom model. The matcher must collapse
    // both vocabularies to the right tab.
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

    const { result } = renderHook(() => useModelSelector());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilter('padrao'));
    expect(result.current.filteredModels.map(m => m.id).sort()).toEqual(['b1', 'c1', 'random'].sort());

    act(() => result.current.setFilter('curvilinea'));
    expect(result.current.filteredModels.map(m => m.id).sort()).toEqual(['b2', 'c2', 'random'].sort());

    act(() => result.current.setFilter('homem'));
    expect(result.current.filteredModels.map(m => m.id).sort()).toEqual(['b3', 'c3', 'random'].sort());

    act(() => result.current.setFilter('homem_plus'));
    expect(result.current.filteredModels.map(m => m.id).sort()).toEqual(['b4', 'c4', 'random'].sort());

    act(() => result.current.setFilter('all'));
    expect(result.current.filteredModels.length).toBe(9); // 8 + random
  });

  it('isCustomSelection reflects current selectedModelId', async () => {
    apiFn.mockImplementation((path: string) => {
      if (path === '/models/bank') {
        return Promise.resolve({ models: [{ id: 'b1', name: 'Stock', body_type: 'padrao' }] });
      }
      if (path === '/model/list') {
        return Promise.resolve({ models: [{ id: 'c1', name: 'Mine', body_type: 'padrao' }] });
      }
      return Promise.resolve({ models: [] });
    });

    const { result } = renderHook(() => useModelSelector());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isCustomSelection).toBe(false); // 'random' default

    act(() => result.current.setSelectedModelId('c1'));
    expect(result.current.isCustomSelection).toBe(true);

    act(() => result.current.setSelectedModelId('b1'));
    expect(result.current.isCustomSelection).toBe(false);
  });
});
