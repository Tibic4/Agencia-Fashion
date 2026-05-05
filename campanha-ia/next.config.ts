import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  // Fix turbopack com paths que contém espaço (ex: "Nova pasta")
  turbopack: {
    root: path.resolve(import.meta.dirname || __dirname),
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

  // Defense-in-depth: nginx-crialook.conf injeta esses headers em prod, mas
  // preview deploys, dev tunneling e qualquer ambiente fora do nginx canônico
  // ficavam nus. Manter espelhado com o nginx evita drift em rotas dinâmicas.
  // CSP fica só no nginx (Report-Only mode, ver ops/csp-rollout.md).
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Prevent native 'canvas' / 'sharp' modules from breaking the build on Linux VPS
  serverExternalPackages: ["canvas", "sharp"],

  /* ═══════════════════════════════════════
     Performance — PageSpeed optimizations
     ═══════════════════════════════════════ */
  // Compressão fica no Nginx (brotli/gzip) — Node não precisa duplicar e queimar CPU
  compress: false,

  // Otimização de imagens: formatos modernos + qualidade boa
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [50, 75, 90],
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

// ── D-27 / M-14: Sentry source-map upload gate ──
// Source maps upload ONLY when SENTRY_AUTH_TOKEN is set in env. Verified
// (.github/workflows/ci.yml — no SENTRY_AUTH_TOKEN secret) that CI does NOT
// pass this token to PR builds today, so PR builds DON'T upload — saving Sentry
// quota.
//
// To enable upload on main-branch deploys (when ready):
//   1. Add SENTRY_AUTH_TOKEN as a GitHub Actions secret
//   2. Gate it in ci.yml's build step:
//        env:
//          SENTRY_AUTH_TOKEN: ${{ github.ref == 'refs/heads/main' && secrets.SENTRY_AUTH_TOKEN || '' }}
//   3. Verify by checking Sentry "Releases" page after a main merge — should see new release
//
// widenClientFileUpload: true means MORE chunks (vendor, framework) get uploaded
// when uploads ARE enabled. That's bandwidth + storage cost; revisit if the
// monthly Sentry quota becomes a constraint.
export default withSentryConfig(nextConfig, {
  // Upload de source maps desabilitado se não houver AUTH_TOKEN
  // (evita quebrar build em ambientes sem credencial Sentry)
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Tunnel route — contorna ad-blockers
  tunnelRoute: "/monitoring",
  // Não subir source maps do client por default (configurar em CI)
  widenClientFileUpload: true,
});
