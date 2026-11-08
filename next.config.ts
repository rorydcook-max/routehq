import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Lets a production build run beside `next dev` (NEXT_DIST_DIR=.next-build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: path.join(__dirname),
  // The website's guides and free resources are Markdown read at run time (lib/site/content.ts), and the downloads
  // are served from outside public/ through a signed link (app/api/download/[slug]): ship them with the server.
  outputFileTracingIncludes: {
    // Chrome's compressed files are read from disk at run time, so tracing doesn't see them. Without this, making any
    // agreement or receipt PDF fails on Vercel ("input directory .../@sparticuz/chromium/bin does not exist").
    "/**": ["./content/**/*", "./node_modules/@sparticuz/chromium/bin/**"],
    "/api/download/**": ["./downloads/**/*"]
  },
  // Headless Chrome for PDFs: loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  async headers() {
    return [
      // Booking-page template fonts, self-hosted (task perf2, 8 Nov 2026; scripts/site-fonts.mjs): kept by browsers
      // and the CDN for 30 days like Google's were, then refreshed in the background.
      { source: "/fonts/sites/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=31536000" }] }
    ];
  },
  async redirects() {
    // The "For owners" page was dropped (28 Oct 2026): the website speaks only to rental businesses for now.
    // Rentle is now TWICE Commerce (Nov 2026): its switching page stays at /switch/rentle.
    return [
      // Straight to "/": /home itself now redirects there (proxy.ts), so pointing here at /home would be a chain.
      { source: "/owners", destination: "/", permanent: true },
      { source: "/switch/twice-commerce", destination: "/switch/rentle", permanent: true },
      { source: "/:locale/switch/twice-commerce", destination: "/:locale/switch/rentle", permanent: true }
    ];
  },
  experimental: {
    // The app and the website have separate root layouts (app/(app), app/(site)/site/[locale]), so an address that
    // matches no page gets its own complete page: app/global-not-found.tsx.
    globalNotFound: true,
    // Going back to a page seen in the last 30 seconds is instant instead of loading it again.
    // Every save already clears this (revalidatePath), so your own changes always show straight away.
    staleTimes: { dynamic: 30, static: 180 },
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
