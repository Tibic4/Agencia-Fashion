"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const KonvaCompositor = dynamic(() => import("@/components/KonvaCompositor"), { ssr: false });

/**
 * Interactive playground for testing KonvaCompositor with dynamic controls.
 * Replaces the old hardcoded-only page.
 */
export default function TestKonvaPage() {
  const [imageUrl, setImageUrl] = useState("/test-images/model-preview.png");
  const [productName, setProductName] = useState("Moletom Oliva + Short Jeans");
  const [price, setPrice] = useState("R$ 119,90");
  const [headline, setHeadline] = useState("Conforto + estilo? Esse conjunto tem os dois ✨");
  const [cta, setCta] = useState("Compre agora");
  const [storeName, setStoreName] = useState("CriaLook");
  const [score, setScore] = useState(88);
  const [format, setFormat] = useState<"feed" | "story">("feed");

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        🎨 Teste Konva Compositor
      </h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        Playground interativo — edite os campos abaixo para testar o compositor em tempo real.
      </p>

      {/* Dynamic controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
          padding: 16,
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>URL da Imagem</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="URL ou caminho da imagem"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>Nome do Produto</span>
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>Preço</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>Headline</span>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>CTA</span>
          <input
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>Nome da Loja</span>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>Score (0-100)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>Formato</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "feed" | "story")}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          >
            <option value="feed">Feed (1080×1350)</option>
            <option value="story">Story (1080×1920)</option>
          </select>
        </label>
      </div>

      {/* Compositor */}
      <KonvaCompositor
        modelImageUrl={imageUrl}
        productName={productName}
        price={price}
        headline={headline}
        cta={cta}
        storeName={storeName}
        score={score}
        format={format}
        enableCustomElements
      />
    </div>
  );
}
