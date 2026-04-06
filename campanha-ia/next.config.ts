import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  // Prevent native 'canvas' module from breaking the build on Linux VPS
  serverExternalPackages: ["canvas"],
};

export default nextConfig;
