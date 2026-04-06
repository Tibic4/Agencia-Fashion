import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  // Allow tunnel domains for dev testing
  allowedDevOrigins: [
    "https://crialook-test.loca.lt",
    "https://wendy-consequences-cycle-med.trycloudflare.com",
  ],
  // Prevent native 'canvas' module from breaking the build on Linux VPS
  serverExternalPackages: ["canvas"],
};

export default nextConfig;
