import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },

  // Redirects permanentes para rotas legadas
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/sign-in",
        permanent: true,
      },
      {
        source: "/cadastro",
        destination: "/sign-up",
        permanent: true,
      },
    ];
  },
  // Prevent native 'canvas' module from breaking the build on Linux VPS
  serverExternalPackages: ["canvas"],

  /* ═══════════════════════════════════════
     Performance — PageSpeed optimizations
     ═══════════════════════════════════════ */
  // Habilita compressão gzip no Node.js (complementar ao Nginx)
  compress: true,

  // Otimização de imagens: formatos modernos + qualidade boa
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 dias de cache
    remotePatterns: [
      {
        protocol: "https",
        hostname: "emybirklqhonqodzyzet.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
