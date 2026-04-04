import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CriaLook — Marketing de Moda com IA",
    short_name: "CriaLook",
    description: "Transforme fotos de roupa em campanhas de marketing prontas em 60 segundos",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a12",
    theme_color: "#A855F7",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
