/**
 * Badge de "não vistas": conta quantas campanhas `completed` terminaram
 * desde a última vez que o usuário abriu /historico.
 *
 * Geração é async — usuário dispara em /gerar, vê o loading e quase sempre
 * sai pra outra tab enquanto o pipeline roda. Quando termina (push ou
 * resume depois), não há pista visual na tab bar. Badge Material 3 em
 * /historico dá o sinal nativo "tem coisa nova" que o usuário espera.
 *
 * Storage: 1 ISO timestamp no MMKV. Leitura síncrona, zero async tax no
 * render do layout. Limpa via `markHistoricoSeen()` quando /historico ganha
 * foco.
 *
 * Source of truth da contagem: cache da query `qk.campaigns.list`. Não
 * fazemos fetch — só lemos o que /historico já carregou. Se o usuário nunca
 * abriu /historico, nenhum count aparece.
 */
import { useSyncExternalStore } from 'react';
import { MMKV } from 'react-native-mmkv';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-client';
import type { Campaign } from '@/types';

const storage = new MMKV({ id: 'crialook-unseen' });
const KEY = 'historicoLastSeenIso';
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function getLastSeen(): string | null {
  return storage.getString(KEY) ?? null;
}

export function markHistoricoSeen(): void {
  storage.set(KEY, new Date().toISOString());
  notify();
}

function useLastSeen(): string | null {
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };
  return useSyncExternalStore(subscribe, getLastSeen, getLastSeen);
}

/**
 * Subscribe na query de campanhas sem refetch. Se /historico já populou o
 * cache, contamos a partir dele; senão a contagem é 0 (não incomoda quem
 * ainda não engajou com a feature).
 *
 * Cap em 99 pq o badge Material 3 só comporta 1-2 dígitos — acima disso
 * a plataforma renderiza "99+".
 */
export function useUnseenHistoricoCount(): number {
  const lastSeen = useLastSeen();
  const queryClient = useQueryClient();

  // Subscribe-only — não queremos esse hook disparando network request
  // do tab layout. Cache vazio → undefined → retorna 0.
  const { data } = useQuery({
    queryKey: qk.campaigns.list(),
    enabled: false,
    initialData: () =>
      queryClient.getQueryData<{ data: Campaign[] }>(qk.campaigns.list()),
  });

  const campaigns = data?.data ?? [];

  // Nunca abriu a tab → não mostra badge. Caso contrário, conta as
  // `completed` cujo `created_at` é mais recente que a última visita.
  if (!lastSeen) return 0;
  const lastMs = new Date(lastSeen).getTime();
  let n = 0;
  for (const c of campaigns) {
    if (c.status !== 'completed') continue;
    if (new Date(c.created_at).getTime() > lastMs) n++;
  }
  return Math.min(n, 99);
}
