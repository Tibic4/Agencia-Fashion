"use client";

import { useState, useEffect, useCallback } from "react";

interface ShowcaseItem {
  id: string;
  before_photo_url: string;
  after_photo_url: string;
  caption: string | null;
  is_active: boolean;
  use_in_tips: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminVitrine() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/showcase");
      if (res.ok) {
        const data = await res.json();
        setItems(data.data || []);
      }
    } catch {
      console.error("Erro ao carregar vitrine");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleFileSelect = (type: "before" | "after", file: File) => {
    const url = URL.createObjectURL(file);
    if (type === "before") {
      setBeforeFile(file);
      setBeforePreview(url);
    } else {
      setAfterFile(file);
      setAfterPreview(url);
    }
  };

  const handleDrop = (type: "before" | "after") => (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(type, file);
    }
  };

  const handleUpload = async () => {
    if (!beforeFile || !afterFile) {
      setStatusMsg("❌ Selecione as duas fotos (antes e depois)");
      return;
    }

    setUploading(true);
    setStatusMsg(null);

    try {
      const formData = new FormData();
      formData.append("before_photo", beforeFile);
      formData.append("after_photo", afterFile);
      if (caption.trim()) formData.append("caption", caption.trim());

      console.log("[Vitrine] Enviando upload...", { before: beforeFile.name, after: afterFile.name });

      const res = await fetch("/api/admin/showcase", {
        method: "POST",
        body: formData,
      });

      console.log("[Vitrine] Resposta:", res.status, res.statusText);

      if (!res.ok) {
        const text = await res.text();
        console.error("[Vitrine] Erro HTTP:", res.status, text);
        setStatusMsg(`❌ Erro ${res.status}: ${text}`);
        return;
      }

      const data = await res.json();

      if (data.success) {
        setStatusMsg("✅ Vitrine atualizada! Já aparece na landing page.");
        setBeforeFile(null);
        setAfterFile(null);
        setBeforePreview(null);
        setAfterPreview(null);
        setCaption("");
        fetchItems();
      } else {
        setStatusMsg(`❌ ${data.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      console.error("[Vitrine] Erro:", err);
      setStatusMsg(`❌ Erro de conexão: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setUploading(false);
    }
  };

  // ── Delete (com limpeza de storage) ──
  const handleDelete = async (id: string) => {
    if (!confirm("Remover este item da vitrine? As imagens serão excluídas permanentemente.")) return;
    try {
      const res = await fetch(`/api/admin/showcase?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setStatusMsg("✅ Item removido e imagens excluídas do storage.");
        fetchItems();
      } else {
        setStatusMsg(`❌ ${data.error}`);
      }
    } catch {
      setStatusMsg("❌ Erro ao remover");
    }
  };

  // ── Toggle ativo/inativo ou use_in_tips ──
  const handleToggle = async (id: string, currentValue: boolean, field: "is_active" | "use_in_tips" = "is_active") => {
    try {
      await fetch("/api/admin/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: !currentValue }),
      });
      fetchItems();
    } catch {
      setStatusMsg("❌ Erro ao atualizar");
    }
  };

  // ── Editar legenda inline ──
  const startEditing = (item: ShowcaseItem) => {
    setEditingId(item.id);
    setEditCaption(item.caption || "");
  };

  const saveCaption = async (id: string) => {
    try {
      await fetch("/api/admin/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, caption: editCaption }),
      });
      setEditingId(null);
      fetchItems();
    } catch {
      setStatusMsg("❌ Erro ao salvar legenda");
    }
  };

  // ── Reordenar (mover pra cima/baixo) ──
  const handleMove = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === items.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const currentItem = items[index];
    const swapItem = items[swapIndex];

    // Trocar sort_order entre os dois
    try {
      await Promise.all([
        fetch("/api/admin/showcase", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentItem.id, sort_order: swapItem.sort_order }),
        }),
        fetch("/api/admin/showcase", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: swapItem.id, sort_order: currentItem.sort_order }),
        }),
      ]);
      fetchItems();
    } catch {
      setStatusMsg("❌ Erro ao reordenar");
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          🖼️ <span className="gradient-text">Vitrine</span> Antes/Depois
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Gerencie as transformações que aparecem na landing page
        </p>
      </div>

      {statusMsg && (
        <div className="surface-card mb-6 p-4 flex items-center justify-between">
          <p className="text-sm">{statusMsg}</p>
          <button onClick={() => setStatusMsg(null)} className="text-sm ml-4" style={{ color: "var(--muted)" }}>✕</button>
        </div>
      )}

      {/* Upload area */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: "var(--gradient-card)", border: "1px solid var(--border)" }}>
        <h2 className="font-bold mb-4">Adicionar novo</h2>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* ANTES */}
          <div
            onDrop={handleDrop("before")}
            onDragOver={(e) => e.preventDefault()}
            className="relative rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              background: beforePreview ? "transparent" : "var(--background)",
              border: "2px dashed var(--border)",
              minHeight: "200px",
            }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileSelect("before", file);
              };
              input.click();
            }}
          >
            {beforePreview ? (
              <img src={beforePreview} alt="Antes" className="w-full h-48 object-contain rounded-lg" />
            ) : (
              <>
                <span className="text-3xl mb-2">👕</span>
                <p className="text-sm font-semibold">ANTES</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Foto do manequim/cabide</p>
              </>
            )}
            <span className="absolute top-2 left-2 text-2xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--warning)", color: "black" }}>ANTES</span>
          </div>

          {/* DEPOIS */}
          <div
            onDrop={handleDrop("after")}
            onDragOver={(e) => e.preventDefault()}
            className="relative rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              background: afterPreview ? "transparent" : "var(--background)",
              border: "2px dashed var(--border)",
              minHeight: "200px",
            }}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileSelect("after", file);
              };
              input.click();
            }}
          >
            {afterPreview ? (
              <img src={afterPreview} alt="Depois" className="w-full h-48 object-contain rounded-lg" />
            ) : (
              <>
                <span className="text-3xl mb-2">💃</span>
                <p className="text-sm font-semibold">DEPOIS</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Foto com modelo IA</p>
              </>
            )}
            <span className="absolute top-2 left-2 text-2xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--success)", color: "white" }}>DEPOIS</span>
          </div>
        </div>

        {/* Caption (opcional) */}
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Legenda (opcional) — ex: &quot;Vendas aumentaram 3x&quot;"
          className="w-full px-4 py-3 rounded-xl text-sm mb-4"
          style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />

        <button
          onClick={handleUpload}
          disabled={uploading || !beforeFile || !afterFile}
          className="btn-primary w-full !py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Enviando..." : "📤 Publicar na vitrine"}
        </button>
      </div>

      {/* Lista de itens existentes */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold">
          Itens na vitrine ({items.length})
        </h2>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--success)" }} /> Ativo
          <span className="inline-block w-2 h-2 rounded-full ml-2" style={{ background: "var(--border)" }} /> Oculto
          <span className="inline-block w-2 h-2 rounded-full ml-2" style={{ background: "var(--brand-500)" }} /> Guia
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Carregando...</p>
      ) : items.length === 0 ? (
        <div className="surface-card text-center py-12">
          <p className="text-3xl mb-2">🖼️</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Nenhum item na vitrine ainda</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Arraste as fotos acima para começar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: "var(--surface)",
                border: `1px solid ${item.use_in_tips ? "var(--brand-500)" : item.is_active ? "var(--border)" : "var(--error)"}`,
                opacity: item.is_active ? 1 : 0.6,
              }}
            >
              {/* Badge se for Guia Relâmpago */}
              {item.use_in_tips && (
                <div className="px-4 py-1.5 text-xs font-bold text-center" style={{ background: "var(--brand-500)", color: "white" }}>
                  ⚡ Aparece no Guia Relâmpago
                </div>
              )}
              {/* Imagens lado a lado */}
              <div className="grid grid-cols-2 gap-1 p-2">
                <div className="relative">
                  <img src={item.before_photo_url} alt="Antes" className="w-full h-40 object-cover rounded-lg" style={{ objectPosition: "top center" }} />
                  <span className="absolute top-1 left-1 text-2xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--warning)", color: "black" }}>ANTES</span>
                </div>
                <div className="relative">
                  <img src={item.after_photo_url} alt="Depois" className="w-full h-40 object-cover rounded-lg" style={{ objectPosition: "top center" }} />
                  <span className="absolute top-1 left-1 text-2xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--success)", color: "white" }}>DEPOIS</span>
                </div>
              </div>

              {/* Caption (editable) */}
              <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      placeholder="Nova legenda..."
                      autoFocus
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg"
                      style={{ background: "var(--background)", border: "1px solid var(--brand-500)", color: "var(--foreground)" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveCaption(item.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button onClick={() => saveCaption(item.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--success)", color: "white" }}>
                      ✓
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--muted)" }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <p
                    className="text-xs cursor-pointer hover:underline"
                    style={{ color: item.caption ? "var(--foreground)" : "var(--muted)" }}
                    onClick={() => startEditing(item)}
                    title="Clique para editar"
                  >
                    {item.caption || "Sem legenda — clique para adicionar"}
                  </p>
                )}
              </div>

              {/* Ações */}
              <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                {/* Reordenar */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="text-sm px-2 py-1 rounded-lg transition-all hover:bg-[var(--background)] disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(index, "down")}
                    disabled={index === items.length - 1}
                    className="text-sm px-2 py-1 rounded-lg transition-all hover:bg-[var(--background)] disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                  <span className="text-2xs ml-1" style={{ color: "var(--muted)" }}>#{index + 1}</span>
                </div>

                {/* Guia Relâmpago + Toggle + Delete */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleToggle(item.id, item.use_in_tips, "use_in_tips")}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all min-h-[44px]"
                    style={{
                      background: item.use_in_tips ? "var(--brand-500)" : "var(--background)",
                      color: item.use_in_tips ? "white" : "var(--muted)",
                      border: `1px solid ${item.use_in_tips ? "transparent" : "var(--border)"}`,
                    }}
                    title="Mostrar no Guia Relâmpago (dicas de foto)"
                  >
                    {item.use_in_tips ? "⚡ Guia" : "⚡ Guia"}
                  </button>
                  <button
                    onClick={() => handleToggle(item.id, item.is_active, "is_active")}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all min-h-[44px]"
                    style={{
                      background: item.is_active ? "var(--background)" : "var(--success)",
                      color: item.is_active ? "var(--muted)" : "white",
                      border: `1px solid ${item.is_active ? "var(--border)" : "transparent"}`,
                    }}
                  >
                    {item.is_active ? "👁️ Ocultar" : "✅ Ativar"}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-red-500/10 min-h-[44px]"
                    style={{ color: "var(--error)" }}
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
