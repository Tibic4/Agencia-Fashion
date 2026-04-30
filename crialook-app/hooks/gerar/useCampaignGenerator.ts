/**
 * Why a hook?
 *  The "submit campaign" flow is the most complex piece of state in the app:
 *    - assemble FormData from photos + form fields + model choice
 *    - send with auth token
 *    - parse response: success, quota exceeded, business error, network error
 *    - poll until done, mapping terminal states to UI feedback
 *  Pulling it into a hook gives the screen a clean API:
 *    const gen = useCampaignGenerator({ onComplete: id => router.push(...) });
 *    gen.submit(formInputs);  // and read gen.isGenerating, gen.error, gen.quota
 *
 *  The hook owns the polling lifecycle internally so the screen never sees
 *  intervals or AppState listeners.
 */
import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth';
import { invalidateApiCache } from '@/lib/api';
import { buildFormDataFile, type CompressedAsset } from '@/lib/images';
import { logger } from '@/lib/logger';
import { withSpan } from '@/lib/sentry';
import { t, getLocale } from '@/lib/i18n';
import { qk } from '@/lib/query-client';
import type { ModelItem, QuotaData } from '@/types';
import { useCampaignPolling } from './useCampaignPolling';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

function errorMessageFor(code: string): string {
  switch (code) {
    case 'RATE_LIMITED': return t('errors.rateLimited');
    case 'MODEL_OVERLOADED': return t('errors.modelOverloaded');
    case 'SAFETY_BLOCKED': return t('errors.safetyBlocked');
    case 'IMAGE_GENERATION_BLOCKED': return t('errors.imageGenBlocked');
    case 'BAD_REQUEST': return t('errors.badRequest');
    case 'TIMEOUT': return t('errors.timeout');
    default: return '';
  }
}

export interface CampaignInputs {
  mainPhoto: CompressedAsset;
  closeUpPhoto?: CompressedAsset | null;
  secondPhoto?: CompressedAsset | null;
  campaignTitle?: string;
  price?: string;
  audience?: string;
  tone?: string;
  background: string;
  modelFilter: string;
  selectedModelId: string;
  models: ModelItem[];
}

interface UseCampaignGeneratorOptions {
  onComplete: (campaignId: string) => void;
}

interface UseCampaignGeneratorResult {
  isGenerating: boolean;
  generationComplete: boolean;
  error: string | null;
  quotaExceeded: QuotaData | null;
  campaignId: string | null;
  submit: (inputs: CampaignInputs) => Promise<void>;
  /** Aciona o mesmo modal de quota sem fazer request — usado em pré-flight
   *  quando o cliente já sabe (via /store/usage) que não tem cota. Evita
   *  cobrar o usuário com upload de fotos só pra receber 402/QUOTA_EXCEEDED. */
  simulateQuotaExceeded: (data: QuotaData) => void;
  viewResults: () => void;
  dismissError: () => void;
  dismissQuota: () => void;
  reset: () => void;
}

