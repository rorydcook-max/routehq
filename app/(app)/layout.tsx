import type { Metadata, Viewport } from "next";
// Bundled with the app (was "@latest" from a CDN): icons can't change or
// break underneath us, and they load with the page. Imported before the platform's own stylesheets (platform-root.tsx).
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import { PlatformRoot } from "../platform-root";
import { rootMetadata, rootViewport } from "../root-metadata";

// The platform's root layout (app/platform-root.tsx). Businesses' booking pages share it from app/(rent)/layout.tsx
// without the icon font; RoveHQ's website (app/(site)) and rove.rent (app/(rove)) have their own.
export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PlatformRoot>{children}</PlatformRoot>;
}
