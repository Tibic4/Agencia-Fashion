"use client";

import { useState, useEffect, useCallback } from "react";

interface ShowcaseItem {
  id: string;
  before_photo_url: string;
  after_photo_url: string;
  caption: string | null;
  is_active: boolean;
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

      const res = await fetch("/api/admin/showcase", {
        method: "POST",
        body: formData,
      });

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
        setStatusMsg(`❌ ${data.error}`);
      }
    } catch {
      setStatusMsg("❌ Erro de conexão");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este item da vitrine?")) return;
    try {
      await fetch(`/api/admin/showcase?id=${id}`, { method: "DELETE" });
      fetchItems();
    } catch {
      alert("Erro ao remover");
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          🖼️ <span className="gradient-text">Vitrine</span> Antes/Depois
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Arraste fotos do manequim e do modelo IA — aparece automaticamente na landing page
        </p>
      </div>

      {statusMsg && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm">{statusMsg}</p>
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
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
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
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
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
      <h2 className="font-bold mb-4">
        Itens na vitrine ({items.length})
      </h2>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-3xl mb-2">🖼️</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Nenhum item na vitrine ainda</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Arraste as fotos acima para começar</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-2 gap-1 p-2">
                <div className="relative">
                  <img src={item.before_photo_url} alt="Antes" className="w-full h-40 object-cover rounded-lg" />
                  <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--warning)", color: "black" }}>ANTES</span>
                </div>
                <div className="relative">
                  <img src={item.after_photo_url} alt="Depois" className="w-full h-40 object-cover rounded-lg" />
                  <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--success)", color: "white" }}>DEPOIS</span>
                </div>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {item.caption || "Sem legenda"}
                </p>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs px-3 py-1 rounded-lg transition"
                  style={{ color: "var(--error)" }}
                >
                  🗑️ Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
