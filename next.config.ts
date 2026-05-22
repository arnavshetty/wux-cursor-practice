import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Allow large video uploads through /api/videos/[id]/upload
    proxyClientMaxBodySize: 1024 * 1024 * 1024,
  },
};

export default nextConfig;
