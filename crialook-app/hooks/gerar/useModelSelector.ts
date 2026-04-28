/**
 * Why a hook?
 *  The model picker reads from two sources (/models/bank — the stock library —
 *  and /model/list — the user's custom models), merges them, applies a body-type
 *  filter, and tracks selection + preview state. Without isolation, this state
 *  pollutes the main screen and forces every render to reason about it.
 *
 *  This hook also handles the cache call (apiGetCached) once, so callers don't
 *  re-implement TTLs.
 */
import { useEffect, useMemo, useState } from 'react';
import { apiGetCached } from '@/lib/api';
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

export function useModelSelector(): UseModelSelectorResult {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string>('random');
  const [filter, setFilter] = useState<ModelFilter>('all');
  const [previewModel, setPreviewModel] = useState<ModelItem | null>(null);

  useEffect(() => {
    Promise.all([
      apiGetCached<{ models: ModelItem[] }>('/models/bank', 24 * 60 * 60_000)
        .catch(() => ({ models: [] })),
      apiGetCached<{ models: ModelItem[] }>('/model/list', 60_000)
        .catch(() => ({ models: [] })),
    ])
      .then(([bank, custom]) => {
        const stock = (bank.models || []).map(m => ({ ...m, is_custom: false }));
        const mine = (custom.models || []).map(m => ({
          ...m,
          image_url: m.photo_url || m.image_url,
          is_custom: true,
        }));
        setModels([...mine, ...stock]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredModels = useMemo(() => {
    const random: ModelItem = {
      id: RANDOM_ID,
      name: t('modelNames.random'),
      body_type: '',
    };
    const base = models.filter(m => matchesFilter(m.body_type, filter));
    return [random, ...base];
  }, [models, filter]);

  const isCustomSelection = useMemo(() => {
    if (selectedModelId === 'random') return false;
    return models.find(m => m.id === selectedModelId)?.is_custom ?? false;
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
