import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Lets a production build run beside `next dev` (NEXT_DIST_DIR=.next-build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: path.join(__dirname),
  // Headless Chrome for PDFs: loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  experimental: {
    serverActions: {
      // Photos and videos go straight to storage (lib/direct-uploads.ts) and
      // are shrunk in the browser, so forms are small. On Vercel requests are
      // capped at 4.5 MB whatever this says; this only matters when self-hosting.
      bodySizeLimit: "25mb"
    }
  }
};

// Staff interface translations; see i18n/request.ts for how the language is chosen.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
