import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

async function getStores() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, clerk_user_id, name, segment_primary, onboarding_completed, created_at, plans!stores_plan_id_fkey(display_name), store_usage!store_usage_store_id_fkey(campaigns_generated, campaigns_limit, period_start, period_end)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) console.error("Error fetching stores:", error);
  return data ?? [];
}

export default async function AdminClientes() {
  const stores = await getStores();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 mt-1">{stores.length} lojas cadastradas</p>
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
          Nenhum cliente cadastrado ainda
        </div>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="md:hidden space-y-3">
            {stores.map((store: Record<string, unknown>) => {
              const usage = Array.isArray(store.store_usage) ? store.store_usage[0] : store.store_usage;
              const plan = store.plans as Record<string, string> | null;
              return (
                <Link
                  key={store.id as string}
                  href={`/admin/clientes/${store.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(store.name as string)?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{store.name as string}</p>
                      <p className="text-[11px] text-gray-500">{store.segment_primary as string || "Sem segmento"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${store.onboarding_completed ? "text-emerald-400" : "text-yellow-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${store.onboarding_completed ? "bg-emerald-400" : "bg-yellow-400"}`} />
                      {store.onboarding_completed ? "Ativo" : "Onboarding"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                      {plan?.display_name || "Sem plano"}
                    </span>
                    <span className="text-gray-400">
                      {usage ? `${(usage as Record<string, number>).campaigns_generated}/${(usage as Record<string, number>).campaigns_limit} campanhas` : "0/0"}
                    </span>
                    <span className="text-gray-600 ml-auto">
                      {new Date(store.created_at as string).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Loja</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Segmento</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Plano</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Uso</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {stores.map((store: Record<string, unknown>) => {
                    const usage = Array.isArray(store.store_usage) ? store.store_usage[0] : store.store_usage;
                    const plan = store.plans as Record<string, string> | null;
                    return (
                      <tr key={store.id as string} className="hover:bg-gray-800/30 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {(store.name as string)?.charAt(0)?.toUpperCase()}
                            </div>
                            <Link href={`/admin/clientes/${store.id}`} className="text-white font-medium hover:text-amber-400 transition">
                              {store.name as string}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{store.segment_primary as string || "—"}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {plan?.display_name || "Sem plano"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {usage ? `${(usage as Record<string, number>).campaigns_generated}/${(usage as Record<string, number>).campaigns_limit}` : "0/0"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-xs ${store.onboarding_completed ? "text-emerald-400" : "text-yellow-400"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${store.onboarding_completed ? "bg-emerald-400" : "bg-yellow-400"}`} />
                            {store.onboarding_completed ? "Ativo" : "Onboarding"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {new Date(store.created_at as string).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