export function useCampaignGenerator({
  onComplete,
}: UseCampaignGeneratorOptions): UseCampaignGeneratorResult {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaData | null>(null);

  const polling = useCampaignPolling({
    onStatus: status => {
      switch (status.kind) {
        case 'completed':
          setGenerationComplete(true);
          // Refetch (not just invalidate) the campaign list so the cache
          // contains the freshly-completed campaign even if the user is on
          // /gerar and never goes to /historico. Without this the unseen-
          // generations badge in the tab bar can't surface anything new
          // — it reads from this exact cache key.
          //
          // refetchQueries instead of invalidateQueries because the historico
          // observer normally has refetch-on-stale, but if it isn't mounted
          // (user is on /gerar) invalidate alone won't pull fresh data —
          // the badge subscriber sits behind `enabled: false`.
          queryClient
            .refetchQueries({ queryKey: qk.campaigns.list() })
            .catch(() => {});
          queryClient.invalidateQueries({ queryKey: qk.store.usage() });
          break;
        case 'failed':
          setIsGenerating(false);
          setError(t('errors.generationFailed'));
          break;
        case 'timeout':
          setIsGenerating(false);
          setError(t('errors.generationTimeout'));
          break;
      }
    },
  });

  const reset = useCallback(() => {
    setIsGenerating(false);
    setGenerationComplete(false);
    setCampaignId(null);
    setError(null);
    setQuotaExceeded(null);
    polling.stop();
  }, [polling]);

  const submit = useCallback(
    async (inputs: CampaignInputs) => {
      setIsGenerating(true);
      setGenerationComplete(false);
      setError(null);
      setCampaignId(null);

      // Wrap the whole submit in a Sentry span so we can see, per release,
      // p50/p95 latency from the moment users tap "Gerar" until the campaign
      // ID comes back. The polling loop runs separately and isn't included.
      try {
        await withSpan('campaign.submit', 'campaign.generate', async () => {
          const token = await getAuthToken();

          const formData = new FormData();
          formData.append('image', buildFormDataFile(inputs.mainPhoto) as any);
          if (inputs.closeUpPhoto) {
            formData.append('closeUpImage', buildFormDataFile(inputs.closeUpPhoto) as any);
          }
          if (inputs.secondPhoto) {
            formData.append('secondImage', buildFormDataFile(inputs.secondPhoto) as any);
          }

          if (inputs.price) formData.append('price', inputs.price);
          if (inputs.campaignTitle?.trim()) {
            formData.append('title', inputs.campaignTitle.trim());
          }
          if (inputs.audience) formData.append('targetAudience', inputs.audience);
          if (inputs.tone) formData.append('toneOverride', inputs.tone);
          formData.append('backgroundType', inputs.background);
          if (inputs.modelFilter !== 'all') {
            formData.append('bodyType', inputs.modelFilter);
          }

          if (inputs.selectedModelId !== 'random') {
            const model = inputs.models.find(m => m.id === inputs.selectedModelId);
            if (model?.is_custom) formData.append('customModelId', inputs.selectedModelId);
            else formData.append('modelBankId', inputs.selectedModelId);
          }

          // Why: this fetch bypasses the `api()` wrapper (FormData + custom
          // response handling), so we mirror the wrapper's locale header
          // here to keep Sonnet copy in sync with the UI language.
          // Idempotency-Key: UUID gerado client-side. Se a rede cair no meio
          // do POST e o cliente reenviar, o backend pode deduplicar via essa
          // chave. Backend ainda precisa implementar; enviar o header já
          // permite que ele assuma a feature sem mudar o contrato.
          const idempotencyKey = Crypto.randomUUID();
          const headers: Record<string, string> = {
            'X-App-Locale': getLocale(),
            'Idempotency-Key': idempotencyKey,
          };
          if (token) headers.Authorization = `Bearer ${token}`;

          const res = await fetch(`${BASE_URL}/campaign/generate`, {
            method: 'POST',
            body: formData,
            headers,
          });

          const resText = await res.text();
          let data: any = null;
          try {
            data = JSON.parse(resText);
          } catch {
            /* non-JSON */
          }

          if (data?.code === 'QUOTA_EXCEEDED') {
            setIsGenerating(false);
            setQuotaExceeded({
              used: data.used || 0,
              limit: data.limit || 0,
              credits: data.credits || 0,
            });
            return;
          }

          if (data && !res.ok) {
            setIsGenerating(false);
            const code = data.code || '';
            setError(errorMessageFor(code) || data.error || `Erro ${res.status}`);
            return;
          }

          const id =
            data?.campaignId ||
            resText.match(/"campaignId"\s*:\s*"([^"]+)"/)?.[1] ||
            null;

          if (!id) {
            setIsGenerating(false);
            setError(t('errors.generationFailed'));
            return;
          }

          setCampaignId(id);
          invalidateApiCache('/campaigns').catch(() => {});
          invalidateApiCache('/store/usage').catch(() => {});
          polling.start(id);
        });
      } catch (e: any) {
        logger.warn('campaign submit failed', { message: e?.message });
        setIsGenerating(false);
        setError(e?.message || t('errors.network'));
      }
    },
    [polling],
  );

  const viewResults = useCallback(() => {
    if (!campaignId) return;
    setIsGenerating(false);
    setGenerationComplete(false);
    onComplete(campaignId);
  }, [campaignId, onComplete]);

  const simulateQuotaExceeded = useCallback((data: QuotaData) => {
    setQuotaExceeded(data);
  }, []);

  return {
    isGenerating,
    generationComplete,
    error,
    quotaExceeded,
    campaignId,
    submit,
    simulateQuotaExceeded,
    viewResults,
    dismissError: () => setError(null),
    dismissQuota: () => setQuotaExceeded(null),
    reset,
  };
}
