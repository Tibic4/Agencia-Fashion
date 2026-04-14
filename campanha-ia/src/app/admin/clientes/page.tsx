"use client";

import { useEffect, useState, useCallback } from "react";

interface StoreRow {
  id: string;
  name: string;
  segment_primary: string | null;
  onboarding_completed: boolean;
  created_at: string;
  plans: { display_name: string; campaigns_per_period?: number } | null;
  store_usage: {
    campaigns_generated: number;
    campaigns_limit: number;
    period_start: string | null;
    period_end: string | null;
  } | null;
}

interface StoreDetail extends StoreRow {
  credit_campaigns: number;
  credit_models: number;
  credit_regenerations: number;
  backdrop_ref_url: string | null;
  backdrop_color: string | null;
  backdrop_season: string | null;
  backdrop_updated_at: string | null;
  brand_color: string | null;
  logo_url: string | null;
  models_used: number;
}

function formatDateBR(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminClientes() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edit form state
  const [creditCampaigns, setCreditCampaigns] = useState(0);
  const [creditModels, setCreditModels] = useState(0);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Fetch stores
  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stores/list");
      if (!res.ok) {
        console.error("Erro ao carregar lojas:", res.status);
        return;
      }
      const json = await res.json();
      // Normalizar joins (Supabase retorna array)
      const normalized = (json.stores || []).map((s: Record<string, unknown>) => ({
        ...s,
        store_usage: Array.isArray(s.store_usage) ? s.store_usage[0] || null : s.store_usage,
        plans: Array.isArray(s.plans) ? s.plans[0] || null : s.plans,
      }));
      setStores(normalized);
    } catch (err) {
      console.error("Erro ao carregar lojas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  // Open modal
  const openModal = async (storeId: string) => {
    setModalOpen(true);
    setModalLoading(true);
    setDeleteConfirm(false);
    setDeleteTyped("");
    try {
      const res = await fetch(`/api/admin/stores?id=${storeId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(`❌ ${err.error || "Erro ao carregar detalhes"}`);
        setModalOpen(false);
        return;
      }
      const json = await res.json();
      if (json.store) {
        // Normalizar joins do Supabase (vêm como array)
        const raw = json.store;
        raw.store_usage = Array.isArray(raw.store_usage) ? raw.store_usage[0] || null : raw.store_usage;
        raw.plans = Array.isArray(raw.plans) ? raw.plans[0] || null : raw.plans;
        setSelectedStore(raw);
        setCreditCampaigns(raw.credit_campaigns || 0);
        setCreditModels(raw.credit_models || 0);
      }
    } catch {
      showToast("❌ Erro de conexão");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedStore(null);
    setDeleteConfirm(false);
    setDeleteTyped("");
  };

  // Save credits
  const handleSave = async () => {
    if (!selectedStore) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: selectedStore.id,
          credit_campaigns: creditCampaigns,
          credit_models: creditModels,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(`❌ ${data.error || "Erro ao salvar"}`);
        return;
      }

      showToast("✅ Créditos atualizados");
      fetchStores();
      // Refresh modal data
      const fresh = await fetch(`/api/admin/stores?id=${selectedStore.id}`);
      const json = await fresh.json();
      if (json.store) {
        const raw = json.store;
        raw.store_usage = Array.isArray(raw.store_usage) ? raw.store_usage[0] || null : raw.store_usage;
        raw.plans = Array.isArray(raw.plans) ? raw.plans[0] || null : raw.plans;
        setSelectedStore(raw);
      }
    } catch {
      showToast("❌ Erro de conexão ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // Reset backdrop
  const handleResetBackdrop = async () => {
    if (!selectedStore) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: selectedStore.id,
          reset_backdrop: true,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(`❌ ${data.error || "Erro ao liberar backdrop"}`);
        return;
      }

      showToast("✅ Backdrop liberado para regeneração");
      setSelectedStore(prev => prev ? { ...prev, backdrop_updated_at: null } : null);
    } catch {
      showToast("❌ Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  // Delete store
  const handleDeleteStore = async () => {
    if (!selectedStore) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/stores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: selectedStore.id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(`❌ ${data.error || "Erro ao deletar"}`);
        return;
      }

      showToast(`✅ "${selectedStore.name}" deletada`);
      closeModal();
      fetchStores();
    } catch {
      showToast("❌ Erro de conexão ao deletar");
    } finally {
      setDeleting(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Plan badge colors
  const planColor = (planName?: string) => {
    const n = planName?.toLowerCase() || "";
    if (n.includes("business")) return "bg-violet-500/15 text-violet-400 border-violet-500/30";
    if (n.includes("essencial")) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (n.includes("pro")) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-gray-500/15 text-gray-400 border-gray-500/30";
  };

  // Season emoji
  const seasonEmoji = (s: string | null) => {
    if (s === "verao") return "☀️";
    if (s === "outono") return "🍂";
    if (s === "inverno") return "❄️";
    return "🌸";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin border-fuchsia-500" />
      </div>
    );
  }

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
            {stores.map((store) => {
              const usage = Array.isArray(store.store_usage) ? store.store_usage[0] : store.store_usage;
              return (
                <button
                  key={store.id}
                  onClick={() => openModal(store.id)}
                  className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {store.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{store.name}</p>
                      <p className="text-[11px] text-gray-500">{store.segment_primary || "Sem segmento"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${store.onboarding_completed ? "text-emerald-400" : "text-yellow-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${store.onboarding_completed ? "bg-emerald-400" : "bg-yellow-400"}`} />
                      {store.onboarding_completed ? "Ativo" : "Onboarding"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-medium border ${planColor(store.plans?.display_name)}`}>
                      {store.plans?.display_name || "Sem plano"}
                    </span>
                    <span className="text-gray-400">
                      {usage ? `${usage.campaigns_generated}/${usage.campaigns_limit}` : "0/0"}
                    </span>
                    <span className="text-gray-600 ml-auto">
                      {formatDateBR(store.created_at)}
                    </span>
                  </div>
                </button>
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
                  {stores.map((store) => {
                    const usage = Array.isArray(store.store_usage) ? store.store_usage[0] : store.store_usage;
                    return (
                      <tr
                        key={store.id}
                        onClick={() => openModal(store.id)}
                        className="hover:bg-gray-800/30 transition cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {store.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="text-white font-medium">{store.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{store.segment_primary || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${planColor(store.plans?.display_name)}`}>
                            {store.plans?.display_name || "Sem plano"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {usage ? `${usage.campaigns_generated}/${usage.campaigns_limit}` : "0/0"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-xs ${store.onboarding_completed ? "text-emerald-400" : "text-yellow-400"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${store.onboarding_completed ? "bg-emerald-400" : "bg-yellow-400"}`} />
                            {store.onboarding_completed ? "Ativo" : "Onboarding"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {formatDateBR(store.created_at)}
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

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modalLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin border-fuchsia-500" />
              </div>
            ) : selectedStore ? (
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
                      {selectedStore.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedStore.name}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${planColor(selectedStore.plans?.display_name)}`}>
                          {selectedStore.plans?.display_name || "Sem plano"}
                        </span>
                        <span className="text-gray-500 text-[11px]">{selectedStore.segment_primary || ""}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-gray-500 hover:text-white transition text-xl leading-none p-2">✕</button>
                </div>

                {/* Backdrop status */}
                <div className="rounded-xl p-4 border border-gray-800 bg-gray-800/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">📸 Estúdio IA</h3>
                    {selectedStore.backdrop_ref_url && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Gerado
                        {selectedStore.backdrop_season && (
                          <span className="ml-1">{seasonEmoji(selectedStore.backdrop_season)}</span>
                        )}
                      </span>
                    )}
                  </div>

                  {selectedStore.backdrop_ref_url ? (
                    <div className="rounded-lg overflow-hidden mb-3 relative">
                      <img src={selectedStore.backdrop_ref_url} alt="Backdrop" className="w-full h-28 object-cover" style={{ objectPosition: "center 40%" }} />
                      {selectedStore.backdrop_color && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
                          <div className="w-3 h-3 rounded-full" style={{ background: selectedStore.backdrop_color }} />
                          <span className="text-[10px] text-white font-mono">{selectedStore.backdrop_color}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mb-3">Nenhum estúdio gerado ainda</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-gray-400">
                      {selectedStore.backdrop_updated_at
                        ? `Último: ${formatDateBR(selectedStore.backdrop_updated_at)}`
                        : "Sem cooldown ativo"}
                    </div>
                    <button
                      onClick={handleResetBackdrop}
                      disabled={saving || !selectedStore.backdrop_updated_at}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                    >
                      🔓 Liberar regeneração
                    </button>
                  </div>
                </div>

                {/* Credits */}
                <div className="rounded-xl p-4 border border-gray-800 bg-gray-800/30 space-y-4">
                  <h3 className="text-sm font-semibold text-white">🎛️ Créditos extras</h3>
                  <p className="text-[11px] text-gray-500 -mt-2">Somados ao limite do plano</p>

                  {/* Campanhas */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1.5">
                      📊 Campanhas extras
                      <span className="text-gray-600 ml-1">
                        (plano = {(selectedStore.store_usage as StoreDetail["store_usage"])?.campaigns_limit ?? 0}, extras = {creditCampaigns})
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCreditCampaigns(Math.max(0, creditCampaigns - 1))}
                        className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold transition hover:bg-gray-700 flex items-center justify-center"
                      >−</button>
                      <input
                        type="number"
                        value={creditCampaigns}
                        onChange={(e) => setCreditCampaigns(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm font-mono"
                      />
                      <button
                        onClick={() => setCreditCampaigns(creditCampaigns + 1)}
                        className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold transition hover:bg-gray-700 flex items-center justify-center"
                      >+</button>
                      <button
                        onClick={() => setCreditCampaigns(creditCampaigns + 5)}
                        className="text-[10px] font-medium px-2 py-1.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition"
                      >+5</button>
                      <button
                        onClick={() => setCreditCampaigns(creditCampaigns + 10)}
                        className="text-[10px] font-medium px-2 py-1.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition"
                      >+10</button>
                    </div>
                  </div>

                  {/* Modelos */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1.5">
                      👗 Modelos extras
                      <span className="text-gray-600 ml-1">
                        (usado = {selectedStore.models_used}, extras = {creditModels})
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCreditModels(Math.max(0, creditModels - 1))}
                        className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold transition hover:bg-gray-700 flex items-center justify-center"
                      >−</button>
                      <input
                        type="number"
                        value={creditModels}
                        onChange={(e) => setCreditModels(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm font-mono"
                      />
                      <button
                        onClick={() => setCreditModels(creditModels + 1)}
                        className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 text-white font-bold transition hover:bg-gray-700 flex items-center justify-center"
                      >+</button>
                      <button
                        onClick={() => setCreditModels(creditModels + 3)}
                        className="text-[10px] font-medium px-2 py-1.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition"
                      >+3</button>
                      <button
                        onClick={() => setCreditModels(creditModels + 5)}
                        className="text-[10px] font-medium px-2 py-1.5 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition"
                      >+5</button>
                    </div>
                  </div>
                </div>

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" />
                      Salvando...
                    </>
                  ) : (
                    "💾 Salvar alterações"
                  )}
                </button>

                {/* ── Zona de perigo ── */}
                <div className="rounded-xl p-4 border border-red-900/40 bg-red-950/20 space-y-3">
                  <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">⚠️ Zona de perigo</h3>

                  {!deleteConfirm ? (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      disabled={saving || deleting}
                      className="w-full py-2.5 rounded-lg text-xs font-semibold transition bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40"
                    >
                      🗑️ Apagar loja e todos os dados
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] text-red-300">
                        Essa ação é <strong>irreversível</strong>. Todos os dados serão apagados: campanhas, modelos, fotos, custos e configurações.
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Digite <strong className="text-red-400">{selectedStore.name}</strong> para confirmar:
                      </p>
                      <input
                        type="text"
                        value={deleteTyped}
                        onChange={(e) => setDeleteTyped(e.target.value)}
                        placeholder={selectedStore.name}
                        className="w-full bg-gray-800 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/60"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setDeleteConfirm(false); setDeleteTyped(""); }}
                          className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDeleteStore}
                          disabled={deleteTyped !== selectedStore.name || deleting}
                          className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition bg-red-600 text-white hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          {deleting ? (
                            <>
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin border-white" />
                              Apagando...
                            </>
                          ) : (
                            "🗑️ Confirmar exclusão"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer info */}
                <p className="text-[10px] text-gray-600 text-center">
                  ID: {selectedStore.id} · Cadastro: {formatDateBR(selectedStore.created_at)}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm font-medium shadow-2xl animate-[fadeIn_0.2s_ease-out]">
          {toast}
        </div>
      )}
    </div>
  );
}
