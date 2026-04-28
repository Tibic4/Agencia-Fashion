"use client";

/**
 * useStoreUsage — context provider + hook pra `/api/store/usage`.
 *
 * Antes, layout `(auth)`, `/gerar` e `/plano` cada um chamava
 * `/api/store/usage` no mount → ~3 round-trips duplicados, 200-500ms cada,
 * todos pra mesma resposta. Agora um único Provider posicionado no
 * `(auth)/layout.tsx` faz 1 fetch que todos consomem via hook. `refresh()`
 * é exposto pra ações que mudam quota (ex: pós-pagamento).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

export interface StoreUsage {
  campaigns_generated: number;
  campaigns_limit: number;
  // Permissivo — campos extras que o /api/store/usage retorna passam por aqui.
  [key: string]: unknown;
}

interface StoreUsageContextValue {
  usage: StoreUsage | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const StoreUsageContext = createContext<StoreUsageContextValue | null>(null);

export function StoreUsageProvider({ children }: PropsWithChildren) {
  const [usage, setUsage] = useState<StoreUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/store/usage", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.data) setUsage(data.data as StoreUsage);
      }
    } catch {
      // silencioso — fica em loading=false e null. Consumidores tratam.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <StoreUsageContext.Provider value={{ usage, loading, refresh }}>
      {children}
    </StoreUsageContext.Provider>
  );
}

export function useStoreUsage(): StoreUsageContextValue {
  const ctx = useContext(StoreUsageContext);
  // Fallback gracioso pra páginas fora do Provider (ex: durante refactor).
  // Retorna estado vazio em vez de throw — evita white-screen acidental.
  if (!ctx) {
    return {
      usage: null,
      loading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
