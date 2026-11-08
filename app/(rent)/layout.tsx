import type { Metadata, Viewport } from "next";
import { PlatformRoot } from "../platform-root";
import { rootMetadata, rootViewport } from "../root-metadata";

/**
 * Businesses' booking pages (rove.rent/<slug>, their subdomain or own domain, all served from /rent/<slug>): the
 * platform's root layout (app/platform-root.tsx) on its own (task perf, 8 Nov 2026), for two reasons:
 * - no loading screen above the page, so an unknown address can still answer 404 before anything is sent (the app's
 *   app/(app)/loading.tsx streamed a 200 first, so rove.rent/<anything> looked like a page to search engines);
 * - no Tabler icon font stylesheet (212 KB): these pages draw their icons with lucide-react.
 */
export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

export default function RentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PlatformRoot>{children}</PlatformRoot>;
}
