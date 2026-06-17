import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      // Customers upload up to 3 document photos plus a base64 signature.
      // Default 1 MB is too small — 25 MB covers phone camera photos comfortably.
      bodySizeLimit: "25mb"
    }
  }
};

export default nextConfig;
