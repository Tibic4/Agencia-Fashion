/**
 * Why a hook?
 *  The model picker reads from two sources (/models/bank — the stock library —
 *  and /model/list — the user's custom models), merges them, applies a body-type
 *  filter, and tracks selection + preview state. Without isolation, this state
 *  pollutes the main screen and forces every render to reason about it.
 *
 *  This version uses TanStack Query under the hood:
 *    - `useQueries` runs both reads concurrently and exposes their state.
 *    - The bank list has a 24h staleTime (the stock library rarely changes);
 *      the user list has 60s (paritário com o site /model/list).
 *    - Both queries share the QueryClient with /modelo + /gerar, so when the
 *      user creates / deletes a model on the modelo screen, that screen calls
 *      `invalidateQueries({ queryKey: qk.store.models() })` and the picker
 *      here updates without a manual refetch.
 */
import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { qk } from '@/lib/query-client';
import { t } from '@/lib/i18n';
import type { ModelItem } from '@/types';

// Sentinel "random" entry. Name is resolved at filteredModels time so locale
// switches re-translate without remounting the screen.
const RANDOM_ID = 'random';

export type ModelFilter = 'all' | 'padrao' | 'curvilinea' | 'homem' | 'homem_plus';

/**
 * Maps the UI filter tabs to the heterogeneous `body_type` values stored on
 * each model source: stock library uses `padrao|curvilinea|homem|homem_plus`
 * (or older `normal|plus|masculino`), while user-created models persist the
 * raw form values (`media|medio|plus_size|robusto|magra|atletico`). Without
 * this map the filter only matched stock entries, so the mobile screen
 * appeared to "only work on Todos".
 */
function matchesFilter(bodyType: string | undefined, filter: ModelFilter): boolean {
  if (filter === 'all') return true;
  const v = (bodyType || '').toLowerCase();
  if (filter === 'padrao') return ['padrao', 'normal', 'media', 'magra'].includes(v);
  if (filter === 'curvilinea') return ['curvilinea', 'plus', 'plus_size'].includes(v);
  if (filter === 'homem') return ['homem', 'masculino', 'medio', 'atletico'].includes(v);
  if (filter === 'homem_plus') return ['homem_plus', 'robusto'].includes(v);
  return v === filter;
}

interface UseModelSelectorResult {
  models: ModelItem[];
  filteredModels: ModelItem[];
  loading: boolean;
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  filter: ModelFilter;
  setFilter: (f: ModelFilter) => void;
  previewModel: ModelItem | null;
  setPreviewModel: (m: ModelItem | null) => void;
  /** Whether the chosen model is one the user created (vs stock library). */
  isCustomSelection: boolean;
}

const BANK_KEY = ['models', 'bank'] as const;

export function useModelSelector(): UseModelSelectorResult {
  const [selectedModelId, setSelectedModelId] = useState<string>('random');
  const [filter, setFilter] = useState<ModelFilter>('all');
  const [previewModel, setPreviewModel] = useState<ModelItem | null>(null);

  const [bankQ, customQ] = useQueries({
    queries: [
      {
        queryKey: BANK_KEY,
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          apiGet<{ models: ModelItem[] }>('/models/bank', { signal }),
        // Stock library is effectively static during a session.
        staleTime: 24 * 60 * 60_000,
        retry: 1,
      },
      {
        queryKey: qk.store.models(),
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          apiGet<{ models: ModelItem[] }>('/model/list', { signal }),
        staleTime: 60_000,
      },
    ],
  });

  // Either query may fail; we still want to render whatever loaded. Old
  // behaviour: `.catch(() => ({ models: [] }))` swallowed errors silently.
  const models = useMemo(() => {
    const stock = (bankQ.data?.models ?? []).map((m) => ({ ...m, is_custom: false }));
    const mine = (customQ.data?.models ?? []).map((m) => ({
      ...m,
      image_url: m.photo_url || m.image_url,
      is_custom: true,
    }));
    return [...mine, ...stock];
  }, [bankQ.data, customQ.data]);

  const loading = bankQ.isPending || customQ.isPending;

  const filteredModels = useMemo(() => {
    const random: ModelItem = {
      id: RANDOM_ID,
      name: t('modelNames.random'),
      body_type: '',
    };
    const base = models.filter((m) => matchesFilter(m.body_type, filter));
    return [random, ...base];
  }, [models, filter]);

  const isCustomSelection = useMemo(() => {
    if (selectedModelId === 'random') return false;
    return models.find((m) => m.id === selectedModelId)?.is_custom ?? false;
  }, [models, selectedModelId]);

  return {
    models,
    filteredModels,
    loading,
    selectedModelId,
    setSelectedModelId,
    filter,
    setFilter,
    previewModel,
    setPreviewModel,
    isCustomSelection,
  };
}
