"use client";

import dynamic from "next/dynamic";

const KonvaCompositor = dynamic(() => import("@/components/KonvaCompositor"), { ssr: false });

export default function TestKonvaPage() {
  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        🎨 Teste Konva Compositor
      </h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        Simulação do criativo final com overlay de texto na foto da modelo Fashn.
      </p>

      <KonvaCompositor
        modelImageUrl="/test-images/fashn-step1-model.png"
        productName="Moletom Oliva + Short Jeans"
        price="R$ 119,90"
        headline="Conforto + estilo? Esse conjunto tem os dois ✨"
        cta="Compre agora"
        storeName="CriaLook"
        score={88}
      />
    </div>
  );
}
