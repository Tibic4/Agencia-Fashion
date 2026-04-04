"use client";

import { useState, useEffect } from "react";

interface ShowcaseItem {
  id: string;
  before_photo_url: string;
  after_photo_url: string;
  caption: string | null;
}

export default function ShowcaseSection() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.length) setItems(d.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Não renderiza nada se não tem itens
  if (loaded && items.length === 0) return null;
  if (!loaded) return null;

  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="text-center mb-12">
          <div className="badge badge-brand mb-4 inline-flex">Resultado Real</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Veja a <span className="gradient-text">transformação</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--muted)" }}>
            Foto real do manequim vs. modelo IA — aumento de vendas comprovado
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              <div className="grid md:grid-cols-2">
                {/* ANTES */}
                <div className="relative group">
                  <img
                    src={item.before_photo_url}
                    alt="Antes — foto no manequim"
                    className="w-full h-72 md:h-96 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
                    }}
                  />
                  <span
                    className="absolute bottom-4 left-4 text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm"
                    style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
                  >
                    📷 Antes
                  </span>
                </div>

                {/* DEPOIS */}
                <div className="relative group">
                  <img
                    src={item.after_photo_url}
                    alt="Depois — modelo IA"
                    className="w-full h-72 md:h-96 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
                    }}
                  />
                  <span
                    className="absolute bottom-4 left-4 text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm"
                    style={{ background: "var(--gradient-brand)", color: "white" }}
                  >
                    ✨ Depois — Modelo IA
                  </span>
                </div>
              </div>

              {/* Caption */}
              {item.caption && (
                <div className="px-6 py-4 text-center" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    {item.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
