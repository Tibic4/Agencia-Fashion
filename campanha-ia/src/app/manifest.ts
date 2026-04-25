import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CriaLook — Marketing de Moda com IA",
    short_name: "CriaLook",
    description: "Transforme fotos de roupa em campanhas de marketing prontas pra postar",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a12",
    theme_color: "#A855F7",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
    // screenshots para install prompt no Chrome/Android
    screenshots: [
      {
        src: "/demo-after.webp",
        sizes: "1080x1350",
        type: "image/webp",
        form_factor: "narrow",
        label: "Exemplo de campanha gerada pela CriaLook",
      },
    ],
    // shortcuts para ações comuns
    shortcuts: [
      {
        name: "Criar campanha",
        short_name: "Criar",
        url: "/gerar",
      },
      {
        name: "Meu histórico",
        url: "/historico",
      },
    ],
  };
}
